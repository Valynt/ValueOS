const { scanRepoForVulnerabilities } = require("./lib/vulnerabilityScanner");
const { generateAndApplyFixes } = require("./lib/fixGenerator");
const { postReport, logTodo } = require("./lib/logger");
const config = require("./config.json");

(async () => {
  try {
    for (const repo of config.repos) {
      const findings = await scanRepoForVulnerabilities(repo, config);
      if (findings.length) {
        const prioritized = findings
          .filter(
            (f) => f.severityScore >= getSeverityScore(config.severityThreshold)
          )
          .sort((a, b) => b.severityScore - a.severityScore);
        for (const vuln of prioritized) {
          const fixResult = await generateAndApplyFixes(repo, vuln, config);
          await postReport(repo, vuln, fixResult, config);
          await logTodo(repo, vuln, fixResult);
        }
      }
    }
  } catch (err) {
    require("./lib/logger").logError(err);
    // escalate to manual review if needed
  }
})();

function getSeverityScore(level) {
  return { critical: 9, high: 7, medium: 4, low: 1 }[level] || 1;
}
