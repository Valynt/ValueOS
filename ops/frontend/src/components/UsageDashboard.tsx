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
    <div className="p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-light text-gray-900 tracking-tight">Usage Dashboard</h1>
        <div className="flex space-x-4">
          <button className="px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-fine transition-all duration-200 font-medium">
            Refresh
          </button>
          <button className="px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-fine transition-all duration-200 font-medium">
            Export
          </button>
        </div>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
          <h3 className="text-lg font-light text-gray-700 mb-4">Total Usage</h3>
          <div className="text-3xl font-light text-blue-600">{totalUsage.toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-2">of {totalQuota.toLocaleString()} quota</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
          <h3 className="text-lg font-light text-gray-700 mb-4">Usage Percentage</h3>
          <div className="text-3xl font-light text-green-600">
            {totalQuota > 0 ? Math.round((totalUsage / totalQuota) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-500 mt-2">of available quota</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
          <h3 className="text-lg font-light text-gray-700 mb-4">Upcoming Invoice</h3>
          <div className="text-3xl font-light text-purple-600">
            ${upcomingInvoice.total.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 mt-2">estimated this month</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Usage Trends Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
          <h3 className="text-lg font-light text-gray-700 mb-6">Usage Trends (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="tokens" stroke="#8884d8" name="Tokens" strokeWidth={1.5} />
              <Line type="monotone" dataKey="apiCalls" stroke="#82ca9d" name="API Calls" strokeWidth={1.5} />
              <Line type="monotone" dataKey="executions" stroke="#ffc658" name="Executions" strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Quota Usage Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
          <h3 className="text-lg font-light text-gray-700 mb-6">Quota Usage by Metric</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={usageSummary}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="metric" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              {usageSummary.map((metric, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey="usage"
                  stroke={getMetricColor(metric.metric)}
                  name={metric.metric}
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quota Status */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8 mb-12">
        <h3 className="text-lg font-light text-gray-700 mb-8">Quota Status</h3>
        <div className="space-y-6">
          {Object.entries(entitlements.quotas).map(([metric, quota]) => {
            const usage = entitlements.usage[metric] || 0
            const percentage = quota > 0 ? Math.round((usage / quota) * 100) : 0
            const isCritical = percentage >= 90
            const isWarning = percentage >= 70

            return (
              <div key={metric} className="flex items-center justify-between p-5 rounded-lg border border-gray-150">
                <div className="flex-1">
                  <div className="font-medium text-gray-700">{formatMetricName(metric)}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {usage.toLocaleString()} / {quota.toLocaleString()} ({percentage}%)
                  </div>
                </div>
                <div className="w-40 h-2 rounded-full bg-gray-200 overflow-hidden"
                  style={{ background: `linear-gradient(90deg, ${isCritical ? '#fecaca' : isWarning ? '#fbbf24' : '#10b981'} ${percentage}%, #e5e7eb 0%)` }}>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Alerts */}
      {entitlements.alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8 mb-12">
          <h3 className="text-lg font-light text-red-600 mb-6">Recent Alerts</h3>
          <div className="space-y-4">
            {entitlements.alerts.map((alert, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-red-25 rounded-lg border border-red-150">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                </div>
                <p className="text-sm text-red-700">{alert}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-8">
        <h3 className="text-lg font-light text-gray-700 mb-8">Upcoming Invoice Preview</h3>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-gray-25 rounded-lg border border-gray-150">
              <div className="font-medium text-gray-700 mb-2">Total Amount:</div>
              <div className="text-3xl font-light text-purple-600">${upcomingInvoice.total.toFixed(2)}</div>
            </div>
            <div className="p-6 bg-gray-25 rounded-lg border border-gray-150">
              <div className="font-medium text-gray-700 mb-2">Plan Tier:</div>
              <div className="text-xl font-light text-gray-900">{pricingVersion.planTier}</div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <h4 className="font-medium text-gray-700 mb-6">Line Items:</h4>
            <div className="space-y-4">
              {upcomingInvoice.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between p-4 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="text-sm text-gray-700">{item.description}</span>
                  <span className="text-sm font-medium text-gray-900">${item.amount.toFixed(2)}</span>
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
