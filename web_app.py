import os
import sys
import json
import subprocess
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ALGOBOT Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup paths
base_dir = os.path.dirname(os.path.abspath(__file__))
react_dist = os.path.normpath(os.path.join(base_dir, "react-frontend", "dist"))

# Mount React static assets if built, otherwise mount old static folder
if os.path.exists(react_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(react_dist, "assets")), name="assets")
else:
    app.mount("/static", StaticFiles(directory=os.path.join(base_dir, "static")), name="static")
    templates = Jinja2Templates(directory=os.path.join(base_dir, "templates"))

directories = {
    "raw": os.path.join(base_dir, "data", "raw"),
    "processed": os.path.join(base_dir, "data", "processed"),
    # Paper trading demo needs the designated train/val/test splits.
    # The React frontend fetches `/api/data/test.csv`, so we must expose `data/splits`.
    "splits": os.path.join(base_dir, "data", "splits"),
}

def load_data(filename):
    """Utility to load csv/json from data directories."""
    for folder_key in directories:
        folder_path = directories[folder_key]
        file_path = os.path.join(folder_path, filename)
        if os.path.exists(file_path):
            if filename.endswith(".csv"):
                df = pd.read_csv(file_path, encoding='utf-8')
                # handle NaN values which break JSON standard
                df = df.fillna("")
                return df.to_dict(orient="records")
            elif filename.endswith(".json"):
                with open(file_path, "r", encoding='utf-8') as f:
                    return json.load(f)
    return None

from fastapi.responses import FileResponse

@app.get("/")
async def index(request: Request = None):
    if os.path.exists(react_dist):
        return FileResponse(os.path.join(react_dist, "index.html"))
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/data/{filename}")
async def get_data(filename: str):
    data = load_data(filename)
    if data is not None:
        return JSONResponse(content={"status": "success", "data": data})
    return JSONResponse(content={"status": "error", "message": "File not found"}, status_code=404)

@app.get("/api/health")
async def health():
    """Lightweight check so the React dev server can verify the API is reachable."""
    return {"status": "ok"}

@app.get("/api/realtime")
async def get_realtime():
    """Fetches real-time SENSEX index data from yfinance with local fallbacks."""
    try:
        ticker = yf.Ticker("^BSESN")
        fast_info = getattr(ticker, "fast_info", None)
        
        price = None
        prev_close = None
        open_val = None
        high = None
        low = None
        volume = None
        
        if fast_info is not None:
            try:
                price = float(fast_info.get("lastPrice"))
                prev_close = float(fast_info.get("previousClose"))
                open_val = float(fast_info.get("open"))
                high = float(fast_info.get("dayHigh"))
                low = float(fast_info.get("dayLow"))
                volume = float(fast_info.get("lastVolume"))
            except Exception:
                pass
                
        # If fast_info failed or was empty, query last 2 days history
        if price is None or prev_close is None:
            try:
                hist = ticker.history(period="2d")
                if not hist.empty:
                    if isinstance(hist.columns, pd.MultiIndex):
                        hist.columns = [col[0] for col in hist.columns]
                    price = float(hist["Close"].iloc[-1])
                    open_val = float(hist["Open"].iloc[-1])
                    high = float(hist["High"].iloc[-1])
                    low = float(hist["Low"].iloc[-1])
                    volume = float(hist["Volume"].iloc[-1])
                    if len(hist) > 1:
                        prev_close = float(hist["Close"].iloc[-2])
                    else:
                        prev_close = price
            except Exception:
                pass

        # Fallback to local CSV data if yfinance is down or empty
        if price is None or prev_close is None:
            csv_path = os.path.join(directories["raw"], "sensex_ohlcv.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path)
                if not df.empty:
                    latest = df.iloc[-1]
                    prev = df.iloc[-2] if len(df) > 1 else latest
                    price = float(latest["Close"])
                    prev_close = float(prev["Close"])
                    open_val = float(latest["Open"])
                    high = float(latest["High"])
                    low = float(latest["Low"])
                    volume = float(latest["Volume"])

        # Calculate changes
        change = 0.0
        change_percent = 0.0
        if price is not None and prev_close is not None:
            change = price - prev_close
            change_percent = (change / prev_close) * 100

        # Fetch intraday points for the last 3 days at 15m intervals
        intraday_points = []
        try:
            hist_intraday = ticker.history(period="3d", interval="15m")
            if not hist_intraday.empty:
                if isinstance(hist_intraday.columns, pd.MultiIndex):
                    hist_intraday.columns = [col[0] for col in hist_intraday.columns]
                hist_intraday = hist_intraday.dropna(subset=["Close"])
                for idx, row in hist_intraday.iterrows():
                    intraday_points.append({
                        "time": idx.strftime("%Y-%m-%d %H:%M"),
                        "close": float(row["Close"]),
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "volume": float(row["Volume"])
                    })
        except Exception:
            pass

        # If intraday is empty, build synthetic intraday from daily data
        if not intraday_points:
            csv_path = os.path.join(directories["raw"], "sensex_ohlcv.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path)
                if not df.empty:
                    # Take last 10 daily rows to plot a nice fallback trend
                    for _, row in df.tail(10).iterrows():
                        intraday_points.append({
                            "time": str(row["Date"]),
                            "close": float(row["Close"]),
                            "open": float(row["Open"]),
                            "high": float(row["High"]),
                            "low": float(row["Low"]),
                            "volume": float(row["Volume"])
                        })

        return JSONResponse(content={
            "status": "success",
            "data": {
                "price": price,
                "previous_close": prev_close,
                "change": change,
                "change_percent": change_percent,
                "open": open_val,
                "high": high,
                "low": low,
                "volume": volume,
                "intraday": intraday_points
            }
        })
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/run-script/{script_name}")
async def run_script(script_name: str):
    script_path = os.path.join(base_dir, "src", script_name)
    if not os.path.exists(script_path):
        return JSONResponse(content={"status": "error", "message": f"Script {script_name} not found"}, status_code=404)
        
    try:
        # cwd=project root keeps imports/paths predictable; utf-8 avoids Windows decode errors on child output
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            cwd=base_dir,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode == 0:
            return JSONResponse(content={
                "status": "success", 
                "stdout": result.stdout or "",
                "message": f"Successfully ran {script_name}"
            })
        else:
            return JSONResponse(content={
                "status": "error", 
                "stderr": result.stderr or "",
                "stdout": result.stdout or "",
                "message": f"Error running {script_name}"
            })
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

@app.get("/{catchall:path}")
async def serve_react_app(catchall: str):
    # Exclude API endpoints from catch-all
    if catchall.startswith("api/") or catchall.startswith("static/"):
        return JSONResponse(status_code=404, content={"status": "error", "message": "API route not found"})
    if os.path.exists(react_dist):
        return FileResponse(os.path.join(react_dist, "index.html"))
    return JSONResponse(status_code=404, content={"status": "error", "message": "Not found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)