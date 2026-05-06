import os
import pandas as pd
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from gymnasium.utils.env_checker import check_env
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

class SensexTradingEnv(gym.Env):
    """
    Advanced Long/Short Trading Environment.
    Action Space: 3 (0: FLAT, 1: LONG, 2: SHORT)
    Observation Space: 16 features (14 Tech + 1 Sentiment + 1 Agent Position)
    """
    metadata = {'render_modes': ['human']}

    def __init__(self, data_path=None, df=None):
        super(SensexTradingEnv, self).__init__()
        
        if df is not None:
            self.df = df.reset_index(drop=True)
        elif data_path is not None:
            self.df = pd.read_csv(data_path)
        else:
            raise ValueError("Must provide either data_path or df.")
        
        # Phase 2: 12 Market Features + 2 Agent States = 14 Feature State Vector
        self.feature_cols = [
            'Close_z', 'RSI_14_z', 'STO_K_z', 'MACD_z',
            'ATR_14_z', 'Volatility_Ratio_z', 'Regime_Flag',
            'OBV_z', 'SMA_200_z', 'Sentiment', 'Returns_z', 'Vol_Change_z'
        ]
        
        # Action space: 0 = Target FLAT, 1 = Target LONG, 2 = Target SHORT
        self.action_space = spaces.Discrete(3)
        
        # Observation space: 12 features + 1 Position state + 1 Days Held = 14
        self.observation_space = spaces.Box(
            low=-np.inf, 
            high=np.inf, 
            shape=(14,), 
            dtype=np.float32
        )
        
        # Trading parameters
        self.INITIAL_CAPITAL = 100000.0
        self.TRADE_FEE = 5.0 # Only applied on Exit/Closure
        
        # State variables
        self.current_step = 0
        self.cash = self.INITIAL_CAPITAL
        self.shares_held = 0
        self.position_state = 0 # 0=Flat, 1=Long, -1=Short
        self.days_held = 0
        self.prev_portfolio_value = self.INITIAL_CAPITAL

    def _get_mtm_portfolio(self, current_price):
        """Calculate Mark-To-Market Value of Portfolio accounting for Short Liability"""
        if self.position_state == 1:
            return self.cash + (self.shares_held * current_price)
        elif self.position_state == -1:
            return self.cash - (self.shares_held * current_price)
        else:
            return self.cash

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.current_step = 0
        self.cash = self.INITIAL_CAPITAL
        self.shares_held = 0
        self.position_state = 0
        self.days_held = 0
        self.prev_portfolio_value = self.INITIAL_CAPITAL
        
        return self._get_observation(), {}

    def _get_observation(self):
        market_obs = self.df.loc[self.current_step, self.feature_cols].values.astype(np.float32)
        agent_position = np.array([float(self.position_state)], dtype=np.float32)
        days_tracker = np.array([float(self.days_held)], dtype=np.float32)
        
        obs = np.concatenate((market_obs, agent_position, days_tracker))
        obs = np.nan_to_num(obs, nan=0.0)
        return obs

    def step(self, action):
        current_price = self.df.loc[self.current_step, 'Close']
        trade_executed = False
        
        # Map action to target position
        target_position = 0
        if action == 1: target_position = 1
        elif action == 2: target_position = -1

        # [NEW] Enforce 5-Day Max Limit Rule
        limit_breached = False
        if self.position_state != 0 and self.days_held >= 5:
            target_position = 0  # FORCED LIQUIDATION to Flat
            limit_breached = True

        # Mark previous exactly before action
        self.prev_portfolio_value = self._get_mtm_portfolio(current_price)

        # STATE TRANSITION LOGIC
        if self.position_state != target_position:
            # 1. Close Existing Position
            if self.position_state == 1: # Close Long
                self.cash += (self.shares_held * current_price) - self.TRADE_FEE
                self.shares_held = 0
                trade_executed = True
            elif self.position_state == -1: # Cover Short
                self.cash -= (self.shares_held * current_price) + self.TRADE_FEE
                self.shares_held = 0
                trade_executed = True
                
            self.position_state = 0
            self.days_held = 0 # Reset holding clock on transition
            
            # 2. Open New Target Position
            if target_position == 1: # Open Long
                max_shares = int(self.cash // current_price)
                if max_shares > 0:
                    self.cash -= (max_shares * current_price)
                    self.shares_held = max_shares
                    self.position_state = 1
                    trade_executed = True
                    
            elif target_position == -1: # Open Short
                max_shares = int(self.cash // current_price)
                if max_shares > 0:
                    # Receive cash from short selling borrowed shares
                    self.cash += (max_shares * current_price)
                    self.shares_held = max_shares
                    self.position_state = -1
                    trade_executed = True
        else:
            if self.position_state != 0:
                self.days_held += 1 # Advance holding clock if maintaining position

        # Advance Time
        self.current_step += 1
        done = self.current_step >= len(self.df) - 1
        truncated = False
        
        # Calculate new MTM Value
        if not done:
            new_price = self.df.loc[self.current_step, 'Close']
        else:
            new_price = current_price
            
        curr_portfolio_value = self._get_mtm_portfolio(new_price)

        # Calculate Alpha Returns
        if self.prev_portfolio_value > 0:
            agent_return = (curr_portfolio_value - self.prev_portfolio_value) / self.prev_portfolio_value
        else:
            agent_return = 0.0
            
        if not done:
            market_return = (new_price - current_price) / current_price
        else:
            market_return = 0.0
            
        # RL Reward Math (Focusing on Accuracy & Alpha vs Baseline)
        raw_alpha = agent_return - market_return
        
        # Asymmetric Win Bias implementation (Double positive alpha discovery to boost win rate priority)
        if raw_alpha > 0:
            reward = raw_alpha * 20000.0  # x2 Multiplier applied!
        else:
            reward = raw_alpha * 10000.0

        # [NEW] The Holding Cost and Eviction Penalty
        if self.position_state != 0:
            reward -= (self.days_held * 50.0) # Margin Time Bleed (Theta decay)
            
        if limit_breached:
            reward -= 10000.0 # Violent eviction penalty
            
        # Terminal obs should match observation_space shape (14,)
        obs = self._get_observation() if not done else np.zeros(self.observation_space.shape, dtype=np.float32)
        
        info = {
            'portfolio_value': curr_portfolio_value,
            'cash': self.cash,
            'shares_held': self.shares_held,
            'trade_executed': trade_executed,
            'position_state': self.position_state,
            'days_held': self.days_held,
            'limit_breached': limit_breached,
            'current_step': self.current_step,
            'current_price': float(new_price)
        }

        return obs, reward, done, truncated, info

def test_environment():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, '..', 'data', 'processed', 'master_dataset.csv')
    
    env = SensexTradingEnv(data_path)
    check_env(env, warn=True)
    logging.info("SUCCESS: Advanced Short-Selling Environment passed standard check_env() validation!")

if __name__ == "__main__":
    test_environment()
