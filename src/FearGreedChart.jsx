import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';

// Simple component that fetches Fear & Greed index from Alternative.me
// Shows the latest value as a badge and a small line chart of the last 30 days.
const FearGreedChart = () => {
  const [dataPoints, setDataPoints] = useState([]);
  const [latest, setLatest] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchFG = async () => {
      try {
        // Limit=30 gives last 30 entries (daily)
        const res = await fetch('https://api.alternative.me/fng/?limit=30&format=json');
        const json = await res.json();
        const list = json.data || [];
        // Sort by timestamp ascending
        const sorted = list.sort((a, b) => a.timestamp - b.timestamp);
        const labels = sorted.map(item => {
          const d = new Date(item.timestamp * 1000);
          return `${d.getMonth() + 1}/${d.getDate()}`;
        });
        const values = sorted.map(item => Number(item.value));
        setDataPoints({ labels, values });
        setLatest(sorted[sorted.length - 1]);
      } catch (e) {
        console.error('Failed to fetch Fear & Greed index', e);
      }
    };
    fetchFG();
    // Refresh once per hour
    const timer = setInterval(fetchFG, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const getColor = (val) => {
    if (val <= 20) return '#ef4444'; // Extreme Fear
    if (val <= 40) return '#f87171'; // Fear
    if (val <= 60) return '#fbbf24'; // Neutral
    if (val <= 80) return '#34d399'; // Greed
    return '#10b981'; // Extreme Greed
  };

  const chartData = dataPoints ? {
    labels: dataPoints.labels,
    datasets: [{
      label: 'Fear & Greed Index',
      data: dataPoints.values,
      borderColor: '#fbbf24',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const grad = ctx.createLinearGradient(0, 0, 0, 200);
        grad.addColorStop(0, 'rgba(251,191,36,0.4)');
        grad.addColorStop(1, 'rgba(251,191,36,0)');
        return grad;
      },
      tension: 0.3,
      pointRadius: 0,
      fill: true,
    }]
  } : null;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { display: false }, x: { display: false } },
    animation: false,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      {latest && (
        <div style={{
          padding: '4px 8px',
          background: `${getColor(latest.value)}20`,
          color: getColor(latest.value),
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          Fear‑Greed: {latest.value} ({latest.value_classification})
        </div>
      )}
      <div style={{ width: '120px', height: '60px' }}>
        {chartData && <Line ref={chartRef} data={chartData} options={options} />}
      </div>
    </div>
  );
};

export default React.memo(FearGreedChart);
