import { useState, useMemo } from 'react'
import { strategies, categories, difficulties } from '../data/strategies'

export default function StrategyLibrary() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [copied, setCopied] = useState(false)
  const [votes, setVotes] = useState(() => {
    const map = {}
    strategies.forEach(s => { map[s.id] = s.votes })
    return map
  })
  const [voted, setVoted] = useState({})

  const filtered = useMemo(() => {
    return strategies.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.description.toLowerCase().includes(search.toLowerCase()) &&
        !s.indicators.some(ind => ind.toLowerCase().includes(search.toLowerCase()))) return false
      if (selectedCategory !== 'All' && s.category !== selectedCategory) return false
      if (selectedDifficulty !== 'All' && s.difficulty !== selectedDifficulty) return false
      return true
    })
  }, [search, selectedCategory, selectedDifficulty])

  const handleVote = (id) => {
    if (voted[id]) return
    setVotes(v => ({ ...v, [id]: (v[id] || 0) + 1 }))
    setVoted(v => ({ ...v, [id]: true }))
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const difficultyColors = {
    Beginner: '#10b981',
    Intermediate: '#f59e0b',
    Advanced: '#ef4444',
  }

  const categoryBadgeClass = (category) => {
    const c = category.toLowerCase()
    if (c === 'breakout' || c === 'scalping') return 'strategy-lib-type-badge strategy-lib-type-badge--blue'
    return 'strategy-lib-type-badge strategy-lib-type-badge--purple'
  }

  const metricColor = (key, s) => {
    const { winRate, profitFactor, sharpe } = s.stats
    if (key === 'wr') {
      if (winRate >= 52) return '#10b981'
      if (winRate >= 45) return '#f59e0b'
      return '#ef4444'
    }
    if (key === 'pf') {
      if (profitFactor >= 1.5) return '#10b981'
      if (profitFactor >= 1.15) return '#f59e0b'
      return '#ef4444'
    }
    if (key === 'sr') {
      if (sharpe >= 1) return '#10b981'
      if (sharpe >= 0.65) return '#f59e0b'
      return '#ef4444'
    }
    if (key === 'dd') return '#ef4444'
    return 'var(--color-text-primary)'
  }

  if (selectedStrategy) {
    const s = selectedStrategy
    return (
      <div className="max-w-6xl mx-auto pb-16">
        <button onClick={() => setSelectedStrategy(null)}
          className="mb-8 text-sm font-bold flex items-center gap-1.5 hover:-translate-x-1.5 transition-transform text-indigo-650"
          style={{ color: 'var(--color-accent-light)' }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Strategy Library
        </button>

        <div className="animate-fade-in-up">
          {/* Header Card */}
          <div className="glass-card-static p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={categoryBadgeClass(s.category)}>
                  {s.category.toUpperCase()}
                </span>
                <span className="badge text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${difficultyColors[s.difficulty]}15`, color: difficultyColors[s.difficulty] }}>
                  {s.difficulty}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight font-extrabold text-slate-800">{s.name}</h1>
              <p className="text-sm text-text-secondary leading-relaxed max-w-3xl font-medium">{s.description}</p>
            </div>
            
            <button onClick={() => handleVote(s.id)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-bold transition-all hover:scale-105 self-start md:self-center shrink-0 shadow-sm"
              style={{
                background: voted[s.id] ? 'rgba(99,102,241,0.15)' : '#ffffff',
                borderColor: voted[s.id] ? 'var(--color-accent)' : 'var(--color-border)',
                color: voted[s.id] ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>{voted[s.id] ? 'Upvoted' : 'Upvote strategy'} ({votes[s.id]})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Main (Rules & Code & Analysis) */}
            <div className="lg:col-span-2 space-y-8">
              {/* Rules Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Entry Rules */}
                <div className="glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
                  <h3 className="text-base font-bold mb-4 text-emerald-600 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    Entry Rules (Buy Signal)
                  </h3>
                  <ul className="space-y-3.5 text-sm text-text-secondary font-medium">
                    {(Array.isArray(s.entryRules) ? s.entryRules : [s.entryRules]).map((rule, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-500">•</span>
                        <span className="leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exit Rules */}
                <div className="glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
                  <h3 className="text-base font-bold mb-4 text-rose-600 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    Exit Rules (Sell/Stop)
                  </h3>
                  <ul className="space-y-3.5 text-sm text-text-secondary font-medium">
                    {(Array.isArray(s.exitRules) ? s.exitRules : [s.exitRules]).map((rule, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-rose-500">•</span>
                        <span className="leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Code block */}
              <div className="border border-slate-800 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-mono text-slate-400 ml-3">strategy.pine</span>
                  </div>
                  <button onClick={() => copyCode(s.pineScript)}
                    className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700/50 hover:border-slate-650 transition-all">
                    <span>{copied ? '✓' : (
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '0.75rem', height: '0.75rem', display: 'inline-block' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
                      </svg>
                    )}</span>
                    <span>{copied ? 'Copied!' : 'Copy code'}</span>
                  </button>
                </div>
                <div className="code-block-content p-6 bg-slate-950/90 font-mono text-xs text-slate-300 max-h-[420px] overflow-y-auto leading-relaxed selection:bg-indigo-500/30">
                  {s.pineScript.split('\n').map((line, i) => (
                    <div key={i} className="flex hover:bg-slate-900/40 px-2 rounded -mx-2">
                      <span className="select-none w-8 text-right mr-5 shrink-0 text-slate-650 text-[10px] font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span style={{
                        color: line.startsWith('//')
                          ? '#64748b'
                          : line.includes('strategy.') || line.includes('ta.')
                            ? '#22d3ee'
                            : line.includes('plot') || line.includes('bgcolor') || line.includes('hline')
                              ? '#c084fc'
                              : line.includes('if ')
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

              {/* Analysis */}
              <div className="glass-card-static p-8 rounded-2xl bg-white border border-slate-100 shadow-soft">
                <h3 className="text-lg font-bold mb-5 flex items-center gap-2.5 text-text-primary">
                  <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Detailed Strategy Analysis
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-line font-medium">{s.analysis}</p>
              </div>
            </div>

            {/* Right Sidebar (Stats & Indicators) */}
            <div className="lg:col-span-1 space-y-8">
              {/* Detailed Stats */}
              <div className="glass-card-static p-6 space-y-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
                <h3 className="text-base font-bold text-text-primary border-b pb-3 flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" /></svg>
                  Backtest Performance
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { 
                      label: 'Win Rate', 
                      value: `${s.stats.winRate}%`, 
                      color: s.stats.winRate >= 50 ? '#10b981' : '#ef4444', 
                      bg: s.stats.winRate >= 50 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      icon: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /></svg>
                      )
                    },
                    { 
                      label: 'Profit Factor', 
                      value: s.stats.profitFactor.toFixed(2), 
                      color: s.stats.profitFactor >= 1.5 ? '#10b981' : '#f59e0b', 
                      bg: s.stats.profitFactor >= 1.5 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                      icon: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3v18M6 21h12" /></svg>
                      )
                    },
                    { 
                      label: 'Sharpe Ratio', 
                      value: s.stats.sharpe.toFixed(2), 
                      color: s.stats.sharpe >= 1 ? '#10b981' : '#f59e0b', 
                      bg: s.stats.sharpe >= 1 ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                      icon: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /></svg>
                      )
                    },
                    { 
                      label: 'Max Drawdown', 
                      value: `${s.stats.maxDrawdown}%`, 
                      color: '#ef4444', 
                      bg: 'rgba(239,68,68,0.08)',
                      icon: (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /></svg>
                      )
                    },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between h-24">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">{stat.label}</span>
                        <span className="p-1 rounded-lg border border-slate-100/50" style={{ color: stat.color, backgroundColor: stat.bg }}>{stat.icon}</span>
                      </div>
                      <p className="text-lg font-extrabold mt-1 text-slate-800" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indicators */}
              <div className="glass-card-static p-6 rounded-2xl bg-white border border-slate-100 shadow-soft">
                <h3 className="text-base font-bold text-text-primary border-b pb-3 mb-4 flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                  Technical Components
                </h3>
                <div className="flex flex-wrap gap-2">
                  {s.indicators.map(ind => (
                    <span key={ind} className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50/70 text-indigo-600 border border-indigo-100/50">
                      {ind}
                    </span>
                  ))}
                </div>
              </div>

              {/* Execution Info */}
              <div className="glass-card-static p-6 bg-indigo-900/5 border-l-4 border-l-indigo-500 rounded-2xl border border-slate-100/40">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  Quick Guide
                </h4>
                <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                  This script is ready to run. Copy the script code from the editor and paste it inside the Pine Editor tab at the bottom of your TradingView interface.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="strategy-lib-page pb-16">
      <div className="strategy-lib-page__intro animate-fade-in-up">
        <h1 className="strategy-lib-page__title">
          <span className="gradient-text">Strategy Library</span>
        </h1>
        <p className="strategy-lib-page__lead font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Review {strategies.length} ready-made technical models with statistics, entry/exit parameters, and Pine script templates
        </p>
      </div>

      {/* Onboarding Guide */}
      <div className="glass-card-static p-8 mb-10 border border-slate-100 bg-white shadow-soft rounded-2xl animate-fade-in-up stagger-1">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2.5 text-text-primary">
          <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          How to use Strategy Library
        </h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed font-medium">
          Browse ready-made trading strategies with complete entry/exit logic, backtest statistics (Win Rate, Profit Factor, Sharpe Ratio), and TradingView script templates.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100" style={{ fontSize: '0.85rem' }}>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">1. Filter & Search</strong>
            <span className="text-text-muted leading-relaxed font-medium">Use search text or select category and difficulty level filters to find specific strategies.</span>
          </div>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">2. View Strategy Details</strong>
            <span className="text-text-muted leading-relaxed font-medium">Click on any strategy card to expand it and read its entry/exit rules, metrics, and script.</span>
          </div>
          <div className="space-y-1">
            <strong className="text-slate-800 font-bold block mb-1">3. Copy Pine Script</strong>
            <span className="text-text-muted leading-relaxed font-medium">Copy the script directly using the copy button and add it to your TradingView chart.</span>
          </div>
        </div>
      </div>

      <div className="strategy-lib-filters animate-fade-in-up flex flex-wrap gap-4 items-center justify-between shadow-soft border border-slate-150/50 bg-white rounded-2xl p-6 mb-8">
        <div className="relative flex-grow strategy-lib-filters__search max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 select-none pointer-events-none">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input
            id="strategy-search"
            type="text"
            className="input-field pl-10"
            placeholder="Search strategies, indicators..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-4 flex-wrap w-full sm:w-auto">
          <select
            id="strategy-category-filter"
            className="input-field strategy-lib-filters__select strategy-lib-filters__select--wide"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            id="strategy-difficulty-filter"
            className="input-field strategy-lib-filters__select"
            value={selectedDifficulty}
            onChange={e => setSelectedDifficulty(e.target.value)}
          >
            <option value="All">All Levels</option>
            {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <p className="strategy-lib-count font-bold text-xs uppercase tracking-widest text-text-muted mb-6">
        Showing {filtered.length} of {strategies.length} strategies
      </p>

      <div className="strategy-lib-grid gap-8">
        {filtered.map((s, i) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedStrategy(s)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelectedStrategy(s)
              }
            }}
            className="strategy-lib-card animate-fade-in-up p-8 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 rounded-2xl bg-white border border-slate-100 shadow-soft cursor-pointer relative overflow-hidden"
            style={{ animationDelay: `${(i % 6) * 0.08}s` }}
          >
            <div className="strategy-lib-card-header flex justify-between items-start gap-4 mb-4">
              <h3 className="strategy-lib-card-title text-base font-bold text-text-primary leading-tight">{s.name}</h3>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleVote(s.id) }}
                className="strategy-lib-vote flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold hover:bg-indigo-50 hover:border-indigo-200 hover:text-accent transition-all shrink-0 animate-fade-in"
                style={{
                  background: voted[s.id] ? 'rgba(99,102,241,0.15)' : '#ffffff',
                  borderColor: voted[s.id] ? 'var(--color-accent)' : 'var(--color-border)',
                  color: voted[s.id] ? 'var(--color-accent-light)' : 'var(--color-text-secondary)',
                }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                <span>{votes[s.id]}</span>
              </button>
            </div>

            <div className="strategy-lib-tag-row flex gap-2 mb-4">
              <span className={categoryBadgeClass(s.category)}>
                {s.category.toUpperCase()}
              </span>
              <span
                className="strategy-lib-difficulty text-[10px] font-extrabold tracking-wider px-2.5 py-0.5 rounded-lg"
                style={{ color: difficultyColors[s.difficulty], background: `${difficultyColors[s.difficulty]}15` }}
              >
                {s.difficulty.toUpperCase()}
              </span>
            </div>

            <p className="strategy-lib-desc text-sm text-text-muted leading-relaxed mb-5 flex-grow line-clamp-3 font-semibold">{s.description}</p>

            <div className="strategy-lib-metrics grid grid-cols-4 gap-2 p-4 bg-slate-50 border border-slate-100/50 rounded-2xl mb-5">
              {[
                { 
                  key: 'wr', 
                  label: 'WR', 
                  value: `${s.stats.winRate}%`,
                  icon: (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /></svg>
                  )
                },
                { 
                  key: 'pf', 
                  label: 'PF', 
                  value: s.stats.profitFactor.toFixed(1),
                  icon: (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v18M6 21h12" /></svg>
                  )
                },
                { 
                  key: 'sr', 
                  label: 'SR', 
                  value: s.stats.sharpe.toFixed(1),
                  icon: (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /></svg>
                  )
                },
                { 
                  key: 'dd', 
                  label: 'DD', 
                  value: `${s.stats.maxDrawdown}%`,
                  icon: (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /></svg>
                  )
                },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <p className="text-[9px] font-extrabold text-text-muted flex items-center justify-center gap-0.5 mb-1">
                    <span className="shrink-0">{stat.icon}</span> {stat.label}
                  </p>
                  <p className="text-sm font-extrabold" style={{ color: metricColor(stat.key, s) }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-auto">
              <p className="strategy-lib-indicators text-xs text-text-muted truncate max-w-[80%] font-semibold flex items-center gap-1">
                <svg className="w-3 h-3 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82" /></svg>
                {s.indicators.join(', ')}
              </p>
              <span className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5 shrink-0">
                View Details
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="strategy-lib-empty rounded-2xl bg-white border border-slate-150 shadow-soft p-12 text-center max-w-sm mx-auto mt-12">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 mx-auto text-slate-400">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <p className="text-base font-extrabold text-slate-800 mb-1">No strategies found</p>
          <p className="text-xs text-text-muted font-bold">Try adjusting your category or search query.</p>
        </div>
      )}
    </div>
  )
}
