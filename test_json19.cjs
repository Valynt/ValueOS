const str1 = '{\\"key\\": \\"value\\"}';
const str2 = '{"payload": "{\\"key\\": \\"value\\"}"}';

function isDoubleEscaped(str) {
  // A string is "fully double-escaped" if it has structural escaped quotes at the start,
  // and essentially NO unescaped quotes.
  // Instead of negative lookbehinds, we can just count occurrences:
  // How many `"` total?
  // How many `\"` total?
  // If total `"` === total `\"` (meaning EVERY quote is preceded by a slash), it's fully escaped.
  // Wait, if it's `\"` then it's a slash and a quote. What if it's `\\"`?
  // Then the slash is escaped, and the quote is unescaped!

  let quotes = (str.match(/"/g) || []).length;
  let escapedQuotes = (str.match(/\\"/g) || []).length;
  // This is a naive heuristic: if every quote in the string is an escaped quote,
  // then quotes === escapedQuotes.
  // Exception: `\\"` means the quote is NOT escaped, but `\\"` still matches `/\\"/g`!
  // To prevent `\\"` from matching `/\\"/g`, we can replace `\\\\` with nothing first.
  let strWithoutEscapedSlashes = str.replace(/\\\\/g, '');
  quotes = (strWithoutEscapedSlashes.match(/"/g) || []).length;
  escapedQuotes = (strWithoutEscapedSlashes.match(/\\"/g) || []).length;

  if (quotes > 0 && quotes === escapedQuotes) {
    return true;
  }
  return false;
}

console.log('str1 is double escaped?', isDoubleEscaped(str1));
console.log('str2 is double escaped?', isDoubleEscaped(str2));

if (isDoubleEscaped(str1)) {
  console.log(str1.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}
