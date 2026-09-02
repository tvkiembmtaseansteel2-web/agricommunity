// ============================================================================
// zoneHealth (Phase B) — trạng thái từng Zone theo Zone.md §13–§16.
// Màu KHÔNG lưu cố định: tính từ dữ liệu (Issue chưa xử lý + nhật ký + thời tiết).
// Zone và Crop độc lập (Zone.md §20): một Zone có thể có nhiều loại cây.
// ============================================================================

import { ACTIVITY_LABELS, CROP_LABELS } from './gardenHealth.js';

// Status Issue (Zone.md §12)
export const ISSUE_STATUS_LABELS = {
  NEEDS_REVIEW: 'Cần kiểm tra',
  CONFIRMED: 'Đã xác nhận',
  TREATING: 'Đang xử lý',
  RESOLVED: 'Đã xử lý xong'
};

const isUnresolved = (s) => !!s && s !== 'RESOLVED' && s !== 'resolved';

// Ngưỡng nhắc lịch — dùng chung với gardenHealth để nhất quán
const THRESHOLDS = {
  waterMaxDays: 6,
  waterHotMaxDays: 3,
  sprayWarnDays: 10,
  sprayRiskDays: 14,
  fertWarnDays: 30,
  fertRiskDays: 45
};
const isHumid = (w) => w && (w.rain > 0 || (w.humidity != null && w.humidity >= 85));
const isHot = (w) => w && w.temp != null && w.temp >= 34;

const daysSince = (dateStr, now = Date.now()) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((now - d.getTime()) / 86400000));
};

const finding = (level, icon, text) => ({ level, icon, text });

// Nhật ký áp dụng cho một Zone: scope=GARDEN (hoặc chưa có zone) áp cho toàn vườn;
// scope=ZONES thì chỉ khi zone_ids chứa zone.id.
const logAppliesToZone = (log, zone) => {
  // Khác vườn thì bỏ qua
  if (log.garden_id != null && zone.garden_id != null && log.garden_id !== zone.garden_id) return false;
  const scope = log.scope || 'GARDEN';
  if (scope === 'GARDEN') return true;
  // scope = ZONES
  const ids = log.zone_ids || [];
  return ids.includes(zone.id) || ids.includes(zone.code);
};

// Nhật ký gần nhất của từng loại hoạt động cho một Zone
const lastLogByActivity = (logs, zone) => {
  const result = {};
  const matches = (logs || []).filter((l) => logAppliesToZone(l, zone));
  const sorted = [...matches].sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date)));
  for (const log of sorted) {
    if (!result[log.activity_type]) result[log.activity_type] = log;
  }
  return result;
};

/**
 * Tính trạng thái sức khỏe cho 1 Zone.
 * @param {object} zone - { id, code, name, garden_id, ... }
 * @param {Array} issues - toàn bộ issues của người dùng
 * @param {Array} logs - toàn bộ nhật ký của người dùng
 * @param {object} weather
 * @returns {{ zone, status, statusLabel, dot, findings, summary, unresolvedIssues, lastByActivity }}
 */
export function computeZoneHealth(zone, issues, logs, weather) {
  const lastByActivity = lastLogByActivity(logs, zone);
  const now = Date.now();

  // --- 1) Issue chưa xử lý (mức ưu tiên cao nhất) ---
  const zoneIssues = (issues || []).filter(
    (i) => i.zone_id === zone.id && isUnresolved(i.status)
  );
  const unresolvedIssues = zoneIssues;

  const lastWater = lastByActivity.tuoi_nuoc;
  const lastSpray = lastByActivity.phun_thuoc;
  const lastFert = lastByActivity.bon_phan;
  const daysWater = daysSince(lastWater?.activity_date, now);
  const daysSpray = daysSince(lastSpray?.activity_date, now);
  const daysFert = daysSince(lastFert?.activity_date, now);

  const humid = isHumid(weather);
  const hot = isHot(weather);
  const waterMax = hot ? THRESHOLDS.waterHotMaxDays : THRESHOLDS.waterMaxDays;

  const findings = [];
  let status = 'good';
  const escalate = (worse) => {
    const rank = { good: 0, warn: 1, risk: 2 };
    if (rank[worse] > rank[status]) status = worse;
  };

  // 1) Issue chưa xử lý → cảnh báo (Zone.md §13: "Có vấn đề nghiêm trọng/chưa xử lý" = 🔴)
  if (unresolvedIssues.length > 0) {
    const anyConfirmed = unresolvedIssues.some((i) => i.status === 'CONFIRMED' || i.status === 'TREATING');
    escalate(anyConfirmed ? 'risk' : 'warn');
    const first = unresolvedIssues[0];
    findings.push(finding('risk', '🛑', `${unresolvedIssues.length} vấn đề chưa xử lý: ${first.issue_type || first.description || 'cần kiểm tra'} ${unresolvedIssues.length > 1 ? '(và một số khác)' : ''}.`));
  }

  // 2) Cảnh báo nấm khi trời ẩm + chưa phun phòng gần đây
  if (humid) {
    if (daysSpray === null) {
      escalate('warn');
      findings.push(finding('warn', '🍄', 'Trời ẩm thấp nhưng khu này chưa ghi phun phòng nấm. Nên có biện pháp dự phòng.'));
    } else if (daysSpray >= THRESHOLDS.sprayRiskDays) {
      escalate('risk');
      findings.push(finding('risk', '🍄', `Trời ẩm + đã ${daysSpray} ngày chưa phun phòng nấm → nguy cơ nấm bệnh cao. Kiểm tra ngay.`));
    } else if (daysSpray >= THRESHOLDS.sprayWarnDays) {
      escalate('warn');
      findings.push(finding('warn', '🍄', `Trời ẩm, đã ${daysSpray} ngày chưa phun phòng nấm. Nên phun trong 1-2 ngày tới.`));
    }
  }

  // 3) Nhắc tưới nước
  if (daysWater === null) {
    escalate('warn');
    findings.push(finding('warn', '💧', 'Chưa ghi nhật ký tưới cho khu này.'));
  } else if (daysWater > waterMax + 3) {
    escalate('risk');
    findings.push(finding('risk', '💧', `Đã ${daysWater} ngày chưa tưới khu này${hot ? ' (nắng nóng)' : ''}. Cây dễ khô.`));
  } else if (daysWater > waterMax) {
    escalate('warn');
    findings.push(finding('warn', '💧', `Đã ${daysWater} ngày chưa tưới. Nên tưới sớm.`));
  }

  // 4) Nhắc bón phân
  if (daysFert !== null && daysFert >= THRESHOLDS.fertRiskDays) {
    escalate('warn');
    findings.push(finding('warn', '🌱', `Đã ${daysFert} ngày chưa bón phân cho khu này.`));
  }

  // Nếu không có gì đáng chú ý
  if (findings.length === 0) {
    findings.push(finding('good', '✅', 'Khu này đang ổn định.'));
  }

  let summary;
  if (status === 'risk') summary = 'Khu có vấn đề cần xử lý sớm.';
  else if (status === 'warn') summary = 'Khu cần chú ý — nên chăm sóc trong vài ngày tới.';
  else summary = 'Khu đang bình thường.';

  const statusLabel = status === 'risk' ? 'Có vấn đề' : status === 'warn' ? 'Cần theo dõi' : 'Bình thường';
  const dot = status === 'risk' ? '🔴' : status === 'warn' ? '🟡' : '🟢';

  return {
    zone,
    status,
    statusLabel,
    dot,
    findings,
    summary,
    unresolvedIssues,
    lastByActivity,
    code: zone.code,
    name: zone.name || zone.code
  };
}

/**
 * Tính trạng thái cho toàn bộ zones của một vườn (hoặc tất cả zones).
 * Sắp theo mức nghiêm trọng (risk → warn → good).
 */
export function computeAllZonesHealth(zones, issues, logs, weather) {
  const results = (zones || []).map((z) => computeZoneHealth(z, issues, logs, weather));
  const rank = { risk: 0, warn: 1, good: 2 };
  return results.sort((a, b) => rank[a.status] - rank[b.status]);
}
