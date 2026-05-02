import { useState, useEffect } from 'react'
import axios from 'axios'

const Settings = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [apiReachable, setApiReachable] = useState(null)

  useEffect(() => {
    axios
      .get('/api/health', { timeout: 3000 })
      .then(() => setApiReachable(true))
      .catch(() => setApiReachable(false))
  }, [])

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [...prev, { message, type, id: `${Date.now()}-${prev.length}` }])
  }

  const formatAxiosError = (err) => {
    const status = err.response?.status
    const detail = err.response?.data?.message
    let msg = err.message || 'Request failed'
    if (detail) msg = `${msg} — ${detail}`
    if (!err.response || status === 500 || status === 502 || status === 503) {
      msg += '. Start the API from the project folder: python web_app.py (must listen on port 8000 for Vite proxy).'
    }
    return msg
  }

  const runScript = async (scriptName) => {
    addLog(`🚀 Executing ${scriptName}...`, 'info')
    try {
      const res = await axios.post(`/api/run-script/${encodeURIComponent(scriptName)}`)
      if (res.data.status === 'success') {
        addLog(`✅ Successfully completed ${scriptName}!`, 'success')
        if (res.data.stdout) {
          addLog(res.data.stdout, 'stdout')
        }
        return true
      }
      addLog(`❌ Error executing ${scriptName}`, 'error')
      if (res.data.stderr) {
        addLog(res.data.stderr, 'stderr')
      }
      if (res.data.stdout) {
        addLog(res.data.stdout, 'stdout')
      }
      return false
    } catch (err) {
      addLog(`💥 System Failure: ${formatAxiosError(err)}`, 'error')
      return false
    }
  }

  const runFullPipeline = async () => {
    setIsRunning(true)
    setLogs([])
    const scripts = [
      'fetch_sensex_data.py',
      'fetch_news.py',
      'score_sentiment.py',
      'feature_engineering.py',
      'live_inference.py'
    ]

    let allOk = true
    for (let i = 0; i < scripts.length; i++) {
      addLog(`**Step ${i + 1} of ${scripts.length}:** ${scripts[i]}`, 'info')
      const ok = await runScript(scripts[i])
      if (!ok) {
        allOk = false
        addLog('❌ Pipeline stopped due to error.', 'error')
        break
      }
    }

    if (allOk) {
      addLog('🎉 Full pipeline completed successfully! Refresh the page to see the latest data.', 'success')
    }
    setIsRunning(false)
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>⚙️ Settings & Tools</h1>

      {apiReachable === false && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: '#3f1d1d',
            border: '1px solid #ff4b4b',
            color: '#fecaca',
            lineHeight: 1.6,
          }}
        >
          <strong>API not reachable.</strong> The React app proxies <code style={{ color: '#fff' }}>/api</code> to{' '}
          <code style={{ color: '#fff' }}>http://127.0.0.1:8000</code>. In a separate terminal, from the project root,
          run: <code style={{ color: '#fff' }}>python web_app.py</code>, then refresh this page.
        </div>
      )}

      {/* Explanation */}
      <details style={{ marginBottom: '30px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
          👋 What do these buttons do?
        </summary>
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <p><strong>Quick Start (One Click!):</strong></p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
            <li>🚀 <strong>Run All</strong>: Do everything automatically - update market data, fetch news, analyze sentiment, and get today's AI suggestion</li>
          </ul>
          <p><strong>Data Pipeline:</strong></p>
          <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
            <li>🔄 <strong>Update Market Data</strong>: Get the latest stock market numbers</li>
            <li>📰 <strong>Fetch Latest News</strong>: Get recent financial news stories</li>
            <li>🧠 <strong>Run Sentiment AI</strong>: Analyze the news to see how people feel</li>
          </ul>
        </div>
      </details>

      {/* Run All Button */}
      <div style={styles.card}>
        <h2 style={{ marginBottom: '15px' }}>🚀 Quick Start - One Click!</h2>
        <button 
          style={{ ...styles.button, backgroundColor: '#4CAF50' }}
          onClick={runFullPipeline}
          disabled={isRunning}
        >
          {isRunning ? '⏳ Running...' : '✨ Run All (Update Everything)'}
        </button>
      </div>

      {logs.length > 0 && (
        <div style={styles.logContainer}>
          <h3 style={{ marginBottom: '10px' }}>📄 Execution Logs</h3>
          <div style={styles.logs}>
            {logs.map(log => (
              <div 
                key={log.id} 
                style={{ 
                  ...styles.log, 
                  color: log.type === 'error' ? '#ff4b4b' : log.type === 'success' ? '#00ff00' : '#ffffff' 
                }}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Data Pipeline */}
        <div style={styles.card}>
          <h2 style={{ marginBottom: '15px' }}>📥 Data Pipeline</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button style={styles.button} onClick={() => runScript('fetch_sensex_data.py')} disabled={isRunning}>
              🔄 Update Market Data
            </button>
            <button style={styles.button} onClick={() => runScript('fetch_news.py')} disabled={isRunning}>
              📰 Fetch Latest News
            </button>
            <button style={styles.button} onClick={() => runScript('score_sentiment.py')} disabled={isRunning}>
              🧠 Run Sentiment AI
            </button>
          </div>
        </div>

        {/* Advanced */}
        <div style={styles.card}>
          <h2 style={{ marginBottom: '15px' }}>🚀 AI Bot Engine (Advanced)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button style={styles.button} onClick={() => runScript('feature_engineering.py')} disabled={isRunning}>
              🏗️ Engineer Features
            </button>
            <button style={styles.button} onClick={() => runScript('split_data.py')} disabled={isRunning}>
              📐 Split Datasets
            </button>
            <button style={styles.button} onClick={() => runScript('train_ppo.py')} disabled={isRunning}>
              🎓 Train PPO Agent
            </button>
            <button style={styles.button} onClick={() => runScript('evaluate_agent.py')} disabled={isRunning}>
              🧪 Evaluate Agent
            </button>
            <button style={styles.button} onClick={() => runScript('live_inference.py')} disabled={isRunning}>
              🎯 Get Live Signal
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: {
    backgroundColor: '#1e2130',
    padding: '20px',
    borderRadius: '10px',
    border: '1px solid #3e4250',
  },
  button: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#2e7bcf',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#1e5faf',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  logContainer: {
    marginTop: '20px',
    backgroundColor: '#1e2130',
    padding: '15px',
    borderRadius: '10px',
    border: '1px solid #3e4250',
  },
  logs: {
    maxHeight: '400px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  log: {
    marginBottom: '5px',
  },
}

export default Settings
