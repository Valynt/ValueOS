const str1 = '{\\"key\\": \\"value\\"}';
const str2 = '{"payload": "{\\"key\\": \\"value\\"}"}';
const str3 = '{"key": "Don\'t do this"}';
const { parseLLMOutput } = require('./apps/ValyntApp/dist/utils/safeJsonParser') || {}; // just checking the code

function repairJson(jsonString) {
  let repaired = jsonString;
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  repaired = repaired.replace(/'([^']*)'/g, '"$1"');
  if (/^\s*[\{\[]\s*\\"/.test(repaired)) {
    try {
      const wrapped = '"' + repaired.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
      const unescaped = JSON.parse(wrapped);
      JSON.parse(unescaped);
      repaired = unescaped;
    } catch (e) {
    }
  }
  repaired = repaired.replace(/"\s*\n\s*"/g, '",\n"');
  repaired = repaired.replace(/:\s*undefined/g, ': null');
  return repaired;
}

console.log(repairJson(str1));
console.log(repairJson(str2));
console.log(repairJson(str3));
