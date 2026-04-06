use serde::{Deserialize, Serialize};
use std::fs;
use std::env;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanConfig {
    pub max_parallel_tasks: u32,
    pub ping_timeout_ms: u64,
    pub show_offline_devices: bool,
    pub mdns_lookup_enabled: bool,
    pub scan_interval_ms: u64,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            max_parallel_tasks: 16,
            ping_timeout_ms: 200,
            show_offline_devices: false,
            mdns_lookup_enabled: true,
            scan_interval_ms: 5000,
        }
    }
}

pub fn load_scan_config(app: &AppHandle) -> ScanConfig {
    // 1. Suche nach der Config direkt neben der ausführbaren Datei (Portable-Modus)
    let portable_path = env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|parent| parent.join("scan-config.json")));

    // 2. Ermittle den finalen Pfad: Portable-Pfad bevorzugen, sonst Tauri-Standard
    let config_path = if let Some(p) = portable_path {
        p
    } else {
        app.path().app_config_dir()
            .map(|p| p.join("scan-config.json"))
            .unwrap_or_else(|_| PathBuf::from("scan-config.json"))
    };

    // 3. Datei einlesen oder mit Standardwerten erstellen
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            // Falls die Datei existiert, aber ungültig ist, nehmen wir Default
            serde_json::from_str(&content).unwrap_or_default()
        },
        Err(_) => {
            let default_config = ScanConfig::default();
            
            // Versuche, die Standard-Config als Datei zu speichern
            if let Ok(json) = serde_json::to_string_pretty(&default_config) {
                // Stelle sicher, dass der Ordner existiert (wichtig für Nicht-Portable-Pfad)
                if let Some(parent) = config_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&config_path, json);
            }
            default_config
        }
    }
}


