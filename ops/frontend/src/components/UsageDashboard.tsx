import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subDays } from 'date-fns'
import { supabase } from './lib/supabase'

interface UsageMetric {
  metric: string
  usage: number
  quota: number
  timestamp: string
}

interface DashboardData {
  usageSummary: UsageMetric[]
  entitlements: {
    quotas: Record<string, number>
    usage: Record<string, number>
    alerts: string[]
  }
  recentAggregates: UsageMetric[]
  upcomingInvoice: {
    total: number
    lineItems: Array<{ description: string; amount: number }>
  }
  pricingVersion: {
    planTier: string
    rates: Record<string, number>
  }
}

export default function UsageDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/usage/dashboard`)
      .then(res => res.json())
      .then(data => {
        setDashboardData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load usage data')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error || 'Failed to load dashboard data'}</p>
      </div>
    )
  }

  const { usageSummary, entitlements, recentAggregates, upcomingInvoice, pricingVersion } = dashboardData

  // Prepare data for charts
  const chartData = recentAggregates.map(aggregate => ({
    date: new Date(aggregate.timestamp).toLocaleDateString(),
    tokens: aggregate.metric === 'llm_tokens' ? aggregate.usage : 0,
    apiCalls: aggregate.metric === 'api_calls' ? aggregate.usage : 0,
    executions: aggregate.metric === 'agent_executions' ? aggregate.usage : 0
  }))

  const totalUsage = usageSummary.reduce((sum, metric) => sum + metric.usage, 0)
  const totalQuota = usageSummary.reduce((sum, metric) => sum + (metric.quota || 0), 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Usage Dashboard</h1>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Refresh
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Total Usage</h3>
          <div className="text-2xl font-bold text-blue-600">{totalUsage.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">of {totalQuota.toLocaleString()} quota</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Usage Percentage</h3>
          <div className="text-2xl font-bold text-green-600">
            {totalQuota > 0 ? Math.round((totalUsage / totalQuota) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-500 mt-1">of available quota</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Upcoming Invoice</h3>
          <div className="text-2xl font-bold text-purple-600">
            ${upcomingInvoice.total.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 mt-1">estimated this month</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Usage Trends Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Usage Trends (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="tokens" stroke="#8884d8" name="Tokens" />
              <Line type="monotone" dataKey="apiCalls" stroke="#82ca9d" name="API Calls" />
              <Line type="monotone" dataKey="executions" stroke="#ffc658" name="Executions" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Quota Usage Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Quota Usage by Metric</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={usageSummary}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Legend />
              {usageSummary.map((metric, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey="usage"
                  stroke={getMetricColor(metric.metric)}
                  name={metric.metric}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quota Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quota Status</h3>
        <div className="space-y-4">
          {Object.entries(entitlements.quotas).map(([metric, quota]) => {
            const usage = entitlements.usage[metric] || 0
            const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0
            const isCritical = percentage >= 90
            const isWarning = percentage >= 70

            return (
              <div key={metric} className="flex items-center justify-between p-3 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{formatMetricName(metric)}</div>
                  <div className="text-sm text-gray-500">
                    {usage.toLocaleString()} / {quota.toLocaleString()} ({percentage}%)
                  </div>
                </div>
                <div className={`w-32 h-2 rounded-full bg-${isCritical ? 'red' : isWarning ? 'yellow' : 'green'}-200`}
                  style={{ background: `linear-gradient(90deg, ${isCritical ? '#fecaca' : isWarning ? '#fbbf24' : '#10b981'} ${percentage}%, #e5e7eb 0%)` }}>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Alerts */}
      {entitlements.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Recent Alerts</h3>
          <div className="space-y-2">
            {entitlements.alerts.map((alert, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
                </div>
                <p className="text-sm text-red-600">{alert}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Preview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Upcoming Invoice Preview</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="font-medium">Total Amount:</div>
              <div className="text-2xl font-bold text-purple-600">${upcomingInvoice.total.toFixed(2)}</div>
            </div>
            <div>
              <div className="font-medium">Plan Tier:</div>
              <div className="text-lg font-semibold">{pricingVersion.planTier}</div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Line Items:</h4>
            <div className="space-y-2">
              {upcomingInvoice.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-sm">{item.description}</span>
                  <span className="text-sm font-medium">${item.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getMetricColor(metric: string): string {
  const colors: Record<string, string> = {
    'llm_tokens': '#8884d8',
    'api_calls': '#82ca9d',
    'agent_executions': '#ffc658',
    'storage_gb': '#ff6b6b',
    'user_seats': '#17a2b8'
  }
  return colors[metric] || '#6c757d'
}

function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    'llm_tokens': 'LLM Tokens',
    'api_calls': 'API Calls',
    'agent_executions': 'Agent Executions',
    'storage_gb': 'Storage (GB)',
    'user_seats': 'User Seats'
  }
  return names[metric] || metric
}

// Export for use in other components
export { UsageDashboard }
