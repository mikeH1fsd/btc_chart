import React, { useState } from 'react';
import YahooChart from './YahooChart';

const VnStockDashboard = ({ onClose }) => {
  const [tickerInput, setTickerInput] = useState('');
  const [activeTicker, setActiveTicker] = useState('FPT'); // default

  const handleSearch = (e) => {
    e.preventDefault();
    if (!tickerInput.trim()) return;
    setActiveTicker(tickerInput.trim().toUpperCase());
  };

  const currentSymbol = activeTicker.includes('.') ? activeTicker : `${activeTicker}.VN`;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-card" style={{
        width: '90%', maxWidth: '900px', height: '80vh',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '20px', right: '20px',
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
            width: '36px', height: '36px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: '18px', zIndex: 10, transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        >
          ✕
        </button>

        <div style={{ padding: '30px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🇻🇳</span> Chứng Khoán Việt Nam
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Tra cứu nhanh biểu đồ cổ phiếu VN (HOSE/HNX)</p>
          
          <form onSubmit={handleSearch} style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <input
                type="text"
                placeholder="Nhập mã chứng khoán (VD: FPT, HPG, SSI...)"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 40px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#f8fafc', fontSize: '15px',
                  outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                🔍
              </span>
            </div>
            <button type="submit" style={{
              padding: '0 24px', background: '#ef4444', color: 'white',
              border: 'none', borderRadius: '8px', fontWeight: 'bold',
              cursor: 'pointer', transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
            onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
            >
              Tra cứu
            </button>
          </form>
          
          <div style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center' }}>Gợi ý:</span>
            {['FPT', 'HPG', 'SSI', 'VCB', 'VNM'].map(ticker => (
              <button
                key={ticker}
                onClick={() => { setTickerInput(ticker); setActiveTicker(ticker); }}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1', padding: '4px 12px', borderRadius: '12px',
                  fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: '30px 40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '20px', left: '40px', zIndex: 5 }}>
             <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>{activeTicker}</h3>
             <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>Biểu đồ giá 5 năm (Cập nhật hàng tuần)</p>
          </div>
          <div style={{ width: '100%', height: '100%', marginTop: '30px' }}>
            <YahooChart 
              ticker={currentSymbol} 
              label={`Giá cổ phiếu ${activeTicker}`} 
              color="#ef4444" 
              onDataLoaded={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VnStockDashboard;
