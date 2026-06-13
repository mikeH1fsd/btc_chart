import React, { useState, useEffect, useCallback } from 'react';
import YahooChart from './YahooChart';

const SECTORS = [
  { name: 'Ngân Hàng', icon: '🏦', tickers: ['VCB', 'BID', 'CTG', 'MBB'] },
  { name: 'Bất Động Sản', icon: '🏢', tickers: ['VHM', 'VIC', 'VRE', 'KDH'] },
  { name: 'Chứng Khoán', icon: '📈', tickers: ['SSI', 'VND', 'VCI', 'HCM'] },
  { name: 'Thép - Vật Liệu', icon: '🏗️', tickers: ['HPG', 'HSG', 'NKG', 'HT1'] },
  { name: 'Công Nghệ - Bán Lẻ', icon: '💻', tickers: ['FPT', 'MWG', 'PNJ', 'DGW'] },
  { name: 'Thực Phẩm - Đồ Uống', icon: '🍷', tickers: ['VNM', 'MSN', 'SAB', 'KDC'] },
  { name: 'Năng Lượng - Dầu Khí', icon: '⚡', tickers: ['GAS', 'PVD', 'PVS', 'POW'] }
];

const DEFAULT_TICKERS = SECTORS.flatMap(s => s.tickers);

// Map sector colors
const getSectorColor = (sectorName) => {
  const colors = {
    'Ngân Hàng': '#3b82f6',
    'Bất Động Sản': '#8b5cf6',
    'Chứng Khoán': '#f59e0b',
    'Thép - Vật Liệu': '#94a3b8',
    'Công Nghệ - Bán Lẻ': '#10b981',
    'Thực Phẩm - Đồ Uống': '#ec4899',
    'Năng Lượng - Dầu Khí': '#f97316'
  };
  return colors[sectorName] || '#ef4444';
};

const VnStockDashboard = ({ onClose }) => {
  const [tickerInput, setTickerInput] = useState('');
  const [searchTickers, setSearchTickers] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch of prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const allTickersToFetch = [...new Set([...DEFAULT_TICKERS, ...searchTickers])];
        
        const baseUrl = import.meta.env.DEV 
          ? '/yahoo' 
          : 'https://corsproxy.io/?https://query1.finance.yahoo.com';

        // Fetch each quote independently to allow incremental rendering
        setIsLoading(false); // Stop the global loading spinner early
        
        allTickersToFetch.forEach(async (t) => {
          const symbol = t.includes('.') ? t : (t === 'PVS' ? 'PVS.HN' : `${t}.VN`);
          try {
             let res;
             try {
               res = await fetch(`${baseUrl}/v8/finance/chart/${symbol}?interval=1d&range=20y`);
               if (!res.ok) throw new Error("Primary fetch failed");
             } catch (err) {
               if (!import.meta.env.DEV) {
                 const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=20y`)}`;
                 res = await fetch(fallbackUrl);
               } else {
                 throw err;
               }
             }
             
             if (!res.ok) return null;
             const data = await res.json();
             if (!data.chart.result || data.chart.result.length === 0) return null;
             const result = data.chart.result[0];
             const currentPrice = result.meta.regularMarketPrice;

             // Extract quotes
             const quote = result.indicators?.quote?.[0] || {};
             const highs = quote.high || [];
             const closes = quote.close || [];
             
             const validCloses = closes.filter(c => c !== null);
             const previousCloseIndex = Math.max(0, validCloses.length - 6); // 5 trading days ago
             const previousClose = validCloses.length > 0 ? validCloses[previousCloseIndex] : currentPrice;
             
             const change = currentPrice - previousClose;
             const changePercent = previousClose ? (change / previousClose) * 100 : 0;

             const validHighs = highs.filter(h => h !== null);
             const highestAllTime = validHighs.length > 0 ? Math.max(...validHighs) : currentPrice;
             const pointsIn5Years = 1300; // ~5 years of daily data (260 * 5)
             const highs5y = validHighs.slice(Math.max(validHighs.length - pointsIn5Years, 0));
             const highest5y = highs5y.length > 0 ? Math.max(...highs5y) : currentPrice;

             const dropFromHighAllTime = highestAllTime ? ((currentPrice - highestAllTime) / highestAllTime) * 100 : 0;
             const dropFromHigh5y = highest5y ? ((currentPrice - highest5y) / highest5y) * 100 : 0;

             setStatsMap(prev => {
                if (prev[t]) return prev; // Already fetched
                return {
                  ...prev,
                  [t]: {
                    current: currentPrice.toFixed(2),
                    changePercent: changePercent.toFixed(2),
                    isUp: changePercent >= 0,
                    isExpanded: false,
                    highestAllTime: highestAllTime.toFixed(2),
                    dropFromHighAllTime: dropFromHighAllTime.toFixed(2),
                    highest5y: highest5y.toFixed(2),
                    dropFromHigh5y: dropFromHigh5y.toFixed(2)
                  }
                };
             });
          } catch(e) {}
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchPrices();
  }, [searchTickers]);

  const handleSearch = (e) => {
    e.preventDefault();
    const symbol = tickerInput.trim().toUpperCase();
    if (!symbol) return;
    
    if (!DEFAULT_TICKERS.includes(symbol) && !searchTickers.includes(symbol)) {
      setSearchTickers([symbol, ...searchTickers]);
    } else {
       // if it already exists, just expand it (if it has stats)
       handleDataLoaded(symbol, { isExpanded: true });
    }
    setTickerInput('');
  };

  const handleDataLoaded = useCallback((ticker, data) => {
    setStatsMap(prev => ({
      ...prev,
      [ticker]: { ...prev[ticker], ...data }
    }));
  }, []);

  const renderCard = (ticker, sectorName, sectorColor) => {
    const stats = statsMap[ticker] || {};
    return (
      <div 
        key={ticker}
        className="glass-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: stats.isExpanded ? '600px' : 'auto',
          padding: '1.5rem',
          borderTop: `4px solid ${sectorColor}`,
          transition: 'height 0.3s ease',
          background: 'rgba(30, 41, 59, 0.7)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{ticker}</h3>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>{sectorName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 600 }}>{stats.current ? `${stats.current}` : '---'}</div>
            {stats.changePercent && (
              <div style={{ fontSize: '0.85rem', color: stats.isUp ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                {stats.isUp ? '▲' : '▼'} {Math.abs(stats.changePercent)}% <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '2px' }}>(1W)</span>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stats.highestAllTime && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Đỉnh Mọi Thời Đại</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stats.highestAllTime}</span>
                  <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ {Math.abs(stats.dropFromHighAllTime)}%
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Đỉnh 5 Năm</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stats.highest5y}</span>
                  <span style={{ color: '#ef4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    ▼ {Math.abs(stats.dropFromHigh5y)}%
                  </span>
                </div>
              </div>
            </div>
          )}

        {stats.isExpanded && (
          <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: '1rem', animation: 'fadeIn 0.5s' }}>
            <YahooChart 
              ticker={ticker === 'PVS' ? 'PVS.HN' : `${ticker}.VN`} 
              label={`Biểu đồ giá ${ticker}`} 
              color={sectorColor} 
              interval="1wk"
              range="max"
              onDataLoaded={(s) => handleDataLoaded(ticker, s)} 
            />
          </div>
        )}
          
          <button 
            onClick={() => handleDataLoaded(ticker, { isExpanded: !stats.isExpanded })}
            style={{
              padding: '10px',
              background: stats.isExpanded ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${stats.isExpanded ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: stats.isExpanded ? '#fca5a5' : '#e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = stats.isExpanded ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}
            onMouseOut={e => e.currentTarget.style.background = stats.isExpanded ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)'}
          >
            {stats.isExpanded ? 'Đóng Biểu Đồ' : 'Mở Biểu Đồ Lịch Sử'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-fullscreen" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#0f172a',
      zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto'
    }}>
      <div className="modal-header modal-header-responsive" style={{
        position: 'sticky', top: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 2rem', height: '70px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        zIndex: 50, background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.8rem' }}>🇻🇳</span> Chứng Khoán Việt Nam
          </h2>
        </div>
        
        <div className="modal-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '15px', width: 'auto' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type="text"
                placeholder="Nhập mã CK (VD: VHM)..."
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '20px', color: '#f8fafc', fontSize: '0.9rem',
                  outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.9rem' }}>
                🔍
              </span>
            </div>
            <button type="submit" style={{
              padding: '0 16px', background: '#ef4444', color: 'white',
              border: 'none', borderRadius: '20px', fontWeight: 'bold',
              cursor: 'pointer', transition: 'background 0.2s', fontSize: '0.9rem'
            }}>
              Tìm Kiếm
            </button>
          </form>

          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
            width: '36px', height: '36px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '16px', transition: 'all 0.2s'
          }}>
            ✕
          </button>
        </div>
      </div>

      <div className="modal-body-responsive" style={{ padding: '2rem 1rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {isLoading && Object.keys(statsMap).length === 0 ? (
           <div className="loading" style={{ height: '50vh' }}>
             <div className="spinner" style={{ borderTopColor: '#ef4444' }}></div>
             <p>Đang tải dữ liệu thị trường...</p>
           </div>
        ) : (
           <>
             <div style={{ marginBottom: '3rem' }}>
               <section className="glass-card" style={{ borderColor: '#ef444430' }}>
                 <div className="chart-header" style={{ marginBottom: '1.5rem' }}>
                   <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                     <span>📊</span> Chỉ Số VN-INDEX
                   </h2>
                 </div>
                 <div className="chart-container" style={{ height: '400px', position: 'relative' }}>
                   <YahooChart 
                     ticker="^VNINDEX.VN" 
                     label="VN-INDEX" 
                     color="#ef4444" 
                     interval="1d"
                     range="5y"
                   />
                 </div>
               </section>
             </div>

            {searchTickers.length > 0 && (
              <div style={{ marginBottom: '3rem' }}>
                <h2 style={{ color: '#f8fafc', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>🔍</span> Kết Quả Tìm Kiếm
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '20px' }}>
                  {searchTickers.map(ticker => renderCard(ticker, 'Tùy Chọn', '#ef4444'))}
                </div>
              </div>
            )}

            {SECTORS.map((sector) => (
              <div key={sector.name} style={{ marginBottom: '3rem' }}>
                <h2 style={{ color: '#f8fafc', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                  <span>{sector.icon}</span> Nhóm {sector.name}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '20px' }}>
                  {sector.tickers.map(ticker => renderCard(ticker, sector.name, getSectorColor(sector.name)))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default VnStockDashboard;
