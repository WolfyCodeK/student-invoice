mod backup;
mod commands;
mod error;
mod google;
mod preferences;
mod updates;

use std::time::Duration;

use tauri::Manager;

use google::auth::GoogleAuth;
use updates::UpdateState;

/// One HTTP client for Google and Gmail: native TLS (trusts the Windows
/// certificate store), timeouts, and no redirects (required for OAuth).
fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("StudentInvoice/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("HTTP client configuration is valid")
}

/// The main window is defined in tauri.conf.json (`create: false`) and built
/// here, so device preferences such as low memory mode can set WebView2's
/// browser arguments, which are fixed once the window exists.
fn create_main_window(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or("the main window is missing from tauri.conf.json")?;
    config.additional_browser_args = Some(preferences::browser_args(preferences::load(app)));
    tauri::WebviewWindowBuilder::from_config(app, &config)?.build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::default().build());

    // Development only (never in release builds): the Tauri MCP bridge,
    // bound to localhost so it is not reachable from the network.
    #[cfg(all(debug_assertions, feature = "mcp-bridge"))]
    {
        builder = builder.plugin(
            tauri_plugin_mcp_bridge::Builder::new()
                .bind_address("127.0.0.1")
                .build(),
        );
    }

    builder
        .setup(|app| {
            google::store::init()?;
            app.manage(GoogleAuth::new(http_client()));
            app.manage(UpdateState::default());
            create_main_window(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::gmail_status,
            commands::gmail_connect,
            commands::gmail_cancel_connect,
            commands::gmail_disconnect,
            commands::gmail_create_draft,
            commands::gmail_set_custom_client,
            commands::gmail_clear_custom_client,
            commands::check_for_updates,
            commands::install_update,
            commands::export_backup,
            commands::import_backup,
            commands::create_auto_backup,
            commands::list_backups,
            commands::read_backup,
            commands::open_backups_folder,
            commands::get_preferences,
            commands::set_low_memory_mode,
            commands::restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
