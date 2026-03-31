import { invoke } from "@tauri-apps/api/core";

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
let selectedDevice: Device | null = null;
let currentView: "list" | "details" = "list";
let isScanning = false;
let scanRunId = 0;

function getDeviceLabel(device: Device): string {
  return device.name || device.hostname || device.ip;
}

function renderDevices(deviceList: Device[]) {
  const listEl = document.getElementById("device-list") as HTMLElement | null;
  if (!listEl) return;

  if (deviceList.length === 0) {
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
        <p class="device-note">MAC-Adresse und offene Ports kommen in V2.</p>
      </div>
      <div class="device-actions">
        <button class="back-button" id="back-to-list" type="button">← Zurück zur Liste</button>
      </div>
    </article>
  `;
}

function setPanelTitle(text: string) {
  const titleEl = document.getElementById("panel-title");
  if (titleEl) {
    titleEl.textContent = text;
  }
}

function setSubtitle(text: string) {
  const subtitleEl = document.getElementById("device-subtitle");
  if (subtitleEl) {
    subtitleEl.textContent = text;
  }
}

function setScanButtonState() {
  const button = document.getElementById("scan-button") as HTMLButtonElement | null;
  if (!button) return;

  button.disabled = false;
  button.textContent = isScanning ? "Scan abbrechen" : "Scan starten";
  button.setAttribute("aria-label", isScanning ? "Laufenden Scan abbrechen" : "Netzwerkscan starten");
}

function showReadyState() {
  setSubtitle("Bereit. Kein Scan gestartet.");
  setScanButtonState();
}

function showScanningState() {
  setSubtitle("Scan läuft …");
  setScanButtonState();
}

function showFinishedState(count: number) {
  setSubtitle(`${count} Gerät(e) geladen.`);
  setScanButtonState();
}

function showAbortedState() {
  setSubtitle("Scan abgebrochen.");
  setScanButtonState();
}

function showFailedState() {
  setSubtitle("Scan fehlgeschlagen.");
  setScanButtonState();
}

async function loadNetworkInfo() {
  const networkEl = document.getElementById("network-info") as HTMLElement | null;
  if (!networkEl) return;

  networkEl.textContent = "Lade Netzinfo …";

  try {
    const result = await invoke<LocalNetworkInfo>("get_local_network_info");
    networkEl.textContent = result.cidr ?? result.address ?? "Netz unbekannt";
  } catch (error) {
    console.error("Netzwerkinfo Fehler:", error);
    networkEl.textContent = "Fehler beim Laden";
  }
}

async function runScan() {
  if (isScanning) {
    scanRunId += 1;
    isScanning = false;
    showAbortedState();
    return;
  }

  isScanning = true;
  scanRunId += 1;
  const currentRunId = scanRunId;

  selectedDevice = null;
  currentView = "list";
  setPanelTitle("Gefundene Geräte");
  showScanningState();

  try {
    const newDevices = await invoke<Device[]>("scan_network");

    if (currentRunId !== scanRunId) {
      return;
    }

    devices = newDevices;
    renderDevices(devices);
    showFinishedState(devices.length);
  } catch (error) {
    if (currentRunId !== scanRunId) {
      return;
    }

    console.error("Scan Fehler:", error);
    renderDevices([]);
    showFailedState();
  } finally {
    if (currentRunId === scanRunId) {
      isScanning = false;
      setScanButtonState();
    }
  }
}

function attachGlobalEvents() {
  const scanButton = document.getElementById("scan-button");
  scanButton?.addEventListener("click", () => {
    void runScan();
  });

  document.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".device-card[data-ip]") as HTMLElement | null;
    if (card && currentView === "list") {
      const ip = card.dataset.ip;
      if (!ip) return;

      const foundDevice = devices.find((d) => d.ip === ip);
      if (!foundDevice) return;

      selectedDevice = foundDevice;
      currentView = "details";
      renderDeviceDetails(foundDevice);
      setPanelTitle("Gerätedetails");
    }
  });

  document.addEventListener("click", (e) => {
    const backButton = (e.target as HTMLElement).closest("#back-to-list");
    if (backButton) {
      currentView = "list";
      renderDevices(devices);
      setPanelTitle("Gefundene Geräte");
    }
  });

  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    const card = target?.closest(".device-card[data-ip]") as HTMLElement | null;

    if (!card || currentView !== "list") return;
    if (e.key !== "Enter" && e.key !== " ") return;

    e.preventDefault();

    const ip = card.dataset.ip;
    if (!ip) return;

    const foundDevice = devices.find((d) => d.ip === ip);
    if (!foundDevice) return;

    selectedDevice = foundDevice;
    currentView = "details";
    renderDeviceDetails(foundDevice);
    setPanelTitle("Gerätedetails");
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

        <div class="scan-status" id="scan-status" aria-live="polite"></div>
        <div class="device-list" id="device-list"></div>
      </section>
    </main>
  `;

  attachGlobalEvents();
  renderDevices([]);
  showReadyState();
  void loadNetworkInfo();
});