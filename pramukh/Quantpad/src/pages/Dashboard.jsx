import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

/* ── tiny sparkline generator ── */
function useMockSparkline(points = 40) {
  const [data] = useState(() => {
    let v = 50
    return Array.from({ length: points }, () => {
      v += (Math.random() - 0.47) * 6
      return Math.max(10, Math.min(90, v))
    })
  })
  return data
}

function Sparkline({ data, color = '#3b82f6', height = 40, width = 120 }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(' ')
  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      <polygon fill={`url(#sg-${color.replace('#', '')})`}
        points={`${pts} ${width},${height} 0,${height}`} />
    </svg>
  )
}

/* ── animated counter ── */
function AnimatedNumber({ value, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = parseInt(value) || 0
    const dur = 1000
    const start = performance.now()
    const tick = (now) => {
      const pct = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - pct, 3)
      setDisplay(Math.round(target * ease))
      if (pct < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <>{prefix}{display}{suffix}</>
}

const workflow = [
  { step: '01', title: 'Data Ingestion', desc: 'Securely parse local CSVs without server transmission' },
  { step: '02', title: 'Statistical Analysis', desc: 'Isolate systematic edges via complex mathematical models' },
  { step: '03', title: 'Strategy Validation', desc: 'Confirm edge stability across multiple market regimes' },
  { step: '04', title: 'Live Execution', desc: 'Export platform-ready code straight to your broker' },
]

export default function Dashboard() {
  const spark1 = useMockSparkline(50)
  const spark2 = useMockSparkline(50)
  const spark3 = useMockSparkline(50)

  return (
    <div className="max-w-7xl mx-auto relative font-sans" style={{ color: 'var(--color-text-secondary)' }}>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden rounded-3xl mb-24 animate-fade-in-up shadow-lg"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{ backgroundImage: 'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 px-8 py-20 lg:px-20 lg:py-28">
          <div className="flex flex-col lg:flex-row items-center gap-16 xl:gap-24">

            {/* Left: Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 bg-blue-500/10 border border-blue-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-500" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                </span>
                <span className="text-[11px] font-medium tracking-widest text-blue-400 uppercase">
                  100% Client-Side Processing
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight leading-[1.15] mb-6"
                style={{ color: 'var(--color-text-primary)' }}>
                Research. Backtest. <br />
                <span style={{ color: 'var(--color-text-secondary)' }} className="italic font-light">Deploy Systems.</span>
              </h1>

              <p className="text-base md:text-lg max-w-xl mb-10 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                A refined quantitative workstation for systematic traders. Analyze strategies, validate signals, and generate execution logic entirely inside your browser. Your data remains completely private.
              </p>

              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Link to="/backtest" className="font-medium text-sm px-8 py-4 rounded-xl inline-flex items-center gap-2 transition-colors shadow-md"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}>
                  <span>Start Analysis</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link to="/strategies"
                  className="font-medium text-sm px-8 py-4 rounded-xl inline-flex items-center gap-2 transition-colors"
                  style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  View Strategy Models
                </Link>
              </div>
            </div>

            {/* Right: Live-looking mock stats panel - REFINED ASTHETICS */}
            <div className="flex-1 max-w-md w-full">
              <div className="rounded-2xl p-8 space-y-6 shadow-lg backdrop-blur-sm"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                {/* Mock account header */}
                <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--color-text-muted)' }}>MOCK PORTFOLIO</span>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">Active</span>
                  </div>
                </div>

                {/* Balance */}
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl font-light tracking-tight font-serif" style={{ color: 'var(--color-text-primary)' }}>
                    ₹<AnimatedNumber value="124850" />
                  </span>
                  <span className="text-sm font-medium text-emerald-400">
                    +<AnimatedNumber value="24" suffix="%" /> YTD
                  </span>
                </div>

                {/* Sparkline */}
                <div className="py-2">
                  <Sparkline data={spark1} color="#3b82f6" height={80} width={340} />
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                  {[
                    { label: 'Expectancy', value: '₹24.50', color: '#10b981', spark: spark2, sc: '#10b981' },
                    { label: 'Sharpe', value: '1.87', color: 'var(--color-accent)', spark: spark3, sc: '#6366f1' },
                    { label: 'Profit Factor', value: '2.14', color: 'var(--color-text-primary)', spark: spark1, sc: 'var(--color-text-muted)' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col gap-1">
                      <p className="text-[10px] uppercase font-medium tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                      <p className="text-sm font-medium" style={{ color: s.color }}>{s.value}</p>
                      <div className="mt-1 opacity-60">
                        <Sparkline data={s.spark} color={s.sc} height={16} width={90} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR - SPACED OUT & ELEGANT ── */}
      <section className="mb-32 animate-fade-in-up stagger-1 px-4 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12 lg:gap-8 divide-y md:divide-y-0 md:divide-x"
          style={{ borderColor: 'var(--color-border)' }}>
          {[
            { value: '22', suffix: '+', label: 'Validated Models', desc: 'Pre-built systematic strategies ready to test' },
            { value: '50', suffix: '+', label: 'Market Models', desc: 'Complex correlation metrics and historical benchmarks' },
            { value: '10', suffix: 'K', label: 'Simulations/Sec', desc: 'High-speed Monte Carlo distributions' },
            { value: '0', prefix: '', suffix: 'ms', label: 'Server Latency', desc: 'Runs entirely in your local browser cache' },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 text-center px-4 py-8 md:py-0 w-full">
              <span className="text-4xl lg:text-5xl font-light font-serif tracking-tight block mb-3" style={{ color: 'var(--color-text-primary)' }}>
                {stat.prefix}<AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </span>
              <span className="text-[13px] font-medium tracking-widest uppercase block mb-2" style={{ color: 'var(--color-accent)' }}>{stat.label}</span>
              <p className="text-sm max-w-[200px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{stat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW - DECONGESTED LIST ── */}
      <section className="mb-32 animate-fade-in-up stagger-2 max-w-4xl mx-auto px-4 lg:px-0">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-serif mb-4" style={{ color: 'var(--color-text-primary)' }}>The Processing Pipeline</h2>
          <p className="max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>A transparent, step-by-step lifecycle for strict quantitative analysis.</p>
        </div>

        <div className="flex flex-col gap-8">
          {workflow.map((w, i) => (
            <div key={w.step} className="group relative p-8 md:p-10 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm transition-colors"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-serif text-xl"
                style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
                {w.step}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>{w.title}</h3>
                <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{w.desc}</p>
              </div>

              {/* Optional connector for desktop simply styled */}
              {i < 3 && (
                <div className="hidden md:block absolute -bottom-8 left-16 w-px h-8" style={{ background: 'var(--color-border)' }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER - REFINED ── */}
      <section className="animate-fade-in-up stagger-3 mb-16 px-4 lg:px-8">
        <div className="rounded-3xl px-10 py-16 md:p-20 text-center shadow-lg relative overflow-hidden"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          {/* Subtle glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500 opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-serif mb-6" style={{ color: 'var(--color-text-primary)' }}>
              Initialize Your Workspace
            </h2>
            <p className="text-lg mb-10 leading-relaxed text-balance" style={{ color: 'var(--color-text-secondary)' }}>
              Start parsing your trade history immediately. The environment is sandboxed to your machine, ensuring complete data sovereignty and zero server latency.
            </p>
            <Link to="/backtest" className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-base px-10 py-4 rounded-xl inline-flex items-center gap-3 transition-colors">
              <span>Import Trade Data</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

