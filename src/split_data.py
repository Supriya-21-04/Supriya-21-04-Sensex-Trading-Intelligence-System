import pandas as pd
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Read from master_dataset.csv which contains the 14-feature state vector
    data_path = os.path.join(base_dir, '..', 'data', 'processed', 'master_dataset.csv')
    splits_dir = os.path.join(base_dir, '..', 'data', 'splits')
    
    os.makedirs(splits_dir, exist_ok=True)

    if not os.path.exists(data_path):
        logging.error(f"Master dataset not found at {data_path}. Run feature_engineering.py first.")
        return

    logging.info(f"Loading master dataset from {os.path.normpath(data_path)}")
    df = pd.read_csv(data_path)
    
    # Ensure Date is datetime and sorted
    df['Date'] = pd.to_datetime(df['Date'])
    df.sort_values('Date', inplace=True)
    df.set_index('Date', inplace=True)
    logging.info("Sorted dataframe by date ascending.")

    # Time-ordered split (70/15/15 as per Phase 2 diagram)
    total_len = len(df)
    train_end = int(total_len * 0.70)
    val_end = int(total_len * 0.85)
    
    train_df = df.iloc[:train_end]
    val_df = df.iloc[train_end:val_end]
    test_df = df.iloc[val_end:]
    
    logging.info(f"Split completed: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}")

    # 4. Assert no date overlap between splits
    assert train_df.index[-1] < val_df.index[0], "Error: Overlap between Train and Validation sets!"
    assert val_df.index[-1] < test_df.index[0], "Error: Overlap between Validation and Test sets!"
    logging.info("Assertion passed: No date overlap between Train, Val, and Test splits.")
    
    logging.info(f"Train date range: {train_df.index.min().date()} to {train_df.index.max().date()}")
    logging.info(f"Val date range:   {val_df.index.min().date()} to {val_df.index.max().date()}")
    logging.info(f"Test date range:  {test_df.index.min().date()} to {test_df.index.max().date()}")

    # 5. Save each split to separate CSVs
    train_path = os.path.join(splits_dir, 'train.csv')
    val_path = os.path.join(splits_dir, 'val.csv')
    test_path = os.path.join(splits_dir, 'test.csv')

    train_df.to_csv(train_path)
    val_df.to_csv(val_path)
    test_df.to_csv(test_path)

    logging.info(f"Saved splits to {os.path.normpath(splits_dir)}")

if __name__ == "__main__":
    main()
