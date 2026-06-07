import React, { useEffect, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';

const YahooChart = ({ ticker, label, color, isPercentage, onDataLoaded }) => {
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
        console.log(`Fetching ${label} data from Yahoo Finance...`);

        // Fetch 5 years of daily data
        const response = await fetch(
          `/yahoo/v8/finance/chart/${ticker}?interval=1d&range=5y`
        );
        
        if (!response.ok) {
           throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data || !data.chart || !data.chart.result) {
            throw new Error("No data returned from API");
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;

        // Filter out null values
        const validData = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined) {
                const date = new Date(timestamps[i] * 1000);
                validData.push({
                    dateStr: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
                    price: closes[i]
                });
            }
        }

        const labels = validData.map(d => d.dateStr);
        const values = validData.map(d => d.price);

        updateStats(values);

        setChartData({
          labels,
          datasets: [
            {
              fill: true,
              label,
              data: values,
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
        console.error(`Error fetching ${label} data:`, err);
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

      if (onDataLoaded) {
          onDataLoaded({
            current: currentRate.toFixed(2),
            change: change.toFixed(2),
            changePercent: changePercent.toFixed(2),
            isUp: change >= 0,
            highest: highestPrice.toFixed(2),
            dropFromHigh: dropFromHighPercent.toFixed(2),
          });
      }
    };

    const fetchLivePrice = async () => {
      try {
        const res = await fetch(`/yahoo/v8/finance/chart/${ticker}?interval=1d&range=1d`);
        if (!res.ok) return;
        const data = await res.json();
        
        const result = data.chart.result[0];
        const currentPrice = result.meta.regularMarketPrice;
        
        if (currentPrice && chartRef.current) {
           const chart = chartRef.current;
           const dataset = chart.data.datasets[0];
           const dataArr = dataset.data;
           
           // Update the very last point with the live price
           dataArr[dataArr.length - 1] = currentPrice;
           chart.update('none'); // Update without animation to prevent lag
           
           updateStats(dataArr);
        }
      } catch (err) {
        // Silently ignore live polling errors
      }
    };

    fetchData().then(() => {
      const interval = setInterval(fetchLivePrice, 2000);
      return () => clearInterval(interval);
    });

  }, [ticker, label, color, onDataLoaded]);

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
            let val = context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (isPercentage) {
                return `Rate: ${val}%`;
            }
            return `Value: ${val}`;
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
        <p>Error loading {label} data: {error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="loading">
        <div className="spinner" style={{ borderTopColor: color }}></div>
        <p>Loading {label} real-time data...</p>
      </div>
    );
  }

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default YahooChart;
