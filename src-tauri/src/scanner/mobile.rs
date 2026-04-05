// In mobile.rs
use std::net::Ipv4Addr;
use tauri::AppHandle;
use crate::config::ScanConfig;
use crate::scanner::engine;

pub async fn scan_subnet(app: AppHandle, net: Ipv4Addr, pre: u8, conf: ScanConfig) {
    engine::scan_subnet(app, net, pre, conf).await;
}