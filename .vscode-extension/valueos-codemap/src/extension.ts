/**
 * ValueOS Codemap Extension
 *
 * Provides context-aware developer experience with:
 * - Live dependency graphs
 * - Blast radius visualization
 * - Hot path detection (via Prometheus)
 * - Risk scoring overlay
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";

interface DependencyInfo {
  imports: string[];
  importedBy: string[];
  isHotPath: boolean;
  requestsPerDay?: number;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("ValueOS Codemap extension activated");

  // Register commands
  const showDependencies = vscode.commands.registerCommand(
    "valueos-codemap.showDependencies",
    () => showDependencyGraph()
  );

  const showBlastRadius = vscode.commands.registerCommand(
    "valueos-codemap.showBlastRadius",
    () => showBlastRadiusAnalysis()
  );

  const analyzeImpact = vscode.commands.registerCommand(
    "valueos-codemap.analyzeImpact",
    () => runImpactAnalysis()
  );

  context.subscriptions.push(showDependencies, showBlastRadius, analyzeImpact);

  // Register editor decorations
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    updateDecorations(activeEditor);
  }

  // Listen for editor changes
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        updateDecorations(editor);
      }
    },
    null,
    context.subscriptions
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "valueos-codemap.analyzeImpact";
  statusBarItem.text = "$(graph) ValueOS";
  statusBarItem.tooltip = "Analyze Impact";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

/**
 * Show dependency graph for current file
 */
async function showDependencyGraph() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const filePath = editor.document.fileName;
  const dependencies = await analyzeDependencies(filePath);

  const panel = vscode.window.createWebviewPanel(
    "valueosCodemap",
    "Dependency Graph",
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(dependencies, filePath);
}

/**
 * Show blast radius analysis
 */
async function showBlastRadiusAnalysis() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage("No workspace open");
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing blast radius...",
      cancellable: false,
    },
    async (progress) => {
      const terminal = vscode.window.createTerminal("ValueOS Analysis");
      terminal.show();
      terminal.sendText("npm run analyze:impact");

      return new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
  );
}

/**
 * Run full impact analysis
 */
async function runImpactAnalysis() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  const impactPath = path.join(workspaceRoot, "impact.json");

  if (fs.existsSync(impactPath)) {
    const impact = JSON.parse(fs.readFileSync(impactPath, "utf-8"));

    const message = `
Blast Radius: ${impact.blastRadius} files
Risk Score: ${impact.riskScore}/10
Affected Services: ${impact.affectedServices.join(", ")}
    `.trim();

    const choice = await vscode.window.showInformationMessage(
      message,
      "Show Details",
      "Run Tests"
    );

    if (choice === "Show Details") {
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(impact, null, 2),
        language: "json",
      });
      await vscode.window.showTextDocument(doc);
    } else if (choice === "Run Tests") {
      const terminal = vscode.window.createTerminal("ValueOS Tests");
      terminal.show();
      terminal.sendText("npm run ci:local");
    }
  } else {
    vscode.window.showInformationMessage("Running impact analysis...");
    const terminal = vscode.window.createTerminal("ValueOS Analysis");
    terminal.show();
    terminal.sendText("npm run analyze:impact");
  }
}

/**
 * Update editor decorations (highlight hot paths)
 */
async function updateDecorations(editor: vscode.TextEditor) {
  const config = vscode.workspace.getConfiguration("valueos.codemap");
  if (!config.get("enabled")) {
    return;
  }

  const filePath = editor.document.fileName;
  const dependencies = await analyzeDependencies(filePath);

  if (dependencies.isHotPath) {
    const decoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("editor.warningBackground"),
      border: "1px solid orange",
      isWholeLine: true,
      overviewRulerColor: "orange",
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      after: {
        contentText: ` ⚠️  High Traffic Zone (${formatNumber(dependencies.requestsPerDay || 0)}/day)`,
        color: "orange",
        margin: "0 0 0 2em",
      },
    });

    editor.setDecorations(decoration, [new vscode.Range(0, 0, 0, 0)]);
  }
}

/**
 * Analyze dependencies for a file
 */
async function analyzeDependencies(filePath: string): Promise<DependencyInfo> {
  // Check if this is a hot path by querying Prometheus
  const config = vscode.workspace.getConfiguration("valueos.codemap");
  const prometheusUrl = config.get<string>("prometheusUrl");
  const threshold = config.get<number>("hotPathThreshold") || 1000000;

  let isHotPath = false;
  let requestsPerDay = 0;

  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    const query = `sum(rate(http_requests_total{handler=~".*${fileName}.*"}[24h]) * 86400)`;

    const response = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query },
      timeout: 2000,
    });

    if (response.data?.data?.result?.length > 0) {
      requestsPerDay = parseFloat(response.data.data.result[0].value[1]);
      isHotPath = requestsPerDay > threshold;
    }
  } catch (error) {
    // Prometheus unavailable, skip hot path detection
  }

  return {
    imports: [],
    importedBy: [],
    isHotPath,
    requestsPerDay,
  };
}

/**
 * Generate webview HTML for dependency graph
 */
function getWebviewContent(
  dependencies: DependencyInfo,
  filePath: string
): string {
  const fileName = path.basename(filePath);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dependency Graph</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
        }
        .hot-path {
          background: rgba(255, 165, 0, 0.2);
          border: 2px solid orange;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .dependency-list {
          list-style: none;
          padding: 0;
        }
        .dependency-list li {
          padding: 5px;
          margin: 5px 0;
          background: var(--vscode-editor-background);
          border-left: 3px solid var(--vscode-textLink-foreground);
          padding-left: 10px;
        }
      </style>
    </head>
    <body>
      <h1>📊 ${fileName}</h1>
      
      ${
        dependencies.isHotPath
          ? `
        <div class="hot-path">
          <strong>⚠️ High Traffic Zone</strong><br>
          This file handles <strong>${formatNumber(dependencies.requestsPerDay || 0)}</strong> requests per day.<br>
          Changes may impact performance. Run load tests before merging.
        </div>
      `
          : ""
      }
      
      <h2>Imports (${dependencies.imports.length})</h2>
      <ul class="dependency-list">
        ${dependencies.imports.map((dep) => `<li>${dep}</li>`).join("")}
      </ul>
      
      <h2>Imported By (${dependencies.importedBy.length})</h2>
      <ul class="dependency-list">
        ${dependencies.importedBy.map((dep) => `<li>${dep}</li>`).join("")}
      </ul>
    </body>
    </html>
  `;
}

/**
 * Format large numbers
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function deactivate() {
  console.log("ValueOS Codemap extension deactivated");
}
