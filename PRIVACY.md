Privacy Policy for NetScan

Last Updated: April 7, 2026

This Privacy Policy describes how NetScan ("the Application") handles data. NetScan is a local network diagnostic tool designed to provide users with an overview of devices within their own private network infrastructure.
1. Core Principle: Privacy by Design

NetScan operates as a local-only tool.

    No Data Collection: The Application does not collect, store, or transmit any personal data to external servers.

    No Cloud Dependency: All network analysis and processing are performed locally on the user's device.

    No Third-Party Analytics: The Application does not contain tracking libraries, advertisements, or third-party telemetry.

2. Children’s Privacy

NetScan does not collect, transmit, or share any personal information or identifiers. It is compliant with children’s privacy regulations, including COPPA and GDPR. The Application is safe for use by all age groups as no data is harvested from the device.
3. Permissions and Data Usage

The Application requires specific system permissions exclusively for local network discovery:
3.1 Network Information

The Application accesses local network details (IP address, Subnet Mask, and SSID) to determine the boundaries of the network scan. This data is processed in volatile memory and is never exported or shared.
3.2 Location Services (Android Only)

On Android devices, the Application requires ACCESS_FINE_LOCATION permissions.

    Technical Necessity: Android OS architecture mandates this permission to allow applications to access Wi-Fi metadata (such as the SSID).

    Usage: The Application does not access GPS coordinates or track the user’s physical location. It utilizes this permission solely to identify the local network environment.

3.3 Hardware Identifiers (MAC Addresses)

The Application handles hardware identifiers differently based on the operating system:

    Desktop Versions: The Application resolves MAC addresses via local ARP table requests for the purpose of identifying device manufacturers.

    Android Version: The Application does not collect or resolve MAC addresses. Due to OS-level sandboxing and privacy standards, hardware identifiers are not accessed or processed on mobile devices.

4. Data Storage and Deletion

The Application stores user-defined configurations (such as scan intervals or custom device labels) in a local configuration file (scan-config.json).

    Local Only: This file remains on the user's local file system and is not synchronized with cloud services.

    Data Control: Users can delete all locally stored configuration data at any time by clearing the Application's cache/data in the Android system settings or by uninstalling the Application.

5. Transparency

As an open-source project, the source code of NetScan is available for public audit. The implementation of network commands in the src-tauri directory is open for verification of these data handling practices.
6. Contact

For questions regarding this Privacy Policy or the technical implementation of network scans, users can open an issue in the GitHub repository.
