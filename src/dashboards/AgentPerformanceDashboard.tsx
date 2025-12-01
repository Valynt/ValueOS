/**
 * Agent Performance Monitoring Dashboard
 * 
 * Real-time performance metrics from agent_metrics table
 * Source: supabase/migrations/20241127_agent_predictions.sql
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AgentMetrics {
  agent_type: string;
  avg_tokens: number;
  avg_latency_ms: number;
  total_cost: number;
  invocation_count: number;
  avg_confidence: number;
  error_rate: number;
}

interface PerformanceTrend {
  timestamp: string;
  agent_type: string;
  avg_latency: number;
  invocation_count: number;
}

export function AgentPerformanceDashboard() {
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch aggregate metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('agent_metrics')
        .select('*')
        .gte('created_at', getTimeRangeStart())
        .order('created_at', { ascending: false });

      if (metricsError) throw metricsError;

      // Aggregate by agent type
      const aggregated = aggregateMetrics(metricsData || []);
      setMetrics(aggregated);

      // Fetch trends
      const { data: trendsData, error: trendsError } = await supabase
        .from('agent_metrics')
        .select('agent_type, created_at, latency_ms')
        .gte('created_at', getTimeRangeStart())
        .order('created_at', { ascending: true });

      if (trendsError) throw trendsError;

      const trendsByHour = aggregateTrends(trendsData || []);
      setTrends(trendsByHour);

      setError(null);
    } catch (err) {
      console.error('Error fetching agent metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getTimeRangeStart = () => {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const aggregateMetrics = (data: any[]): AgentMetrics[] => {
    const grouped = data.reduce((acc, record) => {
      const agent = record.agent_type;
      if (!acc[agent]) {
        acc[agent] = {
          agent_type: agent,
          total_tokens: 0,
          total_latency: 0,
          total_cost: 0,
          count: 0,
          total_confidence: 0,
          errors: 0
        };
      }

      acc[agent].total_tokens += record.total_tokens || 0;
      acc[agent].total_latency += record.latency_ms || 0;
      acc[agent].total_cost += parseFloat(record.cost || 0);
      acc[agent].total_confidence += record.confidence_score || 0;
      acc[agent].count += 1;
      if (record.error) acc[agent].errors += 1;

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((g: any) => ({
      agent_type: g.agent_type,
      avg_tokens: Math.round(g.total_tokens / g.count),
      avg_latency_ms: Math.round(g.total_latency / g.count),
      total_cost: g.total_cost,
      invocation_count: g.count,
      avg_confidence: g.total_confidence / g.count,
      error_rate: (g.errors / g.count) * 100
    }));
  };

  const aggregateTrends = (data: any[]): PerformanceTrend[] => {
    const grouped = data.reduce((acc, record) => {
      const hour = new Date(record.created_at).toISOString().slice(0, 13);
      const key = `${hour}-${record.agent_type}`;

      if (!acc[key]) {
        acc[key] = {
          timestamp: hour,
          agent_type: record.agent_type,
          total_latency: 0,
          count: 0
        };
      }

      acc[key].total_latency += record.latency_ms || 0;
      acc[key].count += 1;

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((g: any) => ({
      timestamp: g.timestamp,
      agent_type: g.agent_type,
      avg_latency: Math.round(g.total_latency / g.count),
      invocation_count: g.count
    }));
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatLatency = (ms: number) => `${ms}ms`;

  if (loading && metrics.length === 0) {
    return <div className="p-4">Loading agent metrics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Agent Performance Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('1h')}
            className={`px-4 py-2 rounded ${timeRange === '1h' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            1 Hour
          </button>
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-4 py-2 rounded ${timeRange === '24h' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            24 Hours
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-2 rounded ${timeRange === '7d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            7 Days
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.agent_type}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{metric.agent_type}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Invocations:</span>
                  <span className="font-bold">{metric.invocation_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className={metric.avg_latency_ms > 2000 ? 'text-red-600 font-bold' : ''}>
                    {formatLatency(metric.avg_latency_ms)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Tokens:</span>
                  <span>{metric.avg_tokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Cost:</span>
                  <span>{formatCost(metric.total_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className={metric.avg_confidence < 0.7 ? 'text-yellow-600 font-bold' : 'text-green-600'}>
                    {(metric.avg_confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate:</span>
                  <span className={metric.error_rate > 5 ? 'text-red-600 font-bold' : ''}>
                    {metric.error_rate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Latency Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
              />
              <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {[...new Set(trends.map(t => t.agent_type))].map((agent, idx) => (
                <Line
                  key={agent}
                  type="monotone"
                  dataKey="avg_latency"
                  data={trends.filter(t => t.agent_type === agent)}
                  stroke={`hsl(${idx * 60}, 70%, 50%)`}
                  name={agent}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Invocation Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Invocation Volume by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agent_type" />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="invocation_count" fill="#8884d8" name="Invocations" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agent_type" />
              <YAxis label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => formatCost(value as number)} />
              <Legend />
              <Bar dataKey="total_cost" fill="#82ca9d" name="Total Cost" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.filter(m => m.avg_latency_ms > 2000).map(m => (
              <Alert key={m.agent_type} variant="destructive">
                <AlertDescription>
                  ⚠️ {m.agent_type}: High latency ({formatLatency(m.avg_latency_ms)})
                </AlertDescription>
              </Alert>
            ))}
            {metrics.filter(m => m.avg_confidence < 0.7).map(m => (
              <Alert key={m.agent_type}>
                <AlertDescription>
                  ⚠️ {m.agent_type}: Low confidence ({(m.avg_confidence * 100).toFixed(1)}%)
                </AlertDescription>
              </Alert>
            ))}
            {metrics.filter(m => m.error_rate > 5).map(m => (
              <Alert key={m.agent_type} variant="destructive">
                <AlertDescription>
                  🚨 {m.agent_type}: High error rate ({m.error_rate.toFixed(1)}%)
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
