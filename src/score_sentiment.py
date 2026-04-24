import os
import pandas as pd
import torch
from transformers import pipeline
import matplotlib.pyplot as plt
import logging
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import nltk
import numpy as np
from datetime import datetime, date
import spacy

# Ensure VADER lexicon is downloaded
try:
    nltk.data.find('sentiment/vader_lexicon.zip')
except LookupError:
    nltk.download('vader_lexicon')

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess
    import sys
    subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

def spacy_ner_filter(text):
    """
    spaCy NER filter to keep only market-related news.
    Returns True if relevant entities are found.
    """
    doc = nlp(text)
    # Market-related entity labels
    relevant_labels = {'ORG', 'GPE', 'MONEY', 'PRODUCT', 'EVENT', 'PERCENT', 'QUANTITY'}
    
    entities = [ent.label_ for ent in doc.ents]
    # Check if any relevant entity is present
    if any(label in relevant_labels for label in entities):
        return True
    return False

def map_score(label, score):
    """Convert FinBERT label and confidence to directional float."""
    if label.lower() == 'positive':
        return float(score)
    elif label.lower() == 'negative':
        return -float(score)
    return 0.0  # Neutral

def get_weighted_sentiment(finbert_score, vader_score, text):
    """
    Combines FinBERT (Deep Learning) with VADER (Lexicon-based) 
    and adds weight for critical financial keywords.
    """
    # 1. Base Ensemble (60% FinBERT, 40% VADER)
    # FinBERT is great for context, VADER is great for catching explicit 'emotional' words.
    base_score = (finbert_score * 0.6) + (vader_score * 0.4)
    
    # 2. Critical Keyword Boosting
    # Certain words are extremely strong signals in finance.
    text_lower = text.lower()
    boost = 0.0
    
    positive_boosters = ['surge', 'rally', 'upgrade', 'outperform', 'beat', 'bullish', 'expansion']
    negative_boosters = ['crash', 'plunge', 'downgrade', 'underperform', 'miss', 'bearish', 'recession', 'default']
    
    for word in positive_boosters:
        if word in text_lower: boost += 0.05
    for word in negative_boosters:
        if word in text_lower: boost -= 0.05
        
    final_score = base_score + boost
    # Clip between -1 and 1
    return max(min(final_score, 1.0), -1.0)

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    news_path = os.path.join(base_dir, '..', 'data', 'raw', 'news_headlines.csv')
    price_path = os.path.join(base_dir, '..', 'data', 'raw', 'sensex_ohlcv.csv')
    processed_dir = os.path.join(base_dir, '..', 'data', 'processed')
    plots_dir = os.path.join(base_dir, '..', 'data', 'plots')
    
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)

    if not os.path.exists(news_path):
        logging.error("No news data found to score.")
        return

    # 1. Load Data
    news_df = pd.read_csv(news_path)
    news_df['Date'] = pd.to_datetime(news_df['Date']).dt.date
    
    # 2. Init Analyzers
    logging.info("Loading Advanced Sentiment Ensemble (FinBERT + VADER)...")
    device = 0 if torch.cuda.is_available() else -1 
    finbert_analyzer = pipeline(
        "sentiment-analysis", 
        model="ProsusAI/finbert", 
        device=device,
        truncation=True, 
        max_length=512
    )
    vader_analyzer = SentimentIntensityAnalyzer()

    # 3. Score Each Article with Phase 1 Filtering (spaCy NER)
    logging.info(f"Scoring {len(news_df)} articles with spaCy NER filter and Ensemble Logic...")
    sentiments = []
    filtered_indices = []
    
    print("\n" + "=" * 60)
    print("PHASE 1: spaCy NER FILTERING & ENSEMBLE SCORING")
    print("=" * 60)
    
    for idx, row in news_df.iterrows():
        text_to_analyze = str(row.get('Full_Text', row['Headline']))
        headline = str(row['Headline'])
        
        # apply spaCy NER filter as per Phase 1 diagram
        if not spacy_ner_filter(text_to_analyze):
            logging.debug(f"Filtering out non-market news: {headline[:50]}...")
            sentiments.append(0.0)
            continue
            
        filtered_indices.append(idx)
        try:
            # FinBERT Score (Core of Phase 1)
            fb_res = finbert_analyzer(text_to_analyze)[0]
            fb_score = map_score(fb_res['label'], fb_res['score'])
            
            # VADER Score for ensemble accuracy
            v_res = vader_analyzer.polarity_scores(text_to_analyze)
            v_score = v_res['compound']
            
            # Weighted Final Score
            final_score = get_weighted_sentiment(fb_score, v_score, text_to_analyze)
            sentiments.append(final_score)
            
            if len(filtered_indices) <= 20: 
                print(f"[PASSED NER | {final_score:>5.2f}] {headline[:60]}...")
        except Exception as e:
            logging.error(f"Error processing article: {headline[:30]}... -> {e}")
            sentiments.append(0.0)

    news_df['Sentiment'] = sentiments
    logging.info(f"Phase 1 Complete: {len(filtered_indices)} articles passed NER filter.")
    
    # 4. Exponential Time-Decay Weighting for Global Score
    logging.info("Calculating Exponential Time-Decay Sentiment...")
    
    # Convert dates to datetime objects for math
    today = date.today()
    
    def calculate_decay_weight(article_date, decay_rate=0.3):
        """Exponential decay formula: W = e^(-lambda * t)"""
        days_old = (today - article_date).days
        return np.exp(-decay_rate * max(0, days_old))

    news_df['Weight'] = news_df['Date'].apply(calculate_decay_weight)
    
    # Calculate weighted average
    weighted_sum = (news_df['Sentiment'] * news_df['Weight']).sum()
    total_weight = news_df['Weight'].sum()
    
    if total_weight > 0:
        global_weighted_score = weighted_sum / total_weight
    else:
        global_weighted_score = 0.0
        
    logging.info(f"Global Time-Weighted Sentiment (10-Day Decay): {global_weighted_score:.4f}")

    # Save the individual fully scored raw headlines
    scored_raw_path = os.path.join(processed_dir, 'news_headlines_scored.csv')
    news_df.to_csv(scored_raw_path, index=False)
    
    # Save the global weighted score to a small JSON for the dashboard gauge
    import json
    metrics_path = os.path.join(processed_dir, 'metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
    else:
        metrics = {}
    
    metrics['Current_Exponential_Sentiment'] = global_weighted_score
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)

    # 5. Group by Date & Ticker, Aggregate via Mean (for the trend line)
    logging.info("Aggregating daily scores for trend visualization...")
    daily_scores = news_df.groupby(['Date', 'Ticker'])['Sentiment'].mean().reset_index()
    
    # 6. Overlap with 5-Year Price Date Index
    logging.info("Aligning with OHLCV 5-year timeline...")
    price_df = pd.read_csv(price_path)
    price_df['Date'] = pd.to_datetime(price_df['Date']).dt.date
    
    # Create master timeframe df
    master_dates = pd.DataFrame({'Date': price_df['Date'].unique()})
    
    index_daily_scores = daily_scores.groupby('Date')['Sentiment'].mean().reset_index()
    
    final_df = pd.merge(master_dates, index_daily_scores, on='Date', how='left')
    
    # Assign 0 for days with no news
    final_df['Sentiment'] = final_df['Sentiment'].fillna(0.0)
    
    # [NEW] Append the global weighted score as a virtual "Latest" entry if not already present
    # This ensures the gauge always picks up the weighted score
    if not final_df.empty:
        # We don't overwrite the last day's real news average, but we'll use 
        # the global score in the app.py specifically for the gauge.
        pass

    # Save final daily sentiment
    final_csv_path = os.path.join(processed_dir, 'daily_sentiment.csv')
    final_df.to_csv(final_csv_path, index=False)
    logging.info(f"Saved daily sentiment to {os.path.normpath(final_csv_path)}")

    # 7. Plot Sentiment Timeline over 5 years
    plt.figure(figsize=(15, 5))
    plt.plot(final_df['Date'], final_df['Sentiment'], color='purple', alpha=0.7, linewidth=1.2, label='Daily Mean Sentiment')
    
    # Add a horizontal line for the current weighted global score
    plt.axhline(global_weighted_score, color='blue', linestyle='--', alpha=0.5, label=f'Global Weighted: {global_weighted_score:.2f}')
    
    # Fill positive green, negative red
    plt.fill_between(final_df['Date'], final_df['Sentiment'], 0, where=(final_df['Sentiment'] > 0), color='green', alpha=0.3, interpolate=True)
    plt.fill_between(final_df['Date'], final_df['Sentiment'], 0, where=(final_df['Sentiment'] < 0), color='red', alpha=0.3, interpolate=True)
    
    plt.axhline(0, color='black', linewidth=0.8, linestyle='-')
    plt.title('SENSEX Sentiment Analysis (Exponential Decay Weighting)', fontsize=14, fontweight='bold')
    plt.xlabel('Date')
    plt.ylabel('Sentiment Score (-1.0 to 1.0)')
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.legend()
    plt.tight_layout()
    
    plot_path = os.path.join(plots_dir, 'sentiment_5yr_timeline.png')
    plt.savefig(plot_path, dpi=300)
    logging.info(f"Saved plot to {os.path.normpath(plot_path)}")

if __name__ == "__main__":
    main()
