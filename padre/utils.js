function textHash(text) {
  let hash = 5381;
  let prevSpace = true;
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);

    if (c >= 65 && c <= 90) c += 32;

    if (c <= 32) {
      if (prevSpace) continue;
      prevSpace = true;
      c = 32;
    } else {
      prevSpace = false;
    }
    hash = ((hash << 5) + hash) + c;
    hash = hash & hash;
  }
  return 'tx_' + (hash >>> 0).toString(36);
}

function isRussianText(text) {
  let cyr = 0, lat = 0;
  const len = Math.min(text.length, 150);
  for (let i = 0; i < len; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0x0400 && c <= 0x04FF) cyr++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
  }
  return cyr > lat && cyr > 3;
}

function getFullTextContent(element) {
  return (element.textContent || '').trim();
}

function getSpacedTextContent(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const parts = [];
  let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent;
    if (t && t.trim()) parts.push(t.trim());
  }
  return parts.join(' ');
}

function withTimeout(promise, ms, abortController) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (abortController) abortController.abort();
      reject(new Error('Timeout'));
    }, ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

const _META_RX_COMBINED = /^(?:@\w{1,15}|\d[\d,.]*[KMBkmb]?\s*(?:followers?|following|Members)?|Joined\s.*|Replying to\s+@\w+|\d+[hms]|\d{1,2}:\d{2}\s*(?:AM|PM).*|[A-Za-z0-9]{30,}|(?:https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\/)\S*|(?:Show more|Show this thread|Read more(?:\s+on\s+\w+)?|Подробнее(?:\s+на\s+\w+)?)|(?:Hide|Show)\s+translation|Created\s+(?:at\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*|(?:View|See)\s+community.*|See profile.*|Your browser does not support.*|\d+\s*(?:likes?|retweets?|replies|quote tweets?|comments?)|Created by|\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря).*|#\w+|\d[\d,.]*[KMBkmb]?)$/i;
const _META_RX_SHORT = /^.+@\w{1,15}$/;

function isMetadataText(text) {
  const t = text.trim();
  if (_META_RX_COMBINED.test(t)) return true;
  if (t.length <= 40 && _META_RX_SHORT.test(t)) return true;
  return false;
}

function isInsideUrlAnchor(node) {
  let el = node.parentElement;
  while (el) {
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (!href.startsWith('http') && !href.startsWith('//')) return false;
      const linkText = (el.textContent || '').trim();

      if (linkText.length > 120) return false;

      if (linkText.includes(' ')) {
        if (/[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(linkText)) return true;
        return false;
      }
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

const _CTN_HANDLE = /@\w{1,15}/;
const _CTN_HANDLE_START = /^@\w{1,15}(\s*\+?\s*)$/;
const _CTN_AFTER_HANDLE = /^.*?@\w{1,15}\s*/;
const _CTN_AFTER_TIME = /^\d+[hmsд]\s*/i;
const _CTN_SKIP = [
  /^Joined\s/i,
  /^Joined$/i,
  /^\d[\d,.]*[KMBkmb]?\s*(followers|following)/i,
  /^(Following|Followers|See profile.*)$/i,
  /^\d+[hmsд]$/i,
  /^[hmsд]$/i,
  /^Created\s+(at\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  /^Created$/i,
  /^(?:View|See) community/i,
  /^(Hide|Show)\s+translation$/i,
  /^\d+\s*(likes?|retweets?|replies|quote tweets?|comments?)$/i,
  /^Created by$/i,
  /^\d[\d,.]*[KMBkmb]?\s*Members$/i,
  /^(Read more|Подробнее)( (on|на) \w+)?$/i,
  /^\d{1,2}:\d{2}\s*(AM|PM)/i,
  /^(AM|PM)\s*[·.]/i,
  /^\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
  /^#\w+$/,
  /^\d[\d,.]*[KMBkmb]?$/,
  /^[A-Za-z0-9]{30,}$/,
  /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\/)\S*$/i,
];
const _CTN_HAS_LETTER = /[a-zA-Z\u0400-\u04FF]/;

function collectTranslatableTextNodes(element) {

  const elText = getSpacedTextContent(element);
  const isBroadPopup = _CTN_HANDLE.test(elText) && /Joined\s/i.test(elText);

  const result = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let foundHandle = !isBroadPopup;

  let collectingTweet = false;

  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    if (!text || !text.trim()) continue;

    const trimmed = text.trim();

    if (isInsideUrlAnchor(node)) {
      if (/^[a-z0-9][\w.-]*\.[a-z]{2,}(\/\S*)?[…]?$/i.test(trimmed)) {
        result.push({ node, text: '', isUrl: true });
        if (isBroadPopup) collectingTweet = true;
      }
      continue;
    }

    if (_CTN_HANDLE_START.test(trimmed)) {
      if (isBroadPopup) {
        if (!foundHandle) {
          foundHandle = true;
        } else if (collectingTweet) {

          break;
        }
      }
      continue;
    }

    if (node.parentElement?.closest?.('h1,h2,h3,h4,h5,h6')) continue;

    if (node.parentElement?.classList?.contains('MuiTypography-noWrap')) continue;

    if (!foundHandle) {

      if (_CTN_HANDLE.test(trimmed)) {
        foundHandle = true;

        const afterHandle = trimmed.replace(_CTN_AFTER_HANDLE, '');
        const afterTime = afterHandle.replace(_CTN_AFTER_TIME, '');
        if (afterTime.length >= 5 && !isMetadataText(afterTime)) {
          collectingTweet = true;
          result.push({ node: node, text: afterTime });
        }
      }
      continue;
    }

    if (trimmed.length < 3 && !_CTN_HAS_LETTER.test(trimmed)) continue;

    let skip = false;
    for (let i = 0; i < _CTN_SKIP.length; i++) {
      if (_CTN_SKIP[i].test(trimmed)) { skip = true; break; }
    }
    if (skip) continue;

    if (/^[a-z0-9][\w.-]*\.[a-z]{2,}(\/\S*)?[…]?$/i.test(trimmed)) {
      result.push({ node, text: '', isUrl: true });
      if (isBroadPopup) collectingTweet = true;
      continue;
    }

    if (!/\s/.test(trimmed) && trimmed.length < 20 && !/[.!?;:,]/.test(trimmed)) {
      let sib = node.previousSibling;
      while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.previousSibling;
      let linkEl = (sib && sib.tagName === 'A') ? sib : null;
      if (!linkEl) {
        sib = node.nextSibling;
        while (sib && sib.nodeType === 3 && !sib.textContent.trim()) sib = sib.nextSibling;
        linkEl = (sib && sib.tagName === 'A') ? sib : null;
      }
      if (linkEl) {
        const isNonAscii = /[^\x00-\x7F]/.test(trimmed);
        const linkRef = ((linkEl.textContent || '') + ' ' + (linkEl.getAttribute('href') || '')).toLowerCase();
        if (isNonAscii || linkRef.includes(trimmed.toLowerCase())) {
          result.push({ node, text: '', isCardLabel: true });
          if (isBroadPopup) collectingTweet = true;
          continue;
        }
      }
    }

    result.push({ node, text: trimmed });
    if (isBroadPopup) collectingTweet = true;
  }

  return result;
}

const _cleanTextCache = new Map();
const _CLEAN_CACHE_MAX = 2000;

const _CLEAN_RX = [
  [/\b[A-Za-z0-9]{30,}\b/g, ''],
  [/https?:\/\/\S+/g, ''],
  [/\bt\.co\/\S+/g, ''],
  [/\b[a-z0-9-]+\.[a-z]{2,}\/\S*/gi, ''],
  [/\d{1,2}:\d{2}\s*(AM|PM)[,·\s]*(\w+\s+\d{1,2},?\s+\d{4})?/gi, ''],
  [/Joined\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*(\s+\d{4})?/gi, ''],
  [/\d[\d,.]*[KMBkmb]?\s*(followers|following)/gi, ''],
  [/Your browser does not support the (video|audio) tag\.?/gi, ''],
  [/Created\s+(at\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*(\s+\d{4})?/gi, ''],
  [/(?:View|See) community( on\s+\w+)?\.?/gi, ''],
  [/See profile( on\s+\w+)?\.?/gi, ''],
  [/\b(Hide|Show)\s+translation\b/gi, ''],
  [/\bCreated by\b/gi, ''],
  [/\d[\d,.]*[KMBkmb]?\s*Members/gi, ''],
  [/(Подробнее|Read more)\s*(на|on)\s*\w+\.?/gi, ''],
  [/(AM|PM)\s*[·.]\s*\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}\s*(г\.?)?/gi, ''],
];
const _CLEAN_TRIM = /^\s*[,.\s·]+|[,.\s·]+\s*$/g;
const _CLEAN_SPACES = /\s{2,}/g;

function cleanTweetText(text) {
  const cached = _cleanTextCache.get(text);
  if (cached !== undefined) return cached;

  let cleaned = text;
  for (let i = 0; i < _CLEAN_RX.length; i++) {
    cleaned = cleaned.replace(_CLEAN_RX[i][0], _CLEAN_RX[i][1]);
  }

  cleaned = cleaned.replace(_CLEAN_TRIM, '');
  cleaned = cleaned.replace(_CLEAN_SPACES, ' ').trim();

  if (_cleanTextCache.size >= _CLEAN_CACHE_MAX) {
    const first = _cleanTextCache.keys().next().value;
    _cleanTextCache.delete(first);
  }
  _cleanTextCache.set(text, cleaned);

  return cleaned;
}
