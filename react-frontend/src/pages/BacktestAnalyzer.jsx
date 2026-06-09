import { useState, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { parseTrades, getFullAnalysis } from '../utils/tradeAnalytics'
import { extractTradesFromImage } from '../utils/ocrParser'
import { extractTradesFromExcel } from '../utils/excelParser'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const fmt = (n, decimals = 2) => {
  if (n === Infinity) return '∞'
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const fmtCurrency = (n) => {
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return (n >= 0 ? '+₹' : '-₹') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
const EXCEL_EXTENSIONS = ['xlsx', 'xls']

function isImageFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

function isExcelFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return EXCEL_EXTENSIONS.includes(ext)
}

export default function BacktestAnalyzer() {
  const [trades, setTrades] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // OCR-specific state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrPreview, setOcrPreview] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = parseTrades(results.data)
          if (parsed.length < 3) {
            setError('Need at least 3 valid trades. Make sure your CSV has columns: date, type, price, quantity, pnl')
            return
          }
          setTrades(parsed)
          setAnalysis(getFullAnalysis(parsed))
        } catch (e) {
          setError('Failed to parse CSV: ' + e.message)
        }
      },
      error: (err) => setError('CSV parsing error: ' + err.message),
    })
  }, [])

  const handleImageFile = useCallback(async (file) => {
    setOcrLoading(true)
    setOcrProgress(0)
    setError(null)
    setImagePreviewUrl(URL.createObjectURL(file))

    try {
      const result = await extractTradesFromImage(file, (progress) => {
        setOcrProgress(progress)
      })

      if (result.dataRowsExtracted < 1) {
        setError('No trade data could be extracted from the image. Try a clearer screenshot.')
        setOcrLoading(false)
        setImagePreviewUrl(null)
        return
      }

      setOcrPreview(result)
    } catch (e) {
      setError('OCR failed: ' + e.message)
      setImagePreviewUrl(null)
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const handleExcelFile = useCallback(async (file) => {
    setOcrLoading(true)
    setOcrProgress(100)
    setError(null)
    setImagePreviewUrl(null)

    try {
      const result = await extractTradesFromExcel(file)

      if (result.dataRowsExtracted < 1) {
        setError('No trade data could be extracted from the Excel file.')
        setOcrLoading(false)
        return
      }

      setOcrPreview(result)
    } catch (e) {
      setError('Excel processing failed: ' + e.message)
    } finally {
      setOcrLoading(false)
    }
  }, [])

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setOcrPreview(null)
    setImagePreviewUrl(null)

    if (isImageFile(file)) {
      handleImageFile(file)
    } else if (isExcelFile(file)) {
      handleExcelFile(file)
    } else {
      handleCsvFile(file)
    }
  }, [handleCsvFile, handleImageFile, handleExcelFile])

  const confirmOcrData = useCallback(() => {
    if (!ocrPreview) return
    try {
      const parsed = parseTrades(ocrPreview.rows)
      if (parsed.length < 3) {
        setError('Only ' + parsed.length + ' valid trades extracted. Need at least 3. Try a clearer image.')
        return
      }
      setTrades(parsed)
      setAnalysis(getFullAnalysis(parsed))
      setOcrPreview(null)
      setImagePreviewUrl(null)
    } catch (e) {
      setError('Failed to process extracted data: ' + e.message)
    }
  }, [ocrPreview])

  const resetOcr = useCallback(() => {
    setOcrPreview(null)
    setOcrLoading(false)
    setOcrProgress(0)
    setImagePreviewUrl(null)
    setError(null)
  }, [])

  const handleOcrCellEdit = useCallback((rowIndex, header, value) => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const newRows = [...prev.rows]
      newRows[rowIndex] = { ...newRows[rowIndex], [header]: value }
      return { ...prev, rows: newRows }
    })
  }, [])

  const handleOcrRowDelete = useCallback((rowIndex) => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const newRows = [...prev.rows]
      newRows.splice(rowIndex, 1)
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const handleOcrRowAdd = useCallback(() => {
    setOcrPreview(prev => {
      if (!prev) return prev
      const emptyRow = {}
      prev.headers.forEach(h => emptyRow[h] = '')
      const newRows = [...prev.rows, emptyRow]
      setTimeout(() => {
        const tableContainer = document.getElementById('ocr-preview-container')
        if (tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight
      }, 50)
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e) => {
    handleFile(e.target.files[0])
  }, [handleFile])

  const loadSampleData = useCallback(() => {
    const sampleTrades = []
    const startDate = new Date('2024-01-02')
    const types = ['BUY', 'SELL']

    for (let i = 0; i < 200; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + Math.floor(i / 3))
      date.setHours(9 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60))

      const isWin = Math.random() < 0.55
      const pnl = isWin
        ? 50 + Math.random() * 300
        : -(30 + Math.random() * 200)

      sampleTrades.push({
        date: date.toISOString(),
        type: types[Math.floor(Math.random() * 2)],
        price: (100 + Math.random() * 50).toFixed(2),
        quantity: (1 + Math.floor(Math.random() * 10)).toString(),
        pnl: pnl.toFixed(2),
        volume: (100000 + Math.random() * 500000).toFixed(0),
      })
    }

    const parsed = parseTrades(sampleTrades)
    setTrades(parsed)
    setAnalysis(getFullAnalysis(parsed))
    setError(null)
  }, [])

  // Chart configs
  const pnlChartData = useMemo(() => {
    if (!analysis) return null
    return {
      labels: analysis.pnlCurve.map((_, i) => i + 1),
      datasets: [{
        label: 'Cumulative PnL',
        data: analysis.pnlCurve.map(p => p.value),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    }
  }, [analysis])

  const monteCarloData = useMemo(() => {
    if (!analysis) return null
    const mc = analysis.monteCarlo
    return {
      labels: Array.from({ length: trades.length }, (_, i) => i + 1),
      datasets: mc.simulations.slice(0, 20).map((sim, i) => ({
        label: i === 0 ? 'Simulated Paths' : '',
        data: sim.curve,
        borderColor: `hsla(${220 + i * 7}, 70%, 60%, 0.15)`,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.1,
      })).concat([{
        label: 'Actual Path',
        data: analysis.pnlCurve.map(p => p.value),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.3,
      }])
    }
  }, [analysis, trades])

  const conditionsBarData = useMemo(() => {
    if (!analysis) return null
    const byDay = analysis.conditions.byDay
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const validDays = days.filter(d => byDay[d])
    return {
      labels: validDays,
      datasets: [{
        label: 'Win Rate %',
        data: validDays.map(d => ((byDay[d].wins / byDay[d].trades) * 100)),
        backgroundColor: validDays.map(d =>
          (byDay[d].wins / byDay[d].trades) >= 0.5
            ? 'rgba(16, 185, 129, 0.65)'
            : 'rgba(239, 68, 68, 0.65)'
        ),
        borderRadius: 8,
      }]
    }
  }, [analysis])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#64748b', font: { family: 'Inter', weight: '600', size: 11 } } },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: 'rgba(99,102,241,0.15)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
      },
    },
    scales: {
      x: { grid: { color: 'rgba(15,23,42,0.03)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
      y: { grid: { color: 'rgba(15,23,42,0.03)' }, ticks: { color: '#64748b', font: { family: 'Inter' } } },
    }
  }

  // === OCR Loading Screen ===
  if (ocrLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Processing Trade Data</span>
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Analyzing sheet structures and runing OCR on images...
          </p>
        </div>

        <div className="glass-card-static p-8 text-center animate-fade-in-up rounded-2xl bg-white border border-slate-100 shadow-soft">
          {imagePreviewUrl && (
            <div className="mb-6 mx-auto" style={{ maxWidth: '400px' }}>
              <img
                src={imagePreviewUrl}
                alt="Source preview"
                className="rounded-xl w-full"
                style={{ border: '1px solid var(--color-border)', opacity: 0.6 }}
              />
            </div>
          )}

          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-6 mx-auto animate-pulse">
            <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-4 text-text-primary">
            Running Engine Analysis
          </h3>

          <div className="mx-auto mb-3" style={{ maxWidth: '300px' }}>
            <div className="progress-bar" style={{ height: '8px' }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${ocrProgress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted font-bold">
            {ocrProgress < 30 ? 'Loading Engine Components...' :
              ocrProgress < 90 ? `Processing Records... ${ocrProgress}%` :
                'Validating and Formatting Outcomes...'}
          </p>
        </div>
      </div>
    )
  }

  // === OCR Preview Screen ===
  if (ocrPreview) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Confirm Trade Data</span>
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            We've parsed {ocrPreview.dataRowsExtracted} trade entries. Check the columns and edit any value if needed.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 animate-fade-in-up">
          {imagePreviewUrl && (
            <div className="glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Original Screenshot</h4>
              <img
                src={imagePreviewUrl}
                alt="Source table"
                className="rounded-xl w-full object-contain"
                style={{ border: '1px solid var(--color-border)', maxHeight: '350px' }}
              />
            </div>
          )}
          <div className={`glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft ${imagePreviewUrl ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
              Parsed Spreadsheet ({ocrPreview.dataRowsExtracted} rows)
            </h4>
            <div id="ocr-preview-container" style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr className="border-b border-slate-100">
                    <th style={thStyle}>#</th>
                    {ocrPreview.headers.map((h, i) => (
                      <th key={i} style={{
                        ...thStyle,
                        color: ['date', 'type', 'price', 'quantity', 'pnl'].includes(h)
                          ? 'var(--color-accent)' : 'var(--color-text-muted)'
                      }}>
                        {h.toUpperCase()}
                        {['date', 'type', 'price', 'quantity', 'pnl'].includes(h) && ' ✓'}
                      </th>
                    ))}
                    <th style={{ ...thStyle, width: '32px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {ocrPreview.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      {ocrPreview.headers.map((h, j) => (
                        <td key={j} style={{ ...tdStyle, padding: '4px 8px' }}>
                          <input
                            type="text"
                            value={row[h] !== undefined && row[h] !== null ? row[h] : ''}
                            onChange={(e) => handleOcrCellEdit(i, h, e.target.value)}
                            title="Click to edit value"
                            style={{
                              background: 'transparent',
                              border: '1px solid transparent',
                              color: h === 'pnl'
                                ? (parseFloat(row[h]) >= 0 ? '#10b981' : '#ef4444')
                                : 'var(--color-text-secondary)',
                              width: '100%',
                              minWidth: '65px',
                              outline: 'none',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                            }}
                            onFocus={(e) => {
                              e.target.style.background = 'var(--color-bg-secondary)'
                              e.target.style.border = '1px solid var(--color-border)'
                            }}
                            onBlur={(e) => {
                              e.target.style.background = 'transparent'
                              e.target.style.border = '1px solid transparent'
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px' }}>
                        <button
                          onClick={() => handleOcrRowDelete(i)}
                          title="Delete Row"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 border border-slate-100 hover:border-rose-100"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-5 mb-2 flex justify-center">
                <button
                  onClick={handleOcrRowAdd}
                  className="px-4 py-2 text-xs font-bold rounded-xl hover:bg-indigo-50 border border-dashed border-indigo-200 text-indigo-600 transition-colors"
                >
                  + Add Trade Row
                </button>
              </div>

              {ocrPreview.rows.length > 50 && (
                <p className="text-xs text-text-muted mt-2 font-medium">
                  Showing first 50 of {ocrPreview.rows.length} rows
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl animate-fade-in flex items-center gap-3 bg-rose-50 border border-rose-100">
            <svg className="w-5 h-5 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-semibold text-rose-600">{error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center animate-fade-in-up">
          <button onClick={resetOcr}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
            ← Reset upload
          </button>
          <button onClick={confirmOcrData} className="glow-btn px-6 py-3 rounded-xl font-bold flex items-center gap-1.5 shadow-soft" id="confirm-ocr-btn">
            <span>✓</span> Confirm & Analyze {ocrPreview.dataRowsExtracted} Trades
          </button>
        </div>

        <div className="mt-8 glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
          <details>
            <summary className="text-sm font-bold cursor-pointer text-text-secondary outline-none select-none">
              View Raw Extracted Text
            </summary>
            <pre className="mt-4 text-[10px] p-4 rounded-xl overflow-auto bg-slate-950 text-slate-300 font-mono" style={{ maxHeight: '180px', whiteSpace: 'pre-wrap' }}>
              {ocrPreview.rawText}
            </pre>
          </details>
        </div>
      </div>
    )
  }

  // === Upload Screen ===
  if (!analysis) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-10 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Backtest Analyzer</span>
          </h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Upload your trade history records and retrieve advanced risk-adjusted diagnostic statistics
          </p>
        </div>

        <div className="space-y-8 animate-fade-in-up">
          {/* Onboarding Guide (Horizontal 3-column Layout) */}
          <div className="glass-card-static p-8 border border-slate-100 bg-white shadow-soft rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2.5 text-text-primary">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              How to use Backtest Analyzer
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed font-medium">
              Upload your trade history records and retrieve advanced risk-adjusted diagnostic statistics.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100" style={{ fontSize: '0.85rem' }}>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">1. Select Format</strong>
                <span className="text-text-muted leading-relaxed font-medium">Upload CSV tables, Excel spreadsheets, or screenshots of your broker's dashboard (processed via local OCR).</span>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">2. Required Columns</strong>
                <span className="text-text-muted leading-relaxed font-medium">
                  Ensure your sheet includes: <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-indigo-650 font-mono">date</code>, <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-indigo-650 font-mono">type</code>, <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-indigo-650 font-mono">price</code>, <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-indigo-650 font-mono">quantity</code>, and <code className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-indigo-650 font-mono">pnl</code>.
                </span>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">3. Analyze Output</strong>
                <span className="text-text-muted leading-relaxed font-medium">Click submit to view profit curves, direction bias, drawdown diagnostics, and Monte Carlo curves.</span>
              </div>
            </div>
          </div>

          {/* Upload Zone Card */}
          <div className="glass-card-static p-8 border border-slate-100 bg-white shadow-soft rounded-2xl relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2">
                <div
                  className={`upload-zone flex flex-col items-center justify-center cursor-pointer border-2 border-dashed rounded-2xl bg-white transition-all duration-300 py-10 px-6 ${
                    dragOver 
                      ? 'border-indigo-500 bg-indigo-50/10 shadow-glow' 
                      : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/30'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('csv-input').click()}
                  id="upload-zone"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                    <svg className="w-7 h-7 text-slate-400 group-hover:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold mb-1 text-slate-800">Drag & Drop Trade File</h3>
                  <p className="text-xs mb-4 text-text-muted font-medium">or click here to browse files</p>
                  <div className="flex gap-2 justify-center">
                    <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                      CSV / EXCEL
                    </span>
                    <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                      SCREENSHOT (OCR)
                    </span>
                  </div>
                  <input
                    id="csv-input"
                    type="file"
                    accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.bmp,.gif"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center text-center p-4 border-l border-slate-100 md:h-full">
                <p className="text-xs text-text-muted mb-4 font-semibold max-w-[200px]">
                  Don't have a dataset? Try our simulation model to explore diagnostics.
                </p>
                <button onClick={loadSampleData} className="glow-btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2" id="load-sample-btn">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  Load Sample Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl animate-fade-in flex items-center gap-3 bg-rose-50 border border-rose-100">
            <svg className="w-5 h-5 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <p className="text-sm font-semibold text-rose-650">{error}</p>
          </div>
        )}
      </div>
    )
  }

  const tabs = [
    { 
      id: 'overview', 
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    { 
      id: 'pnl', 
      label: 'PnL Curve',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      )
    },
    { 
      id: 'montecarlo', 
      label: 'Monte Carlo',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
          <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
          <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
        </svg>
      )
    },
    { 
      id: 'conditions', 
      label: 'Conditions',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
  ]

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 animate-fade-in-up">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
            <span className="gradient-text">Backtest Results</span>
          </h1>
          <p className="text-sm font-semibold text-text-secondary">
            Analysis complete for {analysis.totalTrades} historical trades
          </p>
        </div>
        <button
          onClick={() => { setTrades(null); setAnalysis(null); resetOcr() }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white border border-slate-200 text-text-secondary hover:text-text-primary hover:border-slate-350 shadow-soft hover:shadow transition-all self-start sm:self-center"
        >
          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Upload New Dataset
        </button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {[
          { 
            label: 'Win Rate', 
            value: `${fmt(analysis.winRate, 1)}%`, 
            color: analysis.winRate >= 50 ? '#10b981' : '#ef4444', 
            bg: analysis.winRate >= 50 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            )
          },
          { 
            label: 'Total PnL', 
            value: fmtCurrency(analysis.totalPnL), 
            color: analysis.totalPnL >= 0 ? '#10b981' : '#ef4444', 
            bg: analysis.totalPnL >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 3h12M6 8h12M6 3a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5h12M9 13l9 8" />
              </svg>
            )
          },
          { 
            label: 'Profit Factor', 
            value: fmt(analysis.profitFactor), 
            color: analysis.profitFactor >= 1.5 ? '#10b981' : analysis.profitFactor >= 1 ? '#f59e0b' : '#ef4444', 
            bg: analysis.profitFactor >= 1.5 ? 'rgba(16,185,129,0.08)' : analysis.profitFactor >= 1 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M6 21h12M3 7l9-2 9 2M6 10c0 3 3 3 3 3s3 0 3-3M12 10c0 3 3 3 3 3s3 0 3-3" />
              </svg>
            )
          },
          { 
            label: 'Sharpe Ratio', 
            value: fmt(analysis.sharpeRatio), 
            color: analysis.sharpeRatio >= 1 ? '#10b981' : '#f59e0b', 
            bg: analysis.sharpeRatio >= 1 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )
          },
          { 
            label: 'Max Drawdown', 
            value: `₹${fmt(analysis.maxDrawdown, 0)}`, 
            color: '#ef4444', 
            bg: 'rgba(239,68,68,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
              </svg>
            )
          },
          { 
            label: 'Avg Win / Loss', 
            value: `${fmt(analysis.avgWin, 0)} / ${fmt(analysis.avgLoss, 0)}`, 
            color: 'var(--color-text-secondary)', 
            bg: 'rgba(148,163,184,0.08)',
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5M4 20L21 3M21 20l-7-7M4 4l5 5" />
              </svg>
            )
          },
        ].map((stat, i) => (
          <div key={stat.label} className={`stat-card flex items-center justify-between p-6 border border-slate-100 shadow-soft rounded-2xl bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-fade-in-up stagger-${i + 1}`}>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5 text-text-muted">{stat.label}</p>
              <p className="text-2xl font-extrabold text-slate-800" style={{ color: stat.color }}>{stat.value}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-100/50" style={{ color: stat.color, backgroundColor: stat.bg }}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-slate-100 select-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-soft' 
                : 'bg-white hover:bg-slate-50 text-text-muted hover:text-text-secondary border-slate-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
                Trade Outcomes Distribution
              </h3>
              <div className="text-sm space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-emerald-600">Winners ({analysis.winCount})</span>
                    <span className="text-text-muted">{fmt(analysis.winRate, 1)}%</span>
                  </div>
                  <div className="progress-bar bg-slate-100 rounded-full" style={{ height: '8px' }}>
                    <div className="progress-bar-fill rounded-full" style={{ width: `${analysis.winRate}%`, backgroundColor: '#10b981' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-rose-600">Losers ({analysis.lossCount})</span>
                    <span className="text-text-muted">{fmt(100 - analysis.winRate, 1)}%</span>
                  </div>
                  <div className="progress-bar bg-slate-100 rounded-full" style={{ height: '8px' }}>
                    <div className="progress-bar-fill rounded-full" style={{ width: `${100 - analysis.winRate}%`, backgroundColor: '#ef4444' }} />
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-dashed grid grid-cols-2 gap-6 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-xs font-bold text-text-muted mb-1">Average Profit per Win</p>
                  <p className="text-xl font-extrabold text-emerald-600">{fmtCurrency(analysis.avgWin)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-text-muted mb-1">Average Loss per Defeat</p>
                  <p className="text-xl font-extrabold text-rose-600">{fmtCurrency(analysis.avgLoss)}</p>
                </div>
              </div>
            </div>
            
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Risk & Performance Metrics
              </h3>
              <div className="text-sm space-y-3">
                {[
                  { label: 'Sharpe Ratio', value: fmt(analysis.sharpeRatio), good: analysis.sharpeRatio >= 1 },
                  { label: 'Profit Factor', value: fmt(analysis.profitFactor), good: analysis.profitFactor >= 1.5 },
                  { label: 'Max Drawdown', value: `₹${fmt(analysis.maxDrawdown, 0)} (${fmt(analysis.maxDrawdownPct, 1)}%)`, good: false },
                  { label: 'Max Win Streak', value: `${analysis.conditions.maxWinStreak} consecutive wins`, good: true },
                  { label: 'Max Loss Streak', value: `${analysis.conditions.maxLossStreak} consecutive losses`, good: false },
                  { label: 'Risk:Reward Ratio', value: analysis.avgLoss !== 0 ? fmt(Math.abs(analysis.avgWin / analysis.avgLoss)) + ':1' : '—', good: Math.abs(analysis.avgWin / analysis.avgLoss) >= 1.5 },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2.5 border-b border-dashed border-slate-100 last:border-0">
                    <span className="font-semibold text-text-secondary">{item.label}</span>
                    <span className="font-extrabold text-slate-800" style={{ color: item.good ? '#10b981' : undefined }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pnl' && pnlChartData && (
          <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft animate-fade-in relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
              Cumulative Profit Curve
            </h3>
            <div className="chart-container" style={{ height: '440px', position: 'relative' }}>
              <Line data={pnlChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {activeTab === 'montecarlo' && monteCarloData && (
          <div className="space-y-8 animate-fade-in">
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
                </svg>
                Monte Carlo Simulation (1,000 paths)
              </h3>
              <div className="chart-container" style={{ height: '440px', position: 'relative' }}>
                <Line data={monteCarloData} options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, legend: { display: false } }
                }} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Profitable Paths', value: `${fmt(analysis.monteCarlo.profitablePct, 1)}%`, color: analysis.monteCarlo.profitablePct >= 70 ? '#10b981' : '#f59e0b' },
                { label: 'Median Outcome', value: fmtCurrency(analysis.monteCarlo.percentiles.p50), color: analysis.monteCarlo.percentiles.p50 >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Worst 5% Outcome', value: fmtCurrency(analysis.monteCarlo.percentiles.p5), color: '#ef4444' },
                { label: 'Best 5% Outcome', value: fmtCurrency(analysis.monteCarlo.percentiles.p95), color: '#10b981' },
              ].map(stat => (
                <div key={stat.label} className="stat-card p-5 border border-slate-100 rounded-2xl bg-white shadow-soft hover:shadow-md transition-all">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider mb-2 text-text-muted">{stat.label}</p>
                  <p className="text-xl font-extrabold text-slate-800" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Premium Simulation Diagnostic Box */}
            <div className={`p-6 rounded-2xl border flex gap-4 items-start ${
              analysis.monteCarlo.profitablePct >= 70
                ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800'
                : analysis.monteCarlo.profitablePct >= 50
                  ? 'bg-amber-50/40 border-amber-100 text-amber-800'
                  : 'bg-rose-50/40 border-rose-100 text-rose-800'
            }`}>
              <div className="shrink-0 p-2 rounded-xl bg-white/80 border border-slate-100 shadow-sm mt-0.5">
                {analysis.monteCarlo.profitablePct >= 70 ? (
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : analysis.monteCarlo.profitablePct >= 50 ? (
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h4 className="text-base font-extrabold mb-1.5 text-slate-800">Simulation Diagnosis</h4>
                <p className="text-sm leading-relaxed font-semibold text-slate-600">
                  {analysis.monteCarlo.profitablePct >= 70
                    ? 'Robust System: Over 70% of randomized paths finish in profit. This suggests the strategy possesses a strong statistical edge and is highly resilient to order-of-execution luck.'
                    : analysis.monteCarlo.profitablePct >= 50
                      ? 'Moderate Edge: Over 50% of paths are profitable, but there is significant dispersion. Tighter risk parameters or a larger trade sample size is recommended to confirm viability.'
                      : 'Fragile Profile: Less than 50% of random simulations finished in profit. Your historical gains may be due to a lucky string of trades rather than a persistent edge.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conditions' && conditionsBarData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Win Rate by Day of Week
              </h3>
              <div className="chart-container" style={{ height: '340px', position: 'relative' }}>
                <Bar data={conditionsBarData} options={{
                  ...chartOptions,
                  plugins: { ...chartOptions.plugins, legend: { display: false } }
                }} />
              </div>
            </div>
            
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="21 16 21 21 16 21" /><polyline points="3 8 3 3 8 3" /><line x1="3" y1="3" x2="21" y2="21" />
                </svg>
                Performance by Trade Direction
              </h3>
              <div className="space-y-4">
                {Object.entries(analysis.conditions.byType).map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/70">
                    <div>
                      <span className="font-extrabold text-sm text-slate-800">{type} Positions</span>
                      <span className="text-xs block text-text-muted mt-1 font-bold">{data.trades} trades executed</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm block" style={{ color: (data.wins / data.trades) >= 0.5 ? '#10b981' : '#ef4444' }}>
                        {fmt((data.wins / data.trades) * 100, 1)}% Win Rate
                      </span>
                      <span className="text-xs font-bold text-slate-500 block mt-1">
                        Net: {fmtCurrency(data.totalPnl)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="glass-card-static p-8 md:col-span-2 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-6 text-text-primary flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Performance by Trade Size (Volume)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(analysis.conditions.bySize).map(([size, data]) => (
                  <div key={size} className="text-center p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                    <p className="font-extrabold text-sm mb-1 text-slate-800 uppercase tracking-wide text-[11px]">{size} Position Scale</p>
                    <p className="text-xs mb-4 text-text-muted font-bold">{data.trades} trades analyzed</p>
                    <p className="text-2xl font-extrabold text-slate-800" style={{ color: (data.wins / Math.max(data.trades, 1)) >= 0.5 ? '#10b981' : '#ef4444' }}>
                      {data.trades > 0 ? fmt((data.wins / data.trades) * 100, 1) : 0}% <span className="text-xs font-bold text-text-muted">WR</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Table styles for OCR preview
const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  fontWeight: 700,
  fontSize: '0.72rem',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: '#ffffff',
}

const tdStyle = {
  padding: '8px 16px',
  whiteSpace: 'nowrap',
  fontSize: '0.85rem',
  fontWeight: '600',
  color: 'var(--color-text-secondary)',
}
