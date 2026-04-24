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

def run_script(script_path):
    status_placeholder = st.empty()
    with status_placeholder.container():
        st.info(f"🚀 Executing {script_path}...")
        try:
            result = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
            combined_output = f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
            
            if result.returncode == 0:
                st.success(f"✅ Successfully completed {script_path}!")
                with st.expander("📄 View Execution Logs"):
                    st.code(combined_output)
            else:
                st.error(f"❌ Error executing {script_path}")
                with st.expander("⚠️ View Error Details"):
                    st.code(combined_output)
        except Exception as e:
            st.error(f"💥 System Failure: {str(e)}")

# --- Sidebar Navigation ---
with st.sidebar:
    st.image("https://www.bseindia.com/images/BSE_Logo.png", width=100)
    st.title("Intelligence System")
    st.markdown("---")
    
    page = st.radio(
        "Navigation",
        ["🏠 Market Overview", "🧠 Sentiment Analysis", "💸 Paper Trading", "⚙️ Control Panel"],
        index=0
    )
    
    st.markdown("---")
    st.info("💡 **Architecture**: Phase 1 NLP + Phase 2 Features + PPO RL Engine")

# --- Page Logic ---

if page == "🏠 Market Overview":
    st.title("🏠 SENSEX Market Overview")
    df_sensex = load_csv("data/raw/sensex_ohlcv.csv")
    metrics_json = load_json("data/processed/metrics.json")
    
    if df_sensex is not None:
        latest_data = df_sensex.iloc[-1]
        prev_data = df_sensex.iloc[-2]
        
        # Live Signal Alert
        if metrics_json and 'Live_Inference' in metrics_json:
            inf = metrics_json['Live_Inference']
            signal = inf['signal']
            color = "#00ff00" if "BUY" in signal else ("#ff4b4b" if "SELL" in signal else "#ffaa00")
            st.markdown(f"""
                <div style="background-color: {color}22; padding: 20px; border-radius: 10px; border: 2px solid {color}; margin-bottom: 25px;">
                    <h3 style="margin:0; color:{color};">🎯 Today's AI Signal: {signal}</h3>
                    <p style="margin:5px 0 0 0; opacity:0.8;">Generated for {inf['latest_date']} using Real-time Intelligence Ensemble</p>
                </div>
            """, unsafe_allow_html=True)
            
        # Top Row Metrics
        m1, m2, m3, m4 = st.columns(4)
        price_diff = latest_data['Close'] - prev_data['Close']
        pct_diff = (price_diff / prev_data['Close']) * 100
        
        m1.metric("Current SENSEX", f"{latest_data['Close']:.2f}", f"{pct_diff:.2f}%")
        m2.metric("Day High", f"{latest_data['High']:.2f}")
        m3.metric("Day Low", f"{latest_data['Low']:.2f}")
        m4.metric("Volume", f"{latest_data['Volume']:.0f}")
        
        st.markdown("---")
        
        # Chart Section
        st.subheader("📊 Recent Price Action")
        st.plotly_chart(plot_candlestick(df_sensex.tail(100), "Sensex 100-Day Performance"), width='stretch')
        
        # Technical Data Table
        with st.expander("📋 View Raw Market Data"):
            st.dataframe(df_sensex.tail(20), width='stretch')
    else:
        st.warning("⚠️ Market data not found. Please run 'Fetch Sensex Data' in the Control Panel.")

elif page == "🧠 Sentiment Analysis":
    st.title("🧠 Financial News Sentiment")
    st.markdown("Deep NLP Phase 1 analysis of SENSEX-focused financial news.")
    
    score_df = load_csv("data/processed/daily_sentiment.csv")
    metrics = load_json("data/processed/metrics.json")
    
    if score_df is not None and not score_df.empty:
        col1, col2 = st.columns([1, 2])
        
        latest_score = metrics.get('Current_Exponential_Sentiment', 0) if metrics else 0
            
        with col1:
            st.markdown('<div class="card">', unsafe_allow_html=True)
            st.subheader("Current Market Mood")
            st.plotly_chart(plot_sentiment_gauge(latest_score), width='stretch')
            sentiment_text = "Bullish" if latest_score > 0.1 else ("Bearish" if latest_score < -0.1 else "Neutral")
            st.write(f"**Overall Status**: {sentiment_text}")
            st.markdown('</div>', unsafe_allow_html=True)
            
        with col2:
            st.markdown('<div class="card">', unsafe_allow_html=True)
            st.subheader("Historical Sentiment Trend")
            st.line_chart(score_df.set_index('Date') if 'Date' in score_df.columns else score_df)
            st.markdown('</div>', unsafe_allow_html=True)

        st.markdown("---")
        st.subheader("📰 Latest Scored Intelligence")
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
        
        st.info("✨ **Note**: Scores are generated using a FinBERT + VADER ensemble with Exponential Time-Decay.")

elif page == "💸 Paper Trading":
    st.title("💸 Live Simulation (Paper Trading)")
    trade_log = load_csv("data/processed/ppo_trade_log.csv")
    df_test = load_csv("data/splits/test.csv")
    
    if trade_log is not None and df_test is not None:
        st.subheader("📍 Execution Visualization")
        st.plotly_chart(plot_trade_scatter(df_test, trade_log), width='stretch')
        
        st.markdown("---")
        st.subheader("📜 Recent Executions")
        st.dataframe(trade_log.tail(15), width='stretch')
    else:
        st.warning("⚠️ Simulation data missing. Please run the evaluation pipeline.")

elif page == "⚙️ Control Panel":
    st.title("⚙️ System Operations")
    st.markdown("Trigger data acquisition and AI model components.")
    
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
        st.subheader("🚀 RL Bot Engine")
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
