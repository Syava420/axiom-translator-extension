const _PP_NL_TRIM = / *\n */g;
const _PP_MULTI_SPACE = /  +/g;
const _PP_RT_PREFIX = /^(RT\s+@[A-Za-z_][A-Za-z0-9_]{0,14}:?\s*)/i;
const _PP_PLACEHOLDER = /_\s*ph\s*_\s*(\d+)\s*_/gi;
const _PP_SPACE_PUNCT = / ([.,;:!?)])/g;
const _PP_NEWLINE_PUNCT = /(\n+)\s*([.!?,;:])\s*/g;
const _PP_DUP_PUNCT = /([.,;:!?])\1+/g;
const _PP_NL_DOT = /\n\s*\.(?!\.)/g;
const _PP_LEADING_DOT = /^\.(?!\.)\s*/;
const _PP_TRAILING_COMMA_NL = /,(\s*\n\n)/g;
const _PP_TRAILING_COMMA = /,\s*$/;
const _PP_SPACE_AFTER_PUNCT = /([.,;:!?])([A-ZА-Яa-zа-я])/g;
const _PP_HTML_APOS = /&#39;/g;
const _PP_HTML_QUOT = /&quot;/g;
const _PP_HTML_AMP = /&amp;/g;
const _PP_SENT_SPLIT = /(?<=[.!?])\s+/;
const _PP_STRIP_PH = /_ph_\d+_/gi;
const _PP_RESTORE_PH = /_ph_(\d+)_/gi;
const _PP_WORD_SPLIT = /\s+/;

class TextPreprocessor {
  constructor(customDictionary) {
    this.customDictionary = customDictionary || null;
    this._buildRegex();
  }

  updateCustomDictionary(customDictionary) {
    this.customDictionary = customDictionary || null;
    this._buildRegex();
  }

  _buildRegex() {
    const cp = CONFIG.CRYPTO_PRESERVE;
    const multi = [...cp.MULTI_WORD];
    const single = [...cp.SINGLE_WORD];

    if (this.customDictionary) {
      for (const key of Object.keys(this.customDictionary)) {
        if (key.includes(' ')) {
          multi.push(key);
        } else {
          single.push(key);
        }
      }
    }

    multi.sort((a, b) => b.length - a.length);
    single.sort((a, b) => b.length - a.length);

    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const parts = [];
    for (const term of multi) parts.push(esc(term));
    for (const term of single) parts.push(esc(term));

    this._regex = new RegExp(
      '(' +
        '\\$[A-Za-z][A-Za-z0-9]{0,15}' +
        '|@[A-Za-z_][A-Za-z0-9_]{0,14}' +
        '|https?:\\/\\/[^\\s<>\"]{3,}' +
        '|\\bt\\.co\\/[A-Za-z0-9]+' +
        '|\\b(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(?:\\/[^\\s<>\"]*)?' +
        (parts.length > 0 ? '|\\b(?:' + parts.join('|') + ')\\b' : '') +
      ')',
      'gi'
    );
  }

  preprocess(text) {
    const placeholders = [];
    let processed = text.replace(_PP_RT_PREFIX, (match) => {
      const idx = placeholders.length;
      placeholders.push(match);
      return '_ph_' + idx + '_ ';
    });
    const cleanText = processed.replace(this._regex, (match) => {
      const idx = placeholders.length;
      const lowerMatch = match.toLowerCase();
      if (this.customDictionary && this.customDictionary[lowerMatch]) {
        placeholders.push(this.customDictionary[lowerMatch]);
      } else {
        placeholders.push(match);
      }
      return '_ph_' + idx + '_';
    });
    return { cleanText, placeholders };
  }

  postprocess(translated, placeholders) {
    if (placeholders.length === 0) return this._cleanArtifacts(translated);

    let result = this._cleanArtifacts(translated);

    const restored = new Set();
    result = result.replace(_PP_PLACEHOLDER, (match, idx) => {
      const i = parseInt(idx, 10);
      if (i < placeholders.length) {
        restored.add(i);
        return placeholders[i];
      }
      return match;
    });

    for (let i = 0; i < placeholders.length; i++) {
      if (!restored.has(i)) result += ' ' + placeholders[i];
    }

    result = result.replace(_PP_SPACE_PUNCT, '$1');
    result = result.replace(_PP_NEWLINE_PUNCT, '$2$1');
    result = result.replace(_PP_SPACE_PUNCT, '$1');
    result = result.replace(_PP_DUP_PUNCT, '$1');
    result = result.replace(_PP_NL_DOT, '\n');
    result = result.replace(_PP_LEADING_DOT, '');
    result = result.replace(_PP_NL_TRIM, '\n');

    result = result.replace(_PP_TRAILING_COMMA_NL, '$1').replace(_PP_TRAILING_COMMA, '');

    return result.replace(_PP_MULTI_SPACE, ' ').trim();
  }

  _cleanArtifacts(text) {
    let r = text;
    r = r.replace(_PP_MULTI_SPACE, ' ');
    r = r.replace(_PP_SPACE_PUNCT, '$1');
    r = r.replace(_PP_SPACE_AFTER_PUNCT, '$1 $2');
    r = r.replace(_PP_HTML_APOS, "'");
    r = r.replace(_PP_HTML_QUOT, '"');
    r = r.replace(_PP_HTML_AMP, '&');
    r = r.trim();
    return r;
  }
}
