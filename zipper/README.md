# Zipper

A **CLI tool** to create zip archives while **respecting `.gitignore`** files. Built in Rust.

## Features

- ✅ Compress folders into `.zip` files
- ✅ **Automatically ignores** files/folders listed in `.gitignore`
- ✅ Respects `.git/info/exclude` patterns
- ✅ Preserves directory structure
- ✅ Fast and lightweight

## Installation

### From Source

1. **Clone or create the project:**
   ```bash
   mkdir zipper && cd zipper

### Updations
for updating code — ek hi command hai:

```bash
cargo install --path . --force
```

`--force` zaroori hai kyunki same naam ki binary pehle se installed hai. Ye compile karke naya binary `~/.cargo/bin/` me replace kar dega — aur tumhara command turant naye code se chalega.

Manual wali `/usr/local/bin` method use ki thi to:

```bash
cargo build --release
sudo cp target/release/zipper /usr/local/bin/
```

Ek hi baar karna hai, uske baad terminal me `zipper` likho — done. Har code change ke baad bas reinstall repeat karna hota hai, warna purani hi binary chalti rahegi.