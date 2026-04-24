import streamlit as st
import plotly.graph_objects as go
import requests
import pandas as pd

def apply_custom_css():
    st.markdown("""
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        html, body, [class*="css"]  {
            font-family: 'Inter', sans-serif;
            background-color: #0e1117;
            color: #fafafa;
        }

        .stButton>button {
            background-color: #4CAF50;
            color: white;
            border-radius: 8px;
            border: none;
            padding: 10px 24px;
            font-weight: 600;
            transition: all 0.3s;
        }

        .stButton>button:hover {
            background-color: #45a049;
            transform: scale(1.02);
            box-shadow: 0px 4px 10px rgba(0,0,0,0.3);
        }
        
        .metric-card {
            background-color: #1e2129;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 4px 6px rgba(0,0,0,0.3);
            text-align: center;
        }
        
        h1, h2, h3 {
            color: #00d2ff;
        }
        </style>
    """, unsafe_allow_html=True)

def load_lottieurl(url: str):
    r = requests.get(url)
    if r.status_code != 200:
        return None
    return r.json()

def plot_candlestick(df: pd.DataFrame, title="Market Price"):
    fig = go.Figure(data=[go.Candlestick(x=df['Date'] if 'Date' in df.columns else df.index,
                open=df['Open'],
                high=df['High'],
                low=df['Low'],
                close=df['Close'],
                increasing_line_color= 'cyan', decreasing_line_color= 'magenta')])

    fig.update_layout(
        title=title,
        xaxis_title="Date",
        yaxis_title="Price",
        template='plotly_dark',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis_rangeslider_visible=False
    )
    return fig

def plot_sentiment_gauge(score: float):
    # Score between -1 (Negative) and 1 (Positive)
    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score,
        domain = {'x': [0, 1], 'y': [0, 1]},
        title = {'text': "Market Sentiment Score"},
        gauge = {
            'axis': {'range': [-1, 1]},
            'bar': {'color': "white"},
            'steps': [
                {'range': [-1, -0.3], 'color': "red"},
                {'range': [-0.3, 0.3], 'color': "gray"},
                {'range': [0.3, 1], 'color': "green"}
            ],
        }
    ))
    fig.update_layout(
        template='plotly_dark',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
    )
    return fig

def plot_trades_on_chart(df: pd.DataFrame, trade_df: pd.DataFrame, title="Paper Trading Simulation"):
    """
    Plots the candlestick chart and overlays the trade signals.
    """
    fig = go.Figure()
    
    # Base Candlestick
    fig.add_trace(go.Candlestick(
        x=df['Date'],
        open=df['Open'],
        high=df['High'],
        low=df['Low'],
        close=df['Close'],
        increasing_line_color='cyan', 
        decreasing_line_color='magenta',
        name='SENSEX'
    ))

    if trade_df is not None and not trade_df.empty:
        # Find transition points (where position changes)
        # Shift position state to find when it changes
        trade_df['Prev_State'] = trade_df['Position_State'].shift(1).fillna(0)
        
        # Open Longs: Transition from anything to 1
        longs = trade_df[(trade_df['Position_State'] == 1) & (trade_df['Prev_State'] != 1)]
        # Open Shorts: Transition from anything to -1
        shorts = trade_df[(trade_df['Position_State'] == -1) & (trade_df['Prev_State'] != -1)]
        # Flat / Close: Transition from 1/-1 to 0
        closes = trade_df[(trade_df['Position_State'] == 0) & (trade_df['Prev_State'] != 0)]

        fig.add_trace(go.Scatter(
            x=longs['Date'], y=longs['Price'],
            mode='markers',
            marker=dict(symbol='triangle-up', size=15, color='green', line=dict(width=2, color='DarkSlateGrey')),
            name='BUY / LONG'
        ))
        
        fig.add_trace(go.Scatter(
            x=shorts['Date'], y=shorts['Price'],
            mode='markers',
            marker=dict(symbol='triangle-down', size=15, color='red', line=dict(width=2, color='DarkSlateGrey')),
            name='SELL / SHORT'
        ))
        
        fig.add_trace(go.Scatter(
            x=closes['Date'], y=closes['Price'],
            mode='markers',
            marker=dict(symbol='x', size=10, color='yellow', line=dict(width=1, color='DarkSlateGrey')),
            name='CLOSE / FLAT'
        ))

    fig.update_layout(
        title=title,
        xaxis_title="Date",
        yaxis_title="Price",
        template='plotly_dark',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        xaxis_rangeslider_visible=False,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
    )
    return fig

def plot_equity_curve(metrics):
    """
    Plots the RL Agent equity curve vs the Buy & Hold benchmark.
    """
    fig = go.Figure()
    
    if 'Equity_Curve' in metrics:
        equity = metrics['Equity_Curve']
        dates = list(range(len(equity)))
        
        fig.add_trace(go.Scatter(
            x=dates, y=equity,
            mode='lines',
            line=dict(color='#00d2ff', width=3),
            name='RL Agent'
        ))
        
    if 'Benchmark_Curve' in metrics:
        bench = metrics['Benchmark_Curve']
        dates = list(range(len(bench)))
        fig.add_trace(go.Scatter(
            x=dates, y=bench,
            mode='lines',
            line=dict(color='#ff4b4b', width=2, dash='dash'),
            name='Buy & Hold'
        ))

    fig.update_layout(
        title="Portfolio Value Over Time",
        xaxis_title="Trading Days",
        yaxis_title="Value (INR)",
        template='plotly_dark',
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
    )
    return fig

def plot_trade_scatter(df, trade_log):
    """
    Alias or wrapper for plot_trades_on_chart to match app.py expectations
    """
    return plot_trades_on_chart(df, trade_log)

