import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  describeWeatherCode,
  coordsFromProfile,
  DEFAULT_COORDS,
  DEFAULT_LABEL,
  WMO_CODES,
  weatherCondition
} from '../weatherService.js';

describe('weatherService — describeWeatherCode', () => {
  it('ánh xạ mã WMO thông dụng', () => {
    expect(describeWeatherCode(0)[0]).toBe('Trời quang');
    expect(describeWeatherCode(61)[1]).toBe('🌦️');
    expect(describeWeatherCode(95)[1]).toBe('⛈️');
  });

  it('mã không xác định → fallback "Thời tiết thay đổi"', () => {
    expect(describeWeatherCode(999)).toEqual(['Thời tiết thay đổi', '🌤️']);
    expect(describeWeatherCode(null)).toEqual(['Thời tiết thay đổi', '🌤️']);
  });

  it('ban ngày (mặc định) giữ icon ngày', () => {
    expect(describeWeatherCode(0, true)[1]).toBe('☀️');
    expect(describeWeatherCode(1, true)[1]).toBe('🌤️');
  });

  it('ban đêm: trời quang/ít mây → 🌙; mưa/dông giữ icon', () => {
    expect(describeWeatherCode(0, false)[1]).toBe('🌙');
    expect(describeWeatherCode(1, false)[1]).toBe('🌙');
    expect(describeWeatherCode(2, false)[1]).toBe('🌥️');
    // mưa & dông vẫn hiển thị rõ ban đêm
    expect(describeWeatherCode(61, false)[1]).toBe('🌦️');
    expect(describeWeatherCode(95, false)[1]).toBe('⛈️');
  });

  it('mô tả giữ nguyên dù ngày/đêm', () => {
    expect(describeWeatherCode(0, false)[0]).toBe('Trời quang');
    expect(describeWeatherCode(3, false)[0]).toBe('Nhiều mây');
  });
});

describe('weatherService — coordsFromProfile', () => {
  it('có tọa độ hợp lệ → nguồn "garden"', () => {
    const r = coordsFromProfile('12.6667', '108.05');
    expect(r.source).toBe('garden');
    expect(r.latitude).toBe(12.6667);
    expect(r.longitude).toBe(108.05);
  });

  it('trống/không hợp lệ → mặc định Đắk Lắk nguồn "default"', () => {
    expect(coordsFromProfile('', '')).toEqual(DEFAULT_COORDS);
    expect(coordsFromProfile('abc', 'xyz').source).toBe('default');
    expect(coordsFromProfile(undefined, null).source).toBe('default');
  });
});

describe('weatherService — DEFAULT', () => {
  it('mặc định là Đắk Lắk (Buôn Ma Thuột)', () => {
    expect(DEFAULT_COORDS.latitude).toBeCloseTo(12.6667);
    expect(DEFAULT_LABEL).toBe('Đắk Lắk');
    expect(WMO_CODES).toBeDefined();
  });
});

describe('weatherService — weatherCondition (icon nhiều lớp)', () => {
  it('trời quang / nắng nhẹ → clear', () => {
    expect(weatherCondition(0)).toBe('clear');
    expect(weatherCondition(1)).toBe('clear');
  });
  it('có mây → partly; nhiều mây → cloudy', () => {
    expect(weatherCondition(2)).toBe('partly');
    expect(weatherCondition(3)).toBe('cloudy');
  });
  it('mưa (phùn/vừa/rào) → rain', () => {
    expect(weatherCondition(51)).toBe('rain');
    expect(weatherCondition(61)).toBe('rain');
    expect(weatherCondition(81)).toBe('rain');
  });
  it('dông → thunder; tuyết → snow; sương mù → fog', () => {
    expect(weatherCondition(95)).toBe('thunder');
    expect(weatherCondition(75)).toBe('snow');
    expect(weatherCondition(45)).toBe('fog');
  });
  it('mã lạ / null → partly (fallback)', () => {
    expect(weatherCondition(999)).toBe('partly');
    expect(weatherCondition(null)).toBe('partly');
  });
});
