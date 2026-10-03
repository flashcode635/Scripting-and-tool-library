# Zipper

**Zipper** is a high-performance, memory-safe CLI tool written strictly in Rust to archive repositories and directories into `.zip` files while automatically respecting `.gitignore` rules, preventing secret leaks, and optimizing I/O.

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

### Updations

To update the installed `zipper` binary after pull or local code changes, run:

```bash
cargo install --path . --force
```

---

## Command Guide

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

### 2. Dynamic Destination Routing
Compress target folder directly to a destination directory:

```bash
zipper /path/to/my-project -o ~/Downloads
# Creates ~/Downloads/my-project.zip
```

Compress target folder into a specific zip path:

```bash
zipper /path/to/my-project -o /tmp/custom_archive.zip
```

### 3. Including Secret Files (`.env*`)
By default, Zipper automatically drops all files matching `.env*` wildcard patterns. To explicitly include secret files in the archive:

```bash
zipper . --include-secrets
```

### 4. Zip64 Support (Large Archives)
Enable Zip64 extensions for archives or files exceeding 4GB:

```bash
zipper . --large
```

---

## Documentation

For deeper details, consult the dedicated documentation files:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Deep dive into CPU load reduction, monorepo edge cases, and path management.
- [USAGE.md](./USAGE.md) - Detailed CLI syntax, options, and usage examples.
- [DECISIONS.md](./DECISIONS.md) - Immutable decision log detailing technical choices, timestamps, and reasoning.
