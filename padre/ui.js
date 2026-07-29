class TranslationUI {
  constructor() {
    this._injectStyles();
    this._setupGlobalToggle();
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.id = 'padre-translator-styles';
    style.textContent = `
      [data-translated="pending"] {
        opacity: ${CONFIG.UI.TRANSLATION_PENDING_OPACITY};
        transition: opacity 0.2s ease;
      }
      [data-translated="true"] {
        position: relative;
        opacity: 1;
        transition: opacity 0.2s ease;
      }
      [data-translated="true"]::after {
        content: 'RU';
        position: absolute;
        top: -6px;
        right: -8px;
        font-size: 7px;
        font-weight: 700;
        background: ${CONFIG.UI.BADGE_COLOR};
        color: white;
        padding: 1px 3px;
        border-radius: 3px;
        opacity: 0.8;
        pointer-events: none;
        line-height: 1.2;
        letter-spacing: 0.5px;
        z-index: 10;
      }
      [data-translated="original"] {
        position: relative;
      }
      [data-translated="original"]::after {
        content: 'EN';
        position: absolute;
        top: -6px;
        right: -8px;
        font-size: 7px;
        font-weight: 700;
        background: #6b7280;
        color: white;
        padding: 1px 3px;
        border-radius: 3px;
        opacity: 0.8;
        pointer-events: none;
        line-height: 1.2;
        letter-spacing: 0.5px;
        z-index: 10;
      }
      [data-translated="failed"] {
        opacity: 1;
      }
      [data-translated="true"]:hover,
      [data-translated="original"]:hover {
        cursor: pointer;
        text-decoration-line: underline;
        text-decoration-style: dotted;
        text-decoration-color: ${CONFIG.UI.BADGE_COLOR};
        text-underline-offset: 3px;
      }
      .axiom-tx-panel {
        padding: 6px 10px;
        margin: 4px 0 0 0;
        border-top: 1px solid rgba(124, 58, 237, 0.2);
        font: inherit;
        line-height: inherit;
        color: inherit;
        cursor: pointer;
        position: relative;
      }
      .axiom-tx-panel[data-translated="true"]::after {
        content: 'RU';
        position: absolute;
        top: -6px;
        right: -4px;
        font-size: 7px;
        font-weight: 700;
        background: ${CONFIG.UI.BADGE_COLOR};
        color: white;
        padding: 1px 3px;
        border-radius: 3px;
        opacity: 0.8;
        pointer-events: none;
        line-height: 1.2;
        letter-spacing: 0.5px;
        z-index: 10;
      }
      .axiom-tx-panel:hover {
        text-decoration-line: underline;
        text-decoration-style: dotted;
        text-decoration-color: ${CONFIG.UI.BADGE_COLOR};
        text-underline-offset: 3px;
      }
    `;
    document.head.appendChild(style);
  }

  _setupGlobalToggle() {
    const self = this;
    const interactiveSelector = 'a[href], button, img, svg, video, input, select, textarea, [role="button"]';

    const getToggleTarget = (e) => {
      const el = e.target.closest('[data-translated="true"], [data-translated="original"]');
      if (!el) return null;
      const hit = e.target.closest(interactiveSelector);
      if (hit && el.contains(hit)) return null;
      return el;
    };

    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const el = getToggleTarget(e);
      if (!el) return;
      e.stopPropagation();
      e.preventDefault();

      const now = Date.now();
      if (el._txLastToggle && now - el._txLastToggle < 200) return;
      el._txLastToggle = now;

      if (el.classList.contains('axiom-tx-panel')) {
        self._togglePanel(el);
      } else {
        self._toggleText(el);
      }
    }, true);

    const suppress = (e) => {
      if (getToggleTarget(e)) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener('pointerup', suppress, true);
    document.addEventListener('mousedown', suppress, true);
    document.addEventListener('mouseup', suppress, true);
    document.addEventListener('click', suppress, true);
  }

  showTranslating(element) {
    element.dataset.translated = 'pending';
  }

  showTranslated(element) {
    element.dataset.translated = 'true';
  }

  showFailed(element) {
    element.dataset.translated = 'failed';
  }

  _togglePanel(panel) {
    panel.dataset.userToggled = '1';
    if (panel.dataset.translated === 'true') {
      panel.style.display = 'none';
      panel.dataset.translated = 'original';
    } else {
      panel.style.display = '';
      panel.dataset.translated = 'true';
    }
  }

  _toggleText(element) {
    const status = element.dataset.translated;
    if (status !== 'true' && status !== 'original') return;

    element.dataset.userToggled = '1';

    const isTranslated = status === 'true';
    const newState = isTranslated ? 'original' : 'true';

    const canUpdateClean = typeof cleanTweetText === 'function' && typeof getFullTextContent === 'function';

    const nodes = element._txNodes;
    const orig = element._txOriginal;
    const trans = element._txTranslated;

    if (nodes && orig && trans &&
        nodes.length === orig.length && nodes.length === trans.length) {
      if (nodes.every(n => n.isConnected)) {
        const targetTexts = isTranslated ? orig : trans;
        for (let i = 0; i < nodes.length; i++) {
          nodes[i].textContent = targetTexts[i];
        }
        element.dataset.translated = newState;
        element.dataset.translatedAt = String(Date.now());
        if (canUpdateClean) element.dataset.cleanedFullText = cleanTweetText(getFullTextContent(element));
        return;
      }
      delete element._txNodes;
      delete element._txOriginal;
      delete element._txTranslated;
    }

    const originalHtml = element.dataset.originalHtml;
    const translatedHtml = element.dataset.translatedHtml;

    if (originalHtml && translatedHtml) {
      element.innerHTML = isTranslated ? originalHtml : translatedHtml;
      element.dataset.translated = newState;
      element.dataset.translatedAt = String(Date.now());
      if (canUpdateClean) element.dataset.cleanedFullText = cleanTweetText(getFullTextContent(element));
      delete element._txNodes;
      delete element._txOriginal;
      delete element._txTranslated;
      return;
    }

    const originalText = element.dataset.originalText;
    const translatedText = element.dataset.translatedText;
    if (!originalText || !translatedText) return;

    element.textContent = isTranslated ? originalText : translatedText;
    element.dataset.translated = newState;
    element.dataset.translatedAt = String(Date.now());
    if (canUpdateClean) element.dataset.cleanedFullText = cleanTweetText(getFullTextContent(element));
  }

  setDebugEnabled(enabled) {
    this.isDebugEnabled = !!enabled;
    const panel = document.getElementById('axiom-debug-panel');
    if (panel) {
      panel.style.display = this.isDebugEnabled ? 'flex' : 'none';
    }
    if (this.isDebugEnabled) {
      this.logDebug('info', 'РЕЖИМ ОТЛАДКИ', 'Логирование включено. Ожидание карточек...');
    }
  }

  logDebug(type, title, message) {
    if (CONFIG.DEBUG) console.log(`[PadreDebug:${type}] ${title} - ${message}`);
    if (!this.isDebugEnabled) return;
    let panel = document.getElementById('axiom-debug-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'axiom-debug-panel';
      panel.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        width: 380px;
        max-height: 280px;
        background: rgba(15, 15, 20, 0.95);
        border: 1px solid #7c3aed;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        border-radius: 8px;
        z-index: 999999;
        font-family: ui-monospace, monospace;
        font-size: 11px;
        color: #e2e8f0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        backdrop-filter: blur(10px);
      `;
      panel.innerHTML = `
        <div style="background:#1e1b4b; padding:6px 10px; font-weight:bold; color:#a78bfa; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(124,58,237,0.3);">
          <span>🐞 AXIOM DEBUG LOGS</span>
          <span style="cursor:pointer; opacity:0.7; padding:0 4px;" onclick="this.closest('#axiom-debug-panel').style.display='none'">✕</span>
        </div>
        <div id="axiom-debug-log-list" style="padding:6px 10px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:4px;"></div>
      `;
      document.body.appendChild(panel);
    }
    panel.style.display = 'flex';
    const list = panel.querySelector('#axiom-debug-log-list');
    if (list) {
      const item = document.createElement('div');
      const colors = { info: '#60a5fa', success: '#4ade80', warn: '#facc15', error: '#f87171' };
      const color = colors[type] || '#e2e8f0';
      item.style.cssText = `line-height:1.3; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:3px; word-break:break-word; color:${color};`;
      const time = new Date().toLocaleTimeString();
      item.innerHTML = `<span style="opacity:0.6; color:#94a3b8;">[${time}]</span> <strong>${title}:</strong> ${message}`;
      list.appendChild(item);
      if (list.children.length > 50) list.removeChild(list.firstChild);
      list.scrollTop = list.scrollHeight;
    }
  }
}
