import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import UsageDashboard from './components/UsageDashboard'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

function App() {
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    // Test API connection
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/hello`)
      .then(res => res.json())
      .then(data => {
        setMessage(data.message)
        setLoading(false)
      })
      .catch(err => {
        console.error('API connection error:', err)
        setMessage('Failed to connect to backend')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-25">
      <div className="container mx-auto px-8 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-light text-gray-900 mb-3 tracking-tight">ValueOS</h1>
          <p className="text-lg text-gray-500 font-light">Usage Transparency Dashboard</p>
        </header>

        <div className="flex justify-end mb-10">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-fine transition-all duration-200 font-medium"
          >
            {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
          </button>
        </div>

        {showDashboard ? (
          <UsageDashboard />
        ) : (
          <main className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-fine p-10">
              <h2 className="text-2xl font-light text-gray-900 mb-8">System Status</h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="text-gray-700 font-medium">Frontend:</span>
                  <span className="text-green-600 font-medium">✅ Running</span>
                </div>

                <div className="flex items-center justify-between p-5 bg-blue-25 rounded-lg border border-blue-150">
                  <span className="text-blue-700 font-medium">Backend API:</span>
                  <span className="text-blue-600 font-medium">
                    {loading ? '⏳ Connecting...' : '✅ Connected'}
                  </span>
                </div>

                {message && (
                  <div className="p-5 bg-gray-25 rounded-lg border border-gray-150">
                    <p className="text-sm text-gray-500 mb-2">API Response:</p>
                    <p className="text-gray-700 font-mono text-sm bg-white p-3 rounded border border-gray-200">{message}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-12 bg-white rounded-xl border border-gray-200 shadow-fine p-10">
              <h3 className="text-xl font-light text-gray-900 mb-8">Development Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="p-4 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="font-medium text-gray-700">Frontend Port:</span> <span className="text-gray-600">{import.meta.env.VITE_FRONTEND_PORT || '5173'}</span>
                </div>
                <div className="p-4 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="font-medium text-gray-700">Backend Port:</span> <span className="text-gray-600">{import.meta.env.VITE_API_BASE_URL?.split(':').pop() || '8000'}</span>
                </div>
                <div className="p-4 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="font-medium text-gray-700">Environment:</span> <span className="text-gray-600">{import.meta.env.MODE}</span>
                </div>
                <div className="p-4 bg-gray-25 rounded-lg border border-gray-150">
                  <span className="font-medium text-gray-700">Supabase URL:</span> <span className="text-gray-600">{import.meta.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}</span>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

export default App
