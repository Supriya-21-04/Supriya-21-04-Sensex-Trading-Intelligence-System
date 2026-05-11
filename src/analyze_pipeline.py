from __future__ import annotations

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.evaluate_execution_overlay import run_execution_overlay_analysis
from src.generate_quant_report import generate_quant_report


def main():
    out_dir = run_execution_overlay_analysis()
    final_dir = generate_quant_report(out_dir)
    print("\n" + "=" * 58)
    print("ANALYSIS COMPLETE")
    print("=" * 58)
    print(f"Saved reports and plots to: {final_dir}")


if __name__ == "__main__":
    main()

