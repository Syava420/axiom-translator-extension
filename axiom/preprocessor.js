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

const BUILTIN_DICTIONARY = {
  "doge": "Доге",
  "lore": "лор",
  "trenches": "тренчи",
  "jeet": "джит",
  "jeets": "джиты",
  "bag": "бэг",
  "moonshot": "муншот",
  "sidekick": "сайдкик",
  "normie": "нормис",
  "normies": "нормисы",
  "proof of wallet": "Пруф кошелька",
  "about a day's wages": "около дневного заработка",
  "had one thing going for it": "обладала одним преимуществом",
  "wants or needs": "желания или потребности",
  "no scriptability": "без программируемости",
  "fees to his github": "комиссии в его GitHub",
  "pour one out": "выпить не цокая",
  "short spine syndrome": "синдром короткого позвоночника",
  "promised the moon": "наобещал золотые горы",
  "dead liquidity": "мертвая ликвидность",
  "giga viral": "гигавирусный",
  "world cup indicator": "индикатор ЧМ",
  "serial shitter": "серийный засиратель",
  "bear whisperer": "заклинатель медведей",
  "you can just build things": "вы можете просто строить вещи",
  "everything is bullshit": "все вокруг скам",
  "community takeover": "перехват комьюнити",
  "creator rewards": "роялти создателя",
  "pfp cult": "культ аватарок",
  "pfp generator": "генератор аватарок",
  "clout chasing": "клаутчейсинг",
  "you only die once": "YODO",
  "second brain": "второй мозг",
  "dick porn": "Дик Порн",
  "harambe": "Харамбе",
  "batman": "Бэтмен",
  "jimothy": "Джимоти",
  "toly": "Толи",
  "gru": "Грю",
  "mister makac": "Мистер Макач",
  "this can rip": "щиток улетит",
  "saint bernard murphy": "сенбернар Мерфи",
  "harbor heroes": "Герои Гавани",
  "anduril": "Андурил",
  "yodo": "ЙОДО",
  "hieromojis": "Иеромоджи",
  "qqne and spne": "КуКуЭнЕ и СпЭнЕ",
  "stank": "Стэнк",
  "k3": "Кей-3",
  "scrollcat": "Скроллкат",
  "doomscroll cat": "Думскролл Кат",
  "pepper": "Пеппер",
  "blimp mode": "Блимп Мод",
  "debug project": "проект Отладка",
  "mosquitoes": "комары",
  "champ is a staffy": "стаффорд Чемпион",
  "unicoon": "Юникун",
  "sisyphean ibex": "сизифов козерог",
  "quiet on the creek": "Квайет он зе крик",
  "jellycat": "Джелликат",
  "fibs": "Фибс",
  "beaver stealing underwear": "бобер ворующий трусы",
  "caccetta-haggkvist": "гипотеза Каккетты",
  "white elephant": "Белый Слон",
  "wangwang": "ВанВан",
  "jacobian conjecture": "гипотеза Якобиана",
  "clay millennium prize": "Задачи Тысячелетия",
  "pmos": "ПМОС",
  "the billionaire": "Миллиардер",
  "animegen": "АнимеГен",
  "goose": "Гусь",
  "irradimus": "Иррадимус",
  "proud cat": "Прауд Кат",
  "dummy dog": "Дамми Дог",
  "train cat": "Трейн Кат",
  "tcat": "Ткат",
  "gordothy": "Гордоти",
  "liquititty": "Ликвититти",
  "hairy balls chain": "Хэйри Боллс Чейн",
  "fablechain": "ФэйблЧейн",
  "dolly": "Долли",
  "thin air": "из воздуха",
  "werner": "Вернер",
  "chatgpt went rogue": "ЧатГПТ взбесился",
  "hugging face": "Хаггинг Фейс",
  "mert": "Мерт",
  "skibidi toilet cat": "Скибиди Туалет Кат",
  "coin": "акции Койнбейса",
  "yohji": "Йоджи",
  "stockwar": "СтокВор",
  "streamer gifts": "Стример Гифтс",
  "catjak": "Кэтджак",
  "babyelon": "БэбиИлон",
  "bryan johnson": "Брайан Джонсон",
  "roko basilisk": "Василиск Роко",
  "queen of sheba": "Царица Савская",
  "chatgtt": "ЧатГТТ",
  "xiao maomi": "Сяо Маоми",
  "swole doge": "Свол Доге",
  "yogi and yoshi": "Йоги и Йоши",
  "hiroo onoda": "Хиро Онода",
  "fomo app": "Фомо приложение",
  "horse in vent": "конь в вентиляции",
  "niggatits": "НиггаТитс",
  "big body cam": "Биг Бади Кэм",
  "shf": "Смокинг Хукт Фиш",
  "li meizhen": "Ли Мэйчжэнь",
  "mamdani": "Мамдани",
  "bbl": "ББЛ",
  "beluga being lifted": "подъем белуги",
  "nietzschean grandpa": "Ницшеанский Дед",
  "unc trencher": "дядька-траншейник",
  "evil trend": "Ивил тренд",
  "piru": "Пиру",
  "good samaritan": "Гунер Самаритянин",
  "fearless woman": "Бесстрашная Женщина",
  "venus": "Венера",
  "fiona": "Фиона",
  "pawn": "пешка",
  "honey": "Хани",
  "cs:go": "Ксго",
  "ma ke": "Марк",
  "thor lundgren": "Тор Лундгрен",
  "bobcat": "Бобкэт"
};

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
    const activeDict = Object.assign({}, BUILTIN_DICTIONARY, this.customDictionary || {});
    this.activeDict = activeDict;

    const cp = CONFIG.CRYPTO_PRESERVE;
    const multi = [...cp.MULTI_WORD];
    const single = [...cp.SINGLE_WORD];

    for (const key of Object.keys(activeDict)) {
      if (key.includes(' ')) {
        multi.push(key);
      } else {
        single.push(key);
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
      if (this.activeDict && this.activeDict[lowerMatch]) {
        placeholders.push(this.activeDict[lowerMatch]);
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
