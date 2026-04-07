NetScan Tauri

A lightweight, cross-platform local network scanner built with Tauri v2, Rust, and TypeScript. This tool is designed for network discovery on Windows and Android environments.

Project Status and Disclaimer

Please note the following conditions before using or contributing to this software:

    Initial Project: This is a personal project. The codebase is a result of a learning process and tries to but may not align with established professional software engineering standards.

    No Maintenance/Support: Due to significant time constraints, I am unable to provide fast technical support, issue resolution, or feature updates. The project is provided as a reference for others.

    Liability: This software is provided "as-is." The developer assumes no responsibility for any damages, data loss, or network disruptions caused by the use of this tool.

Technical Overview

    Core: Rust-based scanning engine utilizing tokio for asynchronous task management and ping-rs for ICMP/UDP probing.

    Communication: Real-time event-based architecture (Rust-to-Frontend) to ensure a responsive UI during active scans.

    Configuration: Parameters such as parallel task limits, ping timeouts, and visibility settings are managed via a local scan-config.json file.

Platform-Specific Requirements

Android

For successful operation on Android devices, ensure that:

    The device is connected to a local Wi-Fi network.

    VPN-based applications (e.g., AdGuard, NetGuard, or active VPN tunnels) are disabled, as these intercept network interfaces and may prevent the scanner from identifying the correct local subnet.


    The Android version of NetScan requires specific configurations to function correctly within the Android security sandbox (Android 10 and above).

    Required Permissions

    To perform network discovery, the following permissions must be granted:
    ACCESS_FINE_LOCATION: Required by Android to access Wi-Fi metadata (SSID and Gateway information). Without this, the application cannot identify the local subnet.
    ACCESS_WIFI_STATE: Required to monitor the connection status.

    System-wide Location Services (GPS) must be enabled on the device during the scan. This is a technical requirement imposed by the Android OS for all network-scanning activities; the application itself does not track or store geographic coordinates.

    Technical Limitations

    NetScan is designed as a lightweight diagnostic tool for private home networks. The following constraints reflect the project's focus on privacy and local-only operation:

    Hardware Identifiers (MAC Addresses): In alignment with modern mobile privacy standards (Android 10+), the application does not prioritize the collection of persistent hardware identifiers. On Android, MAC address resolution is restricted by the OS to prevent device tracking.
    Data Minimization: Detailed OS fingerprinting and invasive hardware analysis are intentionally excluded from the project scope to maintain a non-intrusive footprint within the local network.
    Network Environment: The application is intended for personal use in trusted private networks. In public or managed enterprise environments, "Client Isolation" policies may intentionally prevent the discovery of other network participants.




Windows

    Tested on Windows 11. Standard administrative permissions may be required for certain network operations depending on the system configuration.

Licensing

This project is licensed under the MIT License.

Summary of the MIT License:
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the software.

    The software is provided "as is", without warranty of any kind, express or implied. In no event shall the authors or copyright holders be liable for any claim, damages or other liability.

Contributions

As active support is not available, users are encouraged to:

    Fork the repository for individual requirements.

    Submit Pull Requests for bug fixes (though review times may vary).

    Utilize the source code for educational purposes regarding Tauri mobile development.

---
### Support this Project
If you find this useful in any way, consider to Buy me a Coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-orange.svg?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/sk.edv)