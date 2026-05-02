# SENSEX Trading Intelligence - React Frontend

This is the React frontend for the SENSEX Trading Intelligence system. It connects to the existing FastAPI backend.

## How to Run

### 1. Start the FastAPI Backend

First, open a terminal and run the Python backend:

```bash
# From the project root directory
python web_app.py
```

This will start the backend on http://127.0.0.1:8000

### 2. Start the React Frontend

Open a new terminal, navigate to the react-frontend directory, and run:

```bash
cd react-frontend
npm install
npm run dev
```

This will start the React development server on http://localhost:5173

## Project Structure

```
react-frontend/
├── src/
│   ├── components/
│   │   └── Navbar.jsx         # Navigation bar
│   ├── pages/
│   │   ├── Home.jsx           # Home & Market Overview
│   │   ├── News.jsx           # News & Sentiment
│   │   ├── PaperTrading.jsx   # Paper Trading Demo
│   │   └── Settings.jsx       # Settings & Tools
│   ├── App.jsx                # Main app with routing
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── index.html
├── vite.config.js
└── package.json
```

## Features

- 🏠 Home & Overview: View market data and AI suggestions
- 📰 News & Mood: See financial news and sentiment analysis
- 🎲 Paper Trading Demo: Watch the AI practice trading
- ⚙️ Settings & Tools: Update data and run scripts (including one-click "Run All")

## Tech Stack

- React 19
- React Router
- Axios (for API calls)
- Vite (for fast development)
