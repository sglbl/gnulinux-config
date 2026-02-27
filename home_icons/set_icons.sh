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
            gio set "$folder_path" metadata::custom-icon "file://$icon_file"
            echo "Set icon for $folder -> $icon_name.$ext"
            break
        fi
    done
done

echo "Done! You may need to restart nautilus to see changes: nautilus -q"
