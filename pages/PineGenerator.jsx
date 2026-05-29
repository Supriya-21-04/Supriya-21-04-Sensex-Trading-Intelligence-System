import { useState, useCallback, useMemo } from 'react'
import { generatePineScriptWithGemini, optimizePineScriptWithGemini } from '../utils/geminiClient'
import { parseStrategy } from '../utils/pineTemplates'

// --- Visualization Components ---

const IndicatorCard = ({ indicator }) => (
  <div className="glass-card-static p-6 flex flex-col h-full border border-slate-100 hover:border-indigo-200/60 shadow-soft hover:shadow-md transition-all duration-300 rounded-2xl bg-white relative overflow-hidden group">
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-xl">
        {indicator.indicator.category}
      </span>
      <span className="text-xs text-text-muted font-mono font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
        {indicator.numbers[0] ? `Param: ${indicator.numbers[0]}` : 'Default'}
      </span>
    </div>
    <h4 className="text-base font-bold mb-2 text-text-primary flex items-center gap-1.5">
      <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      {indicator.indicator.name}
    </h4>
    <p className="text-xs text-text-muted mb-4 italic leading-relaxed font-medium">Role: {indicator.indicator.role}</p>
    <p className="text-sm text-text-secondary leading-relaxed flex-grow">
      {indicator.indicator.description}
    </p>
  </div>
)

const ConditionTree = ({ parsed }) => {
  if (!parsed || parsed.indicators.length === 0) return null

  return (
    <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
      <h4 className="text-lg font-bold mb-8 flex items-center gap-2.5 text-text-primary">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
        Strategy Logic Flowchart
      </h4>
      <div className="space-y-8 relative">
        {/* Long Entry Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase tracking-wider">
              LONG ENTRY
            </span>
            <span className="text-xs text-text-muted font-semibold bg-slate-50 px-2 py-1 rounded-md">
              Condition: ALL nodes must trigger
            </span>
          </div>
          
          <div className="pl-6 border-l-2 border-slate-100 space-y-4 ml-3 relative">
            {parsed.indicators.map((ind, i) => (
              <div key={i} className="relative flex items-start gap-4">
                {/* Horizontal connection line */}
                <div className="absolute -left-6 top-4 w-6 h-[2px] bg-slate-100" />
                <div className="bg-emerald-500/10 text-emerald-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-emerald-200/20 font-bold text-xs mt-0.5 shadow-sm">
                  ✓
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-sm leading-relaxed flex-grow">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-slate-800">{ind.indicator.name}</span>
                    <span className="text-[10px] font-mono font-bold bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded">
                      {ind.numbers[0] ? `Param: ${ind.numbers[0]}` : 'Default'}
                    </span>
                  </div>
                  <span className="text-text-secondary font-medium">
                    Triggers when <span className="text-indigo-600 font-semibold">{ind.conditionKey || 'default indicator signal'}</span> crosses or holds.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Short / Exit Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/50 uppercase tracking-wider">
              SHORT / EXIT
            </span>
            <span className="text-xs text-text-muted font-semibold bg-slate-50 px-2 py-1 rounded-md">
              Condition: Logical reversal
            </span>
          </div>
          
          <div className="pl-6 border-l-2 border-slate-100 ml-3 relative">
            <div className="relative flex items-start gap-4">
              <div className="absolute -left-6 top-4 w-6 h-[2px] bg-slate-100" />
              <div className="bg-rose-500/10 text-rose-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-rose-200/20 font-bold text-xs mt-0.5 shadow-sm">
                ✕
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-100/50 text-sm text-text-secondary italic leading-relaxed flex-grow font-medium">
                Reverses the primary entry conditions to exit long positions or open short positions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const StrategySnapshot = ({ parsed }) => {
  const complexity = useMemo(() => {
    const count = parsed.indicators.length
    if (count <= 1) return { label: 'Basic Strategy', color: '#10b981', bg: 'rgba(16,185,129,0.08)', stars: '★☆☆' }
    if (count <= 3) return { label: 'Moderate Complexity', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', stars: '★★☆' }
    return { label: 'Complex Logic', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', stars: '★★★' }
  }, [parsed])

  const type = useMemo(() => {
    const cats = parsed.indicators.map(i => i.indicator.category)
    if (cats.some(c => c.includes('SMC'))) return 'Smart Money Concept (SMC)'
    if (cats.some(c => c.includes('Trend')) && cats.some(c => c.includes('Momentum'))) return 'Momentum & Trend Follower'
    if (cats.some(c => c.includes('Trend'))) return 'Trend Following Core'
    if (cats.some(c => c.includes('Volatility'))) return 'Volatility Mean Reversion'
    return 'Technical Indicator Core'
  }, [parsed])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
      {[
        { 
          label: 'Complexity', 
          value: complexity.label, 
          sub: complexity.stars, 
          color: complexity.color, 
          bg: complexity.bg, 
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1.73-1.99L12 2.8 4.73 6.01A2 2 0 0 0 3 8v8a2 2 0 0 0 1.73 1.99L12 21.2l7.27-3.2A2 2 0 0 0 21 16z"/></svg>
          ) 
        },
        { 
          label: 'Total Indicators', 
          value: `${parsed.indicators.length} Active Nodes`, 
          sub: 'Logic filters', 
          color: '#8b5cf6', 
          bg: 'rgba(139,92,246,0.08)', 
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /></svg>
          ) 
        },
        { 
          label: 'Primary Style', 
          value: type, 
          sub: 'Algorithmic base', 
          color: '#06b6d4', 
          bg: 'rgba(6,182,212,0.08)', 
          full: true, 
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="2" /></svg>
          ) 
        },
        { 
          label: 'Timeframe', 
          value: 'Any Interval', 
          sub: 'Optimized for chart', 
          color: '#ec4899', 
          bg: 'rgba(236,72,153,0.08)', 
          icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          ) 
        },
      ].map((stat, i) => (
        <div 
          key={i} 
          className={`glass-card-static p-6 border border-slate-100 bg-white shadow-soft rounded-2xl flex flex-col justify-between transition-all duration-300 hover:shadow-md relative overflow-hidden group ${
            stat.full ? 'col-span-1 sm:col-span-2' : ''
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest">{stat.label}</span>
              <span className="p-1.5 rounded-lg" style={{ color: stat.color, backgroundColor: stat.bg }}>{stat.icon}</span>
            </div>
            <p className="text-lg font-extrabold leading-tight text-slate-800">{stat.value}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-55">
            <span className="text-xs font-semibold" style={{ color: stat.color }}>{stat.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const VolatilityGauge = ({ parsed }) => {
  const score = useMemo(() => {
    let s = 20 // base
    parsed.indicators.forEach(ind => {
      const cat = ind.indicator.category.toLowerCase()
      if (cat.includes('volatility')) s += 30
      if (cat.includes('momentum')) s += 10
      if (cat.includes('smc')) s += 15
    })
    return Math.min(s, 100)
  }, [parsed])

  const getLabel = (s) => {
    if (s < 40) return { text: 'Low Volatility Sensitivity', color: '#10b981', bg: 'rgba(16,185,129,0.08)', tip: 'Optimized for trending/stable markets.' }
    if (s < 70) return { text: 'Moderate Range Sensitivity', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', tip: 'Standard market conditions.' }
    return { text: 'High Volatility Dependency', color: '#ec4899', bg: 'rgba(236,72,153,0.08)', tip: 'Requires high volume & rapid expansions.' }
  }

  const label = getLabel(score)

  return (
    <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-base font-bold text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Volatility Exposure
        </h4>
        <span className="text-sm font-mono font-extrabold px-2.5 py-1 rounded-xl" style={{ color: label.color, backgroundColor: label.bg }}>
          {score}%
        </span>
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full transition-all duration-1000 ease-out rounded-full"
          style={{ 
            width: `${score}%`, 
            background: `linear-gradient(90deg, #10b981, ${label.color})`,
          }}
        />
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mt-4 pt-4 border-t border-slate-50">
        <div>
          <p className="text-sm font-extrabold" style={{ color: label.color }}>{label.text}</p>
          <p className="text-xs text-text-muted mt-1.5 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            {label.tip}
          </p>
        </div>
      </div>
    </div>
  )
}

const CategoryDistribution = ({ parsed }) => {
  const distribution = useMemo(() => {
    const counts = {}
    parsed.indicators.forEach(ind => {
      const cat = ind.indicator.category.split('/')[0]
      counts[cat] = (counts[cat] || 0) + 1
    })
    
    const total = parsed.indicators.length
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100)
    })).sort((a, b) => b.count - a.count)
  }, [parsed])

  const colors = {
    'Trend': '#06b6d4',
    'Momentum': '#8b5cf6',
    'Volatility': '#ec4899',
    'SMC': '#10b981',
    'Volume': '#3b82f6',
    'Trend Strength': '#f59e0b'
  }

  const bgColors = {
    'Trend': 'rgba(6,182,212,0.08)',
    'Momentum': 'rgba(139,92,246,0.08)',
    'Volatility': 'rgba(236,72,153,0.08)',
    'SMC': 'rgba(16,185,129,0.08)',
    'Volume': 'rgba(59,130,246,0.08)',
    'Trend Strength': 'rgba(245,158,11,0.08)'
  }

  return (
    <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
      <h4 className="text-base font-bold mb-6 text-text-primary flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/></svg>
        Indicator Distribution
      </h4>
      <div className="space-y-5">
        {distribution.map((item, i) => {
          const color = colors[item.name] || '#6366f1'
          const bg = bgColors[item.name] || 'rgba(99,102,241,0.08)'
          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-between items-center text-xs uppercase font-extrabold tracking-wider">
                <span className="px-2 py-0.5 rounded-lg text-[10px]" style={{ color: color, backgroundColor: bg }}>
                  {item.name}
                </span>
                <span className="text-text-muted font-mono">{item.percent}% ({item.count})</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ 
                    width: `${item.percent}%`, 
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}30`
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PineGenerator() {
  const [activeTab, setActiveTab] = useState('create') // 'create' | 'optimize'
  const [description, setDescription] = useState('')
  const [optimizeCode, setOptimizeCode] = useState('')
  const [optimizeGoals, setOptimizeGoals] = useState('')
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [isFixing, setIsFixing] = useState(false)

  // Derived metadata from manual parsing for visualizations (only applies to generated, not optimized)
  const visualMeta = useMemo(() => {
    if (activeTab === 'optimize') return null
    if (!description || !result || result.error) return null
    try {
      return parseStrategy(description)
    } catch {
      return null
    }
  }, [activeTab, description, result])

  const generate = useCallback(async () => {
    if (!description.trim()) return
    setIsGenerating(true)
    setResult(null)
    setCopied(false)
    setErrorText('')
    try {
      const r = await generatePineScriptWithGemini(description)
      setResult({ ...r, error: false })
    } catch (err) {
      setResult({ error: true, code: `// Error generating script:\n// ${err.message}` })
    } finally {
      setIsGenerating(false)
    }
  }, [description])

  const optimize = useCallback(async () => {
    if (!optimizeCode.trim()) return
    setIsGenerating(true)
    setResult(null)
    setCopied(false)
    setErrorText('')
    try {
      const r = await optimizePineScriptWithGemini(optimizeCode, optimizeGoals)
      setResult({ ...r, error: false })
    } catch (err) {
      setResult({ error: true, code: `// Error optimizing script:\n// ${err.message}` })
    } finally {
      setIsGenerating(false)
    }
  }, [optimizeCode, optimizeGoals])

  const fixErrors = useCallback(async () => {
    if (!errorText.trim() || !result?.code) return
    setIsFixing(true)
    try {
      const fixPrompt = `The following Pine Script v6 strategy has errors. Fix ALL of the errors listed below and return the complete corrected script.\n\nERRORS FROM TRADINGVIEW:\n${errorText}\n\nCURRENT BROKEN CODE:\n${result.code}`
      const r = await generatePineScriptWithGemini(fixPrompt)
      setResult({ ...r, error: false })
      setErrorText('')
      setCopied(false)
    } catch (err) {
      setResult(prev => ({ ...prev, fixError: err.message }))
    } finally {
      setIsFixing(false)
    }
  }, [errorText, result])

  const copyToClipboard = useCallback(() => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result])

  const downloadScript = useCallback(() => {
    if (!result?.code) return
    const blob = new Blob([result.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sensex_strategy.pine'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2">
          <span className="gradient-text">Pine Script Generator</span>
        </h1>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Describe your strategy rules in plain English — get production-ready TradingView Pine Script v6 code
        </p>
      </div>

      {/* Onboarding Guide */}
      <div className="glass-card-static p-8 mb-10 border border-slate-100 bg-white shadow-soft rounded-2xl animate-fade-in-up relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2.5 text-text-primary">
          <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          How to use Pine Script Generator
        </h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed font-medium">
          Generate robust TradingView Pine Script v6 strategy scripts using plain English prompts. You can choose to generate a new strategy from scratch or optimize/fix an existing script.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100" style={{ fontSize: '0.85rem' }}>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">1. Choose Mode</strong>
            <span className="text-text-muted leading-relaxed font-medium">Select "Create Strategy" for a new design, or "Optimize Existing" to refine an existing Pine script.</span>
          </div>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">2. Describe rules</strong>
            <span className="text-text-muted leading-relaxed font-medium">Type your entry/exit triggers (e.g. "Long on RSI crossover and EMA trend strength") or click any example chips.</span>
          </div>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">3. Apply to chart</strong>
            <span className="text-text-muted leading-relaxed font-medium">Copy/download the v6 code, paste it into the TradingView Pine Editor, and run live backtests!</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-3 mb-10 animate-fade-in-up">
        {['create', 'optimize'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setResult(null); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 border ${
              activeTab === tab 
                ? 'bg-indigo-650 text-white border-indigo-650 shadow-soft'
                : 'bg-white text-text-secondary hover:bg-slate-50 border-slate-200'
            }`}
          >
            {tab === 'create' ? (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Create Strategy
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                Optimize Existing
              </>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'create' ? (
        <>
          {/* Strategy description input */}
          <div className="glass-card-static p-8 mb-8 bg-white border border-slate-100 shadow-soft rounded-2xl animate-fade-in-up relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            <label className="text-sm font-bold block mb-3 text-slate-800 uppercase tracking-wider text-[11px]">
              Describe your strategy rules
            </label>
            <textarea
              id="pine-description-input"
              className="input-field text-sm leading-relaxed"
              placeholder='e.g., "Buy when RSI crosses above 30 and MACD is bullish, with ATR trailing stop"'
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              style={{ minHeight: '100px' }}
            />

            {/* Example buttons */}
            <div className="mt-6">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-3">Example Triggers (Click to apply)</span>
              <div className="flex flex-wrap gap-2.5" id="pine-examples">
                {[
                  'Buy on bullish liquidity sweep and RSI oversold',
                  'Enter when bullish FVG is created and MACD crosses above',
                  'Long when bullish Order Block is formed and ChoCh is bullish',
                  'Buy when RSI crosses above 30 and MACD is bullish',
                  'Sell when price crosses below EMA 200 and ADX shows strong trend',
                  'Short when bearish liquidity sweep happens and Supertrend flips bearish',
                ].map(example => (
                  <button
                    key={example}
                    onClick={() => setDescription(example)}
                    className="text-xs px-3.5 py-2.5 rounded-xl transition-all hover:scale-[1.02] leading-relaxed border border-indigo-100 font-semibold bg-indigo-50/40 text-indigo-650 hover:bg-indigo-50 hover:border-indigo-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-50">
              <button onClick={generate} disabled={!description.trim() || isGenerating} className="glow-btn px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-soft" id="pine-generate-btn">
                {isGenerating ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Generating AI Strategy...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Generate Pine Script
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Optimize Script input */}
          <div className="glass-card-static p-8 mb-8 bg-white border border-slate-100 shadow-soft rounded-2xl animate-fade-in-up relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
            <label className="text-xs font-bold block mb-2 uppercase tracking-wider text-slate-800">
              Paste existing Pine Script
            </label>
            <p className="text-xs text-text-muted mb-3 font-medium">The AI will analyze the code structures, upgrading to v6 and improving trailing stops/risk parameters.</p>
            <textarea
              className="input-field font-mono text-[11px] mb-6 p-4 bg-slate-950 text-slate-200 border border-slate-850"
              placeholder='//@version=6&#10;strategy("My Strategy")...'
              value={optimizeCode}
              onChange={e => setOptimizeCode(e.target.value)}
              rows={10}
              style={{ minHeight: '200px' }}
            />
            
            <label className="text-xs font-bold block mb-2 uppercase tracking-wider text-indigo-650">
              Optimization Goals & Improvements
            </label>
            <input
              type="text"
              className="input-field mb-6"
              placeholder='e.g., "Add ATR trailing stop and reduce drawdown"'
              value={optimizeGoals}
              onChange={e => setOptimizeGoals(e.target.value)}
            />

            <button onClick={optimize} disabled={!optimizeCode.trim() || isGenerating} className="glow-btn w-full justify-center py-3 rounded-xl flex items-center gap-2 font-bold shadow-soft">
              {isGenerating ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Optimizing Strategy...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Optimize Script Performance
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Generated code & analysis results */}
      {result && (
        <div className="animate-fade-in-up">
          {result.error ? (
            <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
              <div className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800/80">
                  <span className="text-xs font-mono text-slate-400">Error Generation Code</span>
                </div>
                <div className="p-6 font-mono text-xs text-rose-400 bg-slate-950" style={{ whiteSpace: 'pre-wrap' }}>
                  {result.code}
                </div>
              </div>
              {result.suggestions && (
                <div className="mt-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-xs font-extrabold text-slate-755 uppercase tracking-wider mb-3">Suggested Prompt Variations:</p>
                  <div className="space-y-2">
                    {result.suggestions.map(s => (
                      <button key={s} onClick={() => setDescription(s)} className="block text-sm font-semibold hover:underline text-left text-indigo-600 transition-colors">
                        → {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Insight Dashboard */}
              {visualMeta && visualMeta.indicators.length > 0 && (
                <div className="mb-12 animate-fade-in-up">
                  <h3 className="text-xl font-serif mb-6 gradient-text">Generated Strategy Insights</h3>
                  
                  <StrategySnapshot parsed={visualMeta} />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {visualMeta.indicators.map((ind, i) => (
                      <IndicatorCard key={i} indicator={ind} />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2">
                      <ConditionTree parsed={visualMeta} />
                    </div>
                    <div className="space-y-8">
                      <VolatilityGauge parsed={visualMeta} />
                      <CategoryDistribution parsed={visualMeta} />
                    </div>
                  </div>
                </div>
              )}

              {/* Code block */}
              <div className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl mt-8 animate-fade-in-up">
                {/* Mac-like Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-mono text-slate-400 ml-3">sensex_strategy.pine</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={copyToClipboard}
                      className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold bg-slate-855 hover:bg-slate-800 text-slate-200 border border-slate-700/50 hover:border-slate-650 transition-all"
                      id="pine-copy-btn">
                      <span>{copied ? '✓' : (
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.75rem', height: '0.75rem', display: 'inline-block' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                        </svg>
                      )}</span>
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                    <button onClick={downloadScript}
                      className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-soft transition-all"
                      id="pine-download-btn">
                      <span>⬇</span>
                      <span>Download .pine</span>
                    </button>
                  </div>
                </div>
                {/* Editor Code Area */}
                <div className="p-6 font-mono text-xs text-slate-300 max-h-[500px] overflow-y-auto leading-relaxed bg-slate-950/90 selection:bg-indigo-500/30">
                  {result.code.split('\n').map((line, i) => (
                    <div key={i} className="flex hover:bg-slate-900/40 px-2 rounded -mx-2">
                      <span className="select-none w-8 text-right mr-5 shrink-0 text-slate-600 font-bold text-[10px] mt-0.5">
                        {i + 1}
                      </span>
                      <span style={{
                        color: line.startsWith('//')
                          ? '#64748b'
                          : line.includes('strategy.') || line.includes('ta.') || line.includes('math.')
                            ? '#22d3ee'
                            : line.includes('plot') || line.includes('bgcolor') || line.includes('alert') || line.includes('hline')
                              ? '#c084fc'
                              : line.includes('if ') || line.includes('else')
                                ? '#facc15'
                                : line.includes('input.')
                                  ? '#4ade80'
                                  : line.includes('=')
                                    ? '#818cf8'
                                    : '#cbd5e1'
                      }}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="glass-card-static p-8 mt-8 bg-slate-50/50 border border-slate-100 rounded-2xl shadow-soft relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
                <h4 className="text-sm font-bold mb-4 text-text-primary flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  How to run in TradingView
                </h4>
                <ol className="space-y-3 text-sm text-text-secondary font-medium">
                  {[
                    'Open TradingView and select your preferred chart.',
                    'Click on the "Pine Editor" tab at the bottom panel of your screen.',
                    'Delete any default code, paste your newly generated Pine script v6.',
                    'Click "Add to Chart" to compile and see visual signals on your price action.',
                    'Open the "Strategy Tester" tab to review deep analytics and historical simulation.',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed mt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Error Fixer Panel */}
              <div className="glass-card-static p-8 mt-10 rounded-2xl bg-white border border-rose-100 shadow-soft hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-cyan))' }} />
                <h4 className="text-base font-bold mb-1 text-rose-600 flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  Got compilation errors from TradingView?
                </h4>
                <p className="text-xs text-text-muted mb-4 font-medium">Paste the compiler error messages below, and the AI will automatically correct the Pine Script.</p>
                <textarea
                  id="pine-error-input"
                  className="input-field font-mono text-xs bg-slate-50 border border-slate-200"
                  placeholder={`e.g., "Undeclared identifier 'input'\nLine 7: strategy.entry() expected"`}
                  value={errorText}
                  onChange={e => setErrorText(e.target.value)}
                  rows={3}
                  style={{ minHeight: '80px', borderColor: errorText ? '#fecdd3' : undefined }}
                />
                {result?.fixError && (
                  <p className="text-xs mt-2 text-rose-500 font-semibold bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                    <svg className="w-4 h-4 text-rose-550 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Fix Error: {result.fixError}
                  </p>
                )}
                <div className="mt-4">
                  <button
                    onClick={fixErrors}
                    disabled={!errorText.trim() || isFixing}
                    id="pine-fix-btn"
                    className="text-sm px-5 py-2.5 rounded-xl font-bold transition-all bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/50 hover:scale-[1.02] disabled:opacity-40"
                  >
                    {isFixing ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full" />
                        Resolving Script Errors...
                      </>
                    ) : (
                      'Fix Code with AI'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
