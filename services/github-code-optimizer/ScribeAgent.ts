import { BaseAgent } from "./BaseAgent";
import { Octokit } from "@octokit/rest";
import OpenAI from "openai";

export class ScribeAgent extends BaseAgent {
  private openai: OpenAI;
  private octokit: Octokit;

  constructor(openaiApiKey: string, githubToken: string) {
    super();
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.octokit = new Octokit({ auth: githubToken });
  }

  async summarizeAndPropose(
    changedFiles: string[],
    repo: { owner: string; repo: string },
    baseBranch: string
  ) {
    // 1. Summarize changes
    const summary = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a documentation assistant. Summarize the following codebase changes and propose updates to documentation, API specs, or coding rules as needed.",
        },
        { role: "user", content: `Changed files: ${changedFiles.join(", ")}` },
      ],
    });
    const docSummary = summary.choices[0]?.message?.content || "No summary.";

    // 2. (Stub) Propose doc/rule changes (real implementation would diff and edit files)
    // For now, just create a PR with a summary file
    const branchName = `scribe/update-docs-${Date.now()}`;
    await this.octokit.git.createRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `refs/heads/${branchName}`,
      sha: (
        await this.octokit.repos.get({ owner: repo.owner, repo: repo.repo })
      ).data.default_branch,
    });
    await this.octokit.repos.createOrUpdateFileContents({
      owner: repo.owner,
      repo: repo.repo,
      path: "SCRIBE_SUMMARY.md",
      message: "docs: Auto-update by Scribe Agent",
      content: Buffer.from(docSummary).toString("base64"),
      branch: branchName,
    });
    await this.octokit.pulls.create({
      owner: repo.owner,
      repo: repo.repo,
      title: "docs: Auto-update by Scribe Agent",
      head: branchName,
      base: baseBranch,
      body: docSummary,
    });
  }
}
