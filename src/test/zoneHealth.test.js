import { describe, it, expect } from 'vitest';
import { computeZoneHealth, computeAllZonesHealth, ISSUE_STATUS_LABELS } from '../zoneHealth.js';

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

const zone = { id: 1, code: 'A', name: 'Khu A', garden_id: 10 };

const mkLog = (activity, days, extra = {}) => ({
  id: `${activity}-${days}`,
  garden_id: 10,
  activity_type: activity,
  activity_date: daysAgo(days),
  scope: 'GARDEN',
  zone_ids: [],
  ...extra
});

const mkIssue = (status, extra = {}) => ({
  id: 100 + Math.random(),
  garden_id: 10,
  zone_id: 1,
  issue_type: 'Bệnh/nấm lá',
  confidence: 'trung_binh',
  status,
  ...extra
});

describe('zoneHealth — computeZoneHealth', () => {
  it('không có issue, nhật ký gần đây, thời tiết khô → Bình thường 🟢', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 5), mkLog('bon_phan', 10)];
    const r = computeZoneHealth(zone, [], logs, { temp: 28, humidity: 60, rain: 0 });
    expect(r.status).toBe('good');
    expect(r.dot).toBe('🟢');
  });

  it('issue chưa xử lý (NEEDS_REVIEW) → Cần theo dõi 🟡 hoặc Có vấn đề 🔴', () => {
    const r = computeZoneHealth(zone, [mkIssue('NEEDS_REVIEW')], [], { temp: 28, humidity: 60, rain: 0 });
    expect(['risk', 'warn']).toContain(r.status);
    expect(r.unresolvedIssues.length).toBe(1);
    const hasIssueFinding = r.findings.some((f) => /vấn đề chưa xử lý/i.test(f.text));
    expect(hasIssueFinding).toBe(true);
  });

  it('issue CONFIRMED → mức cao nhất 🔴 (Có vấn đề)', () => {
    const r = computeZoneHealth(zone, [mkIssue('CONFIRMED')], [], { temp: 28, humidity: 60, rain: 0 });
    expect(r.status).toBe('risk');
    expect(r.statusLabel).toBe('Có vấn đề');
  });

  it('issue RESOLVED không tính là chưa xử lý → bình thường', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 5), mkLog('bon_phan', 10)];
    const r = computeZoneHealth(zone, [mkIssue('RESOLVED')], logs, { temp: 28, humidity: 60, rain: 0 });
    expect(r.unresolvedIssues.length).toBe(0);
    expect(r.status).toBe('good');
  });

  it('trời ẩm + lâu ngày chưa phun → cảnh báo nấm', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 20)];
    const r = computeZoneHealth(zone, [], logs, { temp: 26, humidity: 92, rain: 3 });
    expect(r.status).toBe('risk');
    const nấm = r.findings.some((f) => f.icon === '🍄' && f.level === 'risk');
    expect(nấm).toBe(true);
  });

  it('log scope=ZONES chỉ áp dụng khi zone_ids chứa zone', () => {
    // log áp cho zone 1, không áp cho zone 2
    const z2 = { id: 2, code: 'B', name: 'Khu B', garden_id: 10 };
    const logs = [mkLog('tuoi_nuoc', 1, { scope: 'ZONES', zone_ids: [1] })];
    const r2 = computeZoneHealth(z2, [], logs, { temp: 28, humidity: 60, rain: 0 });
    // Khu B không có nhật ký tưới → warn (chưa ghi)
    expect(r2.status).toBe('warn');
    const water = r2.findings.some((f) => f.icon === '💧' && /chưa ghi nhật ký tưới/i.test(f.text));
    expect(water).toBe(true);
  });

  it('không có nhật ký tưới → nhắc (warn)', () => {
    const r = computeZoneHealth(zone, [], [], { temp: 28, humidity: 60, rain: 0 });
    expect(r.status).toBe('warn');
  });
});

describe('zoneHealth — computeAllZonesHealth', () => {
  it('sắp xếp risk trước, good sau', () => {
    const zones = [
      { id: 1, code: 'A', garden_id: 10 },  // có issue → risk/warn
      { id: 2, code: 'B', garden_id: 10 }   // ổn
    ];
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 5), mkLog('bon_phan', 10)];
    const results = computeAllZonesHealth(zones, [mkIssue('CONFIRMED')], logs, { temp: 28, humidity: 60, rain: 0 });
    expect(results.length).toBe(2);
    expect(results[0].zone.id).toBe(1); // có issue → đứng trước
  });
});

describe('zoneHealth — ISSUE_STATUS_LABELS', () => {
  it('có nhãn tiếng Việt cho các trạng thái', () => {
    expect(ISSUE_STATUS_LABELS.NEEDS_REVIEW).toBe('Cần kiểm tra');
    expect(ISSUE_STATUS_LABELS.RESOLVED).toBe('Đã xử lý xong');
  });
});
