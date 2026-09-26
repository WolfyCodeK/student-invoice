use std::path::PathBuf;

/// Commands the webview may call. Must match `generate_handler!` in
/// src/lib.rs and the `allow-*` permissions in capabilities/default.json
/// (checked by scripts/docs/generate.mjs).
const COMMANDS: &[&str] = &[
    "gmail_status",
    "gmail_connect",
    "gmail_cancel_connect",
    "gmail_disconnect",
    "gmail_create_draft",
    "gmail_set_custom_client",
    "gmail_clear_custom_client",
    "check_for_updates",
    "install_update",
    "export_backup",
    "import_backup",
    "create_auto_backup",
    "list_backups",
    "read_backup",
    "open_backups_folder",
];

fn main() {
    embed_google_client();
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}

/// Makes the owner's Google OAuth "Desktop app" client available to the code
/// as SI_GOOGLE_CLIENT_ID / SI_GOOGLE_CLIENT_SECRET (read with option_env!).
/// Source, in order: those environment variables (set by the release script),
/// or the client file in the owner's secrets folder. Never from the repo.
/// Without either, the build works but Gmail shows "not set up".
fn embed_google_client() {
    for var in [
        "SI_GOOGLE_CLIENT_ID",
        "SI_GOOGLE_CLIENT_SECRET",
        "SI_SECRETS_DIR",
        "USERPROFILE",
    ] {
        println!("cargo:rerun-if-env-changed={var}");
    }
    if std::env::var("SI_GOOGLE_CLIENT_ID").is_ok_and(|v| !v.is_empty()) {
        return; // already in the environment; option_env! will see it
    }
    let dir = std::env::var_os("SI_SECRETS_DIR")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|home| PathBuf::from(home).join(".secrets").join("student-invoice"))
        });
    let Some(file) = dir.map(|d| d.join("google-oauth-client.json")) else {
        return;
    };
    println!("cargo:rerun-if-changed={}", file.display());
    let Ok(text) = std::fs::read_to_string(&file) else {
        return;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
        println!(
            "cargo:warning=google-oauth-client.json is not valid JSON; building without Gmail"
        );
        return;
    };
    let creds = json.get("installed").unwrap_or(&json);
    if let (Some(id), Some(secret)) = (creds["client_id"].as_str(), creds["client_secret"].as_str())
    {
        println!("cargo:rustc-env=SI_GOOGLE_CLIENT_ID={id}");
        println!("cargo:rustc-env=SI_GOOGLE_CLIENT_SECRET={secret}");
    }
}
