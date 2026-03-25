import "./style.css";
import cytoscape from "cytoscape";

let cy;
let currentData = null;
let selectedNodeData = null;
let filteredRelationships = null;
let draftsHidden = false; // tracks draft-toggle state

async function init() {
  const overlay = document.getElementById("loading-overlay");
  console.log("🚀 Explorer Initializing...");
  try {
    await loadData();
    if (!currentData || !currentData.relationships) {
      throw new Error("Data loaded but it is empty or malformed.");
    }
    console.log("📥 Data loaded, setting up graph...");
    setupGraph();
    console.log("🕸️ Graph setup complete, setting up UI...");
    setupUI();
    overlay.style.display = "none";
  } catch (err) {
    console.error("❌ Initialization Error:", err);
    overlay.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">
      <h2>Critical Error</h2>
      <p>${err.message}</p>
      <button onclick="location.reload()" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; margin-top: 10px;">Retry</button>
    </div>`;
  }
}

async function loadData() {
  const response = await fetch("./data.json");
  if (!response.ok) {
    throw new Error(
      `Failed to load data.json: ${response.status} ${response.statusText}`
    );
  }
  currentData = await response.json();
  console.log("Loaded Data:", currentData);
}

function setupGraph() {
  if (cy) {
    cy.destroy();
  }

  const elements = [];
  const relationshipSource =
    filteredRelationships === null
      ? currentData.relationships
      : filteredRelationships;

  // 1. Create Nodes (Primary Relationships)
  relationshipSource.forEach(rel => {
    elements.push({
      data: {
        id: rel.id,
        label: rel.driver_action,
        type: "action",
        kpi: rel.target_kpi,
        status: rel.status || "DRAFT",
        raw: rel,
      },
      classes: "action-node",
    });

    // 2. Create Edges for Cascading Effects
    if (rel.cascading_effects) {
      rel.cascading_effects.forEach(cascade => {
        // Find if target KPI already exists as a node action (or create a KPI node)
        // For simplicity in this v1.5 UI, we link Actions to their direct KPIs
        // and KPIs to downstream KPIs.
        const kpiNodeId = `kpi-${cascade.downstream_kpi}`;

        // Add KPI node if not exists
        if (!elements.find(el => el.data.id === kpiNodeId)) {
          elements.push({
            data: { id: kpiNodeId, label: cascade.downstream_kpi, type: "kpi" },
            classes: "kpi-node",
          });
        }

        elements.push({
          data: {
            id: `edge-${rel.id}-${kpiNodeId}`,
            source: rel.id,
            target: kpiNodeId,
            label: cascade.via_formula || "impacts",
          },
        });
      });
    }
  });

  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: elements,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          color: "#f8fafc",
          "font-family": "Outfit",
          "font-size": "12px",
          "text-valign": "center",
          "text-halign": "center",
          "text-wrap": "wrap",
          "text-max-width": "80px",
          "background-color": "#111827",
          "border-width": 2,
          "border-color": "#6366f1",
          width: "100px",
          height: "100px",
          shape: "round-rectangle",
          "overlay-padding": "6px",
          "z-index": 10,
        },
      },
      {
        selector: ".kpi-node",
        style: {
          "background-color": "#0f172a",
          "border-color": "#06b6d4",
          shape: "hexagon",
          width: "80px",
          height: "80px",
        },
      },
      // Status-based border colours — applied after base node style.
      {
        selector: "[status = 'VALIDATED']",
        style: { "border-color": "#10b981" }, // green
      },
      {
        selector: "[status = 'REVIEWED']",
        style: { "border-color": "#06b6d4" }, // blue
      },
      {
        selector: "[status = 'DRAFT']",
        style: {
          "border-color": "#475569", // muted grey
          opacity: 0.5,
        },
      },
      {
        selector: "node:selected",
        style: {
          "border-color": "#10b981",
          "border-width": 4,
          "background-color": "#1e293b",
        },
      },
      {
        selector: "edge",
        style: {
          width: 2,
          "line-color": "rgba(99, 102, 241, 0.3)",
          "target-arrow-color": "rgba(99, 102, 241, 0.3)",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": "10px",
          color: "#94a3b8",
          "text-rotation": "autorotate",
          "text-margin-y": -10,
        },
      },
    ],
    layout: {
      name: "cose",
      animate: true,
      nodeRepulsion: 400000,
      idealEdgeLength: 100,
    },
  });

  cy.on("tap", "node", function (evt) {
    const node = evt.target;
    if (node.data("type") === "action") {
      showNodeDetails(node.data("raw"));
    }
  });

  cy.on("tap", function (event) {
    if (event.target === cy) {
      document.getElementById("sidebar").classList.add("hidden");
    }
  });
}

function showNodeDetails(rel) {
  selectedNodeData = rel;
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.remove("hidden");

  document.getElementById("node-title").textContent = rel.driver_action;

  // Status badge — shown above mechanism text.
  const statusEl = document.getElementById("node-status");
  if (statusEl) {
    const statusConfig = {
      VALIDATED: { color: "#10b981", label: "VALIDATED" },
      REVIEWED:  { color: "#06b6d4", label: "REVIEWED" },
      DRAFT:     { color: "#f59e0b", label: "DRAFT — Research only, not validated for customer use" },
    };
    const cfg = statusConfig[rel.status] || statusConfig.DRAFT;
    statusEl.innerHTML = `<span style="
      display:inline-block;
      padding:2px 8px;
      border-radius:4px;
      font-size:0.7rem;
      font-weight:600;
      letter-spacing:0.08em;
      background:${cfg.color}22;
      color:${cfg.color};
      border:1px solid ${cfg.color}44;
    ">${cfg.label}</span>`;
  }

  document.getElementById("node-mechanism").textContent = rel.mechanism;
  document.getElementById("node-confidence").textContent =
    `${Math.round(rel.confidence_score * 100)}%`;
  document.getElementById("node-time").textContent =
    rel.time_to_realize || "N/A";

  const dist = rel.impact_distribution;
  document.getElementById("val-p10").textContent = `${dist.p10}${dist.unit}`;
  document.getElementById("val-p50").textContent = `${dist.p50}${dist.unit}`;
  document.getElementById("val-p90").textContent = `${dist.p90}${dist.unit}`;

  // Update distribution visualizer
  // Map values to percentage of bar width (assumed -50 to 50 range for %, or adjust)
  const mapToBar = v => {
    const min = -50,
      max = 50;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  };

  document.getElementById("dist-p10").style.left = `${mapToBar(dist.p10)}%`;
  document.getElementById("dist-p50").style.left = `${mapToBar(dist.p50)}%`;
  document.getElementById("dist-p90").style.left = `${mapToBar(dist.p90)}%`;

  // Evidence
  const evidenceList = document.getElementById("evidence-list");
  evidenceList.innerHTML = "";
  rel.evidence.forEach(e => {
    const card = document.createElement("div");
    card.className = "evidence-card";
    card.innerHTML = `<strong>${e.source_name}</strong><blockquote>"${e.quote}"</blockquote>`;
    evidenceList.appendChild(card);
  });

  runSimulation();
}

function setOverviewStats(relationships) {
  const relationshipCount = relationships.length;
  const kpiCount = new Set(relationships.map(rel => rel.target_kpi)).size;
  const avgConfidence =
    relationshipCount === 0
      ? 0
      : relationships.reduce(
          (sum, rel) => sum + (rel.confidence_score || 0),
          0
        ) / relationshipCount;

  document.getElementById("stat-relationships").textContent =
    String(relationshipCount);
  document.getElementById("stat-kpis").textContent = String(kpiCount);
  document.getElementById("stat-confidence").textContent =
    `${Math.round(avgConfidence * 100)}%`;
}

function setDatasetStatus(relationships) {
  const all = currentData.relationships; // always count against full dataset
  const validatedCount = all.filter(r => r.status === "VALIDATED").length;
  const reviewedCount  = all.filter(r => r.status === "REVIEWED").length;
  const draftCount     = all.filter(r => r.status === "DRAFT").length;

  const badge = document.getElementById("dataset-status");
  const label = `${validatedCount} Validated · ${reviewedCount} Reviewed · ${draftCount} Draft`;

  // Amber styling when any DRAFT entries exist — prevents "validated" misrepresentation.
  if (draftCount > 0) {
    badge.style.background = "rgba(245, 158, 11, 0.1)";
    badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
    badge.style.color = "#f59e0b";
  } else {
    badge.style.background = "";
    badge.style.borderColor = "";
    badge.style.color = "";
  }

  badge.innerHTML = `<span class="dot"></span> ${label}`;
}

function renderActionList(relationships) {
  const listContainer = document.getElementById("action-list");
  listContainer.innerHTML = "";

  if (relationships.length === 0) {
    listContainer.innerHTML =
      '<div class="empty-state">No relationships match current filters.</div>';
    return;
  }

  relationships
    .slice()
    .sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))
    .forEach(rel => {
      const button = document.createElement("button");
      button.className = "action-item";
      button.type = "button";
      button.innerHTML = `
        <span class="action-item-title">${rel.driver_action}</span>
        <span class="action-item-meta">${rel.target_kpi} • ${Math.round((rel.confidence_score || 0) * 100)}%</span>
      `;

      button.addEventListener("click", () => {
        if (!cy) {
          return;
        }
        const node = cy.getElementById(rel.id);
        if (!node || node.length === 0) {
          return;
        }
        cy.animate({
          center: { eles: node },
          zoom: 1.2,
          duration: 350,
        });
        node.select();
        showNodeDetails(rel);
      });

      listContainer.appendChild(button);
    });
}

function applyFilters() {
  const statusFilter = document.getElementById("status-filter").value;
  const query = document
    .getElementById("action-search")
    .value.trim()
    .toLowerCase();

  filteredRelationships = currentData.relationships.filter(rel => {
    const statusMatch = statusFilter === "ALL" || rel.status === statusFilter;
    const queryMatch =
      query.length === 0 || rel.driver_action.toLowerCase().includes(query);
    return statusMatch && queryMatch;
  });

  setupGraph();
  // Re-apply draft visibility state — setupGraph() recreates all nodes as visible.
  if (draftsHidden) {
    cy.nodes("[status = 'DRAFT']").hide();
  }
  setOverviewStats(filteredRelationships);
  renderActionList(filteredRelationships);
}

function runSimulation() {
  if (!selectedNodeData) return;

  const baseline =
    parseFloat(document.getElementById("sim-baseline").value) || 0;
  const dist = selectedNodeData.impact_distribution;
  const impactVal = dist.p50;
  const unit = dist.unit;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
  });

  let displayVal;
  if (unit === "%") {
    // Percentage: result is the delta applied to the baseline.
    const result = baseline * (impactVal / 100);
    displayVal = formatter.format(result);
  } else {
    // Absolute unit: result is baseline + delta, consistent with miner.py.
    const result = baseline + impactVal;
    displayVal = `${result.toLocaleString()} ${unit}`;
  }

  document.getElementById("sim-gain").textContent = displayVal;
}

function setupUI() {
  document.getElementById("hide-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("hidden");
  });

  document
    .getElementById("sim-baseline")
    .addEventListener("input", runSimulation);

  document.getElementById("reset-view").addEventListener("click", () => {
    cy.fit();
    cy.center();
  });

  document.getElementById("shuffle-layout").addEventListener("click", () => {
    cy.layout({ name: "cose", animate: true }).run();
  });

  document
    .getElementById("status-filter")
    .addEventListener("change", applyFilters);
  document
    .getElementById("action-search")
    .addEventListener("input", applyFilters);
  document.getElementById("clear-filter").addEventListener("click", () => {
    document.getElementById("status-filter").value = "ALL";
    document.getElementById("action-search").value = "";
    applyFilters();
  });

  // Draft toggle — hides/shows DRAFT nodes without re-running the full filter.
  document.getElementById("draft-toggle").addEventListener("click", () => {
    draftsHidden = !draftsHidden;
    const btn = document.getElementById("draft-toggle");
    if (draftsHidden) {
      cy.nodes("[status = 'DRAFT']").hide();
      btn.textContent = "Show Drafts";
      btn.style.color = "#f59e0b";
    } else {
      cy.nodes("[status = 'DRAFT']").show();
      btn.textContent = "Hide Drafts";
      btn.style.color = "";
    }
  });

  setDatasetStatus(currentData.relationships);
  filteredRelationships = [...currentData.relationships];
  setOverviewStats(filteredRelationships);
  renderActionList(filteredRelationships);
}

window.addEventListener("DOMContentLoaded", init);
