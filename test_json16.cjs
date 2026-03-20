function repairJson(jsonString) {
  let repaired = jsonString;

  if (/^\s*[\{\[]\s*\\"/.test(repaired)) {
    try {
      // Simulate unescaping by parsing it as a JSON string
      const wrapped = '"' + repaired.replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
      const unescaped = JSON.parse(wrapped);
      // Verify that the unescaped string is actually valid JSON before using it
      JSON.parse(unescaped);
      repaired = unescaped;
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }
  return repaired;
}

console.log(repairJson('{\\"key\\": \\"value\\"}'));
