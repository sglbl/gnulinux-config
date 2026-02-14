import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { VSCodeWorkspacesCore } from './core.js';
export default class VSCodeWorkspacesExtension extends Extension {
    metadata;
    core = null;
    constructor(metadata) {
        super(metadata);
        this.metadata = metadata;
    }
    enable() {
        super.enable();
        let gsettings = this.getSettings();
        this.core = new VSCodeWorkspacesCore(this.metadata, this.openPreferences, gsettings);
        this.core.enable();
    }
    disable() {
        super.disable();
        if (!this.core)
            return;
        this.core.disable();
        this.core = null;
    }
}
