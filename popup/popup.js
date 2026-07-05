document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggleEnabled');
  const statusBar = document.getElementById('statusBar');
  const statusText = document.getElementById('statusText');
  const versionEl = document.getElementById('extVersion');

  const statTranslated = document.getElementById('statTranslated');
  const statCached = document.getElementById('statCached');
  const statPreserved = document.getElementById('statPreserved');
  const btnClearCache = document.getElementById('btnClearCache');

  // Set Version
  if (versionEl) {
    const ver = chrome.runtime.getManifest?.()?.version;
    if (ver) versionEl.textContent = 'v' + ver;
  }

  // Load Status and Stats
  async function updateUI() {
    // 1. Get enabled status
    const state = await chrome.storage.local.get(['enabled', 'stats']);
    const enabled = state.enabled !== false;
    
    toggle.checked = enabled;
    if (enabled) {
      statusBar.classList.remove('disabled');
      statusText.textContent = 'ACTIVE';
    } else {
      statusBar.classList.add('disabled');
      statusText.textContent = 'DISABLED';
    }

    // 2. Load Stats
    if (state.stats) {
      statTranslated.textContent = formatNumber(state.stats.translated || 0);
      statCached.textContent = formatNumber(state.stats.cached || 0);
      statPreserved.textContent = formatNumber(state.stats.preserved || 0);
    } else {
      statTranslated.textContent = '0';
      statCached.textContent = '0';
      statPreserved.textContent = '0';
    }
  }

  // Helper for formatting numbers (e.g. 1500 -> 1.5K or just standard format)
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return String(num);
  }

  // Initial UI Load
  await updateUI();

  // Watch for Changes
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    await chrome.storage.local.set({ enabled });

    if (enabled) {
      statusBar.classList.remove('disabled');
      statusText.textContent = 'ACTIVE';
    } else {
      statusBar.classList.add('disabled');
      statusText.textContent = 'DISABLED';
    }

    // Inform the current tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_TRANSLATION',
          enabled
        });
      }
    } catch (err) { /* tab query/send failed, tab might not be axiom/padre */ }
  });

  // Clear Cache Button
  btnClearCache.addEventListener('click', async () => {
    // Show loading/clearing state
    const originalText = btnClearCache.innerHTML;
    btnClearCache.disabled = true;
    btnClearCache.textContent = 'Очистка...';

    // Clear from storage
    await chrome.storage.local.remove([
      'axiom_translation_cache_v2',
      'padre_translation_cache_v2',
      'axiom_translation_cache_v2_version',
      'padre_translation_cache_v2_version',
      'axiom_diagnostics',
      'padre_diagnostics',
      'saved_english_tweets'
    ]);

    // Reset stats
    const zeroStats = { translated: 0, cached: 0, errors: 0, preserved: 0 };
    await chrome.storage.local.set({ stats: zeroStats });

    // Inform current tab to purge its memory cache if possible
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' }).catch(() => {});
      }
    } catch (e) {}

    // Update UI numbers
    statTranslated.textContent = '0';
    statCached.textContent = '0';
    statPreserved.textContent = '0';

    // Show success state
    btnClearCache.classList.add('success');
    btnClearCache.textContent = 'Готово!';

    setTimeout(() => {
      btnClearCache.classList.remove('success');
      btnClearCache.innerHTML = originalText;
      btnClearCache.disabled = false;
    }, 1500);
  });

  // Export Saved English Tweets Button
  const btnExportTweets = document.getElementById('btnExportTweets');
  if (btnExportTweets) {
    btnExportTweets.addEventListener('click', async () => {
      try {
        const data = await chrome.storage.local.get(['saved_english_tweets']);
        const list = data.saved_english_tweets || [];
        if (list.length === 0) {
          alert('Нет сохраненных твитов для экспорта. Листайте ленту с включенным переводом, чтобы твиты начали сохраняться.');
          return;
        }

        // Format: join tweets by newlines and a delimiter line
        const fileContent = list.join('\n\n----------------------------------------\n\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exported_tweets_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Failed to export tweets:', e);
        alert('Ошибка при экспорте твитов.');
      }
    });
  }

  // Load Slang Dictionary UI and save handler
  const customDictText = document.getElementById('customDictText');
  const btnSaveDict = document.getElementById('btnSaveDict');

  try {
    const dictData = await chrome.storage.local.get(['custom_dictionary_raw']);
    if (dictData.custom_dictionary_raw !== undefined) {
      customDictText.value = dictData.custom_dictionary_raw;
    }
  } catch (e) {}

  btnSaveDict.addEventListener('click', async () => {
    const rawText = customDictText.value;
    const parsedDict = {};

    const lines = rawText.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join('=').trim();
        if (key && val) {
          parsedDict[key] = val;
        }
      }
    }

    try {
      await chrome.storage.local.set({
        custom_dictionary_raw: rawText,
        custom_dictionary: parsedDict
      });

      // Notify active tabs of the new dictionary
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'UPDATE_CUSTOM_DICTIONARY',
            dictionary: parsedDict
          }).catch(() => {});
        }
      }
    } catch (e) {}

    // Show success on save button
    const origText = btnSaveDict.innerHTML;
    btnSaveDict.disabled = true;
    btnSaveDict.classList.add('success');
    btnSaveDict.textContent = 'Сохранено!';

    setTimeout(() => {
      btnSaveDict.classList.remove('success');
      btnSaveDict.disabled = false;
      btnSaveDict.innerHTML = origText;
      // Auto-collapse after saving is done
      dictContainer.classList.add('collapsed');
      toggleDict.classList.remove('expanded');
    }, 1000);
  });

  // Collapsible Dictionary Toggle Logic
  const toggleDict = document.getElementById('toggleDict');
  const dictContainer = document.getElementById('dictContainer');

  toggleDict.addEventListener('click', () => {
    const isCollapsed = dictContainer.classList.toggle('collapsed');
    toggleDict.classList.toggle('expanded', !isCollapsed);
  });

  // Default Slang Toggle Logic
  const toggleDefaultSlang = document.getElementById('toggleDefaultSlang');
  const defaultSlangList = document.getElementById('defaultSlangList');
  if (toggleDefaultSlang && defaultSlangList) {
    toggleDefaultSlang.addEventListener('click', () => {
      const isListCollapsed = defaultSlangList.classList.toggle('collapsed');
      const arrow = toggleDefaultSlang.querySelector('.slang-collapse-icon');
      if (arrow) {
        arrow.style.transform = isListCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });
  }
});
