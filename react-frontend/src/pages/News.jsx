import { useState, useEffect } from 'react'
import axios from 'axios'
import Plot from 'react-plotly.js'

const News = () => {
  const [newsData, setNewsData] = useState(null)
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [newsRes, metricsRes] = await Promise.all([
        axios.get('/api/data/news_headlines_scored.csv'),
        axios.get('/api/data/metrics.json'),
      ])
      setNewsData(newsRes.data.data)
      setMetrics(metricsRes.data.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  const getSentimentColor = (score) => {
    if (score > 0.1) return '#00ff00'
    if (score < -0.1) return '#ff4b4b'
    return '#808495'
  }

  const getSentimentText = (score) => {
    if (score > 0.1) return '😊 Positive (Bullish)'
    if (score < -0.1) return '😟 Negative (Bearish)'
    return '😐 Neutral'
  }

  const getSentimentGauge = () => {
    if (!metrics) return null
    const score = metrics.Current_Exponential_Sentiment || 0
    return (
      <Plot
        data={[
          {
            type: 'indicator',
            mode: 'gauge+number',
            value: score,
            domain: { x: [0, 1], y: [0, 1] },
            title: { text: 'Market Sentiment Score' },
            gauge: {
              axis: { range: [-1, 1] },
              bar: { color: 'white' },
              steps: [
                { range: [-1, -0.3], color: 'red' },
                { range: [-0.3, 0.3], color: 'gray' },
                { range: [0.3, 1], color: 'green' },
              ],
            },
          },
        ]}
        layout={{
          template: 'plotly_dark',
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          height: 350,
          margin: { t: 50, b: 50, l: 50, r: 50 },
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>📰 What People Are Saying About the Market</h1>

      {/* Explanation */}
      <details style={{ marginBottom: '30px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
          🤔 What is 'Sentiment'?
        </summary>
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <p><strong>Sentiment</strong> = How people <em>feel</em> about the market!</p>
          <p>We read lots of financial news and use AI to figure out:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>😊 <strong>Positive</strong>: Good news, people might buy</li>
            <li>😐 <strong>Neutral</strong>: Neither good nor bad</li>
            <li>😟 <strong>Negative</strong>: Bad news, people might sell</li>
          </ul>
          <p>The gauge below shows the overall mood!</p>
        </div>
      </details>

      {/* Sentiment Gauge Area */}
      {metrics && (
        <div style={{
          backgroundColor: '#1e2130',
          padding: '20px',
          borderRadius: '10px',
          border: '1px solid #3e4250',
          marginBottom: '30px',
        }}>
          <h2 style={{ marginBottom: '15px' }}>Current Market Mood</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' }}>
            <div style={{ height: '350px' }}>
              {getSentimentGauge()}
            </div>
            <div>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>
                {metrics.Current_Exponential_Sentiment > 0.1 ? '😊' : 
                 metrics.Current_Exponential_Sentiment < -0.1 ? '😟' : '😐'}
              </div>
              <div style={{ fontSize: '20px', marginBottom: '10px' }}>
                {getSentimentText(metrics.Current_Exponential_Sentiment)}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                Score: {(metrics.Current_Exponential_Sentiment || 0).toFixed(2)}
              </div>
              <details style={{ marginTop: '15px' }}>
                <summary style={{ cursor: 'pointer' }}>🤔 What do these words mean?</summary>
                <div style={{ marginTop: '10px', lineHeight: '1.6' }}>
                  <p><strong>Bullish</strong>: People think the market will go up 📈</p>
                  <p><strong>Bearish</strong>: People think the market will go down 📉</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      <hr style={{ border: '1px solid #3e4250', marginBottom: '30px' }} />

      {/* News List */}
      {newsData && (
        <div>
          <h2 style={{ marginBottom: '20px' }}>📰 Latest News Stories</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Headline</th>
                  <th style={styles.th}>Sentiment</th>
                  <th style={styles.th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {newsData.slice(0, 20).sort((a, b) => new Date(b.Date) - new Date(a.Date)).map((news, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{news.Date?.substring(0, 10)}</td>
                    <td style={styles.td}>{news.Headline}</td>
                    <td style={{ ...styles.td, color: getSentimentColor(news.Sentiment), fontWeight: 'bold' }}>
                      {Number(news.Sentiment).toFixed(2)}
                    </td>
                    <td style={styles.td}>{news.Source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: '20px', color: '#808495', fontStyle: 'italic' }}>
            ✨ Scores are generated by AI analyzing financial news!
          </p>
        </div>
      )}
    </div>
  )
}

const styles = {
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

export default News
