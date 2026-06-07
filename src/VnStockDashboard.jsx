import React, { useState, useCallback } from 'react';
import YahooChart from './YahooChart';

const VnStockDashboard = ({ onClose }) => {
  const [tickerInput, setTickerInput] = useState('');
  const [activeTicker, setActiveTicker] = useState(null);
  
  const initialStats = { current: '---', change: '---', changePercent: '---', isUp: true, highestAllTime: '---', dropFromHighAllTime: '---', highest5y: '---', dropFromHigh5y: '---' };
  const [stats, setStats] = useState(initialStats);

  React.useEffect(() => {
    // Clear stats immediately when ticker changes so old data is dropped
    setStats(initialStats);
  }, [activeTicker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;
    setActiveTicker(tickerInput.trim().toUpperCase());
  };

  const handleDataLoaded = useCallback((data) => {
    setStats(data);
  }, []);

  const currentSymbol = activeTicker ? (activeTicker.includes('.') ? activeTicker : `${activeTicker}.VN`) : '';

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
          <span className="timeframe-badge" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
            1W (Toàn thời gian)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <input
                type="text"
                placeholder="Nhập mã CK (VD: FPT)..."
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
            }}
            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
            onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
            >
              Xem
            </button>
          </form>

          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
            width: '36px', height: '36px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '16px', transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Gợi ý nhanh:</span>
          {['FPT', 'HPG', 'SSI', 'VCB', 'VNM', 'VHM', 'MWG'].map(ticker => (
            <button
              key={ticker}
              onClick={() => { setTickerInput(ticker); setActiveTicker(ticker); }}
              style={{
                background: activeTicker === ticker ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', 
                border: `1px solid ${activeTicker === ticker ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                color: activeTicker === ticker ? '#ef4444' : '#cbd5e1', 
                padding: '4px 12px', borderRadius: '12px',
                fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
                fontWeight: activeTicker === ticker ? 'bold' : 'normal'
              }}
              onMouseOver={e => { if(activeTicker !== ticker) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; } }}
              onMouseOut={e => { if(activeTicker !== ticker) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } }}
            >
              {ticker}
            </button>
          ))}
        </div>

        {/* Similar layout to App.jsx dashboard cards */}
        {activeTicker ? (
          <main className="dashboard" style={{ transform: 'none', opacity: 1, position: 'relative' }}>
            <aside 
              className="glass-card stats-container" 
              style={{ 
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <div className="stat-item">
                <span className="stat-label">Cổ phiếu {activeTicker}</span>
                <div className="stat-value">
                  {stats.current} <span className="stat-currency">VND</span>
                </div>
                {stats.current !== '---' && (
                  <div>
                    <span 
                      className={`trend ${stats.isUp ? 'up' : 'down'}`} 
                      style={
                        stats.isUp 
                        ? { color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' } 
                        : {}
                      }
                    >
                      {stats.isUp ? '▲' : '▼'} {Math.abs(stats.change)} ({Math.abs(stats.changePercent)}%)
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      So với kỳ trước
                    </span>
                  </div>
                )}

                {stats.highestAllTime !== '---' && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Đỉnh Mọi Thời Đại (ATH)</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#e2e8f0' }}>{stats.highestAllTime}</span>
                      <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{stats.dropFromHighAllTime}% từ đỉnh</span>
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '12px', marginBottom: '4px' }}>Đỉnh 5 Năm Gần Nhất</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#e2e8f0' }}>{stats.highest5y}</span>
                      <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{stats.dropFromHigh5y}% từ đỉnh</span>
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <section className="glass-card chart-container" style={{ borderColor: 'rgba(239, 68, 68, 0.1)' }}>
              <div className="chart-wrapper">
                <YahooChart 
                  ticker={currentSymbol} 
                  label={`Biểu đồ giá ${activeTicker}`} 
                  color="#ef4444" 
                  interval="1wk"
                  range="max"
                  onDataLoaded={handleDataLoaded}
                />
              </div>
            </section>
          </main>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: '#64748b', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', background: 'rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</span>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '1.2rem' }}>Chưa chọn mã chứng khoán</h3>
            <p style={{ margin: 0, maxWidth: '400px' }}>Vui lòng nhập mã cổ phiếu vào ô tìm kiếm phía trên hoặc chọn từ danh sách gợi ý để xem biểu đồ chi tiết.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default VnStockDashboard;
