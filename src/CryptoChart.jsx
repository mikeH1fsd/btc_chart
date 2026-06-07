import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';

const CryptoChart = ({ symbol, label, color, index = 0, onDataLoaded }) => {
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);

  // Helper to safely format colors for gradients
  const getGradientRgba = (hexColor, alpha) => {
    let r = 0, g = 0, b = 0;
    if (hexColor.startsWith('#')) {
      r = parseInt(hexColor.slice(1, 3), 16);
      g = parseInt(hexColor.slice(3, 5), 16);
      b = parseInt(hexColor.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Stagger requests to prevent 15 concurrent requests crashing the browser network
        await new Promise(resolve => setTimeout(resolve, index * 300));

        // Fetch 4 years of 1D data (365 * 4 = 1460 days)
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000`
        );
        
        // Note: Binance limit is 1000. If we want 4 years (1460), we'd need multiple batches.
        // For simplicity and speed in the dashboard view, 1000 days (approx 2.7 years) is usually enough.
        // Let's stick to 1000 to keep it a single fast API call per coin.
        
        if (!response.ok) {
           throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data || data.length === 0) {
            throw new Error("No data returned from API");
        }

        const newLabels = data.map(kline => {
            const date = new Date(kline[0]);
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        });
        const newValues = data.map(kline => parseFloat(kline[4])); // Close price

        updateStats(newValues);

        setChartData({
          labels: newLabels,
          datasets: [
            {
              fill: true,
              label: label,
              data: newValues,
              borderColor: color,
              backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, getGradientRgba(color, 0.4));
                gradient.addColorStop(1, getGradientRgba(color, 0.0));
                return gradient;
              },
              borderWidth: 3,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointBackgroundColor: color,
              tension: 0.1,
            },
          ],
        });
      } catch (err) {
        console.error(`Error fetching ${symbol} data:`, err);
        setError(err.message);
      }
    };

    const updateStats = (values) => {
      const currentRate = values[values.length - 1];
      const previousRate = values.length > 1 ? values[values.length - 2] : currentRate;
      const change = currentRate - previousRate;
      const changePercent = previousRate ? (change / previousRate) * 100 : 0;

      const highestPrice = Math.max(...values);
      const dropFromHighPercent = highestPrice ? ((currentRate - highestPrice) / highestPrice) * 100 : 0;

      onDataLoaded({
        current: currentRate.toFixed(4),
        change: change.toFixed(4),
        changePercent: changePercent.toFixed(2),
        isUp: change >= 0,
        highest: highestPrice.toFixed(4),
        dropFromHigh: dropFromHighPercent.toFixed(2),
      });
    };

    const fetchLivePrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        if (!res.ok) return;
        const data = await res.json();
        const livePrice = parseFloat(data.price);
        
        if (chartRef.current) {
          const chart = chartRef.current;
          const dataset = chart.data.datasets[0];
          const dataArr = dataset.data;
          
          dataArr[dataArr.length - 1] = livePrice;
          chart.update('none');
          
          updateStats(dataArr);
        }
      } catch (err) {
        // Silently ignore
      }
    };

    let interval;
    let isMounted = true;

    fetchData().then(() => {
      if (isMounted) {
        interval = setInterval(fetchLivePrice, 4000);
      }
    });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [symbol, label, color, onDataLoaded]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
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
          label: function(context) {
            return `Price: $${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 5,
          font: {
            family: "'Inter', sans-serif",
          }
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false,
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: "'Inter', sans-serif",
          }
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  if (error) {
    return (
      <div className="loading" style={{ color: '#f87171' }}>
        <p>Error loading {symbol}: {error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="loading">
        <div className="spinner" style={{ borderTopColor: color }}></div>
      </div>
    );
  }

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default CryptoChart;
