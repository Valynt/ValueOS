'use client';

import React, { useState, useCallback } from 'react';
import ProgressIndicator from '@/components/ProgressIndicator';
import InsightCards from '@/components/InsightCards';
import EntityGraph from '@/components/charts/EntityGraph';
import MarketRadar from '@/components/charts/MarketRadar';
import ProductSunburst from '@/components/charts/ProductSunburst';
import EntityTimeline from '@/components/charts/EntityTimeline';
import {
  startAnalysis,
  getResults,
  createProgressWebSocket,
  ProgressUpdate,
  AnalysisResult,
} from '@/lib/api';

type TabId = 'graph' | 'hierarchy' | 'radar' | 'timeline' | 'insights';

export default function Home() {
  // Form state
  const [url, setUrl] = useState('');
  const [competitors, setCompetitors] = useState('');

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('graph');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setIsDemoData(false);
    setProgress({ status: 'queued', progress: 0, message: 'Starting analysis...' });

    try {
      // Parse competitors
      const competitorUrls = competitors
        .split('\n')
        .map((u) => u.trim())
        .filter(Boolean);

      // Start analysis
      const response = await startAnalysis({
        url,
        competitor_urls: competitorUrls,
      });

      // Connect to websocket for progress updates
      createProgressWebSocket(
        response.job_id,
        (update) => setProgress(update),
        async () => {
          // On complete, fetch results
          try {
            const results = await getResults(response.job_id);
            setResult(results);
            setIsDemoData(false);
          } catch (err) {
            // For demo purposes, still show UI even without backend
            console.log('Could not fetch results, showing demo data');
          }
          setIsAnalyzing(false);
        },
        (err) => {
          setError(err.message);
          setIsAnalyzing(false);
        }
      );
    } catch (err: any) {
      // Demo mode - show sample data if backend not running
      console.log('Backend not available, showing demo data');
      simulateDemoAnalysis();
    }
  }, [url, competitors]);

  // Simulate analysis for demo when backend isn't running
  const simulateDemoAnalysis = async () => {
    setIsDemoData(true);
    const stages = [
      { status: 'crawling', progress: 0.2, message: 'Crawling website pages...' },
      { status: 'extracting', progress: 0.5, message: 'Extracting entities...' },
      { status: 'building_graph', progress: 0.7, message: 'Building knowledge graph...' },
      { status: 'generating_insights', progress: 0.9, message: 'Generating insights...' },
    ];

    for (const stage of stages) {
      await new Promise((r) => setTimeout(r, 1000));
      setProgress({ ...stage, entities_found: Math.floor(stage.progress * 50), relationships_found: Math.floor(stage.progress * 80) });
    }

    // Demo result
    setResult({
      job_id: 'demo',
      url,
      completed_at: new Date().toISOString(),
      processing_time_seconds: 4.2,
      sources_crawled: 12,
      warnings: [],
      graph: {
        entities: [
          { id: '1', type: 'organization', name: 'Target Company', description: '', properties: {}, confidence: 0.95, sources: [] },
          { id: '2', type: 'product', name: 'Main Platform', description: '', properties: {}, confidence: 0.9, sources: [] },
          { id: '3', type: 'product', name: 'Analytics Suite', description: '', properties: {}, confidence: 0.85, sources: [] },
          { id: '4', type: 'feature', name: 'Real-time Sync', description: '', properties: {}, confidence: 0.8, sources: [] },
          { id: '5', type: 'feature', name: 'SSO/SAML', description: '', properties: {}, confidence: 0.85, sources: [] },
          { id: '6', type: 'feature', name: 'Custom Reports', description: '', properties: {}, confidence: 0.75, sources: [] },
          { id: '7', type: 'technology', name: 'React', description: '', properties: {}, confidence: 0.9, sources: [] },
          { id: '8', type: 'technology', name: 'PostgreSQL', description: '', properties: {}, confidence: 0.85, sources: [] },
          { id: '9', type: 'technology', name: 'AWS', description: '', properties: {}, confidence: 0.9, sources: [] },
          { id: '10', type: 'integration', name: 'Salesforce', description: '', properties: {}, confidence: 0.8, sources: [] },
          { id: '11', type: 'integration', name: 'Slack', description: '', properties: {}, confidence: 0.85, sources: [] },
          { id: '12', type: 'integration', name: 'Google Workspace', description: '', properties: {}, confidence: 0.75, sources: [] },
        ],
        relationships: [
          { id: 'r1', source_id: '1', target_id: '2', type: 'owns', confidence: 0.95, evidence: '' },
          { id: 'r2', source_id: '1', target_id: '3', type: 'owns', confidence: 0.9, evidence: '' },
          { id: 'r3', source_id: '2', target_id: '4', type: 'has_feature', confidence: 0.85, evidence: '' },
          { id: 'r4', source_id: '2', target_id: '5', type: 'has_feature', confidence: 0.8, evidence: '' },
          { id: 'r5', source_id: '3', target_id: '6', type: 'has_feature', confidence: 0.75, evidence: '' },
          { id: 'r6', source_id: '2', target_id: '7', type: 'uses_technology', confidence: 0.85, evidence: '' },
          { id: 'r7', source_id: '2', target_id: '8', type: 'uses_technology', confidence: 0.8, evidence: '' },
          { id: 'r8', source_id: '1', target_id: '9', type: 'uses_technology', confidence: 0.9, evidence: '' },
          { id: 'r9', source_id: '2', target_id: '10', type: 'integrates_with', confidence: 0.75, evidence: '' },
          { id: 'r10', source_id: '2', target_id: '11', type: 'integrates_with', confidence: 0.8, evidence: '' },
        ],
      },
      insights: [
        {
          id: 'i1',
          type: 'gap' as const,
          severity: 'medium' as const,
          title: 'Limited Integration Ecosystem',
          description: 'Only 3 integrations detected. Enterprise buyers typically expect 15+ integrations.',
          recommendation: 'Prioritize integrations with HubSpot, Jira, and Microsoft 365.',
          confidence: 0.8,
        },
        {
          id: 'i2',
          type: 'opportunity' as const,
          severity: 'high' as const,
          title: 'Strong Technical Foundation',
          description: 'Modern tech stack (React, PostgreSQL, AWS) enables rapid feature development.',
          confidence: 0.85,
        },
        {
          id: 'i3',
          type: 'risk' as const,
          severity: 'medium' as const,
          title: 'Missing Security Certifications',
          description: 'No SOC2 or ISO 27001 mentioned. Required for enterprise sales.',
          recommendation: 'Begin SOC2 Type II certification process.',
          confidence: 0.7,
        },
        {
          id: 'i4',
          type: 'competitive' as const,
          severity: 'low' as const,
          title: 'Cloud-Native Infrastructure',
          description: 'AWS hosting detected. Competitive with industry standards.',
          confidence: 0.9,
        },
      ],
    });
    setIsAnalyzing(false);
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'graph', label: 'Entity Graph', icon: '🔗' },
    { id: 'hierarchy', label: 'Hierarchy', icon: '🌳' },
    { id: 'radar', label: 'Assessment', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];

  return (
    <main className="min-h-screen p-6 md:p-10">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-3">
          Ontology Discovery Agent
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Transform any website into a complete knowledge graph with competitive insights in seconds
        </p>
      </div>

      {/* Global demo-mode banner — persistent, not dismissible */}
      {isDemoData && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-amber-500/20 border border-amber-500 text-amber-200 px-4 py-3 rounded-lg flex items-start gap-3">
            <span className="text-amber-400 text-lg leading-none mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-amber-300">DEMO DATA — backend not connected</p>
              <p className="text-sm text-amber-200/80 mt-0.5">
                Results below are simulated, not real. Start the backend and click &ldquo;Retry live analysis&rdquo; to run a real analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="max-w-3xl mx-auto mb-10">
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Competitor URLs (one per line, optional)
            </label>
            <textarea
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="https://competitor1.com&#10;https://competitor2.com"
              className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-agent-purple/30 text-white resize-none"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing || !url}
            className="w-full py-3 px-6 glow-button text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? '🔍 Analyzing...' : isDemoData ? '🔄 Retry live analysis' : '🚀 Start Discovery'}
          </button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            ❌ {error}
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {isAnalyzing && progress && (
        <div className="max-w-3xl mx-auto mb-10">
          <ProgressIndicator
            progress={progress.progress}
            status={progress.status}
            message={progress.message}
            entitiesFound={progress.entities_found || 0}
            relationshipsFound={progress.relationships_found || 0}
          />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="max-w-7xl mx-auto">
          {/* Inline demo-mode banner — shown directly above stats when results are simulated */}
          {isDemoData && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/40 text-amber-200/90 px-4 py-2.5 rounded-lg text-sm text-center">
              Showing simulated data. Connect the backend and click &ldquo;Retry live analysis&rdquo; for real results.
            </div>
          )}

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="glass-card px-6 py-3 text-center">
              <p className="text-2xl font-bold text-agent-purple">{result.graph.entities.length}</p>
              <p className="text-xs text-gray-400">Entities</p>
            </div>
            <div className="glass-card px-6 py-3 text-center">
              <p className="text-2xl font-bold text-agent-green">{result.graph.relationships.length}</p>
              <p className="text-xs text-gray-400">Relationships</p>
            </div>
            <div className="glass-card px-6 py-3 text-center">
              <p className="text-2xl font-bold text-agent-coral">{result.insights.length}</p>
              <p className="text-xs text-gray-400">Insights</p>
            </div>
            <div className="glass-card px-6 py-3 text-center">
              <p className="text-2xl font-bold text-agent-blue">{result.processing_time_seconds.toFixed(1)}s</p>
              <p className="text-xs text-gray-400">Processing Time</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                  ? 'tab-active text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="glass-card p-6">
            {activeTab === 'graph' && (
              <EntityGraph
                entities={result.graph.entities}
                relationships={result.graph.relationships}
              />
            )}
            {activeTab === 'hierarchy' && (
              <ProductSunburst entities={result.graph.entities} />
            )}
            {activeTab === 'radar' && (
              <MarketRadar entities={result.graph.entities} />
            )}
            {activeTab === 'timeline' && (
              <EntityTimeline entities={result.graph.entities} />
            )}
            {activeTab === 'insights' && (
              <InsightCards insights={result.insights} />
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-gray-500 text-sm mt-16">
        <p>Ontology Discovery Agent • Powered by FastAPI + Next.js + ECharts</p>
      </footer>
    </main>
  );
}
