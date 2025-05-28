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
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

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

#[derive(Debug, Serialize, Deserialize)]
struct AuthStatus {
    is_authenticated: bool,
    needs_setup: bool,
}

struct AppState {
    db: Mutex<Connection>,
    cipher: Mutex<Option<Aes256Gcm>>,
    last_activity: Mutex<u64>,
    session_timeout: u64, // 15 minutes in seconds
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

        // Create master password table
        db.execute(
            "CREATE TABLE IF NOT EXISTS master_auth (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        ).expect("Failed to create master_auth table");

        Self {
            db: Mutex::new(db),
            cipher: Mutex::new(None),
            last_activity: Mutex::new(0),
            session_timeout: 15 * 60, // 15 minutes
        }
    }

    fn update_activity(&self) {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        *self.last_activity.lock().unwrap() = now;
    }

    fn is_session_valid(&self) -> bool {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let last = *self.last_activity.lock().unwrap();
        let cipher = self.cipher.lock().unwrap();
        
        cipher.is_some() && (now - last) < self.session_timeout
    }
}

fn derive_key_from_password(password: &str, salt: &str) -> Result<[u8; 32], String> {
    let mut hasher = Sha256::default();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    let result = hasher.finalize();
    
    let mut key = [0u8; 32];
    key.copy_from_slice(&result[..32]);
    Ok(key)
}

#[tauri::command]
async fn check_auth_status(state: State<'_, AppState>) -> Result<AuthStatus, String> {
    let db = state.db.lock().unwrap();
    
    // Check if master password is set up
    let needs_setup = db.query_row(
        "SELECT COUNT(*) FROM master_auth",
        [],
        |row| row.get::<_, i64>(0)
    ).unwrap_or(0) == 0;

    let is_authenticated = !needs_setup && state.is_session_valid();

    Ok(AuthStatus {
        is_authenticated,
        needs_setup,
    })
}

#[tauri::command]
async fn setup_master_password(master_password: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    
    // Check if already set up
    let count: i64 = db.query_row(
        "SELECT COUNT(*) FROM master_auth",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    if count > 0 {
        return Err("Master password already set up".to_string());
    }

    // Generate salt and hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(master_password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    // Store in database
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs().to_string();
    db.execute(
        "INSERT INTO master_auth (id, password_hash, salt, created_at) VALUES (1, ?1, ?2, ?3)",
        rusqlite::params![password_hash, salt.as_str(), now],
    ).map_err(|e| e.to_string())?;

    // Initialize cipher with the new password
    let key_bytes = derive_key_from_password(&master_password, salt.as_str())?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    *state.cipher.lock().unwrap() = Some(cipher);
    state.update_activity();

    Ok(())
}

#[tauri::command]
async fn authenticate(master_password: String, state: State<'_, AppState>) -> Result<bool, String> {
    let db = state.db.lock().unwrap();
    
    // Get stored hash and salt
    let (stored_hash, salt): (String, String) = db.query_row(
        "SELECT password_hash, salt FROM master_auth WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|_| "Master password not set up".to_string())?;

    // Verify password
    let parsed_hash = PasswordHash::new(&stored_hash).map_err(|e| e.to_string())?;
    let argon2 = Argon2::default();
    
    match argon2.verify_password(master_password.as_bytes(), &parsed_hash) {
        Ok(()) => {
            // Password correct, initialize cipher
            let key_bytes = derive_key_from_password(&master_password, &salt)?;
            let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
            let cipher = Aes256Gcm::new(key);
            *state.cipher.lock().unwrap() = Some(cipher);
            state.update_activity();
            Ok(true)
        }
        Err(_) => Ok(false)
    }
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    *state.cipher.lock().unwrap() = None;
    *state.last_activity.lock().unwrap() = 0;
    Ok(())
}

#[tauri::command]
async fn get_passwords(state: State<'_, AppState>) -> Result<Vec<Password>, String> {
    if !state.is_session_valid() {
        return Err("Session expired. Please log in again.".to_string());
    }
    state.update_activity();

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
    if !state.is_session_valid() {
        return Err("Session expired. Please log in again.".to_string());
    }
    state.update_activity();

    let db = state.db.lock().unwrap();
    let cipher_guard = state.cipher.lock().unwrap();
    let cipher = cipher_guard.as_ref().ok_or("Not authenticated")?;

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
    if !state.is_session_valid() {
        return Err("Session expired. Please log in again.".to_string());
    }
    state.update_activity();

    let db = state.db.lock().unwrap();
    let cipher_guard = state.cipher.lock().unwrap();
    let cipher = cipher_guard.as_ref().ok_or("Not authenticated")?;

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
    if !state.is_session_valid() {
        return Err("Session expired. Please log in again.".to_string());
    }
    state.update_activity();

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
            check_auth_status,
            setup_master_password,
            authenticate,
            logout,
            get_passwords,
            add_password,
            decrypt_password,
            delete_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
