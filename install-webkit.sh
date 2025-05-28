#!/bin/bash

# Script to install libwebkit2gtk-4.0-dev on Ubuntu 24.04
# This temporarily adds Ubuntu 22.04 (Jammy) repository to install the required package

set -e

echo "Installing libwebkit2gtk-4.0-dev for Tauri on Ubuntu 24.04..."

# Create a temporary sources file
TEMP_SOURCES="/etc/apt/sources.list.d/jammy-webkit-temp.list"

# Function to cleanup
cleanup() {
    echo "Cleaning up temporary repository..."
    sudo rm -f "$TEMP_SOURCES"
    sudo apt update
    echo "Cleanup complete."
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Add Ubuntu 22.04 repository temporarily
echo "Adding temporary Ubuntu 22.04 repository..."
echo "deb http://archive.ubuntu.com/ubuntu jammy main universe" | sudo tee "$TEMP_SOURCES"

# Update package lists
echo "Updating package lists..."
sudo apt update

# Install the required package
echo "Installing libwebkit2gtk-4.0-dev..."
sudo apt install -y libwebkit2gtk-4.0-dev

echo "Installation complete!"
echo "The temporary repository will be removed automatically." 