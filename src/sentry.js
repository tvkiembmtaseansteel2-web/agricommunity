// Sentry error tracking — bật khi có VITE_SENTRY_DSN (production).
// Không cấu hình → bỏ qua hoàn toàn (dev/mock không gửi gì).
import * as Sentry from '@sentry/react';
import { IS_MOCK } from './supabaseClient';

const DSN = import.meta.env?.VITE_SENTRY_DSN;
const ENV = import.meta.env?.MODE || 'production';

export function initSentry() {
  if (!DSN || IS_MOCK) {
    // Dev/mock hoặc chưa cấu hình DSN → không bật error tracking
    console.info('[Sentry] Chưa cấu hình VITE_SENTRY_DSN (hoặc mock mode) — bỏ qua.');
    return false;
  }

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    // Gửi thông tin release/version nếu có
    release: `agri-community@${import.meta.env?.VITE_APP_VERSION || '1.0.0'}`,
    // Chỉ ghi lại lỗi thật sự quan trọng, không ghi rác
    tracesSampleRate: 0.0,       // không ghi performance trace (đỡ tốn quota)
    replaysSessionSampleRate: 0.0, // tắt session replay (quyền riêng tư nông dân)
    replaysOnErrorSampleRate: 0.0,
    // Không gửi thông tin nhạy cảm tự động: giữ nguyên để tránh lộ dữ liệu
    beforeSend(event) {
      // Loại bỏ thông tin có thể chứa dữ liệu cá nhân trước khi gửi
      if (event.user) {
        // Không gửi email/phone của người dùng nếu chưa rõ ràng cần thiết
        event.user = { id: event.user.id || undefined };
      }
      return event;
    },
  });

  console.info('[Sentry] Error tracking đã bật.');
  return true;
}

export { Sentry };
