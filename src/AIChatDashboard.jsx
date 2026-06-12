import React, { useState, useRef, useEffect } from 'react';

const AIChatDashboard = ({ onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Xin chào! Mình là trợ lý AI (không giới hạn, không cần API Key). Bạn muốn hỏi thông tin gì về thị trường hoặc phân tích cổ phiếu nào?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context from previous messages
      let context = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      let fullPrompt = `Context:\n${context}\n\nUser: ${userMessage}\nAssistant:`;

      const systemPrompt = "Bạn là chuyên gia phân tích chứng khoán và crypto nhiệt tình, trả lời ngắn gọn, súc tích bằng tiếng Việt.";
      
      const response = await fetch(`https://text.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?system=${encodeURIComponent(systemPrompt)}`);
      
      if (!response.ok) {
        throw new Error('API Request failed');
      }
      
      const data = await response.text();
      
      setMessages(prev => [...prev, { role: 'assistant', content: data }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, hệ thống đang bận. Vui lòng thử lại sau!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🤖 Trợ Lý AI
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>Hỏi đáp trực tiếp - Không giới hạn - Miễn phí 100%</p>
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
          ← Back
        </button>
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 18px',
                borderRadius: '18px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '18px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '1rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 18px',
                borderRadius: '18px',
                borderBottomLeftRadius: '4px',
                background: 'rgba(255,255,255,0.1)',
                color: '#94a3b8',
                display: 'flex',
                gap: '5px',
                alignItems: 'center'
              }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite', animationDelay: '0.2s' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite', animationDelay: '0.4s' }}>●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '15px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', display: 'flex', gap: '10px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI bất cứ điều gì (Nhấn Enter để gửi)..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '12px 15px',
              color: '#fff',
              fontSize: '1rem',
              resize: 'none',
              outline: 'none',
              minHeight: '24px',
              maxHeight: '120px',
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: '0 20px',
              background: isLoading || !input.trim() ? 'rgba(255,255,255,0.1)' : '#10b981',
              color: isLoading || !input.trim() ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatDashboard;
