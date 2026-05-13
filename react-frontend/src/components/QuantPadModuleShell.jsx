import { Outlet } from 'react-router-dom'

/**
 * Mirrors the main column chrome from pramukh/Quantpad Layout.jsx
 * (bg-grid, glows, page-enter) so embedded QuantPad pages match standalone.
 */
export default function QuantPadModuleShell() {
  return (
    <div className="quantpad-module-shell bg-grid min-h-full w-full relative">
      <div
        className="bg-glow"
        style={{ top: '-200px', left: '-200px', background: 'rgba(99,102,241,0.06)' }}
        aria-hidden
      />
      <div
        className="bg-glow"
        style={{ bottom: '-200px', right: '-200px', background: 'rgba(6,182,212,0.04)' }}
        aria-hidden
      />
      <div className="page-enter relative z-[1]">
        <Outlet />
      </div>
    </div>
  )
}
