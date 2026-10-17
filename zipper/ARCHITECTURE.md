# Zipper Architecture & Optimization Specification

## Overview

For standard repository scales (~500 files) as well as larger codebases, the primary performance bottlenecks are OS filesystem I/O latency and dynamic memory allocation overhead. Zipper is built strictly in Rust using standard library primitives and native high-efficiency crates to guarantee memory safety, security, and maximum execution speed.

---

## Part 1: Core Performance & CPU Load Reduction

1. **In-Memory `.gitignore` Traversal (Zero External Dependencies)**
   - **Mechanism:** Uses the Rust `ignore` crate (`WalkBuilder`) instead of spawning external Git sub-processes.
   - **Impact:** Eliminates process-creation overhead. Accurately parses nested `.gitignore` and `.git/info/exclude` rules in-memory without requiring Git installed on the host machine.

2. **Minimal Compression Level**
   - **Mechanism:** Configures Deflate compression to Level 1 (Fast) via pure-Rust configuration (`SimpleFileOptions::compression_level(Some(1))`).
   - **Impact:** Source code files are small text files. High compression levels spend excessive CPU cycles for negligible byte savings. Level 1 maximizes CPU throughput.

3. **Eliminating Heap Re-allocations**
   - **Mechanism:** Pre-allocates a single heap buffer (`vec![0u8; 64 * 1024]`) outside the file streaming loop and reuses it across file chunk reads.
   - **Impact:** Prevents thousands of dynamic memory allocations and de-allocations at the OS level during repository iteration.

4. **Batch Disk Writes**
   - **Mechanism:** Wraps the output `.zip` file handle in `std::io::BufWriter` with a 1MB capacity (`BufWriter::with_capacity(1024 * 1024, file)`).
   - **Impact:** Keeps compressed byte streams and headers in RAM, flushing to disk in bulk. Reduces OS kernel `write()` system calls by ~95%.

---

## Part 2: Framework & Monorepo Edge Cases

1. **Nested Ignore Rules (Monorepos)**
   - **Risk:** Monorepos use nested `.gitignore` files in `apps/` and `packages/` subdirectories.
   - **Solution:** `WalkBuilder` recursively cascades and evaluates nested `.gitignore` rules down the directory tree out of the box.

2. **Symlink Recursion (pnpm Workspaces)**
   - **Risk:** Modern package managers use symlinks to connect workspace packages. Following symlinks causes infinite loops or includes massive external `node_modules` trees.
   - **Solution:** Configured walker with `.follow_links(false)` to guarantee safety and speed.

3. **Secret Files Protection (`.env*`)**
   - **Risk:** Framework environment variants (`.env.local`, `.env.test`, `.env.production`) are frequently omitted from `.gitignore`.
   - **Solution:** Pure-Rust pattern match drops all files matching `.env*` wildcard globally, unless overridden by `--include-secrets`. When archiving a single secret file directly, Zipper safely rejects unless `--include-secrets` is provided.

4. **Internal `.git` Directory Exclusion & Dotfile Preservation**
   - **Risk:** Excluding all hidden files drops necessary repo configuration files (like `.github`, `.gitignore`, `.eslintrc`), while including everything includes the bulky internal `.git` database.
   - **Solution:** Configured `WalkBuilder` with `.hidden(false)` to preserve repository dotfiles, combined with an explicit check to exclude internal `.git` metadata directories.

5. **Self-Archive Avoidance**
   - **Risk:** When creating the output archive inside the directory being zipped (e.g., `zipper . -o ./output.zip`), the output file could recursively be read while being written.
   - **Solution:** Canonicalizes output path and compares each entry's canonical path against the destination archive path, skipping it automatically.

---

## Part 3: CLI Ergonomics & Path Management

1. **Single File & Directory Support**
   - **Mechanism:** Detects whether the input is a single file or a directory. Regular files are zipped directly; directories undergo git-ignored traversal.
   - **Impact:** Flexible utility for quick single-file and full-workspace archiving.

2. **Tilde (`~`) Expansion**
   - **Mechanism:** Resolves leading `~` or `~/...` against the user's `HOME` environment variable across both input and output paths.
   - **Impact:** Seamless cross-platform shell ergonomics for absolute user paths.

3. **Smart Auto-Naming**
   - **Mechanism:** Extracts target input's final component via `Path::file_name()` and appends `.zip`.
   - **Impact:** Converts `/projects/myfolder` to `myfolder.zip` automatically without requiring manual output naming.

4. **Dynamic Output Routing & Missing Parent Creation**
   - **Mechanism:** Optional `-o` / `--output` parameter.
     - **Omitted:** Resolves to `std::env::current_dir()` + inferred filename.
     - **Directory provided (e.g. `~/Downloads` or trailing `/`):** Combines destination directory with inferred filename (`~/Downloads/myfolder.zip`) and creates directory if missing.
     - **File path provided:** Resolves directly to the target zip path and creates missing parent directories.
   - **Impact:** Writes data stream directly to the final intended destination during compression, bypassing post-compression move steps.

5. **Zip64 Support for Large Archives**
   - **Mechanism:** Configures `SimpleFileOptions::large_file(large)` when `-l` / `--large` is specified.
   - **Impact:** Allows compression of datasets and repositories exceeding the 4GB standard Zip limit.
