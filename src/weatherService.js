// ============================================================================
// Dịch vụ thời tiết (Open-Meteo) + định vị vị trí nông dân.
// Tách logic khỏi UI để dễ kiểm thử (Vitest) và tái sử dụng.
// ============================================================================

// Tọa độ mặc định: Đắk Lắk (TP. Buôn Ma Thuột) — vùng trồng cà phê/sầu riêng/hồ tiêu chính
export const DEFAULT_COORDS = { latitude: 12.6667, longitude: 108.05, source: 'default' };
export const DEFAULT_LABEL = 'Đắk Lắk';

// Mã thời tiết WMO → [mô tả, icon]
export const WMO_CODES = {
  0: ['Trời quang', '☀️'], 1: ['Nắng nhẹ', '🌤️'], 2: ['Có mây', '⛅'],
  3: ['Nhiều mây', '☁️'], 45: ['Có sương mù', '🌫️'], 48: ['Sương muối', '🌫️'],
  51: ['Mưa phùn nhẹ', '🌦️'], 53: ['Mưa phùn', '🌦️'], 55: ['Mưa phùn nặng', '🌧️'],
  61: ['Mưa nhẹ', '🌦️'], 63: ['Mưa vừa', '🌧️'], 65: ['Mưa to', '🌧️'],
  66: ['Mưa đá nhẹ', '🌧️'], 67: ['Mưa đá', '⛈️'], 71: ['Tuyết nhẹ', '🌨️'],
  75: ['Tuyết', '🌨️'], 77: ['Tuyết rơi', '🌨️'], 80: ['Mưa rào nhẹ', '🌦️'],
  81: ['Mưa rào', '🌧️'], 82: ['Mưa rào mạnh', '⛈️'], 85: ['Mưa tuyết nhẹ', '🌨️'],
  86: ['Mưa tuyết', '🌨️'], 95: ['Dông', '⛈️'], 96: ['Dông kèm mưa đá', '⛈️'],
  99: ['Dông mạnh', '⛈️']
};

// Phân loại điều kiện thời tiết từ mã WMO → dùng để dựng icon nhiều lớp (chi tiết hơn).
export const weatherCondition = (code) => {
  if (code == null) return 'partly';
  // Trời quang / nắng nhẹ / ít mây
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';          // có mây
  if (code === 3) return 'cloudy';           // nhiều mây
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  // mã không xác định trong WMO → mặc định có mây (an toàn)
  return 'partly';
};

// Mô tả + icon từ mã WMO, có phân biệt ngày/đêm (isDay).
// Đêm: trời quang → 🌙, ít mây → 🌥️, giữ nguyên icon cho mưa/dông/sương mù.
const nightIconFor = (code) => {
  if (code === 0 || code === 1) return '🌙';   // quang / nắng nhẹ
  if (code === 2) return '🌥️';                  // có mây
  // các loại còn lại giữ icon ngày (mưa/dông/sương mù/mưa đá vẫn hiển thị rõ ban đêm)
  return null;
};

export const describeWeatherCode = (code, isDay = true) => {
  const [desc, dayIcon] = WMO_CODES[code] || ['Thời tiết thay đổi', '🌤️'];
  if (!isDay) {
    const nightIcon = nightIconFor(code);
    if (nightIcon) return [desc, nightIcon];
  }
  return [desc, dayIcon];
};

// Chọn tọa độ theo thứ tự ưu tiên: vườn (profile) có tọa độ → mặc định Đắk Lắk.
// Được dùng khi GPS thất bại / bị từ chối.
export const coordsFromProfile = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    return { latitude: lat, longitude: lng, source: 'garden' };
  }
  return { ...DEFAULT_COORDS };
};

/**
 * Gọi Open-Meteo (không cần API key) để lấy thời tiết hiện tại tại một tọa độ.
 * Trả về object chuẩn: { temp, humidity, wind, rain, desc, icon, updatedAt }.
 */
export async function fetchWeatherData(latitude, longitude) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code,is_day` +
      `&timezone=Asia%2FHo_Chi_Minh`
  );
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  const c = data?.current;
  if (!c) return null;
  const isDay = c.is_day === 1;
  const [desc, icon] = describeWeatherCode(c.weather_code, isDay);
  return {
    temp: Math.round(c.temperature_2m),
    humidity: Math.round(c.relative_humidity_2m),
    wind: Math.round(c.wind_speed_10m),
    rain: c.precipitation || 0,
    desc,
    icon,
    isDay,
    code: c.weather_code, // mã WMO, dùng để dựng icon SVG nhiều lớp
    // Đối chiếu cũng ghi nhận đây là "hiện tại" của Open-Meteo (cập nhật ~15 phút)
    updatedAt: new Date().toISOString()
  };
}

/**
 * Đảo ngược địa chỉ (reverse geocoding) qua Nominatim/OpenStreetMap — miễn phí, không key.
 * Trả về tên khu vực ngắn gọn (VD: "Krông Pắk, Đắk Lắk") hoặc null nếu thất bại (không block).
 */
export async function reverseGeocode(latitude, longitude, signal) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}` +
      `&zoom=12&accept-language=vi`;
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const d = await res.json();
    const a = d?.address || {};
    const district = a.district || a.county || a.municipality || a.state_district || a.city || a.town || a.village;
    const province = a.state || a.province || a.region || a.territory;
    const parts = [district, province].filter(Boolean);
    return parts.length ? parts.join(', ') : (d?.name || null);
  } catch (e) {
    return null; // thất bại không được làm hỏng luồng thời tiết
  }
}

/**
 * Định vị vị trí hiện tại của nông dân qua trình duyệt (GPS).
 * Trả về { latitude, longitude } hoặc throw (theo mã lỗi / code).
 * @param {number} timeoutMs - thời gian chờ tối đa (ms)
 */
export function getCurrentPosition(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 600000 }
    );
  });
}
