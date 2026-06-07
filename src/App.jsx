import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Chart from './Chart';
import BtcChart from './BtcChart';
import YahooChart from './YahooChart';
import BtcDetailChart from './BtcDetailChart';

const INITIAL_CHARTS = [
  { id: 'usdhkd', title: 'USD / HKD', currency: 'HKD', source: 'Frankfurter API', color: '#38bdf8', historyTitle: 'USD/HKD Exchange Rate History', timeframe: '10 Years' },
  { id: 'btc', title: 'Bitcoin / USDT', currency: 'USDT', source: 'Binance API', color: '#f59e0b', historyTitle: 'Bitcoin Price History', timeframe: '10 Years' }
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
  const [showBtcDetail, setShowBtcDetail] = useState(false);

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

  const renderChartComponent = (id) => {
    switch (id) {
      case 'usdhkd':
        return <Chart onDataLoaded={handleDataLoadedHKD} />;
      case 'btc':
        return <BtcChart onDataLoaded={handleDataLoadedBTC} />;
      default:
        return null;
    }
  };

  if (showBtcDetail) {
    return <BtcDetailChart onClose={() => setShowBtcDetail(false)} />;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="title" style={{ fontSize: '2.5rem' }}>Global Markets Dashboard</h1>
        <p className="subtitle">Real-time Analytics - Drag & Drop to Reorder</p>
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
                              {chart.id === 'btc' && (
                                <button 
                                  onClick={() => setShowBtcDetail(true)}
                                  style={{ 
                                    background: 'transparent', border: '1px solid #f59e0b', color: '#f59e0b', 
                                    padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem',
                                    transition: 'all 0.2s', fontWeight: '500'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)' }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  Xem chi tiết H1
                                </button>
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
