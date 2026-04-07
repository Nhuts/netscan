use network_interface::{NetworkInterface, NetworkInterfaceConfig};
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, UdpSocket};
use tauri::{command, AppHandle, Manager}; // Manager für Pfade, AppHandle für Events

use crate::config::load_scan_config;
use crate::scanner;

#[derive(Serialize, Clone)]
pub struct LocalNetworkInfo {
    pub address: Option<String>,
    pub prefix: Option<u8>,
    pub network_address: Option<String>,
    pub cidr: Option<String>,
}

#[derive(Serialize, Clone, Default)]
pub struct Device {
    pub ip: String,
    pub hostname: Option<String>,
    pub status: String,
    pub latency: u64,
}

// --- Hilfsfunktionen für die Netzwerkberechnung (unverändert) ---

fn is_link_local(ip: Ipv4Addr) -> bool {
    let octets = ip.octets();
    octets[0] == 169 && octets[1] == 254
}

fn ipv4_to_u32(ip: Ipv4Addr) -> u32 {
    u32::from_be_bytes(ip.octets())
}

fn u32_to_ipv4(value: u32) -> Ipv4Addr {
    Ipv4Addr::from(value.to_be_bytes())
}

fn subnet_mask(prefix: u8) -> u32 {
    if prefix == 0 {
        0
    } else {
        u32::MAX << (32 - u32::from(prefix))
    }
}

fn network_address(ip: Ipv4Addr, prefix: u8) -> Ipv4Addr {
    u32_to_ipv4(ipv4_to_u32(ip) & subnet_mask(prefix))
}

fn routed_local_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ipv4) if !ipv4.is_loopback() && !is_link_local(ipv4) => Some(ipv4),
        _ => None,
    }
}

fn active_ipv4_with_prefix() -> Option<(Ipv4Addr, u8)> {
    let routed_ip = routed_local_ipv4()?;
    let interfaces = NetworkInterface::show().unwrap_or_default();

    for iface in interfaces {
        for addr in iface.addr {
            if let IpAddr::V4(ipv4) = addr.ip() {
                if ipv4 == routed_ip && !ipv4.is_loopback() && !is_link_local(ipv4) {
                    let prefix = addr
                        .netmask()
                        .and_then(|mask| match mask {
                            IpAddr::V4(mask_v4) => Some(
                                mask_v4
                                    .octets()
                                    .iter()
                                    .map(|&b| b.count_ones() as u8)
                                    .sum::<u8>(),
                            ),
                            _ => None,
                        })
                        .unwrap_or(24);

                    return Some((ipv4, prefix));
                }
            }
        }
    }
    Some((routed_ip, 24))
}

// --- Plattformspezifische Info-Logik ---

fn get_local_network_info_internal() -> LocalNetworkInfo {
    let info = active_ipv4_with_prefix().or_else(|| routed_local_ipv4().map(|ip| (ip, 24)));

    if let Some((ip, prefix)) = info {
        let net = network_address(ip, prefix);
        LocalNetworkInfo {
            address: Some(ip.to_string()),
            prefix: Some(prefix),
            network_address: Some(net.to_string()),
            cidr: Some(format!("{}/{}", net, prefix)),
        }
    } else {
        LocalNetworkInfo {
            address: None,
            prefix: None,
            network_address: None,
            cidr: None,
        }
    }
}

// --- Die eigentlichen Tauri Commands ---

#[command]
pub fn get_local_network_info() -> LocalNetworkInfo {
    get_local_network_info_internal()
}

#[command]
pub async fn scan_network(app: AppHandle) {
    // 1. Config laden (braucht jetzt &app für den Pfad)
    let config = load_scan_config(&app);

    // 2. Netzwerk-Basis ermitteln
    let net_info = active_ipv4_with_prefix().or_else(|| {
        #[cfg(target_os = "android")]
        {
            routed_local_ipv4().map(|ip| (ip, 24))
        }
        #[cfg(not(target_os = "android"))]
        {
            None
        }
    });

    if let Some((ip, prefix)) = net_info {
        let net = network_address(ip, prefix);

        // 3. Den asynchronen Scan starten (in mod.rs/windows.rs definiert)
        // Wir übergeben app, damit der Scanner Events senden kann
        scanner::scan_subnet(app, net, prefix, config).await;
    }
}
