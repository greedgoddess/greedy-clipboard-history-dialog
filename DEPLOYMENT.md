# Greedy Clipboard History Dialog

## Deployment Guide

This guide explains how to install the extension on another Fedora machine using the private GitHub repository.

### Requirements

- Fedora Linux
- GNOME Shell
- GitHub access to the private repository
- SSH authentication configured for GitHub

### 1. Install dependencies

    sudo dnf install git glib2

### 2. Configure GitHub SSH access

If the machine does not already have an SSH key, create one:

    ssh-keygen -t ed25519 -C "greedy-clipboard-history"

Accept the default file location.

Display the public key:

    cat ~/.ssh/id_ed25519.pub

Add the public key to GitHub:

https://github.com/settings/ssh/new

Test authentication:

    ssh -T git@github.com

If SSH is already configured for GitHub, skip this step.

### 3. Clone the repository

    mkdir -p ~/Projects
    cd ~/Projects
    git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
    cd greedy-clipboard-history-dialog

### 4. Install the extension

    chmod +x ./*.sh
    ./install.sh

The installer handles compiling the GSettings schema, installing the extension files, and enabling the GNOME extension.

### 5. Verify installation

On Fedora Wayland, log out and back in if GNOME Shell does not immediately load the extension.

Then run:

    gnome-extensions info clipboard-history@manouchehr

Expected state: ACTIVE

### 6. Update the extension

After changes are committed and pushed from the development machine, update the second machine with:

    cd ~/Projects/greedy-clipboard-history-dialog
    ./update.sh

### 7. Important compatibility note

The extension UUID intentionally remains:

    clipboard-history@manouchehr

Do not change it. Keeping the original UUID preserves compatibility with existing GNOME extension settings and clipboard history cache.

### Repository

https://github.com/greedgoddess/greedy-clipboard-history-dialog
