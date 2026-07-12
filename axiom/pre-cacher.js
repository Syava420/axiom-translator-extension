class FeedPreCacher {
  constructor(translator, cache) {
    this.translator = translator;
    this.cache = cache;
    this.isEnabled = true;
    this._pcSet = new Set();
    this._pcQueue = [];
    this._pcMax = 200;
    this._pcCount = 0;
    this._pcScanned = new WeakSet();
    this._pcPending = [];
    this._pcDraining = false;
    this._pcTimer = null;
    this._pcLastScroll = 0;
    this._onScroll = null;
    this._pcRoot = null;
  }

  start() {
    this._pcTimer = setInterval(() => {
      if (this.isEnabled) this._pcScan();
    }, 800);

    setTimeout(() => { if (this.isEnabled) this._pcScan(); }, 150);
    setTimeout(() => { if (this.isEnabled) this._pcScan(); }, 600);

    this._pcLastScroll = 0;
    this._onScroll = () => {
      if (!this.isEnabled) return;
      const now = Date.now();
      if (now - this._pcLastScroll < 200) return;
      this._pcLastScroll = now;
      this._pcScan();
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });

    if (CONFIG.DEBUG) console.log('[AxiomTranslator] Pre-cacher ON (rolling ' + this._pcMax + ')');
  }

  stop() {
    if (this._pcTimer) {
      clearInterval(this._pcTimer);
      this._pcTimer = null;
    }
    if (this._onScroll) {
      window.removeEventListener('scroll', this._onScroll);
      this._onScroll = null;
    }
    this._pcPending = [];
    this._pcDraining = false;
  }

  _pcScan() {
    if (!this._pcRoot || !this._pcRoot.isConnected) {
      this._pcRoot = document.querySelector('main') ||
                     document.querySelector('[class*="feed"]') ||
                     document.querySelector('[class*="content"]') ||
                     document.body;
    }
    const root = this._pcRoot;
    if (!root) return;

    const els = root.querySelectorAll(TEXT_BEARING_SELECTOR);
    let found = 0;

    for (const el of els) {
      if (found >= 75) break;
      if (this._pcScanned.has(el)) continue;
      if (el.dataset?.translated) continue;
      if (el.children.length > 20) continue;

      const text = el.textContent || '';
      if (text.length < 30 || text.length > 600) continue;
      if (!CONFIG.DETECTION.HANDLE_REGEX.test(text)) continue;

      if (el.closest(POPUP_CONTAINER_SELECTOR)) continue;

      this._pcScanned.add(el);
      this._pcExtract(text);
      found++;
    }
  }

  _pcExtract(raw) {
    if (!raw || raw.length < 30) return;
    if (!CONFIG.DETECTION.HANDLE_REGEX.test(raw)) return;

    let text = raw.replace(_OB_STRIP_PREFIX, '');
    text = text.replace(_OB_STRIP_TIME, '');
    text = cleanTweetText(text);

    if (text.length < 15 || text.length > 800) return;
    if (isRussianText(text)) return;
    if (isMetadataText(text)) return;

    const hash = textHash(text);

    if (this._pcSet.has(hash)) return;
    if (this.cache.get(hash)) {
      this._pcSet.add(hash);
      return;
    }

    this._pcSet.add(hash);
    this._pcQueue.push(hash);
    while (this._pcQueue.length > this._pcMax) {
      this._pcSet.delete(this._pcQueue.shift());
    }

    if (this._pcPending.length >= 100) this._pcPending.shift();
    this._pcPending.push(text);

    if (!this._pcDraining) this._pcDrain();
  }

  _pcDrain() {
    if (!this.isEnabled || this._pcPending.length === 0) {
      this._pcDraining = false;
      return;
    }
    this._pcDraining = true;

    const batch = this._pcPending.splice(0, 12);
    for (const text of batch) {
      this._pcCount++;
      this.translator.translate(text, false, true).catch(() => {});

      if (CONFIG.DEBUG && (this._pcCount <= 10 || this._pcCount % 50 === 0)) {
        console.log('[AxiomTranslator] PRE-CACHE #' + this._pcCount + ' (queue:' + this._pcPending.length + '): "' + text.substring(0, 60) + '..."');
      }
    }

    if (this._pcPending.length > 0) {
      setTimeout(() => this._pcDrain(), 50 + Math.random() * 80);
    } else {
      this._pcDraining = false;
    }
  }
}
