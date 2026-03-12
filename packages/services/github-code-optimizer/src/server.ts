import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  safeClearElement,
  safeSetPlaceholder,
  safeCreateJobRow,
  safeCreateOptimizationCard,
} from "./safe-html";
import { logger } from "./utils/logger.js";
import { webhookRouter } from "./webhooks/router.js";
import { dashboardRouter } from "./dashboard/router.js";
import { config } from "./config/index.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API routes
app.use("/webhooks", webhookRouter);
app.use("/api", dashboardRouter);

// Dashboard HTML page
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Code Optimizer Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007acc; }
        .stat-label { color: #666; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .status-pending { color: #ffa500; }
        .status-running { color: #007acc; }
        .status-completed { color: green; }
        .status-failed { color: red; }
        .refresh-btn { background: #007acc; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 10px 0; }
        .refresh-btn:hover { background: #005aa3; }
        .optimization-card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .optimization-title { font-weight: bold; margin-bottom: 5px; }
        .optimization-description { color: #666; margin-bottom: 10px; }
        .optimization-metrics { display: flex; gap: 20px; font-size: 0.9em; }
        .metric { display: flex; flex-direction: column; }
        .metric-label { font-weight: bold; }
        .metric-value { color: #007acc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 GitHub Code Optimizer Dashboard</h1>

        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-number" id="totalRepos">0</div>
                <div class="stat-label">Repositories</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="totalOpts">0</div>
                <div class="stat-label">Optimizations</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="activeJobs">0</div>
                <div class="stat-label">Active Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="completedJobs">0</div>
                <div class="stat-label">Completed Jobs</div>
            </div>
        </div>

        <button class="refresh-btn" onclick="refreshDashboard()">🔄 Refresh Dashboard</button>

        <div class="section">
            <h2>📊 Recent Jobs</h2>
            <table id="jobsTable">
                <thead>
                    <tr>
                        <th>Repository</th>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody id="jobsBody">
                    <tr><td colspan="4">Loading...</td></tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>⚡ Recent Optimizations</h2>
            <div id="optimizationsContainer">
                <p>Loading optimizations...</p>
            </div>
        </div>
    </div>

    <script>
        async function fetchData(url) {
            const response = await fetch(url);
            return response.json();
        }

        async function refreshDashboard() {
            try {
                // Fetch overview stats
                const stats = await fetchData('/api/overview');
                document.getElementById('totalRepos').textContent = stats.totalRepositories;
                document.getElementById('totalOpts').textContent = stats.totalOptimizations;
                document.getElementById('activeJobs').textContent = stats.activeJobs;
                document.getElementById('completedJobs').textContent = stats.completedJobs;

                // Fetch jobs
                const jobs = await fetchData('/api/jobs');
                const jobsBody = document.getElementById('jobsBody');
                safeClearElement('jobsBody');

                if (jobs.length === 0) {
                    safeSetPlaceholder('jobsBody', 'No jobs found');
                } else {
                    jobs.slice(0, 10).forEach(job => {
                        const row = safeCreateJobRow(job);
                        jobsBody.appendChild(row);
                    });
                }

                // Fetch recent optimizations from all repositories
                const repositories = await fetchData('/api/repositories');
                const optimizationsContainer = document.getElementById('optimizationsContainer');
                safeClearElement('optimizationsContainer');

                if (repositories.length === 0) {
                    safeSetPlaceholder('optimizationsContainer', 'No repositories configured');
                } else {
                    let hasOptimizations = false;
                    for (const repo of repositories) {
                        try {
                            const optimizations = await fetchData('/api/repositories/' + repo.owner.login + '/' + repo.name + '/optimizations');
                            if (optimizations.length > 0) {
                                hasOptimizations = true;
                                optimizations.slice(0, 5).forEach(opt => {
                                    const card = safeCreateOptimizationCard(opt);
                                    optimizationsContainer.appendChild(card);
                                });
                            }
                        } catch (e) {
                            logger.info('No optimizations for', repo.fullName);
                        }
                    }
                    if (!hasOptimizations) {
                        safeSetPlaceholder('optimizationsContainer', 'No optimizations found');
                    }
                }
            } catch (error) {
                console.error('Error refreshing dashboard:', error);
                alert('Error loading dashboard data');
            }
        }

        // Auto-refresh every 30 seconds
        setInterval(refreshDashboard, 30000);

        // Initial load
        refreshDashboard();
    </script>
</body>
</html>
  `);
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  logger.info(`GitHub Code Optimizer Bot running on port ${PORT}`);
  logger.info("Configuration:", {
    githubToken: config.github.token ? "configured" : "missing",
    openRouterKey: config.openRouter.apiKey ? "configured" : "missing",
    database: config.database.type,
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
