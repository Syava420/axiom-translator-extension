class TranslationUI {
  constructor() {
    this._injectStyles();
    this._setupGlobalToggle();
  }

  _injectStyles() {
    if (document.getElementById('axiom-translator-styles')) return;
    const style = document.createElement('style');
    style.id = 'axiom-translator-styles';
    style.textContent = `
      [data-testid="translationButton"] {
        display: none !important;
      }

      [data-translated="pending"] {
        opacity: ${CONFIG.UI.TRANSLATION_PENDING_OPACITY};
        transition: opacity 0.2s ease;
      }

      [data-translated="true"] {
        position: relative;
        overflow: visible !important;
        opacity: 1;
        transition: opacity 0.2s ease;
      }

      [data-translated="original"] {
        position: relative;
      }

      [data-translated="failed"] {
        opacity: 1;
      }

      [data-translated="true"].axiom-tx-leaf:hover,
      [data-translated="original"].axiom-tx-leaf:hover {
        cursor: pointer;
        background: transparent !important;
        background-color: transparent !important;
      }

      [data-translated="true"]:not(.axiom-tx-leaf):hover,
      [data-translated="original"]:not(.axiom-tx-leaf):hover {
        cursor: pointer;
        background: transparent !important;
        background-color: transparent !important;
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

      .axiom-narrative-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(124, 58, 237, 0.2);
        border: 1px solid rgba(167, 139, 250, 0.4);
        color: #ddd6fe;
        border-radius: 4px;
        padding: 2px 7px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        margin: 0 6px;
        transition: all 0.15s ease;
        user-select: none;
        z-index: 99;
        font-family: inherit;
        line-height: 1.2;
      }
      .axiom-narrative-btn:hover {
        background: rgba(124, 58, 237, 0.45);
        border-color: #a78bfa;
        color: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
      }
      .axiom-narrative-btn:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
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

  injectNarrativeButton(popupRoot, element) {
    if (!popupRoot || popupRoot.querySelector('.axiom-narrative-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'axiom-narrative-btn';
    btn.type = 'button';
    btn.title = 'Искать нарратив в Google (скопирует твит и откроет Google)';
    btn.innerHTML = '🔍 <span>Нарратив</span>';

    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();

      const origText = element.dataset?.originalText || element._txOriginal?.join(' ') || element.textContent || '';
      const cleanText = typeof cleanTweetText === 'function' ? cleanTweetText(origText) : origText;

      let handleText = '';
      const handleEl = popupRoot.querySelector('a[href*="x.com"], a[href*="twitter.com"], [class*="handle"]');
      if (handleEl) {
        handleText = handleEl.textContent.trim();
      }

      const searchQuery = `${handleText} ${cleanText} narrative meaning memecoin crypto news`.replace(/\s+/g, ' ').trim();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cleanText).catch(() => {});
      }

      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      window.open(searchUrl, '_blank');
    };

    btn.addEventListener('click', handler, true);
    btn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);

    const header = popupRoot.querySelector('a[href*="x.com"], a[href*="twitter.com"], [class*="handle"], [class*="profile"], [class*="header"]')
      || popupRoot.querySelector('div > span, div > h3, div > h4')
      || popupRoot.firstElementChild;

    if (header && header.parentElement) {
      header.parentElement.appendChild(btn);
    } else {
      popupRoot.prepend(btn);
    }
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
}
