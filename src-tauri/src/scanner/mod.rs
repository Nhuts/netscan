use crate::config::ScanConfig;
use std::net::Ipv4Addr;
use tauri::AppHandle;

// Die Engine ist IMMER verfügbar
mod engine;

#[cfg(target_os = "android")]
mod mobile;
#[cfg(target_os = "windows")]
mod windows; // Wieder aktivieren

#[cfg(target_os = "windows")]
pub async fn scan_subnet(app: AppHandle, net: Ipv4Addr, pre: u8, conf: ScanConfig) {
    engine::scan_subnet(app, net, pre, conf).await;
}

#[cfg(target_os = "android")]
pub async fn scan_subnet(app: AppHandle, net: Ipv4Addr, pre: u8, conf: ScanConfig) {
    engine::scan_subnet(app, net, pre, conf).await;
}

// Fallback für andere OS
#[cfg(not(any(target_os = "windows", target_os = "android")))]
pub async fn scan_subnet(_: AppHandle, _: Ipv4Addr, _: u8, _: ScanConfig) {}
