import os
import sys
import json
import subprocess
import pandas as pd
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
# Mount static files
app.mount("/static", StaticFiles(directory=os.path.join(base_dir, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(base_dir, "templates"))

directories = {
    "raw": os.path.join(base_dir, "data", "raw"),
    "processed": os.path.join(base_dir, "data", "processed")
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

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("web_app:app", host="127.0.0.1", port=8000, reload=True)
