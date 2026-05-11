from __future__ import annotations

import json
import os
from glob import glob

import matplotlib.pyplot as plt
import pandas as pd


def _latest_report_dir(base: str) -> str:
    paths = [p for p in glob(os.path.join(base, "analysis_*")) if os.path.isdir(p)]
    if not paths:
        raise FileNotFoundError(f"No analysis folders in {base}")
    paths.sort(key=os.path.getmtime, reverse=True)
    return paths[0]


def _latest_file(pattern: str) -> str | None:
    files = glob(pattern)
    if not files:
        return None
    files.sort(key=os.path.getmtime, reverse=True)
    return files[0]


def _fmt_pct(v: float) -> str:
    return f"{v:+.2f}%"


def _fmt_num(v: float) -> str:
    return f"{v:+.2f}"


def _load_stage_data(repo_root: str, folds_df: pd.DataFrame, summary: dict) -> dict:
    # Stage 1: pure PPO evaluation (legacy pipeline)
    stage1_path = os.path.join(repo_root, "data", "processed", "rl_evaluation_metrics.json")
    stage1 = {}
    if os.path.exists(stage1_path):
        with open(stage1_path, "r", encoding="utf-8") as f:
            s1 = json.load(f)
        rl = s1.get("strategies", {}).get("RL Agent (Ours)", {})
        acc = s1.get("rl_directional_accuracy", {})
        mix = acc.get("Action Mix (%)", {})
        stage1 = {
            "return_pct": float(rl.get("Total Return (%)", 0.0)),
            "sharpe": float(rl.get("Sharpe Ratio", 0.0)),
            "max_dd_pct": float(rl.get("Max Drawdown (%)", 0.0)),
            "profit_factor": float("nan"),  # not available in legacy report
            "directional_accuracy": float(acc.get("Directional Accuracy (LONG/SHORT only) (%)", 0.0)),
            "trades": int(rl.get("Total Trades", 0)),
            "action_mix": mix,
        }

    # Stage 2/3: latest walkforward_v2 report (hybrid RL + ensemble strategy)
    stage2 = {}
    stage3 = {}
    wf_path = _latest_file(os.path.join(repo_root, "runs", "walkforward_v2_*", "walkforward_report.json"))
    if wf_path:
        with open(wf_path, "r", encoding="utf-8") as f:
            wf = json.load(f)
        folds = wf.get("folds", [])
        if folds:
            rl_ret = [float(x.get("rl", {}).get("total_return_pct", 0.0)) for x in folds]
            rl_sh = [float(x.get("rl", {}).get("sharpe", 0.0)) for x in folds]
            rl_dd = [float(x.get("rl", {}).get("max_drawdown_pct", 0.0)) for x in folds]
            stage2 = {
                "return_pct": float(sum(rl_ret) / len(rl_ret)),
                "sharpe": float(sum(rl_sh) / len(rl_sh)),
                "max_dd_pct": float(sum(rl_dd) / len(rl_dd)),
            }
            ens_key = "ensemble_conf_strategy" if "ensemble_conf_strategy" in folds[0] else "xgb_prob_strategy"
            ens_ret = [float(x.get(ens_key, {}).get("total_return_pct", 0.0)) for x in folds]
            ens_sh = [float(x.get(ens_key, {}).get("sharpe", 0.0)) for x in folds]
            ens_dd = [float(x.get(ens_key, {}).get("max_drawdown_pct", 0.0)) for x in folds]
            stage3 = {
                "return_pct": float(sum(ens_ret) / len(ens_ret)),
                "sharpe": float(sum(ens_sh) / len(ens_sh)),
                "max_dd_pct": float(sum(ens_dd) / len(ens_dd)),
                "label": ens_key,
            }

    # Stage 4: current execution-only RL overlay analysis
    stage4 = {
        "return_pct": float(folds_df["overlay_return_pct"].mean()) if not folds_df.empty else 0.0,
        "sharpe": float(folds_df["overlay_sharpe"].mean()) if not folds_df.empty else 0.0,
        "max_dd_pct": float(folds_df["overlay_max_dd_pct"].mean()) if not folds_df.empty else 0.0,
        "tracking_error": float(folds_df["overlay_tracking_error_mean"].mean()) if not folds_df.empty else 0.0,
        "turnover": float(folds_df["overlay_turnover_mean"].mean()) if not folds_df.empty else 0.0,
        "det_return_pct": float(folds_df["det_return_pct"].mean()) if not folds_df.empty else 0.0,
        "det_sharpe": float(folds_df["det_sharpe"].mean()) if not folds_df.empty else 0.0,
        "overlay_minus_det_ci": summary.get("bootstrap", {}).get("overlay_minus_det_return_ci", {}),
    }
    return {"stage1": stage1, "stage2": stage2, "stage3": stage3, "stage4": stage4}


def generate_quant_report(report_dir: str | None = None) -> str:
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "runs", "analysis_reports")
    if report_dir is None:
        report_dir = _latest_report_dir(base)
    repo_root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

    summary_path = os.path.join(report_dir, "summary.json")
    folds_path = os.path.join(report_dir, "fold_summary.csv")
    with open(summary_path, "r", encoding="utf-8") as f:
        summary = json.load(f)
    folds = pd.read_csv(folds_path)
    stage = _load_stage_data(repo_root, folds, summary)
    terminal_lines: list[str] = []

    def p(line: str = ""):
        print(line)
        terminal_lines.append(line)

    # Dedicated evolution section
    p("=" * 60)
    p("RL TRADING PIPELINE — PERFORMANCE EVOLUTION")
    p("=" * 60)
    s1, s2, s3, s4 = stage["stage1"], stage["stage2"], stage["stage3"], stage["stage4"]

    p("\n## STAGE 1 — PURE PPO RL")
    if s1:
        p(f"Return:                {_fmt_pct(s1['return_pct'])}")
        p(f"Sharpe:                {_fmt_num(s1['sharpe'])}")
        p(f"Max Drawdown:          {_fmt_pct(s1['max_dd_pct'])}")
        p(f"Directional Accuracy:  {s1['directional_accuracy']:.2f}%")
        p(f"Trades:                {s1['trades']}")
        mix = s1.get("action_mix", {})
        p(
            "Action Mix:            "
            f"FLAT {mix.get('FLAT', 0.0):.1f}% | LONG {mix.get('LONG', 0.0):.1f}% | SHORT {mix.get('SHORT', 0.0):.1f}%"
        )
    else:
        p("Not available.")

    p("\n## STAGE 2 — HYBRID RL + PREDICTIVE SIGNAL")
    if s2:
        p(f"Return:                {_fmt_pct(s2['return_pct'])}")
        p(f"Sharpe:                {_fmt_num(s2['sharpe'])}")
        p(f"Max Drawdown:          {_fmt_pct(s2['max_dd_pct'])}")
        if s1:
            p("Improvement vs PPO:")
            p(f"Return Improvement:    {_fmt_pct(s2['return_pct'] - s1['return_pct'])}")
            p(f"Sharpe Improvement:    {_fmt_num(s2['sharpe'] - s1['sharpe'])}")
            p(f"Drawdown Change:       {_fmt_pct(abs(s1['max_dd_pct']) - abs(s2['max_dd_pct']))}")
    else:
        p("Not available.")

    p("\n## STAGE 3 — ENSEMBLE CONFIDENCE STRATEGY")
    if s3:
        p(f"Return:                {_fmt_pct(s3['return_pct'])}")
        p(f"Sharpe:                {_fmt_num(s3['sharpe'])}")
        p(f"Max Drawdown:          {_fmt_pct(s3['max_dd_pct'])}")
        p("Observation:           More stable than unconstrained RL in multiple runs.")
    else:
        p("Not available.")

    p("\n## STAGE 4 — EXECUTION-ONLY RL OVERLAY")
    p(f"Return:                {_fmt_pct(s4['return_pct'])}")
    p(f"Sharpe:                {_fmt_num(s4['sharpe'])}")
    p(f"Max Drawdown:          {_fmt_pct(s4['max_dd_pct'])}")
    p(f"Tracking Error:        {s4['tracking_error']:.4f}")
    p(f"Turnover:              {s4['turnover']:.4f}")
    p(f"Deterministic Return:  {_fmt_pct(s4['det_return_pct'])}")
    p(f"Deterministic Sharpe:  {_fmt_num(s4['det_sharpe'])}")
    p(f"Overlay-Det CI:        {s4['overlay_minus_det_ci']}")

    p("\n" + "=" * 60)
    p("BASELINE COMPARISON")
    p("=" * 60)
    p(f"Deterministic Ensemble: {_fmt_pct(s4['det_return_pct'])} | Sharpe {_fmt_num(s4['det_sharpe'])}")
    p(f"Execution Overlay RL:   {_fmt_pct(s4['return_pct'])} | Sharpe {_fmt_num(s4['sharpe'])}")
    if s1:
        p(f"Pure RL (legacy):       {_fmt_pct(s1['return_pct'])} | Sharpe {_fmt_num(s1['sharpe'])}")

    p("\n" + "=" * 58)
    p("EXECUTION OVERLAY RL — WALK-FORWARD ANALYSIS")
    p("=" * 58)
    for _, r in folds.iterrows():
        p(f"\n## Fold {int(r['fold'])}")
        p(f"Return: {r['overlay_return_pct']:+.2f}%")
        p(f"Sharpe: {r['overlay_sharpe']:.2f}")
        p(f"Sortino: {r['overlay_sortino']:.2f}")
        p(f"Max Drawdown: {r['overlay_max_dd_pct']:.2f}%")
        p(f"Profit Factor: {r['overlay_profit_factor']:.2f}")
        p(f"Exposure Mean: {r['overlay_exposure_mean']:.3f}")
        p(f"Turnover: {r['overlay_turnover_mean']:.4f}")
        p(f"Tracking Error: {r['overlay_tracking_error_mean']:.4f}")
        p(f"Deterministic Return: {r['det_return_pct']:+.2f}% | Deterministic Sharpe: {r['det_sharpe']:.2f}")

    agg = summary["aggregate"]
    pq = summary["predictive_quality"]
    b = summary["bootstrap"]
    p("\n" + "=" * 58)
    p("AGGREGATED WALK-FORWARD ANALYSIS")
    p("=" * 58)
    p(f"Mean Fold Return: {agg['mean_overlay_return_pct']:+.2f}%")
    p(f"Mean Fold Sharpe: {agg['mean_overlay_sharpe']:.2f}")
    p(f"Median Sharpe: {agg['median_overlay_sharpe']:.2f}")
    if not folds.empty:
        best_idx = folds["overlay_sharpe"].idxmax()
        worst_idx = folds["overlay_sharpe"].idxmin()
        p(f"Best Fold: {int(folds.loc[best_idx, 'fold'])} (Sharpe {folds.loc[best_idx, 'overlay_sharpe']:.2f})")
        p(f"Worst Fold: {int(folds.loc[worst_idx, 'fold'])} (Sharpe {folds.loc[worst_idx, 'overlay_sharpe']:.2f})")
    p(f"Bootstrap Sharpe CI: {b['overlay_sharpe_ci']}")
    p(f"Deterministic Sharpe CI: {b['deterministic_sharpe_ci']}")
    p(f"Overlay - Deterministic Return CI: {b['overlay_minus_det_return_ci']}")
    verdict = "No statistically reliable overlay alpha yet."
    ci = b.get("overlay_minus_det_return_ci", {})
    if isinstance(ci, dict) and ci.get("lo", 0) > 0:
        verdict = "Overlay statistically improves deterministic sizing."
    p(f"Statistical Verdict: {verdict}")

    p("\n" + "=" * 58)
    p("PREDICTIVE QUALITY (ML-STYLE)")
    p("=" * 58)
    p(f"Directional Accuracy: {pq['directional_accuracy']:.3f}")
    p(f"LONG Accuracy: {pq['long_accuracy']:.3f}")
    p(f"SHORT Accuracy: {pq['short_accuracy']:.3f}")
    p(f"Precision: {pq['precision']:.3f} | Recall: {pq['recall']:.3f} | F1: {pq['f1']:.3f}")
    p(f"ROC-AUC: {pq['roc_auc']:.3f}")
    p(f"Confusion Matrix [short,long]: {pq['confusion_matrix']}")
    p("Note: Trading quality is judged primarily by Sharpe/drawdown/profit-factor, not only classification metrics.")

    p("\n" + "=" * 60)
    p("FINAL RESEARCH CONCLUSION")
    p("=" * 60)
    p("* Pure RL learned defensive behavior but lacked reliable alpha.")
    p("* Hybrid predictive + RL sometimes improved fold-level outcomes.")
    p("* Ensemble predictive layer remains the most stable alpha engine.")
    p("* Unconstrained RL can destabilize alpha and should be constrained.")
    p("* Execution-only RL should be retained only if CI confirms incremental value.")
    candidates = {
        "Deterministic Ensemble": (s4["det_sharpe"], s4["det_return_pct"]),
        "Execution Overlay RL": (s4["sharpe"], s4["return_pct"]),
    }
    if s3:
        candidates["Ensemble Confidence Strategy"] = (s3["sharpe"], s3["return_pct"])
    best_name = sorted(candidates.items(), key=lambda kv: (kv[1][0], kv[1][1]), reverse=True)[0][0]
    p(f"* Current best-performing architecture: {best_name}")

    # Plots
    plt.figure(figsize=(8, 4))
    plt.bar(folds["fold"].astype(int) - 0.15, folds["overlay_sharpe"], width=0.3, label="Overlay Sharpe")
    plt.bar(folds["fold"].astype(int) + 0.15, folds["det_sharpe"], width=0.3, label="Deterministic Sharpe")
    plt.axhline(0.0, color="black", linewidth=1)
    plt.title("Fold-wise Sharpe Comparison")
    plt.xlabel("Fold")
    plt.ylabel("Sharpe")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(report_dir, "fold_sharpe_comparison.png"))
    plt.close()

    plt.figure(figsize=(8, 4))
    plt.plot(folds["fold"], folds["overlay_tracking_error_mean"], marker="o", label="Tracking Error")
    plt.plot(folds["fold"], folds["overlay_turnover_mean"], marker="o", label="Turnover")
    plt.title("Execution Diagnostics by Fold")
    plt.xlabel("Fold")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(report_dir, "execution_diagnostics.png"))
    plt.close()

    # Save dedicated pipeline evolution outputs
    evo_json = {
        "stage_comparison": stage,
        "aggregate": summary.get("aggregate", {}),
        "bootstrap": summary.get("bootstrap", {}),
        "best_architecture": best_name,
    }
    with open(os.path.join(report_dir, "pipeline_evolution_summary.json"), "w", encoding="utf-8") as f:
        json.dump(evo_json, f, indent=2)
    evo_rows = [
        {"stage": "stage1_pure_ppo", **(s1 or {})},
        {"stage": "stage2_hybrid_rl_predictive", **(s2 or {})},
        {"stage": "stage3_ensemble_confidence", **(s3 or {})},
        {"stage": "stage4_execution_overlay_rl", **(s4 or {})},
    ]
    pd.DataFrame(evo_rows).to_csv(os.path.join(report_dir, "pipeline_evolution_table.csv"), index=False)
    with open(os.path.join(report_dir, "terminal_summary.log"), "w", encoding="utf-8") as f:
        f.write("\n".join(terminal_lines) + "\n")
    return report_dir


if __name__ == "__main__":
    d = generate_quant_report()
    print(f"Report generated from: {d}")

