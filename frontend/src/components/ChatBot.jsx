import { useEffect, useRef, useState } from 'react';
import './ChatBot.css';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const AI_CHAT_URL = `${import.meta.env.VITE_API_BASE_URL || '/api'}/ai/chat`;

const createMessage = (sender, text = '', image = null) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  sender,
  text,
  image,
  time: new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }),
});

function ChatIcon() {
  return (
    <svg className="chatbot__robot-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 7V4" />
      <circle cx="16" cy="3.5" r="1.5" />
      <rect x="6" y="8" width="20" height="17" rx="5" />
      <path d="M6 15H3.5v6H6M26 15h2.5v6H26M10 25v3M22 25v3" />
      <circle cx="12" cy="16" r="1.6" />
      <circle cx="20" cy="16" r="1.6" />
      <path d="M11.5 21h9" />
    </svg>
  );
}

export default function ChatBot({ onPrediction }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    createMessage(
      'bot',
      'Xin chào! 👋 Mình là Trợ Lý JDM WORLD. Hãy gửi ảnh hoặc mô tả để tìm xe; bạn cũng có thể hỏi mình về giao hàng, thanh toán, đổi trả và đơn hàng.'
    ),
  ]);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    setImageError('');

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Vui lòng chọn đúng định dạng hình ảnh.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Hình ảnh không được vượt quá 5 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage({ src: reader.result, name: file.name, file });
    };
    reader.onerror = () => setImageError('Không thể đọc hình ảnh này. Vui lòng thử lại.');
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();

    if ((!trimmedMessage && !selectedImage) || isTyping) return;

    const imageToSend = selectedImage;
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage('user', trimmedMessage, imageToSend?.src || null),
    ]);
    setMessage('');
    removeSelectedImage();
    setIsTyping(true);

    const formData = new FormData();
    if (trimmedMessage) formData.append('message', trimmedMessage);
    if (imageToSend?.file) formData.append('image', imageToSend.file);

    try {
      const response = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(data.message || 'AI không thể xử lý yêu cầu này.');
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage('bot', data.reply),
      ]);

      const bestMatch = data.results?.[0];
      if (bestMatch?.label) {
        onPrediction?.(bestMatch);
      }
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage(
          'bot',
          error.message || 'Không thể kết nối tới AI. Vui lòng thử lại sau.'
        ),
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') setIsOpen(false);
  };

  return (
    <div className={`chatbot ${isOpen ? 'chatbot--open' : ''}`} onKeyDown={handleKeyDown}>
      {isOpen && (
        <section className="chatbot__window" aria-label="Trò chuyện với JDM World">
          <header className="chatbot__header">
            <div className="chatbot__identity">
              <div className="chatbot__avatar" aria-hidden="true">J</div>
              <div>
                <h2>Trợ Lý JDM WORLD</h2>
                <span><i /> Đang hoạt động</span>
              </div>
            </div>
            <button
              type="button"
              className="chatbot__close"
              aria-label="Đóng cửa sổ chat"
              onClick={() => setIsOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="chatbot__messages" aria-live="polite">
            <div className="chatbot__day">Hôm nay</div>
            {messages.map((item) => (
              <div key={item.id} className={`chatbot__row chatbot__row--${item.sender}`}>
                {item.sender === 'bot' && <div className="chatbot__mini-avatar">J</div>}
                <div className="chatbot__message-wrap">
                  <div className="chatbot__bubble">
                    {item.image && <img src={item.image} alt="Hình ảnh đã gửi" />}
                    {item.text && <p>{item.text}</p>}
                  </div>
                  <time>{item.time}</time>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chatbot__row chatbot__row--bot">
                <div className="chatbot__mini-avatar">J</div>
                <div className="chatbot__typing" aria-label="Trợ lý đang trả lời">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot__composer-area">
            {selectedImage && (
              <div className="chatbot__preview">
                <img src={selectedImage.src} alt={`Ảnh xem trước ${selectedImage.name}`} />
                <span>{selectedImage.name}</span>
                <button type="button" onClick={removeSelectedImage} aria-label="Xóa hình ảnh">×</button>
              </div>
            )}
            {imageError && <p className="chatbot__error" role="alert">{imageError}</p>}

            <form className="chatbot__composer" onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                className="chatbot__file-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                tabIndex="-1"
              />
              <button
                type="button"
                className="chatbot__attach"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Đính kèm hình ảnh"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m20.5 11.5-8.2 8.2a6 6 0 0 1-8.5-8.5l8.7-8.7a4 4 0 0 1 5.7 5.7l-8.8 8.7a2 2 0 1 1-2.8-2.8l8.2-8.2" />
                </svg>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Nhập tin nhắn..."
                aria-label="Nội dung tin nhắn"
                maxLength="1000"
              />
              <button
                type="submit"
                className="chatbot__send"
                disabled={(!message.trim() && !selectedImage) || isTyping}
                aria-label="Gửi tin nhắn"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 9-18 9 3.7-9L3 3Z" />
                  <path d="M6.7 12H21" />
                </svg>
              </button>
            </form>
            <small>Hỏi về xe, sản phẩm hoặc dịch vụ của JDM World</small>
          </div>
        </section>
      )}

      <button
        type="button"
        className="chatbot__launcher"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot hỗ trợ'}
        aria-expanded={isOpen}
      >
        {isOpen ? <span className="chatbot__launcher-close">×</span> : <ChatIcon />}
        {!isOpen && <span className="chatbot__badge">1</span>}
      </button>
    </div>
  );
}
