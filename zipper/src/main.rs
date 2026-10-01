use std::fs::File;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::Parser;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Usage: zipper -o output.zip . [--large]
#[derive(Parser)]
#[command(name = "zipper", version, about = "Zip files like a pro")]
struct Cli {
    /// Input file ya directory ("." = current directory)
    #[arg(default_value = ".")]
    input: PathBuf,

    /// Output zip ka path
    #[arg(short, long)]
    output: PathBuf,

    /// 4GB+ files ke liye zip64 enable karo
    #[arg(short, long)]
    large: bool,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    create_zip(&cli.input, &cli.output, cli.large)?;
    println!("✅ Done: {}", cli.output.display());
    Ok(())
}

fn create_zip(input: &Path, output: &Path, large: bool) -> Result<()> {
    // "." jaise relative paths ko real path me badlo
    let input = input
        .canonicalize()
        .with_context(|| format!("input nahi mila: {}", input.display()))?;

    let file = File::create(output)
        .with_context(|| format!("output create nahi hua: {}", output.display()))?;
    // File create hone ke baad hi canonicalize kaam karega
    let output_abs = output.canonicalize()?;

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .large_file(large);

    if input.is_file() {
        let name = input
            .file_name()
            .context("invalid file name")?
            .to_string_lossy()
            .into_owned();
        zip.start_file(name, options)?;
        std::io::copy(&mut File::open(&input)?, &mut zip)?;
    } else if input.is_dir() {
        // Root folder ka naam zip me rahega (jaise "." ke case me current dir ka naam)
        let base = input.parent().unwrap_or(&input);

        for entry in WalkDir::new(&input) {
            let entry = entry?;
            let path = entry.path();

            // Output zip ko khud me add mat karo
            if path == output_abs {
                continue;
            }

            let name = path
                .strip_prefix(base)?
                .to_string_lossy()
                .replace('\\', "/");

            if entry.file_type().is_file() {
                zip.start_file(name, options)?;
                std::io::copy(&mut File::open(path)?, &mut zip)?;
            } else if entry.file_type().is_dir() && !name.is_empty() {
                zip.add_directory(name, options)?;
            }
        }
    } else {
        bail!("input na file hai na directory: {}", input.display());
    }

    zip.finish()?;
    Ok(())
}