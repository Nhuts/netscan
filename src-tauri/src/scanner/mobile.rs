use std::net::Ipv4Addr;

use crate::commands::Device;
use crate::config::ScanConfig;

pub fn scan_subnet(_: Ipv4Addr, _: u8, _: &ScanConfig) -> Vec<Device> {
    vec![]
}