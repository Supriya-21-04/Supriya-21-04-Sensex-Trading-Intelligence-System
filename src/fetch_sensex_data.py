import yfinance as yf
import pandas as pd
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

def main():
    ticker = "^BSESN"
    start_date = "2019-01-01"
    end_date = datetime.now().strftime("%Y-%m-%d")
    
    logging.info(f"Downloading {ticker} data from {start_date} to {end_date}...")
    
    data = yf.download(ticker, start=start_date, end=end_date)
    
    if data.empty:
        logging.error("No data fetched from yfinance.")
        return

    # Handle multi-level columns from newer yfinance versions
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]

    # Verify no missing trading days / NaN rows
    nan_rows = data.isnull().any(axis=1)
    if nan_rows.any():
        logging.warning(f"Found {nan_rows.sum()} rows with NaN values. Forward filling...")
        data = data.ffill()
    else:
        logging.info("No NaN values found in the downloaded data.")

    # Save raw data to CSV as a checkpoint
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'raw')
    os.makedirs(output_dir, exist_ok=True)
    
    csv_path = os.path.join(output_dir, 'sensex_ohlcv.csv')
    data.to_csv(csv_path, encoding='utf-8')
    logging.info(f"Data saved successfully to {os.path.normpath(csv_path)}")
    
    # Log dataset shape and date range
    logging.info(f"Dataset shape: {data.shape}")
    logging.info(f"Date range: {data.index.min().date()} to {data.index.max().date()}")
    
    # Log total rows
    row_count = len(data)
    logging.info(f"Total rows (trading days): {row_count}")

if __name__ == "__main__":
    main()
