// Simple Campaign Sender UI Component
// Ultra-simple interface - complexity hidden behind the scenes

import { useState } from 'react'

export function SimpleCampaignSender() {
  const [leads, setLeads] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [goal, setGoal] = useState<'appointment' | 'nurture' | 'announcement'>('nurture')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSend = async () => {
    setSending(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/smart-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads,
          message: message || undefined, // AI generates if empty
          goal
        })
      })
      
      const data = await response.json()
      setResult(data)
      
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Send Campaign</h2>
        <p className="text-gray-600">
          AI automatically chooses the best channel for each lead
        </p>
      </div>

      {/* Goal Selection */}
      <div className="space-y-2">
        <label className="block font-medium">Campaign Goal</label>
        <div className="flex gap-4">
          <button
            onClick={() => setGoal('appointment')}
            className={`px-4 py-2 rounded ${
              goal === 'appointment' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200'
            }`}
          >
            📅 Book Appointment
          </button>
          <button
            onClick={() => setGoal('nurture')}
            className={`px-4 py-2 rounded ${
              goal === 'nurture' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200'
            }`}
          >
            🌱 Nurture Lead
          </button>
          <button
            onClick={() => setGoal('announcement')}
            className={`px-4 py-2 rounded ${
              goal === 'announcement' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200'
            }`}
          >
            📢 Announcement
          </button>
        </div>
      </div>

      {/* Lead Selection */}
      <div className="space-y-2">
        <label className="block font-medium">
          Select Leads ({leads.length} selected)
        </label>
        <button 
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => {/* Open lead selector modal */}}
        >
          Choose Leads
        </button>
      </div>

      {/* Message (Optional) */}
      <div className="space-y-2">
        <label className="block font-medium">
          Message (optional - AI generates if blank)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave blank for AI-generated message, or write your own..."
          className="w-full p-3 border rounded-lg h-32"
        />
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={sending || leads.length === 0}
        className={`w-full py-3 rounded-lg font-medium ${
          sending || leads.length === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {sending ? '🚀 Sending...' : `Send to ${leads.length} leads`}
      </button>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg ${
          result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {result.success ? (
            <>
              <h3 className="font-bold text-green-800 mb-2">
                ✅ Campaign Launched!
              </h3>
              <div className="space-y-1 text-sm text-green-700">
                <p>📊 Sent to {result.sent_to} leads</p>
                <p>💰 Estimated cost: ${result.estimated_cost?.toFixed(2)}</p>
                
                <div className="mt-3">
                  <p className="font-medium">Channels used:</p>
                  <ul className="ml-4 space-y-1">
                    {result.channels_used.voice_calls > 0 && (
                      <li>📞 {result.channels_used.voice_calls} AI voice calls</li>
                    )}
                    {result.channels_used.voicemails > 0 && (
                      <li>🎙️ {result.channels_used.voicemails} voicemails</li>
                    )}
                    {result.channels_used.sms > 0 && (
                      <li>📱 {result.channels_used.sms} SMS messages</li>
                    )}
                    {result.channels_used.email > 0 && (
                      <li>📧 {result.channels_used.email} emails</li>
                    )}
                  </ul>
                </div>
                
                <p className="mt-3 italic">{result.message}</p>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-bold text-red-800">❌ Error</h3>
              <p className="text-red-700">{result.error}</p>
            </>
          )}
        </div>
      )}

      {/* How It Works (Collapsible) */}
      <details className="border rounded-lg p-4">
        <summary className="cursor-pointer font-medium">
          🧠 How does this work?
        </summary>
        <div className="mt-3 space-y-2 text-sm text-gray-600">
          <p>When you click "Send", our AI orchestration system:</p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>Analyzes each lead (quality score, contact info, behavior)</li>
            <li>Determines the best channel for each lead:
              <ul className="ml-5 mt-1 space-y-1">
                <li>• High-value + Phone → AI Voice Call</li>
                <li>• Medium-value + Phone → Voicemail Drop</li>
                <li>• Has Email → Email</li>
                <li>• SMS fallback when needed</li>
              </ul>
            </li>
            <li>Generates personalized content (if not provided)</li>
            <li>Optimizes timing (immediate for hot leads, business hours for others)</li>
            <li>Sends through appropriate channels</li>
            <li>Tracks results automatically</li>
          </ol>
          <p className="mt-2 italic">
            You don't manage channels - the system picks the best one for each lead!
          </p>
        </div>
      </details>

    </div>
  )
}
