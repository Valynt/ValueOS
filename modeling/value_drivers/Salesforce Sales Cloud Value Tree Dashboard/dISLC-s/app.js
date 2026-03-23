import { salesCloudData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {

    lucide.createIcons();
    initChart();
    renderTree();
    populateSidebar();


    let selectedNodeId = null;


    const themeBtn = document.getElementById('themeToggle');
    themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        themeBtn.innerHTML = isDark 
            ? `<i data-lucide="sun" class="w-4 h-4 text-slate-400"></i>` 
            : `<i data-lucide="moon" class="w-4 h-4 text-slate-500"></i>`;
        lucide.createIcons();
    });

    function initChart() {
        const ctx = document.getElementById('impactChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: salesCloudData.kpis.labels,
                datasets: [{
                    label: 'Relative Impact',
                    data: salesCloudData.kpis.impactScores,
                    backgroundColor: ['#3B82F6', '#10B981', '#6366F1'],
                    borderRadius: 8,
                    barThickness: 24,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { display: false }, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function renderTree() {
        const container = document.getElementById('treeContainer');
        container.innerHTML = '';


        const treeRoot = document.createElement('div');
        treeRoot.className = 'flex items-center gap-32 relative';


        const rootDiv = createNode(salesCloudData.root);
        treeRoot.appendChild(rootDiv);


        const branchCol = document.createElement('div');
        branchCol.className = 'tree-column tree-column-2';
        
        salesCloudData.root.children.forEach(childId => {
            const childData = salesCloudData[childId];
            const childNode = createNode(childData);
            branchCol.appendChild(childNode);
        });

        treeRoot.appendChild(branchCol);
        container.appendChild(treeRoot);


        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'connector-svg');
        container.appendChild(svg);


        setTimeout(() => drawConnectors(svg, rootDiv, branchCol), 100);
    }

    function createNode(data) {
        const div = document.createElement('div');
        div.className = `tree-node ${data.id === 'root' ? 'border-2 border-blue-600' : ''}`;
        div.id = `node-${data.id}`;
        
        const impactClass = data.impact >= 80 ? 'impact-high' : (data.impact >= 70 ? 'impact-mid' : 'impact-low');
        
        div.innerHTML = `
            ${data.id !== 'root' ? `<span class="node-impact ${impactClass}">${data.impact}</span>` : ''}
            <div class="text-center">
                <h4 class="font-bold text-slate-800 dark:text-slate-100">${data.title}</h4>
                ${data.subtitle ? `<p class="text-[10px] text-slate-400 uppercase tracking-tighter">${data.subtitle}</p>` : ''}
                ${data.id === 'root' ? `<p class="text-[10px] text-blue-600 mt-1 font-semibold">Strategic Root</p>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            if (data.id === 'root') return;
            showDetails(data);
        });

        return div;
    }

    function drawConnectors(svg, rootNode, column) {
        const rootRect = rootNode.getBoundingClientRect();
        const containerRect = svg.getBoundingClientRect();

        const x1 = rootRect.right - containerRect.left;
        const y1 = (rootRect.top + rootRect.height / 2) - containerRect.top;

        column.childNodes.forEach(node => {
            const nodeRect = node.getBoundingClientRect();
            const x2 = nodeRect.left - containerRect.left;
            const y2 = (nodeRect.top + nodeRect.height / 2) - containerRect.top;


            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const cp1x = x1 + (x2 - x1) / 2;
            const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp1x} ${y2}, ${x2} ${y2}`;
            
            path.setAttribute('d', d);
            path.setAttribute('class', 'tree-path');
            path.id = `path-${node.id.split('-')[1]}`;
            svg.appendChild(path);
        });
    }

    function showDetails(data) {
        const panel = document.getElementById('detailPanel');
        const title = document.getElementById('detailTitle');
        const desc = document.getElementById('detailDescription');
        const enablers = document.getElementById('enablersList');
        const efficiency = document.getElementById('efficiencyList');
        const icon = document.getElementById('detailIcon');


        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tree-path').forEach(p => p.classList.remove('highlight'));
        

        document.getElementById(`node-${data.id}`).classList.add('active');
        document.getElementById(`path-${data.id}`).classList.add('highlight');

        title.textContent = data.title;
        desc.textContent = data.description;
        
        icon.innerHTML = `<i data-lucide="${data.id === 'growth' ? 'trending-up' : (data.id === 'monetization' ? 'dollar-sign' : 'shield-check')}" class="w-6 h-6"></i>`;
        lucide.createIcons();

        enablers.innerHTML = data.enablers.map(e => `<span class="enabler-tag">${e}</span>`).join('');
        efficiency.innerHTML = data.efficiencyLevers.map(l => `
            <div class="flex items-start gap-2 group">
                <i data-lucide="check-circle" class="w-3 h-3 text-emerald-500 mt-1"></i>
                <p class="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">${l}</p>
            </div>
        `).join('');

        panel.classList.remove('translate-y-full');
        lucide.createIcons();
    }

    function populateSidebar() {
        const list = document.getElementById('recommendationsList');
        list.innerHTML = salesCloudData.recommendations.map(r => `
            <li class="flex items-start gap-3">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                <span>${r}</span>
            </li>
        `).join('');
    }

    document.getElementById('closeDetail').addEventListener('click', () => {
        document.getElementById('detailPanel').classList.add('translate-y-full');
        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.tree-path').forEach(p => p.classList.remove('highlight'));
    });
});
