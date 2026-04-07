import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

type Device = {
  ip: string;
  name?: string;
  hostname?: string;
  status: "online" | "offline";
  latency?: number;
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
 * Kopierfunktion mit visuellem Feedback in der Konsole
 */
async function copyToClipboard(text: string) {
  try {
    await writeText(text);
    console.log("Kopiert: " + text);
  } catch (err) {
    console.error("Fehler beim Kopieren:", err);
  }
}

function getStatusBadge(device: Device): string {
  if (device.status === "offline") {
    return `<span class="status offline">Offline</span>`;
  }

  if (device.latency === undefined || device.latency === null) {
    return `<span class="status online"><span class="spinner" style="width:12px; height:12px; border-width:1px;"></span></span>`;
  }

  const ms = device.latency;
  let colorClass = "ping-low";

  if (ms >= 150) {
    colorClass = "ping-critical";
  } else if (ms >= 100) {
    colorClass = "ping-high";
  } else if (ms >= 50) {
    colorClass = "ping-medium";
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

/**
 * Details-Ansicht mit Kopier-Icons
 */
function renderDeviceDetails(device: Device) {
  const listEl = document.getElementById("device-list") as HTMLElement | null;
  if (!listEl) return;

  const copyIconSVG = `
    <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px; opacity: 0.5; cursor: pointer;">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;

  listEl.innerHTML = `
    <article class="device-card device-details-view">
      <div class="device-main">
        <h3 class="copy-trigger" data-text="${getDeviceLabel(device)}" style="display: flex; align-items: center; cursor: pointer;">
          ${getDeviceLabel(device)} ${copyIconSVG}
        </h3>
        <p class="device-ip copy-trigger" data-text="${device.ip}" style="display: flex; align-items: center; cursor: pointer; margin-top: 4px;">
          ${device.ip} ${copyIconSVG}
        </p>
        <div class="detail-info" style="margin-top: 20px;">
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
    
    // 1. Klick auf Kopier-Icons in Details
    const copyTrigger = target.closest(".copy-trigger") as HTMLElement | null;
    if (copyTrigger) {
      const text = copyTrigger.getAttribute("data-text");
      if (text) {
        void copyToClipboard(text);
        // Kleiner visueller Effekt beim Klick
        copyTrigger.style.opacity = "0.5";
        setTimeout(() => copyTrigger.style.opacity = "1", 100);
      }
      return; // Verhindert, dass die Karten-Logik feuert
    }

    // 2. Klick auf eine Geräte-Karte (für Details)
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
        
        <button class="scan-button" id="scan-button" type="button">Scan starten</button>
        
        <button id="close-details" class="close-btn" title="Zurück">←</button>
      </header>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 id="panel-title">Gefundene Geräte</h2>
            <p id="device-subtitle">Bereit. Kein Scan gestartet.</p>
          </div>
        </div>
        <div class="device-list" id="device-list"></div>
      </section>
    </main>
  `;

  attachGlobalEvents();
  renderDevices([]);
  void loadNetworkInfo();
});
