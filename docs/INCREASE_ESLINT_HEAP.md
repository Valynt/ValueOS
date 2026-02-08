# Increase Node.js heap limit for lint-staged ESLint

The pre-commit hook already sets:

export NODE_OPTIONS="--max-old-space-size=4096"

This is sufficient for most cases, but if you still encounter out-of-memory errors, you can increase the value (e.g., 8192) or set it directly in the lint-staged config for ESLint:

## Option 1: Increase heap limit in .husky/pre-commit

Edit `.husky/pre-commit`:

export NODE_OPTIONS="--max-old-space-size=8192"

## Option 2: Inline heap limit in lint-staged config

Update `package.json` lint-staged:

"lint-staged": {
"_.{ts,tsx}": [
"NODE_OPTIONS=--max-old-space-size=8192 eslint --fix"
],
"_.{json,md,yml,yaml}": [
"prettier --write"
]
}

## Option 3: Use noWarnOnMultipleProjects in ESLint config

Add to your ESLint config:

module.exports = {
...existing config,
parserOptions: {
...existing options,
noWarnOnMultipleProjects: true,
},
};

---

Choose one or combine for best results. If you want me to apply a specific change, let me know.
