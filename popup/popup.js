document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleEnabled');

  const versionEl = document.getElementById('extVersion');
  if (versionEl) {
    const ver = chrome.runtime.getManifest?.()?.version;
    if (ver) versionEl.textContent = 'v' + ver;
  }

  let liveDataLoaded = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && isSupportedTab(tab.url)) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
      if (response) {
        toggle.checked = response.enabled;
        liveDataLoaded = true;
      }
    }
  } catch (err) { /* tab query */ }

  if (!liveDataLoaded) {
    const state = await chrome.storage.local.get(['enabled']);
    toggle.checked = state.enabled !== false;
  }

  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await chrome.storage.local.set({ enabled });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_TRANSLATION',
          enabled
        });
      }
    } catch (err) { /* toggle send */ }
  });

  function isSupportedTab(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname === 'axiom.trade' || hostname.endsWith('.axiom.trade')
          || hostname === 'trade.padre.gg' || hostname.endsWith('.padre.gg');
    } catch { return false; }
  }

  var c = document.getElementById('_c');
  if (!c) {
    c = document.createElement('div');
    c.className = 'author';
    c.id = '_c';
    var ct = document.querySelector('.container');
    if (ct) ct.appendChild(c);
  }
  var _k = [83,97,109,117,114,97,105];
  var _b = String.fromCharCode(98,121,32);
  var _n = _k.map(function(v){return String.fromCharCode(v)}).join('');
  var _t = atob('aHR0cHM6Ly90Lm1lL1NhbXVyYWlfVkM=');
  var _x = atob('aHR0cHM6Ly94LmNvbS9Nb3J0aWRfWA==');
  c.innerHTML = _b + '<a href="' + _t + '" target="_blank">' + _n +
    '</a> \u00b7 <a href="' + _x + '" target="_blank">\ud835\udd4f</a>';
});
