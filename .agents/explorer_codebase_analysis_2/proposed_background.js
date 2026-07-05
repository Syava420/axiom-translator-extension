// proposed_background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    performTranslation(request.text, request.targetLang)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(err => {
        console.error("Translation error details:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Cache in-memory to speed up consecutive lookups
const memoryCache = new Map();

async function performTranslation(text, targetLang) {
  if (!text || !text.trim()) return { text: '', src: 'Auto' };
  
  const cacheKey = `${targetLang}:${text}`;
  
  // 1. Try memory cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  
  // 2. Try chrome.storage.local cache
  try {
    const storageKey = `tr_${cacheKey}`;
    const stored = await chrome.storage.local.get(storageKey);
    if (stored && stored[storageKey]) {
      memoryCache.set(cacheKey, stored[storageKey]);
      return stored[storageKey];
    }
  } catch (e) {
    console.warn("Storage cache read error:", e);
  }
  
  // 3. Fetch from Google Translate API using client=at
  const url = `https://translate.googleapis.com/translate_a/single?client=at&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  const data = await res.json();
  
  const translatedText = data[0]
    ? data[0].map(item => item[0]).filter(Boolean).join('')
    : '';
  const srcLang = data[2] || 'auto';
  
  const result = { text: translatedText, src: srcLang };
  
  // Save to caches
  memoryCache.set(cacheKey, result);
  try {
    const storageKey = `tr_${cacheKey}`;
    await chrome.storage.local.set({ [storageKey]: result });
  } catch (e) {
    console.warn("Storage cache write error:", e);
  }
  
  return result;
}
