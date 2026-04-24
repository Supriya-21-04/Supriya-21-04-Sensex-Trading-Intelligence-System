import os
import pandas as pd
import matplotlib.pyplot as plt
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    plots_dir = os.path.join(base_dir, '..', 'data', 'plots')
    os.makedirs(plots_dir, exist_ok=True)

    price_path = os.path.join(base_dir, '..', 'data', 'raw', 'sensex_ohlcv.csv')
    news_path = os.path.join(base_dir, '..', 'data', 'raw', 'news_headlines.csv')

    print("=" * 50)
    print("DATA VALIDATION & QA REPORT")
    print("=" * 50)

    # 1. Check Price Data
    if not os.path.exists(price_path):
        logging.error("Price data not found.")
        return
        
    price_df = pd.read_csv(price_path)
    price_df['Date'] = pd.to_datetime(price_df['Date']).dt.date
    price_df.set_index('Date', inplace=True)
    price_df.sort_index(inplace=True)

    min_date = price_df.index.min()
    max_date = price_df.index.max()
    
    # Generate business days (excluding weekends) to find missing gaps
    expected_dates = pd.bdate_range(start=min_date, end=max_date).date
    actual_dates = price_df.index.values
    missing_dates = set(expected_dates) - set(actual_dates)
    
    # We expect some holidays in India to be "missing" from standard Business Days.
    print(f"\n[PRICE DATA]: {min_date} to {max_date}")
    print(f"Total trading days: {len(price_df)}")
    if not missing_dates:
        print("-> STATUS: PERFECT. No missing weekdays.")
    else:
        print(f"-> STATUS: OK. Found {len(missing_dates)} missing business days (Likely Exchange Holidays).")
        # Print first 5 missing just to show examples
        print(f"   Examples of missing days: {list(missing_dates)[:5]}")

    # 2. Check News Data
    has_news = False
    if os.path.exists(news_path):
        news_df = pd.read_csv(news_path)
        has_news = True
        
        # We need raw datetime for overlap check, but extract purely Date for matching days
        news_df['Raw_Date'] = pd.to_datetime(news_df['Date'])
        news_df['Date_Only'] = news_df['Raw_Date'].dt.date
        
        total_headlines = len(news_df)
        news_df.drop_duplicates(subset=['Headline'], inplace=True)
        unique_headlines = len(news_df)
        dupes_removed = total_headlines - unique_headlines

        print(f"\n[NEWS DATA]")
        print(f"Total headlines fetched: {total_headlines}")
        if dupes_removed > 0:
            print(f"-> WARNING: Found and removed {dupes_removed} duplicated headlines.")
        else:
            print("-> STATUS: CLEAN. No duplicate headlines found.")
            
        news_min_date = news_df['Date_Only'].min()
        news_max_date = news_df['Date_Only'].max()
        print(f"News Coverage: {news_min_date} to {news_max_date}")

        # 3. Ensure Date Ranges Match
        print(f"\n[DATASET OVERLAP]")
        if pd.isna(news_min_date) or pd.isna(news_max_date):
            print("-> News dataset doesn't have valid dates.")
        else:
            if news_min_date > max_date or news_max_date < min_date:
                print("-> CRITICAL WARNING: ZERO overlap between your historical price data and your news data!")
                print("   (Reason: Yahoo Finance data is historical [2019-2024], but free News APIs only pull *today's* news).")
            else:
                overlap_start = max(min_date, news_min_date)
                overlap_end = min(max_date, news_max_date)
                print(f"-> STATUS: Matching! Overlap found from {overlap_start} to {overlap_end}")

    # 4. Plot Raw Price Data visually
    print("\n[VISUALIZATION]")
    plt.figure(figsize=(14, 7))
    plt.plot(price_df.index, price_df['Close'], color='#0ea5e9', linewidth=1.5, label='SENSEX Close Price')
    
    # Styling
    plt.title('S&P BSE SENSEX Daily Closing Price (2019 - 2024)', fontsize=16, fontweight='bold')
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Closing Price (INR)', fontsize=12)
    plt.grid(True, linestyle='--', alpha=0.6)
    plt.legend()
    plt.tight_layout()
    
    plot_path = os.path.join(plots_dir, 'raw_price_data.png')
    plt.savefig(plot_path, dpi=300)
    print(f"-> SUCCESS: Chart plotted and saved to {os.path.normpath(plot_path)}")
    print("=" * 50)

if __name__ == "__main__":
    main()
