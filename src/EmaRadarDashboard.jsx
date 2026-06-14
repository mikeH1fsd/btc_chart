import React, { useState, useEffect } from 'react';

const calculateEMA = (data, period) => {
  if (data.length <= period) return new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let prevEma = sum / period;
  let ema = new Array(period).fill(null);
  ema[period - 1] = prevEma;
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - prevEma) * k + prevEma;
    ema.push(currentEma);
    prevEma = currentEma;
  }
  return ema;
};

const calculateRSI = (data, period = 14) => {
  if (data.length <= period) return new Array(data.length).fill(null);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi = new Array(period).fill(null);
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let currentRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  rsi[period - 1] = currentRsi;
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    let gain = change >= 0 ? change : 0;
    let loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    currentRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    rsi.push(currentRsi);
  }
  return rsi;
};

const EmaRadarDashboard = ({ onClose, onViewChart }) => {
  const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
  
  const [selectedIndicators, setSelectedIndicators] = useState([]); // ['ema', 'rsi']
  const [isSelectionMode, setIsSelectionMode] = useState(true);
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);

  const toggleIndicator = (type) => {
    setSelectedIndicators(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const startScan = async (forceRescan = false) => {
    if (selectedIndicators.length === 0) return;
    setIsSelectionMode(false);
    
    // Sort array to make cache key deterministic
    const sortedTypes = [...selectedIndicators].sort();
    const CACHE_KEY = `confluenceCache_${sortedTypes.join('_')}_v1`;
    
    if (!forceRescan) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
            setResults(parsed.data);
            setLastScanTime(new Date(parsed.timestamp).toLocaleString());
            setIsScanning(false);
            return;
          }
        } catch (e) {}
      }
    }

    setIsScanning(true);
    setProgress(0);
    setResults([]);

    try {
      const tickerRes = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const tickerData = await tickerRes.json();
      const pairs = tickerData
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 150)
        .map(t => t.symbol);

      setTotalCoins(pairs.length);
      const foundResults = [];
      const batchSize = 10;
      
      for (let i = 0; i < pairs.length; i += batchSize) {
        const batch = pairs.slice(i, i + batchSize);
        
        const promises = batch.map(async (symbol) => {
          try {
            let emaData = null;
            let rsiData = null;
            let isValid = true;

            // 1. Check EMA if selected
            if (sortedTypes.includes('ema')) {
              const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=1000`);
              if (!klineRes.ok) { isValid = false; }
              else {
                const klines = await klineRes.json();
                if (klines.length < 300) { isValid = false; }
                else {
                  const closes = klines.map(k => parseFloat(k[4]));
                  const closeTimes = klines.map(k => k[0]);
                  const ema25 = calculateEMA(closes, 25);
                  const ema200 = calculateEMA(closes, 200);
                  const startIdx = closes.length - 24;
                  const endIdx = closes.length - 1;
                  
                  let foundEma = false;
                  for (let j = startIdx; j <= endIdx; j++) {
                    if (ema25[j - 1] <= ema200[j - 1] && ema25[j] > ema200[j]) {
                      emaData = { timeAgo: endIdx - j, time: new Date(closeTimes[j]).toLocaleString() };
                      foundEma = true;
                      break;
                    }
                  }
                  if (!foundEma) isValid = false;
                }
              }
            }

            // 2. Check RSI if selected and EMA hasn't failed
            if (isValid && sortedTypes.includes('rsi')) {
              const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`);
              if (!klineRes.ok) { isValid = false; }
              else {
                const klines = await klineRes.json();
                if (klines.length < 20) { isValid = false; }
                else {
                  const closes = klines.map(k => parseFloat(k[4]));
                  const closeTimes = klines.map(k => k[0]);
                  const rsi = calculateRSI(closes, 14);
                  const startIdx = closes.length - 14;
                  const endIdx = closes.length - 1;
                  
                  let foundRsi = false;
                  for (let j = endIdx; j >= startIdx; j--) {
                    if (rsi[j] !== null && rsi[j] < 30) {
                      rsiData = { timeAgo: endIdx - j, time: new Date(closeTimes[j]).toLocaleDateString(), value: rsi[j].toFixed(2) };
                      foundRsi = true;
                      break;
                    }
                  }
                  if (!foundRsi) isValid = false;
                }
              }
            }

            if (isValid) {
              return { symbol, emaData, rsiData };
            }
            return null;
          } catch (err) {
            return null;
          }
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(res => { if (res) foundResults.push(res); });
        
        setProgress(prev => prev + batch.length);
        await new Promise(r => setTimeout(r, 300));
      }

      // Sort by whatever has the most recent signal
      foundResults.sort((a, b) => {
        let minAgoA = Math.min(a.emaData?.timeAgo ?? Infinity, a.rsiData?.timeAgo ?? Infinity);
        let minAgoB = Math.min(b.emaData?.timeAgo ?? Infinity, b.rsiData?.timeAgo ?? Infinity);
        return minAgoA - minAgoB;
      });
      
      setResults(foundResults);
      const timestamp = Date.now();
      setLastScanTime(new Date(timestamp).toLocaleString());
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp, data: foundResults }));
    } catch (error) {
      console.error('Scanning failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    window.triggerIndicatorRescan = () => startScan(true);
    return () => { delete window.triggerIndicatorRescan; };
  }, [selectedIndicators]);

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="modal-content" style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        width: '100vw', maxWidth: '100vw', height: '100vh',
        borderRadius: '0', border: 'none',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'none'
      }}>
        <div className="radar-header" style={{
          padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 10
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>📡</span> Radar Hợp Lưu Đa Chỉ Báo
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              {isSelectionMode ? 'Chọn một hoặc nhiều chiến lược để bắt đầu quét hợp lưu.' : 
                `Đang quét với ${selectedIndicators.length} điều kiện: ${selectedIndicators.map(i => i.toUpperCase()).join(' & ')}`}
            </p>
          </div>
          <div className="radar-header-controls" style={{display:'flex', gap:'10px'}}>
            {!isSelectionMode && !isScanning && (
              <button 
                onClick={() => setIsSelectionMode(true)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                ⬅️ Sửa Điều Kiện
              </button>
            )}
            <button 
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
                width: '40px', height: '40px', borderRadius: '50%',
                fontSize: '1.2rem', cursor: 'pointer'
              }}
            >✕</button>
          </div>
        </div>

        {isSelectionMode ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="radar-options-container" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', alignContent: 'center' }}>
              
              <div className="radar-card-item"
                onClick={() => toggleIndicator('ema')}
                style={{
                  background: selectedIndicators.includes('ema') ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.4))' : 'rgba(255,255,255,0.03)',
                  border: selectedIndicators.includes('ema') ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                {selectedIndicators.includes('ema') && (
                  <div style={{position:'absolute', top:'1rem', right:'1rem', color:'#10b981', fontSize:'1.5rem'}}>✓</div>
                )}
                <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📈</div>
                <h3 style={{color:'#f8fafc', margin:'0 0 1rem 0', fontSize:'1.5rem'}}>Golden Cross (EMA)</h3>
                <p style={{color:'#94a3b8', lineHeight:'1.6'}}>Quét hiện tượng <strong>EMA 25 cắt lên EMA 200</strong> trên khung thời gian 1 Giờ (1H) trong vòng 24 giờ qua.</p>
              </div>

              <div className="radar-card-item"
                onClick={() => toggleIndicator('rsi')}
                style={{
                  background: selectedIndicators.includes('rsi') ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.4))' : 'rgba(255,255,255,0.03)',
                  border: selectedIndicators.includes('rsi') ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.1)', 
                  borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                {selectedIndicators.includes('rsi') && (
                  <div style={{position:'absolute', top:'1rem', right:'1rem', color:'#ef4444', fontSize:'1.5rem'}}>✓</div>
                )}
                <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🔥</div>
                <h3 style={{color:'#f8fafc', margin:'0 0 1rem 0', fontSize:'1.5rem'}}>RSI Quá Bán (Oversold)</h3>
                <p style={{color:'#94a3b8', lineHeight:'1.6'}}>Quét hiện tượng <strong>RSI (14) rớt xuống dưới 30</strong> trên khung thời gian 1 Ngày (1D) trong vòng 14 ngày qua.</p>
              </div>
            </div>
            
            <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => startScan(false)}
                disabled={selectedIndicators.length === 0}
                style={{
                  padding: '1rem 3rem', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '12px',
                  background: selectedIndicators.length > 0 ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                  color: selectedIndicators.length > 0 ? '#fff' : '#64748b',
                  border: 'none', cursor: selectedIndicators.length > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: selectedIndicators.length > 0 ? '0 10px 25px rgba(59, 130, 246, 0.4)' : 'none',
                  transition: 'all 0.3s'
                }}
              >
                {selectedIndicators.length === 0 ? 'Chọn ít nhất 1 chỉ báo' : `Bắt Đầu Quét Kết Hợp (${selectedIndicators.length} điều kiện)`}
              </button>
            </div>
          </div>
        ) : isScanning ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', fontSize: '1.5rem' }}>Đang rà soát hợp lưu nhiều lớp...</h3>
            <p style={{ color: '#64748b', marginBottom: '2rem' }}>Hệ thống đang kiểm tra chéo nhiều khung thời gian, quá trình này có thể tốn vài chục giây.</p>
            <div style={{ width: '80%', margin: '0 auto', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(progress / totalCoins) * 100}%`,
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <p style={{ color: '#94a3b8', marginTop: '1rem', fontSize: '1.2rem' }}>Đã quét {progress} / {totalCoins} coin</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10b981' }}>●</span> Tìm thấy {results.length} coin thỏa mãn CÙNG LÚC tất cả điều kiện
                </h3>
                {lastScanTime && (
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                    Lần quét gần nhất: {lastScanTime}
                  </div>
                )}
              </div>
              <button
                onClick={() => window.triggerIndicatorRescan()}
                style={{
                  padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                }}
              >
                🔄 Quét Lại Từ Đầu
              </button>
            </div>
            
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤷‍♂️</div>
                Thị trường hiện tại không có coin nào vượt qua được lớp lọc hợp lưu này.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {results.map((res, idx) => (
                  <div key={res.symbol + idx} style={{
                    background: 'rgba(255,255,255,0.03)', padding: '1.5rem',
                    borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex', flexDirection: 'column', gap: '1rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                  }}>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>{res.symbol}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {res.emaData && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                          <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>CẮT EMA 25/200 (1H)</div>
                          <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{res.emaData.timeAgo === 0 ? 'Mới cắt gần đây nhất' : `Cắt ${res.emaData.timeAgo} giờ trước`}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{res.emaData.time}</div>
                        </div>
                      )}
                      
                      {res.rsiData && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                          <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '4px' }}>RSI DƯỚI 30 (1D)</div>
                          <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{res.rsiData.timeAgo === 0 ? 'Hôm nay' : `${res.rsiData.timeAgo} ngày trước`} - RSI: {res.rsiData.value}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{res.rsiData.time}</div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => onViewChart({
                        symbol: res.symbol,
                        interval: selectedIndicators[0] === 'rsi' && selectedIndicators.length === 1 ? '1d' : '1h',
                        years: 1,
                        title: `${res.symbol} - Radar Signal`
                      })}
                      style={{
                        padding: '12px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', color: 'white',
                        border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                        cursor: 'pointer', marginTop: 'auto', transition: 'opacity 0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.opacity = 0.9}
                      onMouseOut={e => e.currentTarget.style.opacity = 1}
                    >
                      Mở Biểu Đồ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmaRadarDashboard;
