mod commands;
mod error;
mod google;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
