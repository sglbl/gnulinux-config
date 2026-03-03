#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOME_DIR="$HOME"

for folder_path in "$HOME_DIR"/*; do
    [ -d "$folder_path" ] || continue
    
    folder="${folder_path##*/}"
    icon_name="${folder,,}"
    
    for ext in svg png; do
        icon_file="$SCRIPT_DIR/$icon_name.$ext"
        if [ -f "$icon_file" ]; then
            # gio set "$folder_path" metadata::custom-icon "file://$SCRIPT_DIR/$icon_name.$ext"
            gio set "$folder_path" metadata::custom-icon "file:///usr/share/icons/ZorinBlue-Dark/512x512/mimetypes/inode-directory.png"

            # Add icon support for Dolphin (using KDE-native config writer)
            kwriteconfig5 --file "$folder_path/.directory" --group "Desktop Entry" --key "Icon" "$icon_file"
            kwriteconfig5 --file "$folder_path/.directory" --group "Desktop Entry" --key "Type" "Directory"
            
            echo "Set icon for $folder -> $icon_name.$ext"
            break
        fi
    done
done

echo "Done! You may need to restart nautilus or dolphin to see changes: nautilus -q ; killall dolphin"
