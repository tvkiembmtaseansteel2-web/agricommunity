// ============================================================================
// weatherAdvisor — biến dữ liệu thời tiết (agri) thành KHUYẾN NGHỊ HÀNH ĐỘNG
// cho nông dân: phun thuốc, bón phân, sương giá, dịch bệnh, tưới nước.
// Tách logic để dễ test & tái sử dụng.
// ============================================================================

// Trả về danh sách khuyến nghị { level, icon, title, text } từ dữ liệu thời tiết.
export function buildWeatherAdvice(weather) {
  if (!weather) return [];
  const tips = [];
  const add = (level, icon, title, text) => tips.push({ level, icon, title, text });

  const { temp, humidity, wind, dewPoint, rain, soilMoisturePct, uv, rainAccum, precipProb } = weather;

  // --- 1) Cảnh báo phun thuốc: gió mạnh → thuốc bay, hao phí, kém hiệu quả ---
  if (wind != null && wind >= 20) {
    add('warn', '💨', 'Gió mạnh — hạn chế phun thuốc',
      `Gió ${wind} km/h. Phun thuốc sẽ bay xa, hao phí và dễ gây dư lượng ngoài vườn. Đợi gió nhẹ (< 10 km/h) để phun.`);
  } else if (wind != null && wind >= 12) {
    add('info', '💨', 'Gió hơi mạnh',
      `Gió ${wind} km/h. Nếu phun thuốc, hạ vòi sát tán cây và tránh trưa nắng.`);
  }

  // --- 2) Cảnh báo sương giá: điểm sương thấp + trời quang (đêm) ---
  if (dewPoint != null && dewPoint <= 15 && uv != null && uv === 0) {
    add('warn', '❄️', 'Nguy cơ sương giá',
      `Điểm sương ${dewPoint}°C, trời quang. Đêm có thể hình thành sương giá gây cháy lá. Che chắn cây con, bạt phủ gốc.`);
  }

  // --- 3) Khuyến nghị bón phân: mưa lớn tích lũy → ngưng bón hóa học tránh rửa trôi ---
  if (rainAccum != null && rainAccum >= 30) {
    add('warn', '🧪', 'Tạm ngưng bón phân hóa học',
      `Mưa tích lũy ${rainAccum}mm trong 24h. Phân dễ bị rửa trôi, lãng phí. Đợi sau mưa, ưu tiên bón hữu cơ/đạm lá nếu cần.`);
  } else if (precipProb != null && precipProb >= 70) {
    add('info', '🌧️', 'Khả năng mưa lớn trong ngày',
      `Xác suất mưa ${precipProb}%. Nếu dự định bón phân, hoãn lại hoặc bón lượng nhỏ để tránh trôi.`);
  }

  // --- 4) Cảnh báo dịch bệnh: ẩm + ấm kéo dài → nấm bệnh bùng phát ---
  if (temp != null && temp >= 20 && temp <= 28 && humidity != null && humidity >= 90) {
    add('risk', '🍄', 'Nguy cơ nấm bệnh cao',
      `Nhiệt độ ${temp}°C + độ ẩm ${humidity}% (ẩm ấm kéo dài). Rất thuận lợi cho nấm (thối rễ, đạo ôn, sương mai). Kiểm tra vườn, thoát nước, phun phòng sinh học.`);
  } else if (humidity != null && humidity >= 85) {
    add('info', '💧', 'Độ ẩm cao',
      `Độ ẩm ${humidity}%. Tránh phun thuốc vào chiều muộn (dễ sương đọng), chú ý sâu bệnh mùa ẩm.`);
  }

  // --- 5) Khuyến nghị tưới nước theo độ ẩm đất ---
  if (soilMoisturePct != null) {
    if (soilMoisturePct <= 25) {
      add('warn', '💧', 'Đất khô — cần tưới',
        `Độ ẩm đất ~${soilMoisturePct}%. Nên tưới (sáng sớm/chiều mát) để cây đủ nước.`);
    } else if (soilMoisturePct >= 80) {
      add('info', '💧', 'Đất ẩm cao',
        `Độ ẩm đất ~${soilMoisturePct}%. Hạn chế tưới thêm, chú ý thoát nước để tránh úng.`);
    }
  }

  // --- 6) Cảnh báo UV cao (nắng gắt) ---
  if (uv != null && uv >= 8) {
    add('warn', '☀️', 'Nắng gắt — tia UV cao',
      `Chỉ số UV ${uv}. Che bớt nắng cho cây con, giữ ẩm gốc, tránh phun thuốc giữa trưa.`);
  } else if (uv != null && uv >= 6) {
    add('info', '☀️', 'Nắng mạnh',
      `Chỉ số UV ${uv}. Chú ý tưới đủ ẩm, che nắng cho cây mới.`);
  }

  return tips;
}
