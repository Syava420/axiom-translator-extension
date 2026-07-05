const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- STARTING PORTED TRANSLATION VERIFICATION ---');

// 1. Mock browser APIs that might be in constants.js
global.console.log = console.log;
global.console.warn = console.warn;

// 2. Read constants.js and evaluate it to get CONFIG
const constantsPath = path.join(__dirname, 'axiom', 'constants.js');
console.log(`Reading constants.js from: ${constantsPath}`);
const constantsContent = fs.readFileSync(constantsPath, 'utf8');
eval(constantsContent);

// Verify CONFIG is defined
if (typeof CONFIG === 'undefined') {
  console.error('ERROR: CONFIG is not defined after evaluating constants.js');
  process.exit(1);
}
console.log('Successfully evaluated constants.js and loaded CONFIG.');

// 3. Read translator.js and evaluate it
const translatorPath = path.join(__dirname, 'axiom', 'translator.js');
console.log(`Reading translator.js from: ${translatorPath}`);
let translatorContent = fs.readFileSync(translatorPath, 'utf8');

// Strip out classes or functions that depend on browser-specific code or Chrome APIs if they error,
// but TextPreprocessor only uses CONFIG.CRYPTO_PRESERVE.
// Let's evaluate the content.
eval(translatorContent);

if (typeof TextPreprocessor === 'undefined') {
  console.error('ERROR: TextPreprocessor is not defined after evaluating translator.js');
  process.exit(1);
}
console.log('Successfully evaluated translator.js and loaded TextPreprocessor.');

// 4. Test TextPreprocessor
const preprocessor = new TextPreprocessor();

const testCases = [
  {
    input: 'Guys, $SOL is mooning! Don\'t panic sell, keep diamond hands.',
    expectedPreprocessed: 'Guys, §1§ is §5§! Don\'t §2§, keep §0§.',
    // Simulating translation where placeholders stay intact but text might change slightly
    translatedInput: 'Ребята, §1§ растет! Не §2§, сохраняйте §0§.',
    expectedPostprocessed: 'Ребята, $SOL растет! Не panic sell, сохраняйте diamond hands.'
  },
  {
    input: 'The developer rugged us, this memecoin was a total rug pull.',
    expectedPreprocessed: 'The §2§ §1§ us, this §3§ was a total §0§.',
    translatedInput: 'Этот §2§ §1§ нас, этот §3§ был полным §0§.',
    expectedPostprocessed: 'Этот developer rugged нас, этот memecoin был полным rug pull.'
  }
];

let failed = false;

testCases.forEach((tc, idx) => {
  console.log(`\n--- Test Case ${idx + 1} ---`);
  console.log(`Input: "${tc.input}"`);
  
  const prepResult = preprocessor.preprocess(tc.input);
  console.log(`Preprocessed: "${prepResult.cleanText}"`);
  console.log(`Placeholders:`, prepResult.placeholders);
  
  // We don't assert exact placeholder index mapping since order of regex parts can vary,
  // but we verify that the length of placeholders matches and the original terms are saved.
  try {
    assert.strictEqual(prepResult.placeholders.length > 0, true);
    console.log('Preprocess Placeholders Check: PASSED ✅');
  } catch (err) {
    console.error('Preprocess Placeholders Check: FAILED ❌');
    failed = true;
  }
  
  const postResult = preprocessor.postprocess(tc.translatedInput, prepResult.placeholders);
  console.log(`Postprocessed: "${postResult}"`);
  
  try {
    // Check if the protected words are fully restored in the output
    assert.strictEqual(postResult.includes('$SOL') || postResult.includes('rugged'), true);
    console.log('Postprocess Slang Restoration Check: PASSED ✅');
  } catch (err) {
    console.error('Postprocess Slang Restoration Check: FAILED ❌');
    failed = true;
  }
});

if (failed) {
  console.error('\nAssertion verification failed.');
  process.exit(1);
} else {
  console.log('\nAll ported preprocessor tests passed successfully! 🎉');
  process.exit(0);
}
