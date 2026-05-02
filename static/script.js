document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initHelpModal();
    initWelcomeModal();
    loadDashboardData();
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetSection = item.dataset.section;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
                section.classList.add('hidden');
            });

            const target = document.getElementById(`section-${targetSection}`);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('active');
            }
        });
    });

    document.getElementById('help-btn')?.addEventListener('click', showHelp);
    document.getElementById('explain-btn')?.addEventListener('click', () => {
        document.querySelector('[data-section="explain"]').click();
    });
}

function initHelpModal() {
    const modal = document.getElementById('help-modal');
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeHelp();
    });
}

function showHelp() {
    document.getElementById('help-modal')?.classList.add('show');
}

function closeHelp() {
    document.getElementById('help-modal')?.classList.remove('show');
}

function initWelcomeModal() {
    const welcomeModal = document.getElementById('welcome-modal');
    const dontShow = localStorage.getItem('dontShowWelcome');
    
    if (dontShow === 'true') {
        welcomeModal?.classList.add('welcome-hidden');
    }
    
    welcomeModal?.addEventListener('click', (e) => {
        if (e.target === welcomeModal) closeWelcome();
    });
}

function closeWelcome() {
    const welcomeModal = document.getElementById('welcome-modal');
    const dontShowCheckbox = document.getElementById('dont-show-welcome');
    
    if (dontShowCheckbox?.checked) {
        localStorage.setItem('dontShowWelcome', 'true');
    }
    
    welcomeModal?.classList.add('welcome-hidden');
}

async function loadDashboardData() {
    try {
        const [sensexRes, sentimentRes, tradesRes, performanceRes] = await Promise.all([
            fetch('/api/sensex_data'),
            fetch('/api/sentiment_data'),
            fetch('/api/trades'),
            fetch('/api/performance')
        ]);

        const sensexData = await sensexRes.json();
        const sentimentData = await sentimentRes.json();
        const tradesData = await tradesRes.json();
        const performanceData = await performanceRes.json();

        updateOverviewMetrics(sensexData, sentimentData, tradesData);
        renderOverviewCharts(sensexData, sentimentData);
        renderTradesTable(tradesData);
        renderPerformanceCharts(performanceData);
        renderSentimentCharts(sentimentData);
        renderBacktestChart(performanceData);
        renderNewsHeadlines(sentimentData);
        updateTechnicalIndicators(sensexData);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateOverviewMetrics(sensexData, sentimentData, tradesData) {
    const latest = sensexData.prices?.[sensexData.prices.length - 1] || {};
    const first = sensexData.prices?.[0] || {};

    const priceChange = first.Close ? ((latest.Close - first.Close) / first.Close * 100).toFixed(2) : '0.00';

    document.getElementById('metric-return').textContent = `${priceChange}%`;
    document.getElementById('metric-return').style.color = priceChange >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    const position = tradesData.positions?.[tradesData.positions.length - 1]?.position || 'FLAT';
    document.getElementById('metric-position').textContent = position;

    const avgSentiment = sentimentData.average || 0;
    let sentimentText = 'Neutral';
    if (avgSentiment > 0.2) sentimentText = 'Positive';
    else if (avgSentiment < -0.2) sentimentText = 'Negative';
    document.getElementById('metric-sentiment').textContent = sentimentText;

    const totalTrades = tradesData.trades?.length || 0;
    document.getElementById('metric-trades').textContent = totalTrades;

    document.getElementById('ai-return').textContent = `${(performanceData?.ai_return || 0).toFixed(2)}%`;
    document.getElementById('ai-trades').textContent = tradesData.trades?.length || 0;
    document.getElementById('ai-winrate').textContent = `${(performanceData?.ai_winrate || 0).toFixed(1)}%`;

    document.getElementById('bh-return').textContent = `${(performanceData?.bh_return || 0).toFixed(2)}%`;
    document.getElementById('bh-winrate').textContent = `${(performanceData?.bh_winrate || 0).toFixed(1)}%`;
}

function renderOverviewCharts(sensexData, sentimentData) {
    renderPriceChart('overview-price-chart', sensexData.prices, 60);
    renderSentimentGauge('overview-sentiment-gauge', sentimentData.average || 0);
}

function renderPriceChart(containerId, prices, height = 300) {
    const container = document.getElementById(containerId);
    if (!container || !prices || prices.length === 0) {
        container.innerHTML = '<div class="chart-placeholder"><i class="fa-solid fa-chart-line"></i><p>No price data available</p></div>';
        return;
    }

    const trace = {
        x: prices.map(p => p.Date || p.date),
        y: prices.map(p => p.Close || p.close),
        type: 'scatter',
        mode: 'lines',
        name: 'Sensex Price',
        line: { color: '#3b82f6', width: 2.5 },
        fill: 'tozeroy',
        fillcolor: 'rgba(59, 130, 246, 0.15)'
    };

    const firstPrice = prices[0]?.Close || 0;
    const lastPrice = prices[prices.length - 1]?.Close || 0;
    const priceChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2) : 0;
    const changeColor = priceChange >= 0 ? '#10b981' : '#ef4444';
    const changeSymbol = priceChange >= 0 ? '▲' : '▼';

    const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
        height: height,
        margin: { t: 30, r: 30, b: 50, l: 70 },
        xaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            zeroline: false,
            title: { text: 'Date', font: { color: '#64748b', size: 12 } },
            tickangle: -45
        },
        yaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            zeroline: false,
            tickprefix: '₹',
            title: { text: 'Price (₹)', font: { color: '#64748b', size: 12 } },
            hoverformat: ',.2f'
        },
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: '#3b82f6',
            font: { color: '#f1f5f9', family: 'Inter', size: 13 },
            namelength: -1
        },
        annotations: [{
            x: 0.02,
            y: 0.98,
            xref: 'paper',
            yref: 'paper',
            text: `<span style="color: ${changeColor}; font-size: 14px; font-weight: 600;">${changeSymbol} ${Math.abs(priceChange)}%</span><br><span style="color: #94a3b8; font-size: 11px;">vs period start</span>`,
            showarrow: false,
            bgcolor: 'rgba(15, 23, 42, 0.7)',
            borderpad: 8,
            borderradius: 8
        }],
        shapes: [{
            type: 'line',
            x0: prices[Math.floor(prices.length / 2)]?.Date || prices[0]?.date,
            x1: prices[Math.floor(prices.length / 2)]?.Date || prices[0]?.date,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: 'rgba(100, 116, 139, 0.3)', width: 1, dash: 'dot' }
        }]
    };

    const config = {
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
        responsive: true,
        toImageButtonOptions: {
            format: 'png',
            filename: 'sensex_price_chart',
            height: height,
            width: 1200,
            scale: 2
        }
    };

    Plotly.newPlot(container, [trace], layout, config);
    
    container.on('plotly_hover', function() {
        container.style.cursor = 'crosshair';
    });
}

function renderSentimentGauge(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;

    value = Math.max(-1, Math.min(1, value));

    let gaugeColor, sentimentLabel, description;
    if (value > 0.2) {
        gaugeColor = '#10b981';
        sentimentLabel = 'POSITIVE';
        description = 'Market mood is optimistic. Good for growth investments.';
    } else if (value < -0.2) {
        gaugeColor = '#ef4444';
        sentimentLabel = 'NEGATIVE';
        description = 'Market mood is pessimistic. Consider defensive strategies.';
    } else {
        gaugeColor = '#f59e0b';
        sentimentLabel = 'NEUTRAL';
        description = 'Market is calm. No strong directional bias.';
    }

    const gaugeData = [{
        type: "indicator",
        mode: "gauge+number+delta",
        value: value,
        min: -1,
        max: 1,
        gauge: {
            axis: { 
                range: [-1, 1], 
                tickcolor: '#64748b',
                tickvals: [-1, -0.5, 0, 0.5, 1],
                ticktext: ['Very Bad', 'Bad', 'Neutral', 'Good', 'Very Good'],
                tickfont: { color: '#94a3b8', size: 10 }
            },
            bar: { color: gaugeColor, thickness: 0.3 },
            bgcolor: 'rgba(15, 23, 42, 0.5)',
            borderwidth: 2,
            bordercolor: '#334155',
            steps: [
                { range: [-1, -0.2], color: 'rgba(239, 68, 68, 0.2)' },
                { range: [-0.2, 0.2], color: 'rgba(245, 158, 11, 0.2)' },
                { range: [0.2, 1], color: 'rgba(16, 185, 129, 0.2)' }
            ],
            threshold: {
                line: { color: gaugeColor, width: 4 },
                value: value
            }
        },
        number: {
            font: { color: gaugeColor, family: 'Inter', size: 32 },
            suffix: ''
        },
        delta: {
            reference: 0,
            font: { color: '#94a3b8', size: 12 }
        }
    }];

    const layout = {
        paper_bgcolor: 'transparent',
        height: 280,
        margin: { t: 40, r: 30, b: 30, l: 30 },
        annotations: [{
            x: 0.5,
            y: -0.05,
            xref: 'paper',
            yref: 'paper',
            text: `<span style="color: ${gaugeColor}; font-size: 16px; font-weight: 700;">${sentimentLabel}</span><br><span style="color: #94a3b8; font-size: 11px;">${description}</span>`,
            showarrow: false,
            bgcolor: 'rgba(15, 23, 42, 0.7)',
            borderpad: 10,
            borderradius: 10
        }]
    };

    Plotly.newPlot(container, gaugeData, layout, { displayModeBar: false, responsive: true });
}

function renderTradesTable(tradesData) {
    const tbody = document.querySelector('#overview-trades-table tbody');
    if (!tbody || !tradesData.trades) return;

    const recentTrades = tradesData.trades.slice(-10).reverse();

    tbody.innerHTML = recentTrades.map(trade => `
        <tr>
            <td><span class="action-badge ${trade.action?.toLowerCase() || 'neutral'}">${trade.action || 'N/A'}</span></td>
            <td>₹${(trade.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>${trade.shares || 0}</td>
            <td>₹${(trade.portfolio_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>₹${(trade.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

function renderPerformanceCharts(performanceData) {
    if (!performanceData?.portfolio_values) return;

    const aiValues = performanceData.portfolio_values || [];
    const bhValues = performanceData.bh_portfolio || [];
    const dates = performanceData.dates || [];

    const aiTrace = {
        x: dates,
        y: aiValues,
        type: 'scatter',
        mode: 'lines',
        name: '🤖 AI Agent Strategy',
        line: { color: '#8b5cf6', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(139, 92, 246, 0.1)'
    };

    const bhTrace = {
        x: dates,
        y: bhValues,
        type: 'scatter',
        mode: 'lines',
        name: '📊 Buy & Hold',
        line: { color: '#10b981', width: 3, dash: 'dash' },
        fill: 'tozeroy',
        fillcolor: 'rgba(16, 185, 129, 0.05)'
    };

    const aiReturn = aiValues.length > 1 ? ((aiValues[aiValues.length - 1] - aiValues[0]) / aiValues[0] * 100) : 0;
    const bhReturn = bhValues.length > 1 ? ((bhValues[bhValues.length - 1] - bhValues[0]) / bhValues[0] * 100) : 0;
    const diff = aiReturn - bhReturn;
    const diffColor = diff >= 0 ? '#10b981' : '#ef4444';
    const diffSymbol = diff >= 0 ? '+' : '';

    const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
        height: 400,
        margin: { t: 40, r: 30, b: 60, l: 80 },
        xaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            title: { text: 'Trading Date', font: { color: '#64748b', size: 12 } }
        },
        yaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            tickprefix: '₹',
            title: { text: 'Portfolio Value (₹)', font: { color: '#64748b', size: 12 } },
            hoverformat: ',.0f'
        },
        legend: {
            bgcolor: 'rgba(30, 41, 59, 0.8)',
            font: { color: '#f1f5f9', size: 12 },
            bordercolor: '#334155',
            borderwidth: 1,
            x: 0.02,
            y: 0.98
        },
        hovermode: 'x unified',
        hoverlabel: { bgcolor: '#1e293b', bordercolor: '#8b5cf6', font: { color: '#f1f5f9', size: 12 } },
        annotations: [{
            x: 0.98,
            y: 0.02,
            xref: 'paper',
            yref: 'paper',
            text: `<span style="color: ${diffColor}; font-size: 14px; font-weight: 700;">${diffSymbol}${diff.toFixed(2)}%</span><br><span style="color: #94a3b8; font-size: 10px;">AI vs Buy&Hold</span>`,
            showarrow: false,
            bgcolor: 'rgba(15, 23, 42, 0.85)',
            borderpad: 10,
            borderradius: 10
        }],
        shapes: [{
            type: 'line',
            x0: 0,
            x1: 1,
            y0: 100000,
            y1: 100000,
            xref: 'paper',
            line: { color: 'rgba(148, 163, 184, 0.4)', width: 1, dash: 'dot' }
        }]
    };

    Plotly.newPlot('performance-chart', [aiTrace, bhTrace], layout, {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        toImageButtonOptions: {
            format: 'png',
            filename: 'performance_comparison',
            height: 500,
            width: 1200,
            scale: 2
        }
    });

    const perfTableBody = document.querySelector('#performance-trades-table tbody');
    if (perfTableBody && performanceData.trades) {
        perfTableBody.innerHTML = performanceData.trades.map((trade, i) => {
            const pnl = trade.pnl || 0;
            const pnlClass = pnl >= 0 ? 'profit' : 'loss';
            return `
            <tr>
                <td>${i + 1}</td>
                <td>${trade.date || 'N/A'}</td>
                <td><span class="action-badge ${trade.action?.toLowerCase() || 'neutral'}">${trade.action || 'N/A'}</span></td>
                <td>₹${(trade.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td>${trade.shares || 0}</td>
                <td class="${pnlClass}">${pnl >= 0 ? '+' : ''}₹${pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
        `}).join('');
    }
}

function renderSentimentCharts(sentimentData) {
    renderSentimentDistribution(sentimentData);
    renderSentimentTimeline(sentimentData);
}

function renderSentimentDistribution(sentimentData) {
    const container = document.getElementById('sentiment-distribution');
    if (!container || !sentimentData.headlines) return;

    const positive = sentimentData.headlines.filter(h => (h.sentiment || 0) > 0.2).length;
    const neutral = sentimentData.headlines.filter(h => (h.sentiment || 0) >= -0.2 && (h.sentiment || 0) <= 0.2).length;
    const negative = sentimentData.headlines.filter(h => (h.sentiment || 0) < -0.2).length;
    const total = positive + neutral + negative || 1;

    const data = [{
        values: [positive, neutral, negative],
        labels: ['😊 Positive', '😐 Neutral', '😟 Negative'],
        type: 'pie',
        marker: {
            colors: ['#10b981', '#f59e0b', '#ef4444']
        },
        textinfo: 'label+percent',
        textfont: { color: '#f1f5f9', family: 'Inter', size: 12 },
        hole: 0.5,
        hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>Percentage: %{percent}<extra></extra>'
    }];

    const layout = {
        paper_bgcolor: 'transparent',
        height: 320,
        margin: { t: 30, r: 30, b: 30, l: 30 },
        showlegend: true,
        legend: {
            font: { color: '#94a3b8', size: 11 },
            bgcolor: 'rgba(30, 41, 59, 0.5)',
            bordercolor: '#334155',
            borderwidth: 1
        },
        annotations: [{
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            text: `<span style="font-size: 24px; font-weight: 700;">${total}</span><br><span style="font-size: 11px; color: #94a3b8;">Headlines</span>`,
            showarrow: false,
            font: { color: '#f1f5f9' }
        }]
    };

    Plotly.newPlot(container, data, layout, { displayModeBar: false, responsive: true });
}

function renderSentimentTimeline(sentimentData) {
    const container = document.getElementById('sentiment-timeline');
    if (!container || !sentimentData.timeline) return;

    const timeline = sentimentData.timeline;
    
    const colors = timeline.map(t => {
        if (t.sentiment > 0.2) return '#10b981';
        if (t.sentiment < -0.2) return '#ef4444';
        return '#f59e0b';
    });

    const trace = {
        x: timeline.map(t => t.date),
        y: timeline.map(t => t.sentiment),
        type: 'scatter',
        mode: 'lines+markers',
        name: '📈 Market Sentiment',
        line: { color: '#8b5cf6', width: 3 },
        marker: { 
            size: 10,
            color: colors,
            line: { color: '#fff', width: 1.5 }
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(139, 92, 246, 0.1)'
    };

    const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
        height: 350,
        margin: { t: 30, r: 30, b: 60, l: 70 },
        xaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            title: { text: 'Date', font: { color: '#64748b', size: 12 } },
            tickangle: -45
        },
        yaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            zeroline: true,
            zerolinecolor: '#64748b',
            title: { text: 'Sentiment Score', font: { color: '#64748b', size: 12 } },
            hoverformat: '.2f'
        },
        shapes: [{
            type: 'line',
            x0: 0,
            x1: 1,
            y0: 0,
            y1: 0,
            xref: 'paper',
            line: { color: 'rgba(100, 116, 139, 0.6)', width: 2, dash: 'dash' }
        }],
        annotations: [
            {
                x: 0.02,
                y: 0.95,
                xref: 'paper',
                yref: 'paper',
                text: '<span style="color: #10b981;">●</span> Positive (>0.2)',
                showarrow: false,
                font: { color: '#94a3b8', size: 10 }
            },
            {
                x: 0.02,
                y: 0.88,
                xref: 'paper',
                yref: 'paper',
                text: '<span style="color: #f59e0b;">●</span> Neutral',
                showarrow: false,
                font: { color: '#94a3b8', size: 10 }
            },
            {
                x: 0.02,
                y: 0.81,
                xref: 'paper',
                yref: 'paper',
                text: '<span style="color: #ef4444;">●</span> Negative (<-0.2)',
                showarrow: false,
                font: { color: '#94a3b8', size: 10 }
            }
        ]
    };

    Plotly.newPlot(container, [trace], layout, { displayModeBar: true, displaylogo: false, responsive: true });
}

function renderBacktestChart(performanceData) {
    const container = document.getElementById('backtest-chart');
    if (!container || !performanceData?.backtest) return;

    const backtest = performanceData.backtest;
    const dates = backtest.dates || [];
    const portfolio = backtest.portfolio || [];
    const actions = backtest.actions || [];

    const tradesTrace = {
        x: dates,
        y: portfolio,
        type: 'scatter',
        mode: 'lines',
        name: '📈 Portfolio Value',
        line: { color: '#3b82f6', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(59, 130, 246, 0.15)'
    };

    const buyMarkers = [];
    const sellMarkers = [];
    actions.forEach((action, i) => {
        if (action === 'BUY' && dates[i] && portfolio[i]) {
            buyMarkers.push({ x: dates[i], y: portfolio[i] });
        } else if (action === 'SELL' && dates[i] && portfolio[i]) {
            sellMarkers.push({ x: dates[i], y: portfolio[i] });
        }
    });

    const buyTrace = {
        x: buyMarkers.map(m => m.x),
        y: buyMarkers.map(m => m.y),
        type: 'scatter',
        mode: 'markers',
        name: '✅ Buy Signal',
        marker: {
            symbol: 'triangle-up',
            size: 14,
            color: '#10b981',
            line: { color: '#fff', width: 2 }
        }
    };

    const sellTrace = {
        x: sellMarkers.map(m => m.x),
        y: sellMarkers.map(m => m.y),
        type: 'scatter',
        mode: 'markers',
        name: '🔻 Sell Signal',
        marker: {
            symbol: 'triangle-down',
            size: 14,
            color: '#ef4444',
            line: { color: '#fff', width: 2 }
        }
    };

    const initialValue = portfolio[0] || 100000;
    const finalValue = portfolio[portfolio.length - 1] || initialValue;
    const totalReturn = ((finalValue - initialValue) / initialValue * 100);
    const returnColor = totalReturn >= 0 ? '#10b981' : '#ef4444';
    const returnSymbol = totalReturn >= 0 ? '+' : '';

    const layout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'rgba(15, 23, 42, 0.8)',
        height: 500,
        margin: { t: 40, r: 30, b: 60, l: 80 },
        xaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            title: { text: 'Date', font: { color: '#64748b', size: 12 } },
            tickangle: -45
        },
        yaxis: {
            gridcolor: 'rgba(51, 65, 85, 0.5)',
            color: '#94a3b8',
            showgrid: true,
            tickprefix: '₹',
            title: { text: 'Value (₹)', font: { color: '#64748b', size: 12 } },
            hoverformat: ',.0f'
        },
        legend: {
            bgcolor: 'rgba(30, 41, 59, 0.9)',
            font: { color: '#f1f5f9', size: 12 },
            bordercolor: '#334155',
            borderwidth: 1,
            x: 0.02,
            y: 0.98,
            orientation: 'h'
        },
        hovermode: 'x unified',
        hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: '#3b82f6',
            font: { color: '#f1f5f9', size: 12 }
        },
        annotations: [{
            x: 0.98,
            y: 0.98,
            xref: 'paper',
            yref: 'paper',
            text: `<span style="color: ${returnColor}; font-size: 18px; font-weight: 700;">${returnSymbol}${totalReturn.toFixed(2)}%</span><br><span style="color: #94a3b8; font-size: 10px;">Total Return</span>`,
            showarrow: false,
            bgcolor: 'rgba(15, 23, 42, 0.9)',
            borderpad: 12,
            borderradius: 12
        }],
        shapes: [{
            type: 'line',
            x0: 0,
            x1: 1,
            y0: initialValue,
            y1: initialValue,
            xref: 'paper',
            line: { color: 'rgba(148, 163, 184, 0.5)', width: 1, dash: 'dot' }
        }]
    };

    Plotly.newPlot(container, [tradesTrace, buyTrace, sellTrace], layout, {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        toImageButtonOptions: {
            format: 'png',
            filename: 'backtest_results',
            height: 600,
            width: 1200,
            scale: 2
        }
    });

    if (backtest.stats) {
        const stats = backtest.stats;
        document.getElementById('backtest-best').innerHTML = `<span class="stat-positive">+${(stats.best_trade || 0).toFixed(2)}%</span>`;
        document.getElementById('backtest-worst').innerHTML = `<span class="${(stats.worst_trade || 0) >= 0 ? 'stat-positive' : 'stat-negative'}">${(stats.worst_trade || 0).toFixed(2)}%</span>`;
        document.getElementById('backtest-avg').innerHTML = `<span class="${(stats.avg_trade || 0) >= 0 ? 'stat-positive' : 'stat-negative'}">${(stats.avg_trade || 0).toFixed(2)}%</span>`;
        document.getElementById('backtest-sharpe').innerHTML = `<span class="stat-neutral">${(stats.sharpe_ratio || 0).toFixed(2)}</span>`;
    }
}

function renderNewsHeadlines(sentimentData) {
    const container = document.getElementById('news-headlines');
    if (!container || !sentimentData.headlines) return;

    container.innerHTML = sentimentData.headlines.slice(0, 10).map(h => {
        const sentiment = h.sentiment || 0;
        const sentimentClass = sentiment > 0.2 ? 'positive' : (sentiment < -0.2 ? 'negative' : 'neutral');
        return `
            <div class="news-item ${sentimentClass}">
                <p class="news-headline">${h.headline || h.text || 'No headline'}</p>
                <div class="news-meta">
                    <span>${h.source || 'Unknown'}</span>
                    <span>${h.date || ''}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateTechnicalIndicators(sensexData) {
    if (sensexData.indicators) {
        document.getElementById('ind-rsi').textContent = (sensexData.indicators.rsi || 0).toFixed(2);
        document.getElementById('ind-macd').textContent = (sensexData.indicators.macd || 0).toFixed(4);
        document.getElementById('ind-atr').textContent = (sensexData.indicators.atr || 0).toFixed(2);
        document.getElementById('ind-sma').textContent = `₹${(sensexData.indicators.sma200 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
}

async function runScript(scriptName, buttonElement) {
    const terminal = document.getElementById('terminal-container');
    const output = document.getElementById('terminal-output');

    if (terminal) terminal.classList.remove('hidden');
    if (output) output.textContent = `Running ${scriptName}...\n`;

    if (buttonElement) {
        buttonElement.classList.add('loading');
    }

    try {
        const response = await fetch('/api/run_script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: scriptName })
        });

        const result = await response.json();

        if (output) {
            output.textContent = result.output || result.error || 'Script completed';
            output.scrollTop = output.scrollHeight;
        }

        if (result.success) {
            setTimeout(() => {
                loadDashboardData();
            }, 2000);
        }
    } catch (error) {
        if (output) output.textContent = `Error: ${error.message}`;
    } finally {
        if (buttonElement) {
            buttonElement.classList.remove('loading');
        }
    }
}

function closeTerminal() {
    const terminal = document.getElementById('terminal-container');
    if (terminal) terminal.classList.add('hidden');
}

async function getExplanation() {
    const query = document.getElementById('explain-query')?.value;
    const responseDiv = document.getElementById('explain-response');

    if (!query) return;

    responseDiv.innerHTML = '<div class="placeholder"><i class="fa-solid fa-spinner fa-spin"></i><p>Analyzing...</p></div>';

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        if (result.explanation) {
            responseDiv.innerHTML = `<div class="explanation-content">${result.explanation}</div>`;
        } else {
            responseDiv.innerHTML = '<div class="placeholder"><i class="fa-solid fa-circle-exclamation"></i><p>Could not generate explanation. Please try again.</p></div>';
        }
    } catch (error) {
        responseDiv.innerHTML = '<div class="placeholder"><i class="fa-solid fa-circle-exclamation"></i><p>Error connecting to explanation service.</p></div>';
    }
}

async function explainQuick(type) {
    const queries = {
        position: 'What does the current position (LONG/SHORT/FLAT) mean for the trading strategy?',
        sentiment: 'How does market sentiment from news affect the trading decisions?',
        strategy: 'Explain the trading strategy - when does the agent go LONG vs SHORT?',
        risk: 'What risk management practices are in place (position limits, fees, etc.)?'
    };

    const query = queries[type];
    if (query) {
        document.getElementById('explain-query').value = query;
        getExplanation();
    }
}

let performanceData = {};
let sensexData = { prices: [] };
let sentimentData = { headlines: [], timeline: [] };
let tradesData = { trades: [], positions: [] };