const fs = require('fs');

const files = fs.readdirSync('.github/workflows').map(f => '.github/workflows/' + f).filter(f => f.endsWith('.yml'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/path: gitleaks-diff\.sarif/g, 'path: results.sarif');
  content = content.replace(/path: gitleaks-pr\.sarif/g, 'path: results.sarif');
  fs.writeFileSync(file, content, 'utf8');
}
