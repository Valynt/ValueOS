# Documentation Guide

**Last Updated:** 2024-11-29

This file provides guidance on maintaining and updating ValueCanvas documentation.

## 📚 Documentation Structure

All documentation follows a canonical structure to prevent duplication and stale information.

### Canonical Sources

| Topic | Location | Format |
|-------|----------|--------|
| **Current Status** | `docs/STATUS.md` | Single file, updated regularly |
| **Deployment** | `docs/deployment/DEPLOYMENT_CHECKLIST.md` | Phase-by-phase guide |
| **Security** | `docs/security/SECURITY_REMEDIATION.md` | Security status & procedures |
| **API Reference** | `docs/api/` | Directory with versioned docs |
| **Guides** | `docs/guides/` | Topic-specific guides |

## ✅ Adding New Documentation

### 1. Choose the Right Location

```
docs/
├── STATUS.md              # Overall project status
├── deployment/            # Deployment procedures
├── security/              # Security documentation
├── api/                   # API documentation
├── guides/                # How-to guides
├── architecture/          # Architecture docs
└── archive/               # Historical docs
```

### 2. Add Required Metadata

Every document must include:

```markdown
# Document Title

**Last Updated:** YYYY-MM-DD

[Content here]
```

### 3. Update the Index

Add your new document to `docs/README.md`:

```markdown
- **[Your Doc Title](path/to/doc.md)** - Brief description
```

### 4. Follow Naming Conventions

- Use `SCREAMING_SNAKE_CASE.md` for important docs
- Use `kebab-case.md` for regular docs
- Add date prefix for versioned docs: `YYYYMMDD_description.md`

## 🔄 Updating Existing Documentation

### 1. Update the Timestamp

```markdown
**Last Updated:** 2024-11-29  # ← Change this
```

### 2. Mark Deprecation if Replacing

```markdown
> ⚠️ **DEPRECATED:** This document has been superseded by [New Doc](link.md)
> **Deprecated:** 2024-11-29
```

### 3. Move Old Versions to Archive

```bash
mv old_doc.md docs/archive/
```

### 4. Update Links

Search for references to moved/deprecated docs:

```bash
grep -r "old_doc.md" docs/
```

## 📅 Monthly Maintenance

On the 1st of each month, review and update:

- [ ] Check all timestamps
- [ ] Update stale docs or mark as deprecated
- [ ] Verify all links work
- [ ] Archive completed initiatives
- [ ] Update `docs/STATUS.md`

## ⚠️ Common Mistakes to Avoid

### DON'T:
- ❌ Create duplicate status files
- ❌ Skip timestamps
- ❌ Update archived files
- ❌ Hard-code dates in content
- ❌ Create files in root directory

### DO:
- ✅ Use canonical locations
- ✅ Add timestamps to every doc
- ✅ Archive old versions
- ✅ Update index when adding docs
- ✅ Keep docs in `docs/` directory

## 📝 Templates

### Status Update Template

\`\`\`markdown
# [Feature/Initiative] Status

**Last Updated:** YYYY-MM-DD

## Status: [COMPLETE/IN_PROGRESS/PLANNED]

## Delivered
- ✅ Item 1
- ✅ Item 2

## In Progress
- 🔄 Item 3

## Remaining
- ⏸️ Item 4

## Metrics
[Add relevant metrics]

## Next Steps
[Add next steps]
\`\`\`

### Deployment Guide Template

\`\`\`markdown
# [Component] Deployment

**Last Updated:** YYYY-MM-DD

## Prerequisites
- [ ] Item 1
- [ ] Item 2

## Deployment Steps

1. **Step Name**
   \`\`\`bash
   command here
   \`\`\`

2. **Next Step**
   [Instructions]

## Verification
- [ ] Check 1
- [ ] Check 2

## Rollback
\`\`\`bash
rollback commands
\`\`\`
\`\`\`

## 🔍 Finding Documentation

### By Topic
\`\`\`bash
# Search all docs
grep -r "search term" docs/

# Search specific category
grep -r "search term" docs/deployment/
\`\`\`

### By Date
\`\`\`bash
# Find recently updated docs
find docs/ -name "*.md" -mtime -7
\`\`\`

### By Status
Check `docs/STATUS.md` for current project status.

## 📞 Questions?

- Check [docs/README.md](../docs/README.md) for index
- See [docs/STATUS.md](../docs/STATUS.md) for current status
- Check [docs/archive/DEPRECATED_STATUS_FILES.md](../docs/archive/DEPRECATED_STATUS_FILES.md) for old docs

---

**Maintained by:** ValueCanvas Team  
**Last Review:** 2024-11-29  
**Next Review:** 2024-12-01
