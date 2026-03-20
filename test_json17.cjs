let repaired = '{\\"key\\": \\"value\\"}';
// if we wrap it in quotes and parse:
// '"{\\"key\\": \\"value\\"}"' -> JSON.parse should give us '{"key": "value"}'
// But wait! If repaired already contains `\`, `repaired.replace` operates on the raw JS string.
// In raw JS string, `{\\"key\\": \\"value\\"}` means it has actual backslash characters!
let wrapped = '"' + repaired.replace(/"/g, '\\"') + '"';
console.log(wrapped);
try {
  console.log(JSON.parse(wrapped));
} catch (e) {
  console.log(e.message);
}
