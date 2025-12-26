import { Octokit } from "@octokit/rest";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function postReport(repo, vuln, fixResult, config) {
  const [owner, repoName] = repo.split("/");
  if (config.enablePRComments && vuln.prNumber) {
    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: vuln.prNumber,
      body: `Security Agent detected: **${vuln.message}**\nSeverity: ${vuln.severity}\n${fixResult.fixed ? "✅ Auto-fix applied." : "❌ Manual review required."}`,
    });
  }
  if (config.enableIssueReporting && !vuln.prNumber) {
    await octokit.issues.create({
      owner,
      repo: repoName,
      title: `[Security] ${vuln.message}`,
      body: `Detected by Security Agent.\nSeverity: ${vuln.severity}\nRule: ${vuln.ruleId}\n${fixResult.fixed ? "✅ Auto-fix applied." : "❌ Manual review required."}`,
    });
  }
}

async function logTodo(_repo, _vuln, _fixResult) {
  // Append to a TODO issue or file
  // Example: create or update a "Security TODO" issue
}

function logError(err) {
  console.error("[SecurityAgent]", err);
}

module.exports = { postReport, logTodo, logError };
