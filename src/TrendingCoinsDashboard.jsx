import React, { useState, useEffect } from 'react';

const TrendingCoinsDashboard = ({ onClose }) => {
  const [trendingCoins, setTrendingCoins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sentiments, setSentiments] = useState({});

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/search/trending');
        if (!response.ok) throw new Error('Failed to fetch trending coins');
        const data = await response.json();
        
        // Take top 10
        const top10 = data.coins.slice(0, 10).map((coin, index) => ({
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

        setTrendingCoins(top10);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching trending coins:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, []);

  // Fetch sentiment for each coin staggering by 500ms
  useEffect(() => {
    if (trendingCoins.length === 0) return;

    let isMounted = true;
    const fetchSentiments = async () => {
      for (let i = 0; i < trendingCoins.length; i++) {
        if (!isMounted) break;
        const coin = trendingCoins[i];
        try {
          // Stagger requests to avoid CoinGecko rate limit
          await new Promise(res => setTimeout(res, 500));
          
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`
          );
          if (!response.ok) continue;
          
          const data = await response.json();
          if (isMounted) {
            setSentiments(prev => ({
              ...prev,
              [coin.id]: {
                up: data.sentiment_votes_up_percentage || 0,
                down: data.sentiment_votes_down_percentage || 0
              }
            }));
          }
        } catch (err) {
          console.error(`Error fetching sentiment for ${coin.id}`, err);
        }
      }
    };

    fetchSentiments();

    return () => { isMounted = false; };
  }, [trendingCoins]);

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#e2e8f0' }}>Đang tải danh sách Trending 24h từ CoinGecko...</div>;
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🔥 Top 10 Trending (24h)
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Những đồng coin được tìm kiếm và quan tâm nhiều nhất trong 24 giờ qua</p>
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

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px' 
      }}>
        {trendingCoins.map((coin) => {
          const coinSentiment = sentiments[coin.id];
          return (
          <div 
            key={coin.id}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1.5rem',
              transition: 'transform 0.2s',
              cursor: 'default'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateX(10px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}
          >
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 700,
              marginRight: '20px',
              color: coin.rank <= 3 ? '#fbbf24' : '#94a3b8'
            }}>
              #{coin.rank}
            </div>
            
            <img src={coin.image} alt={coin.name} style={{ width: '50px', height: '50px', borderRadius: '50%', marginRight: '20px' }} />
            
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{coin.name}</h3>
                <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {coin.symbol}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span>MCap: {coin.marketCap || 'N/A'}</span>
                <span>•</span>
                <span>Vol: {coin.volume || 'N/A'}</span>
                
                {coinSentiment && (coinSentiment.up > 0 || coinSentiment.down > 0) && (
                  <>
                    <span>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <span>Tâm lý:</span>
                      <div style={{ width: '60px', height: '6px', background: '#ef4444', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${coinSentiment.up}%`, height: '100%', background: '#10b981' }}></div>
                      </div>
                      <span style={{ color: '#10b981' }}>{coinSentiment.up}%</span>
                      <span style={{ color: '#ef4444' }}>{coinSentiment.down}%</span>
                    </div>
                  </>
                )}
                {(!coinSentiment || (coinSentiment.up === 0 && coinSentiment.down === 0)) && (
                  <>
                    <span>•</span>
                    <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#64748b' }}>Đang phân tích tâm lý...</span>
                  </>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {typeof coin.price === 'number' ? `$${coin.price.toFixed(6)}` : String(coin.price).replace('$', '~$')}
              </div>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 600,
                color: coin.priceChange24h >= 0 ? '#34d399' : '#f87171',
                marginTop: '4px'
              }}>
                {coin.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(coin.priceChange24h).toFixed(2)}%
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
