import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

type Device = {
  ip: string;
  name?: string;
  hostname?: string;
  status: "online" | "offline";
  latency?: number; // Latenz vom Rust-Backend
};

type LocalNetworkInfo = {
  address: string | null;
  prefix: number | null;
  network_address: string | null;
  cidr: string | null;
};

let devices: Device[] = [];
let currentView: "list" | "details" = "list";
let isScanning = false;

let unlistenDiscovered: UnlistenFn | null = null;
let unlistenFinished: UnlistenFn | null = null;

function getDeviceLabel(device: Device): string {
  return device.name || device.hostname || device.ip;
}

/**
 * Erzeugt das Status-Badge mit Latenz-Farben oder Ladekringel
 */
function getStatusBadge(device: Device): string {
  if (device.status === "offline") {
    return `<span class="status offline">Offline</span>`;
  }

  // Falls online, aber noch kein Ping-Wert da ist (Ladekringel im Badge)
  if (device.latency === undefined || device.latency === null) {
    return `<span class="status online"><span class="spinner" style="width:12px; height:12px; border-width:1px;"></span></span>`;
  }

  const ms = device.latency;
  let colorClass = "ping-low"; // < 50ms (Grün)

  if (ms >= 150) {
    colorClass = "ping-critical"; // Rot
  } else if (ms >= 100) {
    colorClass = "ping-high"; // Orange
  } else if (ms >= 50) {
    colorClass = "ping-medium"; // Gelb
  }

  return `<span class="status online ${colorClass}">${ms} ms</span>`;
}

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
    .map((device) => `
        <article class="device-card" data-ip="${device.ip}" tabindex="0" role="button">
          <div class="device-main">
            <h3>${getDeviceLabel(device)}</h3>
            <p class="device-ip">${device.ip}</p>
          </div>
          <div class="device-meta">
            ${getStatusBadge(device)}
          </div>
        </article>
      `).join("");
}

function renderDeviceDetails(device: Device) {
  const listEl = document.getElementById("device-list") as HTMLElement | null;
  if (!listEl) return;

  listEl.innerHTML = `
    <article class="device-card device-details-view">
      <div class="device-main">
        <h3>${getDeviceLabel(device)}</h3>
        <p class="device-ip">${device.ip}</p>
        <div class="detail-info">
          <p><strong>Status:</strong> ${getStatusBadge(device)}</p>
          <p><strong>Hostname:</strong> ${device.hostname || 'Nicht verfügbar'}</p>
          <p class="device-note" style="margin-top: 15px; opacity: 0.7;">Gerät ist über das lokale Netzwerk erreichbar.</p>
        </div>
      </div>
    </article>
  `;
}

function updateUIState(view: "list" | "details", pushState: boolean = true) {
  currentView = view;
  const appShell = document.querySelector(".app-shell") as HTMLElement | null;
  if (appShell) {
    appShell.setAttribute("data-view", view);
  }

  if (view === "list") {
    setPanelTitle("Gefundene Geräte");
    renderDevices(devices);
  } else {
    setPanelTitle("Gerätedetails");
    if (pushState) {
      window.history.pushState({ view: "details" }, "");
    }
  }
}

function setPanelTitle(text: string) {
  const titleEl = document.getElementById("panel-title");
  if (titleEl) titleEl.textContent = text;
}

/**
 * Zeigt Text an, inkl. Spinner wenn ein Scan läuft
 */
function setSubtitle(text: string) {
  const subtitleEl = document.getElementById("device-subtitle");
  if (!subtitleEl) return;

  if (isScanning) {
    subtitleEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="spinner"></span>
        <span>${text}</span>
      </div>
    `;
  } else {
    subtitleEl.textContent = text;
  }
}

function setScanButtonState() {
  const button = document.getElementById("scan-button") as HTMLButtonElement | null;
  if (!button) return;
  button.textContent = isScanning ? "Läuft..." : "Scan starten";
  button.disabled = isScanning; 
}

async function loadNetworkInfo() {
  const networkEl = document.getElementById("network-info") as HTMLElement | null;
  if (!networkEl) return;
  try {
    const result = await invoke<LocalNetworkInfo>("get_local_network_info");
    networkEl.textContent = result.cidr ?? result.address ?? "Netz unbekannt";
  } catch (error) {
    networkEl.textContent = "Fehler";
  }
}

async function runScan() {
  if (isScanning) return;
  if (unlistenDiscovered) unlistenDiscovered();
  if (unlistenFinished) unlistenFinished();

  isScanning = true;
  devices = [];
  updateUIState("list");
  
  renderDevices([]);
  setSubtitle("Suche läuft...");
  setScanButtonState();

  unlistenDiscovered = await listen<Device>("device-discovered", (event) => {
    const newDevice = event.payload;
    const existingIdx = devices.findIndex(d => d.ip === newDevice.ip);
    if (existingIdx > -1) {
      devices[existingIdx] = newDevice;
    } else {
      devices.push(newDevice);
    }
    devices.sort((a, b) => ipToNum(a.ip) - ipToNum(b.ip));

    if (currentView === "list") {
      renderDevices(devices);
      setSubtitle(`${devices.length} Geräte gefunden`);
    }
  });

  unlistenFinished = await listen("scan-finished", () => {
    isScanning = false;
    setScanButtonState();
    setSubtitle(`Scan beendet. ${devices.length} gefunden.`);
  });

  await invoke("scan_network");
}

function attachGlobalEvents() {
  document.getElementById("scan-button")?.addEventListener("click", () => {
    void runScan();
  });

  document.getElementById("close-details")?.addEventListener("click", () => {
    if (currentView === "details") {
      window.history.back();
    }
  });

  window.addEventListener("popstate", () => {
    if (currentView === "details") {
      updateUIState("list", false);
    }
  });

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest(".device-card[data-ip]") as HTMLElement | null;
    
    if (card && currentView === "list") {
      const ip = card.dataset.ip;
      const foundDevice = devices.find((d) => d.ip === ip);
      if (foundDevice) {
        updateUIState("details");
        renderDeviceDetails(foundDevice);
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <main class="app-shell" data-view="list">
      <header class="topbar">
        <div>
          <p class="eyebrow">Lokales Netzwerk</p>
          <div class="network-pill" id="network-info">--</div>
        </div>
        <button id="close-details" class="close-btn" title="Zurück">←</button>
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