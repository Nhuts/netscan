import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

type Device = {
  ip: string;
  name?: string;
  hostname?: string;
  status: "online" | "offline";
};

type LocalNetworkInfo = {
  address: string | null;
  prefix: number | null;
  network_address: string | null;
  cidr: string | null;
};

let devices: Device[] = [];
//let _selectedDevice: Device | null = null;
let currentView: "list" | "details" = "list";
let isScanning = false;

// Wir speichern die Unlisten-Funktionen, um sie sauber aufzuräumen
let unlistenDiscovered: UnlistenFn | null = null;
let unlistenFinished: UnlistenFn | null = null;

function getDeviceLabel(device: Device): string {
  return device.name || device.hostname || device.ip;
}

// Hilfsfunktion zur numerischen Sortierung von IP-Adressen
function ipToNum(ip: string): number {
  return ip.split('.').map(Number).reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0;
}

function renderDevices(deviceList: Device[]) {
  const listEl = document.getElementById("device-list") as HTMLElement | null;
  if (!listEl) return;

  if (deviceList.length === 0 && !isScanning) {
    listEl.innerHTML = `
      <article class="device-card">
        <div class="device-main">
          <h3>Keine Geräte gefunden</h3>
          <p class="device-ip">Der Scan hat keine Einträge geliefert.</p>
        </div>
      </article>
    `;
    return;
  }

  listEl.innerHTML = deviceList
    .map(
      (device) => `
        <article class="device-card" data-ip="${device.ip}" tabindex="0" role="button" aria-label="Gerät ${getDeviceLabel(device)} öffnen">
          <div class="device-main">
            <h3>${getDeviceLabel(device)}</h3>
            <p class="device-ip">${device.ip}</p>
          </div>
          <div class="device-meta">
            <span class="status ${device.status}">${device.status}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderDeviceDetails(device: Device) {
  const listEl = document.getElementById("device-list") as HTMLElement | null;
  if (!listEl) return;

  listEl.innerHTML = `
    <article class="device-card device-details">
      <div class="device-main">
        <h3>${getDeviceLabel(device)}</h3>
        <p class="device-ip">${device.ip}</p>
        <p class="device-status">Status: <span class="status ${device.status}">${device.status}</span></p>
        <p class="device-note">Zusätzliche Infos.</p>
      </div>
      <div class="device-actions">
        <button class="scan-button" id="back-to-list" type="button" style="background: var(--panel-2); margin-top: 20px;">← Zurück zur Liste</button>
      </div>
    </article>
  `;
}

function setPanelTitle(text: string) {
  const titleEl = document.getElementById("panel-title");
  if (titleEl) titleEl.textContent = text;
}

function setSubtitle(text: string) {
  const subtitleEl = document.getElementById("device-subtitle");
  if (subtitleEl) subtitleEl.textContent = text;
}

function setScanButtonState() {
  const button = document.getElementById("scan-button") as HTMLButtonElement | null;
  if (!button) return;
  button.textContent = isScanning ? "Scan läuft..." : "Scan starten";
  button.disabled = isScanning; 
}

async function loadNetworkInfo() {
  const networkEl = document.getElementById("network-info") as HTMLElement | null;
  if (!networkEl) return;

  try {
    const result = await invoke<LocalNetworkInfo>("get_local_network_info");
    networkEl.textContent = result.cidr ?? result.address ?? "Netz unbekannt";
  } catch (error) {
    console.error("Netzwerkinfo Fehler:", error);
    networkEl.textContent = "Fehler";
  }
}

async function runScan() {
  if (isScanning) return;

  // Cleanup alter Listener, falls vorhanden
  if (unlistenDiscovered) unlistenDiscovered();
  if (unlistenFinished) unlistenFinished();

  isScanning = true;
  devices = [];
  //_selectedDevice = null;
  currentView = "list";
  
  renderDevices([]);
  setPanelTitle("Gefundene Geräte");
  setSubtitle("Suche läuft...");
  setScanButtonState();

  // 1. Listen for new devices (Live-Update)
  unlistenDiscovered = await listen<Device>("device-discovered", (event) => {
    const newDevice = event.payload;
    
    // Update oder Neu hinzufügen
    const existingIdx = devices.findIndex(d => d.ip === newDevice.ip);
    if (existingIdx > -1) {
      devices[existingIdx] = newDevice;
    } else {
      devices.push(newDevice);
    }

    // Sortieren nach IP
    devices.sort((a, b) => ipToNum(a.ip) - ipToNum(b.ip));

    if (currentView === "list") {
      renderDevices(devices);
      setSubtitle(`${devices.length} Geräte online`);
    }
  });

  // 2. Listen for finish signal
  unlistenFinished = await listen("scan-finished", () => {
    isScanning = false;
    setScanButtonState();
    setSubtitle(`Scan beendet. ${devices.length} Geräte gefunden.`);
  });

  try {
    // 3. Start the scan in Rust
    await invoke("scan_network");
  } catch (error) {
    console.error("Scan Fehler:", error);
    isScanning = false;
    setScanButtonState();
    setSubtitle("Scan fehlgeschlagen.");
  }
}

function attachGlobalEvents() {
  document.getElementById("scan-button")?.addEventListener("click", () => {
    void runScan();
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    
    // Klick auf Gerät
    const card = target.closest(".device-card[data-ip]") as HTMLElement | null;
    if (card && currentView === "list") {
      const ip = card.dataset.ip;
      const foundDevice = devices.find((d) => d.ip === ip);
      if (foundDevice) {
      //  _selectedDevice = foundDevice;
        currentView = "details";
        renderDeviceDetails(foundDevice);
        setPanelTitle("Gerätedetails");
      }
    }

    // Klick auf Zurück-Button
    if (target.id === "back-to-list") {
      currentView = "list";
      renderDevices(devices);
      setPanelTitle("Gefundene Geräte");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Lokales Netzwerk</p>
        </div>
        <div class="network-pill" id="network-info">--</div>
      </header>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 id="panel-title">Gefundene Geräte</h2>
            <p id="device-subtitle">Bereit. Kein Scan gestartet.</p>
          </div>
          <button class="scan-button" id="scan-button" type="button">Scan starten</button>
        </div>
        <div class="device-list" id="device-list"></div>
      </section>
    </main>
  `;

  attachGlobalEvents();
  renderDevices([]);
  void loadNetworkInfo();
});