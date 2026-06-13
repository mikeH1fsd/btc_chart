import React, { useState, useEffect, useRef } from 'react';

const COOLDOWN_MINUTES = 30;
const TOP_COINS_COUNT = 150;

const SmartMoneyRadar = ({ onClose, onViewChart }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Đang quét thanh khoản thị trường...');
  const [spikes, setSpikes] = useState([]);
  
  // Customizable settings
  const [volMultiplier, setVolMultiplier] = useState(3.0);
  const [priceChangePct, setPriceChangePct] = useState(1.5);
  
  const wsRef = useRef(null);
  const baselinesRef = useRef({});
  const cooldownsRef = useRef({});
  const settingsRef = useRef({ volMultiplier, priceChangePct });

  useEffect(() => {
    settingsRef.current = { volMultiplier, priceChangePct };
  }, [volMultiplier, priceChangePct]);

  useEffect(() => {
    let isMounted = true;

    const initializeRadar = async () => {
      try {
        setInitStatus('1. Đang tải dữ liệu 24h từ Binance...');
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        setInitStatus('2. Phân tích Top ' + TOP_COINS_COUNT + ' đồng coin có thanh khoản tốt nhất...');
        // Lọc USDT pairs, bỏ qua stablecoins
        let usdtPairs = data.filter(c => c.symbol.endsWith('USDT') && !['USDCUSDT', 'TUSDUSDT', 'FDUSDUSDT'].includes(c.symbol));
        usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        
        const topCoins = usdtPairs.slice(0, TOP_COINS_COUNT);
        
        const baselines = {};
        const streams = [];
        
        topCoins.forEach(coin => {
          // Tính trung bình volume 15m (1 ngày có 96 nến 15m)
          const avg15mVol = parseFloat(coin.quoteVolume) / 96;
          baselines[coin.symbol] = {
            avg15mVol,
            price: parseFloat(coin.lastPrice),
            symbol: coin.symbol
          };
          streams.push(`${coin.symbol.toLowerCase()}@kline_15m`);
        });
        
        baselinesRef.current = baselines;
        
        if (!isMounted) return;
        setInitStatus('3. Đang thiết lập kênh nghe trộm (WebSocket) đa luồng...');
        
        const streamUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;
        
        const ws = new WebSocket(streamUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          if (isMounted) {
            setIsInitializing(false);
          }
        };
        
        ws.onmessage = (event) => {
          if (!isMounted) return;
          const msg = JSON.parse(event.data);
          if (!msg.data || !msg.data.k) return;
          
          const kline = msg.data.k;
          const symbol = kline.s;
          const openPrice = parseFloat(kline.o);
          const closePrice = parseFloat(kline.c);
          const currentVol = parseFloat(kline.q); // Quote asset volume (USDT)
          
          const baseline = baselinesRef.current[symbol];
          if (!baseline) return;
          
          const volRatio = currentVol / baseline.avg15mVol;
          const priceChange = ((closePrice - openPrice) / openPrice) * 100;
          
          const currentSettings = settingsRef.current;
          if (volRatio >= currentSettings.volMultiplier && priceChange >= currentSettings.priceChangePct) {
            triggerAlert(symbol, closePrice, priceChange, volRatio, currentVol);
          }
        };
        
        ws.onerror = (err) => {
          console.error('WS Error:', err);
        };
        
      } catch (err) {
        if (isMounted) setInitStatus('Lỗi khởi tạo: ' + err.message);
      }
    };

    initializeRadar();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Run only once, settings changes handled via ref

  const triggerAlert = (symbol, price, priceChange, volRatio, volUsd) => {
    const now = Date.now();
    const lastAlert = cooldownsRef.current[symbol];
    
    // Cooldown check
    if (lastAlert && (now - lastAlert < COOLDOWN_MINUTES * 60 * 1000)) {
      return;
    }
    
    cooldownsRef.current[symbol] = now;
    
    const newSpike = {
      id: Date.now() + symbol,
      symbol,
      time: new Date().toLocaleTimeString('vi-VN'),
      price,
      priceChange,
      volRatio,
      volUsd,
      isNew: true
    };
    
    setSpikes(prev => {
      const updated = [newSpike, ...prev].slice(0, 50);
      return updated;
    });
    
    setTimeout(() => {
      setSpikes(currentSpikes => 
        currentSpikes.map(s => s.id === newSpike.id ? { ...s, isNew: false } : s)
      );
    }, 3000);
  };

  const formatMoney = (val) => {
    if (val > 1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val > 1000) return (val / 1000).toFixed(2) + 'K';
    return val.toFixed(2);
  };

  const handleSimulate = () => {
    const symbols = ['BTCUSDT', 'DOGEUSDT', 'PEPEUSDT', 'SOLUSDT', 'SHIBUSDT'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    triggerAlert(randomSymbol, Math.random() * 100, 2.5 + Math.random(), 3.5 + Math.random(), 5000000 + Math.random() * 10000000);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0, flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="radar-icon-spin" style={{ fontSize: '1.8rem' }}>🎯</span> Radar Dòng Tiền
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Quét 150+ Coin có thanh khoản cao nhất Binance theo thời gian thực (Nến 15M)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Bơm Volume (x lần): {volMultiplier}x</label>
            <input type="range" min="1.5" max="10" step="0.5" value={volMultiplier} onChange={e => setVolMultiplier(parseFloat(e.target.value))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Giá tăng (%): +{priceChangePct}%</label>
            <input type="range" min="0.5" max="5" step="0.1" value={priceChangePct} onChange={e => setPriceChangePct(parseFloat(e.target.value))} />
          </div>
          <button 
            onClick={onClose}
            style={{ padding: '8px 15px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginLeft: '10px' }}
          >
            Đóng ✕
          </button>
        </div>
      </div>

      {isInitializing ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="radar-scanner" style={{ fontSize: '4rem', animation: 'spin 2s linear infinite' }}>📡</div>
          <p style={{ color: '#38bdf8', marginTop: '20px', fontSize: '1.2rem', fontWeight: 'bold', textShadow: '0 0 10px rgba(56, 189, 248, 0.5)' }}>Khởi động hệ thống Radar</p>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{initStatus}</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', animation: 'pulse-green 1.5s infinite' }}></div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Hệ thống đang quét 150 cặp USDT trực tiếp...</span>
            </div>
            <button 
              onClick={handleSimulate}
              style={{ background: 'transparent', border: '1px dashed #64748b', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Giả lập tín hiệu Test
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingRight: '10px' }} className="custom-scrollbar">
            {spikes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', marginTop: '50px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px', opacity: 0.5 }}>📡</div>
                <p>Chưa phát hiện dòng tiền đột biến nào.</p>
                <p style={{ fontSize: '0.85rem' }}>Hãy kiên nhẫn chờ Cá Mập hành động, hoặc bấm nút Giả lập để xem thử!</p>
              </div>
            ) : (
              spikes.map(spike => (
                <div 
                  key={spike.id} 
                  className={`glass-card ${spike.isNew ? 'spike-flash' : ''}`}
                  style={{ 
                    padding: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderLeft: '4px solid #f59e0b',
                    background: spike.isNew ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.5s ease',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '300px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', width: '80px', flexShrink: 0 }}>
                      {spike.time}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', textShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>
                        {spike.symbol.replace('USDT', '')}
                      </h3>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem', color: '#e2e8f0' }}>
                        <span>Giá: <b style={{ color: '#fff' }}>${spike.price < 0.01 ? spike.price.toFixed(6) : spike.price.toFixed(3)}</b></span>
                        <span style={{ color: '#34d399', fontWeight: 'bold' }}>Tăng: +{spike.priceChange.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '25px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Dòng tiền đổ vào (15P)</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#10b981' }}>${formatMoney(spike.volUsd)}</span>
                        <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          x{spike.volRatio.toFixed(1)} lần
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          if (onViewChart) {
                            onViewChart({ interval: '15m', years: 1, symbol: spike.symbol, title: `${spike.symbol.replace('USDT', '')} / USDT` });
                          }
                        }}
                        style={{
                          padding: '10px 15px',
                          background: 'rgba(255,255,255,0.1)',
                          color: '#e2e8f0',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      >
                        📈 Xem Chart
                      </button>
                      <button
                        onClick={() => {
                          const prompt = `Tại sao đồng tiền ảo ${spike.symbol.replace('USDT', '')} lại có dòng tiền đột biến x${spike.volRatio.toFixed(1)} lần và tăng vọt +${spike.priceChange.toFixed(2)}% trên thị trường crypto trong 15 phút vừa qua? Có tin tức gì mớI?`;
                          window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank');
                        }}
                        style={{
                          padding: '10px 15px',
                          background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
                          transition: 'transform 0.2s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        🤖 Hỏi AI
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};

export default SmartMoneyRadar;
