use std::fs::File;
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::Parser;
use ignore::WalkBuilder;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Zipper CLI: Fast, memory-safe repository zipping respecting .gitignore
#[derive(Parser, Debug)]
#[command(name = "zipper", version, about = "Zip files and directories like a pro while respecting .gitignore")]
struct Cli {
    /// Target input directory or file ("." = current directory)
    #[arg(default_value = ".")]
    input: PathBuf,

    /// Optional output zip path or destination directory
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Enable zip64 for 4GB+ files
    #[arg(short, long)]
    large: bool,

    /// Include secret files matching `.env*` wildcard (dropped by default)
    #[arg(long, default_value_t = false)]
    include_secrets: bool,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let (input_path, output_path) = resolve_paths(&cli.input, cli.output.as_deref())?;

    println!("📦 Compressing: {} -> {}", input_path.display(), output_path.display());

    create_zip(&input_path, &output_path, cli.large, cli.include_secrets)?;

    println!("✅ Done: {}", output_path.display());
    Ok(())
}

/// Expands leading `~` in path to the user's home directory.
fn expand_tilde(path: &Path) -> PathBuf {
    let path_str = path.to_string_lossy();
    if path_str == "~" || path_str.starts_with("~/") || path_str.starts_with("~\\") {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            if path_str == "~" {
                return home;
            } else {
                return home.join(&path_str[2..]);
            }
        }
    }
    path.to_path_buf()
}

/// Resolves input and output paths according to Zipper CLI rules.
fn resolve_paths(input_raw: &Path, output_raw: Option<&Path>) -> Result<(PathBuf, PathBuf)> {
    let input_expanded = expand_tilde(input_raw);
    let input_canonical = input_expanded
        .canonicalize()
        .with_context(|| format!("Input path does not exist: {}", input_raw.display()))?;

    // Infer base zip filename from target directory/file
    let inferred_name = match input_canonical.file_name() {
        Some(name) => {
            let name_str = name.to_string_lossy();
            if name_str.is_empty() || name_str == "/" {
                "archive.zip".to_string()
            } else {
                format!("{}.zip", name_str)
            }
        }
        None => "archive.zip".to_string(),
    };

    let output_path = match output_raw {
        None => {
            let current_dir = std::env::current_dir().context("Failed to get current working directory")?;
            current_dir.join(inferred_name)
        }
        Some(out) => {
            let expanded_out = expand_tilde(out);
            if expanded_out.is_dir() {
                expanded_out.join(inferred_name)
            } else if expanded_out.to_string_lossy().ends_with('/') || expanded_out.to_string_lossy().ends_with('\\') {
                std::fs::create_dir_all(&expanded_out)
                    .with_context(|| format!("Failed to create destination directory: {}", expanded_out.display()))?;
                expanded_out.join(inferred_name)
            } else {
                if let Some(parent) = expanded_out.parent() {
                    if !parent.as_os_str().is_empty() && !parent.exists() {
                        std::fs::create_dir_all(parent)
                            .with_context(|| format!("Failed to create parent directory for output: {}", parent.display()))?;
                    }
                }
                expanded_out
            }
        }
    };

    Ok((input_canonical, output_path))
}

fn is_secret_file(filename: &str) -> bool {
    filename.starts_with(".env")
}

fn create_zip(input: &Path, output: &Path, large: bool, include_secrets: bool) -> Result<()> {
    let file = File::create(output)
        .with_context(|| format!("Failed to create output zip file: {}", output.display()))?;

    // Part 1, Item 4: Wrap output in BufWriter with 1MB capacity
    let buf_writer = BufWriter::with_capacity(1024 * 1024, file);
    let mut zip = ZipWriter::new(buf_writer);

    // Part 1, Item 2: Deflate Level 1 (Fast)
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(1))
        .large_file(large);

    // Re-usable buffer for copying file chunks without heap re-allocations
    // Part 1, Item 3: Pre-allocate a single heap buffer
    let mut buffer = vec![0u8; 64 * 1024];

    if input.is_file() {
        let file_name = input
            .file_name()
            .context("Invalid input filename")?
            .to_string_lossy()
            .into_owned();

        if !include_secrets && is_secret_file(&file_name) {
            bail!("Input file is a secret file ({}) and --include-secrets was not specified.", file_name);
        }

        zip.start_file(file_name, options)?;
        let mut f = File::open(input)?;
        copy_with_buffer(&mut f, &mut zip, &mut buffer)?;
    } else if input.is_dir() {
        let output_canonical = output.canonicalize().ok();

        // Part 1 Item 1 & Part 2 Item 1, 2, 4:
        // Use ignore WalkBuilder with follow_links(false)
        let walker = WalkBuilder::new(input)
            .follow_links(false) // Symlink recursion prevention
            .hidden(false)       // Allow dotfiles like .gitignore, .github, etc.
            .git_ignore(true)    // Parse .gitignore recursively
            .git_exclude(true)   // Respect .git/info/exclude
            .git_global(false)   // Do not let global user gitignore affect repository-level tests
            .build();

        for result in walker {
            let entry = match result {
                Ok(e) => e,
                Err(err) => {
                    eprintln!("⚠️ Warning skipping entry: {}", err);
                    continue;
                }
            };

            let path = entry.path();

            // Skip root directory entry itself
            if path == input {
                continue;
            }

            // Do not zip the output archive itself if created inside target directory
            if let Some(ref out_canon) = output_canonical {
                if path.canonicalize().ok().as_ref() == Some(out_canon) {
                    continue;
                }
            }

            let relative_path = match path.strip_prefix(input) {
                Ok(p) => p,
                Err(_) => continue,
            };

            let name_in_zip = relative_path.to_string_lossy().replace('\\', "/");
            if name_in_zip.is_empty() {
                continue;
            }

            // Part 2 Item 4: Skip .git internal directory
            if relative_path.starts_with(".git") {
                continue;
            }

            // Part 2 Item 3: Non-Standard Secret Files (.env*)
            if !include_secrets {
                if let Some(file_name) = path.file_name().and_then(|s| s.to_str()) {
                    if is_secret_file(file_name) {
                        continue;
                    }
                }
            }

            let file_type = match entry.file_type() {
                Some(ft) => ft,
                None => continue,
            };

            if file_type.is_dir() {
                zip.add_directory(name_in_zip, options)?;
            } else if file_type.is_file() {
                zip.start_file(name_in_zip, options)?;
                let mut f = File::open(path)?;
                copy_with_buffer(&mut f, &mut zip, &mut buffer)?;
            }
        }
    } else {
        bail!("Input path is neither a regular file nor a directory: {}", input.display());
    }

    zip.finish()?;
    Ok(())
}

fn copy_with_buffer<R: Read, W: Write>(reader: &mut R, writer: &mut W, buffer: &mut [u8]) -> Result<()> {
    loop {
        let bytes_read = reader.read(buffer)?;
        if bytes_read == 0 {
            break;
        }
        writer.write_all(&buffer[..bytes_read])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_secret_file_detection() {
        assert!(is_secret_file(".env"));
        assert!(is_secret_file(".env.local"));
        assert!(is_secret_file(".env.test"));
        assert!(!is_secret_file("environment.rs"));
    }

    #[test]
    fn test_resolve_paths_auto_naming() {
        let temp_dir = TempDir::new().unwrap();
        let sample_dir = temp_dir.path().join("myproject");
        fs::create_dir_all(&sample_dir).unwrap();

        let (input, output) = resolve_paths(&sample_dir, None).unwrap();
        assert_eq!(input, sample_dir.canonicalize().unwrap());
        assert!(output.ends_with("myproject.zip"));
    }

    #[test]
    fn test_resolve_paths_custom_destination_dir() {
        let temp_dir = TempDir::new().unwrap();
        let sample_dir = temp_dir.path().join("myproject");
        let dest_dir = temp_dir.path().join("downloads");
        fs::create_dir_all(&sample_dir).unwrap();
        fs::create_dir_all(&dest_dir).unwrap();

        let (input, output) = resolve_paths(&sample_dir, Some(&dest_dir)).unwrap();
        assert_eq!(input, sample_dir.canonicalize().unwrap());
        assert_eq!(output, dest_dir.join("myproject.zip"));
    }
}
