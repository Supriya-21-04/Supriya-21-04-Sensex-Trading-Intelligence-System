import { useState, useEffect } from 'react'
import axios from 'axios'

const PaperTrading = () => {
  const [tradeLog, setTradeLog] = useState(null)
  const [testData, setTestData] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [tradeRes, testRes] = await Promise.all([
        axios.get('/api/data/ppo_trade_log.csv'),
        axios.get('/api/data/test.csv'),
      ])
      setTradeLog(tradeRes.data.data)
      setTestData(testRes.data.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>🎲 Watch Our AI Practice Trading!</h1>

      {/* Explanation */}
      <details style={{ marginBottom: '30px', backgroundColor: '#1e2130', padding: '15px', borderRadius: '10px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>
          👋 What is Paper Trading?
        </summary>
        <div style={{ marginTop: '15px', lineHeight: '1.8' }}>
          <p><strong>Paper Trading</strong> = Practicing with pretend money! 🎮</p>
          <p>Our AI uses historical data to practice buying and selling. This helps us see how well it would have done in the past - without risking any real money!</p>
        </div>
      </details>

      {/* Trade Log */}
      {tradeLog ? (
        <div>
          <h2 style={{ marginBottom: '20px' }}>📜 Recent AI Actions</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Action</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                {tradeLog.slice(-15).reverse().map((trade, idx) => (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{trade.Date?.substring(0, 10)}</td>
                    <td style={styles.td}>{trade.Action_Target}</td>
                    <td style={styles.td}>{Number(trade.Price).toFixed(2)}</td>
                    <td style={styles.td}>{Number(trade.Portfolio_Value).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#1e2130', padding: '20px', borderRadius: '10px', color: '#ffaa00' }}>
          ⚠️ Demo data missing. Please go to Settings & Tools to set it up!
        </div>
      )}
    </div>
  )
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#1e2130',
    borderRadius: '10px',
    overflow: 'hidden',
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

export default PaperTrading
