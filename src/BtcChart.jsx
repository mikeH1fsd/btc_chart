import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';

const BtcChart = ({ onDataLoaded }) => {
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log(`Fetching BTC data from Binance...`);

        // Fetch 520 weeks of data (approx 10 years)
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=520`
        );
        
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
              label: 'BTC/USDT',
              data: newValues,
              borderColor: '#f59e0b',
              backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
                gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
                return gradient;
              },
              borderWidth: 3,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointBackgroundColor: '#f59e0b',
              tension: 0.1,
            },
          ],
        });
      } catch (err) {
        console.error('Error fetching BTC data:', err);
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
        current: currentRate.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
        isUp: change >= 0,
        highest: highestPrice.toFixed(2),
        dropFromHigh: dropFromHighPercent.toFixed(2),
      });
    };

    const fetchLivePrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`);
        if (!res.ok) return;
        const data = await res.json();
        const livePrice = parseFloat(data.price);
        
        if (chartRef.current) {
          const chart = chartRef.current;
          const dataset = chart.data.datasets[0];
          const dataArr = dataset.data;
          
          // Update the very last point with the live price
          dataArr[dataArr.length - 1] = livePrice;
          chart.update('none'); // Update without animation to prevent lag
          
          updateStats(dataArr);
        }
      } catch (err) {
        // Silently ignore live polling errors to avoid disrupting the UI
      }
    };

    let interval;
    let isMounted = true;

    fetchData().then(() => {
      if (isMounted) {
        interval = setInterval(fetchLivePrice, 2000);
      }
    });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [onDataLoaded]);

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
            return `Price: $${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          maxTicksLimit: 7,
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
        <p>Error loading BTC data: {error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="loading">
        <div className="spinner" style={{ borderTopColor: '#f59e0b' }}></div>
        <p>Loading BTC real-time data...</p>
      </div>
    );
  }

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default BtcChart;
