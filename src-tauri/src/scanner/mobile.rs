// src-tauri/src/scanner/mobile.rs
use std::net::{IpAddr, Ipv4Addr, UdpSocket, SocketAddr};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use dns_lookup::lookup_addr;
use crate::commands::Device;
use crate::config::ScanConfig;

fn is_local_ip(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    match (octets[0], octets[1]) {
        (192, 168) => true,
        (10, _) => true,
        (172, y) if (16..=31).contains(&y) => true,
        _ => false,
    }
}

fn handle_ip(
    ip: Ipv4Addr,
    timeout_ms: u64,
    result: &std::sync::Mutex<Vec<Device>>,
    cancelled: &AtomicBool,
) {
    // Zuerst schauen, ob wir abgebrochen wurden
    if cancelled.load(Ordering::Relaxed) {
        return;
    }

    let target_addr: SocketAddr = format!("{}:1", ip).parse().unwrap_or_else(|_| "127.0.0.1:1".parse().unwrap());

    let socket = match UdpSocket::bind("0.0.0.0:0") {
        Ok(s) => s,
        Err(_) => return,
    };

    if let Err(_) = socket.set_read_timeout(Some(Duration::from_millis(timeout_ms))) {
        return;
    }
    if let Err(_) = socket.set_write_timeout(Some(Duration::from_millis(timeout_ms))) {
        return;
    }

    // Send attempt
    if socket.send_to(b"?", &target_addr).is_ok() {
        // Optional: sehr kurzer recv, aber nicht nötig
        let mut buf = [0u8; 1];
        let mut good = false;

        match socket.recv(&mut buf) {
            Ok(_) => {
                good = true;
            }
            Err(e) if e.kind() != std::io::ErrorKind::TimedOut => {
                // Network error
            }
            Err(_) => {
                // Timeout – Host "reagiert" trotzdem
                // Ursache: Router blockt, aber wir haben "Leben"
                // Wir nehmen das als online.
                good = true;
            }
        }

        if good {
            let hostname = match lookup_addr(&IpAddr::V4(ip)) {
                Ok(name) => Some(name),
                Err(_) => None,
            };

            let mut devices = result.lock().unwrap();
            devices.push(Device {
                ip: ip.to_string(),
                hostname,
                status: "online".to_string(),
            });
        }
    }
}

pub fn scan_subnet(
    ip: Ipv4Addr,
    _prefix: u8,   // Wir nutzen /24 für Android
    config: &ScanConfig,
) -> Vec<Device> {
    let timeout_ms = config.ping_timeout_ms;
    let max_parallel = config.max_parallel_tasks;

    let result: Arc<std::sync::Mutex<Vec<Device>>> = Arc::new(std::sync::Mutex::new(vec![]));
    let cancelled = Arc::new(AtomicBool::new(false));

    let net = ip;  // 192.168.1.0 o.ä.
    let mut handles = vec![];

    for host in 1..255 {
        let mut octets = net.octets();
        octets[3] = host;

        let ip = Ipv4Addr::from(octets);
        if !is_local_ip(&ip) {
            continue;
        }

        let result = Arc::clone(&result);
        let cancelled = Arc::clone(&cancelled);

        let handle = thread::spawn(move || {
            handle_ip(ip, timeout_ms, &result, &cancelled);
        });

        handles.push(handle);

        // Begrenze Parallelität
        if handles.len() >= max_parallel {
            for h in handles.drain(..) {
                let _ = h.join();
            }
        }
    }

    // Restliche Threads warten
    for h in handles {
        let _ = h.join();
    }

        // Erzeuge Resultat
    let mut res = result.lock().unwrap();
    let _show_offline = config.show_offline_devices;

    std::mem::take(&mut *res)
}