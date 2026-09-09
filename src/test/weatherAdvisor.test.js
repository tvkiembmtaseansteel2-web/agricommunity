import { describe, it, expect } from 'vitest';
import { buildWeatherAdvice } from '../weatherAdvisor';

describe('weatherAdvisor — khuyến nghị hành động', () => {
  it('dữ liệu rỗng → mảng rỗng', () => {
    expect(buildWeatherAdvice(null)).toEqual([]);
  });

  it('gió mạnh → cảnh báo phun thuốc', () => {
    const tips = buildWeatherAdvice({ wind: 25, humidity: 60, temp: 28 });
    const gio = tips.find(t => t.title.includes('phun thuốc'));
    expect(gio).toBeTruthy();
    expect(gio.level).toBe('warn');
  });

  it('ẩm ấm 20-28°C + ẩm>90% → nguy cơ nấm bệnh', () => {
    const tips = buildWeatherAdvice({ temp: 24, humidity: 93, wind: 5 });
    const nam = tips.find(t => t.title.includes('nấm'));
    expect(nam).toBeTruthy();
    expect(nam.level).toBe('risk');
  });

  it('đất khô ≤25% → khuyến nghị tưới', () => {
    const tips = buildWeatherAdvice({ soilMoisturePct: 20, temp: 30, humidity: 50 });
    const tuoi = tips.find(t => t.icon === '💧' && t.title.includes('tưới'));
    expect(tuoi).toBeTruthy();
    const tuoi2 = tips.find(t => t.title.includes('Đất khô'));
    expect(tuoi2).toBeTruthy();
  });

  it('mưa tích lũy ≥30mm → ngưng bón phân hóa học', () => {
    const tips = buildWeatherAdvice({ rainAccum: 35, temp: 25, humidity: 80 });
    const bon = tips.find(t => t.title.includes('bón phân'));
    expect(bon).toBeTruthy();
  });

  it('UV ≥8 → cảnh báo nắng gắt', () => {
    const tips = buildWeatherAdvice({ uv: 9, temp: 34, humidity: 60 });
    const nang = tips.find(t => t.title.includes('UV cao'));
    expect(nang).toBeTruthy();
  });
});
