#!/bin/bash
# update-dock-actions.sh
# Dynamically updates the VS Code .desktop file with recent workspace actions
# so they appear in the right-click menu on Zorin Dash / Dash-to-Dock.
#
# Usage: ./update-dock-actions.sh [--max N] [--editor code|cursor|codium|auto]
# Defaults: max=10, editor=auto (picks whichever has the most recent activity)

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_ITEMS=10
EDITOR_CHOICE="auto"
CONFIG_DIR="$HOME/.config"
DESKTOP_TARGET="$HOME/.local/share/applications/code.desktop"
SYSTEM_DESKTOP="/usr/share/applications/code.desktop"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --max)    MAX_ITEMS="$2"; shift 2 ;;
        --editor) EDITOR_CHOICE="$2"; shift 2 ;;
        *)        echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Editor Definitions ────────────────────────────────────────────────────────
# Each entry: name|binary|workspaceStoragePath
declare -a EDITORS=(
    "vscode|code|$CONFIG_DIR/Code/User/workspaceStorage"
    "cursor|cursor|$CONFIG_DIR/Cursor/User/workspaceStorage"
    "antigravity|antigravity|$CONFIG_DIR/Antigravity/User/workspaceStorage"
    "codium|codium|$CONFIG_DIR/VSCodium/User/workspaceStorage"
    "code-insiders|code-insiders|$CONFIG_DIR/Code - Insiders/User/workspaceStorage"
)

# ── Resolve Editor ────────────────────────────────────────────────────────────
EDITOR_BINARY=""
WORKSPACE_DIR=""

resolve_editor() {
    local choice="$1"

    if [[ "$choice" == "auto" ]]; then
        # Pick the editor whose workspaceStorage has the most recently modified file
        local best_mtime=0
        for entry in "${EDITORS[@]}"; do
            IFS='|' read -r name binary wspath <<< "$entry"
            if [[ -d "$wspath" ]]; then
                # Find the most recently modified workspace.json
                local latest
                latest=$(find "$wspath" -name "workspace.json" -printf '%T@\n' 2>/dev/null | sort -rn | head -1)
                if [[ -n "$latest" ]]; then
                    local mtime_int=${latest%%.*}
                    if (( mtime_int > best_mtime )); then
                        best_mtime=$mtime_int
                        EDITOR_BINARY="$binary"
                        WORKSPACE_DIR="$wspath"
                    fi
                fi
            fi
        done
    else
        for entry in "${EDITORS[@]}"; do
            IFS='|' read -r name binary wspath <<< "$entry"
            if [[ "$binary" == "$choice" || "$name" == "$choice" ]]; then
                EDITOR_BINARY="$binary"
                WORKSPACE_DIR="$wspath"
                break
            fi
        done
    fi

    if [[ -z "$EDITOR_BINARY" || -z "$WORKSPACE_DIR" || ! -d "$WORKSPACE_DIR" ]]; then
        echo "Error: Could not find editor workspace storage." >&2
        echo "  Editor choice: $choice" >&2
        echo "  Resolved binary: ${EDITOR_BINARY:-none}" >&2
        echo "  Workspace dir: ${WORKSPACE_DIR:-none}" >&2
        exit 1
    fi
}

resolve_editor "$EDITOR_CHOICE"

# ── Collect Recent Workspaces ─────────────────────────────────────────────────
# Output: mtime|folder_uri for each workspace, sorted newest first
collect_workspaces() {
    local ws_dir="$1"

    for ws_hash_dir in "$ws_dir"/*/; do
        local ws_json="$ws_hash_dir/workspace.json"
        [[ -f "$ws_json" ]] || continue

        # Extract folder or workspace URI (handles both keys)
        local uri
        uri=$(python3 -c "
import json, sys
try:
    d = json.load(open('$ws_json'))
    print(d.get('folder', d.get('workspace', '')))
except:
    pass
" 2>/dev/null)

        [[ -z "$uri" ]] && continue
        # Skip remote workspaces (vscode-remote://, docker://)
        [[ "$uri" == vscode-remote://* || "$uri" == docker://* ]] && continue

        # Get modification time of workspace.json (epoch seconds)
        local mtime
        mtime=$(stat -c '%Y' "$ws_json" 2>/dev/null || echo 0)

        # Decode the file:// URI to a local path and check it exists
        local decoded_path
        decoded_path=$(python3 -c "
import urllib.parse, sys
uri = '$uri'
if uri.startswith('file://'):
    print(urllib.parse.unquote(uri[7:]))
else:
    print(uri)
" 2>/dev/null)

        # Only include workspaces whose directories/files still exist
        if [[ -n "$decoded_path" && -e "$decoded_path" ]]; then
            echo "${mtime}|${uri}|${decoded_path}"
        fi
    done
}

# Collect, sort by mtime descending, deduplicate by URI, take top N
WORKSPACES=$(collect_workspaces "$WORKSPACE_DIR" | sort -t'|' -k1 -rn | awk -F'|' '!seen[$2]++' | head -n "$MAX_ITEMS")

if [[ -z "$WORKSPACES" ]]; then
    echo "No recent workspaces found. Desktop file not updated."
    exit 0
fi

# ── Build .desktop File ──────────────────────────────────────────────────────

# Start with the base desktop entry from the system file
if [[ -f "$SYSTEM_DESKTOP" ]]; then
    BASE_DESKTOP=$(cat "$SYSTEM_DESKTOP")
else
    echo "Error: System desktop file not found at $SYSTEM_DESKTOP" >&2
    exit 1
fi

# Extract just the [Desktop Entry] section (before any [Desktop Action ...])
HEADER=$(echo "$BASE_DESKTOP" | awk '/^\[Desktop Action/{exit} {print}')

# Build action IDs and action sections
ACTION_IDS=()
ACTION_SECTIONS=""
INDEX=0

while IFS='|' read -r mtime uri decoded_path; do
    # Get a display name (basename of the path)
    local_name=$(basename "$decoded_path")

    # Strip .code-workspace extension for display
    local_name="${local_name%.code-workspace}"

    # Make a clean action ID (alphanumeric + hyphens only)
    action_id="workspace-${INDEX}"
    ACTION_IDS+=("$action_id")

    # Build the action section
    ACTION_SECTIONS+="
[Desktop Action ${action_id}]
Name=${local_name}
Exec=${EDITOR_BINARY} \"${decoded_path}\"
Icon=vscode
"
    INDEX=$((INDEX + 1))
done <<< "$WORKSPACES"

# Build the Actions= line by joining all action IDs with ;
# Start with the original action (new-empty-window) then add workspace actions
ALL_ACTIONS="new-empty-window"
for aid in "${ACTION_IDS[@]}"; do
    ALL_ACTIONS="${ALL_ACTIONS};${aid}"
done

# Replace or add the Actions= line in the header
if echo "$HEADER" | grep -q '^Actions='; then
    HEADER=$(echo "$HEADER" | sed "s/^Actions=.*/Actions=${ALL_ACTIONS};/")
else
    HEADER+=$'\n'"Actions=${ALL_ACTIONS};"
fi

# Assemble the final desktop file
FINAL_CONTENT="${HEADER}

[Desktop Action new-empty-window]
Name=New Empty Window
Exec=${EDITOR_BINARY} --new-window %F
Icon=vscode
${ACTION_SECTIONS}"

# ── Write Output ──────────────────────────────────────────────────────────────
mkdir -p "$(dirname "$DESKTOP_TARGET")"
echo "$FINAL_CONTENT" > "$DESKTOP_TARGET"

echo "✓ Updated $DESKTOP_TARGET with ${#ACTION_IDS[@]} recent workspaces (editor: $EDITOR_BINARY)"
echo "  Workspaces:"
while IFS='|' read -r mtime uri decoded_path; do
    echo "    • $(basename "$decoded_path")"
done <<< "$WORKSPACES"
