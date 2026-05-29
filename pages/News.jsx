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
    if (score > 0.1) return '#10b981' // emerald-500
    if (score < -0.1) return '#ef4444' // red-500
    return '#64748b' // slate-500
  }

  const getSentimentText = (score) => {
    if (score > 0.1) return 'Positive (Bullish)'
    if (score < -0.1) return 'Negative (Bearish)'
    return 'Neutral'
  }

  const getSentimentGauge = () => {
    if (!metrics) return null
    const score = metrics.Current_Exponential_Sentiment || 0
    const barColor =
      score > 0.1 ? '#10b981' : score < -0.1 ? '#ef4444' : '#f59e0b'
    return (
      <Plot
        data={[
          {
            type: 'indicator',
            mode: 'gauge+number',
            value: score,
            domain: { x: [0, 1], y: [0, 1] },
            title: {
              text: 'Market Sentiment Score',
              font: { size: 14, color: '#0f172a', family: 'Inter, sans-serif', weight: 'bold' },
            },
            number: {
              font: { color: '#0f172a', family: 'Inter, sans-serif', size: 36, weight: 'bold' },
            },
            gauge: {
              axis: {
                range: [-1, 1],
                tickcolor: '#64748b',
                tickwidth: 1,
                tickfont: { color: '#64748b', size: 11 },
              },
              bar: { color: barColor, thickness: 0.32 },
              bgcolor: 'rgba(241, 245, 249, 0.8)',
              borderwidth: 1,
              bordercolor: 'rgba(148, 163, 184, 0.25)',
              steps: [
                { range: [-1, -0.3], color: 'rgba(239, 68, 68, 0.08)' },
                { range: [-0.3, 0.3], color: 'rgba(148, 163, 184, 0.06)' },
                { range: [0.3, 1], color: 'rgba(16, 185, 129, 0.08)' },
              ],
            },
          },
        ]}
        layout={{
          template: 'plotly_white',
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          height: 340,
          margin: { t: 56, b: 32, l: 32, r: 32 },
          font: { family: 'Inter, sans-serif', color: '#0f172a' },
        }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }

  const score = metrics?.Current_Exponential_Sentiment ?? 0

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">What People Are Saying About the Market</h1>
      </header>

      <details className="panel">
        <summary>What is &apos;Sentiment&apos;?</summary>
        <div className="panel__body">
          <p>
            <strong>Sentiment</strong> = How people <em>feel</em> about the market!
          </p>
          <p>We read lots of financial news and use AI to figure out:</p>
          <ul style={{ paddingLeft: '1.25rem' }}>
            <li style={{ marginBottom: '0.2rem' }}>
              <strong>Positive</strong>: Good news, people might buy
            </li>
            <li style={{ marginBottom: '0.2rem' }}>
              <strong>Neutral</strong>: Neither good nor bad
            </li>
            <li style={{ marginBottom: '0.2rem' }}>
              <strong>Negative</strong>: Bad news, people might sell
            </li>
          </ul>
          <p>The gauge below shows the overall mood!</p>
        </div>
      </details>

      {metrics && (
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Current Market Mood
          </h2>
          <div className="mood-panel">
            <div className="chart-shell" style={{ minHeight: 360 }}>
              {getSentimentGauge()}
            </div>
            <div className="mood-side">
              <div className="mood-label" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{getSentimentText(score)}</div>
              <div className="mood-score">Score: {(score || 0).toFixed(2)}</div>
              <details className="panel" style={{ marginTop: '0.75rem' }}>
                <summary>What do these words mean?</summary>
                <div className="panel__body">
                  <p>
                    <strong>Bullish</strong>: People think the market will go up
                  </p>
                  <p>
                    <strong>Bearish</strong>: People think the market will go down
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      <hr className="rule" />

      {newsData && (
        <div>
          <h2 className="section-title">Latest News Stories</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Headline</th>
                  <th>Sentiment</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {newsData
                  .slice(0, 20)
                  .sort((a, b) => new Date(b.Date) - new Date(a.Date))
                  .map((news, idx) => (
                    <tr key={idx}>
                      <td>{news.Date?.substring(0, 10)}</td>
                      <td style={{ color: 'var(--text)' }}>{news.Headline}</td>
                      <td style={{ color: getSentimentColor(news.Sentiment), fontWeight: 700 }}>
                        {Number(news.Sentiment).toFixed(2)}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{news.Source}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">Scores are generated by AI analyzing financial news!</p>
        </div>
      )}
    </div>
  )
}

export default News
