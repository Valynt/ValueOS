const fs = require("fs");

async function applyPatch(patch) {
  let content = fs.readFileSync(patch.file, "utf8");
  patch.changes.forEach((change) => {
    content = content.replace(change.regex, change.replacement);
  });
  fs.writeFileSync(patch.file, content, "utf8");
}

module.exports = { applyPatch };
