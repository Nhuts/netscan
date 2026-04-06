Privacy Policy for NetScan

Last Updated: April 7, 2026

This Privacy Policy describes how NetScan ("the Application") handles data. NetScan is a local network diagnostic tool designed to provide users with an overview of devices within their own private network infrastructure.
1. Core Principle: Privacy by Design

NetScan is designed to operate as a local-only tool.

    No Data Collection: The Application does not collect, store, or transmit any personal data to external servers.

    No Cloud Dependency: All network analysis and processing are performed locally on the user's device.

    No Third-Party Analytics: The Application does not contain any tracking libraries, advertisements, or third-party telemetry.

2. Permissions and Data Usage

To provide its core functionality, the Application requires specific system permissions. These are used exclusively for local network discovery:
2.1 Network Information

The Application accesses local network details (IP address, Subnet Mask, and SSID) to determine the boundaries of the network scan. This data is processed in volatile memory and is never exported.
2.2 Location Services (Android Only)

On Android devices, the Application requires ACCESS_FINE_LOCATION permissions.

    Technical Necessity: Android OS architecture mandates this permission to allow applications to access Wi-Fi metadata (such as the SSID).

    Usage: The Application does not access GPS coordinates or track the user’s physical location. It utilizes this permission solely to identify the local network environment.

2.3 Hardware Identifiers (MAC Addresses)

The Application may attempt to resolve MAC addresses to identify device manufacturers (OUI lookup).

    Desktop Versions: Performed via local ARP table requests.

    Mobile Versions: Subject to OS-level sandboxing. Hardware identifiers are used only for local display and are not used for persistent tracking or user profiling.

3. Data Storage

The Application may store user-defined configurations (such as scan intervals or custom device labels) in a local configuration file (scan-config.json). This file remains on the user's local file system and is not synchronized with any cloud services.
4. Transparency

As an open-source project, the source code of NetScan is available for public audit. Users are encouraged to review the implementation of network commands in the src-tauri directory to verify data handling practices.
5. Contact

For questions regarding this Privacy Policy or the technical implementation of network scans, please open an issue in the GitHub repository.