import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const BtcDetailChart = ({ onClose, interval = '1h', years = 5, symbol = 'BTCUSDT', title = 'Bitcoin / USDT' }) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentInterval, setCurrentInterval] = useState(interval);
  
  const [isExtended, setIsExtended] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [extendYears, setExtendYears] = useState(1);
  
  const [showEma25, setShowEma25] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showEma25_1H, setShowEma25_1H] = useState(true);
  const [showEma200_1H, setShowEma200_1H] = useState(true);
  const [showEma200_4H, setShowEma200_4H] = useState(true);
  const [showBg, setShowBg] = useState(true);

  const [position, setPosition] = useState(null);
  const [lotsInput, setLotsInput] = useState('0.01');
  const [dragging, setDragging] = useState(null);
  const positionRef = useRef(null);
  const draggingRef = useRef(null);
  const dragPositionRef = useRef(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const [measureActive, setMeasureActive] = useState(false);
  const measureStepRef = useRef(0); // 0: inactive, 1: ready, 2: measuring, 3: locked
  const measureStartRef = useRef(null);
  const measureCurrentRef = useRef(null);
  
  useEffect(() => {
     if (measureActive) {
        measureStepRef.current = 1;
        measureStartRef.current = null;
        measureCurrentRef.current = null;
     } else {
        measureStepRef.current = 0;
        measureStartRef.current = null;
        measureCurrentRef.current = null;
     }
     
     if (chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
           handleScroll: !measureActive,
           handleScale: {
             axisPressedMouseMove: !measureActive,
             mouseWheel: true,
             pinch: true,
           }
        });
     }
  }, [measureActive]);
  
  const oldestTimeRef = useRef(null);
  const isFetchingRef = useRef(false);
  const candleDataRef = useRef([]);
  const ema25SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
  const ema25_1HSeriesRef = useRef(null);
  const ema200_1HSeriesRef = useRef(null);
  const ema200_4HSeriesRef = useRef(null);
  const bgSeriesRef = useRef(null);

  const getMultiplier = (targetMinutes) => {
    let currentMinutes = 60;
    if (currentInterval === '1d') currentMinutes = 1440;
    else if (currentInterval === '4h') currentMinutes = 240;
    else if (currentInterval === '30m') currentMinutes = 30;
    else if (currentInterval === '15m') currentMinutes = 15;
    else if (currentInterval === '5m') currentMinutes = 5;
    return Math.max(1, targetMinutes / currentMinutes);
  };

  const getEmaArray = (data, period) => {
    if (!data || data.length < period) return [];
    const k = 2 / (period + 1);
    const emaData = [];
    let sum = 0;
    for (let i = 0; i < period; i++) {
      let c = data[i]?.close;
      if (isNaN(c) || c === null || c === undefined) c = 0;
      sum += c;
    }
    let prevEma = sum / period;
    emaData.push({ time: data[period - 1].time, value: prevEma });
    for (let i = period; i < data.length; i++) {
      let c = data[i]?.close;
      if (isNaN(c) || c === null || c === undefined) c = prevEma;
      let currentEma = (c - prevEma) * k + prevEma;
      emaData.push({ time: data[i].time, value: currentEma });
      prevEma = currentEma;
    }
    return emaData;
  };

  const getHigherTimeframeRsiArray = (data, period = 14, multiplier = 4) => {
    if (!data || data.length === 0) return [];
    
    const closesHTF = [];
    const rsiData = [];
    
    for (let i = 0; i < data.length; i++) {
        if (i % multiplier === multiplier - 1 || i === data.length - 1) { 
           closesHTF.push({ time: data[i].time, close: data[i].close, indexBase: i });
        }
    }
    
    if (closesHTF.length <= period) return [];
    
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closesHTF[i].close - closesHTF[i - 1].close;
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    let currentRsiIdx = period;
    
    for (let i = 0; i < data.length; i++) {
       if (currentRsiIdx < closesHTF.length - 1 && i > closesHTF[currentRsiIdx].indexBase) {
           currentRsiIdx++;
           const change = closesHTF[currentRsiIdx].close - closesHTF[currentRsiIdx - 1].close;
           let gain = change >= 0 ? change : 0;
           let loss = change < 0 ? -change : 0;
           
           avgGain = (avgGain * (period - 1) + gain) / period;
           avgLoss = (avgLoss * (period - 1) + loss) / period;
           
           rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
           rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
       }
       
       if (i >= closesHTF[period].indexBase) {
           rsiData.push({ time: data[i].time, value: rsi });
       }
    }
    
    return rsiData;
  };

  const getRsiArray = (data, period = 14) => {
    if (!data || data.length <= period) return [];
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    const rsiData = [];
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    rsiData.push({ time: data[period].time, value: rsi });
    
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      let gain = change >= 0 ? change : 0;
      let loss = change < 0 ? -change : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
      
      rsiData.push({ time: data[i].time, value: rsi });
    }
    
    return rsiData;
  };

    const applySignalsAndBackground = (data, rsiDataBase, rsiDataHTF) => {
      const bgData = [];
      
      if (!data || !rsiDataBase || !rsiDataHTF || data.length === 0) return { bgData };
      
      const rsiMapBase = {};
      for (let i = 0; i < rsiDataBase.length; i++) {
        rsiMapBase[rsiDataBase[i].time] = rsiDataBase[i].value;
      }
      
      const rsiMapHTF = {};
      for (let i = 0; i < rsiDataHTF.length; i++) {
        rsiMapHTF[rsiDataHTF[i].time] = rsiDataHTF[i].value;
      }
      
      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const currentRsiBase = rsiMapBase[current.time];
        const currentRsiHTF = rsiMapHTF[current.time];
        
        let color = 'transparent';
        
        const obBase = currentRsiBase >= 70;
        const osBase = currentRsiBase <= 30;
        const obHTF = currentRsiHTF >= 70;
        const osHTF = currentRsiHTF <= 30;
        
        if (obBase && obHTF) {
           color = 'rgba(220, 38, 38, 0.4)'; // Dark Red
        } else if (obBase || obHTF) {
           color = 'rgba(239, 68, 68, 0.15)'; // Light Red
        } else if (osBase && osHTF) {
           color = 'rgba(22, 163, 74, 0.4)'; // Dark Green
        } else if (osBase || osHTF) {
           color = 'rgba(34, 197, 94, 0.15)'; // Light Green
        }
        
        bgData.push({ time: current.time, value: color !== 'transparent' ? 1 : 0, color });
      }
      
      return { bgData };
    };

  const handleOpenPosition = (type) => {
    if (candleDataRef.current.length === 0) return;
    const latestCandle = candleDataRef.current[candleDataRef.current.length - 1];
    const entryPrice = latestCandle.close;
    const lots = parseFloat(lotsInput) || 0.01;
    
    setPosition({
      type,
      entry: entryPrice,
      tp: type === 'long' ? entryPrice * 1.05 : entryPrice * 0.95,
      sl: type === 'long' ? entryPrice * 0.95 : entryPrice * 1.05,
      lots: lots,
      spread: 0,
      startTime: latestCandle.time
    });
  };

  const fetchHistoricalKlines = async (target, end, onProgress) => {
    try {
      let allData = [];
      let currentEndTime = end;
      const limit = 1000;
      
      const batches = Math.ceil(target / (limit * 3));
      
      for (let i = 0; i < batches; i++) {
        const promises = [];
        for (let j = 0; j < 3; j++) {
          let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${currentInterval}&limit=${limit}&endTime=${currentEndTime}`;
          promises.push(fetch(url).then(res => res.json()));
          
          let msPerCandle = 60 * 60 * 1000;
          if (currentInterval === '1d') msPerCandle = 24 * 60 * 60 * 1000;
          else if (currentInterval === '4h') msPerCandle = 4 * 60 * 60 * 1000;
          else if (currentInterval === '30m') msPerCandle = 30 * 60 * 1000;
          else if (currentInterval === '15m') msPerCandle = 15 * 60 * 1000;
          else if (currentInterval === '5m') msPerCandle = 5 * 60 * 1000;
          
          currentEndTime -= limit * msPerCandle;
        }
        
        const results = await Promise.all(promises);
        for (let j = results.length - 1; j >= 0; j--) {
          const data = results[j];
          if (!data || data.length === 0) continue;
          const formattedData = data.map(d => ({
            time: d[0] / 1000,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          }));
          allData = [...formattedData, ...allData];
        }
        
        if (onProgress) {
          onProgress(Math.min(100, Math.round((allData.length / target) * 100)));
        }
      }
      
      // Sort strictly by time and remove duplicates
      const uniqueData = [];
      const seen = new Set();
      allData.sort((a, b) => a.time - b.time).forEach(d => {
        if (!seen.has(d.time)) {
          seen.add(d.time);
          uniqueData.push(d);
        }
      });
      
      return uniqueData;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  useEffect(() => {
    // Prevent scrolling on the body while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    // Initialize Chart
    const chartOptions = {
      layout: {
        textColor: '#d1d5db',
        background: { type: 'solid', color: 'transparent' },
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      crosshair: {
        mode: 0, // Normal mode
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
      autoSize: true, // Automatically resize with container
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartInstanceRef.current = chart;

    const bgSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'bgScale',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      baseLineVisible: false,
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: 0,
          maxValue: 1,
        },
      }),
    });
    chart.priceScale('bgScale').applyOptions({
      visible: false,
      scaleMargins: {
        top: 0,
        bottom: 0,
      },
    });
    bgSeriesRef.current = bgSeries;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    seriesRef.current = candlestickSeries;

    // Adjust the main price scale padding
    chart.priceScale('right').applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });

    const ema25Series = chart.addSeries(LineSeries, {
      color: '#22c55e', // green
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
    });
    ema25SeriesRef.current = ema25Series;

    const ema200Series = chart.addSeries(LineSeries, {
      color: '#3b82f6', // blue
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
    });
    ema200SeriesRef.current = ema200Series;

    const ema25_1HSeries = chart.addSeries(LineSeries, {
      color: '#facc15', // yellow
      lineWidth: 2,
      lineStyle: 2, // dashed
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
      visible: currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h',
    });
    ema25_1HSeriesRef.current = ema25_1HSeries;

    const ema200_1HSeries = chart.addSeries(LineSeries, {
      color: '#fb923c', // orange
      lineWidth: 2,
      lineStyle: 2, // dashed
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
      visible: currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h',
    });
    ema200_1HSeriesRef.current = ema200_1HSeries;

    const ema200_4HSeries = chart.addSeries(LineSeries, {
      color: '#a855f7', // purple
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
    });
    ema200_4HSeriesRef.current = ema200_4HSeries;

    const loadInitialData = async () => {
      try {
        let initialCandles = 4320; // 1h: 6 months
        if (currentInterval === '1d') initialCandles = 1460; // 4 years
        else if (currentInterval === '4h') initialCandles = 2190; // 1 year
        else if (currentInterval === '30m') initialCandles = 5760; // 4 months
        else if (currentInterval === '15m') initialCandles = 5760; // 2 months
        else if (currentInterval === '5m') initialCandles = 8640; // 1 month
        
        const data = await fetchHistoricalKlines(initialCandles, Date.now(), (progress) => {
          setLoadingProgress(progress);
        });
        
        if (data.length > 0) {
          const rsiArrayBase = getRsiArray(data, 14);
          const rsiArrayHTF = getHigherTimeframeRsiArray(data, 14, 4); // Use 4x HTF consistently
          
          const { bgData } = applySignalsAndBackground(data, rsiArrayBase, rsiArrayHTF);
          if (bgSeriesRef.current) bgSeriesRef.current.setData(bgData);
          if (seriesRef.current) {
            seriesRef.current.setData(data);
          }
          
          if (ema25SeriesRef.current) ema25SeriesRef.current.setData(getEmaArray(data, 25));
          if (ema200SeriesRef.current) ema200SeriesRef.current.setData(getEmaArray(data, 200));
          if (currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h') {
             if (ema25_1HSeriesRef.current) ema25_1HSeriesRef.current.setData(getEmaArray(data, 25 * getMultiplier(60)));
             if (ema200_1HSeriesRef.current) ema200_1HSeriesRef.current.setData(getEmaArray(data, 200 * getMultiplier(60)));
          }
          if (ema200_4HSeriesRef.current) ema200_4HSeriesRef.current.setData(getEmaArray(data, 200 * getMultiplier(240)));
          
          candleDataRef.current = data;
          oldestTimeRef.current = data[0].time * 1000;
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const handleExtendHistory = async () => {
      if (!oldestTimeRef.current || isExtending) return;
      setIsExtending(true);
      
      let minutesPerCandle = 60;
      if (currentInterval === '1d') minutesPerCandle = 1440;
      else if (currentInterval === '4h') minutesPerCandle = 240;
      else if (currentInterval === '30m') minutesPerCandle = 30;
      else if (currentInterval === '15m') minutesPerCandle = 15;
      else if (currentInterval === '5m') minutesPerCandle = 5;
      
      const candlesToFetch = Math.ceil((extendYears * 365 * 24 * 60) / minutesPerCandle);
      
      try {
        const newData = await fetchHistoricalKlines(candlesToFetch, oldestTimeRef.current - 1000, (progress) => {
          setLoadingProgress(progress);
        });
        
        if (newData.length > 0) {
          // Merge avoiding duplicates at the boundary
          const existingData = candleDataRef.current;
          const mergedData = [...newData, ...existingData].sort((a, b) => a.time - b.time);
          
          const uniqueData = [];
          const seen = new Set();
          mergedData.forEach(d => {
            if (!seen.has(d.time)) {
              seen.add(d.time);
              uniqueData.push(d);
            }
          });
          
          const data = uniqueData;
          
          const rsiArrayBase = getRsiArray(data, 14);
          const rsiArrayHTF = getHigherTimeframeRsiArray(data, 14, 4);
          
          const { bgData } = applySignalsAndBackground(data, rsiArrayBase, rsiArrayHTF);
          if (bgSeriesRef.current) bgSeriesRef.current.setData(bgData);
          if (seriesRef.current) {
            seriesRef.current.setData(data);
          }
          
          if (ema25SeriesRef.current) ema25SeriesRef.current.setData(getEmaArray(data, 25));
          if (ema200SeriesRef.current) ema200SeriesRef.current.setData(getEmaArray(data, 200));
          if (currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h') {
             if (ema25_1HSeriesRef.current) ema25_1HSeriesRef.current.setData(getEmaArray(data, 25 * getMultiplier(60)));
             if (ema200_1HSeriesRef.current) ema200_1HSeriesRef.current.setData(getEmaArray(data, 200 * getMultiplier(60)));
          }
          if (ema200_4HSeriesRef.current) ema200_4HSeriesRef.current.setData(getEmaArray(data, 200 * getMultiplier(240)));
          
          candleDataRef.current = data;
          oldestTimeRef.current = data[0].time * 1000;
        }
      } catch (err) {
        console.error('Extension error:', err);
      } finally {
        setIsExtending(false);
      }
    };

    // Attach to ref to be used in UI outside useEffect
    chartInstanceRef.current.extendHistory = handleExtendHistory;

    loadInitialData();

    // Fetch latest candle every 2 seconds for real-time updates
    const fetchLiveCandle = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${currentInterval}&limit=1`);
        if (!res.ok) return;
        const data = await res.json();
        const d = data[0];
        
        const liveCandle = {
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        };
        
        const currentLast = candleDataRef.current[candleDataRef.current.length - 1];
        if (currentLast && currentLast.time === liveCandle.time && currentLast.close === liveCandle.close) {
           return; // No price change, skip heavy calculations
        }
        
        const currentData = candleDataRef.current;
        if (currentData.length > 0 && currentData[currentData.length - 1].time === liveCandle.time) {
          currentData[currentData.length - 1] = liveCandle;
        } else {
          currentData.push(liveCandle);
        }
        
        candlestickSeries.update(liveCandle);
        
        // Performance Fix: Only calculate indicators on the last 500 candles instead of 43,000!
        const sliceData = currentData.slice(-500);
        
        const rsiArrBase = getRsiArray(sliceData, 14);
        const rsiArrHTF = getHigherTimeframeRsiArray(sliceData, 14, 4);
        const { bgData } = applySignalsAndBackground(sliceData, rsiArrBase, rsiArrHTF);
        
        if (bgData.length > 0) {
            const lastBg = bgData[bgData.length - 1];
            lastBg.time = liveCandle.time; // ensure timestamp matches
            bgSeriesRef.current.update(lastBg);
        }
        
        const ema25Arr = getEmaArray(sliceData, 25);
        if (ema25Arr.length > 0) ema25SeriesRef.current.update(ema25Arr[ema25Arr.length - 1]);
        
        const ema200Arr = getEmaArray(sliceData, 200);
        if (ema200Arr.length > 0) ema200SeriesRef.current.update(ema200Arr[ema200Arr.length - 1]);

        if (currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h') {
           const ema25_1HArr = getEmaArray(sliceData, 25 * getMultiplier(60));
           if (ema25_1HArr.length > 0) ema25_1HSeriesRef.current.update(ema25_1HArr[ema25_1HArr.length - 1]);
           
           const ema200_1HArr = getEmaArray(sliceData, 200 * getMultiplier(60));
           if (ema200_1HArr.length > 0) ema200_1HSeriesRef.current.update(ema200_1HArr[ema200_1HArr.length - 1]);
        }

        const ema200_4HArr = getEmaArray(sliceData, 200 * getMultiplier(240));
        if (ema200_4HArr.length > 0) ema200_4HSeriesRef.current.update(ema200_4HArr[ema200_4HArr.length - 1]);
      } catch (err) {
        // Silently ignore real-time polling errors
      }
    };

    const intervalId = setInterval(fetchLiveCandle, 500);

    chart.subscribeClick((param) => {
        if (!param.point) return;
        
        if (measureStepRef.current === 1) {
            // Start measuring
            const logical = param.logical ?? chartInstanceRef.current.timeScale().coordinateToLogical(param.point.x);
            const price = seriesRef.current.coordinateToPrice(param.point.y);
            
            if (price !== null && logical !== null) {
               measureStartRef.current = { x: param.point.x, y: param.point.y, logical, price };
               measureCurrentRef.current = { x: param.point.x, y: param.point.y, logical, price };
               measureStepRef.current = 2; // Follow mouse
            }
        } else if (measureStepRef.current === 2) {
            // Lock measurement
            measureStepRef.current = 3;
            chartInstanceRef.current.applyOptions({
                handleScroll: true,
                handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
            });
        } else if (measureStepRef.current === 3) {
            // Dismiss on 3rd tap for mobile users
            setMeasureActive(false);
        }
    });
    
    const handleContextMenu = (e) => {
        if (measureStepRef.current > 0) {
            e.preventDefault(); // Prevent browser context menu
            e.stopPropagation();
            setMeasureActive(false); // Dismiss measure tool
        }
    };

    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu, { capture: true });

    chart.subscribeCrosshairMove((param) => {
       if (measureStepRef.current === 2 && measureStartRef.current && param.point) {
          measureCurrentRef.current = { 
             point: param.point, 
             time: param.time, 
             logical: param.logical, 
             price: seriesRef.current.coordinateToPrice(param.point.y) 
          };
       }
    });

    let animationFrameId;
    const syncOverlay = () => {
      if (seriesRef.current && (positionRef.current || dragPositionRef.current) && chartInstanceRef.current) {
        const activePos = dragPositionRef.current || positionRef.current;
        const entryY = seriesRef.current.priceToCoordinate(activePos.entry);
        const tpY = seriesRef.current.priceToCoordinate(activePos.tp);
        const slY = seriesRef.current.priceToCoordinate(activePos.sl);
        const startX = chartInstanceRef.current.timeScale().timeToCoordinate(activePos.startTime);
        const boxWidth = 250;
        
        if (entryY !== null && tpY !== null && slY !== null && startX !== null) {
          const isLong = activePos.type === 'long';
          const profitTop = Math.min(entryY, tpY);
          const profitHeight = Math.abs(entryY - tpY);
          const lossTop = Math.min(entryY, slY);
          const lossHeight = Math.abs(entryY - slY);
          const spread = activePos.spread || 0;
          const profitUsd = isLong ? (activePos.tp - activePos.entry - spread) * activePos.lots : (activePos.entry - activePos.tp - spread) * activePos.lots;
          const lossUsd = isLong ? (activePos.sl - activePos.entry - spread) * activePos.lots : (activePos.entry - activePos.sl - spread) * activePos.lots;
          
          if (document.getElementById('tv-overlay-container')) document.getElementById('tv-overlay-container').style.display = 'block';
          
          if (document.getElementById('tv-profit-zone')) {
             document.getElementById('tv-profit-zone').style.top = profitTop + 'px';
             document.getElementById('tv-profit-zone').style.height = profitHeight + 'px';
             document.getElementById('tv-profit-zone').style.left = startX + 'px';
             document.getElementById('tv-profit-zone').style.width = boxWidth + 'px';
             if (document.getElementById('tv-profit-text')) document.getElementById('tv-profit-text').innerText = 'TP: $' + activePos.tp.toFixed(2) + ' | Profit: $' + profitUsd.toFixed(2);
          }
          if (document.getElementById('tv-loss-zone')) {
             document.getElementById('tv-loss-zone').style.top = lossTop + 'px';
             document.getElementById('tv-loss-zone').style.height = lossHeight + 'px';
             document.getElementById('tv-loss-zone').style.left = startX + 'px';
             document.getElementById('tv-loss-zone').style.width = boxWidth + 'px';
             if (document.getElementById('tv-loss-text')) document.getElementById('tv-loss-text').innerText = 'SL: $' + activePos.sl.toFixed(2) + ' | Loss: $' + lossUsd.toFixed(2);
          }
          if (document.getElementById('tv-entry-line')) document.getElementById('tv-entry-line').style.top = entryY + 'px';
          
            if (document.getElementById('tv-tp-guide')) document.getElementById('tv-tp-guide').style.top = tpY + 'px';
            if (document.getElementById('tv-sl-guide')) document.getElementById('tv-sl-guide').style.top = slY + 'px';
            if (document.getElementById('tv-center-guide')) document.getElementById('tv-center-guide').style.top = entryY + 'px';
            if (document.getElementById('tv-vertical-guide')) document.getElementById('tv-vertical-guide').style.left = startX + 'px';
            
            if (document.getElementById('tv-tp-handle')) document.getElementById('tv-tp-handle').style.top = tpY + 'px';
            if (document.getElementById('tv-sl-handle')) document.getElementById('tv-sl-handle').style.top = slY + 'px';
            if (document.getElementById('tv-center-handle')) document.getElementById('tv-center-handle').style.top = entryY + 'px';
            
            if (document.getElementById('tv-floating-panel')) {
               document.getElementById('tv-floating-panel').style.left = (startX + boxWidth + 15) + 'px';
               document.getElementById('tv-floating-panel').style.top = entryY + 'px';
            }
            if (document.getElementById('tv-panel-profit')) {
               document.getElementById('tv-panel-profit').innerText = '+$' + profitUsd.toFixed(2);
            }
            if (document.getElementById('tv-panel-loss')) {
               document.getElementById('tv-panel-loss').innerText = '-$' + Math.abs(lossUsd).toFixed(2);
            }
            
            if (document.getElementById('tv-rr-text')) {
               document.getElementById('tv-rr-text').innerText = (Math.abs(profitUsd) / Math.max(0.0001, Math.abs(lossUsd))).toFixed(2);
            }
        } else {
          if (document.getElementById('tv-overlay-container')) document.getElementById('tv-overlay-container').style.display = 'none';
        }
      } else {
        if (document.getElementById('tv-overlay-container')) document.getElementById('tv-overlay-container').style.display = 'none';
      }
      
      if (measureStepRef.current >= 2 && measureStartRef.current && measureCurrentRef.current) {
           const start = measureStartRef.current;
           const current = measureCurrentRef.current;
           
           const getX = (refPoint) => {
               if (refPoint.logical !== undefined && refPoint.logical !== null) {
                   const x = chartInstanceRef.current.timeScale().logicalToCoordinate(refPoint.logical);
                   if (x !== null) return x;
               }
               if (refPoint.time) {
                   const x = chartInstanceRef.current.timeScale().timeToCoordinate(refPoint.time);
                   if (x !== null) return x;
               }
               return refPoint.point ? refPoint.point.x : refPoint.x;
           };

           const startX = getX(start);
           const currentX = getX(current);
           const startY = seriesRef.current.priceToCoordinate(start.price);
           const currentY = seriesRef.current.priceToCoordinate(current.price);
           
           if (startX !== null && currentX !== null && startY !== null && currentY !== null) {
              const left = Math.min(startX, currentX);
              const top = Math.min(startY, currentY);
              const width = Math.max(1, Math.abs(currentX - startX));
              const height = Math.max(1, Math.abs(currentY - startY));
              
              const box = document.getElementById('tv-measure-box');
              if (box) {
                 box.style.display = 'block';
                 box.style.left = left + 'px';
                 box.style.top = top + 'px';
                 box.style.width = width + 'px';
                 box.style.height = height + 'px';
                 box.style.background = current.price >= start.price ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)';
                 box.style.borderColor = current.price >= start.price ? '#4ade80' : '#f87171';
                 
                 const text = document.getElementById('tv-measure-text');
                 if (text) {
                    const priceDiff = current.price - start.price;
                    const pctDiff = (priceDiff / start.price) * 100;
                    
                    let bars = 0;
                    if (current.logical !== undefined && start.logical !== undefined) {
                        bars = Math.abs(Math.round(current.logical - start.logical));
                    }
                    
                    let currentMinutes = 60;
                    const iv = currentInterval;
                    if (iv === '1d') currentMinutes = 1440;
                    else if (iv === '4h') currentMinutes = 240;
                    else if (iv === '30m') currentMinutes = 30;
                    else if (iv === '15m') currentMinutes = 15;
                    else if (iv === '5m') currentMinutes = 5;
                    
                    const timeDiffSeconds = bars * currentMinutes * 60;
                    let timeStr = '';
                    if (timeDiffSeconds >= 86400) timeStr = Math.floor(timeDiffSeconds / 86400) + 'd ' + Math.floor((timeDiffSeconds % 86400) / 3600) + 'h';
                    else if (timeDiffSeconds >= 3600) timeStr = Math.floor(timeDiffSeconds / 3600) + 'h ' + Math.floor((timeDiffSeconds % 3600) / 60) + 'm';
                    else timeStr = Math.floor(timeDiffSeconds / 60) + 'm';
                    
                    text.innerHTML = `
                      <div style="color: ${priceDiff >= 0 ? '#4ade80' : '#f87171'}; font-weight: bold; font-size: 13px;">
                        ${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}${pctDiff.toFixed(2)}%)
                      </div>
                      <div style="color: #cbd5e1; display: flex; justify-content: space-between; gap: 15px; margin-top: 4px;">
                        <span>${bars} bars</span>
                        <span>${timeStr}</span>
                      </div>
                    `;
                 }
              }
           }
      } else {
           const box = document.getElementById('tv-measure-box');
           if (box) box.style.display = 'none';
      }

      animationFrameId = requestAnimationFrame(syncOverlay);
    };
    syncOverlay();

    // Cleanup
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animationFrameId);
      if (chartContainerRef.current) {
          chartContainerRef.current.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      }
      chart.remove();
    };
  }, [currentInterval, symbol]);

  // Drag Interactions
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!draggingRef.current || !seriesRef.current || !positionRef.current || !chartContainerRef.current) return;
      
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;
      
      const newPrice = seriesRef.current.coordinateToPrice(y);
      if (newPrice !== null) {
        const prev = dragPositionRef.current || positionRef.current;
        if (draggingRef.current === 'center') {
          const newEntry = newPrice;
          const priceDelta = newEntry - prev.entry;
          const newTime = chartInstanceRef.current.timeScale().coordinateToTime(x);
          
          dragPositionRef.current = {
            ...prev,
            entry: newEntry,
            tp: prev.tp + priceDelta,
            sl: prev.sl + priceDelta,
            startTime: newTime !== null ? newTime : prev.startTime
          };
        } else {
          dragPositionRef.current = { ...prev, [draggingRef.current]: newPrice };
        }
      }
    };
    
    const handlePointerUp = () => {
      if (dragPositionRef.current) {
         setPosition(dragPositionRef.current);
         dragPositionRef.current = null;
      }
      draggingRef.current = null;
      setDragging(null);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Visibility effects
  useEffect(() => {
    if (ema25SeriesRef.current) ema25SeriesRef.current.applyOptions({ visible: showEma25 });
  }, [showEma25]);

  useEffect(() => {
    if (ema200SeriesRef.current) ema200SeriesRef.current.applyOptions({ visible: showEma200 });
  }, [showEma200]);

  useEffect(() => {
    if (ema25_1HSeriesRef.current) ema25_1HSeriesRef.current.applyOptions({ visible: showEma25_1H && interval !== '1h' });
  }, [showEma25_1H, interval]);

  useEffect(() => {
    if (ema200_1HSeriesRef.current) ema200_1HSeriesRef.current.applyOptions({ visible: showEma200_1H && interval !== '1h' });
  }, [showEma200_1H, interval]);

  useEffect(() => {
    if (ema200_4HSeriesRef.current) ema200_4HSeriesRef.current.applyOptions({ visible: showEma200_4H });
  }, [showEma200_4H]);

  useEffect(() => {
    if (bgSeriesRef.current) bgSeriesRef.current.applyOptions({ visible: showBg });
  }, [showBg]);

  const handleExtendData = async () => {
    if (isExtending || isExtended || candleDataRef.current.length === 0) return;
    setIsExtending(true);
    setLoadingProgress(0);
    try {
        let fullCandles = 43800; // default 1h 5y
        if (interval === '15m') fullCandles = 105120; // 3 years
        if (interval === '5m') fullCandles = 105120; // 1 year
        
        let currentCandles = candleDataRef.current.length;
        let remainingCandles = fullCandles - currentCandles;
        if (remainingCandles <= 0) {
            setIsExtended(true);
            return;
        }
        
        const oldData = await fetchHistoricalKlines(remainingCandles, oldestTimeRef.current - 1, (progress) => {
            setLoadingProgress(progress);
        });
        
        if (oldData.length > 0) {
            const combinedData = [...oldData, ...candleDataRef.current];
            
            const rsiArrayBase = getRsiArray(combinedData, 14);
            const rsiArrayHTF = getHigherTimeframeRsiArray(combinedData, 14, 4);
            
            const { bgData } = applySignalsAndBackground(combinedData, rsiArrayBase, rsiArrayHTF);
            if (bgSeriesRef.current) bgSeriesRef.current.setData(bgData);
            if (seriesRef.current) seriesRef.current.setData(combinedData);
            
            if (ema25SeriesRef.current) ema25SeriesRef.current.setData(getEmaArray(combinedData, 25));
            if (ema200SeriesRef.current) ema200SeriesRef.current.setData(getEmaArray(combinedData, 200));
            if (interval !== '1h') {
               if (ema25_1HSeriesRef.current) ema25_1HSeriesRef.current.setData(getEmaArray(combinedData, 25 * getMultiplier(60)));
               if (ema200_1HSeriesRef.current) ema200_1HSeriesRef.current.setData(getEmaArray(combinedData, 200 * getMultiplier(60)));
            }
            if (ema200_4HSeriesRef.current) ema200_4HSeriesRef.current.setData(getEmaArray(combinedData, 200 * getMultiplier(240)));
            
            candleDataRef.current = combinedData;
            oldestTimeRef.current = combinedData[0].time * 1000;
            setIsExtended(true);
        }
    } catch (err) {
        console.error("Error extending data:", err);
    } finally {
        setIsExtending(false);
    }
  };

  const renderOverlays = () => {
    const lots = position ? position.lots : 0;
    const spread = position ? (position.spread || 0) : 0;
    
    const handleStyle = {
      position: 'absolute', left: 0, right: 0, height: '14px',
      transform: 'translateY(-50%)', cursor: 'ns-resize', pointerEvents: 'auto', zIndex: 20
    };
    
    const profitColor = 'rgba(74, 222, 128, 0.15)'; 
    const profitBorder = '#4ade80';
    const lossColor = 'rgba(248, 113, 113, 0.15)'; 
    const lossBorder = '#f87171';

    return (
      <>
      <div id="tv-overlay-container" style={{ display: 'none', width: '100%', height: '100%', position: 'absolute', top:0, left:0 }}>
          <div id="tv-tp-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: `1px dashed ${profitBorder}`, opacity: dragging === 'tp' || dragging === 'center' ? 0.7 : 0 }} />
          <div id="tv-sl-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: `1px dashed ${lossBorder}`, opacity: dragging === 'sl' || dragging === 'center' ? 0.7 : 0 }} />
          <div id="tv-center-guide" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1', opacity: dragging === 'center' ? 0.7 : 0 }} />
          <div id="tv-vertical-guide" style={{ position: 'absolute', width: '1px', top: 0, bottom: 0, borderLeft: '1px dashed #cbd5e1', opacity: dragging === 'center' ? 0.7 : 0 }} />

        <div id="tv-profit-zone" style={{ position: 'absolute', background: profitColor, borderTop: `1px solid ${profitBorder}`, borderBottom: `1px solid ${profitBorder}` }}>
           <div id="tv-profit-text" style={{ color: profitBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}></div>
        </div>
        
        <div id="tv-loss-zone" style={{ position: 'absolute', background: lossColor, borderTop: `1px solid ${lossBorder}`, borderBottom: `1px solid ${lossBorder}` }}>
           <div id="tv-loss-text" style={{ color: lossBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}></div>
        </div>
        
          <div id="tv-entry-line" style={{ position: 'absolute', height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }} />
          
          <div id="tv-floating-panel" style={{ position: 'absolute', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '4px 8px', pointerEvents: 'auto', zIndex: 40, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
               <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Lots</span>
               <input type="number" value={lotsInput} onChange={e => { setPosition(p => ({...p, lots: parseFloat(e.target.value) || 0})); setLotsInput(e.target.value); }} step="0.01" min="0.01" style={{ width: '55px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} onPointerDown={e => e.stopPropagation()} />
             </div>
             <div style={{ width: '1px', height: '20px', background: '#334155' }} />
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
               <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Spread</span>
               <input type="number" value={spread} onChange={e => setPosition(p => ({...p, spread: parseFloat(e.target.value) || 0}))} step="0.1" min="0" style={{ width: '45px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} onPointerDown={e => e.stopPropagation()} />
             </div>
             <div style={{ width: '1px', height: '20px', background: '#334155' }} />
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
               <span style={{color: '#4ade80', fontSize: '11px', fontWeight: 'bold'}} id="tv-panel-profit">$0.00</span>
               <span style={{color: '#f87171', fontSize: '11px', fontWeight: 'bold'}} id="tv-panel-loss">$0.00</span>
             </div>
             <div style={{ width: '1px', height: '20px', background: '#334155' }} />
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <span style={{color: '#94a3b8', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'}}>R/R</span>
               <span id="tv-rr-text" style={{color: '#f8fafc', fontSize: '13px', fontWeight: 'bold'}}></span>
             </div>
          </div>

        <div id="tv-center-handle" className="tv-handle" style={{ position: 'absolute', height: '24px', left: 0, right: 0, transform: 'translateY(-50%)', cursor: 'move', pointerEvents: 'auto', zIndex: 30 }} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'center'; setDragging('center'); }} />
        <div id="tv-tp-handle" className="tv-handle" style={handleStyle} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'tp'; setDragging('tp'); }} />
        <div id="tv-sl-handle" className="tv-handle" style={handleStyle} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'sl'; setDragging('sl'); }} />
      </div>

      <div id="tv-measure-box" style={{ position: 'absolute', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', pointerEvents: 'none', display: 'none', zIndex: 100 }}>
         <div id="tv-measure-text" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translate(-50%, 5px)', background: '#0f172a', padding: '6px 10px', borderRadius: '6px', border: '1px solid #334155', color: '#f8fafc', fontSize: '11px', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }}>
         </div>
      </div>
      </>
    );
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#0f172a',
      zIndex: 9999
    }}>
      <div className="modal-header-responsive" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '70px', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem' }}>{title}</h2>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', marginRight: '10px' }}>
            {['1d', '4h', '1h', '30m', '15m', '5m'].map(tf => (
              <button
                key={tf}
                onClick={() => { setIsLoading(true); setCurrentInterval(tf); }}
                style={{
                  background: currentInterval === tf ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: currentInterval === tf ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: currentInterval === tf ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', marginRight: '10px', alignItems: 'center' }}>
            <span style={{color: '#94a3b8', fontSize: '0.8rem', marginLeft: '4px'}}>History:</span>
            
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setExtendYears(Math.max(1, extendYears - 1))} style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color='#f8fafc'} onMouseOut={e => e.target.style.color='#94a3b8'}>-</button>
              <span style={{ color: '#f8fafc', fontSize: '0.8rem', minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>{extendYears}Y</span>
              <button onClick={() => setExtendYears(Math.min(10, extendYears + 1))} style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color='#f8fafc'} onMouseOut={e => e.target.style.color='#94a3b8'}>+</button>
            </div>

            <button
              onClick={() => {
                if (chartInstanceRef.current && chartInstanceRef.current.extendHistory) {
                  chartInstanceRef.current.extendHistory();
                }
              }}
              disabled={isExtending}
              style={{
                background: isExtending ? 'transparent' : 'rgba(168, 85, 247, 0.2)',
                color: isExtending ? '#94a3b8' : '#c084fc',
                border: isExtending ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(168, 85, 247, 0.3)',
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: isExtending ? 'default' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
            >
              {isExtending ? '⏳ Loading...' : '⬇️ Load'}
            </button>
          </div>
        </div>
        
        <div className="modal-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '4px' }}>
          
          {/* Measure Tool Button */}
          <button
            onClick={() => setMeasureActive(prev => (prev === 2 ? false : !prev))}
            style={{
              background: measureActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.05)',
              color: measureActive ? '#38bdf8' : '#94a3b8',
              border: measureActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
              padding: '4px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Measure Tool (Click to start, click to stop)"
          >
            📏 Measure
          </button>

          {/* Position Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px', marginRight: '10px' }}>
            <span style={{color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500}}>Lots:</span>
            <input 
              type="number" 
              value={lotsInput} 
              onChange={e => setLotsInput(e.target.value)}
              step="0.01" min="0.01"
              style={{ width: '55px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f8fafc', fontSize: '0.8rem', outline: 'none', padding: '2px 4px' }} 
            />
            <button 
              onClick={() => handleOpenPosition('long')}
              style={{ background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', border: '1px solid #4ade80', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Long</button>
            <button 
              onClick={() => handleOpenPosition('short')}
              style={{ background: 'rgba(248, 113, 113, 0.2)', color: '#f87171', border: '1px solid #f87171', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}>Short</button>
            {position && (
              <button onClick={() => setPosition(null)} style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '4px' }}>âœ•</button>
            )}
          </div>
          {(() => {
            const btns = [
              { label: 'EMA 25', state: showEma25, setter: setShowEma25, color: '#22c55e' },
              { label: 'EMA 200', state: showEma200, setter: setShowEma200, color: '#3b82f6' }
            ];
            if (currentInterval !== '1h' && currentInterval !== '1d' && currentInterval !== '4h') {
              btns.push({ label: 'EMA 25 (1H)', state: showEma25_1H, setter: setShowEma25_1H, color: '#facc15' });
              btns.push({ label: 'EMA 200 (1H)', state: showEma200_1H, setter: setShowEma200_1H, color: '#fb923c' });
            }
            btns.push({ label: 'EMA 200 (4H)', state: showEma200_4H, setter: setShowEma200_4H, color: '#a855f7' });
            btns.push({ label: 'OB/OS Zones', state: showBg, setter: setShowBg, color: '#ef4444' });
            
            return btns.map((item, idx) => (
            <button
              key={idx}
              onClick={() => item.setter(!item.state)}
              style={{
                background: item.state ? `rgba(${hexToRgb(item.color)}, 0.15)` : 'transparent',
                border: `1px solid ${item.state ? item.color : 'rgba(255,255,255,0.2)'}`,
                color: item.state ? item.color : '#94a3b8',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: item.state ? '600' : '400',
              }}
            >
              {item.label}
            </button>
            ));
          })()}
          
          {!isExtended && (
            <button 
              onClick={handleExtendData}
              disabled={isExtending}
              style={{
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid #eab308',
                color: '#eab308',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                cursor: isExtending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '5px'
              }}
            >
              {isExtending ? `Extending (${loadingProgress}%)...` : `⚡ Extend Data`}
            </button>
          )}
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer',
            padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', transition: 'all 0.2s', marginLeft: '10px', flexShrink: 0
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div className="modal-body-responsive" style={{ position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0 }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: '#f59e0b' }}></div>
            <div style={{ color: '#94a3b8' }}>Fetching Initial Data ({loadingProgress}%)...</div>
            <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${loadingProgress}%`, height: '100%', background: '#f59e0b', transition: 'width 0.2s' }}></div>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
             {renderOverlays()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BtcDetailChart;
