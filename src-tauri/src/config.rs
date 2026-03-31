use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanConfig {
    pub max_parallel_tasks: usize,
    pub ping_timeout_ms: u64,
    pub show_offline_devices: bool,
}

impl Default for ScanConfig {
    fn default() -> Self {
        Self {
            max_parallel_tasks: 16,
            ping_timeout_ms: 100,
            show_offline_devices: false,
        }
    }
}

fn config_path() -> PathBuf {
    PathBuf::from("scan-config.json")
}

pub fn load_scan_config() -> ScanConfig {
    let path = config_path();

    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(_) => return ScanConfig::default(),
    };

    serde_json::from_str::<ScanConfig>(&content).unwrap_or_else(|_| ScanConfig::default())
}