import os
import requests
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging
from gnews import GNews

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

# Load environment variables
load_dotenv()
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")

class NewsFetcher:
    def __init__(self, queries):
        self.queries = queries
        self.news_data = []
        self.gnews = GNews(language='en', country='IN', period='10d', max_results=10)
        # Exclusion list for non-stock market news (especially crypto)
        self.exclude_keywords = ['BITCOIN', 'CRYPTO', 'BLOCKCHAIN', 'NFT', 'ETHEREUM', 'SOLANA', 'BINANCE']

    def is_relevant(self, headline, description=""):
        """Strict relevance check for SENSEX/BSE news"""
        text_upper = (headline + " " + (description or "")).upper()
        
        # 1. Broad exclusion for non-equity market news
        for word in self.exclude_keywords:
            if word in text_upper:
                return False
        
        # 2. Strict inclusion: Must mention SENSEX or BSE to be highly relevant for this system
        if 'SENSEX' in text_upper or 'BSE' in text_upper:
            return True
            
        return False

    def fetch_newsdata_io(self):
        """Fetch news from NewsData.io focusing on the past 10 days of finance news"""
        if not NEWSDATA_API_KEY:
            logging.error("NewsData.io API key not found in .env. Please add NEWSDATA_API_KEY.")
            return

        for query in self.queries:
            logging.info(f"Fetching news from NewsData.io for query: {query}")
            
            url = "https://newsdata.io/api/1/news"
            params = {
                'apikey': NEWSDATA_API_KEY,
                'q': query,
                'language': 'en',
                'category': 'business',
                'country': 'in' # Focus on India for SENSEX
            }
            
            try:
                response = requests.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    results = data.get('results', [])
                    logging.info(f"Retrieved {len(results)} articles for query '{query}'")
                    
                    for article in results:
                        headline = article.get('title', '')
                        description = article.get('description', '')
                        content = article.get('content', '')
                        
                        # Filter out non-stock news (crypto, etc.) and ensure SENSEX/BSE focus
                        if not self.is_relevant(headline, description):
                            logging.info(f"Skipping non-SENSEX news: {headline[:50]}...")
                            continue

                        pub_date = article.get('pubDate', '')
                        
                        full_text = ""
                        if content and "ONLY AVAILABLE IN PAID PLANS" not in content.upper():
                            full_text = content
                        elif description and "ONLY AVAILABLE IN PAID PLANS" not in description.upper():
                            full_text = description
                        else:
                            full_text = headline
                            
                        source = article.get('source_id', 'Unknown')
                        logging.info(f"[{pub_date}] {headline} ({source})")
                        
                        self.news_data.append({
                            "Date": pub_date,
                            "Ticker": "SENSEX", 
                            "Headline": headline,
                            "Full_Text": full_text,
                            "Source": f"NewsData.io ({source})"
                        })
                else:
                    logging.error(f"NewsData.io API error for query '{query}': {response.status_code} - {response.text}")
            except Exception as e:
                logging.error(f"NewsData.io fetch error for query '{query}': {e}")

    def fetch_gnews_backup(self):
        """Fetch news from GNews as a backup source"""
        logging.info("Fetching backup news from GNews...")
        for query in self.queries:
            try:
                articles = self.gnews.get_news(query)
                logging.info(f"Retrieved {len(articles)} articles from GNews for query '{query}'")
                for article in articles:
                    headline = article.get('title', '')
                    description = article.get('description', '')
                    
                    # Strict relevance check for SENSEX/BSE
                    if not self.is_relevant(headline, description):
                        continue

                    self.news_data.append({
                        "Date": article.get('published date', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                        "Ticker": "SENSEX",
                        "Headline": headline,
                        "Full_Text": description or headline,
                        "Source": f"GNews ({article.get('publisher', {}).get('title', 'Unknown')})"
                    })
            except Exception as e:
                logging.error(f"GNews fetch error for query '{query}': {e}")

    def save_to_csv(self):
        if not self.news_data:
            logging.warning("No news data fetched. Check your API key and internet connection.")
            return

        df = pd.DataFrame(self.news_data)
        
        # Ensure Date column is in datetime format
        # Using format='mixed' to handle different date formats from NewsData.io and GNews
        # Using utc=True to avoid offset-naive vs offset-aware comparison errors
        df['Date'] = pd.to_datetime(df['Date'], errors='coerce', format='mixed', utc=True)
        
        # Drop rows where Date could not be parsed
        df.dropna(subset=['Date'], inplace=True)
        
        # Filter for only the last 10 days including today
        ten_days_ago = datetime.now(df['Date'].dt.tz) - timedelta(days=10)
        df = df[df['Date'] >= ten_days_ago]
        
        # Sort by Date descending
        df.sort_values("Date", ascending=False, inplace=True)
        
        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'raw')
        os.makedirs(output_dir, exist_ok=True)
        
        csv_path = os.path.join(output_dir, 'news_headlines.csv')
        df.to_csv(csv_path, index=False)
        logging.info(f"Successfully saved {len(df)} headlines to {os.path.normpath(csv_path)}")

def main():
    # Split queries into strictly SENSEX and BSE specific terms
    queries = [
        "SENSEX",
        "BSE SENSEX",
        "BSE India",
        "Sensex Index"
    ]
    
    fetcher = NewsFetcher(queries)
    
    # 1. Fetch from NewsData.io
    fetcher.fetch_newsdata_io()
    
    # 2. Fetch from GNews Backup
    fetcher.fetch_gnews_backup()
    
    # 3. Save all to CSV
    fetcher.save_to_csv()

if __name__ == "__main__":
    main()
