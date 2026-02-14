import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _, } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
export default class VSCodeWorkspacesPreferences extends ExtensionPreferences {
    _saveSettings = () => { };
    fillPreferencesWindow(window) {
        const _settings = this.getSettings();
        const settingsChanged = new Set();
        const currentEditorLocation = _settings.get_string('editor-location') || 'auto';
        if (_settings.get_boolean('debug')) {
            console.log('VSCode Workspaces: Initial settings values:');
            console.log(`- editor-location: ${currentEditorLocation}`);
            console.log(`- new-window: ${_settings.get_boolean('new-window')}`);
            console.log(`- custom-cmd-args: ${_settings.get_string('custom-cmd-args')}`);
            console.log(`- custom-icon: ${_settings.get_string('custom-icon')}`);
        }
        const page = new Adw.PreferencesPage({
            title: _('General'),
            iconName: 'dialog-information-symbolic',
        });
        const newWindowGroup = new Adw.PreferencesGroup({
            title: _('New Window'),
            description: _('Configure whether to open editor in a new window'),
        });
        page.add(newWindowGroup);
        const newWindowSwitch = new Adw.SwitchRow({
            title: _('Open in New Window'),
            subtitle: _('Whether to open editor in a new window'),
        });
        newWindowGroup.add(newWindowSwitch);
        const editorGroup = new Adw.PreferencesGroup({
            title: _('Editor Settings'),
            description: _('Configure various settings for interacting with editor'),
        });
        const editorLocationEntry = new Gtk.Entry({
            placeholder_text: currentEditorLocation,
            text: currentEditorLocation,
        });
        const editorLocationHintRow = new Adw.ActionRow({
            title: _('Editor Location'),
            subtitle: _('Use "auto", a binary name (e.g., "code", "cursor"), or a full path'),
            activatable: false,
        });
        const editorLocation = new Adw.EntryRow({
            showApplyButton: true,
            inputPurpose: Gtk.InputPurpose.FREE_FORM,
            inputHints: Gtk.InputHints.WORD_COMPLETION,
            child: editorLocationEntry
        });
        const debug = new Adw.SwitchRow({
            title: _('Debug'),
            subtitle: _('Whether to enable debug logging'),
        });
        const preferWorkspaceFile = new Adw.SwitchRow({
            title: _('Prefer Workspace File'),
            subtitle: _('Whether to prefer the workspace file over the workspace directory if a workspace file is present'),
        });
        const customCmdArgs = new Adw.EntryRow({
            title: _('Custom CMD Args'),
            showApplyButton: true,
            inputPurpose: Gtk.InputPurpose.FREE_FORM,
            inputHints: Gtk.InputHints.NONE,
            child: new Gtk.Entry({
                placeholder_text: _('Custom command line arguments for launching the editor'),
            })
        });
        editorGroup.add(editorLocationHintRow);
        editorGroup.add(editorLocation);
        editorGroup.add(preferWorkspaceFile);
        editorGroup.add(debug);
        editorGroup.add(customCmdArgs);
        page.add(editorGroup);
        const refreshIntervalGroup = new Adw.PreferencesGroup({
            title: _('Refresh Interval'),
            description: _('Configure the refresh interval for the extension'),
        });
        page.add(refreshIntervalGroup);
        const refreshGroupEntry = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 3600,
                step_increment: 1,
            }),
        });
        refreshIntervalGroup.add(refreshGroupEntry);
        const iconGroup = new Adw.PreferencesGroup({
            title: _('Custom Icon'),
            description: _('Configure a custom icon for the extension'),
        });
        page.add(iconGroup);
        const customIconEntry = new Adw.EntryRow({
            title: _('Custom Icon Path'),
            showApplyButton: true,
            inputPurpose: Gtk.InputPurpose.FREE_FORM,
            inputHints: Gtk.InputHints.WORD_COMPLETION,
            child: new Gtk.Entry({
                placeholder_text: _('Enter a theme icon name or path to an icon file'),
            })
        });
        iconGroup.add(customIconEntry);
        const iconInfoRow = new Adw.ActionRow({
            title: _('Icon Info'),
            subtitle: _('You can specify either a theme icon name (e.g., "code-symbolic") or a full path to an image file'),
            activatable: false,
        });
        iconGroup.add(iconInfoRow);
        const cleanupGroup = new Adw.PreferencesGroup({
            title: _('Cleanup Settings'),
            description: _('Advanced settings for workspace cleanup'),
        });
        const cleanupSwitch = new Adw.SwitchRow({
            title: _('Cleanup Orphaned Workspaces'),
            subtitle: _('Enable automatic cleanup of orphaned workspace directories'),
        });
        cleanupGroup.add(cleanupSwitch);
        const nofailEntry = new Adw.EntryRow({
            title: _('No-fail Workspaces'),
            showApplyButton: true,
            inputPurpose: Gtk.InputPurpose.FREE_FORM,
            inputHints: Gtk.InputHints.WORD_COMPLETION,
            child: new Gtk.Entry({
                placeholder_text: _('Comma separated list of workspace directories to ignore for cleanup'),
            })
        });
        cleanupGroup.add(nofailEntry);
        page.add(cleanupGroup);
        editorLocationEntry.connect('changed', () => {
            settingsChanged.add('editor-location');
        });
        const setupChangeTracking = (widget, settingKey) => {
            if (widget instanceof Gtk.Entry) {
                widget.connect('changed', () => {
                    settingsChanged.add(settingKey);
                });
            }
            else if (widget instanceof Gtk.Switch) {
                widget.connect('notify::active', () => {
                    settingsChanged.add(settingKey);
                });
            }
            else if (widget instanceof Gtk.SpinButton) {
                widget.connect('value-changed', () => {
                    settingsChanged.add(settingKey);
                });
            }
        };
        setupChangeTracking(editorLocationEntry, 'editor-location');
        setupChangeTracking(refreshGroupEntry, 'refresh-interval');
        setupChangeTracking(newWindowSwitch, 'new-window');
        setupChangeTracking(debug, 'debug');
        setupChangeTracking(preferWorkspaceFile, 'prefer-workspace-file');
        setupChangeTracking(cleanupSwitch, 'cleanup-orphaned-workspaces');
        const customCmdArgsEntry = customCmdArgs.child;
        const customIconEntryWidget = customIconEntry.child;
        const nofailEntryWidget = nofailEntry.child;
        setupChangeTracking(customCmdArgsEntry, 'custom-cmd-args');
        setupChangeTracking(customIconEntryWidget, 'custom-icon');
        setupChangeTracking(nofailEntryWidget, 'nofail-workspaces');
        _settings.bind('new-window', newWindowSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('editor-location', editorLocationEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('debug', debug, 'active', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('prefer-workspace-file', preferWorkspaceFile, 'active', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('refresh-interval', refreshGroupEntry, 'value', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('custom-cmd-args', customCmdArgsEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
        _settings.bind('cleanup-orphaned-workspaces', cleanupSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        const nofailArray = _settings.get_strv('nofail-workspaces') || [];
        const nofailString = nofailArray.join(', ');
        nofailEntryWidget.set_text(nofailString);
        nofailEntryWidget.connect('changed', () => {
            settingsChanged.add('nofail-workspaces');
        });
        this._saveSettings = (settings, changedSettings) => {
            if (changedSettings && changedSettings.size > 0 && settings.get_boolean('debug')) {
                console.log(`VSCode Workspaces: Saving changed settings: ${[...changedSettings].join(', ')}`);
            }
            settings.apply();
            if (changedSettings?.has('nofail-workspaces') || true) {
                const text = nofailEntryWidget.get_text() || '';
                const values = text.split(',')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);
                settings.set_strv('nofail-workspaces', values);
                if (settings.get_boolean('debug')) {
                    console.log(`VSCode Workspaces: Saved nofail-workspaces as array: [${values.join(', ')}]`);
                }
            }
            Gio.Settings.sync();
            if (settings.get_boolean('debug')) {
                console.log('VSCode Workspaces: Settings saved');
            }
        };
        _settings.bind('custom-icon', customIconEntryWidget, 'text', Gio.SettingsBindFlags.DEFAULT);
        window.add(page);
        window.connect('close-request', () => {
            this._saveSettings(_settings, settingsChanged);
        });
    }
}
