const _debugLog = [];
let _debugLogHead = 0;
const _DEBUG_LOG_MAX = 2000;
const _origConsoleLog = console.log;
const _origConsoleWarn = console.warn;

const _debugIssues = {};
const _debugIssueDetails = [];
let _debugIssueHead = 0;
const _DEBUG_ISSUES_MAX = 100;

function logIssue(category, detail) {
  _debugIssues[category] = (_debugIssues[category] || 0) + 1;
  const ts = new Date().toISOString().substring(11, 23);
  const entry = ts + ' ⚠ ' + category + ': ' + detail;
  if (_debugIssueDetails.length < _DEBUG_ISSUES_MAX) {
    _debugIssueDetails.push(entry);
  } else {
    _debugIssueDetails[_debugIssueHead] = entry;
    _debugIssueHead = (_debugIssueHead + 1) % _DEBUG_ISSUES_MAX;
  }
  _origConsoleWarn.call(console, '[AxiomTranslator] ⚠ ' + category + ':', detail);
}

function getIssuesSummary() {
  const keys = Object.keys(_debugIssues);
  if (keys.length === 0) return '=== NO ISSUES DETECTED ===\n\n';

  const lines = ['=== ISSUES DETECTED (' + keys.length + ' types) ==='];
  keys.sort((a, b) => _debugIssues[b] - _debugIssues[a]);
  for (const key of keys) {
    lines.push('  ⚠ ' + _debugIssues[key] + 'x ' + key);
  }
  lines.push('');
  const ordered = _debugIssueDetails.length < _DEBUG_ISSUES_MAX
    ? _debugIssueDetails
    : _debugIssueDetails.slice(_debugIssueHead).concat(_debugIssueDetails.slice(0, _debugIssueHead));
  const last50 = ordered.slice(-50);
  lines.push('--- Issue Details (last ' + last50.length + ') ---');
  for (const d of last50) {
    lines.push('  ' + d);
  }
  lines.push('=== END ISSUES ===');
  lines.push('');
  return lines.join('\n');
}

function _safeStringify(a) {
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}

console.log = function (...args) {
  _origConsoleLog.apply(console, args);
  if (typeof args[0] === 'string' && args[0].includes('[AxiomTranslator]')) {
    const ts = new Date().toISOString().substring(11, 23);
    const msg = args.map(_safeStringify).join(' ');
    const entry = ts + ' ' + msg;
    if (_debugLog.length < _DEBUG_LOG_MAX) {
      _debugLog.push(entry);
    } else {
      _debugLog[_debugLogHead] = entry;
      _debugLogHead = (_debugLogHead + 1) % _DEBUG_LOG_MAX;
    }
  }
};

console.warn = function (...args) {
  _origConsoleWarn.apply(console, args);
  if (typeof args[0] === 'string' && args[0].includes('[AxiomTranslator]')) {
    const ts = new Date().toISOString().substring(11, 23);
    const msg = args.map(_safeStringify).join(' ');
    const entry = ts + ' WARN ' + msg;
    if (_debugLog.length < _DEBUG_LOG_MAX) {
      _debugLog.push(entry);
    } else {
      _debugLog[_debugLogHead] = entry;
      _debugLogHead = (_debugLogHead + 1) % _DEBUG_LOG_MAX;
    }
  }
};

const CONFIG = {
  DEBUG: false,

  APIS: {
    CHROME_TRANSLATOR: {
      name: 'Chrome Translator',
      initTimeout: 5000
    },
    GOOGLE: {
      name: 'Google Translate',
      url: 'https://translate.googleapis.com/translate_a/single',
      params: { client: 'gtx', sl: 'en', tl: 'ru', dt: 't' },
      timeout: 6000,
      breakerThreshold: 5,
      breakerResetMs: 15000
    },
    MOZHI: {
      name: 'Mozhi',
      instances: [
        'https://mozhi.pussthecat.org',
        'https://mozhi.r4fo.com',
        'https://mzh.dc09.xyz',
        'https://mozhi.adminforge.de',
        'https://mozhi.bloat.cat',
        'https://mozhi.ducks.party'
      ],
      engine: 'yandex',
      fallbackEngine: 'duckduckgo',
      timeout: 6000,
      breakerThreshold: 3,
      breakerResetMs: 20000
    },
    SIMPLYTRANSLATE: {
      name: 'SimplyTranslate',
      url: 'https://simplytranslate.org/api/translate/',
      timeout: 5000,
      breakerThreshold: 3,
      breakerResetMs: 30000
    },
    LINGVA: {
      name: 'Lingva Translate',
      instances: ['https://translate.plausibility.cloud'],
      timeout: 5000,
      breakerThreshold: 2,
      breakerResetMs: 30000
    },
    MYMEMORY: {
      name: 'MyMemory',
      url: 'https://api.mymemory.translated.net/get',
      timeout: 5000,
      breakerThreshold: 1,
      breakerResetMs: 120000
    }
  },

  CACHE: {
    MAX_MEMORY_ENTRIES: 5000,
    STORAGE_KEY: 'axiom_translation_cache_v2',
    PERSIST_DEBOUNCE_MS: 2000,
    MAX_STORAGE_ENTRIES: 8000
  },

  QUEUE: {
    MAX_CONCURRENCY: 12,
    RATE_LIMIT_MAX: 500,
    RATE_LIMIT_WINDOW_MS: 60000
  },

  DETECTION: {
    MIN_TWEET_TEXT_LENGTH: 6,
    MIN_TWITTER_SIGNALS: 2,
    HANDLE_REGEX: /@\w{1,15}/,
    FOLLOWERS_REGEX: /(\d[\d,.]*[KMBkmb]?\s*(followers|подписчик)|followers\s*[\d,.]+[KMBkmb]?)/i,
    JOIN_DATE_REGEX: /Joined\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i
  },

  UI: {
    BADGE_COLOR: '#7c3aed',
    TRANSLATION_PENDING_OPACITY: '0.7'
  },

  CRYPTO_PRESERVE: {
        MULTI_WORD: [
      "giga runner",
      "rug pull",
      "rug pulled",
      "buy the dip",
      "diamond hands",
      "paper hands",
      "weak hands",
      "strong hands",
      "smart money",
      "dumb money",
      "exit liquidity",
      "dead cat bounce",
      "blow off top",
      "stop loss",
      "take profit",
      "limit order",
      "market order",
      "order book",
      "swing trade",
      "day trade",
      "copy trade",
      "copy trading",
      "margin call",
      "short squeeze",
      "bear trap",
      "bull trap",
      "bull run",
      "bear market",
      "bull market",
      "price action",
      "green candle",
      "red candle",
      "flash crash",
      "panic sell",
      "panic buy",
      "yield farming",
      "liquidity pool",
      "liquidity provider",
      "impermanent loss",
      "flash loan",
      "smart contract",
      "token burn",
      "total supply",
      "max supply",
      "circulating supply",
      "market cap",
      "liquid staking",
      "floor price",
      "sweep the floor",
      "free mint",
      "dutch auction",
      "open edition",
      "priority fee",
      "compute units",
      "proof of history",
      "bonding curve",
      "spl token",
      "magic eden",
      "sniper bot",
      "trading bot",
      "sandwich attack",
      "jito bundle",
      "flash bot",
      "stealth launch",
      "fair launch",
      "dev wallet",
      "private sale",
      "send it",
      "wen pump",
      "let him cook",
      "full send",
      "ape in",
      "ape into",
      "aped in",
      "aped into",
      "wen moon",
      "wen lambo",
      "to the moon",
      "number go up",
      "up only",
      "not gonna make it",
      "gonna make it",
      "probably nothing",
      "this is the way",
      "few understand",
      "generational wealth",
      "printing money",
      "free money",
      "seed phrase",
      "private key",
      "public key",
      "cold wallet",
      "hot wallet",
      "hardware wallet",
      "gas fee",
      "gas fees",
      "boost mode",
      "usdc pair",
      "sol pair",
      "all time high",
      "contract address",
      "fomo wallet",
      "open source",
      "pfp generator",
      "chudcel groyper",
      "ai agent",
      "ai agents",
      "blue chip",
      "tier 1"
    ],

        SINGLE_WORD: [
      "bags",
      "runner",
      "runners",
      "pump.fun",
      "on-chain",
      "off-chain",
      "cross-chain",
      "dev",
      "devs",
      "ca",
      "fees",
      "pnl",
      "sol",
      "solana",
      "btc",
      "eth",
      "hodl",
      "hodling",
      "fud",
      "fomo",
      "dyor",
      "nfa",
      "wagmi",
      "ngmi",
      "lfg",
      "iykyk",
      "gm",
      "gn",
      "gg",
      "ath",
      "atl",
      "dca",
      "roi",
      "apy",
      "apr",
      "tvl",
      "mcap",
      "fdv",
      "defi",
      "dex",
      "cex",
      "amm",
      "dao",
      "dapp",
      "nft",
      "pfp",
      "pfps",
      "lp",
      "otc",
      "rpc",
      "evm",
      "tps",
      "mev",
      "ico",
      "ido",
      "ieo",
      "kyc",
      "aml",
      "btd",
      "btfd",
      "ct",
      "kol",
      "kols",
      "og",
      "l1",
      "l2",
      "l3",
      "zk",
      "ta",
      "fa",
      "rsi",
      "macd",
      "degen",
      "degens",
      "degening",
      "ape",
      "aped",
      "aping",
      "whale",
      "whales",
      "rekt",
      "rekted",
      "rugged",
      "rugger",
      "shill",
      "shilled",
      "shilling",
      "shiller",
      "bullish",
      "bearish",
      "mooning",
      "moonboy",
      "bagholder",
      "bagholders",
      "bagholding",
      "copium",
      "hopium",
      "gigabrain",
      "gigachad",
      "pleb",
      "maxi",
      "fren",
      "frens",
      "ser",
      "anon",
      "anons",
      "chad",
      "npc",
      "intern",
      "alpha",
      "cope",
      "coping",
      "pump",
      "pumped",
      "pumping",
      "pumps",
      "dump",
      "dumped",
      "dumping",
      "dumps",
      "nuke",
      "nuked",
      "nuking",
      "moon",
      "dip",
      "dips",
      "rally",
      "breakout",
      "breakdown",
      "fade",
      "faded",
      "fading",
      "accumulation",
      "capitulation",
      "liquidation",
      "liquidated",
      "leverage",
      "leveraged",
      "perps",
      "perpetuals",
      "futures",
      "scalp",
      "scalping",
      "slippage",
      "arbitrage",
      "arb",
      "entry",
      "exits",
      "wen",
      "gas",
      "staking",
      "staked",
      "restaking",
      "unstaking",
      "unstaked",
      "swap",
      "swapped",
      "swaps",
      "bridge",
      "bridged",
      "bridging",
      "vault",
      "vaults",
      "lending",
      "borrowing",
      "collateral",
      "governance",
      "protocol",
      "protocols",
      "tokenomics",
      "vesting",
      "airdrop",
      "airdrops",
      "airdropped",
      "airdropping",
      "whitelist",
      "whitelisted",
      "flippening",
      "flipped",
      "rugging",
      "presale",
      "mint",
      "minted",
      "minting",
      "mints",
      "raydium",
      "jupiter",
      "jito",
      "marinade",
      "orca",
      "drift",
      "pyth",
      "tensor",
      "phantom",
      "solflare",
      "metaplex",
      "meteora",
      "marginfi",
      "solend",
      "bonfida",
      "pumpswap",
      "alpenglow",
      "altcoin",
      "altcoins",
      "shitcoin",
      "shitcoins",
      "memecoin",
      "memecoins",
      "stablecoin",
      "stablecoins",
      "satoshi",
      "sats",
      "gwei",
      "wei",
      "snipe",
      "sniped",
      "sniping",
      "sniper",
      "frontrun",
      "frontrunning",
      "frontrunner",
      "backrun",
      "backrunning",
      "sandwich",
      "sandwiched",
      "honeypot",
      "honeypots",
      "bundle",
      "bundled",
      "blockchain",
      "mainnet",
      "testnet",
      "devnet",
      "validator",
      "validators",
      "oracle",
      "oracles",
      "multisig",
      "rollup",
      "rollups",
      "sidechain",
      "hashrate",
      "halving",
      "token",
      "tokens",
      "wallet",
      "wallets",
      "lambo",
      "4chan",
      "reddit",
      "discord",
      "telegram",
      "bonding",
      "bonded",
      "curve",
      "mc",
      "banger",
      "based",
      "billionaire",
      "capybara",
      "cashback",
      "clout",
      "commit",
      "drain",
      "drained",
      "drainer",
      "fable",
      "foid",
      "giga",
      "github",
      "goon",
      "gooner",
      "grind",
      "grok",
      "hacked",
      "hash",
      "incel",
      "inference",
      "jeeter",
      "jeeting",
      "latency",
      "likes",
      "link",
      "links",
      "llm",
      "lmao",
      "lmfao",
      "lock",
      "locked",
      "meta",
      "metas",
      "metaverse",
      "mew",
      "narra",
      "narrative",
      "node",
      "nodes",
      "onchain",
      "phishing",
      "popcat",
      "proof",
      "proofs",
      "pvp",
      "recap",
      "redeploy",
      "redeploying",
      "repo",
      "retard",
      "retardio",
      "risk-on",
      "rot",
      "scam",
      "scammer",
      "solspin",
      "supply",
      "ticker",
      "tickers",
      "trenching",
      "trencher",
      "twap",
      "unlock",
      "unlocked",
      "upvotes",
      "vamp",
      "vamping",
      "vamps",
      "views",
      "vol",
      "volume",
      "wif",
      "wojak"
    ]
  }
};
