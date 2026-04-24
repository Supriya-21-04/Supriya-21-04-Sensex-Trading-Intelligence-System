import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from stable_baselines3 import PPO
from stable_baselines3.common.monitor import Monitor
import logging

from trading_env import SensexTradingEnv

logging.basicConfig(level=logging.INFO, format='%(message)s')

def moving_average(values, window):
    weights = np.repeat(1.0, window) / window
    return np.convolve(values, weights, 'valid')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, '..', 'data', 'processed', 'master_dataset.csv')
    models_dir = os.path.join(base_dir, '..', 'models')
    logs_dir = os.path.join(base_dir, '..', 'logs')
    plots_dir = os.path.join(base_dir, '..', 'data', 'plots')
    
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(logs_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)

    # 1. Load Split Data (Phase 2 alignment)
    logging.info("Loading Train/Val datasets from splits folder...")
    train_path = os.path.join(base_dir, '..', 'data', 'splits', 'train.csv')
    val_path = os.path.join(base_dir, '..', 'data', 'splits', 'val.csv')
    
    if not os.path.exists(train_path):
        logging.error(f"Splits not found at {train_path}. Run split_data.py first.")
        return
        
    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    
    logging.info(f"Train Set Shape: {train_df.shape}")
    logging.info(f"Val Set Shape:   {val_df.shape}")

    # Set up wrapped Train Environment
    raw_env = SensexTradingEnv(df=train_df)
    train_env = Monitor(raw_env, logs_dir)

    # 2. Configure PPO Agent
    logging.info("\nConfiguring PPO Agent Deep-Learning Model...")
    model = PPO(
        policy="MlpPolicy",
        env=train_env,
        learning_rate=0.0003,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        verbose=0  # Suppress internal spam for cleaner script execution
    )

    # 3. Train the Agent (Initial Phase)
    INITIAL_TIMESTEPS = 50000
    logging.info(f"Phase 1: Training PPO Agent for {INITIAL_TIMESTEPS} timesteps...")
    
    model.learn(total_timesteps=INITIAL_TIMESTEPS)
    logging.info("Phase 1: Training Complete.")

    # 4. Analyze Learning Curve (Verification Step)
    monitor_path = os.path.join(logs_dir, 'monitor.csv')
    y = []
    x = []
    
    if os.path.exists(monitor_path):
        import csv
        with open(monitor_path, 'r') as f:
            lines = f.readlines()
        for idx, line in enumerate(lines[2:]):
            parts = line.split(',')
            if len(parts) >= 1:
                try:
                    y.append(float(parts[0]))
                    x.append(idx)
                except ValueError:
                    pass
    
    y = np.array(y)
    x = np.array(x)
    
    if len(y) > 10:
        # Check if the last 20% of episodes performed better than the first 20% of episodes
        fifth_idx = max(int(len(y)*0.2), 1)
        first_mean_rewards = np.mean(y[:fifth_idx])
        recent_mean_rewards = np.mean(y[-fifth_idx:])
        
        logging.info(f"Initial Phase Mean Reward: {first_mean_rewards:.2f}")
        logging.info(f"Recent Phase Mean Reward:  {recent_mean_rewards:.2f}")
        
        improving = recent_mean_rewards > first_mean_rewards
    else:
        improving = True # Insufficient episodes to definitively reject, assume learning
        
    # Plot phase 1 curve to disk
    plt.figure(figsize=(10,5))
    if len(y) > 0:
        plt.plot(x, y, alpha=0.3)
        if len(y) > 10:
            plt.plot(x[len(x)-len(moving_average(y, 10)):], moving_average(y, 10), color='blue', linewidth=2)
    plt.title('PPO Portfolio Performance Learning Curve (50k Steps)')
    plt.xlabel('Episodes')
    plt.ylabel('Episodic Reward (Profit)')
    plt.grid(True)
    plt.savefig(os.path.join(plots_dir, 'ppo_learning_curve_50k.png'))
    plt.close()

    # 5. Extend Training or Adjust Strategy
    model_save_path = os.path.join(models_dir, 'ppo_sensex_bot')
    
    if improving:
        logging.info("\n-> Agent displays upward profit trend. Extending training to 100,000 total timesteps...")
        model.learn(total_timesteps=50000, reset_num_timesteps=False)
        logging.info("Phase 2: Training Complete (100k timesteps total).")
    else:
        logging.warning("\n-> Agent did not display strong upward trend. You may need to tune hyperparameters.")
        logging.info("Saving initial 50k model regardless.")

    # Save trained model to models/ folder
    model.save(model_save_path)
    logging.info(f"\nFinal RL Model successfully saved to {os.path.normpath(model_save_path)}.zip")

if __name__ == "__main__":
    main()
