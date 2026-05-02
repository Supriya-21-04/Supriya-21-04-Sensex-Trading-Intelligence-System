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

  const getSignalColor = (signal) => {
    if (signal?.includes('BUY')) return '#00ff00'
    if (signal?.includes('SELL')) return '#ff4b4b'
    return '#ffaa00'
  }

  const getCandlestickPlot = () => {
    if (!sensexData || sensexData.length === 0) return null
    
    const last100 = sensexData.slice(-100)
    return (
      <Plot
        data={[
          {
            x: last100.map(d => d.Date),
            open: last100.map(d => d.Open),
            high: last100.map(d => d.High),
            low: last100.map(d => d.Low),
            close: last100.map(d => d.Close),
            type: 'candlestick',
            increasing: { line: { color: 'cyan' } },
            decreasing: { line: { color: 'magenta' } },
            name: 'SENSEX'
          }
        ]}
        layout={{
          title: 'Sensex 100-Day Performance',
          xaxis: { title: 'Date' },
          yaxis: { title: 'Price' },
          template: 'plotly_dark',
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          xaxis_rangeslider_visible: false,
          height: 500,
          margin: { t: 50, b: 50, l: 50, r: 50 }
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>🏠 Welcome to SENSEX Market Overview!</h1>

      {/* Welcome Expander */}
      <details style={{ marginBottom: '30px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
          👋 First time here? Click me!
        </summary>
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <p><strong>What is SENSEX?</strong></p>
          <p>It's an index that tracks the top 30 companies on the Bombay Stock Exchange (BSE). Think of it like a "report card" for the Indian stock market!</p>
          <p><strong>What you'll see here:</strong></p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>Current market level</li>
            <li>How it's changed today</li>
            <li>What our AI thinks about buying/selling</li>
          </ul>
        </div>
      </details>

      {/* Live Signal */}
      {metrics?.Live_Inference && (
        <div className="card" style={{
          borderLeft: `5px solid ${getSignalColor(metrics.Live_Inference.signal)}`,
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: getSignalColor(metrics.Live_Inference.signal), fontSize: '24px', fontWeight: '700' }}>
            🎯 Today's AI Suggestion: {metrics.Live_Inference.signal}
          </h2>
          <p style={{ margin: '0', color: '#9ca3af' }}>
            Prediction for {metrics.Live_Inference.prediction_date || metrics.Live_Inference.latest_date} using data from {metrics.Live_Inference.data_date || metrics.Live_Inference.latest_date}
          </p>
        </div>
      )}

      {/* Metrics */}
      {sensexData && sensexData.length > 0 && (
        <>
          <h2 style={{ marginBottom: '20px' }}>📊 Today's Key Numbers</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
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
          
          <hr style={{ border: '1px solid #3e4250', marginBottom: '30px' }} />
          
          {/* Chart Section */}
          <h2 style={{ marginBottom: '20px' }}>📈 How the Market Has Moved (Last 100 Days)</h2>
          <details style={{ marginBottom: '20px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
            <summary style={{ cursor: 'pointer' }}>
              🤔 What is this chart?
            </summary>
            <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
              <p>This is a <strong>candlestick chart</strong> - don't worry, it's easier than it looks!</p>
              <p>🟢 <strong>Green/Blue candle</strong>: Market went up that day</p>
              <p>🔴 <strong>Red/Magenta candle</strong>: Market went down that day</p>
              <p>Each "wick" (the thin lines) shows the highest and lowest points that day</p>
            </div>
          </details>
          <div style={{ height: '500px', marginBottom: '30px' }}>
            {getCandlestickPlot()}
          </div>
          
          {/* Raw Data Table */}
          <details style={{ marginBottom: '20px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
              📋 View Detailed Data
            </summary>
            <div style={{ marginTop: '15px', overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Open</th>
                    <th style={styles.th}>High</th>
                    <th style={styles.th}>Low</th>
                    <th style={styles.th}>Close</th>
                    <th style={styles.th}>Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {sensexData.slice(-20).reverse().map((row, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>{row.Date}</td>
                      <td style={styles.td}>{Number(row.Open).toFixed(2)}</td>
                      <td style={styles.td}>{Number(row.High).toFixed(2)}</td>
                      <td style={styles.td}>{Number(row.Low).toFixed(2)}</td>
                      <td style={styles.td}>{Number(row.Close).toFixed(2)}</td>
                      <td style={styles.td}>{Number(row.Volume).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      
      {!sensexData && (
        <div style={{ backgroundColor: '#1e2130', padding: '20px', borderRadius: '10px', color: '#ffaa00' }}>
          ⚠️ Market data not found. Please go to Settings & Tools and click 'Update Market Data'.
        </div>
      )}
    </div>
  )
}

const MetricCard = ({ label, value, helpText }) => {
  return (
    <div className="card" style={{ padding: '24px', marginBottom: '0' }}>
      <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(90deg, #60a5fa 0%, #34d399 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{value}</div>
      <div style={{ color: '#6b7280', fontSize: '13px', marginTop: '10px' }}>{helpText}</div>
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
  label: {
    color: '#808495',
    fontSize: '14px',
    marginBottom: '5px',
  },
  value: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  helpText: {
    color: '#808495',
    fontSize: '13px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    backgroundColor: '#2e3442',
    padding: '12px 15px',
    textAlign: 'left',
    borderBottom: '1px solid #3e4250',
  },
  td: {
    padding: '12px 15px',
    borderBottom: '1px solid #3e4250',
  },
  tr: {
    '&:hover': {
      backgroundColor: '#2e3442',
    },
  },
}

export default Home
