# GNU/Linux Personal Config Scripts

<img src="dot_local_share_applications/icons/gnulinux.png" width="200">

Personal configuration files and utility scripts for a [GNU/Linux setup](https://sglbl.notion.site/linux). (Recommended: [Zorin OS](https://zorin.com/os/))

---

## 📁 Repository Structure

| Path | Destination | Description |
|------|-------------|-------------|
| `bin/` | `~/bin/` | Custom utility scripts |
| `.bashrc` | `~/.bashrc` | Bash configuration and path settings |
| `.bash_aliases` | `~/.bash_aliases` | Aliases and shortcuts |
| `.XCompose` | `~/.XCompose` | Custom compose key sequences |
| `dot_local_share_applications/` | `~/.local/share/applications/` | Desktop entries & icons |
| `app_config/` | Application settings | Application-specific configs |
| `home_icons/` | `~/home_icons/` | Custom icons for home directory folders |

---

## 🛠️ Scripts (`bin/`)

> **Note:** Since `~/bin` is added to `PATH` via `.bashrc`, all scripts can also be run directly from the terminal (e.g., `swap`, `recent`).

| Script | Description |
|--------|-------------|
| `set-shortcuts.sh` | Configure GNOME custom keyboard shortcuts |
| `recent` | GUI folder picker using rofi for recently accessed directories |
| `recent-fzf` | Terminal-based recent folder picker using fzf (fuzzy finder) |
| `swap` | Display top 20 processes by swap usage |
| `swap2` | Swap monitoring script including docker and other virtualized containers |
| `btautoconnect.sh` | Auto-connect Bluetooth devices on startup |
| `fix-capslock-delay.sh` | Fix capslock key delay issues that comes with Linux |
| `startup-signal` | Signal messenger startup script (minimized to tray) |
| `startup-thunderbird` | Thunderbird startup script (minimized to tray) |
| `OneDrive` | OneDrive sync helper (on the background) |
| `increase-swap.sh` | Increase swap size to 16 GB and make it permanent |

---

## 🖥️ Desktop Entries (`~/.local/share/applications/`)

Custom `.desktop` files to register applications and file handlers in the GNOME/Linux desktop environment.

| Entry | Purpose |
|-------|---------|
| `WebApp-Notion2225.desktop` | Launches Notion as a standalone Chrome web app (no browser tabs/navbar) |
| `execute_script.desktop` | Executes shell scripts by double-clicking |
| `url_opener.desktop` | Opens Windows `.url` shortcut files in the default browser |

---

## 🧩 GNOME Extensions (`extensions/`)

My personal collection of GNOME Shell extensions.

| Extension | Description |
|-----------|-------------|
| **App menu is back** | The good old original app menu. Uses native GNOME Shell button. |
| **GNOME Fuzzy App Search** | Fuzzy application search results for Gnome Search. |
| **Grand Theft Focus** | No more 'Window is ready' notification; brings window into focus immediately. |
| **Multi Monitors Add-On** | Add multiple monitors overview and panel support. |
| **Net speed Simplified** | Customizable net speed indicator. |
| **Notification Banner Reloaded** | Configure notification banner position and animation. |
| **Tweaks & Extensions in System Menu** | Access Tweaks and Extensions directly from the System Menu. |
| **VSCode Workspaces** | VS Code workspace management tool-set for GNOME. |

---

## 🏠 Home Folder Icons (`home_icons/`)

Custom icons for home directory places, applied via `gio` metadata.

### Usage

Place icon files (`.svg` or `.png`) in the `home_icons/` directory if it's not placed yet, named after the target folder in lowercase (e.g., `appimages.svg` for `~/AppImages`). Then run:

```bash
cd home_icons/
bash set_icons.sh
```

The script iterates over all folders in `$HOME` and assigns a matching icon if one exists. After running, restart Nautilus to see the changes:

---

Note: Since some of the files in the config might contain absolute paths that refer to username 'sglbl', you can replace all matches with your username after cloning/forking the repository.

## 📝 License

Personal scripts — use at your own discretion.
