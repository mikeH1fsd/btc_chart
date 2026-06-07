import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Chart from './Chart';
import BtcChart from './BtcChart';
import YahooChart from './YahooChart';
import BtcDetailChart from './BtcDetailChart';
import Us100DetailChart from './Us100DetailChart';
import TopCoinsDashboard from './TopCoinsDashboard';
import TrendingCoinsDashboard from './TrendingCoinsDashboard';

const INITIAL_CHARTS = [
  { id: 'usdhkd', title: 'USD / HKD', currency: 'HKD', source: 'Frankfurter API', color: '#38bdf8', historyTitle: 'USD/HKD Exchange Rate History', timeframe: '10 Years' },
  { id: 'btc', title: 'Bitcoin / USDT', currency: 'USDT', source: 'Binance API', color: '#f59e0b', historyTitle: 'Bitcoin Price History', timeframe: '10 Years' },
  { id: 'us100', title: 'US100 / USD', currency: 'USD', source: 'Yahoo Finance', color: '#8b5cf6', historyTitle: 'NASDAQ 100 Index History', timeframe: '5 Years' },
  { id: 'xauusd', title: 'Gold (XAU/USD)', currency: 'USD', source: 'Yahoo Finance', color: '#eab308', historyTitle: 'Gold Price History', timeframe: '5 Years' }
];

// Helper to convert hex to rgba for card border
const getBorderColor = (hex, alpha) => {
  let r = 0, g = 0, b = 0;
  if (hex.startsWith('#')) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function App() {
  const [charts, setCharts] = useState(INITIAL_CHARTS);
  const [stats, setStats] = useState({});
  const [btcDetailConfig, setBtcDetailConfig] = useState(null);
  const [showUs100Detail, setShowUs100Detail] = useState(false);
  const [showTopCoins, setShowTopCoins] = useState(false);
  const [showTrendingCoins, setShowTrendingCoins] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(charts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setCharts(items);
  };

  const handleDataLoaded = useCallback((id, data) => {
    setStats((prev) => {
      // Prevent state update if data is identical to avoid any possible re-renders
      if (prev[id] && prev[id].current === data.current && prev[id].change === data.change) {
        return prev;
      }
      return { ...prev, [id]: data };
    });
  }, []);

  const handleDataLoadedHKD = useCallback((data) => handleDataLoaded('usdhkd', data), [handleDataLoaded]);
  const handleDataLoadedBTC = useCallback((data) => handleDataLoaded('btc', data), [handleDataLoaded]);
  const handleDataLoadedUS100 = useCallback((data) => handleDataLoaded('us100', data), [handleDataLoaded]);
  const handleDataLoadedXAUUSD = useCallback((data) => handleDataLoaded('xauusd', data), [handleDataLoaded]);

  const renderChartComponent = (id) => {
    switch (id) {
      case 'usdhkd':
        return <Chart onDataLoaded={handleDataLoadedHKD} />;
      case 'btc':
        return <BtcChart onDataLoaded={handleDataLoadedBTC} />;
      case 'us100':
        return <YahooChart ticker="^NDX" label="US100" color="#8b5cf6" onDataLoaded={handleDataLoadedUS100} />;
      case 'xauusd':
        return <YahooChart ticker="GC=F" label="Gold" color="#eab308" onDataLoaded={handleDataLoadedXAUUSD} />;
      default:
        return null;
    }
  };

  if (btcDetailConfig) {
    return <BtcDetailChart onClose={() => setBtcDetailConfig(null)} interval={btcDetailConfig.interval} years={btcDetailConfig.years} />;
  }
  if (showUs100Detail) {
    return <Us100DetailChart onClose={() => setShowUs100Detail(false)} />;
  }
  if (showTopCoins) {
    return <TopCoinsDashboard onClose={() => setShowTopCoins(false)} />;
  }

  if (showTrendingCoins) {
    return <TrendingCoinsDashboard onClose={() => setShowTrendingCoins(false)} />;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="title" style={{ fontSize: '2.5rem', margin: 0 }}>Global Markets Dashboard</h1>
          <p className="subtitle" style={{ marginTop: '0.5rem' }}>Real-time Analytics - Drag & Drop to Reorder</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowTrendingCoins(true)}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              border: 'none',
              color: 'white',
              borderRadius: '24px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)'; }}
          >
            <span>🔥</span> Top 10 Trending
          </button>
          
          <button 
            onClick={() => setShowTopCoins(true)}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              border: 'none',
              color: 'white',
              borderRadius: '24px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)'; }}
          >
            <span>🚀</span> View Top 15 Crypto
          </button>
        </div>
      </header>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="charts">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingBottom: '2rem' }}
            >
              {charts.map((chart, index) => {
                const currentStat = stats[chart.id] || { current: '---', change: '---', changePercent: '---', isUp: true };
                
                return (
                  <Draggable key={chart.id} draggableId={chart.id} index={index}>
                    {(provided, snapshot) => (
                      <main
                        className="dashboard"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          ...provided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.9 : 1,
                          transform: snapshot.isDragging ? `${provided.draggableProps.style.transform} scale(1.02)` : provided.draggableProps.style.transform,
                          transition: snapshot.isDragging ? 'none' : provided.draggableProps.style.transition,
                          zIndex: snapshot.isDragging ? 100 : 'auto',
                        }}
                      >
                        <aside 
                           className="glass-card stats-container" 
                           style={{ 
                             borderColor: chart.id === 'usdhkd' ? 'var(--card-border)' : getBorderColor(chart.color, 0.3),
                             position: 'relative'
                           }}
                        >
                          <div 
                            {...provided.dragHandleProps} 
                            style={{ position: 'absolute', top: '15px', right: '15px', cursor: 'grab', color: 'var(--text-secondary)' }}
                            title="Drag to reorder"
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="12" r="1"></circle>
                              <circle cx="9" cy="5" r="1"></circle>
                              <circle cx="9" cy="19" r="1"></circle>
                              <circle cx="15" cy="12" r="1"></circle>
                              <circle cx="15" cy="5" r="1"></circle>
                              <circle cx="15" cy="19" r="1"></circle>
                            </svg>
                          </div>

                          <div className="stat-item">
                            <span className="stat-label">{chart.title}</span>
                            <div className="stat-value">
                              {currentStat.current} <span className="stat-currency">{chart.currency}</span>
                            </div>
                            {currentStat.current !== '---' && (
                              <div>
                                <span 
                                  className={`trend ${currentStat.isUp ? 'up' : 'down'}`} 
                                  style={
                                    chart.id !== 'usdhkd' && currentStat.isUp 
                                    ? { color: '#34d399', background: 'rgba(52, 211, 153, 0.1)' } 
                                    : {}
                                  }
                                >
                                  {currentStat.isUp ? '▲' : '▼'} {Math.abs(currentStat.change)} ({Math.abs(currentStat.changePercent)}%)
                                </span>
                                <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  Past {chart.timeframe}
                                </span>
                              </div>
                            )}

                            {currentStat && currentStat.highest && (
                              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Highest Point (Data Range)</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                                    {chart.currency === 'USDT' || chart.currency === 'USD' ? '$' : ''}{currentStat.highest}
                                  </span>
                                  <span style={{ 
                                    color: '#ef4444', 
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}>
                                    ▼ {Math.abs(currentStat.dropFromHigh)}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Data Source</span>
                              <span style={{ fontWeight: 600 }}>{chart.source}</span>
                            </div>
                          </div>
                        </aside>

                        <section 
                          className="glass-card" 
                          style={{ borderColor: chart.id === 'usdhkd' ? 'var(--card-border)' : getBorderColor(chart.color, 0.3) }}
                        >
                          <div className="chart-header">
                            <h2 className="chart-title">{chart.historyTitle}</h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              {chart.id === 'us100' && (
                                <button 
                                  onClick={() => setShowUs100Detail(true)}
                                  style={{ 
                                    background: 'transparent', border: `1px solid ${chart.color}`, color: chart.color, 
                                    padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem',
                                    transition: 'all 0.2s', fontWeight: '500'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = getBorderColor(chart.color, 0.1) }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  Xem chi tiết H1
                                </button>
                              )}
                              {chart.id === 'btc' && (
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  {[
                                    { label: 'H1 (5Y)', interval: '1h', years: 5 },
                                    { label: '15m (3Y)', interval: '15m', years: 3 },
                                    { label: '5m (1Y)', interval: '5m', years: 1 }
                                  ].map((btn, idx) => (
                                    <button 
                                      key={idx}
                                      onClick={() => setBtcDetailConfig({ interval: btn.interval, years: btn.years })}
                                      style={{ 
                                        background: 'transparent', border: `1px solid ${chart.color}`, color: chart.color, 
                                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
                                        transition: 'all 0.2s', fontWeight: '500'
                                      }}
                                      onMouseOver={(e) => { e.currentTarget.style.background = getBorderColor(chart.color, 0.1) }}
                                      onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                                    >
                                      {btn.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div 
                                className="timeframe-badge" 
                                style={chart.id !== 'usdhkd' ? { color: chart.color, background: getBorderColor(chart.color, 0.1) } : {}}
                              >
                                {chart.timeframe}
                              </div>
                            </div>
                          </div>
                          <div className="chart-container">
                            {renderChartComponent(chart.id)}
                          </div>
                        </section>
                      </main>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

export default App;
