(async function () {
  'use strict';

  const hostname = window.location.hostname;
  if (hostname !== 'axiom.trade' && !hostname.endsWith('.axiom.trade')) return;

  if (CONFIG.DEBUG) console.log('[AxiomTranslator] Extension loaded on', window.location.href);


  let state;
  try {
    state = await chrome.storage.local.get(['enabled', 'custom_dictionary']);
  } catch (err) {
    console.warn('[AxiomTranslator] Failed to load state:', err);
    state = {};
  }
  let isEnabled = state.enabled !== false;


  const cache = new LRUCache();
  await cache.loadFromStorage();

  const diagnostics = new Diagnostics();
  await diagnostics.load();

  const translator = new TranslationService(cache, diagnostics, state.custom_dictionary);

  const ui = new TranslationUI();
  const observer = new TweetObserver(translator, cache, ui, diagnostics);

  const _apiHosts = [
    new URL(CONFIG.APIS.GOOGLE.url).hostname,
    ...CONFIG.APIS.MOZHI.instances.map(u => new URL(u).hostname),
    new URL(CONFIG.APIS.SIMPLYTRANSLATE.url).hostname,
    ...CONFIG.APIS.LINGVA.instances.map(u => new URL(u).hostname),
    new URL(CONFIG.APIS.MYMEMORY.url).hostname,
    'api.fxtwitter.com'
  ];

  const _prefetchFrag = document.createDocumentFragment();
  for (const host of _apiHosts) {
    const dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = '//' + host;
    _prefetchFrag.appendChild(dns);
  }
  for (const host of _apiHosts.slice(0, 8)) {
    const pc = document.createElement('link');
    pc.rel = 'preconnect';
    pc.href = 'https://' + host;
    pc.crossOrigin = 'anonymous';
    _prefetchFrag.appendChild(pc);
  }
  document.head.appendChild(_prefetchFrag);





  if (isEnabled) {
    observer.start();
  }

  if (CONFIG.DEBUG) console.log(`[AxiomTranslator] Ready. Enabled: ${isEnabled}, Cache: ${cache.size} entries`);


  if (!chrome.runtime?.id) return;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'UPDATE_CUSTOM_DICTIONARY':
        translator.updateCustomDictionary(message.dictionary);
        if (CONFIG.DEBUG) console.log('[AxiomTranslator] Custom dictionary updated');
        sendResponse({ ok: true });
        break;

      case 'TOGGLE_TRANSLATION':
        isEnabled = message.enabled;
        observer.setEnabled(isEnabled);
        if (isEnabled) {
          observer.start();
        } else {
          observer.stop();
        }
        if (CONFIG.DEBUG) console.log(`[AxiomTranslator] Translation ${isEnabled ? 'enabled' : 'disabled'}`);
        sendResponse({ ok: true });
        break;

      case 'CLEAR_CACHE':
        cache.clear();
        translator.stats.cached = 0;
        if (CONFIG.DEBUG) console.log('[AxiomTranslator] Cache cleared');
        sendResponse({ ok: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          enabled: isEnabled,
          stats: { ...translator.stats },
          cacheSize: cache.size,
          apis: translator.getApiStatuses()
        });
        break;

      case 'GET_DIAGNOSTICS':
        sendResponse(diagnostics.generateReport());
        break;

      case 'EXPORT_MEMORY':
        sendResponse({ text: diagnostics.generateMemoryUpdate() });
        break;

      case 'GET_DEBUG_LOG': {
        const orderedLog = _debugLog.length < _DEBUG_LOG_MAX
          ? _debugLog
          : _debugLog.slice(_debugLogHead).concat(_debugLog.slice(0, _debugLogHead));
        sendResponse({
          log: getIssuesSummary() + orderedLog.join('\n'),
          entries: _debugLog.length,
          issues: Object.keys(_debugIssues).length,
          url: window.location.href
        });
        break;
      }

      case 'RESET_DIAGNOSTICS':
        diagnostics.reset()
          .then(() => sendResponse({ ok: true }))
          .catch(err => sendResponse({ error: err.message }));
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
        break;
    }
    return true;
  });


  let lastUrl = location.href;
  let navigationTimer = null;

  function handleNavigation() {
    if (location.href === lastUrl) return;
    const oldUrl = lastUrl;
    lastUrl = location.href;

    if (CONFIG.DEBUG) console.log(`[AxiomTranslator] Navigation: ${oldUrl} → ${lastUrl}`);

    if (isEnabled) {
      observer.stop();
      if (navigationTimer) clearTimeout(navigationTimer);
      navigationTimer = setTimeout(() => {
        navigationTimer = null;
        if (isEnabled) observer.start();
      }, 150);
    }
  }

  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    handleNavigation();
  };
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    handleNavigation();
  };
  window.addEventListener('popstate', handleNavigation);

})();
