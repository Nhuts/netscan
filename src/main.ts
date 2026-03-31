import { invoke } from "@tauri-apps/api/core";

type Device = {
  ip: string;
  name: string;
  status: "online" | "offline";
};

type LocalNetworkInfo = {
  address: string | null;
  prefix: number | null;
  network_address: string | null;
  cidr: string | null;
};

// UI-State
let devices: Device[] = [];
let selectedDevice: Device | null = null;
let currentView: "list" | "details" = "list";

function renderDevices(devices: Device[]) {
  const listEl = document.getElementById("device-list") as HTMLElement;
  if (!listEl) return;

  if (devices.length === 0) {
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

  listEl.innerHTML = devices
    .map(
      (device) => `
        <article class="device-card" data-ip="${device.ip}" tabindex="0">
          <div class="device-main">
            <h3>${device.name || device.ip}</h3>
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
  const listEl = document.getElementById("device-list") as HTMLElement;
  if (!listEl) return;

  listEl.innerHTML = `
    <article class="device-card device-details">
      <div class="device-main">
        <h3>${device.name || device.ip}</h3>
        <p class="device-ip">${device.ip}</p>
        <p class="device-status">Status: <span class="status ${device.status}">${device.status}</span></p>
        <p class="device-note">MAC-Adresse und offene Ports kommen in V2.</p>
      </div>
      <div class="device-actions">
        <button class="back-button" id="back-to-list">← Zurück zur Liste</button>
      </div>
    </article>
  `;
}

async function loadNetworkInfo() {
  const networkEl = document.getElementById("network-info") as HTMLElement;
  if (!networkEl) return;

  try {
    const result = await invoke<LocalNetworkInfo>("get_local_network_info");
    networkEl.textContent = result.cidr ?? "Netz unbekannt";
  } catch (error) {
    console.error("Netzwerkinfo Fehler:", error);
    networkEl.textContent = "Fehler beim Laden";
  }
}

async function runScan() {
  const button = document.getElementById("scan-button") as HTMLButtonElement | null;
  const subtitle = document.getElementById("device-subtitle") as HTMLElement | null;

  if (button) {
    button.disabled = true;
    button.textContent = "Scanne...";
  }

  if (subtitle) {
    subtitle.textContent = "Backend-Daten werden geladen...";
  }

  try {
    const newDevices = await invoke<Device[]>("scan_network");
    devices = newDevices;
    selectedDevice = null;
    currentView = "list";
    renderDevices(devices);

    if (subtitle) {
      subtitle.textContent = `${devices.length} Gerät(e) geladen.`;
    }
  } catch (error) {
    console.error("Scan Fehler:", error);
    renderDevices([]);

    if (subtitle) {
      subtitle.textContent = "Scan fehlgeschlagen.";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Scan neu starten";
    }
  }
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
            <p id="device-subtitle">Noch kein Scan gestartet.</p>
          </div>
          <button class="scan-button" id="scan-button" type="button">Scan starten</button>
        </div>

        <div class="device-list" id="device-list"></div>
      </section>
    </main>
  `;

  const scanButton = document.getElementById("scan-button");
  scanButton?.addEventListener("click", () => {
    void runScan();
  });

  // Anklickbare Geräte
  document.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".device-card[data-ip]");
    if (card && currentView === "list") {
      const ip = card.dataset.ip!;
      selectedDevice = devices.find(d => d.ip === ip)!;
      currentView = "details";
      renderDeviceDetails(selectedDevice);
      document.getElementById("panel-title")!.textContent = "Gerätedetails";
    }
  });

  // Zurück-Button
  document.addEventListener("click", (e) => {
    const backButton = (e.target as HTMLElement).closest("#back-to-list");
    if (backButton) {
      currentView = "list";
      renderDevices(devices);
      document.getElementById("panel-title")!.textContent = "Gefundene Geräte";
    }
  });

  void loadNetworkInfo();
  void runScan();
});