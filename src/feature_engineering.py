import os
import pandas as pd
import ta
import numpy as np
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

def calculate_rolling_zscore(series, window=252):
    """Calculates rolling z-score to normalize feature values dynamically."""
    rolling_mean = series.rolling(window=window, min_periods=1).mean()
    rolling_std = series.rolling(window=window, min_periods=1).std()
    
    # Avoid division by zero
    rolling_std = rolling_std.replace(0, np.nan)
    return (series - rolling_mean) / rolling_std

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    price_path = os.path.join(base_dir, '..', 'data', 'raw', 'sensex_ohlcv.csv')
    sentiment_path = os.path.join(base_dir, '..', 'data', 'processed', 'daily_sentiment.csv')
    output_dir = os.path.join(base_dir, '..', 'data', 'processed')
    os.makedirs(output_dir, exist_ok=True)

    logging.info("Loading Raw Price Data...")
    df = pd.read_csv(price_path, encoding='utf-8')
    
    # Ensure proper datetime index for pandas-ta
    df['Date'] = pd.to_datetime(df['Date'])
    df.set_index('Date', inplace=True)
    df.sort_index(inplace=True)

    # 1. Feature Generation using 'ta' (Phase 2 alignment)
    logging.info("Calculating Technical Indicators (SMA, RSI, STO, ATR, OBV)...")
    
    # RSI (14)
    df['RSI_14'] = ta.momentum.RSIIndicator(close=df['Close'], window=14).rsi()
    
    # Stochastic Oscillator (STO)
    stoch = ta.momentum.StochasticOscillator(high=df['High'], low=df['Low'], close=df['Close'], window=14, smooth_window=3)
    df['STO_K'] = stoch.stoch()
    df['STO_D'] = stoch.stoch_signal()
    
    # On-Balance Volume (OBV)
    df['OBV'] = ta.volume.OnBalanceVolumeIndicator(close=df['Close'], volume=df['Volume']).on_balance_volume()
    
    # ATR (14) - used for Regime Flag
    df['ATR_14'] = ta.volatility.AverageTrueRange(high=df['High'], low=df['Low'], close=df['Close'], window=14).average_true_range()
    
    # SMA (50 & 200)
    df['SMA_50'] = ta.trend.SMAIndicator(close=df['Close'], window=50).sma_indicator()
    df['SMA_200'] = ta.trend.SMAIndicator(close=df['Close'], window=200).sma_indicator()
    
    # MACD (Standard)
    macd = ta.trend.MACD(close=df['Close'], window_slow=26, window_fast=12, window_sign=9)
    df['MACD'] = macd.macd()
    
    # 2. Regime Flag Implementation (Phase 2: ATR > 2 identifying MR/AR)
    # Note: ATR values depend on price scale. For SENSEX (~70k), we normalize ATR by price.
    # Logic: High volatility (ATR/Price > threshold) = AR (Alpha Return), Low = MR (Mean Reversion)
    df['Volatility_Ratio'] = (df['ATR_14'] / df['Close']) * 100
    df['Regime_Flag'] = (df['Volatility_Ratio'] > 1.5).astype(float) # 1.5% daily move threshold
    
    # 3. Predictive Target & Leakage Prevention (SHIFT)
    # The agent makes decisions at the end of Day T using data from Day T. 
    # The actual reward/target is what happens on Day T+1.
    df['Next_Day_Close'] = df['Close'].shift(-1)
    df['Target_Return'] = (df['Next_Day_Close'] - df['Close']) / df['Close']
    
    # Clean up purely predictive internal tracker
    df.drop(columns=['Next_Day_Close'], inplace=True)

    # 4. Merge with Sentiment
    # We use Left merge because we want all trading dates, even if sentiment is missing.
    logging.info("Merging with Sentiment Data...")
    if os.path.exists(sentiment_path):
        sentiment_df = pd.read_csv(sentiment_path, encoding='utf-8')
        sentiment_df['Date'] = pd.to_datetime(sentiment_df['Date'])
        
        # Merge on Date
        df = pd.merge(df, sentiment_df[['Date', 'Sentiment']], on='Date', how='left')
        # Fill NaN sentiment with 0.0 (Neutral)
        df['Sentiment'] = df['Sentiment'].fillna(0.0)
    else:
        logging.warning("Sentiment data not found. Using 0.0 for all dates.")
        df['Sentiment'] = 0.0
    
    # 5. Feature Normalization & State Vector (Phase 2: 14-feature total state)
    # Adding daily returns and volume change first
    df['Returns'] = df['Close'].pct_change()
    df['Vol_Change'] = df['Volume'].pct_change()
    
    # Fill any NaNs created by pct_change (the first row) before normalization
    df.fillna(0.0, inplace=True)
    
    # We select 12 core features + 2 agent states = 14 total features for the environment.
    features = [
        'Close', 'RSI_14', 'STO_K', 'MACD',                    # Price & Momentum (4)
        'ATR_14', 'Volatility_Ratio', 'Regime_Flag',           # Volatility & Regime (3)
        'OBV', 'SMA_200',                                      # Volume & Trend (2)
        'Sentiment', 'Returns', 'Vol_Change'                   # Sentiment & Changes (3)
    ]
    # Total = 12 market features
    
    logging.info(f"Normalizing {len(features)} features using Rolling Z-Score...")
    
    # Rolling Z-score normalization (30-day window) to prevent look-ahead bias
    for feat in features:
        # We don't Z-score Regime_Flag (binary) or Sentiment (already normalized -1 to 1)
        if feat not in ['Regime_Flag', 'Sentiment']: 
            df[f'{feat}_z'] = (df[feat] - df[feat].rolling(window=30).mean()) / df[feat].rolling(window=30).std()
    
    # Final feature list
    # Use Z-scored version for tech indicators, raw for Sentiment and Regime_Flag
    final_features = []
    for feat in features:
        if feat in ['Regime_Flag', 'Sentiment']:
            final_features.append(feat)
        else:
            final_features.append(f'{feat}_z')
    
    # Drop rows with NaN from rolling calculations (first 30 rows)
    initial_count = len(df)
    df.dropna(subset=final_features, inplace=True)
    
    logging.info(f"Final Market State Vector (12 features): {final_features}")
    
    # 6. Save Master Dataset
    master_path = os.path.join(output_dir, 'master_dataset.csv')
    df.to_csv(master_path, index=False, encoding='utf-8')
    logging.info(f"Saved master dataset with {len(df)} rows (dropped {initial_count - len(df)} rows due to rolling window).")

if __name__ == "__main__":
    main()
