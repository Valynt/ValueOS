#!/usr/bin/env node

/**
 * VALYNT Design Token Validation Script
 * 
 * Validates that code follows VALYNT design system rules:
 * - No raw hex color values
 * - No raw px values (except in CSS variables)
 * - Use semantic tokens only
 * - Follow 8px spacing grid
 * 
 * This script is run in CI/CD to enforce design system compliance.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Configuration
const config = {
  // File patterns to check
  include: [
    'src/**/*.{ts,tsx,js,jsx}',
    'src/**/*.css',
  ],
  // File patterns to exclude
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.stories.{ts,tsx,js,jsx}',
    '**/index.css', // CSS variables file is allowed to have raw values
    '**/*.config.{ts,js,cjs}', // Config files are allowed
  ],
  // Allowed exceptions (specific patterns that are OK)
  allowedPatterns: [
    /\/\/ @design-token-exception:/,
    /\/\* @design-token-exception: .* \*\//,
  ],
};

// Validation rules
const rules = {
  // Rule 1: No raw hex colors (except in CSS variable definitions)
  rawHexColors: {
    name: 'No Raw Hex Colors',
    description: 'Use semantic color tokens (e.g., bg-primary) instead of hex values',
    pattern: /#[0-9A-Fa-f]{3,8}\b/g,
    severity: 'error',
    allowedContexts: [
      /--[\w-]+:\s*#[0-9A-Fa-f]{3,8}/, // CSS variable definitions
      /\/\*.*#[0-9A-Fa-f]{3,8}.*\*\//, // Comments
    ],
  },

  // Rule 2: No raw RGB/RGBA colors
  rawRgbColors: {
    name: 'No Raw RGB Colors',
    description: 'Use semantic color tokens instead of rgb/rgba values',
    pattern: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g,
    severity: 'error',
    allowedContexts: [
      /--[\w-]+:.*rgba?\(/, // CSS variable definitions
      /\/\*.*rgba?\(.*\*\//, // Comments
    ],
  },

  // Rule 3: No raw pixel values (except in specific contexts)
  rawPixelValues: {
    name: 'No Raw Pixel Values',
    description: 'Use spacing tokens (e.g., p-vc-2) instead of raw px values',
    pattern: /:\s*\d+px\b/g,
    severity: 'warning',
    allowedContexts: [
      /--[\w-]+:.*\d+px/, // CSS variable definitions
      /\/\*.*\d+px.*\*\//, // Comments
      /font-size:.*\d+px/, // Font sizes are OK
      /line-height:.*\d+px/, // Line heights are OK
    ],
  },

  // Rule 4: Inline styles (should use className instead)
  inlineStyles: {
    name: 'No Inline Styles',
    description: 'Use className with Tailwind/CSS instead of inline styles',
    pattern: /style=\{\{[^}]+\}\}/g,
    severity: 'warning',
    allowedContexts: [
      /\/\/ @design-token-exception:/, // Explicit exceptions
    ],
  },

  // Rule 5: Non-semantic color classes
  nonSemanticColors: {
    name: 'No Non-Semantic Color Classes',
    description: 'Use semantic tokens (bg-primary, text-foreground) instead of direct colors',
    pattern: /className=["'][^"']*\b(bg|text|border)-(blue|red|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone)-\d{2,3}\b/g,
    severity: 'error',
    allowedContexts: [
      /\/\/ @design-token-exception:/, // Explicit exceptions
    ],
  },
};

// Main validation function
async function validateDesignTokens() {
  console.log(`${colors.cyan}🎨 VALYNT Design Token Validation${colors.reset}\n`);

  // Get all files to check
  const files = await getFilesToCheck();
  console.log(`Checking ${files.length} files...\n`);

  let totalViolations = 0;
  let totalErrors = 0;
  let totalWarnings = 0;
  const violationsByFile = new Map();

  // Check each file
  for (const file of files) {
    const violations = await checkFile(file);
    if (violations.length > 0) {
      violationsByFile.set(file, violations);
      totalViolations += violations.length;
      
      violations.forEach(v => {
        if (v.severity === 'error') totalErrors++;
        if (v.severity === 'warning') totalWarnings++;
      });
    }
  }

  // Report results
  if (totalViolations === 0) {
    console.log(`${colors.green}✅ All files pass design token validation!${colors.reset}\n`);
    return 0;
  }

  console.log(`${colors.red}❌ Found ${totalViolations} design token violations${colors.reset}`);
  console.log(`   ${totalErrors} errors, ${totalWarnings} warnings\n`);

  // Print violations by file
  for (const [file, violations] of violationsByFile) {
    console.log(`${colors.yellow}${file}${colors.reset}`);
    
    violations.forEach(violation => {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      const color = violation.severity === 'error' ? colors.red : colors.yellow;
      
      console.log(`  ${icon} Line ${violation.line}: ${color}${violation.rule}${colors.reset}`);
      console.log(`     ${violation.description}`);
      console.log(`     Found: ${colors.cyan}${violation.match}${colors.reset}`);
      console.log();
    });
  }

  // Exit with error if there are any errors
  if (totalErrors > 0) {
    console.log(`${colors.red}Design token validation failed with ${totalErrors} errors${colors.reset}`);
    return 1;
  }

  console.log(`${colors.yellow}Design token validation passed with ${totalWarnings} warnings${colors.reset}`);
  return 0;
}

// Get list of files to check
async function getFilesToCheck() {
  const files = [];
  
  for (const pattern of config.include) {
    const matches = await glob(pattern, {
      ignore: config.exclude,
      nodir: true,
    });
    files.push(...matches);
  }
  
  return [...new Set(files)]; // Remove duplicates
}

// Check a single file for violations
async function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  // Check each rule
  for (const [ruleKey, rule] of Object.entries(rules)) {
    let match;
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    
    while ((match = pattern.exec(content)) !== null) {
      const matchText = match[0];
      const position = match.index;
      
      // Find line number
      const lineNumber = content.substring(0, position).split('\n').length;
      const line = lines[lineNumber - 1];
      
      // Check if this match is in an allowed context
      if (isAllowedContext(line, content, position, rule)) {
        continue;
      }
      
      // Check for explicit exceptions
      if (hasExplicitException(lines, lineNumber - 1)) {
        continue;
      }
      
      violations.push({
        rule: rule.name,
        description: rule.description,
        severity: rule.severity,
        line: lineNumber,
        match: matchText,
      });
    }
  }

  return violations;
}

// Check if a match is in an allowed context
function isAllowedContext(line, content, position, rule) {
  if (!rule.allowedContexts) return false;
  
  // Check line-level contexts
  for (const context of rule.allowedContexts) {
    if (context.test(line)) {
      return true;
    }
  }
  
  return false;
}

// Check if there's an explicit exception comment
function hasExplicitException(lines, lineIndex) {
  // Check current line and previous line for exception comments
  for (let i = Math.max(0, lineIndex - 1); i <= lineIndex; i++) {
    const line = lines[i];
    for (const pattern of config.allowedPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }
  }
  return false;
}

// Run validation
validateDesignTokens()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error(`${colors.red}Error running validation:${colors.reset}`, error);
    process.exit(1);
  });
