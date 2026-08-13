# Intro / Overview

Small collection of helper scripts for my day to day tasks.

## Usage and List of Scripts 

- `linux/gitpush (updated)/gitpush.sh` — Feature-rich helper for Linux: commit, amend, reuse last message, optional pull before push, and controlled force pushes (`--force-with-lease`).
- `windows/gitpush/gitpush.sh` — Minimal script for committing and pushing from the current repository on Windows; requires a commit message and branch.
- `linux/mouse/mouse.sh` — Utility to unload and reload the `i2c_hid_acpi` kernel module (touchpad/mouse reset).
- `office/script.js` — Used to bulk select check boxes in platforms like zoho marketing; operaitons ka kaam easily krne ke liye.
- `NotesVault` — Simple Note taking app. Minimal, Browser based, works fine.

Usage examples (Linux `gitpush`):

```
gitpush "Fix typo"                 # commit and push to current branch
gitpush "Feature X" master        # commit and push to master
gitpush ""                        # reuse last commit message (amend + push)
gitpush "Hotfix" -f               # force push (use carefully)
```

Windows example:

```
./windows/gitpush/gitpush.sh "Add README" main
```

## Installation

Platform-specific installation instructions are included inside each script's folder. See the folders for details and simple install commands (e.g., making scripts executable or symlinking the Linux script into `/usr/local/bin`).

## License

No license — free to use for anyone.
