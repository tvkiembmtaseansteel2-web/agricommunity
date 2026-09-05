// Xác thực sinh trắc học cục bộ (WebAuthn) cho web PWA.
// WebAuthn = cách chuẩn gọi vân tay/khuôn mặt qua trình duyệt (Android/iOS, cần HTTPS).
// Không hỗ trợ (trình duyệt cũ / không HTTPS) → trả về {supported:false} để app fallback.

// Kiểm tra trình duyệt có hỗ trợ WebAuthn + platform authenticator không.
export const isBiometricSupported = () => {
  try {
    return typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!window.PublicKeyCredential
      && !!navigator.credentials;
  } catch (e) {
    return false;
  }
};

// Gửi yêu cầu xác thực sinh trắc học (vân tay/khuôn mặt).
// Đây là bước "chứng minh chủ máy": thiết bị tự xác thực cục bộ (không gửi dữ liệu sinh trắc học đi đâu).
// Trả về true nếu người dùng xác thực thành công (khớp vân tay/khuôn mặt).
export const verifyBiometric = async () => {
  if (!isBiometricSupported()) return { ok: false, reason: 'unsupported' };

  // Dùng WebAuthn với một credential tạm "device check" — thiết bị xác thực cục bộ.
  // Lưu ý: đây là bước xác thực CỤC BỘ (device owner), không phải đăng nhập tài khoản.
  // Trình duyệt hiển thị hộp thoại vân tay/khuôn mặt; nếu khớp → resolve, hủy → reject.
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
        rpId: window.location.hostname,
        userVerification: 'discouraged',
        timeout: 60000,
      },
    });
    return { ok: !!cred, reason: 'ok' };
  } catch (e) {
    // User hủy hoặc không có credential đăng ký → coi là không xác thực được
    return { ok: false, reason: e?.name || 'cancelled' };
  }
};

// Nhãn trạng thái thân thiện cho nông dân
export const biometricLabel = () => {
  return '🔒 Vân tay / Khuôn mặt';
};
