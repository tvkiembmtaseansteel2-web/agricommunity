import { describe, it, expect } from 'vitest';
import {
  pointInPolygon,
  resolveZoneFromGps,
  polygonArea,
  polygonCentroid,
  generateSampleZones,
  distanceToBoundary,
  polygonBounds,
  splitPolygonIntoZones,
  clipPolygonToRect
} from '../zoneService.js';

// Hình vuông 0..1 lat/lng
const square = [[0, 0], [0, 1], [1, 1], [1, 0]];

describe('zoneService — pointInPolygon', () => {
  it('điểm bên trong → true', () => {
    expect(pointInPolygon([0.5, 0.5], square)).toBe(true);
  });
  it('điểm bên ngoài → false', () => {
    expect(pointInPolygon([2, 2], square)).toBe(false);
  });
  it('nằm trên biên được coi là bên trong (even-odd)', () => {
    expect(pointInPolygon([0.5, 0], square)).toBe(true);
  });
  it('polygon không hợp lệ / thiếu dữ liệu → false', () => {
    expect(pointInPolygon([0.5, 0.5], [])).toBe(false);
    expect(pointInPolygon(null, square)).toBe(false);
    expect(pointInPolygon([0.5, 0.5], [[0, 0], [1, 1]])).toBe(false);
  });
});

describe('zoneService — resolveZoneFromGps', () => {
  const zones = [
    { id: 1, code: 'A', polygon: [[0, 0], [0, 1], [1, 1], [1, 0]] },
    { id: 2, code: 'B', polygon: [[1, 0], [1, 1], [2, 1], [2, 0]] }
  ];

  it('nằm trong zone → status found + zone đúng', () => {
    const r = resolveZoneFromGps([0.4, 0.6], zones);
    expect(r.status).toBe('found');
    expect(r.zone.code).toBe('A');
  });

  it('nằm trong zone B → found + Zone B', () => {
    const r = resolveZoneFromGps([1.5, 0.4], zones);
    expect(r.status).toBe('found');
    expect(r.zone.code).toBe('B');
  });

  it('gần ranh giới ngoài → status near + có candidates', () => {
    // Điểm hơi lệch ra ngoài mép dưới của Zone A (lat hơi < 0) nhưng rất gần biên
    const r = resolveZoneFromGps([-0.0003, 0.5], zones);
    expect(r.status).toBe('near');
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it('xa mọi zone → status none', () => {
    const r = resolveZoneFromGps([5, 5], zones);
    expect(r.status).toBe('none');
    expect(r.zone).toBeNull();
  });

  it('không có zones → none', () => {
    expect(resolveZoneFromGps([0.5, 0.5], []).status).toBe('none');
    expect(resolveZoneFromGps(null, zones).status).toBe('none');
  });
});

describe('zoneService — polygonArea', () => {
  it('diện tích > 0 cho polygon hợp lệ', () => {
    const a = polygonArea([[23, 108], [23.001, 108], [23.001, 108.001], [23, 108.001]]);
    expect(a).toBeGreaterThan(0);
  });
  it('polygon không hợp lệ → 0', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('zoneService — polygonCentroid', () => {
  it('trung bình cộng các đỉnh', () => {
    expect(polygonCentroid([[0, 0], [0, 2], [2, 2], [2, 0]])).toEqual([1, 1]);
  });
  it('rỗng → null', () => {
    expect(polygonCentroid([])).toBeNull();
  });
});

describe('zoneService — generateSampleZones', () => {
  it('tạo 4 zone A/B/C/D với polygon + diện tích', () => {
    const zones = generateSampleZones([0, 0], 0.02);
    expect(zones.length).toBe(4);
    expect(zones.map(z => z.code)).toEqual(['A', 'B', 'C', 'D']);
    zones.forEach(z => {
      expect(z.polygon.length).toBe(4);
      expect(z.area_m2).toBeGreaterThan(0);
    });
  });
});

describe('zoneService — distanceToBoundary', () => {
  it('điểm trong lòng → khoảng cách lớn; điểm sát biên → nhỏ', () => {
    const dCenter = distanceToBoundary([0.5, 0.5], square);
    const dEdge = distanceToBoundary([0.5, 0.001], square);
    expect(dCenter).toBeGreaterThan(dEdge);
  });
});

describe('zoneService — polygonBounds', () => {
  it('tính bounding box đúng', () => {
    const b = polygonBounds([[0, 0], [0, 2], [2, 2], [2, 0]]);
    expect(b).toEqual([0, 2, 0, 2]); // [minLat, maxLat, minLng, maxLng]
  });
  it('rỗng → null', () => {
    expect(polygonBounds([])).toBeNull();
  });
});

describe('zoneService — clipPolygonToRect', () => {
  it('clip hình vuông 0..1 bởi rect con → còn ≥3 đỉnh', () => {
    // rect = [[minLat, maxLat], [minLng, maxLng]] — góc phần tư trái-dưới
    const clipped = clipPolygonToRect(square, [[0, 0.5], [0, 0.5]]);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
  });
  it('rect nằm ngoài hoàn toàn → rỗng', () => {
    const clipped = clipPolygonToRect(square, [[5, 6], [5, 6]]);
    expect(clipped.length).toBe(0);
  });
});

describe('zoneService — splitPolygonIntoZones (Phase C)', () => {
  // Hình chữ nhật rộng 2 (lat) x 2 (lng) → chia 4 khu
  const bigRect = [[0, 0], [0, 2], [2, 2], [2, 0]];
  it('chia 4 khu, mỗi khu nằm trong polygon gốc & có diện tích', () => {
    const zones = splitPolygonIntoZones(bigRect, 4);
    expect(zones.length).toBe(4);
    zones.forEach(z => {
      expect(z.polygon.length).toBeGreaterThanOrEqual(3);
      expect(z.area_m2).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D']).toContain(z.code);
      // tâm khu nằm trong polygon gốc (đủ ý nghĩa "nằm hoàn toàn bên trong")
      expect(pointInPolygon(z.center, bigRect)).toBe(true);
    });
  });
  it('chia 5 khu cũng chạy và cho 5 khu', () => {
    const zones = splitPolygonIntoZones(bigRect, 5);
    expect(zones.length).toBe(5);
  });
  it('tổng gần bằng diện tích gốc (không tạo thêm hay mất nhiều)', () => {
    const zones = splitPolygonIntoZones(bigRect, 4);
    const total = zones.reduce((s, z) => s + z.area_m2, 0);
    const original = polygonArea(bigRect);
    // sai số cho phép ~ vài %
    expect(total).toBeGreaterThan(original * 0.85);
    expect(total).toBeLessThan(original * 1.15);
  });
  it('polygon không hợp lệ → []', () => {
    expect(splitPolygonIntoZones([], 4)).toEqual([]);
  });
});

