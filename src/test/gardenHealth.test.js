import { describe, it, expect } from 'vitest';
import { computeGardenHealth, computeAllGardensHealth, computeTodayTasks, ACTIVITY_LABELS } from '../gardenHealth.js';

// Helper: tạo ngày cách đây N ngày → chuỗi YYYY-MM-DD
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().split('T')[0];
};

const garden = {
  id: 1,
  name: 'Vườn sầu riêng A',
  crop_type: 'sau_rieng',
  area_m2: 12000,
  plant_count: 320,
  plant_age_years: 6
};

const mkLog = (activity_type, days, extra = {}) => ({
  id: `${activity_type}-${days}`,
  garden_id: 1,
  crop_type: 'sau_rieng',
  activity_type,
  activity_date: daysAgo(days),
  ...extra
});

describe('gardenHealth — computeGardenHealth (Hiểu vườn P0)', () => {
  it('vườn có nhật ký gần đây + thời tiết khô → Ổn định (good)', () => {
    const logs = [
      mkLog('tuoi_nuoc', 2),
      mkLog('bon_phan', 10),
      mkLog('phun_thuoc', 5)
    ];
    const weather = { temp: 28, humidity: 60, rain: 0, wind: 10 };
    const r = computeGardenHealth(garden, logs, weather);
    expect(r.status).toBe('good');
    expect(r.statusLabel).toBe('Ổn định');
    expect(r.dot).toBe('🟢');
  });

  it('trời ẩm + lâu ngày chưa phun phòng → Cần xử lý (risk) và có cảnh báo nấm', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 20)];
    const weather = { temp: 26, humidity: 92, rain: 3, wind: 8 };
    const r = computeGardenHealth(garden, logs, weather);
    expect(r.status).toBe('risk');
    const nấm = r.findings.some((f) => f.level === 'risk' && f.icon === '🍄');
    expect(nấm).toBe(true);
  });

  it('trời ẩm nhưng vừa phun phòng gần đây → không có cảnh báo risk nấm', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 5)];
    const weather = { temp: 26, humidity: 90, rain: 2, wind: 8 };
    const r = computeGardenHealth(garden, logs, weather);
    const nấmRisk = r.findings.some((f) => f.level === 'risk' && f.icon === '🍄');
    expect(nấmRisk).toBe(false);
  });

  it('lâu ngày chưa tưới + nắng nóng → nâng mức cảnh báo (risk hoặc warn)', () => {
    const logs = [mkLog('tuoi_nuoc', 15)];
    const weather = { temp: 36, humidity: 50, rain: 0, wind: 12 };
    const r = computeGardenHealth(garden, logs, weather);
    expect(['risk', 'warn']).toContain(r.status);
    const nước = r.findings.some((f) => f.icon === '💧' && /đã 15 ngày chưa tưới/i.test(f.text));
    expect(nước).toBe(true);
  });

  it('chưa có nhật ký tưới → không thể ước lượng nước (warn)', () => {
    const r = computeGardenHealth(garden, [], { temp: 28, humidity: 60, rain: 0 });
    expect(r.status).toBe('warn');
    const nước = r.findings.some((f) => f.icon === '💧' && /chưa ghi nhật ký tưới/i.test(f.text));
    expect(nước).toBe(true);
  });

  it('nhật ký cũ không gắn garden_id nhưng đúng crop_type vẫn được tính', () => {
    const logs = [mkLog('tuoi_nuoc', 1, { garden_id: null }), mkLog('bon_phan', 10, { garden_id: null })];
    const r = computeGardenHealth(garden, logs, { temp: 28, humidity: 60, rain: 0 });
    expect(r.status).toBe('good');
  });
});

describe('gardenHealth — computeAllGardensHealth', () => {
  it('sắp xếp vườn theo mức nghiêm trọng (risk trước, good sau)', () => {
    const logs = [
      mkLog('tuoi_nuoc', 1),
      mkLog('phun_thuoc', 2),
      mkLog('bon_phan', 10)
    ];
    const weather = { temp: 28, humidity: 60, rain: 0 };
    const goodGarden = { id: 1, name: 'Tốt', crop_type: 'sau_rieng' };
    const riskGarden = { id: 2, name: 'Xấu', crop_type: 'cafe' };

    const results = computeAllGardensHealth([goodGarden, riskGarden], logs, weather);
    expect(results.length).toBe(2);
    expect(results[0].garden.id).toBe(2); // vườn không có nhật ký → warn/risk đứng trước
  });
});

describe('gardenHealth — nhãn hoạt động', () => {
  it('có nhãn cho tất cả hoạt động đang dùng', () => {
    expect(ACTIVITY_LABELS.tuoi_nuoc).toBe('Tưới nước');
    expect(ACTIVITY_LABELS.phun_thuoc).toBe('Phun thuốc');
    expect(ACTIVITY_LABELS.bon_phan).toBe('Bón phân');
  });
});

describe('gardenHealth — computeTodayTasks (việc cần làm)', () => {
  it('bỏ các ghi chú "good", chỉ lấy cảnh báo (warn/risk)', () => {
    const logs = [mkLog('tuoi_nuoc', 15)]; // lâu ngày chưa tưới → risk
    const h = computeGardenHealth(garden, logs, { temp: 28, humidity: 60, rain: 0 });
    const tasks = computeTodayTasks(h);
    expect(tasks.length).toBeGreaterThan(0);
    // mọi task đều không phải 'good' (tức là có icon cảnh báo)
    tasks.forEach(t => expect(['water', 'fert', 'spray', 'issue', 'todo']).toContain(t.type));
    // task tưới ưu tiên
    const water = tasks.find(t => t.type === 'water');
    expect(water).toBeTruthy();
    expect(water.priority).toBe('cao'); // risk → ưu tiên cao
  });

  it('vườn ổn định → danh sách task rỗng', () => {
    const logs = [mkLog('tuoi_nuoc', 1), mkLog('phun_thuoc', 5), mkLog('bon_phan', 10)];
    const h = computeGardenHealth(garden, logs, { temp: 28, humidity: 60, rain: 0 });
    expect(computeTodayTasks(h)).toEqual([]);
  });

  it('task risk xếp trước task warn', () => {
    const logs = [mkLog('tuoi_nuoc', 20), mkLog('phun_thuoc', 20)]; // cả 2 đều risk (ẩm)
    const h = computeGardenHealth(garden, logs, { temp: 26, humidity: 92, rain: 3 });
    const tasks = computeTodayTasks(h);
    // task đầu tiên có priority cao nhất
    expect(tasks[0].priority).toBe('cao');
  });
});
