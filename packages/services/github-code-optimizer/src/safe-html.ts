// /workspaces/ValueOS/packages/services/github-code-optimizer/src/safe-html.ts
/**
 * Safe HTML utilities for preventing XSS attacks
 */

/**
 * Escapes HTML special characters in a string
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * Safely sets text content of an element
 */
export function safeSetText(elementId: string, text: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Safely creates an element with escaped content
 */
export function safeCreateElement(tagName: string, className?: string): HTMLElement {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

/**
 * Safely creates a table row for job data
 */
export function safeCreateJobRow(job: any): HTMLTableRowElement {
  const row = document.createElement("tr");

  // Repository name cell
  const repoCell = document.createElement("td");
  repoCell.textContent = job.repository.fullName;
  row.appendChild(repoCell);

  // Status cell
  const statusCell = document.createElement("td");
  statusCell.className = `status-${job.status}`;
  statusCell.textContent = job.status.toUpperCase();
  row.appendChild(statusCell);

  // Started at cell
  const startedCell = document.createElement("td");
  startedCell.textContent = new Date(job.startedAt).toLocaleString();
  row.appendChild(startedCell);

  // Duration cell
  const durationCell = document.createElement("td");
  if (job.completedAt) {
    const duration = Math.round(
      (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
    );
    durationCell.textContent = `${duration}s`;
  } else {
    durationCell.textContent = "-";
  }
  row.appendChild(durationCell);

  return row;
}

/**
 * Safely creates an optimization card
 */
export function safeCreateOptimizationCard(opt: any): HTMLElement {
  const card = document.createElement("div");
  card.className = "optimization-card";

  // Title
  const title = document.createElement("div");
  title.className = "optimization-title";
  title.textContent = `${opt.type}: ${opt.filePath}`;
  card.appendChild(title);

  // Description
  const description = document.createElement("div");
  description.className = "optimization-description";
  description.textContent = opt.description;
  card.appendChild(description);

  // Metrics container
  const metrics = document.createElement("div");
  metrics.className = "optimization-metrics";

  // Complexity metric
  const complexityMetric = createMetric(
    "Complexity",
    `${opt.beforeMetrics?.complexity || "N/A"} → ${opt.afterMetrics?.complexity || "N/A"}`
  );
  metrics.appendChild(complexityMetric);

  // Performance metric
  const performanceMetric = createMetric(
    "Performance",
    `${opt.beforeMetrics?.performance || "N/A"} → ${opt.afterMetrics?.performance || "N/A"}`
  );
  metrics.appendChild(performanceMetric);

  // Confidence metric
  const confidenceMetric = createMetric("Confidence", `${Math.round(opt.confidence * 100)}%`);
  metrics.appendChild(confidenceMetric);

  card.appendChild(metrics);
  return card;
}

function createMetric(label: string, value: string): HTMLElement {
  const metric = document.createElement("div");
  metric.className = "metric";

  const labelSpan = document.createElement("span");
  labelSpan.className = "metric-label";
  labelSpan.textContent = label;
  metric.appendChild(labelSpan);

  const valueSpan = document.createElement("span");
  valueSpan.className = "metric-value";
  valueSpan.textContent = value;
  metric.appendChild(valueSpan);

  return metric;
}

/**
 * Safely clears an element's content
 */
export function safeClearElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.replaceChildren();
  }
}

/**
 * Safely sets placeholder content
 */
export function safeSetPlaceholder(elementId: string, placeholderText: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = placeholderText;
  }
}
