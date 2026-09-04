import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'
import { initAnalytics } from './analytics'
import { initSentry } from './sentry'

// Error tracking (Sentry) — bật khi có VITE_SENTRY_DSN; dev/mock bỏ qua
initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Analytics ẩn danh (tôn trọng Nghị định 13) — chỉ bật khi có VITE_ANALYTICS_DOMAIN
initAnalytics();

// Đăng ký Service Worker để hỗ trợ PWA (cài đặt app, chạy offline cơ bản)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Không đăng ký được Service Worker:', err);
    });
  });
}
