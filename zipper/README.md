# Zipper

**Zipper** is a high-performance, memory-safe CLI tool written in Rust to archive repositories, directories, or individual files into `.zip` archives while automatically respecting `.gitignore` rules, preventing secret leaks, and optimizing I/O.

---

## Features

- **`.gitignore` & Git Exclusion Respect**: Automatically adheres to `.gitignore` and `.git/info/exclude` rules using `ignore::WalkBuilder`, while skipping internal `.git` directories and preserving dotfiles (e.g., `.github`, `.gitignore`).
- **Secret Leak Prevention**: Automatically drops `.env*` files by default (e.g., `.env`, `.env.local`, `.env.production`). Explicitly include them via `--include-secrets`.
- **Directory & Single File Support**: Compress an entire directory or archive a single file with safe checks.
- **Tilde Expansion**: Automatically expands `~` and `~/...` to the user's home directory across both input and output paths.
- **Smart Destination Routing**: Output to a specific `.zip` file or a destination folder (with automatic missing parent directory creation).
- **Self-Archive Prevention**: Avoids recursive zip inclusion if the output zip file is located inside the directory being compressed.
- **Symlink Protection**: Does not follow symlinks (`follow_links(false)`) to prevent infinite recursion and duplicate archives.
- **I/O & Memory Optimization**:
  - Uses 1MB `BufWriter` buffer for batch disk writes.
  - Deflate Compression Level 1 (Fast).
  - Pre-allocated 64KB re-usable chunk buffer to prevent heap reallocations.
- **Zip64 Support**: Archive files and directories exceeding 4GB with `-l` / `--large`.

---

## Installation

### Prerequisites
- [Rust & Cargo](https://rustup.rs/) (edition 2021+)

### From Source

```bash
git clone https://github.com/your-username/zipper.git
cd zipper
cargo install --path . --force
```

`--force` ensures that any previously installed `zipper` binary in `~/.cargo/bin/` is replaced with the newly compiled build.

Alternatively, for manual installation to `/usr/local/bin`:

```bash
cargo build --release
sudo cp target/release/zipper /usr/local/bin/
```

### Updating

To update the installed `zipper` binary after pulling updates or local code changes, run:

```bash
cargo install --path . --force
```

---

## CLI Reference

```bash
zipper [OPTIONS] [INPUT]
```

### Arguments

| Argument | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `[INPUT]` | Positional | `.` | Target input directory or file (`.` = current directory). Supports `~` home expansion. |

### Options & Flags

| Flag / Option | Short | Description |
| :--- | :--- | :--- |
| `--output <PATH>` | `-o` | Optional output zip file path or destination directory. |
| `--large` | `-l` | Enable Zip64 extensions for 4GB+ files and large archives. |
| `--include-secrets` | | Include secret files matching `.env*` wildcard (dropped by default). |
| `--help` | `-h` | Print help information. |
| `--version` | `-V` | Print version information. |

---

## Command Guide & Examples

### 1. Basic Usage (Automatic Naming)
Compress the current directory into `<folder_name>.zip` in the current working directory:

```bash
zipper
```

Compress a specific directory:

```bash
zipper /path/to/my-project
# Creates my-project.zip in current working directory
```

Compress a single file:

```bash
zipper /path/to/file.txt
# Creates file.txt.zip in current working directory
```

### 2. Tilde (`~`) Home Path Expansion
Compress folders using `~` shorthand:

```bash
zipper ~/projects/my-web-app
```

### 3. Dynamic Destination Routing
Compress a target folder directly into a destination directory:

```bash
zipper /path/to/my-project -o ~/Downloads
# Creates ~/Downloads/my-project.zip
```

Compress into a custom zip path (missing parent directories are created automatically):

```bash
zipper /path/to/my-project -o /tmp/archives/custom_name.zip
```

### 4. Secret Files Handling (`.env*`)
By default, Zipper drops all files matching `.env*` patterns. To explicitly include secret files:

```bash
zipper . --include-secrets
```

> **Note:** If compressing a single secret file directly (e.g., `zipper .env`), `--include-secrets` must be provided; otherwise Zipper safely rejects the operation.

### 5. Zip64 Support (Large Archives)
Enable Zip64 extensions for archives or files exceeding 4GB:

```bash
zipper /data/large-dataset -l -o ~/Backups
# or: zipper /data/large-dataset --large -o ~/Backups
```

---

## Documentation

For deeper details, consult the dedicated documentation files:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Deep dive into CPU load reduction, monorepo edge cases, and path management.
- [USAGE.md](./USAGE.md) - Detailed CLI syntax, options, and usage examples.
- [DECISIONS.md](./DECISIONS.md) - Immutable decision log detailing technical choices, timestamps, and reasoning.
