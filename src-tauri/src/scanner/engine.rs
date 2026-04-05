use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tauri::{AppHandle, Emitter};

use crate::commands::Device;
use crate::config::ScanConfig;

async fn ping_host_async(ip: Ipv4Addr, timeout_ms: u64) -> bool {
    let addr = IpAddr::V4(ip);
    let timeout = Duration::from_millis(timeout_ms);
    tokio::task::spawn_blocking(move || {
        let options = ping_rs::PingOptions { ttl: 128, dont_fragment: true };
        ping_rs::send_ping(&addr, timeout, &[1, 2, 3, 4], Some(&options)).is_ok()
    }).await.unwrap_or(false)
}

async fn resolve_hostname_async(ip: Ipv4Addr) -> Option<String> {
    let addr = IpAddr::V4(ip);
    tokio::task::spawn_blocking(move || {
        dns_lookup::lookup_addr(&addr).ok()
            .map(|name| name.trim().trim_end_matches('.').to_string())
            .filter(|s| !s.is_empty())
    }).await.unwrap_or(None)
}

pub async fn scan_subnet(app: AppHandle, network_base: Ipv4Addr, prefix: u8, config: ScanConfig) {
    let network = u32::from_be_bytes(network_base.octets()) & (if prefix == 0 { 0 } else { u32::MAX << (32 - prefix) });
    let broadcast = network | !(if prefix == 0 { 0 } else { u32::MAX << (32 - prefix) });
    
    let semaphore = Arc::new(Semaphore::new(config.max_parallel_tasks as usize));
    let mut tasks = Vec::new();

    for ip_u32 in (network + 1)..broadcast {
        let ip = Ipv4Addr::from(ip_u32.to_be_bytes());
        let app_handle = app.clone();
        let sem = semaphore.clone();
        let conf = config.clone();

        let task = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            if ping_host_async(ip, conf.ping_timeout_ms).await {
                let hostname = if conf.mdns_lookup_enabled {
                    resolve_hostname_async(ip).await
                } else {
                    None
                };

                let _ = app_handle.emit("device-discovered", Device {
                    ip: ip.to_string(),
                    hostname: hostname.or(Some(ip.to_string())),
                    status: "online".to_string(),
                });
            } else if conf.show_offline_devices {
                let _ = app_handle.emit("device-discovered", Device {
                    ip: ip.to_string(),
                    hostname: None,
                    status: "offline".to_string(),
                });
            }
        });
        tasks.push(task);
    }

    for t in tasks { let _ = t.await; }
    let _ = app.emit("scan-finished", ());
}