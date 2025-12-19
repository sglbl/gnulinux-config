# GNU/Linux Personal Config Scripts

<img src="dot_local_share_applications/icons/gnulinux.png" width="200">

Personal configuration files and utility scripts for a [GNU/Linux](https://sglbl.notion.site/linux) setup. (Recommended: [Zorin OS](https://zorin.com/os/))

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

## 📝 License

Personal scripts — use at your own discretion.
