import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';

/**
 * Premium Fear & Greed Index chart – styled identically to landing page charts.
 * Uses glass-card, full chart-container, proper axes, tooltips, and gradient fill.
 */
const FearGreedChart = () => {
  const [fullData, setFullData] = useState(null); // all fetched data
  const [chartData, setChartData] = useState(null); // sliced by years
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState(null);
  const [years, setYears] = useState(1); // default 1 year
  const [customInput, setCustomInput] = useState('');
  const chartRef = useRef(null);

  // Fetch max available data once (~5.5 years)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/?limit=2000&format=json');
        const json = await res.json();
        const list = json.data || [];
        const sorted = list.sort((a, b) => a.timestamp - b.timestamp);
        const labels = sorted.map(item => {
          const d = new Date(item.timestamp * 1000);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        const values = sorted.map(item => Number(item.value));
        setFullData({ labels, values });
        setLatest(sorted[sorted.length - 1]);
      } catch (e) {
        console.error('Failed to fetch Fear & Greed index', e);
        setError(e.message);
      }
    };
    fetchData();
    const timer = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Slice data based on selected years
  useEffect(() => {
    if (!fullData) return;
    if (years === 0) {
      // "All" mode – show everything
      setChartData(fullData);
    } else {
      const daysToShow = years * 365;
      const total = fullData.labels.length;
      const start = Math.max(0, total - daysToShow);
      setChartData({
        labels: fullData.labels.slice(start),
        values: fullData.values.slice(start),
      });
    }
  }, [fullData, years]);

  const getColor = (value) => {
    const v = Number(value);
    if (v <= 20) return { color: '#ef4444', label: 'Extreme Fear', bg: 'rgba(239,68,68,0.15)' };
    if (v <= 40) return { color: '#f87171', label: 'Fear', bg: 'rgba(248,113,113,0.15)' };
    if (v <= 60) return { color: '#fbbf24', label: 'Neutral', bg: 'rgba(251,191,36,0.15)' };
    if (v <= 80) return { color: '#34d399', label: 'Greed', bg: 'rgba(52,211,153,0.15)' };
    return { color: '#10b981', label: 'Extreme Greed', bg: 'rgba(16,185,129,0.15)' };
  };

  const getLineColor = (value) => {
    const v = Number(value);
    if (v <= 25) return '#ef4444';
    if (v <= 45) return '#f59e0b';
    if (v <= 55) return '#fbbf24';
    if (v <= 75) return '#34d399';
    return '#10b981';
  };

  // Color each segment of the line based on the Y value
  const getSegmentColor = (value) => {
    if (value <= 20) return '#ef4444';   // extreme fear – deep red
    if (value <= 40) return '#fb923c';   // fear – orange
    if (value <= 55) return '#fbbf24';   // neutral – yellow
    if (value <= 75) return '#34d399';   // greed – green
    return '#10b981';                     // extreme greed – bright green
  };

  const data = chartData
    ? {
        labels: chartData.labels,
        datasets: [
          {
            fill: true,
            label: 'Fear & Greed Index',
            data: chartData.values,
            // Segment-based coloring: each piece of the line gets its own color
            segment: {
              borderColor: (ctx) => getSegmentColor(ctx.p1.parsed.y),
              backgroundColor: (ctx) => {
                const color = getSegmentColor(ctx.p1.parsed.y);
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, 0.08)`;
              },
            },
            // Fallback color (used for legend etc.)
            borderColor: '#fbbf24',
            backgroundColor: 'rgba(251,191,36,0.05)',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderWidth: 2,
            tension: 0.3,
          },
        ],
      }
    : null;


  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#94a3b8',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            const info = (() => {
              if (val <= 20) return 'Extreme Fear';
              if (val <= 40) return 'Fear';
              if (val <= 60) return 'Neutral';
              if (val <= 80) return 'Greed';
              return 'Extreme Greed';
            })();
            return `Index: ${val} (${info})`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 7,
          font: { family: "'Inter', sans-serif" },
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { family: "'Inter', sans-serif" },
          stepSize: 25,
          callback: function (value) {
            if (value === 0) return '0 - Extreme Fear';
            if (value === 25) return '25 - Fear';
            if (value === 50) return '50 - Neutral';
            if (value === 75) return '75 - Greed';
            if (value === 100) return '100 - Extreme Greed';
            return value;
          },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  const status = latest ? getColor(latest.value) : null;

  if (error) {
    return (
      <div className="loading" style={{ color: '#f87171' }}>
        <p>Error loading Fear & Greed data: {error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="loading">
        <div className="spinner" style={{ borderTopColor: '#fbbf24' }}></div>
        <p>Loading Fear & Greed Index...</p>
      </div>
    );
  }

  return (
    <section className="glass-card" style={{ borderColor: status ? `${status.color}30` : 'var(--card-border)' }}>
      <div className="chart-header">
        <h2 className="chart-title">Crypto Fear & Greed Index</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {latest && status && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              {/* Large value circle */}
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: status.bg,
                border: `2px solid ${status.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.2rem',
                color: status.color,
              }}>
                {latest.value}
              </div>
              {/* Status text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{
                  color: status.color,
                  fontWeight: 600,
                  fontSize: '1rem',
                }}>
                  {latest.value_classification}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Updated daily
                </span>
              </div>
            </div>
          )}
          {/* Year selector buttons */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[1, 2, 3, 5].map(y => (
              <button
                key={y}
                onClick={() => { setYears(y); setCustomInput(''); }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: years === y ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                  background: years === y ? 'rgba(251,191,36,0.15)' : 'transparent',
                  color: years === y ? '#fbbf24' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {y}Y
              </button>
            ))}
            <button
              onClick={() => { setYears(0); setCustomInput(''); }}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: years === 0 ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                background: years === 0 ? 'rgba(251,191,36,0.15)' : 'transparent',
                color: years === 0 ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              All
            </button>
            {/* Custom year input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
              <input
                type="number"
                min="1"
                max="10"
                placeholder="Year"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = parseInt(customInput);
                    if (v > 0 && v <= 10) setYears(v);
                  }
                }}
                style={{
                  width: '52px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#e2e8f0',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  const v = parseInt(customInput);
                  if (v > 0 && v <= 10) setYears(v);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(251,191,36,0.3)',
                  background: 'rgba(251,191,36,0.1)',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Go
              </button>
            </div>
          </div>
          <div
            className="timeframe-badge"
            style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)' }}
          >
            {years === 0 ? 'All Data' : `${years} Year${years > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>
      <div className="chart-container" style={{ minHeight: '350px', height: '350px' }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
      {/* Footer info strip */}
      <div style={{ 
        marginTop: '1rem', 
        paddingTop: '1rem', 
        borderTop: '1px solid var(--card-border)', 
        display: 'flex', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { range: '0-25', label: 'Extreme Fear', color: '#ef4444' },
            { range: '25-45', label: 'Fear', color: '#f87171' },
            { range: '45-55', label: 'Neutral', color: '#fbbf24' },
            { range: '55-75', label: 'Greed', color: '#34d399' },
            { range: '75-100', label: 'Extreme Greed', color: '#10b981' },
          ].map((item) => (
            <div key={item.range} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: item.color,
              }} />
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {item.range}: {item.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Source:</span>
          <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Alternative.me</span>
        </div>
      </div>
    </section>
  );
};

export default React.memo(FearGreedChart);
