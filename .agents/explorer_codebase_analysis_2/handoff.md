# Handoff Report - Codebase Analysis & Issue Investigation

## 1. Observation

During the read-only investigation of the `axiom-translator-extension` codebase (`manifest.json`, `background.js`, and `content.js`), the following specific details were observed:

### CORS/CSP configuration:
- In `manifest.json`, the extension uses Manifest V3 and declares host permissions:
  ```json
  "host_permissions": [
    "https://translate.googleapis.com/*"
  ]
  ```
- In `content.js`, translation requests are sent to `background.js` via message passing:
  ```javascript
  // Line 381:
  chrome.runtime.sendMessage({
    action: 'translate',
    text: text,
    ...
  ```
- In `background.js`, the fetch request is made directly from the background service worker:
  ```javascript
  // Line 21-23:
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  ```

### HTTP 429 and Scanner Loops:
- The content script runs a scanner loop every 150ms:
  ```javascript
  // Line 611:
  setInterval(checkAndTranslateCard, 150);
  ```
- `findActiveCard()` queries all `img` elements in the DOM on every interval tick and climbs up to 6 parent levels searching for `@` and `followers` text:
  ```javascript
  // Line 547-555:
  function findActiveCard() {
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (img.offsetWidth > 0 && img.offsetHeight > 0) {
        let temp = img.parentElement;
        for (let i = 0; i < 6 && temp; i++) {
          ...
  ```
- There is **no debouncing** for network requests when hovering different cards or selecting text.
- There is **no caching** of translations. Hovering a card, leaving it, and hovering it again causes a fresh network fetch to Google Translate API.

### Hover / Hide Behavior:
- The translator card width is matches the original card's width dynamically:
  ```javascript
  // Line 353-354:
  const cardWidth = rect.width && rect.width > 200 ? rect.width : 350;
  translationCard.style.width = cardWidth + 'px';
  ```
- `hideCard()` in `content.js` does not reset the selection state:
  ```javascript
  // Line 342-345:
  function hideCard() {
    translationCard.style.display = 'none';
    window.speechSynthesis.cancel();
  }
  ```
- Selection translations are triggered on `mouseup` and set `currentTargetSelection`:
  ```javascript
  // Line 619:
  currentTargetSelection = selection.getRangeAt(0).cloneRange();
  ```
- Moving the mouse calls `checkAndTranslateCard` and triggers `checkHide()`, which hides the card if `isHoveringTranslation` is false, meaning selection translation closes immediately on mouse movement unless the user keeps the mouse cursor directly on top of the translation card.

### Month Abbreviations & Metadata Translations:
- The metadata translation helper uses simple regexes with `\b` boundaries:
  ```javascript
  // Line 46-78:
  function translateMetadata(text) {
    ...
    res = res.replace(/Joined/i, 'Регистрация:');
    ...
    const shortMonths = {
      'Jan': 'янв.', 'Feb': 'февр.', 'Mar': 'мар.', ...
    };
    ...
    Object.entries(shortMonths).forEach(([eng, rus]) => {
      const reg = new RegExp('\\b' + eng + '\\b', 'gi');
      res = res.replace(reg, rus);
    });
  ```
- Since Latin word boundaries `\b` are not fully Unicode-aware in Javascript, they can behave inconsistently when mixed with Cyrillic characters. Also, if a month abbreviation like `Mar.` already contains a period, replacing `Mar` with `мар.` results in double periods (`мар..`).

---

## 2. Logic Chain

1. **CORS/CSP Issues**: Page-level CSP (Content Security Policy) rules on `axiom.trade` restrict page scripts from querying external domains. By utilizing MV3 background script message proxying and declaring `"https://translate.googleapis.com/*"` under `host_permissions` in `manifest.json`, the extension successfully bypasses page-level CORS/CSP. Google Translate API redirects and rate limits can be further reduced by changing the API client query parameter from `client=gtx` to `client=at`.
2. **HTTP 429 Prevention**: 
   - *Issue*: `findActiveCard()` queries the entire DOM every 150ms, and hovers trigger API requests instantly without debouncing or caching, easily leading to rate-limiting blocks (HTTP 429).
   - *Fix*: Eliminate the global DOM scanner loop. Replace it with event-driven `mouseover`/`mouseout` listeners. Use a lightweight 300ms interval to only verify if the currently hovered card has disappeared from the DOM.
   - *Fix*: Debounce translation requests by 300ms using a timeout. If the user moves away before 300ms, cancel the request.
   - *Fix*: Cache translation results. Implement an in-memory `Map` cache and persist it to `chrome.storage.local` to survive background service worker suspensions (as `"storage"` is already in `manifest.json`).
3. **Hover/Hide Behavior**:
   - *Issue*: The card stays open when the user hovers off the card, because the scanner finds the first visible card on the page even if not hovered. Also, selection translations close prematurely on mouse movement because the selection range is not cleared on hide.
   - *Fix*: Track mouse hover states via `isHoveringCard` and `isHoveringTranslation`. Implement a 300ms grace period on hover-out: if the mouse leaves both the card and translation card, trigger `hideCard()`.
   - *Fix*: Check if `currentTargetSelection` is active. If yes, skip the mouse-hover-off auto-hide logic. Reset `currentTargetSelection = null` in `hideCard()` to prevent state contamination.
4. **Metadata Translation Correctness**:
   - *Issue*: Replacing `Mar` can match substrings in `March` if boundaries fail, causing output like `мар.ch`. Additionally, abbreviations with periods (e.g. `Mar.`) result in double periods `мар..`.
   - *Fix*: Combine full months and short abbreviations into a single map sorted by key length descending. Use a negative lookahead regex pattern `\bmonth(?![a-zA-Z])` and include optional periods in the match (e.g. `mar\.?`). This ensures `March` is translated to `март`, and `Mar.` is matched entirely (consuming the period) to output a single `мар.`.

---

## 3. Caveats

- **DOM Structure Dependency**: The parser uses class-agnostic heuristics (`@` sign, `followers`, and `img` tag) to locate cards on `axiom.trade`. If the webpage structure changes significantly, these heuristics may need adjustments.
- **Google Translate API Availability**: The free `/translate_a/single` endpoint is undocumented and subject to changes or blocks by Google if volume is excessively high, though caching and debouncing mitigate this risk.

---

## 4. Conclusion

The extension contains significant performance bottlenecks and bugs (lack of cache, lack of debounce, heavy scanner loops, broken hover-off dismissal, and broken selection translations) that will trigger HTTP 429 rate limits and cause poor UX. 

We recommend replacing the content of `background.js` and `content.js` with the proposed implementations:
- `proposed_background.js`: Implements `client=at` and persistent caching via `chrome.storage.local`.
- `proposed_content.js`: Implements efficient event-driven card detection, 300ms request debouncing, state-based hover-off auto-dismissal, selection preservation, and lookahead regexes for correct month/metadata translations.

---

## 5. Verification Method

### Manual Verification Steps:
1. Open Google Chrome or Microsoft Edge, go to `chrome://extensions/`.
2. Enable "Developer mode" (toggle in the top-right corner).
3. Click "Load unpacked" and select the extension directory (`C:\Users\Neuron\.gemini\antigravity\scratch\axiom-translator-extension`).
4. Navigate to `axiom.trade` (or load a mock page containing Twitter-style user cards).
5. **Verify Hover-On**: Place the cursor over a card. A translation card should appear on the side after a 300ms delay.
6. **Verify Hover-Off**: Move the cursor off both the card and the translation card. The translator card should close after a 300ms grace period.
7. **Verify Caching**: Hover off a card and hover back on. The translation should display instantly without triggering new fetch requests in the developer tools network log.
8. **Verify Selection**: Highlight text on the page. The translation card should appear and remain open even if you move the mouse around. It should close only when clicking outside the card, clicking the close button, or pressing `Escape`.
9. **Verify Date Translation**: Verify that "Joined March 2021" is translated to "Регистрация: март 2021" and "Joined Mar. 2021" is translated to "Регистрация: мар. 2021" without double periods.
