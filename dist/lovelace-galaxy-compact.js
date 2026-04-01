console.info(
  "%c  lovelace-galaxy-compact  \n%c Version 2.7.0",
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lovelace-galaxy-compact",
  name: "Galaxy Compact Row",
  description: "Compact mushroom-style row card for a Honeywell Galaxy group.",
  preview: true,
  documentationURL: "https://github.com/GalaxyGateway/lovelace-galaxy-groups",
});

// ─── parseEntityId ────────────────────────────────────────────────────────────
function parseEntityId(entityId, baseTopic) {
  if (!entityId) return null;
  const name = entityId.replace(/^[^.]+\./, "");
  let uniqueId, group;

  const m = name.match(/^group_([^_]+(?:_[^_]+)*)_([^_]+)_state$/);
  if (!m) return null;
  uniqueId = m[1]; group = m[2].toUpperCase();

  const base       = (baseTopic || "galaxy").replace(/\/+$/, "");
  const alarmEntity = entityId.replace(/_state$/, "_alarm");
  const mqttTopic   = base + "/" + uniqueId + "/group/" + group + "/cmd/set";
  return { uniqueId, group, alarmEntity, mqttTopic };
}

// ─── MDI icon names ───────────────────────────────────────────────────────────
const MDI = {
  warning:  "mdi:alert",
  shield_ok:"mdi:shield",
  home:     "mdi:shield-home",
  clock:    "mdi:clock-alert-outline",
  moon:     "mdi:shield-moon",
  bell:     "mdi:alarm-light-outline",
  bell_on:  "mdi:alarm-light",
  reset:    "mdi:lock-reset",
  lock:     "mdi:shield-lock",
  bolt:     "mdi:debug-step-over",
  shield_x: "mdi:shield-alert",
};

function mdiIcon(key, color, size) {
  const s = size || 22;
  return `<ha-icon icon="${MDI[key]}" style="color:${color};--mdc-icon-size:${s}px;display:flex;align-items:center;justify-content:center"></ha-icon>`;
}

// ─── Main card ────────────────────────────────────────────────────────────────
class GalaxyCompactCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config      = null;
    this._hass        = null;
    this._parsed      = null;
    this._pinBuffer   = "";
    this._pinPayload  = null;  // pending MQTT payload awaiting PIN confirm
    this._pinError    = false;
  }

  setConfig(config) {
    const baseTopic = (config.base_topic || "galaxy").replace(/\/+$/, "");
    const parsed = config.entity ? parseEntityId(config.entity, baseTopic) : null;
    this._parsed = parsed;
    this._config = {
      name:          "Alarm",
      base_topic:    "galaxy",
      allow_part:    true,
      allow_night:   false,
      allow_force:   false,
      code:          "",      // optional PIN — if set all actions require it
      ...config,
      entity_alarm: parsed ? parsed.alarmEntity : "",
    };
    this._render();
  }

  set hass(hass) {
    const cfg = this._config;
    if (!cfg) { this._hass = hass; return; }
    const oldHass = this._hass;
    this._hass = hass;
    if (!oldHass) { this._render(); return; }
    if (
      oldHass.states[cfg.entity]       !== hass.states[cfg.entity] ||
      oldHass.states[cfg.entity_alarm] !== hass.states[cfg.entity_alarm]
    ) {
      this._render();
    }
  }

  static async getConfigElement() {
    await import("./lovelace-galaxy-compact-editor.js");
    return document.createElement("lovelace-galaxy-compact-editor");
  }

  static getStubConfig() {
    return {
      name:          "Alarm",
      entity:        "",
      base_topic:    "galaxy",
      allow_part:    true,
      allow_night:   false,
      allow_force:   false,
      code:          "",
    };
  }

  // ── MQTT publish ─────────────────────────────────────────────────────────────
  _send(payload) {
    if (!this._parsed) return;
    this._hass.callService("mqtt", "publish", {
      topic:   this._parsed.mqttTopic,
      payload: String(payload),
      qos:     0,
      retain:  false,
    });
  }

  // ── Action triggered — show PIN or send directly ──────────────────────────
  _action(payload) {
    const code = (this._config.code || "").toString().trim();
    if (code) {
      this._pinPayload = payload;
      this._pinBuffer  = "";
      this._pinError   = false;
      this._showKeypad();
    } else {
      this._send(payload);
    }
  }

  // ── PIN keypad ────────────────────────────────────────────────────────────
  _showKeypad() {
    const sr = this.shadowRoot;
    const overlay = sr.getElementById("pin-overlay");
    if (overlay) { overlay.style.display = "flex"; this._updatePinDots(); }
  }

  _hideKeypad() {
    const overlay = this.shadowRoot.getElementById("pin-overlay");
    if (overlay) overlay.style.display = "none";
    this._pinBuffer  = "";
    this._pinPayload = null;
    this._pinError   = false;
  }

  _pinPress(k) {
    if (this._pinError) return;
    const code = (this._config.code || "").toString().trim();
    if (this._pinBuffer.length >= code.length) return;
    this._pinBuffer += k;
    this._updatePinDots();
    if (this._pinBuffer.length === code.length) {
      setTimeout(() => {
        if (this._pinBuffer === code) {
          this._send(this._pinPayload);
          this._hideKeypad();
        } else {
          this._pinError = true;
          this._updatePinDots();
          setTimeout(() => {
            this._pinBuffer  = "";
            this._pinError   = false;
            this._updatePinDots();
          }, 700);
        }
      }, 100);
    }
  }

  _pinBack() {
    if (this._pinError) return;
    this._pinBuffer = this._pinBuffer.slice(0, -1);
    this._updatePinDots();
  }

  _updatePinDots() {
    const sr   = this.shadowRoot;
    const wrap = sr.getElementById("pin-dots");
    if (!wrap) return;
    const code  = (this._config.code || "").toString().trim();
    const len   = code.length;
    const filled = this._pinBuffer.length;
    const err    = this._pinError;
    wrap.innerHTML = Array.from({ length: len }).map((_, i) => {
      const f = i < filled;
      const bg = err ? "#e05050" : (f ? "var(--primary-text-color)" : "transparent");
      const border = err ? "#e05050" : (f ? "var(--primary-text-color)" : "var(--divider-color, #888)");
      return `<div style="width:12px;height:12px;border-radius:50%;background:${bg};border:2px solid ${border};transition:all .15s"></div>`;
    }).join("");
  }

  // ── State info ───────────────────────────────────────────────────────────
  _stateInfo(ss) {
    const map = {
      "0":       { label: "Not ready",    pathKey: "warning",  color: "#f0a030" },
      "1":       { label: "Armed",        pathKey: "shield_ok",color: "#e05050" },
      "2":       { label: "Armed part",   pathKey: "home",     color: "#e05050" },
      "3":       { label: "Ready to arm", pathKey: "shield_ok",color: "#40b060" },
      "4":       { label: "Time locked",  pathKey: "clock",    color: "#e0c030" },
      "5":       { label: "Armed night",  pathKey: "moon",     color: "#e05050" },
      "unknown": { label: "Ready to arm", pathKey: "shield_ok",color: "#40b060" },
    };
    return map[ss] || { label: ss, pathKey: "shield_ok", color: "#888" };
  }

  _alarmInfo(as) {
    const map = {
      "0":       { pathKey: "bell",    color: "#40b060", blink: false, label: "Normal"         },
      "1":       { pathKey: "bell_on", color: "#e05050", blink: false, label: "Alarm!"         },
      "2":       { pathKey: "warning", color: "#f0a030", blink: true,  label: "Reset required" },
      "unknown": { pathKey: "bell",    color: "#40b060", blink: false, label: "Normal"         },
    };
    return map[as] || map["unknown"];
  }

  // ── Render ────────────────────────────────────────────────────────────────
  _render() {
    if (!this._config) return;
    const sr  = this.shadowRoot;
    const cfg = this._config;

    if (!this._hass) {
      sr.innerHTML = `<ha-card><div style="padding:16px;font-size:12px">Waiting for hass...</div></ha-card>`;
      return;
    }

    const stateObj = this._hass.states[cfg.entity];
    const alarmObj = this._hass.states[cfg.entity_alarm];

    if (!stateObj || !alarmObj) {
      sr.innerHTML = `
        <style>:host{display:block}ha-card{height:56px;display:flex;align-items:center;padding:0 16px;box-sizing:border-box;font-size:13px;color:var(--secondary-text-color)}</style>
        <ha-card>${cfg.entity ? "Entity unavailable" : "No entity configured"}</ha-card>`;
      return;
    }

    const ss = stateObj.state;
    const as = alarmObj.state;
    const si = this._stateInfo(ss);
    const ai = this._alarmInfo(as);

    const isReady     = ss === "3" || ss === "unknown";
    const isArmed     = ss === "1" || ss === "2" || ss === "5";
    const alarmOk     = as === "0" || as === "unknown";
    const resetNeeded = as === "1" || as === "2";

    const chipBtn = (payload, title, iconKey, color) =>
      `<button class="chip" data-payload="${payload}" title="${title}">${mdiIcon(iconKey, color, 26)}</button>`;

    const chipSpan = (title, iconKey, color, blink) =>
      `<span class="${blink ? "blink" : ""}" title="${title}">${mdiIcon(iconKey, color, 26)}</span>`;

    let chipsHtml = "";
    if (ss === "0" && cfg.allow_force)     chipsHtml += chipBtn("5", "Force set", "bolt",      "#5b9bd5");
    if (isArmed)                            chipsHtml += chipBtn("0", "Unset",     "shield_x",  "#5b9bd5");
    if (isReady && alarmOk)                 chipsHtml += chipBtn("1", "Full set",  "shield_ok", "#5b9bd5");
    if (isReady && alarmOk && cfg.allow_part)  chipsHtml += chipBtn("2", "Part set",  "home",  "#5b9bd5");
    if (isReady && alarmOk && cfg.allow_night) chipsHtml += chipBtn("6", "Night set", "moon",  "#5b9bd5");
    if (ss === "4")                         chipsHtml += chipSpan("Time locked", "lock",   "#e05050", false);
    if (resetNeeded)                        chipsHtml += chipBtn("3", "Reset",     "reset",     "#e0c030");
    chipsHtml += chipSpan(ai.label, ai.pathKey, ai.color, ai.blink);

    const tints = {
      "#40b060": "rgba(64,176,96,.15)", "#e05050": "rgba(224,80,80,.15)",
      "#f0a030": "rgba(240,160,48,.15)", "#e0c030": "rgba(224,192,48,.15)",
      "#888":    "rgba(128,128,128,.15)"
    };
    const tint = tints[si.color] || "rgba(128,128,128,.15)";

    // PIN keypad — only rendered if code is set
    const code    = (cfg.code || "").toString().trim();
    const pinLen  = code.length;
    // Keypad is rendered OUTSIDE ha-card as a sibling, positioned fixed
    // so it escapes the card's overflow:hidden and height:56px constraint.
    const keypad  = code ? `
      <div id="pin-overlay" style="
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,.55);
        z-index:999;flex-direction:column;align-items:center;justify-content:center;">
        <div style="
          background:var(--ha-card-background,var(--card-background-color,#1c1c1e));
          border-radius:16px;padding:18px 16px 14px;width:240px;
          display:flex;flex-direction:column;align-items:center;gap:12px;
          box-shadow:0 8px 32px rgba(0,0,0,.4);">
          <div style="font-size:13px;font-weight:500;color:var(--primary-text-color)">${cfg.name}</div>
          <div style="font-size:11px;color:var(--secondary-text-color);font-family:monospace;word-break:break-all;text-align:center">${this._parsed ? this._parsed.mqttTopic : ""}</div>
          <div style="font-size:12px;color:var(--secondary-text-color)">Enter PIN</div>
          <div id="pin-dots" style="display:flex;gap:10px;min-height:16px"></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:100%">
            ${["1","2","3","4","5","6","7","8","9","*","0","⌫"].map(k => `
              <button class="pkey" data-key="${k}" style="
                background:var(--secondary-background-color,#2c2c30);
                border:none;border-radius:10px;padding:12px 6px;
                color:var(--primary-text-color);font-family:inherit;
                font-size:18px;cursor:pointer;display:flex;
                flex-direction:column;align-items:center;gap:1px;">
                ${k}
                <span style="font-size:8px;color:var(--secondary-text-color);height:10px">
                  ${{ "2":"ABC","3":"DEF","4":"GHI","5":"JKL","6":"MNO","7":"PQRS","8":"TUV","9":"WXYZ","0":"+" }[k] || ""}
                </span>
              </button>`).join("")}
          </div>
          <button id="pin-cancel" style="
            background:none;border:none;color:var(--secondary-text-color);
            font-size:12px;cursor:pointer;padding:4px 12px;border-radius:8px;">
            Cancel
          </button>
        </div>
      </div>` : "";

    sr.innerHTML = `
<style>
  :host { display: block; }
  ha-card {
    height: 56px; overflow: hidden;
    display: flex; align-items: center;
    padding: 0; box-sizing: border-box;
  }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 0 8px 0 12px; height: 100%;
  }
  .left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .state-icon {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .text { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.2; }
  .name { font-size: 16px; font-weight: 400; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .state { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chips { display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: 8px; margin-right: 10px; }
  .chip {
    display:inline-flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:50%;border:none;
    background:transparent;cursor:pointer;padding:0;flex-shrink:0;
    transition: transform .15s;
  }
  .chip:hover { transform: scale(1.2); }
  .chip:active { transform: scale(1.05); }
  .pkey:hover { opacity: .8; }
  .pkey:active { transform: scale(.93); }
  @keyframes blink { 0%,100%{opacity:0} 50%{opacity:1} }
  .blink { animation: blink 2s linear infinite; }
</style>
${keypad}
<ha-card>
  <div class="row">
    <div class="left">
      <div class="state-icon" style="background:${tint}">${mdiIcon(si.pathKey, si.color, 22)}</div>
      <div class="text">
        <span class="name">${cfg.name}</span>
        <span class="state">${si.label}</span>
      </div>
    </div>
    <div class="chips">${chipsHtml}</div>
  </div>
</ha-card>`;

    // Bind chip clicks
    sr.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._action(btn.getAttribute("data-payload"));
      });
    });

    // Bind keypad keys
    if (code) {
      sr.querySelectorAll(".pkey").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const k = btn.getAttribute("data-key");
          if (k === "⌫") this._pinBack();
          else this._pinPress(k);
        });
      });
      sr.getElementById("pin-cancel").addEventListener("click", (e) => {
        e.stopPropagation();
        this._hideKeypad();
      });
      // Restore keypad state if it was open before re-render
      if (this._pinPayload !== null) {
        this._showKeypad();
      }
    }
  }

  getCardSize() { return 1; }
}

customElements.define("lovelace-galaxy-compact", GalaxyCompactCard);