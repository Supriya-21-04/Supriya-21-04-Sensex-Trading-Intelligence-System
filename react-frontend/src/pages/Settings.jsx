import { useState, useEffect } from 'react'
import axios from 'axios'

const logClass = (type) => {
  if (type === 'error') return 'log-line log-line--error'
  if (type === 'success') return 'log-line log-line--success'
  if (type === 'stdout' || type === 'stderr') return 'log-line log-line--stdout'
  return 'log-line log-line--info'
}

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
      msg +=
        '. Start the API from the project folder: python web_app.py (must listen on port 8000 for Vite proxy).'
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
      'live_inference.py',
      'explain_live_signal.py',
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
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">⚙️ Settings & Tools</h1>
      </header>

      {apiReachable === false && (
        <div className="alert alert--danger">
          <strong>API not reachable.</strong> The React app proxies <code>/api</code> to{' '}
          <code>http://127.0.0.1:8000</code>. In a separate terminal, from the project root, run:{' '}
          <code>python web_app.py</code>, then refresh this page.
        </div>
      )}

      <details className="panel">
        <summary>👋 What do these buttons do?</summary>
        <div className="panel__body">
          <p>
            <strong>Quick Start (One Click!):</strong>
          </p>
          <ul>
            <li>
              🚀 <strong>Run All</strong>: Do everything automatically - update market data, fetch news, analyze
              sentiment, and get today&apos;s AI suggestion
            </li>
          </ul>
          <p>
            <strong>Data Pipeline:</strong>
          </p>
          <ul>
            <li>
              🔄 <strong>Update Market Data</strong>: Get the latest stock market numbers
            </li>
            <li>
              📰 <strong>Fetch Latest News</strong>: Get recent financial news stories
            </li>
            <li>
              🧠 <strong>Run Sentiment AI</strong>: Analyze the news to see how people feel
            </li>
          </ul>
        </div>
      </details>

      <div className="card">
        <h2 className="settings-card__title">🚀 Quick Start - One Click!</h2>
        <p className="settings-card__desc">Runs the full refresh chain end-to-end with one confirmation trail in the log.</p>
        <button type="button" className="btn btn--success" onClick={runFullPipeline} disabled={isRunning}>
          {isRunning ? '⏳ Running...' : '✨ Run All (Update Everything)'}
        </button>
      </div>

      {logs.length > 0 && (
        <div className="log-panel">
          <h3 className="log-panel__title">📄 Execution Logs</h3>
          <div className="log-panel__scroll">
            {logs.map((log) => (
              <div key={log.id} className={logClass(log.type)}>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="settings-grid">
        <div className="card">
          <h2 className="settings-card__title">📥 Data Pipeline</h2>
          <div className="btn-stack">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => runScript('fetch_sensex_data.py')}
              disabled={isRunning}
            >
              🔄 Update Market Data
            </button>
            <button type="button" className="btn btn--primary" onClick={() => runScript('fetch_news.py')} disabled={isRunning}>
              📰 Fetch Latest News
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => runScript('score_sentiment.py')}
              disabled={isRunning}
            >
              🧠 Run Sentiment AI
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="settings-card__title">🚀 AI Bot Engine (Advanced)</h2>
          <div className="btn-stack">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => runScript('feature_engineering.py')}
              disabled={isRunning}
            >
              🏗️ Engineer Features
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => runScript('split_data.py')} disabled={isRunning}>
              📐 Split Datasets
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => runScript('train_ppo.py')} disabled={isRunning}>
              🎓 Train PPO Agent
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => runScript('evaluate_agent.py')}
              disabled={isRunning}
            >
              🧪 Evaluate Agent
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => runScript('live_inference.py')}
              disabled={isRunning}
            >
              🎯 Get Live Signal
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => runScript('explain_live_signal.py')}
              disabled={isRunning}
            >
              🧾 Explain Live Signal (LLM)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
