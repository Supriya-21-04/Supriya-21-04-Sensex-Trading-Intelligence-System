import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import os
import json
import subprocess
import sys
from datetime import datetime
from src.dashboard_components import (
    plot_candlestick, 
    plot_sentiment_gauge, 
    plot_equity_curve,
    plot_trade_scatter
)

# --- Page Config ---
st.set_page_config(
    page_title="SENSEX Trading Intelligence",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS for Modern Look ---
st.markdown("""
    <style>
    .main {
        background-color: #0e1117;
    }
    .stMetric {
        background-color: #1e2130;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #3e4250;
    }
    .stButton>button {
        width: 100%;
        border-radius: 5px;
        height: 3em;
        background-color: #2e7bcf;
        color: white;
    }
    .stButton>button:hover {
        background-color: #1e5faf;
        border: 1px solid #ffffff;
    }
    .sidebar .sidebar-content {
        background-color: #11141c;
    }
    h1, h2, h3 {
        color: #ffffff;
    }
    .status-box {
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    .card {
        background-color: #1e2130;
        padding: 20px;
        border-radius: 10px;
        border: 1px solid #3e4250;
        margin-bottom: 20px;
    }
    .help-text {
        color: #808495;
        font-size: 0.9em;
        margin-top: 5px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- Helper Functions ---
def load_csv(file_path):
    if os.path.exists(file_path):
        return pd.read_csv(file_path)
    return None

def load_json(file_path):
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            return json.load(f)
    return None

def run_script(script_path, status_container=None):
    container = status_container or st.empty()
    with container.container():
        st.info(f"🚀 Executing {script_path}...")
        try:
            result = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
            combined_output = f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
            
            if result.returncode == 0:
                st.success(f"✅ Successfully completed {script_path}!")
                with st.expander("📄 View Execution Logs"):
                    st.code(combined_output)
                return True
            else:
                st.error(f"❌ Error executing {script_path}")
                with st.expander("⚠️ View Error Details"):
                    st.code(combined_output)
                return False
        except Exception as e:
            st.error(f"💥 System Failure: {str(e)}")
            return False

def run_full_pipeline():
    """Run the complete data and inference pipeline in order"""
    st.subheader("🔄 Running Full Pipeline...")
    
    # Pipeline steps in order
    scripts = [
        "src/fetch_sensex_data.py",
        "src/fetch_news.py",
        "src/score_sentiment.py",
        "src/feature_engineering.py",
        "src/live_inference.py",
        "src/explain_live_signal.py"
    ]
    
    # Execute each script
    success = True
    for i, script in enumerate(scripts):
        st.markdown(f"**Step {i+1} of {len(scripts)}:** {script}")
        step_container = st.empty()
        if not run_script(script, step_container):
            success = False
            st.error("❌ Pipeline stopped due to error.")
            break
        st.markdown("---")
    
    if success:
        st.success("🎉 Full pipeline completed successfully! Refresh the page to see the latest data.")

# --- Sidebar Navigation ---
with st.sidebar:
    st.title("SENSEX Intelligence System")
    st.markdown("---")
    
    page = st.radio(
        "Navigation",
        ["🏠 Home & Overview", "📰 News & Mood", "🎲 Paper Trading Demo", "⚙️ Settings & Tools"],
        index=0
    )
    
    st.markdown("---")
    
    # Beginner Help Section
    with st.expander("❓ Need Help?"):
        st.markdown("""
        **Welcome!** Here are some quick tips:
        
        - **Home**: See what the stock market is doing today
        - **News**: Understand how people feel about the market
        - **Paper Trading**: Watch our AI practice trading (no real money!)
        - **Settings**: Update data or run the AI
        
        💡 **Paper Trading**: This means the AI is practicing with pretend money - no risk!
        """)


# --- Page Logic ---

if page == "🏠 Home & Overview":
    st.title("🏠 Welcome to SENSEX Market Overview!")
    
    # Beginner Welcome Section
    with st.expander("👋 First time here? Click me!"):
        st.markdown("""
        **What is SENSEX?**  
        It's an index that tracks the top 30 companies on the Bombay Stock Exchange (BSE). Think of it like a "report card" for the Indian stock market!
        
        **What you'll see here:**
        - Current market level
        - How it's changed today
        - What our AI thinks about buying/selling
        """)
    
    df_sensex = load_csv("data/raw/sensex_ohlcv.csv")
    metrics_json = load_json("data/processed/metrics.json")
    
    if df_sensex is not None:
        latest_data = df_sensex.iloc[-1]
        prev_data = df_sensex.iloc[-2]
        
        # Live Signal Alert
        if metrics_json and 'Live_Inference' in metrics_json:
            inf = metrics_json['Live_Inference']
            signal = inf['signal']
            prediction_date = inf.get('prediction_date', inf.get('latest_date', ''))
            data_date = inf.get('data_date', '')
            color = "#00ff00" if "BUY" in signal else ("#ff4b4b" if "SELL" in signal else "#ffaa00")
            st.markdown(f"""
                <div style="background-color: {color}22; padding: 20px; border-radius: 10px; border: 2px solid {color}; margin-bottom: 25px;">
                    <h3 style="margin:0; color:{color};">🎯 Today's AI Suggestion: {signal}</h3>
                    <p style="margin:5px 0 0 0; opacity:0.8;">
                        Prediction for {prediction_date} using data from {data_date}
                    </p>
                </div>
            """, unsafe_allow_html=True)
            explanation = inf.get('explanation')
            factors = inf.get('key_factors', [])
            if explanation:
                st.info(f"🧾 Why this signal: {explanation}")
            if isinstance(factors, list) and factors:
                st.caption("Key factors: " + " | ".join([str(item) for item in factors[:5]]))
            
        # Top Row Metrics
        st.subheader("📊 Today's Key Numbers")
        m1, m2, m3, m4 = st.columns(4)
        price_diff = latest_data['Close'] - prev_data['Close']
        pct_diff = (price_diff / prev_data['Close']) * 100
        
        m1.metric("Current SENSEX", f"{latest_data['Close']:.2f}", f"{pct_diff:.2f}%")
        m1.markdown('<div class="help-text">The current "score" of the market</div>', unsafe_allow_html=True)
        
        m2.metric("Highest Today", f"{latest_data['High']:.2f}")
        m2.markdown('<div class="help-text">The highest point reached today</div>', unsafe_allow_html=True)
        
        m3.metric("Lowest Today", f"{latest_data['Low']:.2f}")
        m3.markdown('<div class="help-text">The lowest point today</div>', unsafe_allow_html=True)
        
        m4.metric("Trading Activity", f"{latest_data['Volume']:.0f}")
        m4.markdown('<div class="help-text">How many shares were traded</div>', unsafe_allow_html=True)
        
        st.markdown("---")
        
        # Chart Section
        st.subheader("� How the Market Has Moved (Last 100 Days)")
        with st.expander("🤔 What is this chart?"):
            st.markdown("""
            This is a **candlestick chart** - don't worry, it's easier than it looks!
            
            - 🟢 **Green candle**: Market went up that day
            - 🔴 **Red candle**: Market went down that day
            - Each "wick" (the thin lines) shows the highest and lowest points that day
            """)
        st.plotly_chart(plot_candlestick(df_sensex.tail(100), "Sensex 100-Day Performance"), width='stretch')
        
        # Technical Data Table
        with st.expander("📋 View Detailed Data"):
            st.dataframe(df_sensex.tail(20), width='stretch')
    else:
        st.warning("⚠️ Market data not found. Please go to Settings & Tools and click 'Update Market Data'.")

elif page == "📰 News & Mood":
    st.title("📰 What People Are Saying About the Market")
    
    # Beginner Explanation
    with st.expander("🤔 What is 'Sentiment'?"):
        st.markdown("""
        **Sentiment** = How people *feel* about the market!
        
        We read lots of financial news and use AI to figure out:
        - 😊 **Positive**: Good news, people might buy
        - 😐 **Neutral**: Neither good nor bad
        - 😟 **Negative**: Bad news, people might sell
        
        The gauge below shows the overall mood!
        """)
    
    score_df = load_csv("data/processed/daily_sentiment.csv")
    metrics = load_json("data/processed/metrics.json")
    
    if score_df is not None and not score_df.empty:
        col1, col2 = st.columns([1, 1])
        
        latest_score = metrics.get('Current_Exponential_Sentiment', 0) if metrics else 0
            
        with col1:
            st.markdown('<div class="card">', unsafe_allow_html=True)
            st.subheader("Current Market Mood")
            st.plotly_chart(plot_sentiment_gauge(latest_score), width='stretch')
            sentiment_text = "😊 Positive (Bullish)" if latest_score > 0.1 else ("😟 Negative (Bearish)" if latest_score < -0.1 else "😐 Neutral")
            st.write(f"**Overall Mood**: {sentiment_text}")
            with st.expander("🤔 What do these words mean?"):
                st.markdown("""
                - **Bullish**: People think the market will go up 📈
                - **Bearish**: People think the market will go down 📉
                """)
            st.markdown('</div>', unsafe_allow_html=True)

        st.markdown("---")
        st.subheader("📰 Latest News Stories")
        news_scored_df = load_csv("data/processed/news_headlines_scored.csv")
        if news_scored_df is not None and not news_scored_df.empty:
            display_df = news_scored_df.sort_values('Date', ascending=False).head(20)
            
            def color_sentiment(val):
                color = '#00ff00' if val > 0.1 else ('#ff4b4b' if val < -0.1 else '#808495')
                return f'color: {color}; font-weight: bold'

            st.dataframe(
                display_df[['Date', 'Headline', 'Sentiment', 'Source']].style.applymap(color_sentiment, subset=['Sentiment']),
                width='stretch'
            )
        
        st.info("✨ Scores are generated by AI analyzing financial news!")

elif page == "🎲 Paper Trading Demo":
    st.title("🎲 Watch Our AI Practice Trading!")
    
    # Beginner Explanation
    with st.expander("� What is Paper Trading?"):
        st.markdown("""
        **Paper Trading** = Practicing with pretend money! 🎮
        
        Our AI uses historical data to practice buying and selling. This helps us see how well it would have done in the past - without risking any real money!
        
        **What the chart shows:**
        - 🟢 **Green triangle**: AI bought (went "long")
        - 🔴 **Red triangle**: AI sold (went "short")
        - 🟡 **Yellow X**: AI closed its position
        """)
    
    trade_log = load_csv("data/processed/ppo_trade_log.csv")
    df_test = load_csv("data/splits/test.csv")
    
    if trade_log is not None and df_test is not None:
        st.subheader("📍 AI's Trading Activity")
        st.plotly_chart(plot_trade_scatter(df_test, trade_log), width='stretch')
        
        st.markdown("---")
        st.subheader("📜 Recent AI Actions")
        st.dataframe(trade_log.tail(15), width='stretch')
    else:
        st.warning("⚠️ Demo data missing. Please go to Settings & Tools to set it up!")

elif page == "⚙️ Settings & Tools":
    st.title("⚙️ Settings & Tools")
    
    # Beginner Explanation
    with st.expander("👋 What do these buttons do?"):
        st.markdown("""
        **Quick Start (One Click!)**:
        - 🚀 **Run All**: Do everything automatically - update market data, fetch news, analyze sentiment, and get today's AI suggestion
        
        **Data Pipeline** (Left side):
        - 🔄 **Update Market Data**: Get the latest stock market numbers
        - 📰 **Fetch Latest News**: Get recent financial news stories
        - 🧠 **Run Sentiment AI**: Analyze the news to see how people feel
        
        **AI Bot Engine** (Right side):
        - These are more advanced settings for training and testing the AI
        - You don't need to use these unless you want to experiment!
        """)
    
    # Run All Button at the top
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.subheader("🚀 Quick Start - One Click!")
    if st.button("✨ Run All (Update Everything)"):
        run_full_pipeline()
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.subheader("📥 Data Pipeline")
        if st.button("🔄 Update Market Data"):
            run_script("src/fetch_sensex_data.py")
        if st.button("📰 Fetch Latest News"):
            run_script("src/fetch_news.py")
        if st.button("🧠 Run Sentiment AI"):
            run_script("src/score_sentiment.py")
        st.markdown('</div>', unsafe_allow_html=True)
        
    with col2:
        st.markdown('<div class="card">', unsafe_allow_html=True)
        st.subheader("🚀 AI Bot Engine (Advanced)")
        if st.button("🏗️ Engineer Features"):
            run_script("src/feature_engineering.py")
        if st.button("📐 Split Datasets"):
            run_script("src/split_data.py")
        if st.button("🎓 Train PPO Agent"):
            run_script("src/train_ppo.py")
        if st.button("🧪 Evaluate Agent"):
            run_script("src/evaluate_agent.py")
        if st.button("🎯 Get Live Signal"):
            run_script("src/live_inference.py")
        st.markdown('</div>', unsafe_allow_html=True)
