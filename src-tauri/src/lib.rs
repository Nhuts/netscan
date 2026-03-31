use network_interface::{NetworkInterface, NetworkInterfaceConfig};
use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream, UdpSocket};
use std::time::Duration;

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
    pub status: String, // "online" | "offline"
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

fn network_address(ip: Ipv4Addr, prefix: u8) -> Ipv4Addr {
    let mask = if prefix == 0 {
        0u32
    } else {
        u32::MAX.wrapping_shl((32u32 - u32::from(prefix)))
    };
    u32_to_ipv4(ipv4_to_u32(ip) & mask)
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
                if ipv4 == &routed_ip && !ipv4.is_loopback() && !is_link_local(*ipv4) {
                    let prefix = addr.netmask().and_then(|mask| {
                        match mask {
                            IpAddr::V4(maskv4) => Some(
                                maskv4.octets()
                                    .iter()
                                    .map(|&b| (b as u32).count_ones() as u8)
                                    .sum::<u8>()
                            ),
                            _ => None,
                        }
                    }).unwrap_or(24);
                    return Some((*ipv4, prefix));
                }
            }
        }
    }
    Some(routed_ip, 24)
}

#[tauri::command]
pub fn get_local_network_info() -> LocalNetworkInfo {
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

#[cfg(target_os = "windows")]
fn scan_subnet(network_base: Ipv4Addr, prefix: u8) -> Vec<Device> {
    let base_u32 = ipv4_to_u32(network_base);
    let mask = if prefix == 0 { 0u32 } else { u32::MAX.wrapping_shl((32u32 - u32::from(prefix))) };
    let network = base_u32 & mask;
    let mut devices = Vec::new();

    let ports = [80u16, 443, 445];

    for i in 1..=254u8 {
        let host_ip = u32_to_ipv4(network | u32::from(i));
        let ip_str = host_ip.to_string();

        let mut hostname: Option<String> = None;
        let mut status = "offline".to_string();

        // TCP-Ping
        for &port in &ports {
            if let Ok(_) = TcpStream::connect_timeout(
                SocketAddr::new(IpAddr::V4(host_ip), port),
                Duration::from_millis(1500),
            ) {
                status = "online".to_string();
                break;
            }
        }

        // Hostname nur bei online
        if status == "online" {
            if let Ok(addrs) = format!("{}.80", ip_str).to_socket_addrs() {
                hostname = addrs
                    .next()
                    .and_then(|addr| addr.ip().to_string().split(':').next().map(|s| s.to_string()));
            }
        }

        devices.push(Device {
            ip: ip_str,
            hostname,
            status,
        });
    }

    devices
}

#[cfg(not(target_os = "windows"))]
fn scan_subnet(_: Ipv4Addr, _: u8) -> Vec<Device> {
    vec![
        Device { ip: "192.168.1.1".to_string(), hostname: Some("Router".to_string()), status: "online".to_string() },
        Device { ip: "192.168.1.23".to_string(), hostname: Some("Desktop".to_string()), status: "online".to_string() },
    ]
}

#[tauri::command]
pub fn scan_network() -> Vec<Device> {
    if let Some((net_ip, prefix)) = active_ipv4_with_prefix() {
        scan_subnet(net_ip, prefix)
    } else {
        vec![]
    }
}

#[cfg_attr(mobile, tauri::mobile_entrypoint)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_local_network_info, scan_network])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}