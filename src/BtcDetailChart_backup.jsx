import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

const hexToRgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const BtcDetailChart = ({ onClose }) => {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const seriesRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [showEma25, setShowEma25] = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showBg, setShowBg] = useState(true);

  const [position, setPosition] = useState(null);
  const [lotsInput, setLotsInput] = useState('0.01');
  const [overlayCoords, setOverlayCoords] = useState(null);
  const [dragging, setDragging] = useState(null);
  const positionRef = useRef(null);
  const draggingRef = useRef(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  
  const oldestTimeRef = useRef(null);
  const isFetchingRef = useRef(false);
  const candleDataRef = useRef([]);
  const ema25SeriesRef = useRef(null);
  const ema200SeriesRef = useRef(null);
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

    const applySignalsAndBackground = (data, rsiData) => {
    const bgData = [];
    
    if (!data || !rsiData || data.length === 0) return { bgData };
    
    const rsiMap = {};
    for (let i = 0; i < rsiData.length; i++) {
      rsiMap[rsiData[i].time] = rsiData[i].value;
    }
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const currentRsi = rsiMap[current.time];
      const prevRsi = rsiMap[prev.time];
      
      if (currentRsi !== undefined && prevRsi !== undefined) {
        if (currentRsi >= 70) {
          bgData.push({ time: current.time, value: 1, color: 'rgba(239, 68, 68, 0.15)' });
        } else if (currentRsi <= 30) {
          bgData.push({ time: current.time, value: 1, color: 'rgba(34, 197, 94, 0.15)' });
        } else {
          bgData.push({ time: current.time, value: 0, color: 'transparent' });
        }
      } else {
        bgData.push({ time: current.time, value: 0, color: 'transparent' });
      }
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

  const fetch5YearsKlines = async (onProgress) => {
    try {
      let allData = [];
      let currentEndTime = Date.now();
      const limit = 1000;
      const targetCandles = 43800; // ~5 years
      const batches = Math.ceil(targetCandles / (limit * 3));
      
      for (let i = 0; i < batches; i++) {
        const promises = [];
        for (let j = 0; j < 3; j++) {
          let url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=${limit}&endTime=${currentEndTime}`;
          promises.push(fetch(url).then(res => res.json()));
          currentEndTime -= limit * 60 * 60 * 1000;
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
          onProgress(Math.min(100, Math.round((allData.length / targetCandles) * 100)));
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

    const loadInitialData = async () => {
      try {
        const data = await fetch5YearsKlines((progress) => {
          setLoadingProgress(progress);
        });
        
        if (data.length > 0) {
          const rsiArray = getRsiArray(data, 14);
          
          const { bgData } = applySignalsAndBackground(data, rsiArray);
          if (bgSeriesRef.current) bgSeriesRef.current.setData(bgData);
          if (seriesRef.current) {
            seriesRef.current.setData(data);
          }
          
          if (ema25SeriesRef.current) ema25SeriesRef.current.setData(getEmaArray(data, 25));
          if (ema200SeriesRef.current) ema200SeriesRef.current.setData(getEmaArray(data, 200));
          
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
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1`);
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
        
        const rsiArr = getRsiArray(sliceData, 14);
        const { bgData } = applySignalsAndBackground(sliceData, rsiArr);
        
        if (bgData.length > 0) {
            const lastBg = bgData[bgData.length - 1];
            lastBg.time = liveCandle.time; // ensure timestamp matches
            bgSeriesRef.current.update(lastBg);
        }
        
        const ema25Arr = getEmaArray(sliceData, 25);
        if (ema25Arr.length > 0) ema25SeriesRef.current.update(ema25Arr[ema25Arr.length - 1]);
        
        const ema200Arr = getEmaArray(sliceData, 200);
        if (ema200Arr.length > 0) ema200SeriesRef.current.update(ema200Arr[ema200Arr.length - 1]);
      } catch (err) {
        // Silently ignore real-time polling errors
      }
    };

    const intervalId = setInterval(fetchLiveCandle, 1000);

    let animationFrameId;
    const syncOverlay = () => {
      if (seriesRef.current && positionRef.current && chartInstanceRef.current) {
        const p = positionRef.current;
        const entryY = seriesRef.current.priceToCoordinate(p.entry);
        const tpY = seriesRef.current.priceToCoordinate(p.tp);
        const slY = seriesRef.current.priceToCoordinate(p.sl);
        const startX = chartInstanceRef.current.timeScale().timeToCoordinate(p.startTime);
        const endX = chartInstanceRef.current.timeScale().width();
        
        if (entryY !== null && tpY !== null && slY !== null && startX !== null) {
          setOverlayCoords(prev => {
            if (prev && prev.entryY === entryY && prev.tpY === tpY && prev.slY === slY && prev.startX === startX && prev.endX === endX) return prev;
            return { entryY, tpY, slY, startX, endX };
          });
        } else {
          setOverlayCoords(prev => prev === null ? null : null);
        }
      } else {
        setOverlayCoords(prev => prev === null ? null : null);
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
        setPosition(prev => {
          if (!prev) return prev;
          
          if (draggingRef.current === 'center') {
            const newEntry = newPrice;
            const priceDelta = newEntry - prev.entry;
            const newTime = chartInstanceRef.current.timeScale().coordinateToTime(x);
            
            return {
              ...prev,
              entry: newEntry,
              tp: prev.tp + priceDelta,
              sl: prev.sl + priceDelta,
              startTime: newTime !== null ? newTime : prev.startTime
            };
          } else {
            return { ...prev, [draggingRef.current]: newPrice };
          }
        });
      }
    };
    
    const handlePointerUp = () => {
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
    if (bgSeriesRef.current) bgSeriesRef.current.applyOptions({ visible: showBg });
  }, [showBg]);

  const renderPositionZones = () => {
    if (!position || !overlayCoords) return null;
    const { type, entry, tp, sl, lots, spread = 0 } = position;
    const { entryY, tpY, slY, startX, endX } = overlayCoords;
    
    const isLong = type === 'long';
    
    // Profit Zone bounds
    const profitTop = Math.min(entryY, tpY);
    const profitHeight = Math.abs(entryY - tpY);
    const profitColor = 'rgba(74, 222, 128, 0.15)'; 
    const profitBorder = '#4ade80';
    
    // Loss Zone bounds
    const lossTop = Math.min(entryY, slY);
    const lossHeight = Math.abs(entryY - slY);
    const lossColor = 'rgba(248, 113, 113, 0.15)'; 
    const lossBorder = '#f87171';
    
    const profitUsd = isLong ? (tp - entry - spread) * lots : (entry - tp - spread) * lots;
    const lossUsd = isLong ? (sl - entry - spread) * lots : (entry - sl - spread) * lots;
    
    const handleStyle = {
      position: 'absolute',
      left: 0,
      right: 0,
      height: '14px',
      transform: 'translateY(-50%)',
      cursor: 'ns-resize',
      pointerEvents: 'auto',
      zIndex: 20
    };

    return (
      <>
        {/* Full-width Guide Lines when dragging */}
        {(dragging === 'tp' || dragging === 'center') && (
          <div style={{ position: 'absolute', top: tpY, height: '1px', left: 0, right: 0, borderTop: `1px dashed ${profitBorder}`, opacity: 0.7 }} />
        )}
        {(dragging === 'sl' || dragging === 'center') && (
          <div style={{ position: 'absolute', top: slY, height: '1px', left: 0, right: 0, borderTop: `1px dashed ${lossBorder}`, opacity: 0.7 }} />
        )}
        {(dragging === 'center') && (
          <div style={{ position: 'absolute', top: entryY, height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1', opacity: 0.7 }} />
        )}

        <div style={{ position: 'absolute', left: startX, width: 220, top: 0, bottom: 0, opacity: 0.9 }}>
          {/* Profit Zone */}
        <div style={{ position: 'absolute', top: profitTop, height: profitHeight, left: 0, right: 0, background: profitColor, borderTop: `1px solid ${profitBorder}`, borderBottom: `1px solid ${profitBorder}` }}>
           <div style={{ color: profitBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
             TP: ${tp.toFixed(2)} | Profit: ${profitUsd.toFixed(2)}
           </div>
        </div>
        
        {/* Loss Zone */}
        <div style={{ position: 'absolute', top: lossTop, height: lossHeight, left: 0, right: 0, background: lossColor, borderTop: `1px solid ${lossBorder}`, borderBottom: `1px solid ${lossBorder}` }}>
           <div style={{ color: lossBorder, fontSize: '11px', fontWeight: 'bold', padding: '2px 4px', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap' }}>
             SL: ${sl.toFixed(2)} | Loss: ${lossUsd.toFixed(2)}
           </div>
        </div>
        
        {/* Entry Line */}
        <div style={{ position: 'absolute', top: entryY, height: '1px', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }} />
        
        {/* Floating Panel OUTSIDE the box to the right */}
        <div style={{ position: 'absolute', top: entryY, left: 'calc(100% + 10px)', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '4px 8px', pointerEvents: 'auto', zIndex: 40, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Lots</span>
             <input 
                type="number" 
                value={lots} 
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setPosition(p => ({...p, lots: val}));
                  setLotsInput(e.target.value);
                }}
                step="0.01" min="0.01"
                style={{ width: '55px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} 
                onPointerDown={e => e.stopPropagation()} 
             />
           </div>

           <div style={{ width: '1px', height: '20px', background: '#334155' }} />
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <span style={{color: '#94a3b8', fontSize: '12px', fontWeight: 600}}>Spread</span>
             <input 
                type="number" 
                value={spread} 
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setPosition(p => ({...p, spread: val}));
                }}
                step="0.1" min="0"
                style={{ width: '45px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', outline: 'none', textAlign: 'center', fontWeight: 'bold', padding: '2px 0' }} 
                onPointerDown={e => e.stopPropagation()} 
             />
           </div>

           <div style={{ width: '1px', height: '20px', background: '#334155' }} />
           
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <span style={{color: '#94a3b8', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Risk / Reward</span>
             <span style={{color: '#f8fafc', fontSize: '13px', fontWeight: 'bold'}}>{(Math.abs(profitUsd) / Math.max(0.0001, Math.abs(lossUsd))).toFixed(2)}</span>
           </div>

        </div>

        {/* Center Drag Handle */}
        <div 
          style={{ position: 'absolute', top: entryY, height: '24px', left: 0, right: 0, transform: 'translateY(-50%)', cursor: 'move', pointerEvents: 'auto', zIndex: 30 }}
          onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'center'; setDragging('center'); }} 
        />
        
        {/* TP/SL Drag Handles */}
        <div 
          style={{ ...handleStyle, top: tpY }} 
          onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'tp'; setDragging('tp'); }} 
        />
        <div 
          style={{ ...handleStyle, top: slY }} 
          onPointerDown={(e) => { e.stopPropagation(); draggingRef.current = 'sl'; setDragging('sl'); }} 
        />
      </div>
      </>
    );
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
      zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      <div className="modal-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem' }}>Bitcoin / USDT</h2>
          <span className="timeframe-badge" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>1H Timeframe (5 Years)</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
      
      <div style={{ flex: 1, position: 'relative', padding: '1rem' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: '#f59e0b' }}></div>
            <div style={{ color: '#94a3b8' }}>Fetching 5 Years of Data ({loadingProgress}%)...</div>
            <div style={{ width: '200px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${loadingProgress}%`, height: '100%', background: '#f59e0b', transition: 'width 0.2s' }}></div>
            </div>
          </div>
        )}
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          
          {position && overlayCoords && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
               {renderPositionZones()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BtcDetailChart;
