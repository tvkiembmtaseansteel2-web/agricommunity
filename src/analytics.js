// Analytics nhẹ, tôn trọng quyền riêng tư (Nghị định 13/2023/NĐ-CP):
// - KHÔNG theo dõi theo cá nhân, KHÔNG dùng cookie
// - Chỉ đếm lượt xem trang ẩn danh (Plausible — privacy-first, không cần đồng ý cookie theo GDPR/ePrivacy)
// - Tùy chọn: chỉ kích hoạt khi có VITE_ANALYTICS_DOMAIN trong .env; mặc định TẮT

const DOMAIN = import.meta.env?.VITE_ANALYTICS_DOMAIN;
const SCRIPT_URL = 'https://plausible.io/js/script.js';

let initialized = false;

export const initAnalytics = () => {
  if (!DOMAIN || initialized) return;
  try {
    const script = document.createElement('script');
    script.defer = true;
    script.dataset.domain = DOMAIN;
    script.src = SCRIPT_URL;
    document.head.appendChild(script);
    initialized = true;
    console.log('Analytics ẩn danh đã bật cho:', DOMAIN);
  } catch (e) {
    console.warn('Không khởi tạo được analytics:', e);
  }
};

// Ghi sự kiện tùy chọn (ẩn danh) — ví dụ: đếm số lần dùng MRL Advisor
export const trackEvent = (name) => {
  if (!DOMAIN) return;
  try {
    // Plausible goal: cần cấu hình goal trong dashboard
    if (window.plausible) window.plausible(name);
  } catch (e) {
    // im lặng — analytics không bao giờ chặn trải nghiệm
  }
};
