// lovelace-galaxy-compact-editor.js
// Loaded automatically via dynamic import() in lovelace-galaxy-compact.js.
// Do not register as a separate Lovelace resource.

class GalaxyGroupCompactEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config  = {};
    this._hass    = null;
  }

  setConfig(config) {
    // Spread full incoming config first so type and other HA fields are preserved.
    this._config = {
      ...config,
      name:          config.name          || 'Alarm',
      entity:        config.entity        || '',
      base_topic:    config.base_topic    || 'galaxy',
      allow_part:    config.allow_part    !== false,
      allow_night:   config.allow_night   || false,
      allow_force:   config.allow_force   || false,
      code:          config.code          || '',
    };
    this._render();
  }

  set hass(hass) {
    const firstSet = !this._hass;
    this._hass = hass;
    if (firstSet) {
      this._render();
    } else {
      this._updateDerived();
    }
  }

  _fire(config) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _derived() {
    const cfg    = this._config;
    if (!cfg.entity) return null;
    const name = cfg.entity.replace(/^[^.]+\./, '');
    let uniqueId, group;

    const m = name.match(/^group_([^_]+(?:_[^_]+)*)_([^_]+)_state$/);
    if (m) { uniqueId = m[1]; group = m[2].toUpperCase(); }

    if (!uniqueId || !group) return null;
    const base = (cfg.base_topic || 'galaxy').replace(/\/+$/, '');
    return {
      group,
      alarm: cfg.entity.replace(/_state$/, '_alarm'),
      topic: `${base}/${uniqueId}/group/${group}/cmd/set`,
    };
  }

  _updateDerived() {
    const el = this.shadowRoot.getElementById('derived');
    if (!el) return;
    const d = this._derived();
    el.innerHTML = d
      ? `<span>📡 Group: <b>${d.group}</b></span>
         <span>🚨 Alarm entity: <b>${d.alarm}</b></span>
         <span>📤 MQTT topic: <b>${d.topic}</b></span>`
      : `<span class="warn">⚠ Select a valid Galaxy state entity above.</span>`;
  }

  // Set ha-switch checked state as a DOM property (not an HTML attribute).
  // ha-switch is a custom element — it reads the .checked property, not the attribute.
  _setSwitchProps() {
    const sr  = this.shadowRoot;
    const cfg = this._config;
    const pairs = [
      ['sw-part',   cfg.allow_part],
      ['sw-night',  cfg.allow_night],
      ['sw-force',  cfg.allow_force],
    ];
    pairs.forEach(([id, val]) => {
      const el = sr.getElementById(id);
      if (el) el.checked = !!val;
    });
  }

  _render() {
    const cfg    = this._config;

    let entityOpts = '<option value="">-- select entity --</option>';
    if (this._hass) {
      Object.keys(this._hass.states)
        .filter(k => k.startsWith('sensor.') && k.endsWith('_state'))
        .sort()
        .forEach(k => {
          const sel = k === cfg.entity ? 'selected' : '';
          entityOpts += `<option value="${k}" ${sel}>${k}</option>`;
        });
    }

    const d = this._derived();
    const derivedHtml = d
      ? `<span>📡 Group: <b>${d.group}</b></span>
         <span>🚨 Alarm entity: <b>${d.alarm}</b></span>
         <span>📤 MQTT topic: <b>${d.topic}</b></span>`
      : `<span class="warn">⚠ Select a valid Galaxy state entity above.</span>`;

    this.shadowRoot.innerHTML = `
<style>
  :host { display: block; font-size: 14px; }
  .row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .field-label {
    font-size: 11px; font-weight: 600; color: var(--secondary-text-color);
    text-transform: uppercase; letter-spacing: .05em; display: block;
  }
  input[type=text], select {
    width: 100%; height: 36px; padding: 0 10px;
    background: var(--secondary-background-color, #f5f5f5);
    border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px;
    color: var(--primary-text-color); font-family: inherit; font-size: 13px;
    box-sizing: border-box;
  }
  .sect {
    font-size: 11px; font-weight: 600; color: var(--secondary-text-color);
    text-transform: uppercase; letter-spacing: .05em;
    margin: 14px 0 8px; padding-bottom: 5px;
    border-bottom: 1px solid var(--divider-color, #e0e0e0);
  }
  .hint { font-size: 11px; color: var(--secondary-text-color); word-break: break-all; margin-bottom: 8px; }
  .derived {
    font-size: 11px; font-family: monospace;
    background: var(--primary-background-color);
    border-radius: 4px; padding: 4px 8px; margin: 4px 0 8px;
    color: var(--secondary-text-color);
  }
  .derived span { display: block; }
  .warn { color: var(--error-color, red); font-family: sans-serif; }
  .switches { display: flex; flex-direction: column; gap: 10px; margin: 6px 0; }
  .sw-row { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--primary-text-color); }
  .sw-row span { flex: 1; }
</style>

<div class="row">
  <span class="field-label">Name</span>
  <input type="text" id="name" value="${cfg.name}">
</div>

<div class="row">
  <span class="field-label">MQTT Base Topic</span>
  <input type="text" id="base_topic" value="${cfg.base_topic || 'galaxy'}" placeholder="galaxy">
</div>

<div class="row">
  <span class="field-label">Group State Entity</span>
  <select id="entity">${entityOpts}</select>
</div>

<div class="derived" id="derived">${derivedHtml}</div>

<div class="row">
  <span class="field-label">PIN Code (optional)</span>
  <input type="password" id="code" value="${cfg.code || ''}" placeholder="Leave empty to disable">
</div>

<div class="sect">Extra action chips</div>
<div class="switches">
  <div class="sw-row"><ha-switch id="sw-part"></ha-switch><span>Part set</span></div>
  <div class="sw-row"><ha-switch id="sw-night"></ha-switch><span>Night set</span></div>
  <div class="sw-row"><ha-switch id="sw-force"></ha-switch><span>Force set</span></div>
</div>`;

    // Set ha-switch checked state as DOM properties AFTER innerHTML is set,
    // because the elements must exist in the DOM before properties can be assigned.
    // Using innerHTML attributes like checked="true" does not work for custom elements.
    this._setSwitchProps();
    this._bindEvents();
  }

  _bindEvents() {
    const sr = this.shadowRoot;

    sr.getElementById('name').addEventListener('change', e => {
      this._config.name = e.target.value;
      this._fire({ ...this._config });
    });

    sr.getElementById('base_topic').addEventListener('change', e => {
      this._config.base_topic = e.target.value || 'galaxy';
      this._updateDerived();
      this._fire({ ...this._config });
    });

    // Entity: only update derived info, never re-render (keeps dropdown open)
    sr.getElementById('entity').addEventListener('change', e => {
      this._config.entity = e.target.value;
      this._updateDerived();
      this._fire({ ...this._config });
    });

    // Allow toggles: just fire, no re-render needed.
    // _setSwitchProps is NOT called here — the switch already shows the user's
    // intent visually, and setConfig (called by HA after the fire) will call
    // _render which sets props correctly.
    sr.getElementById('sw-part').addEventListener('change', e => {
      this._config.allow_part = e.target.checked;
      this._fire({ ...this._config });
    });

    sr.getElementById('sw-night').addEventListener('change', e => {
      this._config.allow_night = e.target.checked;
      this._fire({ ...this._config });
    });

    sr.getElementById('sw-force').addEventListener('change', e => {
      this._config.allow_force = e.target.checked;
      this._fire({ ...this._config });
    });

    const codeEl = sr.getElementById('code');
    if (codeEl) {
      // Only fire on 'change' (blur/enter) — firing on 'input' causes
      // _render() on every keystroke which destroys the field and loses focus.
      codeEl.addEventListener('change', e => {
        this._config.code = e.target.value;
        this._fire({ ...this._config });
      });
    }
  }
}

customElements.define('lovelace-group-compact-editor', GalaxyGroupCompactEditor);
