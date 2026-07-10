/**
 * Axiom Translator - Global Runtime Error Monitoring
 * Intercepts uncaught exceptions and promise rejections.
 * Displays a premium, animated error banner and logs details to local storage.
 */

(function () {
  // 1. Detect Context
  let context = 'unknown';
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'chrome-extension:') {
      context = 'popup';
    } else if (window.location.host.includes('axiom.trade')) {
      context = 'axiom-content';
    } else if (window.location.host.includes('padre.gg')) {
      context = 'padre-content';
    } else {
      context = 'webpage';
    }
  } else if (typeof self !== 'undefined') {
    context = 'service-worker';
  }

  const extensionVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) 
    ? chrome.runtime.getManifest().version 
    : 'unknown';

  // 2. Format & Log Error Helper
  async function handleCapturedError(message, source, lineno, colno, error, type = 'runtime') {
    // Ignore benign ResizeObserver notifications from page-level layouts/charts (e.g. TradingView)
    const msgStr = String(message || (error ? error.message : '')).toLowerCase();
    if (
      msgStr.includes('resizeobserver loop completed') ||
      msgStr.includes('resizeobserver loop limit exceeded')
    ) {
      return;
    }

    const timestamp = new Date().toISOString();
    const stack = error && error.stack ? error.stack : '';
    const url = typeof window !== 'undefined' ? window.location.href : 'service-worker';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'node/sw';

    const errorLog = {
      type,
      context,
      message: message || (error ? error.message : 'Unknown error'),
      source: source || 'unknown',
      line: lineno || 0,
      col: colno || 0,
      stack,
      url,
      userAgent,
      version: extensionVersion,
      timestamp
    };

    // Log to console for debugging
    console.error(`[AxiomErrorHandler:${context}] Captured unhandled error:`, errorLog);

    // Save to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const data = await chrome.storage.local.get('axiom_error_logs');
        const logs = data.axiom_error_logs || [];
        logs.push(errorLog);
        // Cap at 20 entries
        if (logs.length > 20) {
          logs.shift();
        }
        await chrome.storage.local.set({ axiom_error_logs: logs });
      } catch (e) {
        console.warn('[errorHandler] Failed to write logs to storage:', e);
      }
    }

    // Show banner if DOM is available
    if (typeof document !== 'undefined' && document.body) {
      showErrorBanner(errorLog);
    }
  }

  // 3. UI Banner logic (premium, styled)
  function showErrorBanner(err) {
    // Avoid duplicate banners
    if (document.getElementById('axiom-error-banner')) return;

    // Inject Styles if they don't exist
    if (!document.getElementById('axiom-error-styles')) {
      const style = document.createElement('style');
      style.id = 'axiom-error-styles';
      style.textContent = `
        .axiom-error-banner {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 9999999;
          background: #0a0a0d;
          border-bottom: 2px solid #ff453a;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.85), 0 2px 15px rgba(255, 69, 58, 0.25);
          color: #ffdad9;
          font-family: ui-monospace, SFMono-Regular, SF Pro Text, Consolas, monospace;
          font-size: 10px;
          padding: 12px 14px;
          box-sizing: border-box;
          transform: translateY(-100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          gap: 8px;
          user-select: text !important;
        }
        .axiom-error-banner.show {
          transform: translateY(0);
        }
        .axiom-error-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .axiom-error-title {
          color: #ff453a;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .axiom-error-actions {
          display: flex;
          gap: 6px;
        }
        .axiom-error-btn {
          background: transparent;
          border: 1px solid #ff453a;
          color: #ff453a;
          padding: 3px 8px;
          font-size: 8px;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
          text-transform: uppercase;
          transition: all 0.15s ease;
          border-radius: 2px;
          line-height: 1;
        }
        .axiom-error-btn:hover {
          background: #ff453a;
          color: #000000;
        }
        .axiom-error-btn.close-btn {
          border-color: #8e8e93;
          color: #8e8e93;
        }
        .axiom-error-btn.close-btn:hover {
          background: #8e8e93;
          color: #000000;
        }
        .axiom-error-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }
        .axiom-error-message {
          font-weight: 700;
          color: #ffffff;
          word-break: break-word;
          line-height: 1.3;
        }
        .axiom-error-stack {
          color: #8e8e93;
          font-size: 9px;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 80px;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 4px;
          background: #020203;
          border: 1px solid #1c1c1f;
          border-radius: 2px;
        }
        .axiom-error-stack::-webkit-scrollbar {
          width: 4px;
        }
        .axiom-error-stack::-webkit-scrollbar-track {
          background: #020203;
        }
        .axiom-error-stack::-webkit-scrollbar-thumb {
          background: #ff453a;
          border-radius: 2px;
        }
      `;
      document.head.appendChild(style);
    }

    const banner = document.createElement('div');
    banner.id = 'axiom-error-banner';
    banner.className = 'axiom-error-banner';

    // Format clean stack trace
    const cleanStack = err.stack ? err.stack : `at ${err.source}:${err.line}:${err.col}`;

    banner.innerHTML = `
      <div class="axiom-error-header">
        <span class="axiom-error-title">▲ AXIOM ERROR MONITOR [${err.context.toUpperCase()}]</span>
        <div class="axiom-error-actions">
          <button class="axiom-error-btn copy-btn" id="axiom-error-copy">Копировать</button>
          <button class="axiom-error-btn close-btn" id="axiom-error-close">×</button>
        </div>
      </div>
      <div class="axiom-error-body">
        <div class="axiom-error-message">${escapeHtml(err.message)}</div>
        <div class="axiom-error-stack">${escapeHtml(cleanStack)}</div>
      </div>
    `;

    document.body.appendChild(banner);

    // Slide down transition
    setTimeout(() => banner.classList.add('show'), 50);

    // Close button
    document.getElementById('axiom-error-close').addEventListener('click', () => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 400);
    });

    // Copy to clipboard report generator
    document.getElementById('axiom-error-copy').addEventListener('click', async function () {
      const copyBtn = this;
      const originalText = copyBtn.textContent;

      const report = `### AXIOM TRANSLATOR ERROR REPORT
- **Timestamp**: ${err.timestamp}
- **Context**: ${err.context}
- **Extension Version**: ${err.version}
- **URL**: ${err.url}
- **User Agent**: ${err.userAgent}
- **Error Type**: ${err.type}
- **Message**: ${err.message}
- **Source**: ${err.source}:${err.line}:${err.col}

**Stack Trace**:
\`\`\`
${err.stack || 'No stack trace available'}
\`\`\`
`;

      try {
        await navigator.clipboard.writeText(report);
        copyBtn.textContent = 'Скопировано!';
        copyBtn.style.borderColor = '#30d158';
        copyBtn.style.color = '#30d158';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 1500);
      } catch (e) {
        console.error('[errorHandler] Clipboard copy failed:', e);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 4. Register Event Listeners
  if (typeof window !== 'undefined') {
    // Intercept standard errors
    window.addEventListener('error', function (event) {
      if (event.error || event.message) {
        handleCapturedError(
          event.message,
          event.filename,
          event.lineno,
          event.colno,
          event.error,
          'runtime'
        );
      }
    });

    // Intercept unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
      const reason = event.reason;
      let msg = 'Unhandled Promise Rejection';
      let errorObj = null;

      if (reason instanceof Error) {
        msg = reason.message;
        errorObj = reason;
      } else if (typeof reason === 'string') {
        msg = reason;
      } else if (reason) {
        try {
          msg = JSON.stringify(reason);
        } catch {
          msg = String(reason);
        }
      }

      handleCapturedError(
        msg,
        'promise-rejection',
        0,
        0,
        errorObj,
        'promise'
      );
    });
  } else if (typeof self !== 'undefined') {
    // Service Worker context error listener
    self.addEventListener('error', function (event) {
      handleCapturedError(
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error,
        'runtime'
      );
    });

    self.addEventListener('unhandledrejection', function (event) {
      const reason = event.reason;
      let msg = 'SW Unhandled Promise Rejection';
      let errorObj = null;

      if (reason instanceof Error) {
        msg = reason.message;
        errorObj = reason;
      } else if (typeof reason === 'string') {
        msg = reason;
      } else if (reason) {
        try {
          msg = JSON.stringify(reason);
        } catch {
          msg = String(reason);
        }
      }

      handleCapturedError(
        msg,
        'promise-rejection',
        0,
        0,
        errorObj,
        'promise'
      );
    });
  }
})();
