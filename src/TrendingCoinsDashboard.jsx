import React, { useState, useEffect } from 'react';
import BtcDetailChart from './BtcDetailChart';

// Simple in-memory cache to prevent refetching when navigating back
let memoryCache = {
  coingecko: null,
  binance: null,
  sentiments: {}
};

const TrendingCoinsDashboard = ({ onClose }) => {
  const [dataSource, setDataSource] = useState('coingecko'); // 'coingecko' | 'binance'
  const [trendingCoins, setTrendingCoins] = useState(memoryCache.coingecko ? [...memoryCache.coingecko] : []);
  const [isLoading, setIsLoading] = useState(!memoryCache.coingecko);
  const [error, setError] = useState(null);
  const [sentiments, setSentiments] = useState({...memoryCache.sentiments});
  const [detailChartConfig, setDetailChartConfig] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (dataSource === 'coingecko' && memoryCache.coingecko) {
      setTrendingCoins(memoryCache.coingecko);
      setIsLoading(false);
      return;
    }
    if (dataSource === 'binance' && memoryCache.binance) {
      setTrendingCoins(memoryCache.binance);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setTrendingCoins([]);
    
    const fetchCoinGecko = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
        if (!response.ok) throw new Error('Failed to fetch trending coins');
        const data = await response.json();
        
        // Take top 10 for CoinGecko
        const top10Gecko = data.coins.slice(0, 10).map((coin, index) => ({
          rank: index + 1,
          id: coin.item.id,
          name: coin.item.name,
          symbol: coin.item.symbol,
          image: coin.item.large,
          price: coin.item.data.price,
          priceChange24h: coin.item.data.price_change_percentage_24h?.usd || 0,
          marketCap: coin.item.data.market_cap,
          volume: coin.item.data.total_volume
        }));

        if (isMounted) {
          setTrendingCoins(top10Gecko);
          memoryCache.coingecko = top10Gecko;
        }
      } catch (err) {
        console.error('Error fetching trending coins:', err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const fetchBinance = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!response.ok) throw new Error('Failed to fetch Binance data');
        const data = await response.json();
        
        // Filter out non-USDT pairs and stablecoins
        let usdtPairs = data.filter(c => c.symbol.endsWith('USDT') && !['USDCUSDT', 'TUSDUSDT', 'FDUSDUSDT'].includes(c.symbol));
        
        // Sort by Volume to find the most "talked about/traded" coins
        usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        
        // Take top 10 for Binance
        const top10 = usdtPairs.slice(0, 10).map((coin, index) => {
          const high = parseFloat(coin.highPrice);
          const low = parseFloat(coin.lowPrice);
          const last = parseFloat(coin.lastPrice);
          
          // Calculate Buying Pressure vs Selling Pressure
          // Formula: (last - low) / (high - low) * 100
          let buyingPressure = 50;
          if (high > low) {
            buyingPressure = ((last - low) / (high - low)) * 100;
          }
          const sellingPressure = 100 - buyingPressure;

          return {
            rank: index + 1,
            id: coin.symbol,
            name: coin.symbol.replace('USDT', ''),
            symbol: coin.symbol.replace('USDT', ''),
            image: `https://bin.bnbstatic.com/image/admin_mgs_image_center/20201110/87496d50-2408-43e1-bf4d-e2b800998f4e.png`, // Generic crypto icon or use a service
            price: last,
            priceChange24h: parseFloat(coin.priceChangePercent),
            marketCap: 'N/A', // Binance doesn't provide MCap in ticker
            volume: `$${(parseFloat(coin.quoteVolume)).toLocaleString(undefined, {maximumFractionDigits: 0})}`,
            // We pass the sentiment directly for Binance
            sentiment: {
              up: buyingPressure.toFixed(1),
              down: sellingPressure.toFixed(1),
              error: false,
              label: 'Dòng tiền Mua/Bán'
            }
          };
        });

        if (isMounted) {
          setTrendingCoins(top10);
          memoryCache.binance = top10;
        }
      } catch (err) {
         console.error(err);
         if (isMounted) setError(err.message);
      } finally {
         if (isMounted) setIsLoading(false);
      }
    };

    if (dataSource === 'coingecko') {
      fetchCoinGecko();
    } else {
      fetchBinance();
    }

    return () => { isMounted = false; };
  }, [dataSource]);

  // Fetch sentiment for CoinGecko ONLY
  useEffect(() => {
    if (dataSource !== 'coingecko' || trendingCoins.length === 0) return;

    let isMounted = true;
    const fetchSentiments = () => {
      trendingCoins.forEach((coin, index) => {
        // Skip if already in cache AND it was successful
        if (memoryCache.sentiments[coin.id] && !memoryCache.sentiments[coin.id].error) return;

        // Stagger the START of each coin's fetch by 500ms
        setTimeout(async () => {
          if (!isMounted) return;
          
          let success = false;
          let attempts = 0;
          
          while (!success && attempts < 5) {
            try {
              attempts++;
              
              const url = `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
              
              let fetchUrl = url;
              if (attempts === 2) {
                fetchUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
              } else if (attempts === 3) {
                fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
              } else if (attempts === 4) {
                fetchUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
              } else if (attempts === 5) {
                fetchUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
              }
              
              const response = await fetch(fetchUrl);
              
              if (response.status === 429) {
                await new Promise(res => setTimeout(res, 2000)); // Extra wait if rate limited
                continue;
              }
              
              if (!response.ok) {
                 // Wait a bit before retry even for other errors
                 await new Promise(res => setTimeout(res, 1000));
                 continue;
              }
              
              const data = await response.json();
              const newSentiment = {
                up: data.sentiment_votes_up_percentage || 0,
                down: data.sentiment_votes_down_percentage || 0,
                error: false,
                label: 'Vote Tích cực/Tiêu cực'
              };
              memoryCache.sentiments[coin.id] = newSentiment;
              
              if (isMounted) {
                setSentiments(prev => ({
                  ...prev,
                  [coin.id]: newSentiment
                }));
              }
              success = true;
            } catch (err) {
              console.error(`Error fetching sentiment for ${coin.id} on attempt ${attempts}`, err);
              await new Promise(res => setTimeout(res, 1000));
            }
          }
          
          if (!success) {
            const errSentiment = { up: 0, down: 0, error: true, label: 'Lỗi API' };
            // DO NOT cache the error, so it can retry when the user re-enters the page
            if (isMounted) {
              setSentiments(prev => ({
                ...prev,
                [coin.id]: errSentiment
              }));
            }
          }
        }, index * 400); // 400ms stagger between each coin's initial start
      });
    };

    fetchSentiments();

    return () => { isMounted = false; };
  }, [trendingCoins, dataSource]);

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#e2e8f0' }}>Đang tải danh sách từ {dataSource === 'coingecko' ? 'CoinGecko' : 'Binance'}...</div>;
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

  if (detailChartConfig) {
    return (
      <BtcDetailChart 
        onClose={() => setDetailChartConfig(null)} 
        interval={detailChartConfig.interval} 
        years={detailChartConfig.years}
        symbol={detailChartConfig.symbol}
        title={detailChartConfig.title}
      />
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <div className="trending-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🔥 Phân Tích Tâm Lý (Market Sentiment)
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Theo dõi sức nóng và dòng tiền thực tế của thị trường</p>
        </div>
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

      <div className="trending-controls-mobile" style={{ marginBottom: '2rem', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', width: 'fit-content' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 600, marginRight: '10px' }}>Nguồn dữ liệu:</span>
        <button
          onClick={() => setDataSource('coingecko')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: dataSource === 'coingecko' ? '#3b82f6' : 'transparent',
            color: dataSource === 'coingecko' ? '#fff' : '#94a3b8',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🦎 CoinGecko (Top 10 Voting)
        </button>
        <button
          onClick={() => setDataSource('binance')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: dataSource === 'binance' ? '#fbbf24' : 'transparent',
            color: dataSource === 'binance' ? '#000' : '#94a3b8',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          🔶 Binance (Top 10 Money Flow)
        </button>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px' 
      }}>
        {trendingCoins.map((coin) => {
          const coinSentiment = dataSource === 'coingecko' ? sentiments[coin.id] : coin.sentiment;
          
          return (
          <div 
            key={coin.id}
            className="glass-card coin-card-mobile"
            onClick={() => {
              setDetailChartConfig({ interval: '1h', years: 5, symbol: `${coin.symbol.toUpperCase()}USDT`, title: `${coin.name} / USDT` });
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, background 0.2s',
              cursor: 'pointer',
              overflow: 'hidden'
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <div className="coin-card-inner-mobile" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div className="coin-rank-mobile" style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              marginRight: '15px',
              color: coin.rank <= 3 ? '#fbbf24' : '#94a3b8',
              flexShrink: 0
            }}>
              #{coin.rank}
            </div>
            
            {dataSource === 'coingecko' ? (
              <img src={coin.image} alt={coin.name} style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '15px', flexShrink: 0 }} />
            ) : (
              <div className="coin-icon-placeholder" style={{ width: '45px', height: '45px', borderRadius: '50%', marginRight: '15px', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                💎
              </div>
            )}
            
            <div style={{ flex: 1, minWidth: '150px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{coin.name}</h3>
                <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {coin.symbol}
                </span>
              </div>
              <div className="coin-stats-mobile" style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {coin.marketCap !== 'N/A' && <span>MCap: {coin.marketCap}</span>}
                {coin.marketCap !== 'N/A' && <span>•</span>}
                <span>Vol: {coin.volume}</span>
                
                {coinSentiment && !coinSentiment.error && (coinSentiment.up > 0 || coinSentiment.down > 0) && (
                  <>
                    <span className="mobile-hide">•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px' }}>
                      <span>{coinSentiment.label}:</span>
                      <div style={{ width: '60px', height: '6px', background: '#ef4444', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${coinSentiment.up}%`, height: '100%', background: '#10b981' }}></div>
                      </div>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{coinSentiment.up}%</span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{coinSentiment.down}%</span>
                    </div>
                  </>
                )}
                {coinSentiment && coinSentiment.error && (
                  <>
                    <span>•</span>
                    <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#ef4444' }}>API quá tải, thử lại sau</span>
                  </>
                )}
                {(!coinSentiment || (!coinSentiment.error && coinSentiment.up === 0 && coinSentiment.down === 0)) && (
                  <>
                    <span>•</span>
                    <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#64748b' }}>Đang phân tích tâm lý...</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="coin-price-mobile" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {typeof coin.price === 'number' ? `$${coin.price.toFixed(coin.price < 0.01 ? 6 : 2)}` : String(coin.price).replace('$', '~$')}
              </div>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 600,
                color: coin.priceChange24h >= 0 ? '#34d399' : '#f87171',
                marginTop: '4px',
                marginBottom: '10px'
              }}>
                {coin.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(coin.priceChange24h).toFixed(2)}%
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap'
              }}>
                📈 View Chart
              </div>
            </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendingCoinsDashboard;
