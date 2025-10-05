mod gmail;

use std::sync::Mutex;
use tauri::{Emitter};
use tauri_plugin_updater::UpdaterExt;
use tokio::net::TcpListener;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use urlencoding::decode;

#[derive(Debug)]
struct GmailState {
    client: Option<gmail::GmailClient>,
    token: Option<gmail::TokenData>,
    client_id: Option<String>,
    client_secret: Option<String>,
}

lazy_static::lazy_static! {
    static ref GMAIL_STATE: Mutex<GmailState> = Mutex::new(GmailState {
        client: None,
        token: None,
        client_id: None,
        client_secret: None,
    });
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_gmail_auth_url(
    client_id: String,
    client_secret: String
) -> Result<(String, String), String> {

    // Create Gmail client
    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());

    match client.get_auth_url().await {
        Ok((url, csrf_token)) => {
            // Store the client and credentials in global state after successful auth URL generation
            let mut state = GMAIL_STATE.lock().map_err(|e| e.to_string())?;
            state.client = Some(client);
            state.client_id = Some(client_id);
            state.client_secret = Some(client_secret);
            Ok((url, csrf_token))
        }
        Err(e) => Err(format!("Failed to get auth URL: {}", e)),
    }
}

#[tauri::command]
async fn exchange_gmail_code(
    code: String,
    pkce_verifier: String,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {

    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());

    match client.exchange_code_for_token(code, pkce_verifier).await {
        Ok(token_data) => {
            let mut state = GMAIL_STATE.lock().map_err(|e| e.to_string())?;
            state.token = Some(token_data);
            state.client_id = Some(client_id);
            state.client_secret = Some(client_secret);
            Ok(())
        }
        Err(e) => Err(format!("Failed to exchange code for token: {}", e)),
    }
}

#[tauri::command]
async fn create_gmail_draft(
    subject: String,
    body: String,
) -> Result<serde_json::Value, String> {
    let (token, client_id, client_secret) = {
        let state = GMAIL_STATE.lock().map_err(|e| e.to_string())?;
        let token = state.token.as_ref().cloned().ok_or("Not authenticated".to_string())?;
        let client_id = state.client_id.as_ref().cloned().ok_or("Client ID not found".to_string())?;
        let client_secret = state.client_secret.as_ref().cloned().ok_or("Client secret not found".to_string())?;
        (token, client_id, client_secret)
    };

    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());

    match client.create_draft(&token, subject, body).await {
        Ok(draft) => {
            let response = serde_json::json!({
                "id": draft.id,
                "message": {
                    "id": draft.message.id,
                    "threadId": draft.message.thread_id
                }
            });
            Ok(response)
        }
        Err(e) => Err(format!("Failed to create draft: {}", e)),
    }
}

#[tauri::command]
async fn is_gmail_authenticated() -> Result<bool, String> {
    let state = GMAIL_STATE.lock().map_err(|e| e.to_string())?;
    Ok(state.token.is_some())
}

#[tauri::command]
async fn check_gmail_auth_status() -> Result<serde_json::Value, String> {
    let state = GMAIL_STATE.lock().map_err(|e| e.to_string())?;
    let status = serde_json::json!({
        "has_token": state.token.is_some(),
        "has_client_id": state.client_id.is_some(),
        "has_client_secret": state.client_secret.is_some(),
        "token_expires_at": state.token.as_ref().map(|t| t.expires_at.to_rfc3339()),
        "current_time": chrono::Utc::now().to_rfc3339()
    });
    Ok(status)
}

#[tauri::command]
async fn start_oauth_server(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String
) -> Result<String, String> {
    // Start local server to capture OAuth redirect
    let listener = TcpListener::bind("127.0.0.1:3001")
        .await
        .map_err(|e| format!("Failed to bind to port 3001: {}", e))?;

    println!("OAuth redirect server started on http://127.0.0.1:3001");

    // Generate OAuth URL
    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());
    let (auth_url, pkce_verifier) = client.get_auth_url().await
        .map_err(|e| format!("Failed to generate auth URL: {}", e))?;

    // Store client credentials for the server task
    let server_client_id = client_id.clone();
    let server_client_secret = client_secret.clone();

    // Spawn server task to handle redirect
    tauri::async_runtime::spawn(async move {
        println!("Waiting for OAuth redirect...");
        loop {
            let (mut socket, _) = match listener.accept().await {
                Ok(conn) => conn,
                Err(e) => {
                    println!("Accept error: {}", e);
                    continue;
                }
            };

            let mut reader = tokio::io::BufReader::new(&mut socket);

            let mut request = String::new();
            if let Ok(_) = reader.read_line(&mut request).await {
                println!("Received request: {}", request);

                if request.contains("GET /auth/callback") {
                    // Extract authorization code from URL
                    if let Some(code_start) = request.find("code=") {
                        let code_end = request[code_start..].find('&')
                            .map(|pos| code_start + pos)
                            .unwrap_or(request.len());
                        let encoded_code = &request[code_start + 5..code_end];
                        let code = decode(encoded_code).unwrap_or_else(|_| encoded_code.into()).to_string();

                        println!("Extracted authorization code: {}", &code[..20.min(code.len())]);

                        // Exchange code for tokens
                        let client = gmail::create_gmail_client(server_client_id.clone(), server_client_secret.clone());
                        match client.exchange_code_for_token(code, pkce_verifier.clone()).await {
                            Ok(token_data) => {
                                println!("Token exchange successful!");

                                // Store tokens in global state
                                {
                                    let mut state = GMAIL_STATE.lock().unwrap();
                                    state.token = Some(token_data);
                                    state.client_id = Some(server_client_id.clone());
                                    state.client_secret = Some(server_client_secret.clone());
                                }

                                // Emit success event to frontend
                                let _ = app.emit("oauth_success", ());

                                // Send success response to browser
                                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
                                    <html><body><h1>Authentication Successful!</h1>\
                                    <p>You can close this window and return to the Student Invoice app.</p>\
                                    </body></html>";

                                let _ = socket.write_all(response.as_bytes()).await;
                                break;
                            }
                            Err(_) => {
                                println!("Token exchange failed");
                                let response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/html\r\n\r\n\
                                    <html><body><h1>Authentication Failed</h1>\
                                    <p>Please try again in the Student Invoice app.</p>\
                                    </body></html>";

                                let _ = socket.write_all(response.as_bytes()).await;
                            }
                        }
                    }
                }
            }
        }
        println!("OAuth server shutting down");
    });

    Ok(auth_url)
}

// Updater commands
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String> {
    // Try to get updater, but don't fail if it's not available (development mode)
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    println!("Update available: {} -> {}", app.config().version.as_ref().unwrap_or(&"unknown".to_string()), update.version);
                    Ok(format!(
                        r#"{{"available": true, "version": "{}", "body": "{}"}}"#,
                        update.version,
                        update.body.unwrap_or_default()
                    ))
                }
                Ok(None) => {
                    println!("No update available - already on latest version");
                    Ok(r#"{"available": false, "message": "Already on latest version"}"#.to_string())
                }
                Err(e) => {
                    // Log the actual error for debugging
                    eprintln!("Updater check failed with error: {:?}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => {
            // Updater not available (development mode or misconfiguration)
            eprintln!("Updater not available: {}", e);
            Err(format!("Updater not available: {}", e))
        }
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    println!("Starting update installation...");
    
    match app.updater() {
        Ok(updater) => {
            println!("Updater obtained successfully");
            match updater.check().await {
                Ok(Some(update)) => {
                    println!("Update found: version {}", update.version);
                    println!("Downloading and installing update...");
                    
                    match update.download_and_install(
                        |downloaded, total| {
                            if let Some(t) = total {
                                println!("Download progress: {}/{} bytes", downloaded, t);
                            }
                        },
                        || {
                            println!("Download finished, installing...");
                        }
                    ).await {
                        Ok(_) => {
                            println!("Update installed successfully!");
                            Ok(())
                        }
                        Err(e) => {
                            eprintln!("Update installation failed: {:?}", e);
                            Err(format!("Failed to download and install update: {}", e))
                        }
                    }
                }
                Ok(None) => {
                    println!("No update available during install check");
                    Err("No update available".to_string())
                }
                Err(e) => {
                    eprintln!("Failed to check for updates during install: {:?}", e);
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => {
            eprintln!("Updater not available: {:?}", e);
            Err(format!("Updater not available: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
        greet,
        get_gmail_auth_url,
        exchange_gmail_code,
        create_gmail_draft,
        is_gmail_authenticated,
        check_gmail_auth_status,
        start_oauth_server,
        check_for_updates,
        install_update
    ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
