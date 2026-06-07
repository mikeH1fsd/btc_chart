import React, { useState, useEffect } from 'react';
import CryptoChart from './CryptoChart';

const STABLECOINS = ['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'BUSDUSDT', 'DAIUSDT', 'EURUSDT'];

// Assign colors deterministically based on symbol
const getCoinColor = (symbol) => {
  const colors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#eab308', '#14b8a6', '#6366f1'];
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const TopCoinsDashboard = ({ onClose }) => {
  const [topCoins, setTopCoins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsMap, setStatsMap] = useState({});

  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!response.ok) throw new Error('Failed to fetch Binance tickers');
        
        const data = await response.json();
        
        const usdtPairs = data.filter(ticker => 
          ticker.symbol.endsWith('USDT') && 
          !STABLECOINS.includes(ticker.symbol) &&
          !ticker.symbol.includes('UPUSDT') &&
          !ticker.symbol.includes('DOWNUSDT') &&
          !ticker.symbol.includes('BULLUSDT') &&
          !ticker.symbol.includes('BEARUSDT')
        );

        // Sort by volume (quoteVolume) descending
        usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

        // Take top 15
        const top15 = usdtPairs.slice(0, 15).map(ticker => ({
          symbol: ticker.symbol,
          baseAsset: ticker.symbol.replace('USDT', ''),
          color: getCoinColor(ticker.symbol)
        }));

        setTopCoins(top15);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopCoins();
  }, []);

  const handleDataLoaded = (symbol, stats) => {
    setStatsMap(prev => ({
      ...prev,
      [symbol]: stats
    }));
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: '#3b82f6', marginBottom: '1rem' }}></div>
        <h2>Đang tải Top 15 Crypto theo khối lượng...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '50px' }}>
        <h2>Lỗi tải dữ liệu</h2>
        <p>{error}</p>
        <button onClick={onClose} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Top 15 Altcoins
          </h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Xếp hạng theo khối lượng giao dịch (24h Volume) trên Binance</p>
        </div>
        <button 
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid #3b82f6',
            color: '#3b82f6',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          ← Back to Dashboard
        </button>
      </header>

      <main style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '20px' 
      }}>
        {topCoins.map((coin, index) => {
          const stats = statsMap[coin.symbol];
          return (
            <div 
              key={coin.symbol}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: stats && stats.isExpanded ? '400px' : 'auto',
                padding: '1.5rem',
                borderTop: `4px solid ${coin.color}`,
                transition: 'height 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{coin.baseAsset} / USDT</h3>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>Binance 1D • 4 Years</div>
                </div>
                {stats && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>${stats.current}</div>
                    <div style={{ fontSize: '0.85rem', color: stats.isUp ? '#34d399' : '#f87171' }}>
                      {stats.isUp ? '▲' : '▼'} {Math.abs(stats.changePercent)}%
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{ flex: stats && stats.isExpanded ? 1 : 0, minHeight: 0, position: 'relative', display: stats && stats.isExpanded ? 'block' : 'none' }}>
                <CryptoChart 
                  symbol={coin.symbol} 
                  label={`${coin.baseAsset}/USDT`} 
                  color={coin.color} 
                  index={index}
                  onDataLoaded={(s) => handleDataLoaded(coin.symbol, s)} 
                />
              </div>

              {!stats && (
                <div style={{ display: 'none' }}>
                  <CryptoChart 
                    symbol={coin.symbol} 
                    label={`${coin.baseAsset}/USDT`} 
                    color={coin.color} 
                    index={index}
                    onDataLoaded={(s) => handleDataLoaded(coin.symbol, s)} 
                  />
                </div>
              )}

              {stats && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stats.highest && (
                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ATH (Range)</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>${stats.highest}</span>
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          ▼ {Math.abs(stats.dropFromHigh)}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleDataLoaded(coin.symbol, { ...stats, isExpanded: !stats.isExpanded })}
                    style={{
                      padding: '8px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
                    {stats.isExpanded ? 'Hide Chart' : 'Extend Chart'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default TopCoinsDashboard;
