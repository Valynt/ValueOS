import { CodeAnalysis } from '../types/index.js';

export async function analyzeCode(
  filePath: string,
  content: string,
  languages: string[]
): Promise<CodeAnalysis[]> {
  const issues: CodeAnalysis[] = [];

  const extension = filePath.split('.').pop()?.toLowerCase();

  if (!extension) return issues;

  // Language-specific analysis
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      issues.push(...analyzeJavaScript(content, filePath));
      break;
    case 'py':
      issues.push(...analyzePython(content, filePath));
      break;
    case 'java':
      issues.push(...analyzeJava(content, filePath));
      break;
    default:
      // Generic analysis for other languages
      issues.push(...analyzeGeneric(content, filePath));
  }

  return issues;
}

function analyzeJavaScript(content: string, filePath: string): CodeAnalysis[] {
  const issues: CodeAnalysis[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for nested loops (potential O(n^2))
    if (line.includes('for') && line.includes('for')) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Nested loops detected - potential O(n^2) complexity',
        rule: 'nested-loops',
      });
    }

    // Check for large arrays/objects
    if (line.match(/\b(Array|Object)\(\d+\)/) && parseInt(line.match(/\d+/)?.[0] || '0') > 1000) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Large data structure initialization',
        rule: 'large-data-structure',
      });
    }

    // Check for inefficient string concatenation
    if (line.includes('+=') && line.includes('"') && lines.some(l => l.includes('for'))) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'info',
        message: 'String concatenation in loop - consider using array join',
        rule: 'string-concat-loop',
      });
    }

    // Check for unused variables (simple heuristic)
    const varMatch = line.match(/\b(const|let|var)\s+(\w+)/);
    if (varMatch) {
      const varName = varMatch[2];
      const isUsed = content.includes(varName) &&
                     content.split(varName).length > 2; // Declared + at least one usage
      if (!isUsed) {
        issues.push({
          file: filePath,
          line: lineNumber,
          severity: 'info',
          message: `Potentially unused variable: ${varName}`,
          rule: 'unused-variable',
        });
      }
    }
  }

  return issues;
}

function analyzePython(content: string, filePath: string): CodeAnalysis[] {
  const issues: CodeAnalysis[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for nested loops
    if (line.includes('for') && lines.slice(Math.max(0, i-5), i+5).some(l => l.includes('for'))) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Nested loops detected',
        rule: 'nested-loops',
      });
    }

    // Check for inefficient list comprehensions
    if (line.includes('[') && line.includes('for') && line.includes('for')) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'info',
        message: 'Nested list comprehension - consider optimization',
        rule: 'nested-comprehension',
      });
    }

    // Check for large range() calls
    const rangeMatch = line.match(/range\((\d+)\)/);
    if (rangeMatch && parseInt(rangeMatch[1]) > 10000) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Large range() call may cause memory issues',
        rule: 'large-range',
      });
    }
  }

  return issues;
}

function analyzeJava(content: string, filePath: string): CodeAnalysis[] {
  const issues: CodeAnalysis[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for nested loops
    if (line.includes('for') && lines.slice(Math.max(0, i-5), i+5).some(l => l.includes('for'))) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Nested loops detected',
        rule: 'nested-loops',
      });
    }

    // Check for large array allocations
    const arrayMatch = line.match(/new\s+\w+\[(\d+)\]/);
    if (arrayMatch && parseInt(arrayMatch[1]) > 10000) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        message: 'Large array allocation',
        rule: 'large-array',
      });
    }

    // Check for string concatenation in loops
    if (line.includes('+=') && line.includes('"') && lines.some(l => l.includes('for'))) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'info',
        message: 'String concatenation in loop',
        rule: 'string-concat-loop',
      });
    }
  }

  return issues;
}

function analyzeGeneric(content: string, filePath: string): CodeAnalysis[] {
  const issues: CodeAnalysis[] = [];
  const lines = content.split('\n');

  // Basic analysis for any language
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for very long lines (potential complexity)
    if (line.length > 200) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'info',
        message: 'Very long line - consider breaking it up',
        rule: 'long-line',
      });
    }

    // Check for repeated code patterns (simple heuristic)
    const trimmed = line.trim();
    if (trimmed.length > 10 && lines.filter(l => l.trim() === trimmed).length > 2) {
      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'info',
        message: 'Repeated code pattern detected',
        rule: 'repeated-code',
      });
    }
  }

  return issues;
}