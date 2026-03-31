use std::net::{IpAddr, Ipv4Addr};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::commands::Device;
use crate::config::ScanConfig;

const PING_DATA: [u8; 4] = [1, 2, 3, 4];

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

fn ping_host(ip: Ipv4Addr, timeout_ms: u64) -> bool {
    let addr = IpAddr::V4(ip);
    let timeout = Duration::from_millis(timeout_ms);
    let options = ping_rs::PingOptions {
        ttl: 128,
        dont_fragment: true,
    };

    ping_rs::send_ping(&addr, timeout, &PING_DATA, Some(&options)).is_ok()
}

fn resolve_hostname(ip: Ipv4Addr) -> Option<String> {
    let addr = IpAddr::V4(ip);
    match dns_lookup::lookup_addr(&addr) {
        Ok(name) => {
            let trimmed = name.trim().trim_end_matches('.').to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }
        Err(_) => None,
    }
}

pub fn scan_subnet(network_base: Ipv4Addr, prefix: u8, config: &ScanConfig) -> Vec<Device> {
    let network = ipv4_to_u32(network_base) & subnet_mask(prefix);
    let broadcast = network | !subnet_mask(prefix);
    let start = network.saturating_add(1);
    let end = broadcast.saturating_sub(1);

    let worker_count = config.max_parallel_tasks.max(1);
    let timeout_ms = config.ping_timeout_ms;

    let (job_tx, job_rx) = mpsc::channel::<Ipv4Addr>();
    let (result_tx, result_rx) = mpsc::channel::<Option<Device>>();
    let shared_rx = Arc::new(Mutex::new(job_rx));

    let mut workers = Vec::new();

    for _ in 0..worker_count {
        let rx = Arc::clone(&shared_rx);
        let tx = result_tx.clone();

        let handle = thread::spawn(move || {
            loop {
                let ip = {
                    let receiver = rx.lock().unwrap();
                    match receiver.recv() {
                        Ok(ip) => ip,
                        Err(_) => break,
                    }
                };

                let result = if ping_host(ip, timeout_ms) {
                    let ip_str = ip.to_string();
                    let hostname = resolve_hostname(ip).or_else(|| Some(ip_str.clone()));

                    Some(Device {
                        ip: ip_str,
                        hostname,
                        status: "online".to_string(),
                    })
                } else {
                    None
                };

                let _ = tx.send(result);
            }
        });

        workers.push(handle);
    }

    drop(result_tx);

    let mut total_jobs = 0usize;
    for ip_u32 in start..=end {
        let host_ip = u32_to_ipv4(ip_u32);
        if job_tx.send(host_ip).is_ok() {
            total_jobs += 1;
        }
    }
    drop(job_tx);

    let mut devices = Vec::new();
    for _ in 0..total_jobs {
        if let Ok(Some(device)) = result_rx.recv() {
            devices.push(device);
        }
    }

    for worker in workers {
        let _ = worker.join();
    }

    devices.sort_by(|a, b| a.ip.cmp(&b.ip));
    devices
}