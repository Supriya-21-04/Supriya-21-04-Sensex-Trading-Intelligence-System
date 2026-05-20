import { useState, useEffect, useMemo } from 'react'
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

  const { completedTrades, finalPortfolio } = useMemo(() => {
    if (!tradeLog || tradeLog.length === 0) return { completedTrades: [], finalPortfolio: 100000 };

    const trades = [];
    let currentTrade = null;
    let finalPort = 100000;

    tradeLog.forEach((row, index) => {
      const state = parseInt(row.Position_State);
      const price = parseFloat(row.Price);
      const date = row.Date?.substring(0, 10);
      const portfolio = parseFloat(row.Portfolio_Value);
      finalPort = portfolio;

      if (currentTrade && currentTrade.state !== state) {
        const pnl = portfolio - currentTrade.portfolioAtEntry;

        trades.push({
          type: currentTrade.state === 1 ? 'LONG' : 'SHORT',
          entryDate: currentTrade.entryDate,
          entryPrice: currentTrade.entryPrice,
          closeDate: date,
          closePrice: price,
          pnl: pnl,
          portfolioValue: portfolio
        });

        currentTrade = null;
      }

      if (!currentTrade && state !== 0) {
        currentTrade = {
          state: state,
          entryDate: date,
          entryPrice: price,
          portfolioAtEntry: index > 0 ? parseFloat(tradeLog[index - 1].Portfolio_Value) : 100000
        };
      }
    });

    return { completedTrades: trades, finalPortfolio: finalPort };
  }, [tradeLog]);

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
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Completed Trades</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{completedTrades.length}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Final Simulated Portfolio</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: finalPortfolio >= 100000 ? '#34d399' : '#fb7185' }}>
                ₹{finalPortfolio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              📜 Completed Trade Cycles
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trade Type</th>
                    <th>Entry</th>
                    <th>Close</th>
                    <th>Trade PnL</th>
                    <th>Total Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {completedTrades
                    .slice()
                    .reverse()
                    .map((trade, idx) => (
                      <tr key={idx}>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: trade.type === 'LONG' ? '#34d399' : '#fb7185',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: trade.type === 'LONG' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 113, 133, 0.1)'
                            }}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td>
                          <div>{trade.entryDate}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{trade.entryPrice.toFixed(2)}</div>
                        </td>
                        <td>
                          <div>{trade.closeDate}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{trade.closePrice.toFixed(2)}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: trade.pnl >= 0 ? '#34d399' : '#fb7185' }}>
                          {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          ₹{trade.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  {completedTrades.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No completed trades yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="alert alert--warn">
          ⚠️ Demo data missing. Please go to Run Pipeline to set it up!
        </div>
      )}
    </div>
  )
}

export default PaperTrading
