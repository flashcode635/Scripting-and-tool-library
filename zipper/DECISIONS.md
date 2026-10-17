# Decisions Log

This document serves as an immutable decision log (agent memory/cache) recording key technical and architectural decisions made during the development of Zipper, along with timestamps, context, and reasoning.

---

### Decision 1: Replace `walkdir` with `ignore` Crate
- **Timestamp:** 2026-03-30T08:30:00Z
- **Decision:** Replaced `walkdir` dependency with the Rust `ignore` crate (`WalkBuilder`).
- **Context:** The previous implementation used `walkdir` without native `.gitignore` support, requiring external commands or missing `.gitignore` traversal capabilities.
- **Reasoning:** The `ignore` crate efficiently handles in-memory recursive `.gitignore` parsing, cascades nested `.gitignore` files in monorepos, and respects exclusion rules natively without spawning Git sub-processes or relying on an installed Git binary.

---

### Decision 2: Set Deflate Compression to Level 1 (Fast)
- **Timestamp:** 2026-03-30T08:35:00Z
- **Decision:** Explicitly configured Deflate compression level to `Level 1` using `zip::write::SimpleFileOptions::compression_level(Some(1))`.
- **Context:** Standard zip default compression (Level 6) spends significant CPU cycles calculating optimal compression for minimal file size reductions on code repositories.
- **Reasoning:** Source code files are small text files. Level 1 maximizes CPU throughput and processing speed while achieving nearly identical file sizes for repository archives.

---

### Decision 3: Single Pre-Allocated Buffer for I/O Copying
- **Timestamp:** 2026-03-30T08:36:00Z
- **Decision:** Allocated a single reusable 64KB heap buffer (`vec![0u8; 64 * 1024]`) outside the file traversal loop and passed it into the custom streaming copy loop.
- **Context:** `std::io::copy` creates temporary buffers on every call, leading to thousands of heap allocations during multi-file repository iteration.
- **Reasoning:** Reusing a single pre-allocated 64KB buffer prevents unnecessary dynamic memory allocation/deallocation overhead at the OS kernel level.

---

### Decision 4: Wrap Output File Stream in 1MB `BufWriter`
- **Timestamp:** 2026-03-30T08:37:00Z
- **Decision:** Wrapped the output `.zip` file handle in `std::io::BufWriter::with_capacity(1024 * 1024, file)`.
- **Context:** Writing individual compressed chunks and headers directly to disk causes thousands of unbuffered OS write syscalls.
- **Reasoning:** Buffering compressed byte streams up to 1MB in RAM before flushing to disk reduces kernel `write()` system calls by ~95%, drastically speeding up filesystem operations.

---

### Decision 5: Disable Symlink Following (`follow_links(false)`)
- **Timestamp:** 2026-03-30T08:38:00Z
- **Decision:** Configured `WalkBuilder` with `follow_links(false)`.
- **Context:** Package managers like `pnpm` use symlinks between monorepo workspace packages and external dependencies.
- **Reasoning:** Following symlinks introduces risks of infinite loops or accidentally traversing massive external dependency trees (e.g., `node_modules`). Disabling symlink following guarantees traversal safety and performance.

---

### Decision 6: Hardcoded Default Filter for `.env*` Wildcard Secret Files
- **Timestamp:** 2026-03-30T08:39:00Z
- **Decision:** Implemented global matching and dropping of all files matching `.env*` wildcard patterns unless `--include-secrets` flag is explicitly passed.
- **Context:** Developers frequently omit environment variants (`.env.local`, `.env.test`, `.env.production`) from `.gitignore`.
- **Reasoning:** Prevents accidental exposure of API keys and credentials in shared zip archives while providing an explicit override flag when secrets are intentionally needed.

---

### Decision 7: Smart Auto-Naming & Dynamic Output Routing
- **Timestamp:** 2026-03-30T08:40:00Z
- **Decision:** Made the `-o` / `--output` CLI argument optional.
  - If output argument is omitted: Infers `<target_directory_name>.zip` and creates it in `std::env::current_dir()`.
  - If output argument is a directory: Merges target directory name with destination path (e.g. `~/Downloads/myfolder.zip`).
- **Context:** Previously, users were required to specify both target directory and output path explicitly.
- **Reasoning:** Reduces CLI command friction, eliminates manual typing of output filenames, and streams compressed data directly to the intended destination directory without post-compression move steps.

---

### Decision 8: Preserve Repository Dotfiles with Explicit `.git` Exclusion
- **Timestamp:** 2026-03-30T08:41:00Z
- **Decision:** Configured `WalkBuilder` with `hidden(false)` while explicitly filtering out `.git` internal metadata directories during traversal.
- **Context:** Setting `hidden(true)` unintentionally drops crucial repository configuration dotfiles (such as `.github`, `.gitignore`, `.eslintrc`, `.prettierrc`).
- **Reasoning:** Developers expect version-controlled dotfiles and config directories to be preserved in repo archives. Setting `hidden(false)` while explicitly skipping `.git` directory trees ensures configuration files remain intact while excluding internal VCS database bloat.

---

### Decision 9: Tilde (`~`) Expansion & Smart Path Resolution
- **Timestamp:** 2026-03-30T08:42:00Z
- **Decision:** Implemented custom path normalization and tilde expansion (`~` / `~/...`) referencing the `$HOME` environment variable across both input and output paths, alongside automatic directory creation for missing destination folders.
- **Context:** Shell shorthand like `zipper ~/my-project -o ~/Backups/` requires manual expansion if not handled by the shell or CLI wrapper.
- **Reasoning:** Delivers predictable and cross-platform path resolution directly inside the CLI binary without relying on shell-specific expansion behaviors.

---

### Decision 10: Self-Archive Prevention
- **Timestamp:** 2026-03-30T08:43:00Z
- **Decision:** Canonicalized the output archive path and matched each traversed entry against it to skip the output zip file during compression.
- **Context:** When running `zipper . -o output.zip` inside the target directory, the active archive file could be read as an input while being written.
- **Reasoning:** Prevents recursive file reading/locking conflicts and avoids corrupted archives.

---

### Decision 11: Zip64 Support for Large Archives (`--large`)
- **Timestamp:** 2026-03-30T08:44:00Z
- **Decision:** Added `-l` / `--large` CLI flag that sets `SimpleFileOptions::large_file(true)`.
- **Context:** Standard zip formats fail when archiving directories or individual files exceeding 4GB.
- **Reasoning:** Enables users to safely package large datasets or build artifacts while keeping standard 32-bit zip headers by default for standard repository archives.
