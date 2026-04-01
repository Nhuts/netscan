use network_interface::{NetworkInterface, NetworkInterfaceConfig};
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, UdpSocket};

use crate::config::{load_scan_config, ScanConfig};
use crate::scanner;

#[derive(Serialize, Clone)]
pub struct LocalNetworkInfo {
    pub address: Option<String>,
    pub prefix: Option<u8>,
    pub network_address: Option<String>,
    pub cidr: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct Device {
    pub ip: String,
    pub hostname: Option<String>,
    pub status: String,
}

#[cfg(target_os = "android")]
fn get_local_network_info_android() -> LocalNetworkInfo {
    // Versuche zuerst WLAN-Interface
    if let Some((ip, prefix)) = active_ipv4_with_prefix() {
        let net = network_address(ip, prefix);
        LocalNetworkInfo {
            address: Some(ip.to_string()),
            prefix: Some(prefix),
            network_address: Some(net.to_string()),
            cidr: Some(format!("{}/{}", net, prefix)),
        }
    } else if let Some(ip) = routed_local_ipv4() {
        let prefix = 24;
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

#[cfg(not(target_os = "android"))]
fn get_local_network_info_desktop() -> LocalNetworkInfo {
    if let Some((ip, prefix)) = active_ipv4_with_prefix() {
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

#[cfg(target_os = "android")]
fn scan_network_android(config: &ScanConfig) -> Vec<Device> {
    if let Some(ip) = routed_local_ipv4() {
        let prefix = 24;
        let net = network_address(ip, prefix);
        scanner::scan_subnet(net, prefix, config)
    } else {
        vec![]
    }
}

#[cfg(not(target_os = "android"))]
fn scan_network_desktop(config: &ScanConfig) -> Vec<Device> {
    if let Some((ip, prefix)) = active_ipv4_with_prefix() {
        let net = network_address(ip, prefix);
        scanner::scan_subnet(net, prefix, config)
    } else {
        vec![]
    }
}

#[tauri::command]
pub fn get_local_network_info() -> LocalNetworkInfo {
    #[cfg(target_os = "android")]
    return get_local_network_info_android();

    #[cfg(not(target_os = "android"))]
    return get_local_network_info_desktop();
}

#[tauri::command]
pub fn scan_network() -> Vec<Device> {
    let config = load_scan_config();

    #[cfg(target_os = "android")]
    return scan_network_android(&config);

    #[cfg(not(target_os = "android"))]
    return scan_network_desktop(&config);
}

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