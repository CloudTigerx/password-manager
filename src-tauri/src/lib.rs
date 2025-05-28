#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;
use rusqlite::Connection;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm,
    Key,
    Nonce,
};
use rand::{thread_rng, Rng};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Serialize, Deserialize)]
struct Password {
    id: i64,
    title: String,
    username: String,
    encrypted_password: String,
    category: Option<String>,
    notes: Option<String>,
    last_accessed: Option<String>,
}

struct AppState {
    db: Mutex<Connection>,
    cipher: Mutex<Aes256Gcm>,
}

impl AppState {
    fn new() -> Self {
        let db = Connection::open("passwords.db").expect("Failed to open database");
        
        // Initialize database
        db.execute(
            "CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                username TEXT NOT NULL,
                encrypted_password TEXT NOT NULL,
                category TEXT,
                notes TEXT,
                last_accessed TEXT
            )",
            [],
        ).expect("Failed to create table");

        // Generate or load encryption key
        let key = Key::<Aes256Gcm>::from_slice(b"an example very very secret key."); // In production, use a secure key management system
        let cipher = Aes256Gcm::new(key);

        Self {
            db: Mutex::new(db),
            cipher: Mutex::new(cipher),
        }
    }
}

#[tauri::command]
async fn get_passwords(state: State<'_, AppState>) -> Result<Vec<Password>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, title, username, encrypted_password, category, notes, last_accessed FROM passwords"
    ).map_err(|e| e.to_string())?;

    let passwords = stmt.query_map([], |row| {
        Ok(Password {
            id: row.get(0)?,
            title: row.get(1)?,
            username: row.get(2)?,
            encrypted_password: row.get(3)?,
            category: row.get(4)?,
            notes: row.get(5)?,
            last_accessed: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let result: Result<Vec<_>, _> = passwords.collect();
    result.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_password(
    title: String,
    username: String,
    password: String,
    category: Option<String>,
    notes: Option<String>,
    state: State<'_, AppState>
) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    let cipher = state.cipher.lock().unwrap();

    // Generate a random nonce
    let mut nonce = [0u8; 12];
    thread_rng().fill(&mut nonce);
    let nonce = Nonce::from_slice(&nonce);

    // Encrypt the password
    let encrypted_password = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| e.to_string())?;
    
    // Combine nonce and ciphertext for storage
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&encrypted_password);
    let encoded = BASE64.encode(combined);

    db.execute(
        "INSERT INTO passwords (title, username, encrypted_password, category, notes) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![title, username, encoded, category, notes],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn decrypt_password(id: i64, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    let cipher = state.cipher.lock().unwrap();

    let encrypted = db.query_row(
        "SELECT encrypted_password FROM passwords WHERE id = ?1",
        [id],
        |row| row.get::<_, String>(0)
    ).map_err(|e| e.to_string())?;

    // Decode the combined nonce + ciphertext
    let combined = BASE64.decode(encrypted).map_err(|e| e.to_string())?;
    let (nonce, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce);

    // Decrypt the password
    let password = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| e.to_string())?;

    String::from_utf8(password).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_password(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM passwords WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_passwords,
            add_password,
            decrypt_password,
            delete_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
