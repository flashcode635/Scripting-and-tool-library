# Zipper Usage Guide

## Command Line Interface Syntax

```bash
zipper [OPTIONS] [INPUT]
```

### Arguments

- `[INPUT]` (Optional, Default: `.`):
  The target directory or file to compress into a zip archive. Supports tilde (`~`) expansion to the user's home directory.

### Flags & Options

- `-o, --output <OUTPUT>` (Optional):
  Output file path or destination directory.
  - If omitted: Auto-names archive as `<target_name>.zip` in the current working directory.
  - If a directory is provided (e.g. `-o ~/Downloads` or ending with `/`): Saves `<target_name>.zip` into that destination directory (creates directory if missing).
  - If a file path is provided (e.g. `-o /tmp/custom.zip`): Saves archive directly to that path (creates parent directories if missing).

- `-l, --large`:
  Enables Zip64 mode to support archives or individual files larger than 4GB.

- `--include-secrets`:
  Includes files matching the `.env*` wildcard pattern (dropped by default for security).

- `-h, --help`:
  Displays help information.

- `-V, --version`:
  Displays version information.

---

## Usage Examples

### 1. Compress Current Directory
```bash
zipper
# Creates <current_dir>.zip in the current working directory
```

### 2. Compress a Specific Directory or Repository
```bash
zipper ~/src/my-web-app
# Creates my-web-app.zip in the current working directory
```

### 3. Compress a Single File
```bash
zipper ~/documents/report.pdf
# Creates report.pdf.zip in the current working directory
```

### 4. Dynamic Destination Routing
Compress into a destination folder:
```bash
zipper ~/src/my-web-app -o ~/Desktop
# Creates ~/Desktop/my-web-app.zip
```

Compress into a custom archive path (missing parent directories are created automatically):
```bash
zipper ~/src/my-web-app -o /tmp/backups/app-archive.zip
```

### 5. Include Secret / Environment Files
Include `.env*` files in the zip archive:
```bash
zipper . --include-secrets
```

> **Note:** If archiving a single secret file directly (e.g. `zipper .env`), `--include-secrets` must be provided; otherwise Zipper safely rejects the operation.

### 6. Large Repositories & Zip64 Support (>4GB)
```bash
zipper /data/large-dataset --large -o /backups
# or: zipper /data/large-dataset -l -o /backups
```
