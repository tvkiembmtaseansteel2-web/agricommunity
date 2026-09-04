// ============================================================================
// Hiểu vườn (P0) — logic sức khỏe vườn theo dữ liệu thời tiết + nhật ký.
// Tách logic ra module riêng để dễ kiểm thử (Vitest) và tái sử dụng.
// ============================================================================

// Nhãn hiển thị hoạt động chăm sóc
export const ACTIVITY_LABELS = {
  tuoi_nuoc: 'Tưới nước',
  bon_phan: 'Bón phân',
  phun_thuoc: 'Phun thuốc',
  cat_tia: 'Cắt tỉa cành',
  khac: 'Công việc khác'
};

// Nhãn cây trồng
export const CROP_LABELS = {
  sau_rieng: 'Sầu riêng',
  cafe: 'Cà phê',
  ho_tieu: 'Hồ tiêu'
};

// Ngưỡng nhắc lịch (ngày). Có thể tinh chỉnh theo vùng/cây trồng sau này.
const THRESHOLDS = {
  // Tưới nước: mùa nắng nóng (>=34°C) cần dày hơn; mưa to thì không cần tưới
  waterMaxDays: 6,          // quá 6 ngày chưa tưới = đáng chú ý (🟡)
  waterHotMaxDays: 3,       // nắng nóng: quá 3 ngày chưa tưới = đáng chú ý
  // Phun thuốc phòng trừ: khi trời ẩm/mưa, phòng nấm mỗi 7-10 ngày
  sprayWarnDays: 10,        // quá 10 ngày chưa phun (khi ẩm) = nguy cơ (🟡)
  sprayRiskDays: 14,        // quá 14 ngày chưa phun (khi ẩm) = nguy cơ cao (🔴)
  // Bón phân: định kỳ ~30 ngày
  fertWarnDays: 30,         // quá 30 ngày chưa bón = nhắc (🟡)
  fertRiskDays: 45          // quá 45 ngày chưa bón = đáng chú ý hơn (🟡)
};

// Điều kiện thời tiết gây "ẩm thấp" → tăng nguy cơ nấm bệnh
const isHumid = (weather) =>
  weather && (weather.rain > 0 || (weather.humidity != null && weather.humidity >= 85));

const isHot = (weather) => weather && weather.temp != null && weather.temp >= 34;

// Số ngày trôi qua (lag) kể từ một ngày, trả về số nguyên >= 0.
// Chuẩn hoá về "đầu ngày" theo giờ địa phương để tránh lệch ±1 ngày
// (VD: nhật ký tưới ngày 13/8, hôm nay 02/09 → đủ 20 ngày, không phụ thuộc giờ nhập).
const daysSince = (dateStr, now = Date.now()) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const startOfLogDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); // đầu ngày địa phương
  const startOfToday = new Date(
    new Date(now).getFullYear(),
    new Date(now).getMonth(),
    new Date(now).getDate()
  ).getTime();
  const diff = (startOfToday - startOfLogDay) / 86400000;
  return Math.max(0, Math.round(diff));
};

// Lấy nhật ký gần nhất của 1 vườn theo loại hoạt động.
// Ưu tiên theo garden_id, fallback theo crop_type cho các bản ghi cũ chưa gắn vườn.
const lastLogByActivity = (logs, garden) => {
  const result = {};
  const matches = (logs || []).filter((l) => {
    if (l.garden_id === garden.id) return true;
    if (l.garden_id == null && l.crop_type === garden.crop_type) return true;
    return false;
  });
  // Nhật ký đã được sắp theo activity_date giảm dần, nhưng vẫn sort lại cho chắc
  const sorted = [...matches].sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date)));
  for (const log of sorted) {
    if (!result[log.activity_type]) result[log.activity_type] = log;
  }
  return result;
};

// Tạo một "finding" (gợi ý/cảnh báo) để hiển thị dưới mỗi vườn
const finding = (level, icon, text) => ({ level, icon, text });

// Định dạng ngày "YYYY-MM-DD" → "DD/MM" cho dễ đọc
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Tính trạng thái sức khỏe cho 1 vườn.
 * @returns {{
 *   status: 'good'|'warn'|'risk',
 *   statusLabel: string,
 *   dot: string,
 *   lastByActivity: object,
 *   findings: Array<{level,icon,text}>,
 *   summary: string
 * }}
 */
export function computeGardenHealth(garden, logs, weather) {
  const lastByActivity = lastLogByActivity(logs, garden);
  const now = Date.now();

  const lastWater = lastByActivity.tuoi_nuoc;
  const lastSpray = lastByActivity.phun_thuoc;
  const lastFert = lastByActivity.bon_phan;

  const daysWater = daysSince(lastWater?.activity_date, now);
  const daysSpray = daysSince(lastSpray?.activity_date, now);
  const daysFert = daysSince(lastFert?.activity_date, now);

  const humid = isHumid(weather);
  const hot = isHot(weather);

  const findings = [];
  let status = 'good'; // mặc định tốt

  const escalate = (worse) => {
    const rank = { good: 0, warn: 1, risk: 2 };
    if (rank[worse] > rank[status]) status = worse;
  };

  const waterMax = hot ? THRESHOLDS.waterHotMaxDays : THRESHOLDS.waterMaxDays;

  // 1) Cảnh báo sâu bệnh / nấm (độ ẩm cao + chưa phun phòng gần đây)
  if (humid) {
    if (daysSpray === null) {
      escalate('warn');
      findings.push(finding('warn', '🍄', 'Trời ẩm thấp nhưng vườn chưa ghi phun phòng nấm nào. Nên có biện pháp dự phòng.'));
    } else if (daysSpray >= THRESHOLDS.sprayRiskDays) {
      escalate('risk');
      findings.push(finding('risk', '🍄', `Trời ẩm thấp + đã ${daysSpray} ngày chưa phun phòng nấm → nguy cơ nấm bệnh (thán thư, mốc) cao. Kiểm tra ngay.`));
    } else if (daysSpray >= THRESHOLDS.sprayWarnDays) {
      escalate('warn');
      findings.push(finding('warn', '🍄', `Trời ẩm thấp, đã ${daysSpray} ngày chưa phun phòng nấm. Nên phun trong 1-2 ngày tới.`));
    } else {
      const when = daysSpray === 0 ? 'hôm nay' : `${daysSpray} ngày trước (${fmtDate(lastSpray.activity_date)})`;
      findings.push(finding('good', '✅', `Vừa phun phòng ${when}, phù hợp khi trời ẩm.`));
    }
  }

  // 2) Nhắc tưới nước
  if (daysWater === null) {
    escalate('warn');
    findings.push(finding('warn', '💧', 'Chưa ghi nhật ký tưới nước. Không thể ước lượng nhu cầu nước — hãy ghi lại lần tưới.'));
  } else if (daysWater > waterMax + 3) {
    escalate('risk');
    findings.push(finding('risk', '💧', `Đã ${daysWater} ngày chưa tưới nước${hot ? ' (trời đang nắng nóng)' : ''}. Cây dễ bị khô/thiếu nước (lần cuối ${fmtDate(lastWater.activity_date)}).`));
  } else if (daysWater > waterMax) {
    escalate('warn');
    findings.push(finding('warn', '💧', `Đã ${daysWater} ngày chưa tưới nước (lần cuối ${fmtDate(lastWater.activity_date)}). Nên tưới sớm (sáng sớm/chiều mát).`));
  } else {
    const when = daysWater === 0 ? 'hôm nay' : `${daysWater} ngày trước`;
    findings.push(finding('good', '💧', `${when === 'hôm nay' ? 'Đã tưới nước hôm nay' : `Tưới nước ${when}`}, ổn.`));
  }

  // 3) Nhắc bón phân
  if (daysFert === null) {
    if (garden.plant_age_years) {
      escalate('warn');
      findings.push(finding('warn', '🌱', 'Chưa ghi bón phân cho vườn. Cân nhắc bón theo giai đoạn sinh trưởng.'));
    }
  } else if (daysFert >= THRESHOLDS.fertRiskDays) {
    escalate('warn');
    findings.push(finding('warn', '🌱', `Đã ${daysFert} ngày chưa bón phân (lần cuối ${fmtDate(lastFert.activity_date)}). Nên lên lịch bón và điều chỉnh liều theo nhu cầu cây.`));
  } else if (daysFert >= THRESHOLDS.fertWarnDays) {
    findings.push(finding('good', '🌱', `Bón phân ${daysFert} ngày trước (${fmtDate(lastFert.activity_date)}). Gần đến chu kỳ bón tiếp theo.`));
  }

  // Tổng hợp summary ngắn gọn
  let summary;
  if (status === 'risk') {
    summary = 'Vườn cần được kiểm tra & xử lý sớm.';
  } else if (status === 'warn') {
    summary = 'Có vài điểm cần chú ý — nên chăm sóc trong vài ngày tới.';
  } else {
    summary = 'Vườn đang ổn định, duy trì chăm sóc.';
  }

  const statusLabel = status === 'risk' ? 'Cần xử lý' : status === 'warn' ? 'Cần chú ý' : 'Ổn định';
  const dot = status === 'risk' ? '🔴' : status === 'warn' ? '🟡' : '🟢';

  return {
    garden,
    status,
    statusLabel,
    dot,
    lastByActivity,
    findings,
    summary,
    cropLabel: CROP_LABELS[garden.crop_type] || garden.crop_type
  };
}

/**
 * Tính cho toàn bộ danh sách vườn. Trả về mảng kết quả, sắp theo mức độ nghiêm trọng.
 */
export function computeAllGardensHealth(gardens, logs, weather) {
  const results = (gardens || []).map((g) => computeGardenHealth(g, logs, weather));
  const rank = { risk: 0, warn: 1, good: 2 };
  return results.sort((a, b) => rank[a.status] - rank[b.status]);
}
