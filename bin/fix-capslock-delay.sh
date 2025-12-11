#!/usr/bin/env bash
set -e

TARGET="/usr/share/X11/xkb/symbols/capslock"
BACKUP="/usr/share/X11/xkb/symbols/capslock.bak_$(date +%s)"

echo "Backing up original capslock file to $BACKUP"
sudo cp "$TARGET" "$BACKUP"

echo "Temporarily making capslock file writable"
sudo chmod 777 "$TARGET"

echo "Patching capslock behavior"
sudo awk '
BEGIN { found=0 }
/^hidden partial modifier_keys/ && $0 ~ /ctrl_modifier/ { found=1 }
found && /actions/ {
    # Skip until closing brace
    while (getline && $0 !~ /};/) {}
    print "// This changes the <CAPS> key to become a Control modifier,"
    print "// but it will still produce the Caps_Lock keysym."
    print "hidden partial modifier_keys"
    print "xkb_symbols \"ctrl_modifier\" {"
    print "          key <CAPS> {"
    print "              type=\"ALPHABETIC\","
    print "              repeat=No,"
    print "              symbols[Group1]= [ Caps_Lock, Caps_Lock ],"
    print "              actions[Group1]= [ LockMods(modifiers=Lock),"
    print "                                 LockMods(modifiers=Shift+Lock,affect=unlock) ]"
    print "          };"
    print "};"
    found=2
    next
}
found==1 { next }
{ print }
' "$BACKUP" | sudo tee "$TARGET" >/dev/null

echo "Restoring original permissions"
sudo chmod 644 "$TARGET"

#!/usr/bin/env bash
set -e

TARGET="/usr/share/X11/xkb/symbols/capslock"
BACKUP="/usr/share/X11/xkb/symbols/capslock.bak_$(date +%s)"

echo "Backing up original capslock file to $BACKUP"
sudo cp "$TARGET" "$BACKUP"

echo "Temporarily making capslock file writable"
sudo chmod 777 "$TARGET"

echo "Patching capslock behavior"
sudo awk '
BEGIN { found=0 }
/^hidden partial modifier_keys/ && $0 ~ /ctrl_modifier/ { found=1 }
found && /actions/ {
    # Skip until closing brace
    while (getline && $0 !~ /};/) {}
    print "// This changes the <CAPS> key to become a Control modifier,"
    print "// but it will still produce the Caps_Lock keysym."
    print "hidden partial modifier_keys"
    print "xkb_symbols \"ctrl_modifier\" {"
    print "          key <CAPS> {"
    print "              type=\"ALPHABETIC\","
    print "              repeat=No,"
    print "              symbols[Group1]= [ Caps_Lock, Caps_Lock ],"
    print "              actions[Group1]= [ LockMods(modifiers=Lock),"
    print "                                 LockMods(modifiers=Shift+Lock,affect=unlock) ]"
    print "          };"
    print "};"
    found=2
    next
}
found==1 { next }
{ print }
' "$BACKUP" | sudo tee "$TARGET" >/dev/null

echo "Restoring original permissions"
sudo chmod 644 "$TARGET"

echo "Configuring GNOME Caps Lock behavior"

CURRENT=$(gsettings get org.gnome.desktop.input-sources xkb-options)

# Fix strange empty value "@/as []"
if [ "$CURRENT" = "@as []" ]; then
    CURRENT="[]"
fi

echo "Current XKB options: $CURRENT"

# If already present, skip
if echo "$CURRENT" | grep -q "caps:ctrl_modifier"; then
    echo "caps:ctrl_modifier already present"
else
    # Determine how to append
    if [ "$CURRENT" = "[]" ]; then
        NEW="['caps:ctrl_modifier']"
    else
        # Append before the closing bracket
        NEW=$(echo "$CURRENT" | sed "s/]$/, 'caps:ctrl_modifier']/")
    fi

    echo "Applying new options: $NEW"
    gsettings set org.gnome.desktop.input-sources xkb-options "$NEW"
fi


echo "Done. Reboot required."
