const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Path to content.js
const contentPath = path.resolve(__dirname, '../../content.js');
const content = fs.readFileSync(contentPath, 'utf8');

// Extract translateMetadata function
const funcStartMarker = 'function translateMetadata(text) {';
const funcStartIndex = content.indexOf(funcStartMarker);
if (funcStartIndex === -1) {
  console.error('ERROR: Could not find function start marker');
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

const functionCode = content.substring(funcStartIndex, funcEndIndex);
const translateMetadata = eval('(' + functionCode + ')');

// Run extra test cases
const extraTestCases = [
  // Edge Case: Substrings
  { input: 'Joined Marching 2021', expected: 'Регистрация: Marching 2021' }, // "Marching" has March, shouldn't match
  { input: 'Joined Mar.ch 2021', expected: 'Регистрация: мар..ch 2021' }, // "Mar.ch" actually gets partially replaced to мар..ch due to dot not being [a-zA-Z]
  { input: 'Joined Mayday 2018', expected: 'Регистрация: Mayday 2018' }, // "Mayday" has May, shouldn't match
  
  // Mixed Case
  { input: 'joined nov 2013', expected: 'Регистрация: нояб. 2013' },
  { input: 'Joined MARCH 2021', expected: 'Регистрация: март 2021' },
  
  // No Joined/followers but month present
  { input: 'In March 2021', expected: 'In март 2021' },
  
  // Period spacing and optionality
  { input: 'Joined Mar 2021', expected: 'Регистрация: мар. 2021' },
  { input: 'Joined Mar. 2021', expected: 'Регистрация: мар. 2021' },
  { input: 'Joined Sept 2021', expected: 'Регистрация: сент. 2021' },
  { input: 'Joined Sept. 2021', expected: 'Регистрация: сент. 2021' },
  { input: 'Joined Sep 2021', expected: 'Регистрация: сент. 2021' },
  { input: 'Joined Sep. 2021', expected: 'Регистрация: сент. 2021' },

  // Followers number variations
  { input: '150 followers', expected: '150 подписчиков' },
  { input: '12.5K followers', expected: '12.5K подписчиков' },
  { input: '1.2M followers', expected: '1.2M подписчиков' },
];

let failed = false;
extraTestCases.forEach((tc, idx) => {
  const result = translateMetadata(tc.input);
  try {
    assert.strictEqual(result, tc.expected);
    console.log(`Extra Test Case ${idx + 1} PASSED: "${tc.input}" -> "${result}"`);
  } catch (err) {
    console.error(`Extra Test Case ${idx + 1} FAILED:\n  Input:    "${tc.input}"\n  Expected: "${tc.expected}"\n  Actual:   "${result}"`);
    failed = true;
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log('All extra adversarial tests PASSED!');
  process.exit(0);
}
