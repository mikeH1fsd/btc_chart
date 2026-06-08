import React, { useState, useEffect } from 'react';
import CryptoChart from './CryptoChart';
import FearGreedChart from './FearGreedChart';

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

        usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

        const top15 = usdtPairs.slice(0, 15).map(ticker => ({
          symbol: ticker.symbol,
          baseAsset: ticker.symbol.replace('USDT', ''),
          color: getCoinColor(ticker.symbol),
          lastPrice: parseFloat(ticker.lastPrice),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          volume: parseFloat(ticker.quoteVolume)
        }));

        setTopCoins(top15);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchTopCoins();
  }, []);

  useEffect(() => {
    if (topCoins.length === 0) return;

    // Initialize statsMap with current price and 24h change from topCoins
    const initialStats = {};
    topCoins.forEach(coin => {
      initialStats[coin.symbol] = {
        current: coin.lastPrice.toFixed(4),
        changePercent: coin.priceChangePercent.toFixed(2),
        isUp: coin.priceChangePercent >= 0,
        isExpanded: false,
        highestLifetime: null,
        highest4Years: null
      };
    });
    setStatsMap(initialStats);

    // Fetch ATH data sequentially
    const fetchATHData = async () => {
      for (let i = 0; i < topCoins.length; i++) {
        const coin = topCoins[i];
        try {
          // Stagger requests
          await new Promise(resolve => setTimeout(resolve, 300));

          // Fetch monthly data for lifetime ATH
          const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${coin.symbol}&interval=1M&limit=1000`);
          if (!response.ok) continue;
          
          const data = await response.json();
          if (!data || data.length === 0) continue;

          const highPrices = data.map(kline => parseFloat(kline[2])); // kline[2] is High price
          const lifetimeATH = Math.max(...highPrices);
          
          // Calculate 4 years ATH (48 months)
          const last4YearsData = data.slice(-48);
          const highPrices4Years = last4YearsData.map(kline => parseFloat(kline[2]));
          const fourYearsATH = Math.max(...highPrices4Years);

          const currentPrice = coin.lastPrice;
          const dropLifetime = lifetimeATH ? ((currentPrice - lifetimeATH) / lifetimeATH) * 100 : 0;
          const drop4Years = fourYearsATH ? ((currentPrice - fourYearsATH) / fourYearsATH) * 100 : 0;

          setStatsMap(prev => {
            const existing = prev[coin.symbol] || {};
            return {
              ...prev,
              [coin.symbol]: {
                ...existing,
                highestLifetime: lifetimeATH.toFixed(4),
                dropLifetime: dropLifetime.toFixed(2),
                highest4Years: fourYearsATH.toFixed(4),
                drop4Years: drop4Years.toFixed(2)
              }
            };
          });
        } catch (err) {
          console.error(`Error fetching ATH for ${coin.symbol}:`, err);
        }
      }
    };

    fetchATHData();
  }, [topCoins]);

  const handleDataLoaded = (symbol, stats) => {
    setStatsMap(prev => {
      const existing = prev[symbol] || {};
      // Merge stats but preserve ATH and expansion state
      return {
        ...prev,
        [symbol]: { ...existing, ...stats }
      };
    });
  };

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#e2e8f0' }}>Loading top coins data from Binance...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <div className="trending-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
          🔥 Top 15 Cryptocurrencies by 24h Volume
        </h2>
        <FearGreedChart />
        <button 
          onClick={onClose}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', 
        gap: '20px' 
      }}>
        {topCoins.map((coin, index) => {
          const stats = statsMap[coin.symbol] || {};
          return (
            <div 
              key={coin.symbol}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: stats.isExpanded ? '520px' : 'auto',
                padding: '1.5rem',
                borderTop: `4px solid ${coin.color}`,
                transition: 'height 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{coin.baseAsset} / USDT</h3>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>Vol: ${(coin.volume / 1000000).toFixed(2)}M</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>${stats.current || coin.lastPrice.toFixed(4)}</div>
                  <div style={{ fontSize: '0.85rem', color: stats.isUp ? '#34d399' : '#f87171' }}>
                    {stats.isUp ? '▲' : '▼'} {Math.abs(stats.changePercent || coin.priceChangePercent)}%
                  </div>
                </div>
              </div>
              
              {stats.isExpanded && (
                <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: '1rem', animation: 'fadeIn 0.5s' }}>
                  <CryptoChart 
                    symbol={coin.symbol} 
                    label={`${coin.baseAsset}/USDT`} 
                    color={coin.color} 
                    index={index}
                    onDataLoaded={(s) => handleDataLoaded(coin.symbol, s)} 
                  />
                </div>
              )}

              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {stats.highestLifetime && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Lifetime ATH</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>${stats.highestLifetime}</span>
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          ▼ {Math.abs(stats.dropLifetime)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>4-Year ATH</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>${stats.highest4Years}</span>
                        <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          ▼ {Math.abs(stats.drop4Years)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => handleDataLoaded(coin.symbol, { isExpanded: !stats.isExpanded })}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopCoinsDashboard;
