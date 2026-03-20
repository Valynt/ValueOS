const fs = require('fs');
const file = 'packages/backend/src/services/post-v1/IntegrityAgentService.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  "// SECURITY FIX: Use secureLLMComplete instead of direct llmGateway.complete()",
  "// SECURITY FIX: Use secureLLMComplete instead of direct llmGateway.complete() for generating quiz feedback"
);
fs.writeFileSync(file, code);
