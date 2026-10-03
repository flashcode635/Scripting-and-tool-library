# Zipper Architecture & Optimization Specification

## Overview

For standard repository scales (~500 files), the primary performance bottlenecks are OS filesystem I/O latency and memory allocation overhead. Zipper is built strictly in Rust using standard library structures and native crates to guarantee memory safety and maximum execution speed.

---

## Part 1: Core Performance & CPU Load Reduction

1. **In-Memory `.gitignore` Traversal (Zero External Dependencies)**
   - **Mechanism:** Uses the Rust `ignore` crate (`WalkBuilder`) instead of spawning external Git sub-processes.
   - **Impact:** Eliminates process-creation overhead. Accurately parses nested `.gitignore` and `.git/info/exclude` rules in-memory without requiring Git installed on the host machine.

2. **Minimal Compression Level**
   - **Mechanism:** Configures Deflate compression to Level 1 (Fast) via pure-Rust configuration (`SimpleFileOptions::compression_level(Some(1))`).
   - **Impact:** Source code files are small text files. High compression levels spend excessive CPU cycles for negligible byte savings. Level 1 maximizes CPU throughput.

3. **Eliminating Heap Re-allocations**
   - **Mechanism:** Pre-allocates a single heap buffer (`vec![0u8; 64 * 1024]`) outside the primary loop and reuses it across file copy reads.
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

3. **Secret Files Protection (`.env.local`)**
   - **Risk:** Framework environment variants (`.env.local`, `.env.test`) are frequently omitted from `.gitignore`.
   - **Solution:** Pure-Rust pattern match drops all files matching `.env*` wildcard globally, unless overridden by `--include-secrets`.

4. **Hidden Build Caches**
   - **Risk:** Frameworks generate dense hidden cache directories (`.next`, `.turbo`, `.git`).
   - **Solution:** Skips hidden internal directories (like `.git`) and hidden files by default to prevent archive bloat.

---

## Part 3: CLI Ergonomics & Path Management

1. **Smart Auto-Naming**
   - **Mechanism:** Extracts target directory's final component via `Path::file_name()` and appends `.zip`.
   - **Impact:** Converts `/projects/myfolder` to `myfolder.zip` automatically without requiring manual output naming.

2. **Dynamic Output Routing & Defaults**
   - **Mechanism:** Optional `-o` / `--output` parameter.
     - **Omitted:** Resolves to `std::env::current_dir()` + inferred filename.
     - **Directory provided (e.g. `~/Downloads`):** Combines destination directory with inferred filename (`~/Downloads/myfolder.zip`).
   - **Impact:** Writes data stream directly to the final intended destination during compression, bypassing post-compression move steps.
