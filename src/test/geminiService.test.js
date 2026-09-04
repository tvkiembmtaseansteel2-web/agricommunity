import { describe, it, expect, vi, beforeAll } from 'vitest';

let analyzeCropDisease;

beforeAll(async () => {
  // Ép chế độ offline: không có API key (không gọi Gemini thật trong test)
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
  vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-2.5-flash');
  const mod = await import('../geminiService.js');
  analyzeCropDisease = mod.analyzeCropDisease;
});

describe('analyzeCropDisease — chế độ offline (mock)', () => {
  it('chẩn đoán sầu riêng xì mủ thối gốc', async () => {
    const result = await analyzeCropDisease('Sầu riêng của tôi bị xì mủ thối gốc');
    expect(result.diagnosis.toLowerCase()).toContain('phytophthora');
    expect(Array.isArray(result.protocol)).toBe(true);
    expect(result.protocol.length).toBeGreaterThan(0);
    expect(typeof result.export_warning).toBe('string');
  }, 10000);

  it('chẩn đoán cà phê rỉ sắt', async () => {
    const result = await analyzeCropDisease('Cà phê bị bệnh rỉ sắt hại lá');
    expect(result.diagnosis.toLowerCase()).toContain('rỉ sắt');
    expect(result.export_warning.length).toBeGreaterThan(10);
  }, 10000);

  it('cảnh báo hoạt chất cấm trong kết quả sầu riêng', async () => {
    const result = await analyzeCropDisease('Sầu riêng bị xì mủ');
    expect(result.export_warning.toLowerCase()).toContain('chlorpyrifos');
  }, 10000);

  it('không lỗi khi không nhận diện được cây', async () => {
    const result = await analyzeCropDisease('cây nhà tôi bị héo');
    expect(result.diagnosis).toBeTruthy();
  }, 10000);
});

describe('formatGardenLogs — đưa nhật ký vườn vào prompt', () => {
  let formatGardenLogs;
  beforeAll(async () => {
    // Vẫn dùng cùng module; import thêm hàm này
    const mod = await import('../geminiService.js');
    formatGardenLogs = mod.formatGardenLogs;
  });

  it('logs rỗng → chuỗi rỗng', () => {
    expect(formatGardenLogs([])).toBe('');
    expect(formatGardenLogs(null)).toBe('');
    expect(formatGardenLogs(undefined)).toBe('');
  });

  it('logs hợp lệ → chuỗi có ngày + hoạt động + sản phẩm', () => {
    const logs = [
      { activity_date: '2026-08-20', activity_type: 'phun_thuoc', crop_type: 'sau_rieng', product_name: 'Thuốc nấm A', dosage: '20ml', notes: 'bị mưa sau 3 giờ' },
      { activity_date: '2026-08-21', activity_type: 'bon_phan', crop_type: 'sau_rieng', product_name: 'NPK', dosage: '1kg' }
    ];
    const out = formatGardenLogs(logs);
    expect(out).toContain('2026-08-20');
    expect(out).toContain('Phun thuốc');
    expect(out).toContain('Thuốc nấm A');
    expect(out).toContain('bị mưa sau 3 giờ');
  });

  it('kèm số ngày trôi qua (X ngày trước / hôm nay) để AI ước lượng mốc thời gian', () => {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logs = [
      { activity_date: fmt(today), activity_type: 'tuoi_nuoc', crop_type: 'cafe' }, // hôm nay
      { activity_date: '2026-01-01', activity_type: 'phun_thuoc', crop_type: 'cafe' } // rất cũ
    ];
    const out = formatGardenLogs(logs);
    expect(out).toContain('(hôm nay)');
    expect(out).toMatch(/\(\d+ ngày trước\)/); // ít nhất một mục có "X ngày trước"
  });

  it('sắp xếp theo ngày giảm dần & giới hạn 8 bản ghi', () => {
    const logs = Array.from({ length: 12 }, (_, i) => ({ activity_date: `2026-01-${String(i + 1).padStart(2, '0')}`, activity_type: 'tuoi_nuoc', crop_type: 'cafe' }));
    const out = formatGardenLogs(logs);
    const lines = out.split('\n');
    expect(lines.length).toBe(8);
    // bản ghi mới nhất (2026-01-12) đứng đầu
    expect(lines[0]).toContain('2026-01-12');
  });
});
