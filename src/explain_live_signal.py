import json
import logging
import os
from datetime import datetime, timezone

import pandas as pd
import requests
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")


def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def load_latest_context(master_path: str) -> dict:
    df = pd.read_csv(master_path)
    latest = df.iloc[-1].to_dict()
    # Provide both raw and normalized values so the LLM can reason with richer context.
    selected = {
        "date": str(latest.get("Date", "")),
        "close": safe_float(latest.get("Close", 0.0)),
        "high": safe_float(latest.get("High", 0.0)),
        "low": safe_float(latest.get("Low", 0.0)),
        "open": safe_float(latest.get("Open", 0.0)),
        "volume": safe_float(latest.get("Volume", 0.0)),
        "rsi_14": safe_float(latest.get("RSI_14", 0.0)),
        "stoch_k": safe_float(latest.get("STO_K", 0.0)),
        "stoch_d": safe_float(latest.get("STO_D", 0.0)),
        "macd": safe_float(latest.get("MACD", 0.0)),
        "atr_14": safe_float(latest.get("ATR_14", 0.0)),
        "volatility_ratio": safe_float(latest.get("Volatility_Ratio", 0.0)),
        "regime_flag": safe_int(latest.get("Regime_Flag", 0)),
        "obv": safe_float(latest.get("OBV", 0.0)),
        "sma_50": safe_float(latest.get("SMA_50", 0.0)),
        "sma_200": safe_float(latest.get("SMA_200", 0.0)),
        "sentiment": safe_float(latest.get("Sentiment", 0.0)),
        "returns": safe_float(latest.get("Returns", 0.0)),
        "vol_change": safe_float(latest.get("Vol_Change", 0.0)),
        "target_return": safe_float(latest.get("Target_Return", 0.0)),
        "close_z": safe_float(latest.get("Close_z", 0.0)),
        "rsi_14_z": safe_float(latest.get("RSI_14_z", 0.0)),
        "stoch_k_z": safe_float(latest.get("STO_K_z", 0.0)),
        "macd_z": safe_float(latest.get("MACD_z", 0.0)),
        "atr_14_z": safe_float(latest.get("ATR_14_z", 0.0)),
        "volatility_ratio_z": safe_float(latest.get("Volatility_Ratio_z", 0.0)),
        "obv_z": safe_float(latest.get("OBV_z", 0.0)),
        "sma_200_z": safe_float(latest.get("SMA_200_z", 0.0)),
        "returns_z": safe_float(latest.get("Returns_z", 0.0)),
        "vol_change_z": safe_float(latest.get("Vol_Change_z", 0.0)),
    }
    return selected


def load_top_news(news_scored_path: str, latest_date: str, top_k: int = 6) -> list[dict]:
    if not os.path.exists(news_scored_path):
        return []
    try:
        df = pd.read_csv(news_scored_path)
        if df.empty:
            return []
        if "Date" not in df.columns or "Headline" not in df.columns:
            return []
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        cutoff = pd.to_datetime(latest_date, errors="coerce")
        if pd.notna(cutoff):
            df = df[df["Date"] >= (cutoff - pd.Timedelta(days=7))]
        df = df.dropna(subset=["Date", "Headline"])
        if df.empty:
            return []
        if "Sentiment" not in df.columns:
            df["Sentiment"] = 0.0
        df["Sentiment"] = pd.to_numeric(df["Sentiment"], errors="coerce").fillna(0.0)
        df["impact_abs"] = df["Sentiment"].abs()
        df = df.sort_values(["impact_abs", "Date"], ascending=[False, False]).head(top_k)
        articles = []
        for _, row in df.iterrows():
            articles.append(
                {
                    "date": row["Date"].strftime("%Y-%m-%d"),
                    "headline": str(row.get("Headline", "")).strip(),
                    "sentiment": round(safe_float(row.get("Sentiment", 0.0)), 4),
                    "source": str(row.get("Source", "")).strip(),
                }
            )
        return articles
    except Exception as exc:
        logging.warning("Unable to load top news context: %s", exc)
        return []


def normalize_signal_label(signal: str) -> str:
    text = (signal or "").upper()
    if "SELL" in text:
        return "SELL"
    if "BUY" in text:
        return "BUY"
    if "HOLD" in text or "WAIT" in text or "FLAT" in text:
        return "HOLD"
    return "HOLD"


def fallback_explanation(signal: str, c: dict) -> tuple[str, list[str]]:
    regime_text = "high-volatility trend regime" if c["regime_flag"] == 1 else "lower-volatility mean-reversion regime"
    factors = [
        "Recent price strength",
        "Short-term market mood from news",
        "Current trend pressure",
        "Size of daily market swings",
    ]

    normalized = normalize_signal_label(signal)
    if normalized == "BUY":
        explanation = (
            "SUMMARY\n"
            "- The model gives BUY, which means it expects prices to move higher soon.\n\n"
            "WHY THE MODEL IS SAYING THIS\n"
            "- Buyers are currently stronger than sellers, so recent price action supports an upward move.\n"
            "- News mood is supportive, so confidence is helping the market stay firm.\n"
            "- Price swings are manageable enough for an upward move to continue if conditions stay stable.\n\n"
            "WHAT THE NEWS IS SAYING\n"
            "- Recent headlines are not strongly negative, so panic selling pressure is limited.\n"
            "- Positive or stable news flow is helping the market hold up.\n\n"
            "WHAT COULD GO WRONG\n"
            "- This BUY view can fail if negative headlines appear and sellers quickly take control.\n\n"
            "BOTTOM LINE FOR A BEGINNER\n"
            "- Why BUY: buyers are in control and news is not hurting confidence.\n"
            "- What to do now: avoid rushing in with full money at once; enter in small steps and watch the next session."
        )
    elif normalized == "SELL":
        explanation = (
            "SUMMARY\n"
            "- The model gives SELL, which means it expects prices to weaken further soon.\n\n"
            "WHY THE MODEL IS SAYING THIS\n"
            "- Sellers are currently stronger than buyers, so recent price action points downward.\n"
            "- News mood is negative, which is increasing fear and short-term selling pressure.\n"
            "- Price swings are large, so downside moves can become sharper than usual.\n\n"
            "WHAT THE NEWS IS SAYING\n"
            "- Current headlines are adding pressure instead of support.\n"
            "- Negative stories are making traders more defensive.\n\n"
            "WHAT COULD REVERSE THIS SIGNAL\n"
            "- This SELL view can reverse if strong positive news appears and buyers regain control for more than one session.\n\n"
            "BOTTOM LINE FOR A BEGINNER\n"
            "- Why SELL: sellers are in control and news is currently hurting confidence.\n"
            "- What to do now: avoid fresh buying right now and wait for clear signs that the market has stabilized."
        )
    else:
        explanation = (
            "SUMMARY\n"
            "- The model gives HOLD, which means direction is not clear enough for a confident BUY or SELL.\n\n"
            "WHY THE MODEL IS SAYING THIS\n"
            "- Buyers and sellers are both active, so neither side is clearly in control.\n"
            "- News mood is mixed, so confidence keeps shifting.\n"
            "- Price behavior does not show a strong one-way move yet.\n\n"
            "WHAT THE NEWS IS SAYING\n"
            "- Headlines are mixed, so there is no single clear market story right now.\n"
            "- Some updates support prices, while others create caution.\n\n"
            "WHAT COULD GO WRONG\n"
            "- This HOLD view can fail if a strong one-sided move starts with supportive follow-through.\n\n"
            "BOTTOM LINE FOR A BEGINNER\n"
            "- Why HOLD: the market is unclear, so risk-reward is not attractive yet.\n"
            "- What to do now: wait and watch; take action only when direction becomes clearer."
        )
    return explanation, factors


def parse_json_response(content: str) -> dict:
    raw = (content or "").strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Handle fenced markdown responses.
    if "```" in raw:
        chunks = [chunk.strip() for chunk in raw.split("```") if chunk.strip()]
        for chunk in chunks:
            if chunk.lower().startswith("json"):
                chunk = chunk[4:].strip()
            try:
                return json.loads(chunk)
            except json.JSONDecodeError:
                continue
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start : end + 1])
        except json.JSONDecodeError:
            return {}
    return {}


def ensure_beginner_five_section_format(explanation: str, signal: str, context: dict, top_news: list[dict]) -> str:
    text = (explanation or "").strip()
    is_sell_signal = normalize_signal_label(signal) == "SELL"
    section_4_heading = "WHAT COULD REVERSE THIS SIGNAL" if is_sell_signal else "WHAT COULD GO WRONG"
    required_headings = [
        "SUMMARY",
        "WHY THE MODEL IS SAYING THIS",
        "WHAT THE NEWS IS SAYING",
        section_4_heading,
        "BOTTOM LINE FOR A BEGINNER",
    ]
    has_dot_bullets = "\n-" in text
    if all(marker in text.upper() for marker in required_headings) and len(text.split()) >= 120 and has_dot_bullets:
        return text

    vol = safe_float(context.get("volatility_ratio", 0.0))
    sentiment = safe_float(context.get("sentiment", 0.0))
    regime = "high" if safe_int(context.get("regime_flag", 0)) == 1 else "normal"
    close = safe_float(context.get("close", 0.0))
    move = safe_float(context.get("returns", 0.0)) * 100.0
    top = top_news[:2]
    head_1 = top[0]["headline"] if len(top) > 0 else "No major headline was available today"
    head_2 = top[1]["headline"] if len(top) > 1 else "News flow was mixed with no single dominant story"
    s_upper = signal.upper()
    direction = "down" if "SELL" in s_upper else "up" if "BUY" in s_upper else "sideways"

    return (
        f"SUMMARY\n"
        f"- The model gives a {signal} signal, which means it expects the Sensex to move {direction} in the near term.\n\n"
        f"WHY THE MODEL IS SAYING THIS\n"
        f"- Because recent price action shows {('sellers are stronger than buyers' if 'SELL' in s_upper else 'buyers are stronger than sellers' if 'BUY' in s_upper else 'both sides are evenly matched')}, the short-term direction is {('downward' if 'SELL' in s_upper else 'upward' if 'BUY' in s_upper else 'unclear')}.\n"
        f"- Because the last few sessions show a {('downward drift' if 'SELL' in s_upper else 'steady upward push' if 'BUY' in s_upper else 'mixed pattern')}, confidence in this signal is {('moderate' if 'HOLD' in s_upper else 'higher')}.\n"
        f"- Because market swings are {('large' if vol >= 1.5 else 'moderate')}, risk is {('high and moves can be sharp' if vol >= 1.5 else 'present but more controlled')}.\n\n"
        f"WHAT THE NEWS IS SAYING\n"
        f"- Headlines like \"{head_1}\" and \"{head_2}\" are affecting confidence.\n"
        f"- Because news mood is {('mostly negative' if sentiment < -0.05 else 'mostly positive' if sentiment > 0.05 else 'mixed')}, it is {('adding pressure on prices' if sentiment < -0.05 else 'supporting prices' if sentiment > 0.05 else 'not giving a clear push either way')}.\n\n"
        f"{section_4_heading}\n"
        f"- This signal can fail if strong positive news appears or if volatility cools quickly and buyers return.\n\n"
        f"BOTTOM LINE FOR A BEGINNER\n"
        f"- Why {signal}: sellers vs buyers balance, trend direction, and news mood all point this way right now.\n"
        f"- What to do now: {('avoid fresh buying and wait for stability before entering' if 'SELL' in s_upper else 'consider small step-by-step buying, not one large entry' if 'BUY' in s_upper else 'wait for clearer direction before taking a new position')}.\n"
        f"- Sensex closed around {close:.2f} after a {move:.2f}% move in a {regime}-volatility setup."
    )


def call_groq(
    signal: str, inference: dict, context: dict, top_news: list[dict], api_key: str, model: str
) -> tuple[str, list[str], dict]:
    normalized_signal = normalize_signal_label(signal)
    rsi_value = safe_float(context.get("rsi_14", 0.0))
    macd_value = safe_float(context.get("macd", 0.0))
    stoch_value = safe_float(context.get("stoch_k", 0.0))
    atr_value = safe_float(context.get("atr_14", 0.0))
    vol_ratio = safe_float(context.get("volatility_ratio", 0.0))
    returns_pct = safe_float(context.get("returns", 0.0)) * 100.0
    sentiment_value = safe_float(context.get("sentiment", 0.0))
    regime_flag = safe_int(context.get("regime_flag", 0))

    rsi_interp = (
        "the market may be overheated"
        if rsi_value >= 70
        else "the market may be oversold"
        if rsi_value <= 30
        else "momentum is balanced and not extreme"
    )
    macd_interp = "upward momentum is stronger" if macd_value >= 0 else "downward momentum is stronger"
    volatility_regime = "HIGH" if regime_flag == 1 else "NORMAL"
    top_news_3 = top_news[:3]
    section_4_heading = "WHAT COULD REVERSE THIS SIGNAL" if normalized_signal == "SELL" else "WHAT COULD GO WRONG"

    system_prompt = (
        "You are a senior equity market strategist explaining a model signal for a retail dashboard. "
        "Explain in simple, beginner-friendly English with no jargon. "
        "Use concrete values and headline references. "
        "Do not claim certainty. "
        "Only use these signal labels: BUY, HOLD, SELL. Never mention any alternate trade labels. "
        "If the final signal is SELL, do not list strong bullish drivers. "
        "In that case rename the bullish section idea to 'What could reverse this signal' and give exactly one reversal point only. "
        "Never contradict the final signal when discussing supporting drivers. "
        "Never use vague phrases like 'leaning toward the model's signal direction' or 'not strongly supportive'. "
        "Be direct and explain in plain simple English for a first-time user. "
        "Do not use indicator acronyms like RSI, MACD, ATR, OBV, stochastic, or regime in the explanation text. "
        "Convert all technical signals into plain language such as buyer strength, trend direction, news mood, and risk level. "
        "For every key point, prefer a because-then style: 'Because X, the model expects Y'."
    )
    user_prompt = (
        f"Our AI model has generated a {normalized_signal} signal for BSE Sensex on {inference.get('prediction_date', '')}.\n\n"
        "Here is the market data from the previous trading day:\n\n"
        "PRICE DATA:\n"
        f"- Current Sensex closing price: {safe_float(context.get('close', 0.0)):.2f}\n"
        f"- The market moved {returns_pct:.2f}% today\n\n"
        "MOMENTUM INDICATORS (these tell us if the market is gaining or losing speed):\n"
        f"- RSI = {rsi_value:.2f} — RSI measures if the market is moving too fast up or down. Above 70 means possibly overheated, below 30 means possibly oversold. Current value suggests {rsi_interp}\n"
        f"- MACD = {macd_value:.3f} — MACD compares two moving averages to detect trend changes. Positive means upward momentum, negative means downward. Currently {macd_interp}\n"
        f"- Stochastic = {stoch_value:.2f} — Shows if price is near recent highs or lows. Above 80 means near recent high, below 20 means near recent low.\n\n"
        "VOLATILITY (how much the market is swinging):\n"
        f"- ATR = {atr_value:.2f} — Average True Range measures daily price swings in points. Higher means more uncertainty.\n"
        f"- Volatility regime = {volatility_regime} — Our model detected {volatility_regime} market swings recently\n\n"
        "TREND INDICATORS:\n"
        f"- OBV = {safe_float(context.get('obv', 0.0)):.2f} — On Balance Volume tracks whether big investors are buying or selling based on volume patterns\n\n"
        "SENTIMENT DATA:\n"
        f"- Mean sentiment score today = {sentiment_value:.3f} (scale minus 1 to plus 1, negative means bad news dominates)\n\n"
        "TOP NEWS HEADLINES AFFECTING THIS SIGNAL:\n"
        f"{json.dumps(top_news_3, ensure_ascii=True)}\n\n"
        f"Based on all of the above, our model says {normalized_signal}.\n\n"
        "Please explain this signal in simple English that anyone can understand. Use clean section headings without numeric prefixes.\n\n"
        "Use these exact section headings:\n"
        "SUMMARY\n"
        "WHY THE MODEL IS SAYING THIS\n"
        "WHAT THE NEWS IS SAYING\n"
        f"{section_4_heading}\n"
        "BOTTOM LINE FOR A BEGINNER\n\n"
        "Inside each section, write short dot-point bullets using '-' (dash). "
        "Do not use numbered lists anywhere. Keep it crisp and readable like an analyst note.\n\n"
        "Very important: write for someone using this app for the first time. "
        "Avoid trading jargon and avoid technical acronyms in the final explanation text.\n\n"
        "Make it explicit and practical:\n"
        "- State exactly 3 reasons for the signal in plain language.\n"
        "- End with one simple action line for a beginner: what to do now for this signal.\n"
        "- Use direct cause-and-effect wording, not generic summaries.\n\n"
        "Keep the total response under 300 words. Do not number the headings.\n\n"
        "Return strict JSON with keys:\n"
        "- explanation (string)\n"
        "- key_factors (array of 4-8 short strings)\n"
        "- bullish_points (array of short strings; if signal is SELL, include at most one item and it must be a reversal trigger)\n"
        "- bearish_points (array of short strings)\n"
        "- risk_flags (array of short strings)\n"
        "- influential_news (array of objects: date, headline, sentiment, why_it_matters)"
    )

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=35,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    parsed = parse_json_response(content)
    if not parsed:
        raise ValueError("Groq response was not valid JSON.")
    explanation = ensure_beginner_five_section_format(
        str(parsed.get("explanation", "")).strip(), signal, context, top_news
    )
    factors = parsed.get("key_factors", [])
    if not isinstance(factors, list):
        factors = []
    factors = [str(item).strip() for item in factors if str(item).strip()][:10]
    details = {
        "bullish_points": parsed.get("bullish_points", []),
        "bearish_points": parsed.get("bearish_points", []),
        "risk_flags": parsed.get("risk_flags", []),
        "influential_news": parsed.get("influential_news", []),
    }
    return explanation, factors, details


def main():
    load_dotenv()
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    master_path = os.path.join(base_dir, "..", "data", "processed", "master_dataset.csv")
    metrics_path = os.path.join(base_dir, "..", "data", "processed", "metrics.json")
    news_scored_path = os.path.join(base_dir, "..", "data", "processed", "news_headlines_scored.csv")

    if not os.path.exists(metrics_path):
        logging.error("metrics.json not found. Run live_inference.py first.")
        return
    if not os.path.exists(master_path):
        logging.error("master_dataset.csv not found. Run feature_engineering.py first.")
        return

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    inference = metrics.get("Live_Inference")
    if not inference:
        logging.error("Live_Inference not found in metrics.json. Run live_inference.py first.")
        return

    signal = normalize_signal_label(str(inference.get("signal", "HOLD")))
    inference["signal"] = signal
    context = load_latest_context(master_path)
    top_news = load_top_news(news_scored_path, context.get("date", ""))

    explanation = ""
    key_factors = []
    explanation_details = {}
    source = "rule_based"

    if api_key:
        try:
            explanation, key_factors, explanation_details = call_groq(
                signal, inference, context, top_news, api_key, model
            )
            source = f"groq:{model}"
            logging.info("Generated explanation from Groq.")
        except Exception as exc:
            logging.warning("Groq call failed, using fallback explanation: %s", exc)
    else:
        logging.warning("GROQ_API_KEY is missing. Using fallback explanation.")

    if not explanation:
        explanation, key_factors = fallback_explanation(signal, context)
        explanation_details = {
            "bullish_points": [],
            "bearish_points": [],
            "risk_flags": [],
            "influential_news": [],
        }

    inference["explanation"] = explanation
    inference["key_factors"] = key_factors
    inference["explanation_details"] = explanation_details
    inference["context_snapshot"] = context
    inference["top_news_context"] = top_news
    inference["explanation_source"] = source
    inference["explanation_generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    metrics["Live_Inference"] = inference
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=4)

    logging.info("Saved signal explanation to metrics.json.")


if __name__ == "__main__":
    main()
