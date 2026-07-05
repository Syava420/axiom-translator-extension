# Project: Axiom Translator Extension Fixes

## Architecture
- background.js: Background service worker handling Google Translate API fetch.
- content.js: Content script injected on pages. It tracks mouseover events, identifies Twitter-like cards, requests translations, renders popup, and coordinates user interactions.
- manifest.json: Extension manifest declaring MV3 compliance, script matches, and translate API host permissions.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Codebase Analysis | Analyze code for bugs, rate limits, CSP, and abbreviations | None | DONE |
| 2 | Mock Environment | Create a mock html page simulating axiom.trade for testing | None | DONE |
| 3 | Sizing, Hover & Loop Fixes | Fix hover target, hide conditions, width matching, and 429 loops | M1 | DONE |
| 4 | Localization Fixes | Fix metadata translation and month abbreviation regexes | M3 | DONE |
| 5 | Verification & Audit | E2E test verification and forensic audit | M4 | DONE |

## Interface Contracts
### content.js ↔ background.js
- Message format: `{ action: 'translate', text: String, targetLang: String }`
- Response format: `{ success: true, data: { text: String, src: String } }` or `{ success: false, error: String }`
