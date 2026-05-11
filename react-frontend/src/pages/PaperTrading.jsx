import { useState, useEffect } from 'react'
import axios from 'axios'

const PaperTrading = () => {
  const [tradeLog, setTradeLog] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tradeRes] = await Promise.all([
        axios.get('/api/data/ppo_trade_log.csv'),
        axios.get('/api/data/test.csv'),
      ])
      setTradeLog(tradeRes.data.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">🎲 Watch Our AI Practice Trading!</h1>
      </header>

      <details className="panel">
        <summary>👋 What is Paper Trading?</summary>
        <div className="panel__body">
          <p>
            <strong>Paper Trading</strong> = Practicing with pretend money! 🎮
          </p>
          <p>
            Our AI uses historical data to practice buying and selling. This helps us see how well it would have done in
            the past - without risking any real money!
          </p>
        </div>
      </details>

      {tradeLog ? (
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            📜 Recent AI Actions
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                {tradeLog
                  .slice(-15)
                  .reverse()
                  .map((trade, idx) => (
                    <tr key={idx}>
                      <td>{trade.Date?.substring(0, 10)}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              String(trade.Action_Target).toUpperCase().includes('BUY')
                                ? '#34d399'
                                : String(trade.Action_Target).toUpperCase().includes('SELL')
                                  ? '#fb7185'
                                  : 'var(--text)',
                          }}
                        >
                          {trade.Action_Target}
                        </span>
                      </td>
                      <td>{Number(trade.Price).toFixed(2)}</td>
                      <td>{Number(trade.Portfolio_Value).toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="alert alert--warn">
          ⚠️ Demo data missing. Please go to Run Pipeline to set it up!
        </div>
      )}
    </div>
  )
}

export default PaperTrading
