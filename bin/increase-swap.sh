#!/bin/bash

# Script to increase swap size to 16 GB
# This script requires root privileges

set -e  # Exit on any error

SWAP_SIZE_GB=16
SWAP_SIZE_MB=$((SWAP_SIZE_GB * 1024))
SWAPFILE="/swapfile"

echo "=== Swap Size Increase Script ==="
echo "Target swap size: ${SWAP_SIZE_GB} GB"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script requires root privileges. Please run with sudo."
    exit 1
fi

# Show current swap info
echo "Current swap status:"
grep Swap /proc/meminfo
echo ""

# Confirmation prompt
read -p "This will turn off swap temporarily and create a ${SWAP_SIZE_GB}GB swapfile. Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Step 1/5: Turning swap off (this may take several minutes)..."
swapoff -a

echo "Step 2/5: Creating empty swapfile (${SWAP_SIZE_GB} GB)..."
dd if=/dev/zero of=${SWAPFILE} bs=1M count=${SWAP_SIZE_MB} status=progress

echo "Step 3/5: Setting correct permissions..."
chmod 0600 ${SWAPFILE}

echo "Step 4/5: Setting up Linux swap area..."
mkswap ${SWAPFILE}

echo "Step 5/5: Turning swap on..."
swapon ${SWAPFILE}

echo ""
echo "Step 6/6: Making swap permanent in /etc/fstab..."
FSTAB_ENTRY="/swapfile none swap sw 0 0"
if grep -q "/swapfile" /etc/fstab; then
    echo "Swapfile entry already exists in /etc/fstab, skipping."
else
    echo "${FSTAB_ENTRY}" >> /etc/fstab
    echo "Added swapfile entry to /etc/fstab."
fi

echo ""
echo "=== Swap increase complete! ==="
echo ""
echo "New swap status:"
grep Swap /proc/meminfo
echo ""
echo "Swap is now permanent and will persist across reboots."
