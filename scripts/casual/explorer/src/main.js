import './style.css'
import cytoscape from 'cytoscape'

let cy;
let currentData = null;
let selectedNodeData = null;

async function init() {
  const overlay = document.getElementById('loading-overlay');
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
    overlay.style.display = 'none';
  } catch (err) {
    console.error("❌ Initialization Error:", err);
    // Securely clear content
    overlay.textContent = '';

    // Create error container
    const container = document.createElement('div');
    container.style.cssText = "color: #ef4444; padding: 20px; text-align: center;";

    // Create header
    const header = document.createElement('h2');
    header.textContent = "Critical Error";
    container.appendChild(header);

    // Create message (safely)
    const message = document.createElement('p');
    message.textContent = err.message;
    container.appendChild(message);

    // Create retry button
    const button = document.createElement('button');
    button.textContent = "Retry";
    button.style.cssText = "background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; margin-top: 10px;";
    button.onclick = () => location.reload();
    container.appendChild(button);

    overlay.appendChild(container);
  }
}

async function loadData() {
  const response = await fetch('./data.json');
  if (!response.ok) {
    throw new Error(`Failed to load data.json: ${response.status} ${response.statusText}`);
  }
  currentData = await response.json();
  console.log("Loaded Data:", currentData);
}

function setupGraph() {
  const elements = [];

  // 1. Create Nodes (Primary Relationships)
  currentData.relationships.forEach(rel => {
    elements.push({
      data: {
        id: rel.id,
        label: rel.driver_action,
        type: 'action',
        kpi: rel.target_kpi,
        raw: rel
      },
      classes: 'action-node'
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
            data: { id: kpiNodeId, label: cascade.downstream_kpi, type: 'kpi' },
            classes: 'kpi-node'
          });
        }

        elements.push({
          data: {
            id: `edge-${rel.id}-${kpiNodeId}`,
            source: rel.id,
            target: kpiNodeId,
            label: cascade.via_formula || 'impacts'
          }
        });
      });
    }
  });

  cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'color': '#f8fafc',
          'font-family': 'Outfit',
          'font-size': '12px',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': '80px',
          'background-color': '#111827',
          'border-width': 2,
          'border-color': '#6366f1',
          'width': '100px',
          'height': '100px',
          'shape': 'round-rectangle',
          'overlay-padding': '6px',
          'z-index': 10
        }
      },
      {
        selector: '.kpi-node',
        style: {
          'background-color': '#0f172a',
          'border-color': '#06b6d4',
          'shape': 'hexagon',
          'width': '80px',
          'height': '80px',
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#10b981',
          'border-width': 4,
          'background-color': '#1e293b'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': 'rgba(99, 102, 241, 0.3)',
          'target-arrow-color': 'rgba(99, 102, 241, 0.3)',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '10px',
          'color': '#94a3b8',
          'text-rotation': 'autorotate',
          'text-margin-y': -10
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: true,
      nodeRepulsion: 400000,
      idealEdgeLength: 100,
    }
  });

  cy.on('tap', 'node', function (evt) {
    const node = evt.target;
    if (node.data('type') === 'action') {
      showNodeDetails(node.data('raw'));
    }
  });

  cy.on('tap', function (event) {
    if (event.target === cy) {
      document.getElementById('sidebar').classList.add('hidden');
    }
  });
}

function showNodeDetails(rel) {
  selectedNodeData = rel;
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('hidden');

  document.getElementById('node-title').textContent = rel.driver_action;
  document.getElementById('node-mechanism').textContent = rel.mechanism;
  document.getElementById('node-confidence').textContent = `${Math.round(rel.confidence_score * 100)}%`;
  document.getElementById('node-time').textContent = rel.time_to_realize || 'N/A';

  const dist = rel.impact_distribution;
  document.getElementById('val-p10').textContent = `${dist.p10}${dist.unit}`;
  document.getElementById('val-p50').textContent = `${dist.p50}${dist.unit}`;
  document.getElementById('val-p90').textContent = `${dist.p90}${dist.unit}`;

  // Update distribution visualizer
  // Map values to percentage of bar width (assumed -50 to 50 range for %, or adjust)
  const mapToBar = (v) => {
    const min = -50, max = 50;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  };

  document.getElementById('dist-p10').style.left = `${mapToBar(dist.p10)}%`;
  document.getElementById('dist-p50').style.left = `${mapToBar(dist.p50)}%`;
  document.getElementById('dist-p90').style.left = `${mapToBar(dist.p90)}%`;

  // Evidence
  const evidenceList = document.getElementById('evidence-list');
  evidenceList.textContent = '';
  rel.evidence.forEach(e => {
    const card = document.createElement('div');
    card.className = 'evidence-card';

    // Source name
    const source = document.createElement('strong');
    source.textContent = e.source_name;
    card.appendChild(source);

    // Quote
    const quote = document.createElement('blockquote');
    quote.textContent = `"${e.quote}"`;
    card.appendChild(quote);

    evidenceList.appendChild(card);
  });

  runSimulation();
}

function runSimulation() {
  if (!selectedNodeData) return;

  const baseline = parseFloat(document.getElementById('sim-baseline').value) || 0;
  const impactPct = selectedNodeData.impact_distribution.p50;
  const result = baseline * (impactPct / 100);

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always'
  });

  const displayVal = selectedNodeData.impact_distribution.unit === '%'
    ? formatter.format(result)
    : `${impactPct} ${selectedNodeData.impact_distribution.unit}`;

  document.getElementById('sim-gain').textContent = displayVal;
}

function setupUI() {
  document.getElementById('hide-sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('hidden');
  });

  document.getElementById('sim-baseline').addEventListener('input', runSimulation);

  document.getElementById('reset-view').addEventListener('click', () => {
    cy.fit();
    cy.center();
  });

  document.getElementById('shuffle-layout').addEventListener('click', () => {
    cy.layout({ name: 'cose', animate: true }).run();
  });
}

window.addEventListener('DOMContentLoaded', init);
