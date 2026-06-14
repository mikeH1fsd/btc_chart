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
  
  const [selectedIndicator, setSelectedIndicator] = useState(null); // 'ema' or 'rsi'
  const [results, setResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);

  const startScan = async (indicatorType, forceRescan = false) => {
    setSelectedIndicator(indicatorType);
    const CACHE_KEY = indicatorType === 'ema' ? 'emaRadarCache_v2' : 'rsiRadarCache_v1';
    
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
            if (indicatorType === 'ema') {
              const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=1000`);
              if (!klineRes.ok) return null;
              const klines = await klineRes.json();
              if (klines.length < 300) return null;
              const closes = klines.map(k => parseFloat(k[4]));
              const closeTimes = klines.map(k => k[0]);
              const ema25 = calculateEMA(closes, 25);
              const ema200 = calculateEMA(closes, 200);
              const startIdx = closes.length - 24;
              const endIdx = closes.length - 1;
              for (let j = startIdx; j <= endIdx; j++) {
                if (ema25[j - 1] <= ema200[j - 1] && ema25[j] > ema200[j]) {
                  return { symbol, timeAgo: endIdx - j, time: new Date(closeTimes[j]).toLocaleString(), closePrice: closes[j] };
                }
              }
            } else if (indicatorType === 'rsi') {
              const klineRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`);
              if (!klineRes.ok) return null;
              const klines = await klineRes.json();
              if (klines.length < 20) return null;
              const closes = klines.map(k => parseFloat(k[4]));
              const closeTimes = klines.map(k => k[0]);
              const rsi = calculateRSI(closes, 14);
              const startIdx = closes.length - 14;
              const endIdx = closes.length - 1;
              // find the most recent oversold inside 14 days
              for (let j = endIdx; j >= startIdx; j--) {
                if (rsi[j] !== null && rsi[j] < 30) {
                  return { symbol, timeAgo: endIdx - j, time: new Date(closeTimes[j]).toLocaleDateString(), closePrice: closes[j], rsiValue: rsi[j].toFixed(2) };
                }
              }
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

      foundResults.sort((a, b) => a.timeAgo - b.timeAgo);
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
    window.triggerIndicatorRescan = () => startScan(selectedIndicator, true);
    return () => { delete window.triggerIndicatorRescan; };
  }, [selectedIndicator]);

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
        <div style={{
          padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 10
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>📡</span> Radar Chỉ Báo Đa Năng
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              {!selectedIndicator ? 'Chọn chiến lược quét kỹ thuật để tìm kiếm cơ hội.' : 
                (selectedIndicator === 'ema' ? 'Giao cắt EMA 25 & 200 (Khung 1H) - 24 giờ qua' : 'RSI Quá bán < 30 (Khung 1 Ngày) - 14 ngày qua')}
            </p>
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            {selectedIndicator && !isScanning && (
              <button 
                onClick={() => setSelectedIndicator(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                ⬅️ Trở Về
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

        {!selectedIndicator ? (
          <div style={{ flex: 1, padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div 
              onClick={() => startScan('ema')}
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.2))',
                border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px',
                padding: '2.5rem', width: '350px', cursor: 'pointer', transition: 'all 0.3s'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(16,185,129,0.15)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📈</div>
              <h3 style={{color:'#f8fafc', margin:'0 0 1rem 0', fontSize:'1.5rem'}}>Golden Cross (EMA)</h3>
              <p style={{color:'#94a3b8', lineHeight:'1.6'}}>Quét Top 150 coin tìm hiện tượng <strong>EMA 25 cắt lên EMA 200</strong> trên khung thời gian 1 Giờ (1H) trong vòng 24 giờ qua.</p>
              <ul style={{color:'#10b981', marginTop:'1.5rem', paddingLeft:'1.2rem', fontSize:'0.9rem'}}>
                <li>Báo hiệu xu hướng tăng ngắn hạn.</li>
                <li>Phù hợp lướt sóng Intraday.</li>
              </ul>
            </div>

            <div 
              onClick={() => startScan('rsi')}
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.2))',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px',
                padding: '2.5rem', width: '350px', cursor: 'pointer', transition: 'all 0.3s'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(239,68,68,0.15)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{fontSize:'3rem', marginBottom:'1rem'}}>🔥</div>
              <h3 style={{color:'#f8fafc', margin:'0 0 1rem 0', fontSize:'1.5rem'}}>RSI Quá Bán (Oversold)</h3>
              <p style={{color:'#94a3b8', lineHeight:'1.6'}}>Quét Top 150 coin tìm hiện tượng <strong>RSI (14) rớt xuống dưới 30</strong> trên khung thời gian 1 Ngày (1D) trong vòng 14 ngày qua.</p>
              <ul style={{color:'#f87171', marginTop:'1.5rem', paddingLeft:'1.2rem', fontSize:'0.9rem'}}>
                <li>Báo hiệu đáy dài hạn tiềm năng.</li>
                <li>Phù hợp mua gom (DCA).</li>
              </ul>
            </div>
          </div>
        ) : isScanning ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ color: '#e2e8f0', marginBottom: '1rem', fontSize: '1.5rem' }}>Đang quét thị trường...</h3>
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
                  <span style={{ color: '#10b981' }}>●</span> Tìm thấy {results.length} tín hiệu tiềm năng
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
                Không có đồng coin nào thỏa mãn điều kiện.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {results.map((res, idx) => (
                  <div key={res.symbol + idx} style={{
                    background: 'rgba(255,255,255,0.03)', padding: '1.5rem',
                    borderRadius: '16px', border: selectedIndicator === 'ema' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex', flexDirection: 'column', gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.4rem' }}>{res.symbol}</h3>
                      <span style={{ 
                        background: res.timeAgo === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                        color: res.timeAgo === 0 ? '#34d399' : '#fbbf24', 
                        padding: '4px 8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' 
                      }}>
                        {res.timeAgo === 0 ? 'Mới đây nhất' : `Cách đây ${res.timeAgo} ${selectedIndicator === 'ema' ? 'giờ' : 'ngày'}`}
                      </span>
                    </div>
                    
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                      <strong>Thời điểm:</strong> {res.time}
                      {selectedIndicator === 'rsi' && (
                        <div style={{ color: '#f87171', marginTop: '4px', fontWeight: 'bold' }}>
                          RSI: {res.rsiValue}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => onViewChart({
                        symbol: res.symbol,
                        interval: selectedIndicator === 'ema' ? '1h' : '1d',
                        years: 1,
                        title: `${res.symbol} - Radar Signal`
                      })}
                      style={{
                        padding: '10px', background: '#3b82f6', color: 'white',
                        border: 'none', borderRadius: '8px', fontWeight: 'bold',
                        cursor: 'pointer', marginTop: 'auto'
                      }}
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
