import React, { useState, useEffect } from 'react';

const SentimentDashboard = ({ onClose }) => {
  const [topCoins, setTopCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch Top 100 Binance Coins
  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await response.json();
        
        // Filter USDT pairs, sort by volume, get top 100
        const usdtPairs = data
          .filter(t => t.symbol.endsWith('USDT'))
          .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
          .slice(0, 100)
          .map(t => ({
            symbol: t.symbol,
            baseAsset: t.symbol.replace('USDT', ''),
            price: parseFloat(t.lastPrice).toFixed(4),
            change: parseFloat(t.priceChangePercent).toFixed(2)
          }));
          
        setTopCoins(usdtPairs);
        setIsLoadingCoins(false);
      } catch (error) {
        console.error('Error fetching Binance top coins:', error);
        setIsLoadingCoins(false);
      }
    };
    fetchTopCoins();
  }, []);

  const handleSelectCoin = async (coin) => {
    setSelectedCoin(coin);
    setIsLoadingComments(true);
    setComments([]);
    setCopied(false);

    try {
      const response = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${coin.baseAsset}.X.json`);
      if (!response.ok) {
        throw new Error('StockTwits fetch failed');
      }
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        // Sort by likes to simulate "top reacted" and take top 20
        const sortedComments = data.messages
          .sort((a, b) => (b.likes ? b.likes.total : 0) - (a.likes ? a.likes.total : 0))
          .slice(0, 20);
        setComments(sortedComments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleGenerateAIPrompt = () => {
    if (comments.length === 0) return;

    const formattedComments = comments.map((c, index) => 
      `${index + 1}. [Likes: ${c.likes ? c.likes.total : 0}] ${c.user.username}: "${c.body}"`
    ).join('\n\n');

    const prompt = `Dưới đây là 20 bình luận có nhiều lượt tương tác nhất gần đây của cộng đồng đầu tư về đồng tiền mã hóa ${selectedCoin.baseAsset}.
Dựa vào dữ liệu này, hãy phân tích xem tâm lý đám đông hiện tại đang thiên về hướng Bullish (Lạc quan, Mua vào) hay Bearish (Bi quan, Bán tháo) và giải thích ngắn gọn tại sao. Đưa ra một điểm số Sợ hãi & Tham lam (từ 1-100) dựa trên phân tích của bạn.

Danh sách bình luận:
${formattedComments}`;

    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      window.open('https://chatgpt.com', '_blank');
    });
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="modal-content" style={{
        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
        width: '95%', maxWidth: '1200px', height: '90vh',
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 10
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>🧠</span> Phân Tích Tâm Lý Bằng AI
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Trích xuất bình luận cộng đồng thực tế và sử dụng ChatGPT để đánh giá tâm lý thị trường.
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#f8fafc',
              width: '40px', height: '40px', borderRadius: '50%',
              fontSize: '1.2rem', cursor: 'pointer', transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.8)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            ✕
          </button>
        </div>

        {/* Body Layout */}
        <div className="sentiment-container">
          
          {/* Left Panel: Top 100 Coins List */}
          <div className="sentiment-left-panel" style={{
            width: '30%', minWidth: '250px', borderRight: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>Chọn Đồng Coin (Top 100)</h3>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {isLoadingCoins ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Đang tải danh sách...</div>
              ) : (
                topCoins.map((coin, idx) => (
                  <div 
                    key={coin.symbol}
                    onClick={() => handleSelectCoin(coin)}
                    style={{
                      padding: '12px', margin: '4px 0', borderRadius: '12px',
                      background: selectedCoin?.symbol === coin.symbol ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                      border: `1px solid ${selectedCoin?.symbol === coin.symbol ? 'rgba(14, 165, 233, 0.5)' : 'transparent'}`,
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', transition: 'all 0.2s'
                    }}
                    onMouseOver={e => {
                      if (selectedCoin?.symbol !== coin.symbol) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseOut={e => {
                      if (selectedCoin?.symbol !== coin.symbol) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', width: '20px' }}>{idx + 1}</div>
                      <div style={{ fontWeight: 'bold', color: '#f8fafc' }}>{coin.baseAsset}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>${coin.price}</div>
                      <div style={{ color: coin.change >= 0 ? '#34d399' : '#f87171', fontSize: '0.8rem' }}>
                        {coin.change >= 0 ? '+' : ''}{coin.change}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Comments & AI Action */}
          <div className="sentiment-right-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>
            {!selectedCoin ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👈</div>
                <h2>Chọn một đồng coin ở danh sách bên trái</h2>
                <p>Hệ thống sẽ lấy tự động Top bình luận để phân tích AI</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.8rem' }}>
                      Bình luận cộng đồng: {selectedCoin.baseAsset}
                    </h2>
                    <p style={{ margin: '5px 0 0 0', color: '#94a3b8' }}>
                      Top {comments.length} bình luận nổi bật nhất thu thập từ mạng xã hội
                    </p>
                  </div>
                  
                  <button
                    onClick={handleGenerateAIPrompt}
                    disabled={comments.length === 0 || isLoadingComments}
                    style={{
                      padding: '12px 24px',
                      background: copied ? '#10b981' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none', color: 'white', borderRadius: '12px',
                      fontWeight: 'bold', fontSize: '1rem', cursor: comments.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.3s', opacity: comments.length === 0 ? 0.5 : 1
                    }}
                  >
                    <span>{copied ? '✓ Đã Copy Prompt' : '✨ Phân tích bằng ChatGPT'}</span>
                  </button>
                </div>

                {isLoadingComments ? (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loading-spinner" style={{
                      width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                    Không tìm thấy bình luận nào cho đồng coin này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {comments.map((comment) => (
                      <div key={comment.id} style={{
                        background: 'rgba(255,255,255,0.03)', padding: '1rem',
                        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>@{comment.user.username}</span>
                          <span style={{ color: '#f59e0b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ❤️ {comment.likes ? comment.likes.total : 0}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#e2e8f0', lineHeight: '1.5', fontSize: '0.95rem' }}>
                          {comment.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentDashboard;
