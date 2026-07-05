// proposed_content.js

(function() {
  // Prevent duplicate instances
  const existingCard = document.getElementById('antigravity-translator-card-wrapper');
  if (existingCard) {
    existingCard.remove();
  }

  let hoveredElement = null;
  let currentTargetEl = null;
  let currentTargetSelection = null;
  let activeTranslation = '';
  let lastTranslatedText = '';

  let lastTranslatedCard = null;
  let lastTranslatedCardText = '';
  
  // Hover tracking states
  let hoveredCard = null;
  let isHoveringCard = false;
  let isHoveringTranslation = false;
  let hideTimeout = null;
  let translationTimeout = null;

  // Track hovered element
  document.addEventListener('mouseover', (e) => {
    if (translationCard && translationCard.contains(e.target)) return;
    hoveredElement = e.target;
  });

  // Create the main absolute wrapper for our translation card
  const translationCard = document.createElement('div');
  translationCard.id = 'antigravity-translator-card-wrapper';
  translationCard.style.cssText = `
    position: absolute;
    z-index: 1000000000;
    display: none;
    box-sizing: border-box;
  `;
  document.body.appendChild(translationCard);

  // Track hover status on the translation card
  translationCard.addEventListener('mouseenter', () => {
    isHoveringTranslation = true;
    clearTimeout(hideTimeout);
  });
  translationCard.addEventListener('mouseleave', () => {
    isHoveringTranslation = false;
    checkHide();
  });

  // Helper: local translation of metadata
  function translateMetadata(text) {
    if (!text) return '';
    let res = text;
    
    // 1. Translate "Joined" and "followers" safely using word boundaries
    res = res.replace(/\bJoined\b/i, 'Регистрация:');
    res = res.replace(/\bfollowers\b/i, 'подписчиков');
    
    // 2. Map of months and their short forms (with optional periods)
    // Sorted with full months first to avoid substring replacement bugs.
    const monthsMap = {
      'january': 'январь', 'february': 'февраль', 'march': 'март', 'april': 'апрель',
      'may': 'май', 'june': 'июнь', 'july': 'июль', 'august': 'август',
      'september': 'сентябрь', 'october': 'октябрь', 'november': 'ноябрь', 'december': 'декабрь',
      
      'jan\\.?': 'янв.', 'feb\\.?': 'февр.', 'mar\\.?': 'мар.', 'apr\\.?': 'апр.',
      'jun\\.?': 'июнь', 'jul\\.?': 'июль', 'aug\\.?': 'авг.', 'sept\\.?': 'сент.',
      'sep\\.?': 'сент.', 'oct\\.?': 'окт.', 'nov\\.?': 'нояб.', 'dec\\.?': 'дек.'
    };
    
    for (const [eng, rus] of Object.entries(monthsMap)) {
      // Use negative lookahead to ensure we don't match a substring of a longer English word (e.g., "Mar" in "March")
      const reg = new RegExp('\\b' + eng + '(?![a-zA-Z])', 'gi');
      res = res.replace(reg, rus);
    }
    
    return res;
  }

  // Helper: extract raw number from followers text
  function extractNumber(text) {
    if (!text) return '';
    const match = text.match(/[\d\.,\+kKmM]+/);
    return match ? match[0] : text;
  }

  // Helper: Extract data from axiom.trade Twitter-like card
  function extractCardData(cardEl) {
    if (!cardEl) return null;
    
    const data = {
      cardEl: cardEl,
      avatar: '',
      name: '',
      handle: '',
      time: '',
      followers: '',
      joined: '',
      contentHtml: '',
      content: '',
      isVerified: false,
      isLocked: false
    };
    
    // Extract Avatar
    const img = cardEl.querySelector('img');
    if (img) {
      data.avatar = img.src;
    }
    
    // Extract SVGs (Verified status, lock status)
    const svgs = cardEl.querySelectorAll('svg');
    for (const svg of svgs) {
      const html = svg.innerHTML;
      if (svg.getAttribute('aria-label') === 'Verified account' || 
          html.includes('M22.5 12.5c0-1.58') || 
          html.includes('Verified')) {
        data.isVerified = true;
      }
      if (html.includes('M12.27 1.95') || html.includes('M20 22.5h-2')) {
        data.isLocked = true;
      }
    }
    
    // Extract Name & Handle
    const allElements = Array.from(cardEl.querySelectorAll('*'));
    let handleEl = allElements.find(el => el.childNodes.length === 1 && el.textContent.trim().startsWith('@'));
    if (!handleEl) {
      handleEl = allElements.find(el => el.textContent.trim().includes('@'));
    }
    
    if (handleEl) {
      data.handle = handleEl.textContent.trim().split(/\s+/)[0];
      
      // Look for Display Name
      let parent = handleEl.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const nameEl = siblings.find(el => el !== handleEl && !el.textContent.includes('@') && el.textContent.trim().length > 0);
        if (nameEl) {
          data.name = nameEl.textContent.trim();
        }
      }
      
      if (!data.name) {
        const boldEl = cardEl.querySelector('h1, h2, h3, b, strong, [style*="font-weight: bold"], [style*="font-weight:700"]');
        if (boldEl) {
          data.name = boldEl.textContent.trim();
        }
      }
    }
    
    // Extract Joined and Followers (using case-insensitive searches for robustness)
    const joinedEl = allElements.find(el => el.textContent.toLowerCase().includes('joined'));
    if (joinedEl) {
      data.joined = joinedEl.textContent.trim();
    }
    
    const followersEl = allElements.find(el => el.textContent.toLowerCase().includes('followers'));
    if (followersEl) {
      data.followers = followersEl.textContent.trim();
    }
    
    // Extract Time (e.g. 9m, 10m)
    const timeEl = allElements.find(el => {
      const text = el.textContent.trim();
      return /^\d+[mhds]$/.test(text);
    });
    if (timeEl) {
      data.time = timeEl.textContent.trim();
    } else {
      const greenEl = cardEl.querySelector('[class*="green"], [class*="success"], [style*="color: rgb(0, 186, 124)"]');
      if (greenEl && /^\d+/.test(greenEl.textContent.trim())) {
        data.time = greenEl.textContent.trim();
      }
    }
    
    // Extract Content Section
    const excludedTexts = [data.name, data.handle, data.time, data.joined, data.followers, 'Joined', 'followers'];
    let bestContentEl = null;
    let maxLen = 0;
    
    allElements.forEach(el => {
      if (el.children.length === 0 || Array.from(el.children).every(c => c.tagName === 'BR' || c.tagName === 'SPAN')) {
        const txt = el.textContent.trim();
        if (txt.length > 15 && !txt.includes('@') && !txt.toLowerCase().includes('joined') && !txt.toLowerCase().includes('followers')) {
          if (txt.length > maxLen) {
            maxLen = txt.length;
            bestContentEl = el;
          }
        }
      }
    });
    
    if (bestContentEl) {
      let container = bestContentEl;
      while (container && container !== cardEl) {
        const parent = container.parentElement;
        if (parent === cardEl) break;
        if (parent.textContent.toLowerCase().includes('joined') || parent.textContent.toLowerCase().includes('followers')) {
          break;
        }
        container = parent;
      }
      data.contentHtml = container.innerHTML;
      data.content = container.innerText;
    } else {
      const lines = cardEl.innerText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !excludedTexts.some(ex => l.includes(ex) || (ex && ex.includes(l))));
      data.content = lines.join('\n\n');
      data.contentHtml = lines.map(l => `<p style="margin-bottom: 20px; white-space: pre-wrap; margin-top: 0;">${l}</p>`).join('');
    }
    
    return data;
  }

  // Create the Replica Card HTML structure (using width: 100% to match dynamic wrapper width)
  function createCardHtml(data) {
    const isGeneric = !data.name;
    
    const avatarHtml = isGeneric ? `
      <div style="width: 64px; height: 64px; border-radius: 50%; background-color: #1d9bf0; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 24px; cursor: pointer; flex-shrink: 0;">
        T
      </div>
    ` : `
      <img alt="${data.name} Profile Picture" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid transparent; cursor: pointer; flex-shrink: 0;" src="${data.avatar || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}"/>
    `;
    
    const nameHtml = isGeneric ? 'Переводчик' : data.name;
    const handleHtml = isGeneric ? '@translator' : data.handle;
    
    const verifiedBadge = (!isGeneric && data.isVerified) ? `
      <svg aria-label="Verified account" style="width: 20px; height: 20px; fill: #1d9bf0; flex-shrink: 0;" role="img" viewbox="0 0 24 24"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.792-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.827 2.766 2.057 3.465-.05.31-.082.63-.082.95 0 2.21 1.71 4.002 3.918 4.002.47 0 .92-.086 1.336-.25C9.184 22.585 10.492 23.5 12 23.5s2.816-.915 3.337-2.25c.416.166.866.25 1.336.25 2.21 0 3.918-1.792 3.918-4 0-.32-.032-.64-.082-.95 1.23-.698 2.057-2.004 2.057-3.465zm-11.49 3.45l-3.23-3.23 1.41-1.41 1.82 1.82 4.67-4.67 1.41 1.41-6.08 6.08z"></path></g></svg>
    ` : '';

    const lockBadge = (!isGeneric && data.isLocked) ? `
      <svg aria-hidden="true" style="width: 18px; height: 18px; fill: currentColor; flex-shrink: 0;" viewbox="0 0 24 24"><g><path d="M12.27 1.95L8.9 5.32 7.5 3.9 12.27.6 15 3.32l-1.4 1.42-1.33-1.33v4.2l-2 2V1.95zm6.54 6.84l1.41-1.42L22 9.15l-1.41 1.42-1.78-1.78zm-3.5 3.5l1.42-1.41L18.5 12.6l-1.42 1.41-1.77-1.72zM5.5 11l-2 2 2.5 2.5 2-2-2.5-2.5zm-3 5.5l2-2 2.5 2.5-2 2-2.5-2.5zM20 22.5h-2v-4.58l-3.5-3.5-2.5 2.5v2.08h-2v-3.58l-5.5-5.5V11.5h2v-1.08l-2-2v-2l13.5 13.58h2V22.5z"></path></g></svg>
    ` : '';

    const timeHtml = data.time ? `<span style="color: #00ba7c; font-size: 14px; font-weight: 600;">${data.time}</span>` : '';
    
    // Stats Section (Joined / Followers)
    const statsHtml = (!isGeneric && (data.joined || data.followers)) ? `
      <div style="padding-left: 16px; padding-right: 16px; padding-bottom: 12px; display: flex; align-items: center; gap: 16px; color: #8b98a5; font-size: 15px; border-bottom: 1px solid #38444d; box-sizing: border-box;">
        ${data.joined ? `
          <div style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <svg aria-hidden="true" style="width: 18px; height: 18px; fill: currentColor; flex-shrink: 0;" viewbox="0 0 24 24"><g><path d="M7 4V3h2v1h6V3h2v1h1.5C19.88 4 21 5.12 21 6.5v12c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-12C3 5.12 4.12 4 5.5 4H7zm0 2H5.5c-.27 0-.5.22-.5.5v12c0 .28.23.5.5.5h13c.28 0 .5-.22.5-.5v-12c0-.28-.22-.5-.5-.5H17v1h-2V6H9v1H7V6zm0 6h2v-2H7v2zm0 4h2v-2H7v2zm4-4h2v-2h-2v2zm0 4h2v-2h-2v2zm4-4h2v-2h-2v2z"></path></g></svg>
            <span>${translateMetadata(data.joined)}</span>
          </div>
        ` : ''}
        ${data.followers ? `
          <div style="display: flex; gap: 4px; cursor: pointer;">
            <span style="font-weight: 700; color: #ffffff;">${extractNumber(data.followers)}</span>
            <span style="color: #8b98a5;">подписчиков</span>
          </div>
        ` : ''}
      </div>
    ` : '';

    const contentHtml = data.contentHtml ? data.contentHtml : `
      <p style="margin-bottom: 20px; white-space: pre-wrap; margin-top: 0;">${data.content}</p>
    `;

    return `
      <div style="background-color: #15202b; color: #ffffff; border-radius: 16px; width: 100%; max-width: 100%; box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6); border: 1px solid #38444d; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; box-sizing: border-box; position: relative;">
        <!-- Header Section -->
        <div style="padding: 16px; display: flex; justify-content: space-between; align-items: flex-start; box-sizing: border-box;">
          <div style="display: flex; gap: 12px; align-items: center;">
            ${avatarHtml}
            <div style="display: flex; flex-direction: column; justify-content: center;">
              <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <h1 style="font-weight: 700; font-size: 20px; line-height: 1.25; margin: 0; color: #ffffff;">${nameHtml}</h1>
                ${verifiedBadge}
              </div>
              <div style="display: flex; align-items: center; gap: 4px; color: #8b98a5; font-size: 16px;">
                <span>${handleHtml}</span>
                ${lockBadge}
              </div>
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <!-- X Logo (SVG) -->
            <svg aria-hidden="true" style="width: 24px; height: 24px; fill: #ffffff;" viewbox="0 0 24 24"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>
            ${timeHtml}
          </div>
        </div>
        
        <!-- Stats Section -->
        ${statsHtml}
        
        <!-- Content Section -->
        <div id="at-content-section" style="padding: 16px; padding-top: 20px; font-size: 17px; line-height: 1.6; color: #ffffff; box-sizing: border-box; flex-grow: 1;">
          ${contentHtml}
        </div>
        
        <!-- Control Toolbar Footer -->
        <div style="padding: 12px 16px; border-top: 1px solid #38444d; display: flex; justify-content: space-between; align-items: center; gap: 8px; box-sizing: border-box; background-color: #15202b;">
          <div style="display: flex; gap: 8px;">
            <button id="at-copy-btn" style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid #38444d; border-radius: 9999px; color: #ffffff; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background-color 0.2s; outline: none;">
              <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Копировать
            </button>
            <button id="at-speak-btn" style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid #38444d; border-radius: 9999px; color: #ffffff; padding: 6px 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background-color 0.2s; outline: none;">
              <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              Озвучить
            </button>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="at-replace-btn" style="background-color: #1d9bf0; border: none; border-radius: 9999px; color: #ffffff; padding: 6px 16px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background-color 0.2s; outline: none;">
              Заменить
            </button>
            <button id="at-close-btn" style="background: none; border: none; color: #8b98a5; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s; outline: none; width: 28px; height: 28px; box-sizing: border-box;">
              <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
        <!-- Toast / Status Indicator -->
        <div id="at-status-indicator" style="position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%) translateY(8px); background: rgba(0, 186, 124, 0.95); color: #ffffff; padding: 6px 16px; border-radius: 9999px; font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.3); opacity: 0; transition: all 0.2s ease; pointer-events: none; z-index: 1000000001; white-space: nowrap;">
          Скопировано!
        </div>
      </div>
    `;
  }

  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('at-status-indicator');
    if (toast) {
      toast.textContent = message;
      toast.style.backgroundColor = isSuccess ? 'rgba(0, 186, 124, 0.95)' : 'rgba(239, 68, 68, 0.95)';
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(8px)';
      }, 2000);
    }
  }

  function hideCard() {
    translationCard.style.display = 'none';
    window.speechSynthesis.cancel();
    currentTargetSelection = null; // Clear active text selection context
    hoveredCard = null;
    lastTranslatedCard = null;
    lastTranslatedCardText = '';
    clearTimeout(translationTimeout);
  }

  // Position logic (width is set dynamically to match original card's width)
  function positionCard(rect) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Dynamically match width of original card!
    const cardWidth = rect.width && rect.width > 200 ? rect.width : 350;
    translationCard.style.width = cardWidth + 'px';

    let left = rect.right + scrollLeft + 12; // 12px gap

    // If it goes off the right boundary, place to the left
    if (rect.right + cardWidth + 24 > window.innerWidth) {
      left = rect.left + scrollLeft - cardWidth - 12;
    }

    // Ensure it doesn't go off the left boundary
    if (left < 12) {
      left = Math.max(12, scrollLeft + 12);
    }

    let top = rect.top + scrollTop;
    // Keep it vertically visible in viewport if possible
    const estimatedHeight = rect.height && rect.height > 100 ? rect.height + 60 : 350;
    if (rect.top + estimatedHeight + 24 > window.innerHeight) {
      top = Math.max(scrollTop + 12, rect.bottom + scrollTop - estimatedHeight);
    }

    translationCard.style.top = top + 'px';
    translationCard.style.left = left + 'px';
  }

  // Background Translation service caller
  function requestTranslation(text, callback) {
    chrome.runtime.sendMessage({
      action: 'translate',
      text: text,
      targetLang: 'ru'
    }, response => {
      if (chrome.runtime.lastError) {
        callback({ success: false, error: chrome.runtime.lastError.message });
      } else {
        callback(response);
      }
    });
  }

  // Trigger Translation and populate card
  function triggerTranslation(text, cardData) {
    if (!text || !text.trim()) return;
    lastTranslatedText = text;
    
    // Prepare card layout
    const isFullCard = !!cardData;
    const mockData = cardData || { content: text };
    
    translationCard.innerHTML = createCardHtml(mockData);
    translationCard.style.display = 'block';

    // Position it
    let rect;
    if (currentTargetSelection) {
      rect = currentTargetSelection.getBoundingClientRect();
    } else if (currentTargetEl) {
      rect = currentTargetEl.getBoundingClientRect();
    } else {
      rect = hoveredElement ? hoveredElement.getBoundingClientRect() : { top: 100, bottom: 200, left: 100, right: 200, width: 100, height: 100 };
    }
    positionCard(rect);

    // Show loading spinner in content section
    const contentSec = document.getElementById('at-content-section');
    contentSec.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:80px; width:100%;">
        <div class="at-spinner" style="width:28px; height:28px; border:3px solid rgba(255,255,255,0.1); border-top-color:#1d9bf0; border-radius:50%; box-sizing:border-box;"></div>
      </div>
    `;

    // Inline loading animation loop (bypasses CSS CSP rule)
    let rotation = 0;
    const animInterval = setInterval(() => {
      const spinner = translationCard.querySelector('.at-spinner');
      if (!spinner) {
        clearInterval(animInterval);
        return;
      }
      rotation = (rotation + 15) % 360;
      spinner.style.transform = `rotate(${rotation}deg)`;
    }, 30);

    // Request Translate
    requestTranslation(text, response => {
      clearInterval(animInterval);
      if (response && response.success) {
        activeTranslation = response.data.text;
        
        // Populate text
        if (isFullCard) {
          contentSec.innerHTML = response.data.text.split('\n\n').map(l => `<p style="margin-bottom: 20px; white-space: pre-wrap; margin-top: 0;">${l}</p>`).join('');
        } else {
          contentSec.innerHTML = `<p style="margin-bottom: 20px; white-space: pre-wrap; margin-top: 0;">${response.data.text}</p>`;
        }
        
        // Re-align positioning since height might have changed
        positionCard(rect);
        
        // Attach action listeners
        setupCardEvents();
      } else {
        const errorMsg = response ? response.error : 'Unknown translation error';
        contentSec.innerHTML = `
          <div style="color: #ef4444; font-weight: 500; font-size: 14px; line-height: 1.5;">
            ⚠️ Ошибка загрузки перевода!<br>
            <span style="font-size:12px; color:#8b98a5;">${errorMsg}</span>
          </div>
        `;
      }
    });
  }

  function setupCardEvents() {
    const copyBtn = document.getElementById('at-copy-btn');
    const speakBtn = document.getElementById('at-speak-btn');
    const replaceBtn = document.getElementById('at-replace-btn');
    const closeBtn = document.getElementById('at-close-btn');

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(activeTranslation).then(() => {
          showToast('Скопировано!');
        }).catch(err => {
          showToast('Ошибка копирования', false);
        });
      });
      copyBtn.addEventListener('mouseenter', () => copyBtn.style.backgroundColor = 'rgba(255,255,255,0.1)');
      copyBtn.addEventListener('mouseleave', () => copyBtn.style.backgroundColor = 'rgba(255,255,255,0.05)');
    }

    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          showToast('Остановлено');
          return;
        }
        const utterance = new SpeechSynthesisUtterance(activeTranslation);
        utterance.lang = 'ru-RU';
        window.speechSynthesis.speak(utterance);
        showToast('Озвучивание...');
      });
      speakBtn.addEventListener('mouseenter', () => speakBtn.style.backgroundColor = 'rgba(255,255,255,0.1)');
      speakBtn.addEventListener('mouseleave', () => speakBtn.style.backgroundColor = 'rgba(255,255,255,0.05)');
    }

    if (replaceBtn) {
      replaceBtn.addEventListener('click', () => {
        let replaced = false;
        if (currentTargetSelection) {
          try {
            currentTargetSelection.deleteContents();
            currentTargetSelection.insertNode(document.createTextNode(activeTranslation));
            window.getSelection().removeAllRanges();
            replaced = true;
          } catch (err) {
            console.error(err);
          }
        } else if (currentTargetEl) {
          let bodyEl = null;
          const allEls = Array.from(currentTargetEl.querySelectorAll('*'));
          allEls.forEach(el => {
            if (el.textContent.trim() === lastTranslatedText || (lastTranslatedText.length > 20 && el.textContent.trim().includes(lastTranslatedText.substring(0, 20)))) {
              bodyEl = el;
            }
          });
          if (!bodyEl) bodyEl = hoveredElement;
          if (bodyEl) {
            bodyEl.textContent = activeTranslation;
            replaced = true;
          }
        }
        
        if (replaced) {
          showToast('Заменено!');
          setTimeout(hideCard, 1000);
        } else {
          showToast('Ошибка замены', false);
        }
      });
      replaceBtn.addEventListener('mouseenter', () => replaceBtn.style.backgroundColor = '#1a8cd8');
      replaceBtn.addEventListener('mouseleave', () => replaceBtn.style.backgroundColor = '#1d9bf0');
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', hideCard);
      closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = 'rgba(255,255,255,0.05)');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = 'transparent');
    }
  }

  // --- EFFICIENT EVENT-DRIVEN CARD DETECTION ---
  function findCardFromElement(el) {
    if (!el) return null;
    let temp = el;
    while (temp && temp !== document.body) {
      // Skip if we enter the translation card itself to prevent self-translation loops
      if (temp.id === 'antigravity-translator-card-wrapper') {
        return null;
      }
      
      const text = temp.textContent || '';
      const hasAt = text.includes('@');
      const hasFollowers = text.toLowerCase().includes('followers') || text.toLowerCase().includes('подписчик');
      const hasImg = temp.querySelector('img') !== null;
      
      if (hasAt && hasFollowers && hasImg) {
        return temp;
      }
      temp = temp.parentElement;
    }
    return null;
  }

  // --- STATE-BASED HOVER-OFF DISMISSAL ---
  function checkHide() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      // Refresh existence and visibility of the hovered card in the DOM
      const cardExists = hoveredCard && document.body.contains(hoveredCard) && hoveredCard.offsetWidth > 0;
      if (!cardExists) {
        isHoveringCard = false;
      }
      
      // CRITICAL: Do NOT auto-hide if a text selection translation is active.
      // Selection translations are only dismissed by clicking outside, Escape, or the Close button.
      if (currentTargetSelection) {
        return;
      }
      
      if (!isHoveringCard && !isHoveringTranslation) {
        hideCard();
      }
    }, 300); // 300ms grace period
  }

  // Monitor mouse entering and leaving cards
  document.addEventListener('mouseover', (e) => {
    // If hovering inside translation card, reset hover flags and clear hide timer
    if (translationCard && translationCard.contains(e.target)) {
      isHoveringTranslation = true;
      clearTimeout(hideTimeout);
      return;
    }

    const card = findCardFromElement(e.target);
    if (card) {
      clearTimeout(hideTimeout);
      isHoveringCard = true;
      
      if (card !== hoveredCard) {
        // Debounce network translation requests (Issue HTTP 429 prevention)
        clearTimeout(translationTimeout);
        hoveredCard = card;
        currentTargetEl = card;
        currentTargetSelection = null;
        
        const cardText = card.innerText;
        // Don't re-trigger if it's the exact same card and text content as last translated
        if (card === lastTranslatedCard && cardText === lastTranslatedCardText) {
          return;
        }
        
        translationTimeout = setTimeout(() => {
          lastTranslatedCard = card;
          lastTranslatedCardText = cardText;
          const cardData = extractCardData(card);
          if (cardData) {
            triggerTranslation(cardData.content, cardData);
          }
        }, 300); // 300ms debounce
      }
    } else {
      // Over standard element; evaluate if we should trigger hide sequence
      checkHide();
    }
  });

  document.addEventListener('mouseout', (e) => {
    // Left the currently tracked card
    if (hoveredCard && !hoveredCard.contains(e.relatedTarget)) {
      isHoveringCard = false;
      checkHide();
    }
    // Left the translation card
    if (translationCard && translationCard.contains(e.target) && !translationCard.contains(e.relatedTarget)) {
      isHoveringTranslation = false;
      checkHide();
    }
  });
  
  // Periodically verify that the currently hovered card is still visible and in DOM
  // (Detects reactive disappearing of original cards dynamically)
  setInterval(() => {
    if (hoveredCard && (hoveredCard.offsetWidth === 0 || hoveredCard.offsetHeight === 0 || !document.body.contains(hoveredCard))) {
      isHoveringCard = false;
      checkHide();
    }
  }, 300);

  // Manual Selection Trigger (harmless bonus feature)
  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text.length > 0) {
        currentTargetSelection = selection.getRangeAt(0).cloneRange();
        currentTargetEl = null;
        triggerTranslation(text, null);
      }
    }, 10);
  });

  // Global dismiss listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideCard();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (translationCard && translationCard.style.display !== 'none') {
      if (!translationCard.contains(e.target) && (!currentTargetEl || !currentTargetEl.contains(e.target))) {
        hideCard();
      }
    }
  });

  console.log('%c🌐 Axiom Auto-Translator Extension Loaded! %c\n- Hover over a card to automatically view translation.\n- Select any text to manually translate.', 
              'color: #1d9bf0; font-weight: bold; font-size: 14px;', 
              'color: #8b98a5; font-size: 12px;');
})();
