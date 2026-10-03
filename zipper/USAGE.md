# Zipper Usage Guide

## Command Line Interface Syntax

```bash
zipper [FLAGS] [OPTIONS] [INPUT]
```

### Arguments

- `INPUT` (Optional, Default: `.`):
  The target directory or file to compress into a zip archive.

### Flags & Options

- `-o, --output <OUTPUT>` (Optional):
  Output file path or destination directory.
  - If omitted: Auto-names archive as `<target_folder>.zip` in the current working directory.
  - If a directory is provided (e.g. `-o ~/Downloads`): Saves `<target_folder>.zip` into that destination directory.
  - If a file path is provided (e.g. `-o /tmp/custom.zip`): Saves archive directly to that path.

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

### Compress Current Directory
```bash
zipper
```

### Compress Target Repository
```bash
zipper ~/src/my-web-app
```

### Compress Target Repository to Custom Directory
```bash
zipper ~/src/my-web-app -o ~/Desktop
```

### Compress Target Directory including Environment Variables
```bash
zipper . --include-secrets
```

### Compress Large Repositories (>4GB)
```bash
zipper /data/large-dataset --large -o /backups
```
