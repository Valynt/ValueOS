import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)

function App() {
  const [message, setMessage] = useState<string>('')
  const [loading, setLoading] = useState(true)

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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">ValueOS</h1>
          <p className="text-lg text-gray-600">Welcome to your development environment</p>
        </header>

        <main className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4">System Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                <span className="text-green-800">Frontend:</span>
                <span className="text-green-600 font-medium">✅ Running</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                <span className="text-blue-800">Backend API:</span>
                <span className="text-blue-600 font-medium">
                  {loading ? '⏳ Connecting...' : '✅ Connected'}
                </span>
              </div>

              {message && (
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">API Response:</p>
                  <p className="text-gray-800 font-mono">{message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Development Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Frontend Port:</span> {import.meta.env.VITE_FRONTEND_PORT || '5173'}
              </div>
              <div>
                <span className="font-medium">Backend Port:</span> {import.meta.env.VITE_API_BASE_URL?.split(':').pop() || '8000'}
              </div>
              <div>
                <span className="font-medium">Environment:</span> {import.meta.env.MODE}
              </div>
              <div>
                <span className="font-medium">Supabase URL:</span> {import.meta.env.VITE_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
