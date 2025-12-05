#!/usr/bin/env node

/**
 * Terraform Plan Parser
 * Parses Terraform plan output and generates a formatted summary
 */

const fs = require('fs');

function parseTerraformPlan(planText) {
  const result = {
    resources: {
      create: [],
      update: [],
      destroy: [],
      replace: []
    },
    summary: {
      create: 0,
      update: 0,
      destroy: 0,
      replace: 0
    },
    warnings: [],
    errors: []
  };

  const lines = planText.split('\n');
  let currentResource = null;
  let inResourceBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect resource operations
    if (line.includes('will be created')) {
      const match = line.match(/# (.+?) will be created/);
      if (match) {
        result.resources.create.push(match[1]);
        result.summary.create++;
      }
    } else if (line.includes('will be updated in-place')) {
      const match = line.match(/# (.+?) will be updated in-place/);
      if (match) {
        result.resources.update.push(match[1]);
        result.summary.update++;
      }
    } else if (line.includes('will be destroyed')) {
      const match = line.match(/# (.+?) will be destroyed/);
      if (match) {
        result.resources.destroy.push(match[1]);
        result.summary.destroy++;
      }
    } else if (line.includes('must be replaced')) {
      const match = line.match(/# (.+?) must be replaced/);
      if (match) {
        result.resources.replace.push(match[1]);
        result.summary.replace++;
      }
    }

    // Detect warnings
    if (line.includes('Warning:')) {
      result.warnings.push(line.trim());
    }

    // Detect errors
    if (line.includes('Error:')) {
      result.errors.push(line.trim());
    }
  }

  return result;
}

function generateMarkdownSummary(parsed) {
  let markdown = '### 📊 Resource Changes\n\n';

  // Summary table
  markdown += '| Action | Count | Resources |\n';
  markdown += '|--------|-------|----------|\n';
  
  if (parsed.summary.create > 0) {
    markdown += `| 🟢 Create | ${parsed.summary.create} | `;
    markdown += parsed.resources.create.slice(0, 3).map(r => `\`${r}\``).join(', ');
    if (parsed.resources.create.length > 3) {
      markdown += ` and ${parsed.resources.create.length - 3} more`;
    }
    markdown += ' |\n';
  }

  if (parsed.summary.update > 0) {
    markdown += `| 🟡 Update | ${parsed.summary.update} | `;
    markdown += parsed.resources.update.slice(0, 3).map(r => `\`${r}\``).join(', ');
    if (parsed.resources.update.length > 3) {
      markdown += ` and ${parsed.resources.update.length - 3} more`;
    }
    markdown += ' |\n';
  }

  if (parsed.summary.replace > 0) {
    markdown += `| 🟠 Replace | ${parsed.summary.replace} | `;
    markdown += parsed.resources.replace.slice(0, 3).map(r => `\`${r}\``).join(', ');
    if (parsed.resources.replace.length > 3) {
      markdown += ` and ${parsed.resources.replace.length - 3} more`;
    }
    markdown += ' |\n';
  }

  if (parsed.summary.destroy > 0) {
    markdown += `| 🔴 Destroy | ${parsed.summary.destroy} | `;
    markdown += parsed.resources.destroy.slice(0, 3).map(r => `\`${r}\``).join(', ');
    if (parsed.resources.destroy.length > 3) {
      markdown += ` and ${parsed.resources.destroy.length - 3} more`;
    }
    markdown += ' |\n';
  }

  // Warnings section
  if (parsed.warnings.length > 0) {
    markdown += '\n### ⚠️ Warnings\n\n';
    parsed.warnings.forEach(warning => {
      markdown += `- ${warning}\n`;
    });
  }

  // Errors section
  if (parsed.errors.length > 0) {
    markdown += '\n### ❌ Errors\n\n';
    parsed.errors.forEach(error => {
      markdown += `- ${error}\n`;
    });
  }

  // Destructive changes warning
  if (parsed.summary.destroy > 0 || parsed.summary.replace > 0) {
    markdown += '\n### 🚨 Destructive Changes Detected\n\n';
    markdown += 'This plan includes destructive operations:\n\n';
    
    if (parsed.summary.destroy > 0) {
      markdown += `- **${parsed.summary.destroy} resource(s) will be destroyed**\n`;
      parsed.resources.destroy.forEach(resource => {
        markdown += `  - \`${resource}\`\n`;
      });
    }
    
    if (parsed.summary.replace > 0) {
      markdown += `- **${parsed.summary.replace} resource(s) will be replaced** (destroy + create)\n`;
      parsed.resources.replace.forEach(resource => {
        markdown += `  - \`${resource}\`\n`;
      });
    }
    
    markdown += '\n⚠️ **Please review these changes carefully before merging!**\n';
  }

  return markdown;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: parse-terraform-plan.js <plan-file>');
    process.exit(1);
  }

  const planFile = args[0];
  
  try {
    const planText = fs.readFileSync(planFile, 'utf8');
    const parsed = parseTerraformPlan(planText);
    const markdown = generateMarkdownSummary(parsed);
    
    console.log(markdown);
    
    // Exit with error if there are errors
    if (parsed.errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error parsing plan:', error.message);
    process.exit(1);
  }
}

module.exports = { parseTerraformPlan, generateMarkdownSummary };
