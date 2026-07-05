# Project Plan: Axiom Translator Chrome Extension Fixes

## Objectives
1. Fix the hover detection and popup positioning to dynamically match original card widths and hide properly when leaving.
2. Prevent infinite loops and HTTP 429 errors by restricting the scanner from scanning the popup, adding a debounce to translation requests, and caching translation results.
3. Fix month abbreviation and metadata translations (e.g., prevent "March" from being distorted to "мар.ch").
4. Formulate and run E2E/integration verification to ensure no CORS/CSP or logic errors occur.

## Milestones

### Milestone 1: Codebase Analysis and Issue Identification
- Use Explorer subagent to analyze current implementation details.
- Identify exact root causes for:
  - CORS/CSP issues (if any) in Chrome MV3 environment.
  - Hover detection bug (currently scans all images on page instead of hovered card).
  - Hide logic bug (doesn't hide when mouse leaves unless card is deleted).
  - HTTP 429 risks (lack of debounce, scanning loop).
  - Localization bugs (abbreviation distortion, double dots).
- Status: Planned

### Milestone 2: Setup Test / Mock Page
- Create a mock HTML page simulating `axiom.trade` containing Twitter-like cards with different sizes, metadata (Joined dates, follower counts), and elements to test hover interactions.
- Status: Planned

### Milestone 3: Sizing, Hover, and Loop Prevention Implementation
- Use Worker subagent to implement fixes in `content.js` and `background.js`:
  - Hover-based card detection (traverse from hovered element instead of querying all images).
  - Hide translation card when leaving both card and popup.
  - Implement request debouncing (e.g. 300ms) and caching.
  - Set dynamic width on popup matching the original card's bounding box.
- Status: Planned

### Milestone 4: Metadata Localization and Abbreviation Implementation
- Update the month localization in `content.js` to use safe matching (e.g. checking boundaries and optional periods) to prevent distortions like "March" -> "мар.ch".
- Status: Planned

### Milestone 5: E2E Verification & Forensic Audit
- Verify that hovering over cards displays the translated popup.
- Verify that leaving card hides the popup.
- Verify correct translation of metadata.
- Verify no HTTP 429 requests or CORS/CSP errors.
- Run Forensic Auditor to confirm integrity.
- Status: Planned
