mod gmail;

use std::sync::Mutex;
use tauri::State;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct GmailState {
    client: Option<gmail::GmailClient>,
    token: Option<gmail::TokenData>,
    client_id: Option<String>,
    client_secret: Option<String>,
}

#[tauri::command]
async fn get_gmail_auth_url(
    state: State<'_, Mutex<GmailState>>,
    client_id: String,
    client_secret: String
) -> Result<(String, String), String> {

    // Create Gmail client
    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());

    match client.get_auth_url().await {
        Ok((url, csrf_token)) => {
            // Store the client and credentials in state after successful auth URL generation
            let mut state = state.lock().map_err(|e| e.to_string())?;
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
    state: State<'_, Mutex<GmailState>>,
    code: String,
    pkce_verifier: String,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {

    let client = gmail::create_gmail_client(client_id.clone(), client_secret.clone());

    match client.exchange_code_for_token(code, pkce_verifier).await {
        Ok(token_data) => {
            let mut state = state.lock().map_err(|e| e.to_string())?;
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
    state: State<'_, Mutex<GmailState>>,
    subject: String,
    body: String,
) -> Result<serde_json::Value, String> {
    let (token, client_id, client_secret) = {
        let state = state.lock().map_err(|e| e.to_string())?;
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
async fn is_gmail_authenticated(state: State<'_, Mutex<GmailState>>) -> Result<bool, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.token.is_some())
}

#[tauri::command]
async fn check_gmail_auth_status(state: State<'_, Mutex<GmailState>>) -> Result<serde_json::Value, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    let status = serde_json::json!({
        "has_token": state.token.is_some(),
        "has_client_id": state.client_id.is_some(),
        "has_client_secret": state.client_secret.is_some(),
        "token_expires_at": state.token.as_ref().map(|t| t.expires_at.to_rfc3339()),
        "current_time": chrono::Utc::now().to_rfc3339()
    });
    Ok(status)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(GmailState {
            client: None,
            token: None,
            client_id: None,
            client_secret: None,
        }))
    .invoke_handler(tauri::generate_handler![
        greet,
        get_gmail_auth_url,
        exchange_gmail_code,
        create_gmail_draft,
        is_gmail_authenticated,
        check_gmail_auth_status
    ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
