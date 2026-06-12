import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const Us100DetailChart = ({ onClose }) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [showEma25, setShowEma25] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showEma800, setShowEma800] = useState(true);
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
  
  const oldestTimeRef = useRef(null);
  const isFetchingRef = useRef(false);
  const candleDataRef = useRef([]);
  const ema25SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
  const ema800SeriesRef = useRef(null);
  const bgSeriesRef = useRef(null);

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

  const get4HRsiArray = (data, period = 14) => {
    if (!data || data.length === 0) return [];
    
    const closes4H = [];
    const rsiData = [];
    
    for (let i = 0; i < data.length; i++) {
        const date = new Date(data[i].time * 1000);
        const hour = date.getUTCHours();
        if (hour % 4 === 3 || i === data.length - 1) { 
           closes4H.push({ time: data[i].time, close: data[i].close, index1H: i });
        }
    }
    
    if (closes4H.length <= period) return [];
    
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes4H[i].close - closes4H[i - 1].close;
      if (change >= 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    let currentRsiIdx = period;
    
    for (let i = 0; i < data.length; i++) {
       if (currentRsiIdx < closes4H.length - 1 && i > closes4H[currentRsiIdx].index1H) {
           currentRsiIdx++;
           const change = closes4H[currentRsiIdx].close - closes4H[currentRsiIdx - 1].close;
           let gain = change >= 0 ? change : 0;
           let loss = change < 0 ? -change : 0;
           
           avgGain = (avgGain * (period - 1) + gain) / period;
           avgLoss = (avgLoss * (period - 1) + loss) / period;
           
           rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
           rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
       }
       
       if (i >= closes4H[period].index1H) {
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

    const applySignalsAndBackground = (data, rsiData1H, rsiData4H) => {
      const bgData = [];
      
      if (!data || !rsiData1H || !rsiData4H || data.length === 0) return { bgData };
      
      const rsiMap1H = {};
      for (let i = 0; i < rsiData1H.length; i++) {
        rsiMap1H[rsiData1H[i].time] = rsiData1H[i].value;
      }
      
      const rsiMap4H = {};
      for (let i = 0; i < rsiData4H.length; i++) {
        rsiMap4H[rsiData4H[i].time] = rsiData4H[i].value;
      }
      
      for (let i = 1; i < data.length; i++) {
        const current = data[i];
        const currentRsi1H = rsiMap1H[current.time];
        const currentRsi4H = rsiMap4H[current.time];
        
        let color = 'transparent';
        
        const ob1H = currentRsi1H >= 70;
        const os1H = currentRsi1H <= 30;
        const ob4H = currentRsi4H >= 70;
        const os4H = currentRsi4H <= 30;
        
        if (ob1H && ob4H) {
           color = 'rgba(220, 38, 38, 0.4)'; // Dark Red
        } else if (ob1H || ob4H) {
           color = 'rgba(239, 68, 68, 0.15)'; // Light Red
        } else if (os1H && os4H) {
           color = 'rgba(22, 163, 74, 0.4)'; // Dark Green
        } else if (os1H || os4H) {
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

  const fetchYahoo = async (query) => {
    const baseUrl = import.meta.env.DEV ? '/yahoo' : 'https://corsproxy.io/?https://query1.finance.yahoo.com';
    let res;
    try {
      res = await fetch(`${baseUrl}${query}`);
      if (!res.ok) throw new Error("Primary failed");
    } catch (err) {
      if (!import.meta.env.DEV) {
        const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com${query}`)}`;
        res = await fetch(fallbackUrl);
      } else {
        throw err;
      }
    }
    return res;
  };

  const fetch2YearsKlines = async (onProgress) => {
    try {
        if (onProgress) onProgress(50);
        const response = await fetchYahoo(`/v8/finance/chart/^NDX?interval=1h&range=730d`);
        if (!response.ok) return [];
        const data = await response.json();
        
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        const validData = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (quote.open[i] !== null && quote.close[i] !== null) {
                validData.push({
                    time: timestamps[i],
                    open: quote.open[i],
                    high: quote.high[i],
                    low: quote.low[i],
                    close: quote.close[i]
                });
            }
        }
        
        // Sort strictly by time and remove duplicates just in case
        const uniqueData = [];
        const seen = new Set();
        validData.sort((a, b) => a.time - b.time).forEach(d => {
          if (!seen.has(d.time)) {
            seen.add(d.time);
            uniqueData.push(d);
          }
        });
        
        if (onProgress) onProgress(100);
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

    const ema800Series = chart.addSeries(LineSeries, {
      color: '#a855f7', // purple
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      priceScaleId: 'right',
    });
    ema800SeriesRef.current = ema800Series;

    const loadInitialData = async () => {
      try {
        const data = await fetch2YearsKlines((progress) => {
          setLoadingProgress(progress);
        });
        
        if (data.length > 0) {
          const rsiArray1H = getRsiArray(data, 14);
          const rsiArray4H = get4HRsiArray(data, 14);
          
          const { bgData } = applySignalsAndBackground(data, rsiArray1H, rsiArray4H);
          if (bgSeriesRef.current) bgSeriesRef.current.setData(bgData);
          if (seriesRef.current) {
            seriesRef.current.setData(data);
          }
          
          if (ema25SeriesRef.current) ema25SeriesRef.current.setData(getEmaArray(data, 25));
          if (ema200SeriesRef.current) ema200SeriesRef.current.setData(getEmaArray(data, 200));
          if (ema800SeriesRef.current) ema800SeriesRef.current.setData(getEmaArray(data, 800));
          
          candleDataRef.current = data;
          oldestTimeRef.current = data[0].time * 1000;
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    // Fetch latest candle every 2 seconds for real-time updates
    const fetchLiveCandle = async () => {
      try {
        const res = await fetchYahoo(`/v8/finance/chart/^NDX?interval=1h&range=1d`);
        if (!res.ok) return;
        const data = await res.json();
        
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        
        if (!timestamps || timestamps.length === 0) return;
        
        const lastIdx = timestamps.length - 1;
        if (quote.close[lastIdx] === null) return;
        
        const liveCandle = {
          time: timestamps[lastIdx],
          open: quote.open[lastIdx],
          high: quote.high[lastIdx],
          low: quote.low[lastIdx],
          close: quote.close[lastIdx],
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
        
        const rsiArr1H = getRsiArray(sliceData, 14);
        const rsiArr4H = get4HRsiArray(sliceData, 14);
        const { bgData } = applySignalsAndBackground(sliceData, rsiArr1H, rsiArr4H);
        
        if (bgData.length > 0) {
            const lastBg = bgData[bgData.length - 1];
            lastBg.time = liveCandle.time; // ensure timestamp matches
            bgSeriesRef.current.update(lastBg);
        }
        
        const ema25Arr = getEmaArray(sliceData, 25);
        if (ema25Arr.length > 0) ema25SeriesRef.current.update(ema25Arr[ema25Arr.length - 1]);
        
        const ema200Arr = getEmaArray(sliceData, 200);
        if (ema200Arr.length > 0) ema200SeriesRef.current.update(ema200Arr[ema200Arr.length - 1]);

        const ema800Arr = getEmaArray(sliceData, 800);
        if (ema800Arr.length > 0) ema800SeriesRef.current.update(ema800Arr[ema800Arr.length - 1]);
      } catch (err) {
        // Silently ignore real-time polling errors
      }
    };

    const intervalId = setInterval(fetchLiveCandle, 1000);

    let lastSyncStateStr = '';
    let animationFrameId;
    const syncOverlay = () => {
      let currentStateStr = '';
      let posData = null;

      // 1. Calculate values
      if (seriesRef.current && (positionRef.current || dragPositionRef.current) && chartInstanceRef.current) {
        const activePos = dragPositionRef.current || positionRef.current;
        const entryY = seriesRef.current.priceToCoordinate(activePos.entry);
        const tpY = seriesRef.current.priceToCoordinate(activePos.tp);
        const slY = seriesRef.current.priceToCoordinate(activePos.sl);
        const startX = chartInstanceRef.current.timeScale().timeToCoordinate(activePos.startTime);
        
        if (entryY !== null && tpY !== null && slY !== null && startX !== null) {
          const isLong = activePos.type === 'long';
          const profitTop = Math.min(entryY, tpY);
          const profitHeight = Math.abs(entryY - tpY);
          const lossTop = Math.min(entryY, slY);
          const lossHeight = Math.abs(entryY - slY);
          const spread = activePos.spread || 0;
          const profitUsd = isLong ? (activePos.tp - activePos.entry - spread) * activePos.lots : (activePos.entry - activePos.tp - spread) * activePos.lots;
          const lossUsd = isLong ? (activePos.sl - activePos.entry - spread) * activePos.lots : (activePos.entry - activePos.sl - spread) * activePos.lots;
          
          posData = { entryY, tpY, slY, startX, profitTop, profitHeight, lossTop, lossHeight, profitUsd, lossUsd, activePos, boxWidth: 250 };
          currentStateStr += `pos_${entryY}_${tpY}_${slY}_${startX}_${profitTop}_${profitHeight}_${lossTop}_${lossHeight}_${profitUsd}_${lossUsd}_${activePos.lots}_${spread}_`;
        } else {
          currentStateStr += 'pos_null_';
        }
      } else {
        currentStateStr += 'pos_null_';
      }

      // 2. Diff with last state
      if (currentStateStr === lastSyncStateStr) {
          animationFrameId = requestAnimationFrame(syncOverlay);
          return;
      }
      lastSyncStateStr = currentStateStr;

      // 3. Apply DOM updates
      if (posData) {
          const { entryY, tpY, slY, startX, profitTop, profitHeight, lossTop, lossHeight, profitUsd, lossUsd, activePos, boxWidth } = posData;
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
            
            if (document.getElementById('tv-tp-circle')) {
              document.getElementById('tv-tp-circle').style.top = tpY + 'px';
              document.getElementById('tv-tp-circle').style.left = startX + 'px';
            }
            if (document.getElementById('tv-sl-circle')) {
              document.getElementById('tv-sl-circle').style.top = slY + 'px';
              document.getElementById('tv-sl-circle').style.left = startX + 'px';
            }
            
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
      animationFrameId = requestAnimationFrame(syncOverlay);
    };
    syncOverlay();

    // Cleanup
    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animationFrameId);
      chart.remove();
    };
  }, []);

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
    if (ema800SeriesRef.current) ema800SeriesRef.current.applyOptions({ visible: showEma800 });
  }, [showEma800]);

  useEffect(() => {
    if (bgSeriesRef.current) bgSeriesRef.current.applyOptions({ visible: showBg });
  }, [showBg]);

  const renderPositionZones = () => {
    if (!position) return null;
    const { lots, spread = 0 } = position;
    
    const handleStyle = {
      position: 'absolute', left: 0, right: 0, height: '14px',
      transform: 'translateY(-50%)', cursor: 'ns-resize', pointerEvents: 'auto', zIndex: 20
    };
    
    const profitColor = 'rgba(74, 222, 128, 0.15)'; 
    const profitBorder = '#4ade80';
    const lossColor = 'rgba(248, 113, 113, 0.15)'; 
    const lossBorder = '#f87171';

    return (
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
        <div id="tv-tp-circle" style={{ position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', background: '#0f172a', border: `2px solid ${profitBorder}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto', zIndex: 45 }} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'tp'; setDragging('tp'); }} />
        <div id="tv-sl-circle" style={{ position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', background: '#0f172a', border: `2px solid ${lossBorder}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto', zIndex: 45 }} onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'sl'; setDragging('sl'); }} />
      </div>
    );
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#0f172a',
      zIndex: 9999
    }}>
      <div className="modal-header modal-header-responsive" style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '70px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 50, background: '#0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem' }}>US100 (NASDAQ)</h2>
          <span className="timeframe-badge" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>1H Timeframe (2 Years)</span>
        </div>
        
        <div className="modal-header-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          {[
            { label: 'EMA 25', state: showEma25, setter: setShowEma25, color: '#22c55e' },
            { label: 'EMA 200', state: showEma200, setter: setShowEma200, color: '#3b82f6' },
            { label: 'EMA 200 (4H)', state: showEma800, setter: setShowEma800, color: '#a855f7' },
            { label: 'OB/OS Zones', state: showBg, setter: setShowBg, color: '#ef4444' }
          ].map((item, idx) => (
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
          ))}
          
          <button 
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
              padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', transition: 'background 0.2s', marginLeft: '1rem'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="modal-body-responsive" style={{ position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0 }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: '#8b5cf6' }}></div>
            <div style={{ color: '#94a3b8' }}>Fetching 2 Years of Data ({loadingProgress}%)...</div>
            <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${loadingProgress}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.2s' }}></div>
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          
          {position && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
               {renderPositionZones()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Us100DetailChart;
