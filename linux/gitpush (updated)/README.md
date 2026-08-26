
# Git Auto-Push Script – Installation Guide

A customized Bash script for Linux, tested on Ubuntu 24.04, that automates `git add`, `commit`, and `push` with one command.

The script automatically uses `master` if a `master` branch exists. It also includes an option to push to `main` when the repository uses `main` instead of `master`.

---

## 📋 Prerequisites

- Git installed and configured on your system
- A terminal with bash
- Write permissions to the directory where you save the script (e.g., `~/` or `/usr/local/bin/`)

---

## 🚀 Installation

### 1. Create the script file

Open a terminal and run:

```bash
nano ~/gitpush
```

### 2. Copy the script

- Open the `gitpush.sh` file.
- Copy its contents into the nano editor.

### 3. Save and exit nano

- Press `Ctrl + X` to exit.
- Press `Y` to confirm saving.
- Press `Enter` to keep the same filename (`~/gitpush`).

### 4. Make the script executable

```bash
chmod +x ~/gitpush
```

### 5. Add the script to your PATH (optional but recommended)

**Option A:** Move to a system directory (requires `sudo`):

```bash
sudo mv ~/gitpush /usr/local/bin/
```

**Option B:** Add `~/` to your PATH (no `sudo` needed):

```bash
echo 'export PATH="$PATH:$HOME"' >> ~/.bashrc
source ~/.bashrc
```

If you use **Zsh**, replace `~/.bashrc` with `~/.zshrc`.

---

## 🧪 Verify Installation

Run the following command to test:

```bash
gitpush --help
```

You should see the help message with usage instructions.

---

## 📖 Usage Examples

| Command | Description |
|---------|-------------|
| `gitpush "Fixed login bug"` | Push to current branch with commit message |
| `gitpush "New feature" development` | Push to the `development` branch |
| `gitpush "Deploy hotfix" main` | Push to `master` (automatically converts `main` → `master`) |
| `gitpush "Deploy hotfix" main --main` | Push to `main` branch (explicitly keeps as `main`) |
| `gitpush ""` | Reuse the last commit message (`git commit -C HEAD`) and push to current branch |
| `gitpush "" development` | Reuse last commit message and push to `development` branch |
| `gitpush "" main` | Reuse last commit message and push to `master` (converts `main` → `master`) |
| `gitpush "" main --main` | Reuse last commit message and push to `main` (keeps as `main`) |
| `gitpush "Updated styling" main -p` | Pull latest changes, then push to `master` |
| `gitpush "Rebased" -f` | Force push to current branch (⚠️ use carefully) |
| `gitpush "Amended message" -a` | Amend the last commit with new message |
| `gitpush --help` | Display help |

---

## 🆕 New Features

### 1. Reuse Last Commit Message
Pass an empty string `""` as the commit message to reuse the last commit message using `git commit -C HEAD`.

```bash
gitpush ""          # Reuse message, push to current branch
gitpush "" main     # Reuse message, push to master (converted)
```

### 2. Explicit `main` Branch Support
Use the `--main` flag to push to a branch named `main` without converting it to `master`.

```bash
gitpush "message" main --main    # Keeps as 'main' branch
gitpush "" main --main           # Reuse message, push to 'main'
```

---

## ⚠️ Notes

- **Branch Conversion:** If you type `main` as the branch, the script will automatically switch to `master` **only if** the `master` branch exists. To force push to `main`, use the `--main` flag.
- **Empty Commit Message:** Passing `""` as the first argument reuses the last commit message (`git commit -C HEAD`). This is useful for amending or reapplying the same commit message.
- The script adds **all** changes (`git add .`). To stage specific files, modify the script or use Git manually.
- Force push (`-f`) rewrites remote history – use it only when you are sure.

---

## 🛠 Troubleshooting

| Issue | Solution |
|-------|----------|
| `command not found: gitpush` | The script is not in your PATH. Use `~/gitpush` or add it to PATH as described above. |
| `Permission denied` | The script is not executable. Run `chmod +x ~/gitpush`. |
| `Not in a git repository` | Run the script from inside a Git repository. |
| `Branch 'xxx' does not exist` | Check the branch name or create it first. |
| Push fails | Pull latest changes using `-p` flag or resolve conflicts manually. |

---

## Modifying the Installed Script with VS Code

If the script is already installed, openprojectname it in VS Code:

```bash
code /usr/local/bin/gitpush
```

Make your changes, save the file with `Ctrl+S`, then close VS Code.

After saving, use the script normally:

```bash
gitpush
```

If the command is not found, run it using the full path:

```bash
/usr/local/bin/gitpush
```

> If VS Code cannot save the file due to permissions, use:
>
> ```bash
> sudoedit /usr/local/bin/gitpush
> ```

## 📄 License

This script is free to use and modify but kindly Use at your own risk.
