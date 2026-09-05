import { describe, it, expect } from 'vitest';
import { toCSV, fmtDateCSV, CSV_ACTIVITY, CSV_CROP } from '../csvExport';

describe('csvExport — toCSV', () => {
  it('mảng rỗng → chuỗi rỗng', () => {
    expect(toCSV([])).toBe('');
    expect(toCSV(null)).toBe('');
    expect(toCSV(undefined)).toBe('');
  });

  it('tạo header + dòng đúng', () => {
    const csv = toCSV([{ ngay: '31/08/2026', ho: 'Tưới nước', kg: '2' }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('ngay,ho,kg');
    expect(lines[1]).toBe('31/08/2026,Tưới nước,2');
  });

  it('bọc nháy kép khi giá trị chứa dấu phẩy / nháy kép / xuống dòng', () => {
    const csv = toCSV([{ ghi_chu: 'Bón phân, đợt 2', sp: 'NPK "Đầu Trâu"' }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"Bón phân, đợt 2","NPK ""Đầu Trâu"""');
  });

  it('giá trị null/undefined → ô rỗng', () => {
    const csv = toCSV([{ a: 1, b: null, c: undefined }]);
    expect(csv.split('\n')[1]).toBe('1,,');
  });
});

describe('csvExport — fmtDateCSV', () => {
  it('định dạng YYYY-MM-DD → DD/MM/YYYY', () => {
    expect(fmtDateCSV('2026-08-31')).toBe('31/08/2026');
  });
  it('rỗng/không hợp lệ → rỗng/giữ nguyên', () => {
    expect(fmtDateCSV('')).toBe('');
    expect(fmtDateCSV('khong-hople')).toBe('khong-hople');
  });
});

describe('csvExport — nhãn', () => {
  it('có nhãn tiếng Việt cho hoạt động & cây', () => {
    expect(CSV_ACTIVITY.tuoi_nuoc).toBe('Tưới nước');
    expect(CSV_CROP.sau_rieng).toBe('Sầu riêng');
  });
});
