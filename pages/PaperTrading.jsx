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
        axios.get('/api/data/ppo_trade_log.csv').catch(() => ({ data: { data: null } })),
        axios.get('/api/data/test.csv').catch(() => ({ data: { data: null } })),
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
        <h1 className="page__title">Watch Our AI Practice Trading!</h1>
      </header>

      <details className="panel">
        <summary>What is Paper Trading?</summary>
        <div className="panel__body">
          <p>
            <strong>Paper Trading</strong> = Practicing with pretend money!
          </p>
          <p>
            Our AI uses historical data to practice buying and selling. This helps us see how well it would have done in
            the past - without risking any real money!
          </p>
        </div>
      </details>

      {tradeLog ? (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Completed Trades</div>
              <div style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--accent)' }}>{completedTrades.length}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Final Simulated Portfolio</div>
              <div style={{ fontSize: '2.25rem', fontWeight: '800', color: finalPortfolio >= 100000 ? 'var(--success)' : 'var(--danger)' }}>
                ₹{finalPortfolio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Completed Trade Cycles
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
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              color: trade.type === 'LONG' ? 'var(--success)' : 'var(--danger)',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              backgroundColor: trade.type === 'LONG' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'
                            }}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{trade.entryDate}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>₹{trade.entryPrice.toFixed(2)}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{trade.closeDate}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>₹{trade.closePrice.toFixed(2)}</div>
                        </td>
                        <td style={{ fontWeight: 700, color: trade.pnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text)' }}>
                          ₹{trade.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  {completedTrades.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)' }}>
                        No completed trades yet. Run the pipeline to generate trading activity.
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
          Demo data missing. Please go to Run Pipeline to set it up!
        </div>
      )}
    </div>
  )
}

export default PaperTrading
