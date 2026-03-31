use std::net::Ipv4Addr;

use crate::commands::Device;
use crate::config::ScanConfig;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "linux")]
mod linux;
#[cfg(any(target_os = "android", target_os = "ios"))]
mod mobile;

#[cfg(target_os = "windows")]
pub fn scan_subnet(network_base: Ipv4Addr, prefix: u8, config: &ScanConfig) -> Vec<Device> {
    windows::scan_subnet(network_base, prefix, config)
}

#[cfg(target_os = "linux")]
pub fn scan_subnet(network_base: Ipv4Addr, prefix: u8, config: &ScanConfig) -> Vec<Device> {
    linux::scan_subnet(network_base, prefix, config)
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn scan_subnet(network_base: Ipv4Addr, prefix: u8, config: &ScanConfig) -> Vec<Device> {
    mobile::scan_subnet(network_base, prefix, config)
}

#[cfg(not(any(
    target_os = "windows",
    target_os = "linux",
    target_os = "android",
    target_os = "ios"
)))]
pub fn scan_subnet(_: Ipv4Addr, _: u8, _: &ScanConfig) -> Vec<Device> {
    vec![]
}