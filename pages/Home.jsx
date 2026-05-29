import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Plot from 'react-plotly.js'

const Home = () => {
  const [sensexData, setSensexData] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [realtimeData, setRealtimeData] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sensexRes, metricsRes, realtimeRes] = await Promise.all([
        axios.get('/api/data/sensex_ohlcv.csv').catch(() => ({ data: { data: null } })),
        axios.get('/api/data/metrics.json').catch(() => ({ data: { data: null } })),
        axios.get('/api/realtime').catch(() => ({ data: { data: null } })),
      ])
      
      setSensexData(sensexRes.data.data)
      setMetrics(metricsRes.data.data)
      if (realtimeRes.data && realtimeRes.data.status === 'success') {
        setRealtimeData(realtimeRes.data.data)
      }
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
    if (normalized === 'BUY') return '#10b981' // Success color (Green)
    if (normalized === 'SELL') return '#ef4444' // Danger color (Red)
    return '#f59e0b' // Warning color (Yellow)
  }

  const getIntradayPlot = () => {
    if (!realtimeData?.intraday || realtimeData.intraday.length === 0) return null

    const dataPoints = realtimeData.intraday
    return (
      <Plot
        data={[
          {
            x: dataPoints.map((d) => d.time),
            y: dataPoints.map((d) => d.close),
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            line: { color: '#4f46e5', width: 2 },
            fillcolor: 'rgba(79, 70, 229, 0.05)',
            name: 'SENSEX Live',
          },
        ]}
        layout={{
          title: {
            text: 'Live Intraday Movement (15m Intervals)',
            font: { size: 14, color: '#0f172a', family: 'Inter, sans-serif', weight: 'bold' },
          },
          xaxis: {
            title: { text: 'Time', font: { color: '#64748b', size: 10 } },
            gridcolor: 'rgba(148, 163, 184, 0.08)',
            zeroline: false,
            color: '#64748b',
            tickfont: { size: 8 },
          },
          yaxis: {
            title: { text: 'Price (₹)', font: { color: '#64748b', size: 10 } },
            gridcolor: 'rgba(148, 163, 184, 0.08)',
            zeroline: false,
            color: '#64748b',
            tickfont: { size: 8 },
          },
          template: 'plotly_white',
          plot_bgcolor: 'rgba(255, 255, 255, 0.5)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          height: 380,
          margin: { t: 48, b: 48, l: 56, r: 24 },
          font: { family: 'Inter, sans-serif', color: '#475569' },
        }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
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
            increasing: { line: { color: '#10b981' }, fillcolor: '#10b981' },
            decreasing: { line: { color: '#ef4444' }, fillcolor: '#ef4444' },
            name: 'SENSEX',
          },
        ]}
        layout={{
          title: {
            text: 'Sensex 100-Day Performance',
            font: { size: 14, color: '#0f172a', family: 'Inter, sans-serif', weight: 'bold' },
          },
          xaxis: {
            title: { text: 'Date', font: { color: '#64748b', size: 10 } },
            gridcolor: 'rgba(148, 163, 184, 0.08)',
            zeroline: false,
            color: '#64748b',
            tickfont: { size: 8 },
          },
          yaxis: {
            title: { text: 'Price (₹)', font: { color: '#64748b', size: 10 } },
            gridcolor: 'rgba(148, 163, 184, 0.08)',
            zeroline: false,
            color: '#64748b',
            tickfont: { size: 8 },
          },
          template: 'plotly_white',
          plot_bgcolor: 'rgba(255, 255, 255, 0.5)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          xaxis_rangeslider_visible: false,
          height: 380,
          margin: { t: 48, b: 48, l: 56, r: 24 },
          font: { family: 'Inter, sans-serif', color: '#475569' },
        }}
        config={{ displayModeBar: false, responsive: true }}
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

  // Read metrics from realtime endpoint if loaded, otherwise fallback to CSV
  const displayPrice = realtimeData?.price ?? (sensexData && sensexData.length > 0 ? parseFloat(sensexData[sensexData.length - 1].Close) : 0)
  const displayHigh = realtimeData?.high ?? (sensexData && sensexData.length > 0 ? parseFloat(sensexData[sensexData.length - 1].High) : 0)
  const displayLow = realtimeData?.low ?? (sensexData && sensexData.length > 0 ? parseFloat(sensexData[sensexData.length - 1].Low) : 0)
  const displayVolume = realtimeData?.volume ?? (sensexData && sensexData.length > 0 ? parseFloat(sensexData[sensexData.length - 1].Volume) : 0)

  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero__badge">SENSEX Intelligence Platform</div>
        <h1 className="hero__title">
          AI reads market data + news and turns it into clear daily trading signals.
        </h1>
        <p className="hero__lead">
          This system fetches fresh market data, scores financial sentiment, runs inference, and explains the signal in simple language so you can act faster and with context.
        </p>
        <div className="hero__cta">
          <a href="#actions" className="btn btn--primary">Explore Modules</a>
          <Link to="/pipeline" className="btn btn--ghost">Run Pipeline</Link>
        </div>
      </section>

      <section id="actions" className="home-actions">
        <h2 className="section-title">Core Modules</h2>
        <div className="module-grid">
          <Link to="/pipeline" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="module-card__title">Run Pipeline</h3>
            <p className="module-card__desc">Update data, score sentiment, run model inference, and refresh all outputs in one place.</p>
          </Link>
          <Link to="/news" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h3 className="module-card__title">News & Mood</h3>
            <p className="module-card__desc">Track current market sentiment from headlines and see whether bias is bullish, bearish, or neutral.</p>
          </Link>
          <Link to="/paper-trading" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <h3 className="module-card__title">Paper Trading</h3>
            <p className="module-card__desc">Review simulated buy/sell actions and portfolio changes to understand strategy behavior safely.</p>
          </Link>
          <Link to="/backtest" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.5 4.5M21.75 7.5L13.5 15.75l-4.5-4.5M21.75 7.5v6.75m0-6.75H15" />
              </svg>
            </div>
            <h3 className="module-card__title">Backtest Analyzer</h3>
            <p className="module-card__desc">Upload your trade history and get deep analytics, drawdown diagnostics, and Monte Carlo stability checks.</p>
          </Link>
          <Link to="/signals" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
              </svg>
            </div>
            <h3 className="module-card__title">AI Signal Tester</h3>
            <p className="module-card__desc">Ask natural-language questions on your trades and receive AI-led insights with statistical evidence.</p>
          </Link>
          <Link to="/pine" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h3 className="module-card__title">Pine Generator</h3>
            <p className="module-card__desc">Convert strategy ideas into TradingView Pine code and iterate quickly with optimization + fixes.</p>
          </Link>
          <Link to="/strategies" className="module-card">
            <div className="module-card__icon">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="module-card__title">Strategy Library</h3>
            <p className="module-card__desc">Browse ready-made strategies with stats, entry/exit logic, and Pine script templates.</p>
          </Link>
        </div>
      </section>

      {live && (
        <div
          className="card card--signal"
          style={{ '--signal': signalColor }}
        >
          <h2 className="signal-title">
            Today&apos;s AI Suggestion: {normalizedSignal}
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
            <div className="panel__body" style={{ marginTop: '1.25rem' }}>
              {bullishPoints.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                    {normalizedSignal === 'SELL' ? 'What Could Reverse This Signal' : 'Bullish Drivers'}
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                    {bullishPoints.slice(0, normalizedSignal === 'SELL' ? 1 : 6).map((point, idx) => (
                      <li key={`bull-${idx}-${point}`} style={{ marginBottom: '0.2rem' }}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {bearishPoints.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                    Bearish Drivers
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                    {bearishPoints.slice(0, 6).map((point, idx) => (
                      <li key={`bear-${idx}-${point}`} style={{ marginBottom: '0.2rem' }}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {riskFlags.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                    Risk Flags
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                    {riskFlags.slice(0, 6).map((point, idx) => (
                      <li key={`risk-${idx}-${point}`} style={{ marginBottom: '0.2rem' }}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              {influentialNews.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                    Most Influential News
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                    {influentialNews.slice(0, 5).map((item, idx) => {
                      const headline = item?.headline || 'Untitled headline'
                      const sentiment = Number(item?.sentiment || 0).toFixed(3)
                      const why = item?.why_it_matters ? ` — ${item.why_it_matters}` : ''
                      return (
                        <li key={`news-${idx}-${headline}`} style={{ marginBottom: '0.25rem' }}>
                          <strong>{headline}</strong> (sentiment: {sentiment}){why}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(sensexData && sensexData.length > 0) || realtimeData ? (
        <>
          <h2 className="section-title">Live Market Snapshot</h2>
          <div className="metric-grid">
            <MetricCard
              label="Current SENSEX"
              value={displayPrice ? displayPrice.toFixed(2) : '—'}
              helpText="The current 'score' of the market"
            />
            <MetricCard
              label="Highest Today"
              value={displayHigh ? displayHigh.toFixed(2) : '—'}
              helpText="The highest point reached today"
            />
            <MetricCard
              label="Lowest Today"
              value={displayLow ? displayLow.toFixed(2) : '—'}
              helpText="The lowest point today"
            />
            <MetricCard
              label="Trading Activity"
              value={displayVolume ? displayVolume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
              helpText="How many shares were traded"
            />
          </div>

          <hr className="rule" />

          <div style={{ display: 'grid', gridTemplateColumns: realtimeData?.intraday ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            {realtimeData?.intraday && (
              <div className="chart-shell">{getIntradayPlot()}</div>
            )}
            {sensexData && sensexData.length > 0 && (
              <div className="chart-shell">{getCandlestickPlot()}</div>
            )}
          </div>

          {sensexData && sensexData.length > 0 && (
            <details className="panel" style={{ marginTop: '1.5rem' }}>
              <summary>View Detailed Historical Data</summary>
              <div className="panel__body" style={{ marginTop: '0.75rem' }}>
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
          )}
        </>
      ) : null}

      {!sensexData && !realtimeData && (
        <div className="alert alert--warn">
          Market data not found. Open Run Pipeline and click &apos;Run All&apos;.
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
