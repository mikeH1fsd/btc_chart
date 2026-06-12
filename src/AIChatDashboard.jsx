import React, { useState, useRef, useEffect } from 'react';

const AIChatDashboard = ({ onClose }) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [isApiKeySet, setIsApiKeySet] = useState(!!localStorage.getItem('gemini_api_key'));
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Xin chào! Mình là trợ lý AI. Bạn muốn hỏi thông tin gì về thị trường hoặc phân tích cổ phiếu nào?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isApiKeySet) {
      scrollToBottom();
    }
  }, [messages, isLoading, isApiKeySet]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim().length > 10) {
      localStorage.setItem('gemini_api_key', apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      setIsApiKeySet(true);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setIsApiKeySet(false);
    setApiKeyInput('');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !apiKey) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const conversationHistory = messages.filter(m => m.role !== 'assistant' || !m.content.includes('Xin chào! Mình là trợ lý AI')).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const payload = {
        contents: conversationHistory,
        systemInstruction: {
          parts: [{ text: "Bạn là một trợ lý ảo chuyên phân tích thị trường chứng khoán, tiền điện tử, ngoại hối và các xu hướng tài chính. Hãy trả lời ngắn gọn, súc tích và chính xác." }]
        },
        tools: [
          { googleSearch: {} }
        ]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Lỗi API');
      }

      const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không nhận được câu trả lời hợp lệ từ AI.";

      setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);
      setIsLoading(false);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, hệ thống bị lỗi: ' + error.message }]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isApiKeySet) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '40px auto', height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '1.8rem', margin: 0, background: 'linear-gradient(to right, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Thiết lập Gemini API Key
          </h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Vui lòng nhập API Key của Google Gemini để bắt đầu trò chuyện. Khóa này chỉ lưu trữ cục bộ trên trình duyệt của bạn.
          </p>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Nhập API Key vào đây..."
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '12px 15px',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Hủy
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
              style={{
                padding: '10px 20px',
                background: apiKeyInput.trim() ? '#10b981' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: apiKeyInput.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              Lưu & Bắt đầu
            </button>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
            Chưa có API Key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Lấy mã miễn phí tại đây</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem 0', background: 'linear-gradient(to right, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🤖 Trợ Lý AI
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
             <p style={{ color: '#94a3b8', margin: 0 }}>Sử dụng Gemini 2.5 Flash + Web Search</p>
             <button onClick={handleClearApiKey} style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}>Đổi API Key</button>
          </div>
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
