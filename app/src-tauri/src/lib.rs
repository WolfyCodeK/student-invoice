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
    let prefs = preferences::load(app);
    config.additional_browser_args = Some(preferences::browser_args(prefs));
    // Settings compares this with the saved choice to offer a restart.
    app.manage(preferences::Running(prefs));
    // Start no bigger than the screen's free area (e.g. 1366x768 laptops).
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let area = monitor.work_area().size;
        let (width, height) = fit_to_screen(
            (config.width, config.height),
            (
                config.min_width.unwrap_or(0.0),
                config.min_height.unwrap_or(0.0),
            ),
            (
                f64::from(area.width) / scale,
                f64::from(area.height) / scale,
            ),
        );
        config.width = width;
        config.height = height;
    }
    let window = tauri::WebviewWindowBuilder::from_config(app, &config)?.build()?;
    // If WebView2 fails to start (e.g. ERROR_INVALID_STATE while a copy
    // started with other browser arguments is still closing), Tauri only logs
    // it and `build` still succeeds. Stop instead of running on without a
    // window: that process would hold the single-instance lock, and every
    // later launch would hand over to it and quit.
    window
        .scale_factor()
        .map_err(|_| "the main window couldn't be created")?;
    Ok(())
}

/// The window size to open at: the configured size, reduced to leave a small
/// margin inside the screen's free area, but never below the minimum size.
fn fit_to_screen(size: (f64, f64), min: (f64, f64), screen: (f64, f64)) -> (f64, f64) {
    const MARGIN: f64 = 24.0;
    let fit = |want: f64, min: f64, avail: f64| want.min(avail - MARGIN).max(min);
    (fit(size.0, min.0, screen.0), fit(size.1, min.1, screen.1))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // One copy at a time: a second launch brings the running window forward
    // and exits. Otherwise it would start WebView2 on the same data folder,
    // which fails after a Low memory mode change (different browser
    // arguments) and leaves a process with no window holding the exe.
    // Registered first, as the plugin requires. Release builds only: the lock
    // is named after the identifier, which development builds share with the
    // installed app, so `tauri dev` would just focus the installed app.
    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder
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
            google::store::init(&app.config().identifier)?;
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

#[cfg(test)]
mod tests {
    use super::fit_to_screen;

    #[test]
    fn window_fits_small_screens_but_not_below_minimum() {
        // 1366x768 laptop with a 48 px taskbar: 1366x720 free.
        assert_eq!(
            fit_to_screen((1280.0, 800.0), (960.0, 600.0), (1366.0, 720.0)),
            (1280.0, 696.0)
        );
        // Large screen: unchanged.
        assert_eq!(
            fit_to_screen((1280.0, 800.0), (960.0, 600.0), (2560.0, 1392.0)),
            (1280.0, 800.0)
        );
        // Tiny screen: never below the minimum.
        assert_eq!(
            fit_to_screen((1280.0, 800.0), (960.0, 600.0), (800.0, 560.0)),
            (960.0, 600.0)
        );
    }
}
