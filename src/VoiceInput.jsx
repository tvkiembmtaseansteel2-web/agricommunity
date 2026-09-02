import React, { useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

// Nút nhập liệu bằng giọng nói — Web Speech API (Chrome/Edge, miễn phí).
// Cách dùng cho nông dân (quen với app nhắn tin):
//   - NHẤN GIỮ để nói, THẢ ra để dừng và tự điền văn bản (push-to-talk).
//   - Nếu không tiện giữ, bấm nhanh để bật/tắt (chế độ bấm).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SUPPORTED = !!SpeechRecognition;

export default function VoiceInput({ onResult, placeholder = 'Nói ghi chú...' }) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef(null);
  const holdRef = useRef(false); // đang nhấn giữ?
  const pressTimerRef = useRef(null); // phân biệt "giữ" vs "bấm nhanh"
  const startedRef = useRef(false);

  const startRecognition = () => {
    if (!SUPPORTED) {
      setStatus('Trình duyệt không hỗ trợ giọng nói. Dùng Chrome hoặc Edge nhé.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    if (recognitionRef.current) return; // đang chạy

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'vi-VN';
    recognition.continuous = true; // ghi tiếp liên tục khi đang giữ
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { setListening(true); startedRef.current = true; };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      startedRef.current = false;
    };
    recognition.onerror = (e) => {
      setListening(false);
      recognitionRef.current = null;
      if (e.error === 'not-allowed') {
        setStatus('Cần cho phép micro (bấm biểu tượng mic trên trình duyệt).');
      } else if (e.error === 'no-speech') {
        setStatus('Không nghe thấy tiếng nói — thử lại nhé.');
      } else {
        setStatus('Có lỗi khi nghe: ' + e.error);
      }
      setTimeout(() => setStatus(''), 3500);
    };
    recognition.onresult = (event) => {
      // Gộp toàn bộ các phần đã nói thành 1 chuỗi
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      onResult(text.trim());
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Không khởi động được nhận diện giọng nói:', err);
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // --- Push-to-talk: NHẤN GIỮ để nói ---
  const handleHoldStart = (e) => {
    e.preventDefault();
    holdRef.current = true;
    // Nếu giữ > 250ms → bắt đầu ghi; ngược lại là click (bật/tắt)
    pressTimerRef.current = setTimeout(() => {
      if (holdRef.current && !recognitionRef.current) startRecognition();
    }, 250);
  };

  const handleHoldEnd = (e) => {
    e.preventDefault();
    clearTimeout(pressTimerRef.current);
    if (holdRef.current && recognitionRef.current) {
      // Vừa nói xong → dừng
      stopRecognition();
    } else {
      // Bấm nhanh → bật/tắt như cũ
      if (listening) stopRecognition();
      else startRecognition();
    }
    holdRef.current = false;
  };

  // Tránh mất focus / cuộn khi giữ trên mobile
  const preventContext = (e) => { e.preventDefault(); };

  const talking = listening;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <button
        type="button"
        onPointerDown={handleHoldStart}
        onPointerUp={handleHoldEnd}
        onPointerLeave={handleHoldEnd}
        onContextMenu={preventContext}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '12px', borderRadius: '12px', cursor: 'grab', fontWeight: 600, fontSize: '14px',
          userSelect: 'none', touchAction: 'none', WebkitUserSelect: 'none',
          border: talking ? '2px solid var(--error-color)' : '2px dashed var(--primary-color)',
          background: talking ? '#ffebee' : 'var(--primary-light)',
          color: talking ? 'var(--error-color)' : 'var(--primary-dark)',
          transform: talking ? 'scale(0.98)' : 'scale(1)',
          transition: 'all 0.15s', width: '100%'
        }}
        title="Nhấn giữ để nói, thả để xong"
      >
        {talking ? <><Mic size={18} /> Đang nghe... thả tay để xong</> : <><Mic size={18} /> {placeholder}</>}
      </button>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
        👆 <strong>Nhấn giữ</strong> để nói • thả tay để dừng và tự điền
      </div>
      {status && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{status}</div>}
    </div>
  );
}
