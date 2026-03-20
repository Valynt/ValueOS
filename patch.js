const fs = require('fs');
const file = 'packages/backend/src/services/post-v1/IntegrityAgentService.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(
  "      // SECURITY FIX: Use secureLLMComplete instead of direct llmGateway.complete()\n      const response = await secureLLMComplete(this.llmGateway, feedbackMessages, {",
  "      // SECURITY FIX: Use secureLLMComplete instead of direct llmGateway.complete() for generating quiz feedback\n      const response = await secureLLMComplete(this.llmGateway, feedbackMessages, {"
);
fs.writeFileSync(file, code);
