use std::fs::{self, File};
use std::process::Command;
use tempfile::TempDir;
use zip::ZipArchive;

fn get_binary_path() -> String {
    let mut path = std::env::current_exe().unwrap();
    path.pop(); // remove test binary name
    if path.ends_with("deps") {
        path.pop();
    }
    path.join("zipper").to_string_lossy().into_owned()
}

#[test]
fn test_integration_auto_naming_and_gitignore() {
    let temp_dir = TempDir::new().unwrap();
    let repo_dir = temp_dir.path().join("my_app");
    fs::create_dir_all(&repo_dir).unwrap();

    // Create a dummy .git directory so WalkBuilder recognizes repo_dir as a git repository root
    fs::create_dir_all(repo_dir.join(".git")).unwrap();

    // Create files
    fs::write(repo_dir.join("main.rs"), "fn main() {}").unwrap();
    fs::write(repo_dir.join(".gitignore"), "target/\n.env*\nsecret.txt").unwrap();
    fs::write(repo_dir.join("secret.txt"), "shh").unwrap();
    fs::write(repo_dir.join(".env.local"), "SECRET_KEY=123").unwrap();

    let target_sub = repo_dir.join("target");
    fs::create_dir_all(&target_sub).unwrap();
    fs::write(target_sub.join("app.bin"), "binary data").unwrap();

    // Run zipper CLI pointing to repo_dir
    let binary = get_binary_path();
    let output = Command::new(&binary)
        .arg(&repo_dir)
        .output()
        .expect("Failed to execute zipper binary");

    assert!(output.status.success(), "Command failed: {:?}", String::from_utf8_lossy(&output.stderr));

    // Expected zip path: current_dir/my_app.zip
    let expected_zip = std::env::current_dir().unwrap().join("my_app.zip");
    assert!(expected_zip.exists(), "Expected archive does not exist: {}", expected_zip.display());

    // Inspect Zip contents
    let file = File::open(&expected_zip).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let names: Vec<String> = (0..archive.len()).map(|i| archive.by_index(i).unwrap().name().to_string()).collect();

    assert!(names.contains(&"main.rs".to_string()));
    assert!(names.contains(&".gitignore".to_string()));
    assert!(!names.contains(&"secret.txt".to_string()));
    assert!(!names.contains(&".env.local".to_string()));
    assert!(!names.iter().any(|n| n.starts_with("target/")));

    // Clean up created zip
    let _ = fs::remove_file(expected_zip);
}

#[test]
fn test_integration_include_secrets_flag() {
    let temp_dir = TempDir::new().unwrap();
    let repo_dir = temp_dir.path().join("secret_app");
    fs::create_dir_all(&repo_dir).unwrap();

    fs::write(repo_dir.join("app.js"), "console.log('hi')").unwrap();
    fs::write(repo_dir.join(".env.local"), "SECRET=true").unwrap();

    let dest_zip = temp_dir.path().join("custom_out.zip");

    let binary = get_binary_path();
    let output = Command::new(&binary)
        .arg(&repo_dir)
        .arg("-o")
        .arg(&dest_zip)
        .arg("--include-secrets")
        .output()
        .expect("Failed to execute zipper binary");

    assert!(output.status.success());
    assert!(dest_zip.exists());

    let file = File::open(&dest_zip).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let names: Vec<String> = (0..archive.len()).map(|i| archive.by_index(i).unwrap().name().to_string()).collect();

    assert!(names.contains(&"app.js".to_string()));
    assert!(names.contains(&".env.local".to_string()));
}
