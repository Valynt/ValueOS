// What if we just use the `JSON.parse` wrapper method to unescape?
// `JSON.parse('"{\\"key\\": \\"value\\"}"')` fails because `\\"key\\"` contains `\` which is escaping the quote.
// Wait, `"{\\"key\\": \\"value\\"}"` in JS literal is:
// "{\\"key\\": \\"value\\"}"
// So `\"` is `\"`, which means it's unescaped quotes!
// Yes, `JSON.parse` expects `\"` to mean literal `"`.
// Let's create the string literal equivalent manually:
let repaired = '{\\"key\\": \\"value\\"}';
// the string `repaired` literally has `\` and `"`.
// So it is `{\\"key\\": \\"value\\"}`.
let wrapped = '"' + repaired.replace(/"/g, '\\"').replace(/\\\\"/g, '\\\\\\"').replace(/\n/g, '\\n') + '"';

// Actually, wait, replacing `\"` with `"` manually IS EXACTLY `repaired.replace(/\\"/g, '"');`
// BUT we only do it if the string is fully escaped!

let quotes = (repaired.replace(/\\\\/g, '').match(/"/g) || []).length;
let escapedQuotes = (repaired.replace(/\\\\/g, '').match(/\\"/g) || []).length;
if (quotes > 0 && quotes === escapedQuotes) {
  repaired = repaired.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
console.log(repaired);
