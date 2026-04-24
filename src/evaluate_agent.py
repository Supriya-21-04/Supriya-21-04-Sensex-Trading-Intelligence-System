import os
import pandas as pd
import numpy as np
from stable_baselines3 import PPO
import logging

from trading_env import SensexTradingEnv

logging.basicConfig(level=logging.INFO, format='%(message)s')

def calculate_metrics(portfolio_values, trades_list=None):
    """Calculates rigorous quantitative metrics for a portfolio trace."""
    portfolio_series = pd.Series(portfolio_values)
    initial_val = portfolio_series.iloc[0]
    final_val = portfolio_series.iloc[-1]
    
    # Total Return
    total_return = (final_val / initial_val - 1.0) * 100.0
    
    # CAGR
    years = len(portfolio_series) / 252.0
    # Guard against zero/negative years
    if years <= 0: years = 1.0 
    cagr = ((final_val / initial_val) ** (1 / years) - 1.0) * 100.0
    
    # Sharpe Ratio
    daily_returns = portfolio_series.pct_change().dropna()
    mean_return = daily_returns.mean()
    std_return = daily_returns.std()
    
    if std_return == 0 or pd.isna(std_return):
        sharpe = 0.0
    else:
        sharpe = (mean_return / std_return) * np.sqrt(252)
        
    # Max Drawdown
    rolling_max = portfolio_series.cummax()
    drawdown = (portfolio_series - rolling_max) / rolling_max
    max_drawdown = drawdown.min() * 100.0
    
    # Win Rate calculation
    win_rate = 0.0
    if trades_list and len(trades_list) > 0:
        wins = sum(1 for t in trades_list if t['pnl'] > 0)
        win_rate = (wins / len(trades_list)) * 100.0

    return {
        'Final Value': final_val,
        'Total Return (%)': total_return,
        'CAGR (%)': cagr,
        'Sharpe Ratio': sharpe,
        'Max Drawdown (%)': max_drawdown,
        'Win Rate (%)': win_rate,
        'Total Trades': len(trades_list) if trades_list else 0
    }

def run_simulation(env_df, strategy_type, ppo_model=None):
    """
    Generalized simulation runner for different strategies.
    strategy_type: 'RL', 'RANDOM', 'MA_CROSSOVER', 'BUY_HOLD'
    """
    env = SensexTradingEnv(df=env_df)
    obs, info = env.reset()
    
    portfolio_history = [env.INITIAL_CAPITAL]
    trade_log = []
    completed_trades = []
    
    entry_price = 0.0
    current_pos = 0 # 0=Flat, 1=Long, -1=Short
    shares_snapshot = 0
    
    for i in range(len(env_df) - 1):
        if strategy_type == 'RL' and ppo_model is not None:
            action, _ = ppo_model.predict(obs, deterministic=True)
            action = int(action) 
            
        elif strategy_type == 'RANDOM':
            action = env.action_space.sample()
            
        elif strategy_type == 'MA_CROSSOVER':
            # Buy if fast > slow, Short if fast < slow
            if env_df.iloc[i]['SMA_50'] > env_df.iloc[i]['SMA_200']:
                action = 1
            else:
                action = 2
                
        elif strategy_type == 'BUY_HOLD':
            action = 1 if i == 0 else 1 # Perpetually target LONG

        curr_price = env_df.iloc[i]['Close']
        date_stamp = env_df.iloc[i]['Date']

        target_pos = 0
        if action == 1: target_pos = 1
        elif action == 2: target_pos = -1

        # Evaluate pending closure for PnL
        if current_pos != 0 and current_pos != target_pos:
            if current_pos == 1:
                pnl = (curr_price - entry_price) * shares_snapshot - env.TRADE_FEE
            elif current_pos == -1:
                pnl = (entry_price - curr_price) * shares_snapshot - env.TRADE_FEE
            completed_trades.append({'pnl': pnl})
            
        obs, reward, done, truncated, info = env.step(action)
        
        # Open new position tracking
        if target_pos != 0 and current_pos != target_pos:
            entry_price = curr_price
            shares_snapshot = info['shares_held']
            
        current_pos = target_pos
        
        portfolio_history.append(info['portfolio_value'])
        
        if strategy_type == 'RL':
            act_str = "FLAT" if action==0 else ("LONG" if action==1 else "SHORT")
            trade_log.append({
                "Date": date_stamp,
                "Action_Target": act_str,
                "Price": curr_price,
                "Position_State": info.get('position_state', current_pos),
                "Portfolio_Value": info['portfolio_value']
            })

        if done:
            break

    metrics = calculate_metrics(portfolio_history, completed_trades)
    return metrics, trade_log

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Phase 2: Use the designated Test Split
    test_path = os.path.join(base_dir, '..', 'data', 'splits', 'test.csv')
    model_path = os.path.join(base_dir, '..', 'models', 'ppo_sensex_bot.zip')
    output_dir = os.path.join(base_dir, '..', 'data', 'processed')
    
    if not os.path.exists(test_path):
        logging.error(f"Test split not found at {test_path}. Run split_data.py first.")
        return
        
    logging.info(f"Loading Test Dataset: {os.path.normpath(test_path)}")
    test_df = pd.read_csv(test_path)
    
    if test_df.empty:
        logging.error("Test dataframe is empty! Cannot run validation.")
        return

    # 1. Evaluate RL Agent
    logging.info("Loading Trained PPO Agent...")
    try:
        model = PPO.load(model_path)
    except Exception as e:
        logging.error(f"Could not load PPO model from {model_path}: {e}")
        return

    logging.info("="*50)
    logging.info("SIMULATING REINFORCEMENT LEARNING AGENT")
    logging.info("="*50)
    rl_metrics, rl_trade_log = run_simulation(test_df, 'RL', ppo_model=model)
    
    # Save Trade Log
    log_df = pd.DataFrame(rl_trade_log)
    trade_log_path = os.path.join(base_dir, '..', 'data', 'processed', 'ppo_trade_log.csv')
    log_df.to_csv(trade_log_path, index=False)
    logging.info(f"Complete RL Trade Log saved to {os.path.normpath(trade_log_path)}")

    # 2. Evaluate Baselines
    logging.info("Simulating Baseline Strategy: Random Execution...")
    rand_metrics, _ = run_simulation(test_df, 'RANDOM')

    logging.info("Simulating Baseline Strategy: Moving Average Crossover (50/200)...")
    ma_metrics, _ = run_simulation(test_df, 'MA_CROSSOVER')

    logging.info("Simulating Baseline Strategy: Global Benchmark (Buy & Hold NIFTY/SENSEX Proxy)...")
    bh_metrics, _ = run_simulation(test_df, 'BUY_HOLD')

    # 3. Print Assessment Table
    print("\n\n" + "="*80)
    print("FINAL OUT-OF-SAMPLE BENCHMARK ASSESSMENT (Jan 2023 - Jan 2024)")
    print("="*80)
    print(f"{'Strategy':<20} | {'Final Value':<12} | {'Tot Ret (%)':<11} | {'Sharpe':<8} | {'Max DD (%)':<10} | {'Win Rate (%)':<12}")
    print("-" * 80)
    
    metrics_list = [
        ("RL Agent (Ours)", rl_metrics),
        ("Buy & Hold (Index)", bh_metrics),
        ("MA Crossover", ma_metrics),
        ("Random Monkey", rand_metrics)
    ]

    for name, metrics in metrics_list:
        print(f"{name:<20} | {metrics['Final Value']:<12.2f} | {metrics['Total Return (%)']:<11.2f} | {metrics['Sharpe Ratio']:<8.2f} | {metrics['Max Drawdown (%)']:<10.2f} | {metrics['Win Rate (%)']:<12.2f}")
    
    # Save to JSON
    import json
    metrics_dict = {name: m for name, m in metrics_list}
    json_path = os.path.join(base_dir, '..', 'data', 'processed', 'metrics.json')
    with open(json_path, 'w') as f:
        json.dump(metrics_dict, f, indent=4)
        
    print("="*80)
    
if __name__ == "__main__":
    main()
