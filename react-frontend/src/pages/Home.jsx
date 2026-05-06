import { useState, useEffect } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'

const Home = () => {
  const [sensexData, setSensexData] = useState(null)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sensexRes, metricsRes] = await Promise.all([
        axios.get('/api/data/sensex_ohlcv.csv'),
        axios.get('/api/data/metrics.json'),
      ])
      setSensexData(sensexRes.data.data)
      setMetrics(metricsRes.data.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  const normalizeSignal = (signal) => {
    const text = String(signal || '').toUpperCase()
    if (text.includes('SELL')) return 'SELL'
    if (text.includes('BUY')) return 'BUY'
    return 'HOLD'
  }

  const getSignalColor = (signal) => {
    const normalized = normalizeSignal(signal)
    if (normalized === 'BUY') return '#34d399'
    if (normalized === 'SELL') return '#fb7185'
    return '#fbbf24'
  }

  const getCandlestickPlot = () => {
    if (!sensexData || sensexData.length === 0) return null

    const last100 = sensexData.slice(-100)
    return (
      <Plot
        data={[
          {
            x: last100.map((d) => d.Date),
            open: last100.map((d) => d.Open),
            high: last100.map((d) => d.High),
            low: last100.map((d) => d.Low),
            close: last100.map((d) => d.Close),
            type: 'candlestick',
            increasing: { line: { color: '#22d3ee' }, fillcolor: '#22d3ee' },
            decreasing: { line: { color: '#f472b6' }, fillcolor: '#f472b6' },
            name: 'SENSEX',
          },
        ]}
        layout={{
          title: {
            text: 'Sensex 100-Day Performance',
            font: { size: 16, color: '#e2e8f0', family: 'Inter, sans-serif' },
          },
          xaxis: {
            title: { text: 'Date', font: { color: '#94a3b8', size: 12 } },
            gridcolor: 'rgba(148, 163, 184, 0.15)',
            zeroline: false,
            color: '#94a3b8',
          },
          yaxis: {
            title: { text: 'Price (₹)', font: { color: '#94a3b8', size: 12 } },
            gridcolor: 'rgba(148, 163, 184, 0.15)',
            zeroline: false,
            color: '#94a3b8',
          },
          template: 'plotly_dark',
          plot_bgcolor: 'rgba(15,23,42,0.35)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          xaxis_rangeslider_visible: false,
          height: 480,
          margin: { t: 48, b: 48, l: 56, r: 24 },
          font: { family: 'Inter, sans-serif', color: '#cbd5e1' },
        }}
        config={{ displayModeBar: true, displaylogo: false, responsive: true }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }

  const live = metrics?.Live_Inference
  const normalizedSignal = normalizeSignal(live?.signal)
  const signalColor = live ? getSignalColor(normalizedSignal) : undefined
  const explanationDetails = live?.explanation_details || {}
  const influentialNews = Array.isArray(explanationDetails.influential_news) ? explanationDetails.influential_news : []
  const bullishPoints = Array.isArray(explanationDetails.bullish_points) ? explanationDetails.bullish_points : []
  const bearishPoints = Array.isArray(explanationDetails.bearish_points) ? explanationDetails.bearish_points : []
  const riskFlags = Array.isArray(explanationDetails.risk_flags) ? explanationDetails.risk_flags : []

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">🏠 Welcome to SENSEX Market Overview!</h1>
      </header>

      <details className="panel">
        <summary>👋 First time here? Click me!</summary>
        <div className="panel__body">
          <p>
            <strong>What is SENSEX?</strong>
          </p>
          <p>
            It&apos;s an index that tracks the top 30 companies on the Bombay Stock Exchange (BSE). Think of it like a
            &quot;report card&quot; for the Indian stock market!
          </p>
          <p>
            <strong>What you&apos;ll see here:</strong>
          </p>
          <ul>
            <li>Current market level</li>
            <li>How it&apos;s changed today</li>
            <li>What our AI thinks about buying/selling</li>
          </ul>
        </div>
      </details>

      {live && (
        <div
          className="card card--signal"
          style={{ '--signal': signalColor }}
        >
          <h2 className="signal-title">
            🎯 Today&apos;s AI Suggestion: {normalizedSignal}
          </h2>
          <p className="signal-meta">
            Prediction for {live.prediction_date || live.latest_date} using data from{' '}
            {live.data_date || live.latest_date}
          </p>
          {live.explanation && <p className="signal-explanation">{live.explanation}</p>}
          {Array.isArray(live.key_factors) && live.key_factors.length > 0 && (
            <div className="factor-list">
              {live.key_factors.map((factor, idx) => (
                <span key={`${idx}-${factor}`} className="factor-chip">
                  {factor}
                </span>
              ))}
            </div>
          )}
          {live.explanation_source && (
            <p className="signal-source">Explanation source: {live.explanation_source}</p>
          )}
          {(bullishPoints.length > 0 || bearishPoints.length > 0 || riskFlags.length > 0 || influentialNews.length > 0) && (
            <div className="panel__body" style={{ marginTop: '0.85rem' }}>
              {bullishPoints.length > 0 && (
                <>
                  <p>
                    <strong>{normalizedSignal === 'SELL' ? '🔄 What Could Reverse This Signal' : '✅ Bullish Drivers'}</strong>
                  </p>
                  <ul>
                    {bullishPoints.slice(0, normalizedSignal === 'SELL' ? 1 : 6).map((point, idx) => (
                      <li key={`bull-${idx}-${point}`}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
              {bearishPoints.length > 0 && (
                <>
                  <p>
                    <strong>⚠️ Bearish Drivers</strong>
                  </p>
                  <ul>
                    {bearishPoints.slice(0, 6).map((point, idx) => (
                      <li key={`bear-${idx}-${point}`}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
              {riskFlags.length > 0 && (
                <>
                  <p>
                    <strong>🛡️ Risk Flags</strong>
                  </p>
                  <ul>
                    {riskFlags.slice(0, 6).map((point, idx) => (
                      <li key={`risk-${idx}-${point}`}>{point}</li>
                    ))}
                  </ul>
                </>
              )}
              {influentialNews.length > 0 && (
                <>
                  <p>
                    <strong>📰 Most Influential News</strong>
                  </p>
                  <ul>
                    {influentialNews.slice(0, 5).map((item, idx) => {
                      const headline = item?.headline || 'Untitled headline'
                      const sentiment = Number(item?.sentiment || 0).toFixed(3)
                      const why = item?.why_it_matters ? ` — ${item.why_it_matters}` : ''
                      return (
                        <li key={`news-${idx}-${headline}`}>
                          {headline} (sentiment: {sentiment}){why}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {sensexData && sensexData.length > 0 && (
        <>
          <h2 className="section-title">📊 Today&apos;s Key Numbers</h2>
          <div className="metric-grid">
            <MetricCard
              label="Current SENSEX"
              value={Number(sensexData[sensexData.length - 1].Close).toFixed(2)}
              helpText="The current 'score' of the market"
            />
            <MetricCard
              label="Highest Today"
              value={Number(sensexData[sensexData.length - 1].High).toFixed(2)}
              helpText="The highest point reached today"
            />
            <MetricCard
              label="Lowest Today"
              value={Number(sensexData[sensexData.length - 1].Low).toFixed(2)}
              helpText="The lowest point today"
            />
            <MetricCard
              label="Trading Activity"
              value={Number(sensexData[sensexData.length - 1].Volume).toFixed(0)}
              helpText="How many shares were traded"
            />
          </div>

          <hr className="rule" />

          <h2 className="section-title">📈 How the Market Has Moved (Last 100 Days)</h2>
          <details className="panel">
            <summary>🤔 What is this chart?</summary>
            <div className="panel__body">
              <p>
                This is a <strong>candlestick chart</strong> - don&apos;t worry, it&apos;s easier than it looks!
              </p>
              <p>
                🟢 <strong>Green/Blue candle</strong>: Market went up that day
              </p>
              <p>
                🔴 <strong>Red/Magenta candle</strong>: Market went down that day
              </p>
              <p>Each &quot;wick&quot; (the thin lines) shows the highest and lowest points that day</p>
            </div>
          </details>
          <div className="chart-shell chart-shell--tall">{getCandlestickPlot()}</div>

          <details className="panel">
            <summary>📋 View Detailed Data</summary>
            <div className="panel__body" style={{ marginTop: '0.5rem' }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensexData
                      .slice(-20)
                      .reverse()
                      .map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.Date}</td>
                          <td>{Number(row.Open).toFixed(2)}</td>
                          <td>{Number(row.High).toFixed(2)}</td>
                          <td>{Number(row.Low).toFixed(2)}</td>
                          <td>{Number(row.Close).toFixed(2)}</td>
                          <td>{Number(row.Volume).toFixed(0)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </>
      )}

      {!sensexData && (
        <div className="alert alert--warn">
          ⚠️ Market data not found. Please go to Settings & Tools and click &apos;Update Market Data&apos;.
        </div>
      )}
    </div>
  )
}

const MetricCard = ({ label, value, helpText }) => (
  <div className="card metric-tile">
    <span className="metric-tile__label">{label}</span>
    <span className="metric-tile__value">{value}</span>
    <span className="metric-tile__hint">{helpText}</span>
  </div>
)

export default Home
