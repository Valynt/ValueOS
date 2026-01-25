# Documentation Portal Dependencies

Complete list of dependencies required for the in-product documentation portal.

## 📦 Required Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.20.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "remark-gfm": "^4.0.0"
  }
}
```

### Installation

```bash
# Install all required dependencies
npm install react-markdown@^9.0.0 \
  react-syntax-highlighter@^15.5.0 \
  remark-gfm@^4.0.0

# Install type definitions
npm install --save-dev @types/react-syntax-highlighter@^15.5.0
```

## 📚 Dependency Details

### react-markdown (^9.0.0)

**Purpose**: Renders markdown content to React components

**Features**:
- GitHub Flavored Markdown support
- Custom component rendering
- Plugin system
- Safe by default (XSS protection)

**Usage**:
```tsx
import ReactMarkdown from 'react-markdown';

<ReactMarkdown>{markdownContent}</ReactMarkdown>
```

**Size**: ~50KB (minified + gzipped)

**License**: MIT

**Documentation**: [https://github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)

---

### react-syntax-highlighter (^15.5.0)

**Purpose**: Syntax highlighting for code blocks

**Features**:
- 100+ language support
- Multiple themes
- Line numbers
- Copy functionality
- Async loading

**Usage**:
```tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

<SyntaxHighlighter language="typescript" style={vscDarkPlus}>
  {code}
</SyntaxHighlighter>
```

**Size**: ~200KB (minified + gzipped, with theme)

**License**: MIT

**Documentation**: [https://github.com/react-syntax-highlighter/react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)

---

### remark-gfm (^4.0.0)

**Purpose**: GitHub Flavored Markdown plugin for react-markdown

**Features**:
- Tables
- Task lists
- Strikethrough
- Autolinks
- Footnotes

**Usage**:
```tsx
import remarkGfm from 'remark-gfm';

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {markdownContent}
</ReactMarkdown>
```

**Size**: ~15KB (minified + gzipped)

**License**: MIT

**Documentation**: [https://github.com/remarkjs/remark-gfm](https://github.com/remarkjs/remark-gfm)

---

## 🔧 Optional Dependencies

### For Enhanced Features

```json
{
  "dependencies": {
    "rehype-raw": "^7.0.0",
    "rehype-sanitize": "^6.0.0",
    "remark-math": "^6.0.0",
    "rehype-katex": "^7.0.0"
  }
}
```

#### rehype-raw
- Allows HTML in markdown
- Use with caution (security risk)
- Size: ~10KB

#### rehype-sanitize
- Sanitizes HTML in markdown
- Recommended if using rehype-raw
- Size: ~20KB

#### remark-math + rehype-katex
- Mathematical equations support
- LaTeX syntax
- Size: ~100KB combined

---

## 📊 Bundle Size Analysis

### Total Size (Production Build)

| Component | Size (gzipped) |
|-----------|----------------|
| react-markdown | ~50KB |
| react-syntax-highlighter | ~200KB |
| remark-gfm | ~15KB |
| Documentation components | ~30KB |
| **Total** | **~295KB** |

### Optimization Strategies

1. **Code Splitting**
```tsx
// Lazy load documentation portal
const DocsPortal = lazy(() => import('./components/docs/DocsPortal'));
```

2. **Dynamic Imports**
```tsx
// Load syntax highlighter only when needed
const SyntaxHighlighter = lazy(() => 
  import('react-syntax-highlighter').then(mod => ({ 
    default: mod.Prism 
  }))
);
```

3. **Tree Shaking**
```tsx
// Import only what you need
import { Prism } from 'react-syntax-highlighter';
// Instead of:
// import * as SyntaxHighlighter from 'react-syntax-highlighter';
```

---

## 🔄 Version Compatibility

### React Version Requirements

| Package | React Version |
|---------|---------------|
| react-markdown | >=18.0.0 |
| react-syntax-highlighter | >=16.8.0 |
| remark-gfm | >=18.0.0 |

### Node Version Requirements

- **Minimum**: Node.js 18.0.0
- **Recommended**: Node.js 20.x LTS

---

## 🚀 Installation Scripts

### Quick Install

```bash
# Install all dependencies at once
npm install react-markdown react-syntax-highlighter remark-gfm @types/react-syntax-highlighter
```

### Verify Installation

```bash
# Check installed versions
npm list react-markdown react-syntax-highlighter remark-gfm
```

### Update Dependencies

```bash
# Update to latest compatible versions
npm update react-markdown react-syntax-highlighter remark-gfm
```

---

## 🐛 Common Issues

### Issue: Module not found

**Error**: `Cannot find module 'react-markdown'`

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
npm install
```

### Issue: Type errors with react-syntax-highlighter

**Error**: `Could not find a declaration file for module 'react-syntax-highlighter'`

**Solution**:
```bash
npm install --save-dev @types/react-syntax-highlighter
```

### Issue: Large bundle size

**Problem**: Bundle size too large

**Solution**:
1. Use code splitting
2. Lazy load components
3. Import only needed languages for syntax highlighter

```tsx
// Instead of importing all languages
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

// Import specific languages
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';

SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
```

---

## 📝 Development Dependencies

### For Testing

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "vitest": "^4.0.15"
  }
}
```

### For Linting

```json
{
  "devDependencies": {
    "eslint": "^9.39.2",
    "eslint-plugin-react": "^7.33.0",
    "eslint-plugin-react-hooks": "^5.1.0"
  }
}
```

---

## 🔒 Security Considerations

### Known Vulnerabilities

Check for vulnerabilities:
```bash
npm audit
```

Fix vulnerabilities:
```bash
npm audit fix
```

### Dependency Updates

Keep dependencies updated:
```bash
# Check for outdated packages
npm outdated

# Update to latest versions
npm update
```

### Security Best Practices

1. **Regular updates**: Update dependencies monthly
2. **Audit regularly**: Run `npm audit` before deployments
3. **Lock versions**: Use `pnpm-lock.yaml`
4. **Review changes**: Check changelogs before updating
5. **Test thoroughly**: Test after dependency updates

---

## 📚 Alternative Packages

### Markdown Renderers

| Package | Pros | Cons |
|---------|------|------|
| **react-markdown** | Lightweight, secure | Limited HTML support |
| marked + DOMPurify | Full HTML support | More setup required |
| markdown-it | Fast, extensible | Not React-specific |

### Syntax Highlighters

| Package | Pros | Cons |
|---------|------|------|
| **react-syntax-highlighter** | Easy to use, many themes | Large bundle |
| prism-react-renderer | Smaller bundle | Fewer themes |
| highlight.js | Fast, popular | Manual React integration |

---

## 🎯 Recommended Setup

### For Production

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/react-syntax-highlighter": "^15.5.0"
  }
}
```

### For Development

Add these for better DX:

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "vitest": "^4.0.15"
  }
}
```

---

## 📖 Additional Resources

- [React Markdown Documentation](https://github.com/remarkjs/react-markdown)
- [React Syntax Highlighter Documentation](https://github.com/react-syntax-highlighter/react-syntax-highlighter)
- [Remark GFM Documentation](https://github.com/remarkjs/remark-gfm)
- [npm Package Search](https://www.npmjs.com/)
- [Bundle Size Analyzer](https://bundlephobia.com/)

---

**Questions?** Check the [Integration Guide](./IN_PRODUCT_INTEGRATION.md) or contact the development team.
