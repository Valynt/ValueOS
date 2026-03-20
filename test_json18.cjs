let repaired = '{\\"key\\": \\"value\\"}';
// If repaired contains literal `\` and `"`, we can just replace `\"` with `"`
// BUT only if it is actually fully double-escaped.

// If it starts with `{\"` or `[\"`, we know it's probably fully escaped.
// If it has NO unescaped quotes, it's definitely fully escaped.
let unescapedQuotes = (repaired.match(/(?<!\\)"/g) || []).length;
let escapedQuotes = (repaired.match(/(?<!\\)\\"/g) || []).length;

console.log(unescapedQuotes, escapedQuotes); // negative lookbehinds work in Node 20+, but we don't want them for Safari
