import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { gettext } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
const FILE_URI_PREFIX = 'file://';
export class VSCodeWorkspacesCore {
    metadata;
    openPreferences;
    constructor(metadata, openPreferences, gsettings) {
        this.metadata = metadata;
        this.openPreferences = openPreferences;
        this.gsettings = gsettings;
    }
    gsettings;
    _indicator;
    _refreshInterval = 30;
    _refreshTimeout = null;
    _newWindow = false;
    _editorLocation = '';
    _preferCodeWorkspaceFile = false;
    _debug = false;
    _workspaces = new Set();
    _recentWorkspaces = new Set();
    _userConfigDir = GLib.build_filenamev([GLib.get_home_dir(), '.config']);
    _foundEditors = [];
    _activeEditor;
    _editors = [
        {
            name: 'vscode',
            binary: 'code',
            workspacePath: GLib.build_filenamev([this._userConfigDir, 'Code/User/workspaceStorage']),
            isDefault: true,
        },
        {
            name: 'codium',
            binary: 'codium',
            workspacePath: GLib.build_filenamev([this._userConfigDir, 'VSCodium/User/workspaceStorage']),
        },
        {
            name: 'code-insiders',
            binary: 'code-insiders',
            workspacePath: GLib.build_filenamev([this._userConfigDir, 'Code - Insiders/User/workspaceStorage']),
        },
        {
            name: 'cursor',
            binary: 'cursor',
            workspacePath: GLib.build_filenamev([this._userConfigDir, 'Cursor/User/workspaceStorage']),
        },
        {
            name: 'antigravity',
            binary: 'antigravity',
            workspacePath: GLib.build_filenamev([this._userConfigDir, 'Antigravity/User/workspaceStorage']),
        },
    ];
    _iconNames = ['code', 'vscode', 'vscodium', 'codium', 'code-insiders', 'cursor', 'antigravity'];
    _menuUpdating = false;
    _cleanupOrphanedWorkspaces = false;
    _nofailList = [];
    _customCmdArgs = '';
    _favorites = new Set();
    _lastUserInteraction = 0;
    _currentRefreshInterval = 30;
    _maxRefreshInterval = 300;
    _minRefreshInterval = 30;
    _customIconPath = '';
    _activeTooltips = [];
    enable() {
        this._log(`VSCode Workspaces Extension enabled`);
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._setSettings();
        const icon = this._createIcon();
        this._indicator.add_child(icon);
        Main.panel.addToStatusArea(this.metadata.uuid, this._indicator);
        if (!this.gsettings) {
            this._log('No gsettings found');
            return;
        }
        this.gsettings.connect('changed', () => {
            const oldCustomIconPath = this._customIconPath;
            this._setSettings();
            if (oldCustomIconPath !== this._customIconPath) {
                this._updateIcon();
            }
            this._startRefresh();
        });
        this._initializeWorkspaces();
    }
    disable() {
        this._persistSettings();
        this._removeAllTooltips();
        this._cleanup();
        if (this._refreshTimeout) {
            GLib.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = undefined;
        }
        this.gsettings = undefined;
        this._log(`VSCode Workspaces Extension disabled`);
    }
    _removeAllTooltips() {
        for (const tooltip of this._activeTooltips) {
            try {
                if (tooltip && tooltip.get_parent()) {
                    tooltip.get_parent().remove_child(tooltip);
                }
                tooltip?.destroy();
            } catch (e) {
                // already gone, ignore
            }
        }
        this._activeTooltips = [];
    }
    _createIcon() {
        let icon;
        if (this._customIconPath && this._customIconPath.trim() !== '') {
            const iconPath = this._customIconPath.trim();
            if (GLib.file_test(iconPath, GLib.FileTest.EXISTS) && !GLib.file_test(iconPath, GLib.FileTest.IS_DIR)) {
                this._log(`Using custom icon file: ${iconPath}`);
                icon = new St.Icon({
                    gicon: Gio.icon_new_for_string(iconPath),
                    style_class: 'system-status-icon',
                });
            }
            else {
                const iconTheme = St.IconTheme.new();
                if (iconTheme.has_icon(iconPath)) {
                    this._log(`Using custom theme icon: ${iconPath}`);
                    icon = new St.Icon({
                        icon_name: iconPath,
                        style_class: 'system-status-icon',
                    });
                }
                else {
                    this._log(`Custom icon "${iconPath}" not found, using fallback`);
                    icon = this._createDefaultIcon();
                }
            }
        }
        else {
            icon = this._createDefaultIcon();
        }
        return icon;
    }
    _createDefaultIcon() {
        let iconName = 'code';
        for (const name of this._iconNames) {
            if (this._iconExists(name)) {
                iconName = name;
                break;
            }
        }
        this._log(`Using default icon: ${iconName}`);
        return new St.Icon({
            icon_name: iconName,
            style_class: 'system-status-icon',
        });
    }
    _updateIcon() {
        if (!this._indicator)
            return;
        this._indicator.remove_all_children();
        const icon = this._createIcon();
        this._indicator.add_child(icon);
        this._log('Icon updated');
    }
    _persistSettings() {
        if (!this.gsettings)
            return;
        this.gsettings.set_strv('nofail-workspaces', this._nofailList);
        this.gsettings.set_string('custom-cmd-args', this._customCmdArgs);
        this.gsettings.set_strv('favorite-workspaces', Array.from(this._favorites));
        this.gsettings.set_string('custom-icon', this._customIconPath);
        this.gsettings.set_boolean('new-window', this._newWindow);
        this.gsettings.set_string('editor-location', this._editorLocation);
        this.gsettings.set_int('refresh-interval', this._refreshInterval);
        this.gsettings.set_boolean('prefer-workspace-file', this._preferCodeWorkspaceFile);
        this.gsettings.set_boolean('debug', this._debug);
        this.gsettings.set_boolean('cleanup-orphaned-workspaces', this._cleanupOrphanedWorkspaces);
        this._log('Persisted settings to gsettings');
    }
    _cleanup() {
        this._workspaces.clear();
        this._recentWorkspaces.clear();
        this._favorites.clear();
        this._foundEditors = [];
        this._log(`VSCode Workspaces Extension cleaned up`);
    }
    _initializeWorkspaces() {
        this._log('Initializing workspaces');
        this._foundEditors = [];
        for (const editor of this._editors) {
            const dir = Gio.File.new_for_path(editor.workspacePath);
            this._log(`Checking for ${editor.name} workspace storage directory: ${editor.workspacePath}`);
            if (!dir.query_exists(null)) {
                this._log(`No ${editor.name} workspace storage directory found: ${editor.workspacePath}`);
                continue;
            }
            this._log(`Found ${editor.name} workspace storage directory: ${editor.workspacePath}`);
            this._foundEditors.push(editor);
        }
        this._log(`Found editors: ${this._foundEditors.map(editor => editor.name)}`);
        this._setActiveEditor();
        this._log(`Active editor: ${this._activeEditor?.name}`);
        if (!this._activeEditor) {
            this._log('No active editor found');
            return;
        }
        this._refresh();
    }
    _setActiveEditor() {
        const editorLocation = this._editorLocation;
        const alternativePaths = [
            GLib.build_filenamev([this._userConfigDir, 'Cursor/User/workspaceStorage']),
            GLib.build_filenamev([this._userConfigDir, 'cursor/User/workspaceStorage']),
            GLib.build_filenamev([this._userConfigDir, 'Code/User/workspaceStorage']),
            GLib.build_filenamev([this._userConfigDir, 'code/User/workspaceStorage']),
            GLib.build_filenamev([this._userConfigDir, 'VSCodium/User/workspaceStorage']),
            GLib.build_filenamev([this._userConfigDir, 'vscodium/User/workspaceStorage'])
        ];
        if (editorLocation === 'auto') {
            this._activeEditor = this._foundEditors.find(editor => editor.isDefault) ?? this._foundEditors[0];
        }
        else {
            const isCustomPath = editorLocation.includes('/');
            if (isCustomPath) {
                this._log(`Using custom editor binary path: ${editorLocation}`);
                const customName = GLib.path_get_basename(editorLocation);
                const lowerCustomName = customName.toLowerCase();
                let customWorkspacePath = '';
                if (lowerCustomName.includes('code') || lowerCustomName.includes('codium') || lowerCustomName.includes('antigravity')) {
                    if (lowerCustomName.includes('insiders')) {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Code - Insiders/User/workspaceStorage']);
                    }
                    else if (lowerCustomName.includes('codium')) {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'VSCodium/User/workspaceStorage']);
                    }
                    else if (lowerCustomName.includes('cursor')) {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Cursor/User/workspaceStorage']);
                    }
                    else if (lowerCustomName.includes('antigravity')) {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Antigravity/User/workspaceStorage']);
                    }
                    else {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Code/User/workspaceStorage']);
                    }
                }
                else {
                    customWorkspacePath = GLib.build_filenamev([this._userConfigDir, `${customName}/User/workspaceStorage`]);
                }
                const customEditor = {
                    name: `custom (${customName})`,
                    binary: editorLocation,
                    workspacePath: customWorkspacePath
                };
                const dir = Gio.File.new_for_path(customEditor.workspacePath);
                if (dir.query_exists(null)) {
                    this._log(`Found workspace directory for custom editor: ${customEditor.workspacePath}`);
                }
                else {
                    this._log(`Workspace directory not found for custom editor: ${customEditor.workspacePath}`);
                    for (const altPath of alternativePaths) {
                        const altDir = Gio.File.new_for_path(altPath);
                        if (altDir.query_exists(null)) {
                            this._log(`Found alternative workspace directory: ${altPath}`);
                            customEditor.workspacePath = altPath;
                            break;
                        }
                    }
                    if (!Gio.File.new_for_path(customEditor.workspacePath).query_exists(null)) {
                        this._log(`No alternative workspace paths found. Please create the directory or adjust your settings.`);
                    }
                }
                this._activeEditor = customEditor;
                if (!this._foundEditors.some(e => e.binary === customEditor.binary)) {
                    this._foundEditors.push(customEditor);
                }
            }
            else {
                this._activeEditor = this._foundEditors.find(editor => editor.binary === editorLocation);
                if (!this._activeEditor && editorLocation !== '') {
                    this._log(`No predefined editor found for binary '${editorLocation}', creating custom editor entry`);
                    const lowerEditorLocation = editorLocation.toLowerCase();
                    let customWorkspacePath = '';
                    if (lowerEditorLocation.includes('code') || lowerEditorLocation.includes('codium') || lowerEditorLocation.includes('antigravity')) {
                        if (lowerEditorLocation.includes('insiders')) {
                            customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Code - Insiders/User/workspaceStorage']);
                        }
                        else if (lowerEditorLocation.includes('codium')) {
                            customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'VSCodium/User/workspaceStorage']);
                        }
                        else if (lowerEditorLocation.includes('cursor')) {
                            customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Cursor/User/workspaceStorage']);
                        }
                        else if (lowerEditorLocation.includes('antigravity')) {
                            customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Antigravity/User/workspaceStorage']);
                        }
                        else {
                            customWorkspacePath = GLib.build_filenamev([this._userConfigDir, 'Code/User/workspaceStorage']);
                        }
                    }
                    else {
                        customWorkspacePath = GLib.build_filenamev([this._userConfigDir, `${editorLocation}/User/workspaceStorage`]);
                    }
                    const customEditor = {
                        name: `custom (${editorLocation})`,
                        binary: editorLocation,
                        workspacePath: customWorkspacePath
                    };
                    const dir = Gio.File.new_for_path(customEditor.workspacePath);
                    if (dir.query_exists(null)) {
                        this._log(`Found workspace directory for custom editor: ${customEditor.workspacePath}`);
                        this._foundEditors.push(customEditor);
                        this._activeEditor = customEditor;
                    }
                    else {
                        this._log(`Workspace directory not found for custom editor: ${customEditor.workspacePath}`);
                        for (const altPath of alternativePaths) {
                            const altDir = Gio.File.new_for_path(altPath);
                            if (altDir.query_exists(null)) {
                                this._log(`Found alternative workspace directory: ${altPath}`);
                                customEditor.workspacePath = altPath;
                                this._foundEditors.push(customEditor);
                                this._activeEditor = customEditor;
                                break;
                            }
                        }
                        if (!this._activeEditor) {
                            this._log(`No alternative workspace paths found. Using custom editor anyway.`);
                            this._activeEditor = customEditor;
                        }
                    }
                }
                if (!this._activeEditor && this._foundEditors.length > 0) {
                    this._activeEditor = this._foundEditors[0];
                }
            }
        }
        if (this._activeEditor) {
            this._log(`Active editor set to: ${this._activeEditor.name} (${this._activeEditor.binary})`);
            this._log(`Using workspace storage path: ${this._activeEditor.workspacePath}`);
        }
        else {
            this._log('No editor found!');
        }
    }
    _setSettings() {
        if (!this.gsettings) {
            this._log('Settings not found');
            return;
        }
        this._newWindow = this.gsettings.get_value('new-window').deepUnpack() ?? false;
        this._editorLocation = this.gsettings.get_value('editor-location').deepUnpack() ?? 'auto';
        this._refreshInterval = this.gsettings.get_value('refresh-interval').deepUnpack() ?? 300;
        this._preferCodeWorkspaceFile = this.gsettings.get_value('prefer-workspace-file').deepUnpack() ?? false;
        this._debug = this.gsettings.get_value('debug').deepUnpack() ?? false;
        this._cleanupOrphanedWorkspaces = this.gsettings.get_value('cleanup-orphaned-workspaces').deepUnpack() ?? false;
        this._nofailList = this.gsettings.get_value('nofail-workspaces').deepUnpack() ?? [];
        this._customCmdArgs = this.gsettings.get_value('custom-cmd-args').deepUnpack() ?? '';
        const favs = this.gsettings.get_value('favorite-workspaces').deepUnpack() ?? [];
        this._favorites = new Set(favs);
        this._customIconPath = this.gsettings.get_value('custom-icon').deepUnpack() ?? '';
        this._log(`New Window: ${this._newWindow}`);
        this._log(`Workspaces Storage Location: ${this._editorLocation}`);
        this._log(`Refresh Interval: ${this._refreshInterval}`);
        this._log(`Prefer Code Workspace File: ${this._preferCodeWorkspaceFile}`);
        this._log(`Debug: ${this._debug}`);
        this._log(`Cleanup Orphaned Workspaces: ${this._cleanupOrphanedWorkspaces}`);
        this._log(`No-fail workspaces: ${this._nofailList.join(', ')}`);
        this._log(`Custom CMD Args: ${this._customCmdArgs}`);
        this._log(`Favorite Workspaces: ${Array.from(this._favorites).join(', ')}`);
        this._log(`Custom Icon Path: ${this._customIconPath}`);
    }
    _iconExists(iconName) {
        try {
            const iconTheme = St.IconTheme.new();
            return iconTheme.has_icon(iconName);
        }
        catch (error) {
            console.error(error, 'Failed to check if icon exists');
            return false;
        }
    }
    _createMenu() {
        if (!this._indicator)
            return;
        this._recordUserInteraction();
        if (this._menuUpdating) {
            this._log('Menu update skipped due to concurrent update');
            return;
        }
        if (this._indicator.menu instanceof PopupMenu.PopupMenu && this._indicator.menu.isOpen) {
            this._log('Menu is open, deferring update');
            const openStateChangedId = this._indicator.menu.connect('open-state-changed', (menu, isOpen) => {
                if (!isOpen) {
                    this._log('Menu closed, performing deferred update');
                    if (this._indicator && this._indicator.menu) {
                        this._indicator.menu.disconnect(openStateChangedId);
                    }
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        this._buildMenu();
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });
            return;
        }
        this._buildMenu();
    }
    _buildMenu() {
        if (!this._indicator)
            return;
        this._menuUpdating = true;
        this._removeAllTooltips();
        try {
            this._indicator.menu.removeAll();
            // Clean up tooltips when the menu closes
            this._indicator.menu.connect('open-state-changed', (_menu, isOpen) => {
                if (!isOpen) {
                    this._removeAllTooltips();
                }
            });
            this._createRecentWorkspacesMenu();
            this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const itemSettings = new PopupMenu.PopupSubMenuMenuItem('Settings');
            const itemClearWorkspaces = new PopupMenu.PopupMenuItem('Clear Workspaces');
            itemClearWorkspaces.connect('activate', () => {
                this._clearRecentWorkspaces();
            });
            const itemRefresh = new PopupMenu.PopupMenuItem('Refresh');
            itemRefresh.connect('activate', () => {
                this._refresh(true);
            });
            const itemPreferences = new PopupMenu.PopupMenuItem('Extension Preferences');
            itemPreferences.connect('activate', () => {
                this._openExtensionPreferences();
            });
            itemSettings.menu.addMenuItem(itemClearWorkspaces);
            itemSettings.menu.addMenuItem(itemRefresh);
            itemSettings.menu.addMenuItem(itemPreferences);
            this._indicator.menu.addMenuItem(itemSettings);
            this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            if (this._foundEditors.length > 1) {
                this._createEditorSelector();
            }
            const itemQuit = new PopupMenu.PopupMenuItem('Quit');
            itemQuit.connect('activate', () => {
                this._quit();
            });
            this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._indicator.menu.addMenuItem(itemQuit);
        }
        finally {
            this._menuUpdating = false;
        }
    }
    _createEditorSelector() {
        if (!this._indicator)
            return;
        const editorSelector = new PopupMenu.PopupSubMenuMenuItem('Select Editor');
        this._foundEditors.forEach(editor => {
            const item = new PopupMenu.PopupMenuItem(editor.name);
            const isActive = this._activeEditor?.binary === editor.binary;
            if (isActive) {
                item.setOrnament(PopupMenu.Ornament.DOT);
            }
            item.connect('activate', () => {
                this._recordUserInteraction();
                this._editorLocation = editor.binary;
                this.gsettings?.set_string('editor-location', editor.binary);
                this._setActiveEditor();
                this._refresh(true);
            });
            editorSelector.menu.addMenuItem(item);
        });
        this._indicator.menu.addMenuItem(editorSelector);
    }
    _get_name(workspace) {
        let nativePath = decodeURIComponent(workspace.path).replace(FILE_URI_PREFIX, '');
        let name = GLib.path_get_basename(nativePath);
        try {
            const file = Gio.File.new_for_path(nativePath);
            if (file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY) {
                const enumerator = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    const childName = info.get_name();
                    if (childName.endsWith('.code-workspace')) {
                        name = childName.replace('.code-workspace', '');
                        break;
                    }
                }
                enumerator.close(null);
            }
            else {
                if (name.endsWith('.code-workspace')) {
                    name = name.replace('.code-workspace', '');
                }
            }
        }
        catch (error) {
            console.error(error, 'Error getting workspace name');
        }
        name = name.replace(GLib.get_home_dir(), '~');
        return name;
    }
    _get_full_path(workspace) {
        let path = decodeURIComponent(workspace.path);
        path = path.replace(FILE_URI_PREFIX, '').replace(GLib.get_home_dir(), '~');
        return path;
    }
    _createFavoriteButton(workspace) {
        const starIcon = new St.Icon({
            icon_name: this._favorites.has(workspace.path) ? 'tag-outline-symbolic' : 'tag-outline-add-symbolic',
            style_class: 'vscws-favorite-icon',
        });
        if (this._favorites.has(workspace.path)) {
            starIcon.add_style_class_name('is-favorited');
        }
        const starButton = new St.Button({
            child: starIcon,
            style_class: 'vscws-icon-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        starButton.connect('clicked', () => {
            this._toggleFavorite(workspace);
            if (this._favorites.has(workspace.path)) {
                starIcon.add_style_class_name('is-favorited');
            }
            else {
                starIcon.remove_style_class_name('is-favorited');
            }
        });
        return starButton;
    }
    _createTrashButton(workspace) {
        const trashIcon = new St.Icon({
            icon_name: 'user-trash-symbolic',
            style_class: 'vscws-trash-icon',
        });
        const trashButton = new St.Button({
            child: trashIcon,
            style_class: 'vscws-icon-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        trashButton.connect('clicked', () => {
            workspace.softRemove();
        });
        return trashButton;
    }
    _createItemContainer(workspace) {
        const item = new PopupMenu.PopupMenuItem('');
        item.actor.add_style_class_name('vscws-menu-item');
        const container = new St.BoxLayout({ style_class: 'vscws-workspace-box', vertical: false });
        const label = new St.Label({ text: this._get_name(workspace) });
        container.set_x_expand(true);
        container.add_child(label);
        const starButton = this._createFavoriteButton(workspace);
        const trashButton = this._createTrashButton(workspace);
        container.add_child(starButton);
        container.add_child(trashButton);
        item.add_child(container);
        let tooltip = null;
        const _removeTooltip = () => {
            if (tooltip) {
                try {
                    if (tooltip.get_parent()) {
                        tooltip.get_parent().remove_child(tooltip);
                    }
                    tooltip.destroy();
                } catch (e) {
                    // tooltip already gone, ignore
                }
                const idx = this._activeTooltips.indexOf(tooltip);
                if (idx !== -1) this._activeTooltips.splice(idx, 1);
                tooltip = null;
            }
        };
        item.connect('activate', () => {
            _removeTooltip();
            this._openWorkspace(workspace.path);
        });
        item.actor.connect('enter-event', () => {
            this._removeAllTooltips();
            tooltip = new St.Label({
                text: this._get_full_path(workspace),
                style_class: 'vscws-workspace-tooltip'
            });
            Main.uiGroup.add_child(tooltip);
            this._activeTooltips.push(tooltip);
            // Measure width after adding to stage to avoid "not in stage" errors
            const [x, y] = item.actor.get_transformed_position();
            const [, natWidth] = tooltip.get_preferred_width(-1);
            tooltip.set_position(x - Math.floor(natWidth / 1.15), y);
            tooltip.add_style_class_name('show');
        });
        item.actor.connect('leave-event', () => {
            _removeTooltip();
        });
        item.connect('destroy', () => {
            _removeTooltip();
        });
        return item;
    }
    _createRecentWorkspacesMenu() {
        if (this._recentWorkspaces?.size === 0) {
            this._log('No recent workspaces found');
            return;
        }
        const popupMenu = this._indicator?.menu;
        if (!popupMenu)
            return;
        const MAX_VISIBLE = 10;
        const favorites = Array.from(this._recentWorkspaces).filter(ws => this._favorites.has(ws.path));
        const others = Array.from(this._recentWorkspaces).filter(ws => !this._favorites.has(ws.path));
        // Favorites always shown directly at the top
        if (favorites.length > 0) {
            favorites.forEach(workspace => {
                const item = this._createItemContainer(workspace);
                popupMenu.addMenuItem(item);
            });
            popupMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        // Show first N recent workspaces directly
        const visible = others.slice(0, MAX_VISIBLE);
        const remaining = others.slice(MAX_VISIBLE);
        visible.forEach(workspace => {
            const item = this._createItemContainer(workspace);
            popupMenu.addMenuItem(item);
        });
        // Put the rest inside a "Show More..." submenu
        if (remaining.length > 0) {
            const showMoreSubMenu = new PopupMenu.PopupSubMenuMenuItem(`Show More... (${remaining.length})`);
            remaining.forEach(workspace => {
                const item = this._createItemContainer(workspace);
                showMoreSubMenu.menu.addMenuItem(item);
            });
            popupMenu.addMenuItem(showMoreSubMenu);
        }
    }
    _parseWorkspaceJson(workspaceStoreDir) {
        try {
            const workspaceFile = Gio.File.new_for_path(GLib.build_filenamev([workspaceStoreDir.get_path(), 'workspace.json']));
            if (!workspaceFile.query_exists(null)) {
                this._log(`No workspace.json found in ${workspaceStoreDir.get_path()}`);
                return null;
            }
            const [, contents] = workspaceFile.load_contents(null);
            const decoder = new TextDecoder();
            const json = JSON.parse(decoder.decode(contents));
            const workspaceURI = (json.folder || json.workspace);
            if (!workspaceURI) {
                this._log('No folder or workspace property found in workspace.json');
                return null;
            }
            const remote = workspaceURI.startsWith('vscode-remote://') || workspaceURI.startsWith('docker://');
            const nofail = json.nofail === true;
            // Get modification time of workspace.json to sort by recency
            let mtime = 0;
            try {
                const fileInfo = workspaceFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
                mtime = fileInfo.get_attribute_uint64('time::modified');
            } catch (e) {
                // fallback to 0 if mtime unavailable
            }
            this._log(`Parsed workspace.json in ${workspaceStoreDir.get_path()} with ${workspaceURI} (nofail: ${nofail}, remote: ${remote}, mtime: ${mtime})`);
            return { uri: workspaceURI, storeDir: workspaceStoreDir, nofail, remote, mtime };
        }
        catch (error) {
            console.error(error, 'Failed to parse workspace.json');
            return null;
        }
    }
    _maybeUpdateWorkspaceNoFail(workspace) {
        let workspaceName = GLib.path_get_basename(workspace.uri);
        if (workspaceName.endsWith('.code-workspace')) {
            workspaceName = workspaceName.replace('.code-workspace', '');
        }
        if (this._nofailList.includes(workspaceName) && !workspace.nofail) {
            this._log(`Updating workspace '${workspaceName}' to set nofail: true`);
            if (!workspace.storeDir)
                return;
            const wsJsonPath = GLib.build_filenamev([workspace.storeDir.get_path(), 'workspace.json']);
            const wsJsonFile = Gio.File.new_for_path(wsJsonPath);
            try {
                const [success, contents] = wsJsonFile.load_contents(null);
                if (!success) {
                    this._log(`Failed to load workspace.json for ${workspaceName}`);
                    return;
                }
                const decoder = new TextDecoder();
                let json = JSON.parse(decoder.decode(contents));
                json.nofail = true;
                const encoder = new TextEncoder();
                const newContents = encoder.encode(JSON.stringify(json, null, 2));
                wsJsonFile.replace_contents(newContents, null, false, Gio.FileCreateFlags.NONE, null);
                workspace.nofail = true;
                this._log(`Successfully updated workspace.json for ${workspaceName}`);
            }
            catch (error) {
                console.error(error, `Failed to update workspace.json for ${workspaceName}`);
            }
        }
    }
    _iterateWorkspaceDir(dir, callback) {
        let enumerator = null;
        try {
            enumerator = dir.enumerate_children('standard::*,unix::uid', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const workspaceStoreDir = enumerator.get_child(info);
                this._log(`Checking ${workspaceStoreDir.get_path()}`);
                const workspace = this._parseWorkspaceJson(workspaceStoreDir);
                if (!workspace)
                    continue;
                this._maybeUpdateWorkspaceNoFail(workspace);
                const pathToWorkspace = Gio.File.new_for_uri(workspace.uri);
                if (!pathToWorkspace.query_exists(null)) {
                    this._log(`Workspace not found: ${pathToWorkspace.get_path()}`);
                    if (this._cleanupOrphanedWorkspaces && !workspace.nofail) {
                        this._log(`Workspace will be removed: ${pathToWorkspace.get_path()}`);
                        this._workspaces.delete(workspace);
                        const trashRes = workspace.storeDir?.trash(null);
                        if (!trashRes) {
                            this._log(`Failed to move workspace to trash: ${workspace.uri}`);
                        }
                        else {
                            this._log(`Workspace trashed: ${workspace.uri}`);
                        }
                    }
                    else {
                        this._log(`Skipping removal for workspace: ${workspace.uri} (cleanup enabled: ${this._cleanupOrphanedWorkspaces}, nofail: ${workspace.nofail})`);
                    }
                    continue;
                }
                if ([...this._workspaces].some(ws => ws.uri === workspace.uri)) {
                    this._log(`Workspace already exists: ${workspace.uri}`);
                    continue;
                }
                this._workspaces.add(workspace);
                callback(workspace);
            }
        }
        catch (error) {
            console.error(error, 'Error iterating workspace directory');
        }
        finally {
            if (enumerator) {
                if (!enumerator.close(null)) {
                    this._log('Failed to close enumerator');
                }
            }
        }
    }
    _createRecentWorkspaceEntry(workspace) {
        let workspaceName = GLib.path_get_basename(workspace.uri);
        if (workspaceName.endsWith('.code-workspace')) {
            workspaceName = workspaceName.replace('.code-workspace', '');
        }
        return {
            name: workspaceName,
            path: workspace.uri,
            softRemove: () => {
                this._log(`Moving Workspace to Trash: ${workspaceName}`);
                this._recordUserInteraction();
                this._workspaces.delete(workspace);
                this._recentWorkspaces = new Set(Array.from(this._recentWorkspaces).filter(recentWorkspace => recentWorkspace.path !== workspace.uri));
                const trashRes = workspace.storeDir?.trash(null);
                if (!trashRes) {
                    this._log(`Failed to move ${workspaceName} to trash`);
                    return;
                }
                this._log(`Workspace Trashed: ${workspaceName}`);
                this._buildMenu();
            },
            removeWorkspaceItem: () => {
                this._log(`Removing workspace: ${workspaceName}`);
                this._recordUserInteraction();
                this._workspaces.delete(workspace);
                this._recentWorkspaces = new Set(Array.from(this._recentWorkspaces).filter(recentWorkspace => recentWorkspace.path !== workspace.uri));
                workspace.storeDir?.delete(null);
                this._buildMenu();
            },
        };
    }
    _getRecentWorkspaces() {
        try {
            const activeEditorPath = this._activeEditor?.workspacePath;
            if (!activeEditorPath)
                return;
            const dir = Gio.File.new_for_path(activeEditorPath);
            if (!dir.query_exists(null)) {
                this._log(`Workspace directory does not exist: ${activeEditorPath}`);
                return;
            }
            this._processBatchedWorkspaces(dir, 0);
        }
        catch (e) {
            console.error(e, 'Failed to load recent workspaces');
        }
    }
    _processBatchedWorkspaces(dir, startIndex, batchSize = 10) {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            try {
                this._log(`Processing workspace batch starting at index ${startIndex}`);
                let enumerator = null;
                let processedInBatch = 0;
                let hasMoreItems = false;
                try {
                    enumerator = dir.enumerate_children('standard::*,unix::uid', Gio.FileQueryInfoFlags.NONE, null);
                    let skipped = 0;
                    let info;
                    while (skipped < startIndex && (info = enumerator.next_file(null)) !== null) {
                        skipped++;
                    }
                    while (processedInBatch < batchSize && (info = enumerator.next_file(null)) !== null) {
                        const workspaceStoreDir = enumerator.get_child(info);
                        this._log(`Checking ${workspaceStoreDir.get_path()}`);
                        const workspace = this._parseWorkspaceJson(workspaceStoreDir);
                        if (workspace) {
                            this._maybeUpdateWorkspaceNoFail(workspace);
                            this._processWorkspace(workspace);
                        }
                        processedInBatch++;
                    }
                    hasMoreItems = enumerator.next_file(null) !== null;
                }
                finally {
                    if (enumerator) {
                        enumerator.close(null);
                    }
                }
                if (hasMoreItems) {
                    this._log(`Scheduling next batch starting at index ${startIndex + processedInBatch}`);
                    this._processBatchedWorkspaces(dir, startIndex + processedInBatch, batchSize);
                }
                else {
                    this._log('All workspaces processed');
                    this._finalizeWorkspaceProcessing();
                }
            }
            catch (error) {
                console.error(error, 'Error processing workspace batch');
                this._finalizeWorkspaceProcessing();
            }
            return GLib.SOURCE_REMOVE;
        });
    }
    _processWorkspace(workspace) {
        const pathToWorkspace = Gio.File.new_for_uri(workspace.uri);
        if (!pathToWorkspace.query_exists(null)) {
            this._log(`Workspace not found: ${pathToWorkspace.get_path()}`);
            if (this._cleanupOrphanedWorkspaces && !workspace.nofail) {
                this._log(`Workspace will be removed: ${pathToWorkspace.get_path()}`);
                this._workspaces.delete(workspace);
                const trashRes = workspace.storeDir?.trash(null);
                if (!trashRes) {
                    this._log(`Failed to move workspace to trash: ${workspace.uri}`);
                }
                else {
                    this._log(`Workspace trashed: ${workspace.uri}`);
                }
            }
            else {
                this._log(`Skipping removal for workspace: ${workspace.uri} (cleanup enabled: ${this._cleanupOrphanedWorkspaces}, nofail: ${workspace.nofail})`);
            }
            return;
        }
        if (this._preferCodeWorkspaceFile) {
            this._maybePreferWorkspaceFile(workspace);
        }
        if ([...this._workspaces].some(ws => ws.uri === workspace.uri)) {
            this._log(`Workspace already exists: ${workspace.uri}`);
            return;
        }
        workspace.lastAccessed = workspace.mtime || 0;
        this._workspaces.add(workspace);
    }
    _maybePreferWorkspaceFile(workspace) {
        const pathToWorkspace = Gio.File.new_for_uri(workspace.uri);
        if (pathToWorkspace.query_file_type(Gio.FileQueryInfoFlags.NONE, null) !== Gio.FileType.DIRECTORY) {
            this._log(`Not a directory: ${pathToWorkspace.get_path()}`);
            return;
        }
        try {
            const enumerator = pathToWorkspace.enumerate_children('standard::*,unix::uid', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            let workspaceFilePath = null;
            while ((info = enumerator.next_file(null)) !== null) {
                const file = enumerator.get_child(info);
                if (file.get_basename()?.endsWith('.code-workspace')) {
                    workspaceFilePath = file.get_path();
                    break;
                }
            }
            enumerator.close(null);
            this._log(`Checked for .code-workspace: ${workspaceFilePath}`);
            if (workspaceFilePath) {
                const workspaceFile = Gio.File.new_for_path(workspaceFilePath);
                if (workspaceFile.query_exists(null)) {
                    workspace.uri = `file://${workspaceFilePath}`;
                    this._log(`Updated workspace URI to use .code-workspace file: ${workspace.uri}`);
                }
            }
        }
        catch (error) {
            console.error(error, 'Error checking for workspace file');
        }
    }
    _finalizeWorkspaceProcessing() {
        try {
            this._performCacheCleanup();
            const sortedWorkspaces = Array.from(this._workspaces).sort((a, b) => {
                const aTime = a.lastAccessed || 0;
                const bTime = b.lastAccessed || 0;
                return bTime - aTime;
            });
            this._log(`[Workspace Cache]: ${sortedWorkspaces.length} workspaces`);
            const maxWorkspaces = 50;
            const limitedWorkspaces = sortedWorkspaces.slice(0, maxWorkspaces);
            this._recentWorkspaces = new Set(limitedWorkspaces.map(ws => this._createRecentWorkspaceEntry(ws)));
            this._log(`[Recent Workspaces]: ${this._recentWorkspaces.size} entries`);
            this._createMenu();
        }
        catch (error) {
            console.error(error, 'Error finalizing workspace processing');
        }
    }
    _performCacheCleanup() {
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        const maxCacheSize = 100;
        if (this._workspaces.size > maxCacheSize) {
            this._log(`Cache size (${this._workspaces.size}) exceeds maximum (${maxCacheSize}), cleaning up old entries`);
            const oldWorkspaces = Array.from(this._workspaces).filter(workspace => {
                const lastAccessed = workspace.lastAccessed || 0;
                return (now - lastAccessed) > maxAge;
            });
            if (oldWorkspaces.length > 0) {
                this._log(`Removing ${oldWorkspaces.length} workspaces from cache that haven't been accessed in 30 days`);
                oldWorkspaces.forEach(workspace => {
                    this._workspaces.delete(workspace);
                });
            }
        }
    }
    _launchVSCode(files) {
        this._log(`Launching VSCode with files: ${files.join(', ')}`);
        try {
            if (!this._activeEditor?.binary) {
                throw new Error('No active editor binary specified');
            }
            const filePaths = [];
            const dirPaths = [];
            files.forEach(file => {
                if (GLib.file_test(file, GLib.FileTest.IS_DIR)) {
                    this._log(`Found a directory: ${file}`);
                    dirPaths.push(file);
                }
                else {
                    this._log(`Found a file: ${file}`);
                    filePaths.push(file);
                }
            });
            const args = [];
            if (this._newWindow) {
                args.push('--new-window');
            }
            if (dirPaths.length > 0) {
                args.push('--folder-uri');
                args.push(...dirPaths.map(dir => `"${dir}"`));
            }
            if (filePaths.length > 0) {
                if (dirPaths.length === 0) {
                    args.push('--file-uri');
                }
                args.push(...filePaths.map(file => `"${file}"`));
            }
            if (this._customCmdArgs && this._customCmdArgs.trim() !== '') {
                args.push(this._customCmdArgs.trim());
            }
            const binaryPath = this._activeEditor.binary;
            const isCustomPath = binaryPath.includes('/');
            let command;
            if (isCustomPath) {
                command = `"${binaryPath}"`;
                this._log(`Using custom binary path: ${binaryPath}`);
            }
            else {
                command = binaryPath;
                this._log(`Using standard binary name: ${binaryPath}`);
            }
            command += ` ${args.join(' ')}`;
            this._log(`Command to execute: ${command}`);
            GLib.spawn_command_line_async(command);
        }
        catch (error) {
            console.error(error, `Failed to launch ${this._activeEditor?.name}`);
        }
    }
    _openWorkspace(workspacePath) {
        this._log(`Opening workspace: ${workspacePath}`);
        this._recordUserInteraction();
        const workspace = Array.from(this._workspaces).find(w => w.uri === workspacePath);
        if (workspace) {
            workspace.lastAccessed = Date.now();
            this._log(`Updated lastAccessed timestamp for ${workspacePath}`);
        }
        this._launchVSCode([workspacePath]);
    }
    _clearRecentWorkspaces() {
        this._log('Clearing recent workspaces');
        try {
            if (!GLib.file_test(this._activeEditor?.workspacePath, GLib.FileTest.EXISTS | GLib.FileTest.IS_DIR)) {
                throw new Error('Recent workspaces directory does not exist');
            }
            const backupPath = `${this._activeEditor?.workspacePath}.bak`;
            const backupDir = Gio.File.new_for_path(backupPath);
            const recentWorkspacesDir = Gio.File.new_for_path(this._activeEditor?.workspacePath);
            if (backupDir.query_exists(null)) {
                throw new Error('Backup directory already exists');
            }
            this._log(`Creating backup of ${this._activeEditor?.workspacePath} to ${backupPath}`);
            const res = recentWorkspacesDir.copy(backupDir, Gio.FileCopyFlags.OVERWRITE, null, null);
            if (res === null) {
                throw new Error('Failed to create backup');
            }
            this._log('Backup created successfully');
            recentWorkspacesDir.enumerate_children_async('standard::*,unix::uid', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (recentWorkspace, recentWorkspaceRes) => {
                const iter = recentWorkspacesDir.enumerate_children_finish(recentWorkspaceRes);
                try {
                    let info;
                    while ((info = iter.next_file(null)) !== null) {
                        const file = iter.get_child(info);
                        if (file.query_file_type(Gio.FileQueryInfoFlags.NONE, null) !==
                            Gio.FileType.DIRECTORY) {
                            continue;
                        }
                        this._log(`Deleting ${file.get_path()}`);
                        file.delete(null);
                    }
                    iter.close_async(GLib.PRIORITY_DEFAULT, null, (_iter, _res) => {
                        try {
                            _iter?.close_finish(_res);
                        }
                        catch (error) {
                            console.error(error, 'Failed to close iterator');
                        }
                    });
                }
                catch (error) {
                    console.error(error, 'Failed to delete recent workspaces');
                }
            });
            this._cleanup();
            this._refresh();
        }
        catch (e) {
            console.error(`Failed to clear recent workspaces: ${e}`);
        }
    }
    _quit() {
        this._log('Quitting VSCode Workspaces Extension');
        this.disable();
    }
    _startRefresh() {
        if (this._refreshTimeout) {
            GLib.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        this._currentRefreshInterval = this._minRefreshInterval;
        this._refresh(true);
        this._setupAdaptiveRefresh();
    }
    _setupAdaptiveRefresh() {
        if (this._refreshTimeout) {
            GLib.source_remove(this._refreshTimeout);
            this._refreshTimeout = null;
        }
        const refreshFunc = () => {
            this._updateRefreshInterval();
            this._refresh(false);
            if (this._refreshTimeout) {
                GLib.source_remove(this._refreshTimeout);
                this._refreshTimeout = null;
            }
            this._refreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._currentRefreshInterval, refreshFunc);
            return GLib.SOURCE_REMOVE;
        };
        this._refreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._currentRefreshInterval, refreshFunc);
    }
    _updateRefreshInterval() {
        const now = Date.now();
        const userActiveThreshold = 5 * 60 * 1000;
        if (this._lastUserInteraction > 0 && (now - this._lastUserInteraction < userActiveThreshold)) {
            this._currentRefreshInterval = this._minRefreshInterval;
            this._log(`User recently active, using minimum refresh interval: ${this._currentRefreshInterval}s`);
        }
        else {
            this._currentRefreshInterval = Math.min(Math.round(this._currentRefreshInterval * 1.5), this._maxRefreshInterval);
            this._log(`User inactive, increased refresh interval to: ${this._currentRefreshInterval}s`);
        }
    }
    _recordUserInteraction() {
        this._lastUserInteraction = Date.now();
        if (this._currentRefreshInterval > this._minRefreshInterval) {
            this._log('User interaction detected, resetting to minimum refresh interval');
            this._currentRefreshInterval = this._minRefreshInterval;
            if (this._refreshTimeout) {
                GLib.source_remove(this._refreshTimeout);
                this._refreshTimeout = null;
                this._setupAdaptiveRefresh();
            }
        }
    }
    _refresh(forceFullRefresh = false) {
        this._log(`Refreshing workspaces (full refresh: ${forceFullRefresh})`);
        this._persistSettings();
        if (forceFullRefresh) {
            this._initializeWorkspaces();
        }
        else {
            this._lightweightRefresh();
        }
        // Note: _createMenu() is NOT called here because both
        // _initializeWorkspaces() and _lightweightRefresh() -> _getRecentWorkspaces()
        // -> _finalizeWorkspaceProcessing() already call _createMenu().
    }
    _lightweightRefresh() {
        if (!this._activeEditor) {
            this._log('No active editor found for lightweight refresh');
            return;
        }
        this._log(`Performing lightweight refresh for ${this._activeEditor.name}`);
        this._getRecentWorkspaces();
    }
    _log(message) {
        if (!this._debug) {
            return;
        }
        console.log(gettext(`[${this.metadata.name}]: ${message}`));
    }
    _toggleFavorite(workspace) {
        this._recordUserInteraction();
        if (this._favorites.has(workspace.path)) {
            this._favorites.delete(workspace.path);
            this._log(`Removed favorite: ${workspace.path}`);
        }
        else {
            this._favorites.add(workspace.path);
            this._log(`Added favorite: ${workspace.path}`);
        }
        this._persistSettings();
        this._buildMenu();
    }
    _openExtensionPreferences() {
        this._log('Opening extension preferences');
        try {
            this._recordUserInteraction();
            this.openPreferences();
        }
        catch (error) {
            console.error(error, 'Failed to open extension preferences');
        }
    }
}
