import React, { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const Chart = ({ onDataLoaded }) => {
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 10);

        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);
        console.log(`Fetching from ${startStr} to ${endStr}`);

        const baseUrl = import.meta.env.DEV ? '/api' : 'https://api.frankfurter.dev/v1';
        const response = await fetch(
          `${baseUrl}/${startStr}..${endStr}?from=USD&to=HKD`
        );
        
        if (!response.ok) {
           throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        if (!data.rates || Object.keys(data.rates).length === 0) {
            throw new Error("No data returned from API");
        }

        const dailyLabels = Object.keys(data.rates);
        const dailyValues = Object.values(data.rates).map((rate) => rate.HKD);

        const labels = [];
        const values = [];
        let currentWeekStr = '';
        let lastValueInWeek = 0;
        let lastLabelInWeek = '';
        
        for (let i = 0; i < dailyLabels.length; i++) {
           const dateStr = dailyLabels[i];
           const dateObj = new Date(dateStr);
           const firstDayOfYear = new Date(dateObj.getFullYear(), 0, 1);
           const pastDaysOfYear = (dateObj - firstDayOfYear) / 86400000;
           const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
           const weekKey = `${dateObj.getFullYear()}-W${weekNum}`;
           
           if (currentWeekStr !== weekKey) {
               if (currentWeekStr !== '') {
                   labels.push(lastLabelInWeek);
                   values.push(lastValueInWeek);
               }
               currentWeekStr = weekKey;
           }
           lastLabelInWeek = dateStr;
           lastValueInWeek = dailyValues[i];
        }
        if (currentWeekStr !== '') {
           labels.push(lastLabelInWeek);
           values.push(lastValueInWeek);
        }

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

        setChartData({
          labels,
          datasets: [
            {
              fill: true,
              label: 'USD/HKD',
              data: values,
              borderColor: '#38bdf8',
              backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
                gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
                return gradient;
              },
              borderWidth: 3,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointBackgroundColor: '#38bdf8',
              tension: 0.4,
            },
          ],
        });
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      }
    };

    fetchData();
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
            return `Rate: ${context.parsed.y.toFixed(4)}`;
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
        <p>Error loading data: {error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading real-time data...</p>
      </div>
    );
  }

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default Chart;
