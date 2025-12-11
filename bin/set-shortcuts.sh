#!/usr/bin/env bash

# --- Define your shortcuts ---
shortcuts=(
  "custom0|Copyq Clipboard|copyq menu|<Super>v"
  "custom1|Recent Folders Rofi GUI|recent|<Ctrl><Alt>e"
  'custom2|Recent Folders Fzf Terminal|gnome-terminal -- bash -c "recent2; exec bash"|<Ctrl><Alt>e'
  "custom3|Screenshot with Flameshot|flameshot gui|<Ctrl><Shift>comma"
  "custom4|Emoji|flatpak run --command=smile it.mijorus.smile|<Super>period"
)

paths=()

# --- Apply shortcuts ---
for entry in "${shortcuts[@]}"; do
  IFS="|" read -r cname name cmd binding <<< "$entry"
  path="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/${cname}/"
  paths+=("'$path'")

  gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path" name "$name"
  gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path" command "$cmd"
  gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path" binding "$binding"
done

# --- Join paths with commas ---
joined=$(IFS=, ; echo "[${paths[*]}]")

# --- Apply the array to GNOME ---
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "$joined"

echo "Shortcuts applied correctly."
