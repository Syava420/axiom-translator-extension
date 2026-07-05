const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- STARTING TRANSLATION VERIFICATION ---');

// 1. Read axiom/utils.js
const contentPath = path.join(__dirname, 'axiom', 'utils.js');
console.log(`Reading utils.js from: ${contentPath}`);
const content = fs.readFileSync(contentPath, 'utf8');

// 2. Extract translateMetadata function
const funcStartMarker = 'function translateMetadata(text) {';
const funcStartIndex = content.indexOf(funcStartMarker);
if (funcStartIndex === -1) {
  console.error(`ERROR: Could not find function start marker "${funcStartMarker}" in utils.js`);
  process.exit(1);
}

let braceCount = 0;
let funcEndIndex = -1;
for (let i = funcStartIndex; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
  } else if (content[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      funcEndIndex = i + 1;
      break;
    }
  }
}

if (funcEndIndex === -1) {
  console.error('ERROR: Could not find matching closing brace for translateMetadata');
  process.exit(1);
}

const functionCode = content.substring(funcStartIndex, funcEndIndex);
console.log('Successfully extracted translateMetadata function code.');

// 3. Eval the function to get a callable reference
let translateMetadata;
try {
  translateMetadata = eval('(' + functionCode + ')');
} catch (e) {
  console.error('ERROR: Failed to evaluate the extracted function code:', e);
  process.exit(1);
}

// 4. Test cases definition
const testCases = [
  { input: 'Joined Nov 2013', expected: 'Регистрация: нояб. 2013' },
  { input: 'Joined March 2021', expected: 'Регистрация: март 2021' },
  { input: 'Joined Mar. 2021', expected: 'Регистрация: мар. 2021' },
  { input: 'Joined May 2018', expected: 'Регистрация: май 2018' },
  { input: '114 followers', expected: '114 подписчиков' }
];

let failed = false;

// 5. Run tests
testCases.forEach((tc, idx) => {
  const result = translateMetadata(tc.input);
  console.log(`Test Case ${idx + 1}:`);
  console.log(`  Input:    "${tc.input}"`);
  console.log(`  Expected: "${tc.expected}"`);
  console.log(`  Result:   "${result}"`);
  
  try {
    assert.strictEqual(result, tc.expected);
    console.log('  Status:   PASSED ✅');
  } catch (err) {
    console.error(`  Status:   FAILED ❌ (Actual: "${result}", Expected: "${tc.expected}")`);
    failed = true;
  }
  console.log('');
});

if (failed) {
  console.error('Assertion verification failed.');
  process.exit(1);
} else {
  console.log('All verification assertions passed successfully! 🎉');
  process.exit(0);
}
