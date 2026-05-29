import { useState, useCallback, useRef, useMemo } from 'react'
import Papa from 'papaparse'
import { parseTrades } from '../utils/tradeAnalytics'
import { testSignal } from '../utils/signalEngine'
import { queryGemini } from '../utils/geminiClient'
import { extractTradesFromImage } from '../utils/ocrParser'
import { extractTradesFromExcel } from '../utils/excelParser'

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

export default function SignalTester() {
  const [trades, setTrades] = useState(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [aiResponse, setAiResponse] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [dataStats, setDataStats] = useState(null)
  const chatEndRef = useRef(null)

  // OCR-specific state
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrPreview, setOcrPreview] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const handleCsvFile = useCallback((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = parseTrades(results.data)
        if (parsed.length < 10) {
          setError('Need at least 10 trades for signal testing')
          return
        }
        setTrades(parsed)
        const hasVol = parsed.some(t => t.volume != null && t.volume > 0)
        const hasDur = parsed.some(t => t.duration != null && t.duration > 0)
        setDataStats({ hasVolume: hasVol, hasDuration: hasDur })
        setError(null)
      }
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

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e) => {
    handleFile(e.target.files[0])
  }, [handleFile])

  const statsSummary = useMemo(() => {
    if (!trades) return { total: 0, winRate: 0, totalPnl: 0 }
    const total = trades.length
    const wins = trades.filter(t => t.pnl > 0).length
    const winRate = total > 0 ? (wins / total) * 100 : 0
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    return { total, winRate, totalPnl }
  }, [trades])

  const confirmOcrData = useCallback(() => {
    if (!ocrPreview) return
    try {
      const parsed = parseTrades(ocrPreview.rows)
      if (parsed.length < 10) {
        setError('Only ' + parsed.length + ' valid trades extracted. Need at least 10.')
        return
      }
      setTrades(parsed)
      const hasVol = parsed.some(t => t.volume != null && t.volume > 0)
      const hasDur = parsed.some(t => t.duration != null && t.duration > 0)
      setDataStats({ hasVolume: hasVol, hasDuration: hasDur })
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
      return { ...prev, rows: newRows, dataRowsExtracted: newRows.length }
    })
  }, [])

  const loadSample = useCallback(() => {
    const sampleTrades = []
    const startDate = new Date('2024-01-02')
    for (let i = 0; i < 200; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + Math.floor(i / 3))
      date.setHours(9 + Math.floor(Math.random() * 7), Math.floor(Math.random() * 60))
      const isMonday = date.getDay() === 1
      const isMorning = date.getHours() < 12
      const winBias = isMonday ? 0.65 : isMorning ? 0.60 : 0.50
      const isWin = Math.random() < winBias
      sampleTrades.push({
        date: date.toISOString(),
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: (100 + Math.random() * 50).toFixed(2),
        quantity: (1 + Math.floor(Math.random() * 10)).toString(),
        pnl: (isWin ? 50 + Math.random() * 300 : -(30 + Math.random() * 200)).toFixed(2),
        volume: (100000 + Math.random() * 500000).toFixed(0),
      })
    }
    setTrades(parseTrades(sampleTrades))
    setDataStats({ hasVolume: true, hasDuration: false })
    setError(null)
  }, [])

  const runTest = useCallback(async () => {
    if (!query.trim() || !trades) return
    setLoading(true)
    setResult(null)
    setAiResponse(null)
    setError(null)

    // First try keyword-based signal engine
    const signalResult = testSignal(query, trades)

    if (!signalResult.error) {
      // Keyword match found — show structured result
      setResult(signalResult)
      setChatHistory(prev => [...prev, {
        type: 'signal',
        query: query,
        result: signalResult,
        timestamp: new Date(),
      }])
      setLoading(false)
      setQuery('') // Clear input
    } else {
      // No keyword match — use Gemini AI
      try {
        const geminiResult = await queryGemini(query, trades, chatHistory)
        setAiResponse(geminiResult.answer)
        setChatHistory(prev => [...prev, {
          type: 'ai',
          query: query,
          answer: geminiResult.answer,
          timestamp: new Date(),
        }])
        setQuery('') // Clear input
      } catch (e) {
        setError('AI analysis failed: ' + e.message)
      } finally {
        setLoading(false)
      }
    }

    // Scroll to bottom of chat
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [query, trades, chatHistory])

  const confidenceColors = {
    'Very High': '#10b981',
    'High': '#34d399',
    'Moderate': '#f59e0b',
    'Low': '#ef4444',
  }

  // Simple markdown renderer for AI responses
  const renderMarkdown = (text) => {
    if (!text) return null
    const lines = text.split('\n')
    const elements = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h4 key={i} className="text-base font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(4)}</h4>)
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(3)}</h3>)
      } else if (line.startsWith('# ')) {
        elements.push(<h2 key={i} className="text-xl font-bold mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{line.slice(2)}</h2>)
      }
      // Bullet points
      else if (line.match(/^[-*]\s/)) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 mb-1">
            <span className="text-indigo-500">•</span>
            <span style={{ color: 'var(--color-text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
          </div>
        )
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      }
      // Regular paragraph
      else {
        elements.push(
          <p key={i} className="mb-2 text-sm leading-relaxed text-text-secondary"
            dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        )
      }
    }
    return elements
  }

  // Format inline markdown (bold, code)
  const formatInline = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--color-text-primary)">$1</strong>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,0.15);padding:1px 6px;border-radius:4px;font-size:0.85em;color:var(--color-accent-light)">$1</code>')
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
            Running OCR Scanner
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
            <p className="text-sm font-semibold text-rose-650">{error}</p>
          </div>
        )}

        <div className="flex gap-4 justify-center animate-fade-in-up">
          <button onClick={resetOcr}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
            ← Reset upload
          </button>
          <button onClick={confirmOcrData} className="glow-btn px-6 py-3 rounded-xl font-bold flex items-center gap-1.5 shadow-soft">
            <span>✓</span> Confirm & Analyze {ocrPreview.dataRowsExtracted} Trades
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">AI Signal Tester</span>
        </h1>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Ask natural-language questions about your trade parameters and retrieve AI insights with statistical validation
        </p>
      </div>

      {/* Data upload */}
      {!trades ? (
        <div className="space-y-8 animate-fade-in-up">
          {/* Onboarding Guide (Horizontal 3-column Layout) */}
          <div className="glass-card-static p-8 border border-slate-100 bg-white shadow-soft rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2.5 text-text-primary">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              How to use AI Signal Tester
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed font-medium">
              Ask natural-language questions about your trade parameters and retrieve AI insights with statistical validation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100" style={{ fontSize: '0.85rem' }}>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">1. Upload Data</strong>
                <span className="text-text-muted leading-relaxed font-medium">Drag and drop your trade CSV, Excel spreadsheet, or screenshot image on the zone below.</span>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">2. Formulate Questions</strong>
                <span className="text-text-muted leading-relaxed font-medium">Type a custom query (e.g., "Do I win more on Mondays?") or click the example chips below the chat box.</span>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 font-bold block mb-1">3. Retrieve Insights</strong>
                <span className="text-text-muted leading-relaxed font-medium">The assistant calculates win rates, averages, and verifies significance levels dynamically.</span>
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
                  Don't have a dataset? Try our simulation model to explore AI diagnostics.
                </p>
                <button onClick={loadSample} className="glow-btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2" id="signal-sample-btn">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  Load Sample Data
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-8 items-start">
          {/* Left Column: Sidebar stats */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2 text-text-primary border-b pb-3">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>
                Dataset Overview
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                  <span className="text-text-muted font-medium">Total Trades</span>
                  <span className="font-extrabold text-text-primary">{statsSummary.total}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                  <span className="text-text-muted font-medium">Win Rate</span>
                  <span className="font-extrabold" style={{ color: statsSummary.winRate >= 50 ? '#10b981' : '#ef4444' }}>
                    {statsSummary.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                  <span className="text-text-muted font-medium">Net Return</span>
                  <span className="font-extrabold" style={{ color: statsSummary.totalPnl >= 0 ? '#10b981' : '#ef4444' }}>
                    {statsSummary.totalPnl >= 0 ? '₹' : '-₹'}{Math.abs(statsSummary.totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-600 border border-green-100 flex items-center gap-1">
                  <span>✓</span> Active Data
                </span>
                {dataStats?.hasVolume && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                    Volume
                  </span>
                )}
                {dataStats?.hasDuration && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-600 border border-cyan-100">
                    Duration
                  </span>
                )}
              </div>
              <button 
                onClick={() => { setTrades(null); setResult(null); setAiResponse(null); setChatHistory([]); setDataStats(null); resetOcr() }}
                className="mt-8 w-full py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 hover:text-text-primary transition-all text-text-muted flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                Upload Different Dataset
              </button>
            </div>
            
            {/* Guide Suggestions */}
            <div className="glass-card-static p-8 bg-slate-50/50 border border-slate-100 shadow-soft rounded-2xl relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h4 className="text-sm font-bold mb-4 text-text-primary flex items-center gap-1.5">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Analysis Suggestions
              </h4>
              <ul className="text-xs space-y-4 text-text-muted leading-relaxed pl-1">
                <li className="flex gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <div>
                    <strong>Weekday Bias:</strong>
                    <p className="mt-0.5 text-[11px] text-slate-500">"Do I win more on Mondays?"</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <div>
                    <strong>Intraday Timing:</strong>
                    <p className="mt-0.5 text-[11px] text-slate-500">"What time of day should I trade?"</p>
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <div>
                    <strong>Logical Diagnostics:</strong>
                    <p className="mt-0.5 text-[11px] text-slate-500">"What are my biggest weaknesses?"</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Chat Console */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="glass-card-static p-8 flex flex-col justify-between shadow-soft rounded-2xl bg-white border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all duration-300" style={{ minHeight: '620px' }}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <h3 className="text-base font-bold mb-5 border-b pb-4 flex items-center gap-2 text-text-primary">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                AI Signal Analyst Console
              </h3>
              
              {/* Scrollable messages area */}
              <div className="flex-grow overflow-y-auto mb-8 pr-2 space-y-8 animate-fade-in" style={{ maxHeight: '420px', minHeight: '320px' }}>
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 border border-indigo-100/50">
                      <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1.73-1.99L12 2.8 4.73 6.01A2 2 0 0 0 3 8v8a2 2 0 0 0 1.73 1.99L12 21.2l7.27-3.2A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                    </div>
                    <p className="text-base font-bold mb-1.5 text-text-primary">
                      Analyst Assistant Online
                    </p>
                    <p className="text-xs max-w-[340px] leading-relaxed text-text-muted font-medium">
                      Type your trade query below, or select any of the suggestion chips to query your data.
                    </p>
                  </div>
                ) : (
                  chatHistory.map((entry, idx) => (
                    <div key={idx} className="space-y-4">
                      {/* User query */}
                      <div className="flex justify-end">
                        <div className="px-5 py-3 rounded-2xl rounded-tr-sm text-sm max-w-[80%] font-semibold bg-indigo-650 text-white shadow-soft">
                          {entry.query}
                        </div>
                      </div>
 
                      {/* AI/Signal response */}
                      <div className="flex justify-start">
                        {entry.type === 'ai' ? (
                          <div className="glass-card-static p-6 max-w-[95%] w-full border-l-4 border-l-indigo-600 shadow-soft rounded-2xl bg-white">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                              <span className="text-[10px] px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                AI Analysis
                              </span>
                              <button onClick={() => navigator.clipboard.writeText(entry.answer)}
                                className="text-xs font-bold text-text-muted hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                                title="Copy analysis">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.75rem', height: '0.75rem', display: 'inline-block' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                                </svg>
                                <span>Copy</span>
                              </button>
                            </div>
                            <div className="text-sm space-y-2">{renderMarkdown(entry.answer)}</div>
                          </div>
                        ) : entry.type === 'signal' && entry.result.type === 'comparison' ? (
                          <div className="glass-card-static p-6 max-w-[95%] w-full border-l-4 border-l-green-500 shadow-soft rounded-2xl bg-white">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                              <span className="text-[10px] px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Signal Analysis
                              </span>
                              <button onClick={() => navigator.clipboard.writeText(`Signal Result: ${entry.result.verdict}\nConfidence: ${entry.result.confidence}\n${entry.result.groupA.label}: ${entry.result.groupA.winRate.toFixed(1)}% Win Rate\n${entry.result.groupB.label}: ${entry.result.groupB.winRate.toFixed(1)}% Win Rate`)}
                                className="text-xs font-bold text-text-muted hover:text-emerald-600 transition-colors flex items-center gap-1.5"
                                title="Copy result">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.75rem', height: '0.75rem', display: 'inline-block' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                                </svg>
                                <span>Copy</span>
                              </button>
                            </div>
                            <div className="flex items-start gap-4 mb-5 bg-slate-50/40 p-4 rounded-xl border border-slate-100">
                              <div className="shrink-0 mt-0.5">
                                {entry.result.verdict.startsWith('YES') ? (
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-extrabold text-sm">✓</div>
                                ) : entry.result.verdict.startsWith('MAYBE') ? (
                                  <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-extrabold text-sm">?</div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-extrabold text-sm">✕</div>
                                )}
                              </div>
                              <div>
                                <h3 className="text-base font-extrabold leading-tight text-text-primary">
                                  {entry.result.verdict}
                                </h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs font-bold" style={{ color: confidenceColors[entry.result.confidence] }}>
                                    Confidence: {entry.result.confidence}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold bg-slate-150/70 px-2 py-0.5 rounded text-text-muted">
                                    p-val: {entry.result.pValue.toFixed(4)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[entry.result.groupA, entry.result.groupB].map((group, i) => (
                                <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70">
                                  <p className="text-xs font-extrabold uppercase tracking-wider mb-2 text-text-primary">{group.label}</p>
                                  <p className="text-sm font-semibold mb-3">
                                    {group.trades} trades • 
                                    <span className="font-extrabold" style={{ color: group.winRate >= 50 ? '#10b981' : '#ef4444' }}>
                                      {' '}{group.winRate.toFixed(1)}% WR
                                    </span>
                                  </p>
                                  <p className="text-xs text-text-muted mb-3 font-semibold">
                                    Avg Return: <span className="font-bold" style={{ color: group.avgPnl >= 0 ? '#10b981' : '#ef4444' }}>
                                      {group.avgPnl >= 0 ? '₹' : '-₹'}{Math.abs(group.avgPnl).toFixed(2)}
                                    </span> per trade
                                  </p>
                                  <div className="h-2 w-full rounded-full overflow-hidden bg-slate-200">
                                    <div className="h-full rounded-full transition-all duration-1000" style={{
                                      width: `${Math.min(100, Math.max(0, group.winRate))}%`,
                                      backgroundColor: group.winRate >= 50 ? '#10b981' : '#ef4444'
                                    }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : entry.type === 'signal' && entry.result.type === 'categorical' ? (
                          <div className="glass-card-static p-6 max-w-[95%] w-full border-l-4 border-l-cyan-500 shadow-soft rounded-2xl bg-white">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                              <span className="text-[10px] px-2.5 py-1 rounded-xl font-bold uppercase tracking-wider bg-cyan-50 text-cyan-600 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Categorical Breakdown
                              </span>
                              <button onClick={() => navigator.clipboard.writeText(`${entry.result.label} Breakdown: \n${Object.entries(entry.result.results).map(([k, v]) => `${k}: ${v.winRate.toFixed(1)}% WR`).join('\n')}`)}
                                className="text-xs font-bold text-text-muted hover:text-cyan-600 transition-colors flex items-center gap-1.5"
                                title="Copy result">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.75rem', height: '0.75rem', display: 'inline-block' }}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                                </svg>
                                <span>Copy</span>
                              </button>
                            </div>
                            <h4 className="text-sm font-bold mb-4 text-text-primary">{entry.result.label} Breakdown</h4>
                            <div className="space-y-3">
                              {Object.entries(entry.result.results).map(([key, data]) => (
                                <div key={key} className="flex justify-between items-center text-sm p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                                  <span className="font-extrabold text-text-primary">{key} <span className="text-xs font-semibold text-text-muted">({data.trades} trades)</span></span>
                                  <span className="flex items-center gap-4">
                                    <span className="font-extrabold" style={{ color: data.winRate >= 50 ? '#10b981' : '#ef4444' }}>
                                      {data.winRate.toFixed(1)}% WR
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-500">
                                      {data.avgPnl >= 0 ? '₹' : '-₹'}{Math.abs(data.avgPnl).toFixed(0)} avg
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
                
                {loading && (
                  <div className="glass-card-static p-4 text-center animate-pulse flex items-center justify-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="spinner animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent" />
                    <p className="text-xs font-semibold text-text-muted">
                      AI is scanning trades and running statistical calculations...
                    </p>
                  </div>
                )}
 
                {error && (
                  <div className="p-4 rounded-xl animate-fade-in bg-rose-50 border border-rose-100 flex items-center gap-3">
                    <svg className="w-5 h-5 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-sm text-rose-700 font-semibold">{error}</p>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
 
              {/* Chat Input & Suggestions */}
              <div className="border-t border-slate-100 pt-5">
                {/* Suggestions row */}
                <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1 max-h-[80px] select-none">
                  {[
                    'Do I win more on Mondays?',
                    'What time of day should I trade?',
                    'What are my biggest weaknesses?',
                    'How can I improve my strategy?',
                    ...(dataStats?.hasVolume ? ['Does volume affect win rate?'] : []),
                    ...(dataStats?.hasDuration ? ['Do quick trades do better?'] : []),
                  ].map(example => (
                    <button
                      key={example}
                      onClick={() => setQuery(example)}
                      className="text-[11px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-text-secondary hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-650 transition-all font-semibold whitespace-nowrap"
                    >
                      {example}
                    </button>
                  ))}
                </div>
 
                {/* Input box */}
                <div className="flex gap-3">
                  <input
                    id="signal-query-input"
                    type="text"
                    className="input-field flex-1 px-4 py-3 text-sm rounded-xl focus:shadow-md"
                    placeholder="Ask a question about your trading behavior..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runTest()}
                  />
                  <button onClick={runTest} disabled={loading || !query.trim()} className="glow-btn whitespace-nowrap rounded-xl py-3 px-5 flex items-center gap-1.5 font-bold shadow-soft">
                    {loading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    )}
                    Ask AI
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
