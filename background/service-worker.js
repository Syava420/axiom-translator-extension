importScripts('../popup/errorHandler.js');

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(['enabled', 'stats']);
  if (existing.enabled === undefined) {
    await chrome.storage.local.set({ enabled: true });
  }

  if (existing.stats === undefined) {
    await chrome.storage.local.set({
      stats: { translated: 0, cached: 0, errors: 0, preserved: 0 }
    });
  }
});

const _tweetCache = new Map();
const _TWEET_CACHE_MAX = 500;
const _TWEET_CACHE_TTL = 30 * 60 * 1000;

async function fetchTweetText(tweetId) {
  const cached = _tweetCache.get(tweetId);
  if (cached && Date.now() - cached.ts < _TWEET_CACHE_TTL) {
    return cached.data;
  }

  try {
    const fxAc = new AbortController();
    const fxTimer = setTimeout(() => fxAc.abort(), 2500);
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      credentials: 'omit', signal: fxAc.signal
    });
    clearTimeout(fxTimer);
    if (res.ok) {
      const json = await res.json();
      if (json.tweet?.text) {
        const result = { text: json.tweet.text, author: json.tweet.author?.screen_name || '', source: 'fxtwitter' };
        _cacheResult(tweetId, result);
        return result;
      }
    }
  } catch (e) {
    console.warn('[AxiomTranslator:SW] FxTwitter failed:', e.message);
  }

  try {
    const token = ((Number(tweetId) / 1e15) * Math.PI)
      .toString(36).replace(/(0+|\.)/g, '');
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 2500);
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`,
      { credentials: 'omit', signal: ac.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 2) {
        const json = JSON.parse(text);
        const tweetText = json.note_tweet?.text || json.text;
        if (tweetText) {
          const result = { text: tweetText, author: json.user?.screen_name || '', source: 'syndication' };
          _cacheResult(tweetId, result);
          return result;
        }
      }
    }
  } catch (e) {
    console.warn('[AxiomTranslator:SW] Syndication API failed:', e.message);
  }

  return null;
}

function _cacheResult(tweetId, data) {
  if (_tweetCache.size >= _TWEET_CACHE_MAX) {
    const firstKey = _tweetCache.keys().next().value;
    _tweetCache.delete(firstKey);
  }
  _tweetCache.set(tweetId, { data, ts: Date.now() });
}

const _ALLOWED_PROXY_ORIGINS = new Set([
  'https://translate.googleapis.com',
  'https://mozhi.pussthecat.org',
  'https://mozhi.r4fo.com',
  'https://mzh.dc09.xyz',
  'https://mozhi.adminforge.de',
  'https://mozhi.bloat.cat',
  'https://mozhi.ducks.party',
  'https://simplytranslate.org',
  'https://translate.plausibility.cloud',
  'https://api.mymemory.translated.net'
]);

function _isAllowedProxyUrl(url) {
  try {
    const origin = new URL(url).origin;
    return _ALLOWED_PROXY_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROXY_FETCH') {
    if (!_isAllowedProxyUrl(message.url)) {
      sendResponse({ status: 0, error: 'URL not in allowlist' });
      return true;
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    fetch(message.url, { credentials: 'omit', signal: ac.signal })
      .then(async r => {
        clearTimeout(timer);
        sendResponse({ status: r.status, text: await r.text() });
      })
      .catch(err => {
        clearTimeout(timer);
        sendResponse({ status: 0, error: err.message });
      });
    return true;
  }

  if (message.type === 'GET_TWEET_TEXT') {
    fetchTweetText(message.tweetId).then(result => {
      sendResponse(result);
    }).catch(() => {
      sendResponse(null);
    });
    return true;
  }

  if (message.type === 'UPDATE_STATS') {
    chrome.storage.local.set({ stats: message.stats });
  }
  return false;
});


