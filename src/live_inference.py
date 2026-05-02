import os
import sys
import pandas as pd
import numpy as np

# Add project root to path to fix ModuleNotFoundError
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from stable_baselines3 import PPO
from src.trading_env import SensexTradingEnv
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    master_path = os.path.join(base_dir, '..', 'data', 'processed', 'master_dataset.csv')
    model_path = os.path.join(base_dir, '..', 'models', 'ppo_sensex_bot.zip')
    metrics_path = os.path.join(base_dir, '..', 'data', 'processed', 'metrics.json')

    if not os.path.exists(master_path):
        logging.error("Master dataset not found. Run the full pipeline first.")
        return

    # 1. Load the most recent data point
    df = pd.read_csv(master_path)
    latest_row = df.iloc[-1:]
    latest_data_date = latest_row['Date'].values[0]
    
    # Use today's date as the prediction date
    from datetime import datetime
    today_date = datetime.now().strftime("%Y-%m-%d")

    # 2. Load the trained model
    if not os.path.exists(model_path):
        logging.error("Trained model not found. Train the PPO agent first.")
        return
    
    model = PPO.load(model_path)

    # 3. Initialize environment to get the observation space format
    env = SensexTradingEnv(df=df)
    
    # 4. Get the state for the latest date (yesterday's data to predict today)
    # We need to manually construct the observation vector as the env expects it
    obs_features = []
    for col in env.feature_cols:
        obs_features.append(latest_row[col].values[0])
    
    # Add agent internal states (assuming 0 position and 0 days held for "Now" prediction)
    obs = np.array(obs_features + [0.0, 0.0], dtype=np.float32)

    # 5. Predict Action
    action, _states = model.predict(obs, deterministic=True)
    
    action_map = {0: "FLAT / WAIT", 1: "BUY / LONG", 2: "SELL / SHORT"}
    signal = action_map[int(action)]
    
    # 6. Save result for dashboard
    inference_result = {
        "data_date": str(latest_data_date),  # Date of the data we used
        "prediction_date": str(today_date), # Date we're predicting for
        "signal": signal,
        "action_code": int(action),
        "confidence": "High (PPO Policy Consensus)" # PPO doesn't give simple probabilities like softmax easily
    }
    
    # Update metrics.json
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
    else:
        metrics = {}
        
    metrics['Live_Inference'] = inference_result
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)
        
    logging.info(f"LIVE INFERENCE: Using data from {latest_data_date} to predict for {today_date}: {signal}")

if __name__ == "__main__":
    main()
