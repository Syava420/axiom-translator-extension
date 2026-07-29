const BLOCK_TAGS = new Set(['div', 'p', 'section', 'article', 'header', 'footer',
  'nav', 'aside', 'main', 'ul', 'ol', 'li', 'table', 'form', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'details']);

const RADIX_SELECTOR = '[data-radix-popper-content-wrapper]';
const POPUP_CONTAINER_SELECTOR = RADIX_SELECTOR + ',[role="tooltip"],[class*="popover"],[class*="tooltip"],.pointer-events-auto.fixed';

const _OB_X_PROFILE = /^https?:\/\/(x\.com|twitter\.com)\/\w/i;
const _OB_TIME_AGO = /\b\d{1,3}[hmd]\b/i;
const _OB_MEMBERS = /\d+\s*Members/i;
const _OB_CREATED_BY = /Created by/i;
const _OB_REPLYING = /^Replying to\s+@/i;
const _OB_REPLYING_EXACT = /^Replying to\s+@\w+\s*$/i;
const _OB_HANDLE_START = /^@\w{1,15}/;
const _OB_JOINED = /Joined/i;
const _OB_JOINED_S = /Joined\s/i;
const _OB_FOLLOWERS_SIG = /\d[\d,.]*[KMBkmb]?\s*(followers|following)/i;
const _OB_PROFILE_PREFIX = /^[a-z][\w\s.\-·]*@\w{1,15}/i;
const _OB_STRIP_PREFIX = /^[\s\S]*?@\w{1,15}\s*/;
const _OB_STRIP_TIME = /^\d+[hmsд]\s*/i;

const _OB_HAS_CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

const _DELAYS_CATCHUP = [50, 200, 700];
const _DELAYS_POPUP_CHECK = [30, 100, 350, 800, 2000];
const _DELAYS_SCAN = [80, 250, 700, 1800, 3500];

function hasBlockChildren(el) {
  for (const child of el.children) {
    if (BLOCK_TAGS.has(child.tagName.toLowerCase())) return true;
  }
  return false;
}

function _hasOnlyBrChildren(el) {
  if (el.children.length === 0) return false;
  for (const child of el.children) {
    if (child.tagName !== 'BR') return false;
  }
  return true;
}

function _padWithOrigWhitespace(raw, translated) {
  if (!raw) return translated;
  let i = 0;
  while (i < raw.length && raw.charCodeAt(i) <= 32) i++;
  let j = raw.length;
  while (j > i && raw.charCodeAt(j - 1) <= 32) j--;
  return raw.slice(0, i) + translated + raw.slice(j);
}

function _translateMetadataInPopup(popupRoot) {
  if (!popupRoot) return;
  const walker = document.createTreeWalker(popupRoot, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent;
    if (!text) continue;
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (isMetadataText(trimmed)) {
      const translated = translateMetadata(trimmed);
      if (translated && translated !== trimmed) {
        node.textContent = _padWithOrigWhitespace(text, translated);
      }
    }
  }
}

const TEXT_BEARING_SELECTOR = 'div,span,p,a,section,article,h1,h2,h3,h4,h5,h6,blockquote,pre,li,td,th,label,figcaption,em,strong,b,i,small,dd,dt';

const _loggedFindTweet = new WeakSet();

function findTweetTextElements(popupRoot) {
  _translateMetadataInPopup(popupRoot);
  const rawRootText = popupRoot.textContent || '';
  const rootText = rawRootText.includes('Members') && rawRootText.includes('Created by')
    ? getSpacedTextContent(popupRoot) : '';
  if (rootText && _OB_MEMBERS.test(rootText) && _OB_CREATED_BY.test(rootText)) {
    const paras = popupRoot.querySelectorAll('p');
    for (const p of paras) {
      if (p.querySelector('a[href*="/communities/"]')) continue;
      if (p.closest('a[href*="/communities/"]')) continue;
      const text = cleanTweetText(getFullTextContent(p));
      if (text.length >= 20 && !isMetadataText(text)) {
        if (CONFIG.DEBUG) console.log('[AxiomTranslator]   Community: "' + text.substring(0, 80) + '" (' + text.length + 'ch)');
        return [p];
      }
    }
    const descEls = popupRoot.querySelectorAll('div,span');
    for (const el of descEls) {
      if (el.children.length > 5) continue;
      if (el.closest('a[href*="/communities/"]')) continue;
      if (el.querySelector('a[href*="/communities/"]')) continue;
      if (hasBlockChildren(el)) continue;
      const text = cleanTweetText(getFullTextContent(el));
      if (text.length >= 20 && !isMetadataText(text) && !isRussianText(text)) {
        if (CONFIG.DEBUG) console.log('[AxiomTranslator]   Community (non-p): "' + text.substring(0, 80) + '" (' + text.length + 'ch)');
        return [el];
      }
    }
    if (CONFIG.DEBUG) console.log('[AxiomTranslator]   Community popup — no description, skip');
    return [];
  }

  let textCandidates = [];
  let layoutCandidates = [];
  const broadCandidates = [];
  const _handleEls = [];

  const allElements = popupRoot.querySelectorAll(TEXT_BEARING_SELECTOR);

  let mediaContainers = null;
  if (popupRoot.querySelector('video,audio,iframe,noscript')) {
    mediaContainers = popupRoot.querySelectorAll('video,audio,iframe,noscript');
  }

  for (const el of allElements) {
    { const _t = el.textContent || '';
      if (_t.length < 30 && _OB_HANDLE_START.test(_t)) _handleEls.push(el); }

    if (el.children.length > 30) continue;

    const tn = el.tagName;
    if (tn === 'H1' || tn === 'H2' || tn === 'H3' || tn === 'H4' || tn === 'H5' || tn === 'H6') continue;
    if (el.closest('h1,h2,h3,h4,h5,h6')) continue;

    const ancestorLink = tn === 'A' ? el : el.closest('a');
    if (ancestorLink && ancestorLink.href) {
      if (ancestorLink.href.includes('/communities/')) continue;
      if (_OB_X_PROFILE.test(ancestorLink.href) && !ancestorLink.href.includes('/status/')) continue;
    }

    if (mediaContainers) {
      let insideMedia = false;
      for (const media of mediaContainers) {
        if (media.contains(el)) { insideMedia = true; break; }
      }
      if (insideMedia) continue;
    }

    const fullText = getFullTextContent(el);
    if (fullText.length < CONFIG.DETECTION.MIN_TWEET_TEXT_LENGTH) continue;

    const cleanedText = cleanTweetText(fullText);
    if (cleanedText.length < CONFIG.DETECTION.MIN_TWEET_TEXT_LENGTH) continue;

    if (isMetadataText(cleanedText)) continue;

    if (_OB_REPLYING.test(cleanedText) && hasBlockChildren(el)) continue;

    if (!ancestorLink) {
      const _childCommLink = el.querySelector?.('a[href*="/communities/"]');
      if (_childCommLink) {
        const commNameLen = getFullTextContent(_childCommLink).length;
        if (commNameLen >= fullText.length * 0.5) continue;
      }
    }

    if (fullText.length < 40 && el.parentElement &&
        el.parentElement.querySelector('i[class*="ri-map-pin"]')) continue;

    const isBroadContainer = CONFIG.DETECTION.HANDLE_REGEX.test(fullText) && _OB_JOINED.test(fullText) &&
        _OB_FOLLOWERS_SIG.test(fullText);

    let depth = 0;
    let current = el;
    while (current && current !== popupRoot) {
      depth++;
      current = current.parentElement;
    }

    const candidate = {
      element: el,
      text: cleanedText,
      length: cleanedText.length,
      depth: depth,
      childCount: el.children.length
    };

    if (isBroadContainer) {
      broadCandidates.push(candidate);
    } else if (el.children.length === 0 || !hasBlockChildren(el)) {
      textCandidates.push(candidate);
    } else {
      layoutCandidates.push(candidate);
    }
  }

  if (_handleEls.length > 0) {
    const popupText = popupRoot.textContent || '';
    const isProfilePopup = _OB_JOINED_S.test(popupText) &&
        _OB_FOLLOWERS_SIG.test(popupText);

    const _isDisplayName = (c) => {
      if (c.length >= 40) return false;
      if (!isProfilePopup && !c.element.closest('.font-semibold, .font-bold')) return false;
      for (const h of _handleEls) {
        if (c.element.compareDocumentPosition(h) & 4) return true;
      }
      return false;
    };
    textCandidates = textCandidates.filter(c => !_isDisplayName(c));
    layoutCandidates = layoutCandidates.filter(c => !_isDisplayName(c));
  }

  let bestT1Len = 0;
  for (let i = 0; i < textCandidates.length; i++)
    if (textCandidates[i].length > bestT1Len) bestT1Len = textCandidates[i].length;
  let bestT2Len = 0;
  for (let i = 0; i < layoutCandidates.length; i++)
    if (layoutCandidates[i].length > bestT2Len) bestT2Len = layoutCandidates[i].length;
  let bestT3Len = 0;
  for (let i = 0; i < broadCandidates.length; i++)
    if (broadCandidates[i].length > bestT3Len) bestT3Len = broadCandidates[i].length;

  let candidates;
  if (textCandidates.length > 0) {
    if (bestT1Len < 40 && bestT2Len > bestT1Len * 3) {
      const nonOverlapping = layoutCandidates.filter(lc =>
        !textCandidates.some(tc => lc.element.contains(tc.element))
      );
      candidates = [...textCandidates, ...nonOverlapping];
    } else if (bestT1Len < 40 && bestT3Len > bestT1Len * 3) {
      const nonOverlapping = broadCandidates.filter(bc =>
        !textCandidates.some(tc => bc.element.contains(tc.element))
      );
      candidates = [...textCandidates, ...nonOverlapping];
    } else {
      candidates = textCandidates;
    }
  } else if (layoutCandidates.length > 0) {
    if (bestT2Len < 40 && bestT3Len > bestT2Len * 3 && broadCandidates.length > 0) {
      const nonOverlapping = broadCandidates.filter(bc =>
        !layoutCandidates.some(lc => bc.element.contains(lc.element))
      );
      candidates = [...layoutCandidates, ...nonOverlapping];
    } else {
      candidates = layoutCandidates;
    }
  } else {
    candidates = broadCandidates;
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (ratio < 0.8) return b.length - a.length;
    return b.depth - a.depth;
  });

  const results = [];
  const seen = new Set();

  for (const candidate of candidates) {
    let isDuplicate = false;
    for (const found of results) {
      if (found.element.contains(candidate.element) || candidate.element.contains(found.element)) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;
    if (seen.has(candidate.text)) continue;
    seen.add(candidate.text);
    results.push(candidate);
    if (results.length >= 2) break;
  }

  if (results.length === 0 && broadCandidates.length > 0) {
    broadCandidates.sort((a, b) => b.length - a.length);
    results.push(broadCandidates[0]);
    if (CONFIG.DEBUG) console.log('[AxiomTranslator]   T3 FALLBACK → using T3 (' + broadCandidates[0].length + 'ch)');
  }

  if (CONFIG.DEBUG && !_loggedFindTweet.has(popupRoot)) {
    _loggedFindTweet.add(popupRoot);
    const tierUsed = candidates === textCandidates ? 'T1' : candidates === layoutCandidates ? 'T2' : 'T3';
    if (textCandidates.length > 0) {
      textCandidates.forEach((c, i) =>
        console.log('[AxiomTranslator]   T1[' + i + ']: "' + c.text.substring(0, 70) + '" (' + c.length + 'ch, depth=' + c.depth + ')')
      );
    }
    if (layoutCandidates.length > 0) {
      layoutCandidates.forEach((c, i) =>
        console.log('[AxiomTranslator]   T2[' + i + ']: "' + c.text.substring(0, 70) + '" (' + c.length + 'ch, depth=' + c.depth + ')')
      );
    }
    if (broadCandidates.length > 0) {
      console.log('[AxiomTranslator]   T3: ' + broadCandidates.length + ' broad, best=' + bestT3Len + 'ch');
    }
    if (results.length > 0) {
      results.forEach((r, i) =>
        console.log('[AxiomTranslator]   → result[' + i + '] (' + tierUsed + '): "' + r.text.substring(0, 80) + '" (' + r.length + 'ch)')
      );
    } else {
      console.log('[AxiomTranslator]   → nothing selected');
    }
  }

  const mainResults = results.map(r => r.element);

  if (mainResults.length > 0 && _OB_HAS_CJK.test(rawRootText)) {
    for (const el of allElements) {
      if (mainResults.includes(el)) continue;
      if (el.dataset?.translated) continue;
      if (hasBlockChildren(el)) continue;
      if (el.children.length > 10) continue;
      const etn = el.tagName;
      if (etn === 'H1' || etn === 'H2' || etn === 'H3' || etn === 'H4' || etn === 'H5' || etn === 'H6') continue;
      if (el.closest('h1,h2,h3,h4,h5,h6')) continue;
      const eLink = etn === 'A' ? el : el.closest('a');
      if (eLink && eLink.href) {
        if (eLink.href.includes('/communities/')) continue;
        if (_OB_X_PROFILE.test(eLink.href) && !eLink.href.includes('/status/')) continue;
      }
      const eText = cleanTweetText(getFullTextContent(el));
      if (eText.length < 15) continue;
      if (_OB_HAS_CJK.test(eText)) continue;
      if (isRussianText(eText)) continue;
      if (isMetadataText(eText)) continue;
      if (mainResults.some(m => el.contains(m))) continue;
      el._axiomEmbeddedTranslation = true;
      mainResults.push(el);
      if (CONFIG.DEBUG) console.log('[AxiomTranslator]   EMBEDDED: "' + eText.substring(0, 80) + '" (' + eText.length + 'ch)');
      break;
    }
  }

  return mainResults;
}

function checkPopup(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
  if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'LINK') return null;

  const nodeText = node.textContent || '';
  if (/select emoji|выбрать смайл/i.test(nodeText)) return null;

  const classIdStr = (node.className && typeof node.className === 'string' ? node.className : '') + ' ' + (node.id || '');
  if (/emoji/i.test(classIdStr)) return null;

  if (node.querySelector && (
    node.querySelector('[class*="emoji" i]') || 
    node.querySelector('[id*="emoji" i]') ||
    node.querySelector('[class*="Emoji"]') ||
    node.querySelector('[id*="Emoji"]')
  )) {
    return null;
  }

  if (node.querySelector('[data-translated="true"]') ||
      node.querySelector('.axiom-tx-panel') ||
      node.dataset?.translated === 'true' ||
      node.classList?.contains('axiom-tx-panel')
  ) {
    return null;
  }

  let popupEl = node.matches?.(POPUP_CONTAINER_SELECTOR) ? node : null;
  if (!popupEl) {
    popupEl = node.querySelector(POPUP_CONTAINER_SELECTOR);
  }
  const isConfirmedPopup = !!popupEl;

  const allText = getSpacedTextContent(node);
  const checkText = allText.length > 600
    ? allText.substring(0, 300) + ' ' + allText.substring(allText.length - 300)
    : allText;

  const hasHandle = CONFIG.DETECTION.HANDLE_REGEX.test(checkText) || /@\s\w{1,15}/.test(checkText);
  const hasFollowers = CONFIG.DETECTION.FOLLOWERS_REGEX.test(checkText);
  const hasJoinDate = CONFIG.DETECTION.JOIN_DATE_REGEX.test(checkText);
  const hasTimeAgo = _OB_TIME_AGO.test(checkText);
  const hasMembersCount = _OB_MEMBERS.test(checkText);
  const twitterSignals = (hasHandle ? 1 : 0) + (hasFollowers ? 1 : 0) + (hasJoinDate ? 1 : 0) + (hasTimeAgo ? 1 : 0) + (hasMembersCount ? 1 : 0);

  if (isConfirmedPopup && popupEl) {
    const rect = popupEl.getBoundingClientRect();
    if (rect.width > 0 && rect.width < 200 && rect.height > 0 && rect.height < 60) {
      return null;
    }
  }

  let isLikelyPopup = (isConfirmedPopup && twitterSignals >= 1);

  if (!isLikelyPopup && !isConfirmedPopup && twitterSignals >= 1) {
    const cs = window.getComputedStyle(node);
    const isOverlay = (cs.position === 'fixed' || cs.position === 'absolute') &&
                      parseInt(cs.zIndex) >= 100;
    if (isOverlay && (
      twitterSignals >= CONFIG.DETECTION.MIN_TWITTER_SIGNALS ||
      (hasHandle && allText.length > 80)
    )) {
      isLikelyPopup = true;
    }
  }

  if (!isLikelyPopup) {
    if (CONFIG.DEBUG && twitterSignals > 0) {
      console.log('[AxiomTranslator]   REJECT: signals=' + twitterSignals +
        ' confirmed=' + isConfirmedPopup +
        ' handle=' + hasHandle + ' followers=' + hasFollowers +
        ' joined=' + hasJoinDate + ' timeAgo=' + hasTimeAgo +
        ' len=' + allText.length +
        ' text="' + allText.substring(0, 80).replace(/\n/g, ' ') + '..."');
    }
    return null;
  }

  const popupRoot = popupEl || node;
  return { popupRoot, isConfirmedPopup, twitterSignals, hasHandle, hasFollowers, hasJoinDate, hasTimeAgo, allText };
}

function looksLikePopup(node) {
  if (node.querySelector(POPUP_CONTAINER_SELECTOR)) return true;
  if (node.matches?.('[role="dialog"]')) return true;
  if (node.parentElement === document.body) {
    const pos = node.style.position;
    if (pos === 'fixed' || pos === 'absolute') return true;
    if (!pos) {
      const cs = window.getComputedStyle(node);
      if (cs.position === 'fixed' || cs.position === 'absolute') return true;
    }
  }
  return false;
}

function findAncestorPopup(node) {
  let el = node.parentElement;
  let depth = 0;
  while (el && el !== document.body && depth < 15) {
    if (el.matches?.(POPUP_CONTAINER_SELECTOR)) {
      return checkPopup(el);
    }
    el = el.parentElement;
    depth++;
  }
  return null;
}
