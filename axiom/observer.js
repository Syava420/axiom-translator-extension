/**
 * Axiom Translator - Page Observer
 * Mutation observation, mouse hover, and translation triggers.
 */


class TweetObserver {
  constructor(translator, cache, ui, diagnostics) {
    this.translator = translator;
    this.cache = cache;
    this.ui = ui;
    this.diagnostics = diagnostics;
    this.observer = null;
    this._inFlightTexts = new Map();
    this._pendingMutations = [];
    this._rafScheduled = false;
    this.isEnabled = true;
    this._consecutiveErrors = 0;
    this._maxConsecutiveErrors = 10;
    this._restartBackoffMs = 1000;
    this._maxBackoffMs = 30000;
    this._loggedRoots = new WeakSet();
    this._popupId = 0;

    this.preCacher = new FeedPreCacher(translator, cache);
    this._scheduledDelayedChecks = new WeakSet();
  }


  start() {
    if (this.observer) this.stop();

    this.observer = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;

      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches?.(POPUP_CONTAINER_SELECTOR)) {
            const all = this._pendingMutations.length > 0
              ? this._pendingMutations.concat(mutations)
              : mutations;
            this._pendingMutations = [];
            this._processMutations(all);
            return;
          }
        }
      }

      for (let i = 0; i < mutations.length; i++) this._pendingMutations.push(mutations[i]);
      if (!this._rafScheduled) {
        this._rafScheduled = true;
        requestAnimationFrame(() => {
          const batch = this._pendingMutations;
          this._pendingMutations = [];
          this._rafScheduled = false;
          this._processMutations(batch);
        });
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this._scheduleCatchupScan();
    this._startMouseDetection();
    this._startPopupPoller();
    this.preCacher.start();
    if (CONFIG.DEBUG) console.log('[AxiomTranslator] Observer started (v3.3 — triple detection + pre-cache)');
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this._inFlightTexts.clear();
    this._pendingMutations = [];
    this._rafScheduled = false;
    this._stopMouseDetection();
    this._stopPopupPoller();
    this.preCacher.stop();
    document.querySelectorAll(POPUP_CONTAINER_SELECTOR).forEach(el => {
      delete el._axiomTranslated;
      delete el._axiomFirstSeen;
      if (el._axiomWatcher) { el._axiomWatcher.disconnect(); delete el._axiomWatcher; }
    });
    if (CONFIG.DEBUG) console.log('[AxiomTranslator] Observer stopped');
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.preCacher.isEnabled = enabled;
  }

  _scheduleCatchupScan() {
    for (const delay of _DELAYS_CATCHUP) {
      setTimeout(() => {
        if (!this.isEnabled) return;
        const popups = document.querySelectorAll(POPUP_CONTAINER_SELECTOR);
        for (const popup of popups) {
          if (popup.querySelector('[data-translated="true"],[data-translated="pending"],.axiom-tx-panel')) continue;
          const popupInfo = checkPopup(popup);
          if (!popupInfo) continue;
          if (this.diagnostics) this.diagnostics.learnPopupPattern(popup);
          const elements = findTweetTextElements(popupInfo.popupRoot);
          this._processFoundElements(elements, popup);
          this._watchPopup(popupInfo.popupRoot, popup);
        }
      }, delay);
    }
  }


  _processMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = addedNode.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') continue;

        const matchesSelf = addedNode.matches?.(POPUP_CONTAINER_SELECTOR);
        const popupChild = !matchesSelf ? addedNode.querySelector?.(POPUP_CONTAINER_SELECTOR) : null;
        const isPopupContainer = !!(matchesSelf || popupChild);

        const nodeText = addedNode.textContent || '';
        const textLen = nodeText.length;

        if (textLen < 3 && !isPopupContainer) continue;

        if (textLen < 20 && !isPopupContainer) {
          if (addedNode.closest?.(POPUP_CONTAINER_SELECTOR)) {
            const ancestorPopup = findAncestorPopup(addedNode);
            if (ancestorPopup && !this._isStillTranslated(ancestorPopup.popupRoot)) {
              const elements = findTweetTextElements(ancestorPopup.popupRoot);
              this._processFoundElements(elements, addedNode);
              this._scheduleDelayedScan(ancestorPopup.popupRoot, addedNode);
              this._watchPopup(ancestorPopup.popupRoot, addedNode);
            }
          }
          continue;
        }

        const popupInfo = checkPopup(addedNode);

        if (!popupInfo) {
          if (isPopupContainer) {
            this._scheduleDelayedPopupCheck(addedNode);
            const earlyRoot = matchesSelf ? addedNode : popupChild;
            if (earlyRoot) this._watchPopup(earlyRoot, addedNode);
            continue;
          }

          if (textLen >= 20) {
            const ancestorPopup = findAncestorPopup(addedNode);
            if (ancestorPopup && !this._isStillTranslated(ancestorPopup.popupRoot)) {
              const elements = findTweetTextElements(ancestorPopup.popupRoot);
              this._processFoundElements(elements, addedNode);
              this._scheduleDelayedScan(ancestorPopup.popupRoot, addedNode);
              this._watchPopup(ancestorPopup.popupRoot, addedNode);
              continue;
            }
          }

          if (textLen >= 30 && CONFIG.DETECTION.HANDLE_REGEX.test(nodeText)) {
            this.preCacher._pcExtract(nodeText);
          }

          if (this.diagnostics && looksLikePopup(addedNode)) {
            this.diagnostics.recordDetectionMiss(addedNode);
          }
          continue;
        }

        if (this.diagnostics) {
          this.diagnostics.learnPopupPattern(addedNode);
        }

        const elements = findTweetTextElements(popupInfo.popupRoot);
        this._processFoundElements(elements, addedNode);
        this._scheduleDelayedScan(popupInfo.popupRoot, addedNode);
        this._watchPopup(popupInfo.popupRoot, addedNode);
      }
    }
  }


  _watchPopup(popupRoot, popupNode) {
    if (popupRoot._axiomWatcher) return;

    let debounceTimer = null;
    const rescan = () => {
      if (!popupRoot.isConnected || !this.isEnabled) { cleanup(); return; }
      const elements = findTweetTextElements(popupRoot);
      this._processFoundElements(elements, popupNode);
    };

    const obs = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(rescan, 50);
    });

    obs.observe(popupRoot, {
      childList: true,
      characterData: true,
      subtree: true
    });

    popupRoot._axiomWatcher = obs;

    const cleanup = () => {
      obs.disconnect();
      delete popupRoot._axiomWatcher;
      if (debounceTimer) clearTimeout(debounceTimer);
    };

    setTimeout(cleanup, 10000);
  }

  _isStillTranslated(popup) {
    if (!popup._axiomTranslated) return false;
    if (popup.querySelector('[data-translated="true"],[data-translated="pending"],.axiom-tx-panel')) {
      return true;
    }
    delete popup._axiomTranslated;
    delete popup._axiomFirstSeen;
    return false;
  }




  _processFoundElements(elements, popupNode) {
    const _now = Date.now();
    for (const el of elements) {
      const status = el.dataset.translated;
      if (status === 'pending') {
        const ps = parseInt(el.dataset.pendingSince || '0', 10);
        if (ps && _now - ps > 3000) {
          delete el.dataset.translated;
          delete el.dataset.pendingSince;
          if (CONFIG.DEBUG) console.log('[AxiomTranslator]   reset stuck pending (' + (_now - ps) + 'ms)');
        } else {
          continue;
        }
      }
      if (status === 'en-only') continue;
      if (status === 'url-only') continue;

      if (status === 'failed') {
        const failedAt = parseInt(el.dataset.translatedAt || '0', 10);
        if (_now - failedAt < 800) continue;
        delete el.dataset.translated;
        delete el.dataset.translatedAt;
      }

      if (status === 'true' || status === 'original' || status === 'panel') {
        if (status === 'original') continue;
        if (el.dataset.userToggled) continue;

        const currentText = cleanTweetText(getFullTextContent(el));
        const storedCleanText = el.dataset.cleanedFullText;
        if (storedCleanText && currentText === storedCleanText) continue;

        const translatedAt = parseInt(el.dataset.translatedAt || '0', 10);
        if (_now - translatedAt < 500) continue;

        if (CONFIG.DEBUG) console.log('[AxiomTranslator]   re-translating: content changed ("' + currentText.substring(0, 50) + '...")');
        delete el.dataset.translated;
        delete el.dataset.originalHtml;
        delete el.dataset.translatedHtml;
        delete el.dataset.originalText;
        delete el.dataset.translatedText;
        delete el.dataset.cleanedFullText;
        delete el.dataset.translatedAt;
        const panel = el.nextElementSibling;
        if (panel?.classList.contains('axiom-tx-panel')) panel.remove();
      }

      this._handleTweetFound(el, popupNode);
    }
  }

  _scheduleDelayedPopupCheck(node) {
    if (this._scheduledDelayedChecks.has(node)) return;
    this._scheduledDelayedChecks.add(node);

    for (const delay of _DELAYS_POPUP_CHECK) {
      setTimeout(() => {
        if (!node.isConnected || !this.isEnabled) return;
        if (node.querySelector('[data-translated="true"],[data-translated="original"],.axiom-tx-panel')) return;

        const popupInfo = checkPopup(node);
        if (!popupInfo) return;

        if (this.diagnostics) this.diagnostics.learnPopupPattern(node);
        const elements = findTweetTextElements(popupInfo.popupRoot);
        this._processFoundElements(elements, node);
        this._scheduleDelayedScan(popupInfo.popupRoot, node);
        this._watchPopup(popupInfo.popupRoot, node);
      }, delay);
    }
  }

  _scheduleDelayedScan(popupRoot, popupNode) {
    const now = Date.now();
    if (popupRoot._axiomDelayedScanAt && now - popupRoot._axiomDelayedScanAt < 50) return;
    popupRoot._axiomDelayedScanAt = now;
    for (const delay of _DELAYS_SCAN) {
      setTimeout(() => {
        if (!popupRoot.isConnected || !this.isEnabled) return;
        const pending = popupRoot.querySelectorAll('[data-translated="pending"]');
        for (const p of pending) {
          const pendingStart = parseInt(p.dataset.pendingSince || '0', 10);
          if (pendingStart && Date.now() - pendingStart > 3000) {
            delete p.dataset.translated;
            delete p.dataset.pendingSince;
          }
        }
        const elements = findTweetTextElements(popupRoot);
        this._processFoundElements(elements, popupNode);
      }, delay);
    }
  }


  _startMouseDetection() {
    this._lastMouseCheck = 0;
    this._onMouseOver = (e) => {
      if (!this.isEnabled) return;
      const now = Date.now();
      if (now - this._lastMouseCheck < 100) return;
      this._lastMouseCheck = now;

      const popup = e.target.closest?.(POPUP_CONTAINER_SELECTOR);
      if (!popup) return;

      if (this._isStillTranslated(popup)) {
        const firstSeen = popup._axiomFirstSeen || 0;
        if (!firstSeen || now - firstSeen > 8000) return;
      }
      if (!popup._axiomFirstSeen) popup._axiomFirstSeen = now;

      const popupInfo = checkPopup(popup);
      if (!popupInfo) return;

      if (this.diagnostics) this.diagnostics.learnPopupPattern(popup);
      const elements = findTweetTextElements(popupInfo.popupRoot);
      this._processFoundElements(elements, popup);
    };
    document.addEventListener('mouseover', this._onMouseOver, { passive: true });
  }

  _stopMouseDetection() {
    if (this._onMouseOver) {
      document.removeEventListener('mouseover', this._onMouseOver);
      this._onMouseOver = null;
    }
  }


  _startPopupPoller() {
    this._popupPoller = setInterval(() => {
      if (!this.isEnabled) return;
      const popups = document.querySelectorAll(POPUP_CONTAINER_SELECTOR);
      for (const popup of popups) {
        if (!popup.isConnected) continue;

        if (this._isStillTranslated(popup)) {
          const firstSeen = popup._axiomFirstSeen || 0;
          if (!firstSeen || Date.now() - firstSeen > 8000) continue;
        }
        if (!popup._axiomFirstSeen) popup._axiomFirstSeen = Date.now();

        const popupInfo = checkPopup(popup);
        if (!popupInfo) continue;

        if (this.diagnostics) this.diagnostics.learnPopupPattern(popup);
        const elements = findTweetTextElements(popupInfo.popupRoot);
        this._processFoundElements(elements, popup);
      }
    }, 400);
  }

  _stopPopupPoller() {
    if (this._popupPoller) {
      clearInterval(this._popupPoller);
      this._popupPoller = null;
    }
  }




  _insertPanel(element, translated) {
    const panel = document.createElement('div');
    panel.className = 'axiom-tx-panel';
    panel.textContent = translated;
    panel.dataset.translated = 'true';
    panel.dataset.translatedAt = String(Date.now());
    if (translated.includes('\n')) panel.style.whiteSpace = 'pre-line';
    element.insertAdjacentElement('afterend', panel);
  }


  async _handleTweetFound(element, popupNode) {
    if (element.parentElement?.closest('[data-translated]') && !element._axiomEmbeddedTranslation) return;
    if (element.querySelector('[data-translated]')) return;
    if (element.nextElementSibling?.classList.contains('axiom-tx-panel')) return;

    const textNodes = collectTranslatableTextNodes(element);

    let domText = '';
    let isFragmented = false;
    let hasBrOnly = false;
    let brSegments = null;

    if (textNodes.length > 0) {
      const texts = textNodes.map(n => n.text);
      hasBrOnly = _hasOnlyBrChildren(element);
      let shortCount = 0;
      for (let i = 0; i < texts.length; i++) if (texts[i].length < 12) shortCount++;
      isFragmented = !hasBrOnly && textNodes.length >= 4 && (shortCount / textNodes.length) > 0.6;
      if (hasBrOnly) brSegments = texts;
      domText = isFragmented ? texts.join(' ') : texts.join('\n\n');
    } else {
      const rawFull = getFullTextContent(element);
      if (_OB_REPLYING_EXACT.test(rawFull)) return;
      if (element.querySelector('a[href*="/communities/"]') || element.closest('a[href*="/communities/"]')) return;
      domText = cleanTweetText(rawFull);
    }

    if (!domText || domText.length < CONFIG.DETECTION.MIN_TWEET_TEXT_LENGTH) return;
    if (isRussianText(domText)) return;
    if (isMetadataText(domText)) return;

    let textToTranslate = domText;
    const hasProfilePrefix = _OB_PROFILE_PREFIX.test(textToTranslate);
    if (hasProfilePrefix) {
      let stripped = textToTranslate.replace(_OB_STRIP_PREFIX, '');
      stripped = stripped.replace(_OB_STRIP_TIME, '');
      stripped = cleanTweetText(stripped);
      if (stripped && stripped.length >= CONFIG.DETECTION.MIN_TWEET_TEXT_LENGTH) {
        textToTranslate = stripped;
      }
    }

    if (textToTranslate.length < CONFIG.DETECTION.MIN_TWEET_TEXT_LENGTH || isRussianText(textToTranslate)) return;
    if (isMetadataText(textToTranslate)) return;

    const textKey = textToTranslate.substring(0, 120);
    const _flight = this._inFlightTexts.get(textKey);
    if (_flight && _flight.el.isConnected) return;
    const _now = Date.now();
    if (this._inFlightTexts.size > 300) {
      for (const [k, v] of this._inFlightTexts) {
        if (_now - v.ts > 10000) this._inFlightTexts.delete(k);
      }
    }
    this._inFlightTexts.set(textKey, { ts: _now, el: element });

    element.dataset.originalHtml = element.innerHTML;
    element.dataset.originalText = domText;
    element.dataset.cleanedFullText = cleanTweetText(getFullTextContent(element));
    element.dataset.translated = 'pending';
    element.dataset.pendingSince = String(Date.now());

    if (textNodes.length > 0) {
      element._txNodes = textNodes.map(n => n.node);
      element._txOriginal = textNodes.map(n => n.node.textContent);
    }

    this.ui.showTranslating(element);

    if (CONFIG.DEBUG) {
      const fragInfo = isFragmented ? ' (FRAG:' + textNodes.length + ')' : '';
      console.log('[AxiomTranslator]   translating' + fragInfo + ': "' + textToTranslate.substring(0, 100) + '..." (' + textToTranslate.length + 'ch)');
    }

    if (this.diagnostics) {
      this.diagnostics.recordDetectionSuccess(element, {
        hasRadix: !!popupNode?.querySelector?.('[data-radix-popper-content-wrapper]'),
        textLength: textToTranslate.length
      });
    }

    const startTime = Date.now();

    try {
      let translated = await this.translator.translate(textToTranslate);
      if (translated) {
        translated = translated.replace(_PP_TRAILING_COMMA_NL, '$1').replace(_PP_TRAILING_COMMA, '');
      }
      if (!translated) {
        element.dataset.translated = 'failed';
        this.ui.showFailed(element);
        return;
      }
      if (!element.isConnected) {
        this._inFlightTexts.delete(textKey);
        if (translated) {
          const pr = popupNode?.isConnected
            ? (popupNode.matches?.(POPUP_CONTAINER_SELECTOR) ? popupNode : popupNode.closest?.(POPUP_CONTAINER_SELECTOR))
            : null;
          if (pr?.isConnected) {
            const fe = findTweetTextElements(pr);
            this._processFoundElements(fe, popupNode);
          }
        }
        return;
      }


      if (!hasBrOnly && translated.includes('\n')) element.style.whiteSpace = 'pre-line';

      const nodesAlive = textNodes.length > 0 && textNodes[0].node.isConnected;
      let insertedVia = '';

      const hasEmbeds = element.children.length > 0 && hasBlockChildren(element);

      if (nodesAlive && isFragmented) {
        const alive = textNodes.filter(n => n.node.isConnected);
        if (alive.length > 0) {
          alive[0].node.textContent = _padWithOrigWhitespace(textNodes[0].raw, translated);
          for (let i = 1; i < alive.length; i++) alive[i].node.textContent = '';
          insertedVia = 'first-node (' + alive.length + ' spans)';
        } else {
          element.textContent = translated;
          insertedVia = 'textContent-fallback (fragmented, disconnected)';
        }

      } else if (nodesAlive && !isFragmented) {
        let parts = translated.split('\n\n');
        if (parts.length !== textNodes.length) parts = translated.split('\n');
        if (parts.length === textNodes.length) {
          for (let i = 0; i < textNodes.length; i++) {
            textNodes[i].node.textContent = _padWithOrigWhitespace(textNodes[i].raw, parts[i]);
          }
          insertedVia = 'node-by-node (' + textNodes.length + ')';
        } else if (hasBrOnly && brSegments && brSegments.length > 1) {
          const perParts = await Promise.all(
            brSegments.map(seg => this.translator.translate(seg, false, true).then(t => t || seg))
          );
          if (!element.isConnected) { this._inFlightTexts.delete(textKey); return; }
          for (let i = 0; i < textNodes.length; i++) {
            textNodes[i].node.textContent = _padWithOrigWhitespace(textNodes[i].raw, perParts[i] || '');
          }
          insertedVia = 'per-segment-br (' + textNodes.length + ' nodes)';
        } else {
          textNodes[0].node.textContent = _padWithOrigWhitespace(textNodes[0].raw, translated);
          for (let i = 1; i < textNodes.length; i++) {
            if (textNodes[i].node.isConnected) textNodes[i].node.textContent = '';
          }
          insertedVia = 'first-node (mismatch: ' + parts.length + ' parts vs ' + textNodes.length + ' nodes)';
        }

      } else if (!nodesAlive && textNodes.length > 0) {
        const fresh = collectTranslatableTextNodes(element);
        if (fresh.length > 0) {
          fresh[0].node.textContent = _padWithOrigWhitespace(fresh[0].raw, translated);
          for (let i = 1; i < fresh.length; i++) {
            if (fresh[i].node.isConnected) fresh[i].node.textContent = '';
          }
          insertedVia = 'fresh-nodes (' + fresh.length + ')';
        } else {
          element.textContent = translated;
          insertedVia = 'textContent-fallback (fresh empty)';
        }

      } else {
        element.textContent = translated;
        insertedVia = 'textContent-fallback (no nodes)';
      }

      if (element._txNodes) {
        element._txTranslated = element._txNodes
          .filter(n => n.isConnected)
          .map(n => n.textContent);
      }
      element.dataset.translatedHtml = element.innerHTML;
      element.dataset.translatedText = translated;
      element.dataset.cleanedFullText = cleanTweetText(getFullTextContent(element));
      element.dataset.translatedAt = String(Date.now());
      element.dataset.translated = 'true';
      if (!hasBlockChildren(element)) {
        element.classList.add('axiom-tx-leaf');
      }
      let anc = element.parentElement;
      while (anc && anc !== document.body) {
        if (anc.matches?.(POPUP_CONTAINER_SELECTOR)) anc._axiomTranslated = true;
        anc = anc.parentElement;
      }
      this.ui.showTranslated(element);
      this._consecutiveErrors = 0;
      this._restartBackoffMs = 1000;

      const elapsed = Date.now() - startTime;
      if (CONFIG.DEBUG) {
        console.log('[AxiomTranslator]   ✓ OK (' + elapsed + 'ms, ' + insertedVia + '): "' + translated.substring(0, 80) + '..."');
      }

      if (this.diagnostics) {
        this.diagnostics.recordTranslationSuccess(
          textToTranslate, translated, 'auto', elapsed
        );
      }
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        this.stop();
        return;
      }
      console.warn('[AxiomTranslator] Translation failed:', err);
      if (element.dataset.originalHtml && element.isConnected) {
        element.innerHTML = element.dataset.originalHtml;
      }
      element.dataset.translated = 'failed';
      element.dataset.translatedAt = String(Date.now());
      this.ui.showFailed(element);
      this._consecutiveErrors++;

      if (this.diagnostics) {
        this.diagnostics.recordTranslationFailure(textToTranslate, err, 'auto');
      }

      if (this._consecutiveErrors >= this._maxConsecutiveErrors) {
        console.warn(`[AxiomTranslator] Too many errors, restarting in ${this._restartBackoffMs}ms...`);
        this._consecutiveErrors = 0;
        const backoff = this._restartBackoffMs;
        this._restartBackoffMs = Math.min(this._restartBackoffMs * 2, this._maxBackoffMs);
        this.stop();
        setTimeout(() => {
          if (this.isEnabled) this.start();
        }, backoff);
      }
    } finally {
      setTimeout(() => this._inFlightTexts.delete(textKey), 800);
    }
  }

}
