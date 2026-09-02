// ============================================================================
// zoneService — logic Zone (theo Zone.md): Point-in-Polygon, phân vùng, diện tích.
// Không dùng lib ngoài để nhẹ: thuật toán ray-casting tự viết, dễ kiểm thử.
// Ghi chú: cần thêm turf.js khi mở rộng (buffer, k-means auto-split) ở Phase C.
// ============================================================================

// Kiểm tra 1 điểm (lat,lng) có nằm trong polygon không (ray-casting / even-odd rule).
// polygon: mảng [[lat,lng],[lat,lng],...] (khép kín; phần tử đầu/ckuối có thể trùng).
export function pointInPolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) return false;
  const [x, y] = point; // x = lat, y = lng
  const ring = polygon.map((p) => [Number(p[0]), Number(p[1])]);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Khoảng cách Euclid (trên mặt phẳng lat/lng — đủ dùng để so sánh gần ranh giới).
export function pointDistance(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Khoảng cách từ điểm tới đoạn thẳng (lat/lng). Dùng để ước lượng "gần ranh giới".
function distancePointToSegment(pt, a, b) {
  const [px, py] = pt;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return pointDistance(pt, a);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

// Khoảng cách ngắn nhất từ điểm tới biên (các cạnh) của polygon.
export function distanceToBoundary(point, polygon) {
  if (!polygon || polygon.length < 2) return Infinity;
  const ring = polygon.map((p) => [Number(p[0]), Number(p[1])]);
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distancePointToSegment(point, ring[j], ring[i]);
    if (d < min) min = d;
  }
  return min;
}

// Diện tích polygon (công thức shoelace) theo lat/lng, trả về m² xấp xỉ.
// Lưu ý: xấp xỉ vì không chiếu lên mặt phẳng mét — đủ cho MVP (Zone.md §4).
export function polygonArea(polygon) {
  if (!polygon || polygon.length < 3) return 0;
  const ring = polygon.map((p) => [Number(p[0]), Number(p[1])]);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  // Đổi từ độ² sang m² xấp xỉ (1 độ lat ≈ 111,320 m)
  return Math.abs(area / 2) * 111320 * 111320 * Math.cos((ring[0][0] * Math.PI) / 180);
}

// Độ nhạy "gần ranh giới" (độ lat/lng). ~0.00045 độ ≈ 50m — nông dân đứng sát hàng rào.
const NEAR_BOUNDARY_EPS = 0.00045;

/**
 * Xác định Zone cho một điểm GPS từ danh sách zones của vườn.
 * @returns {{
 *   zone: object|null,        // zone khớp (nếu nằm trong)
 *   status: 'found'|'near'|'none',
 *   candidates: Array<object>,// nếu near → các zone lân cận (ranh giới)
 * }}
 */
export function resolveZoneFromGps(point, zones) {
  if (!point || !Array.isArray(zones) || zones.length === 0) {
    return { zone: null, status: 'none', candidates: [] };
  }
  // Bước 1: tìm zone CHỨA điểm
  for (const z of zones) {
    if (z.polygon && pointInPolygon(point, z.polygon)) {
      return { zone: z, status: 'found', candidates: [] };
    }
  }
  // Bước 2: không nằm trong zone nào → kiểm tra có nằm sát ranh giới không
  const near = [];
  for (const z of zones) {
    if (z.polygon && distanceToBoundary(point, z.polygon) <= NEAR_BOUNDARY_EPS) {
      near.push(z);
    }
  }
  if (near.length > 0) {
    return { zone: null, status: 'near', candidates: near };
  }
  return { zone: null, status: 'none', candidates: [] };
}

// Trung bình cộng các điểm của polygon → điểm đại diện (center) cho zone.
export function polygonCentroid(polygon) {
  if (!polygon || polygon.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of polygon) {
    lat += Number(p[0]);
    lng += Number(p[1]);
  }
  return [lat / polygon.length, lng / polygon.length];
}

// Tạo 4 zone hình chữ nhật (2x2) quanh center vườn — placeholder để MVP chạy được.
// Khi có bản đồ + auto-split (Phase C) sẽ thay bằng chia polygon thực.
export function generateSampleZones(center, spread = 0.01) {
  const [clat, clng] = center || [0, 0];
  const h = spread / 2;
  const quads = [
    { code: 'A', name: 'Khu A', bounds: [[clat, clng], [clat + h, clng + h]] },
    { code: 'B', name: 'Khu B', bounds: [[clat + h, clng], [clat, clng + h]] },
    { code: 'C', name: 'Khu C', bounds: [[clat, clng - h], [clat + h, clng]] },
    { code: 'D', name: 'Khu D', bounds: [[clat + h, clng - h], [clat, clng]] }
  ];
  return quads.map((q) => {
    const [[lat0, lng0], [lat1, lng1]] = q.bounds;
    const polygon = [
      [lat0, lng0],
      [lat0, lng1],
      [lat1, lng1],
      [lat1, lng0]
    ];
    return { code: q.code, name: q.name, polygon, area_m2: Math.round(polygonArea(polygon)) };
  });
}

// ============================================================================
// Phase C — hình học polygon: bounds, clip (Sutherland–Hodgman), auto-split N khu.
// ============================================================================

// Bounding box của polygon → [minLat, maxLat, minLng, maxLng]
export function polygonBounds(polygon) {
  if (!polygon || polygon.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of polygon) {
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [minLat, maxLat, minLng, maxLng];
}

// Clip một polygon (subject) bởi nửa mặt phẳng xác định bởi 1 cạnh của hình chữ nhật.
// Sutherland–Hodgman: cắt lần lượt theo 4 cạnh (trái, phải, trên, dưới).
function clipByRectEdge(polygon, edge, value) {
  // edge: 'left'|'right'|'top'|'bottom'; giá trị là biên lat/lng.
  const keepInside = (p) => {
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (edge === 'left') return lng >= value;
    if (edge === 'right') return lng <= value;
    if (edge === 'top') return lat <= value;
    return lat >= value; // bottom
  };
  const intersect = (p1, p2) => {
    const lat1 = Number(p1[0]), lng1 = Number(p1[1]);
    const lat2 = Number(p2[0]), lng2 = Number(p2[1]);
    if (edge === 'left' || edge === 'right') {
      const t = (value - lng1) / (lng2 - lng1);
      return [lat1 + t * (lat2 - lat1), value];
    }
    const t = (value - lat1) / (lat2 - lat1);
    return [value, lng1 + t * (lng2 - lng1)];
  };

  const out = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const cur = polygon[i];
    const prev = polygon[j];
    const curIn = keepInside(cur);
    const prevIn = keepInside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  return out;
}

// Clip polygon bởi hình chữ nhật [[minLat, maxLat], [minLng, maxLng]]
export function clipPolygonToRect(polygon, rect) {
  if (!polygon || polygon.length < 3 || !rect) return [];
  const [minLat, maxLat] = rect[0];
  const [minLng, maxLng] = rect[1];
  let result = polygon;
  result = clipByRectEdge(result, 'left', minLng);    // lng >= min
  result = clipByRectEdge(result, 'right', maxLng);   // lng <= max
  result = clipByRectEdge(result, 'top', maxLat);     // lat <= max
  result = clipByRectEdge(result, 'bottom', minLat);  // lat >= min
  return result;
}

// Chia polygon thành N khu nằm HOÀN TOÀN bên trong polygon (grid cells ∩ polygon).
// Trả về mảng các khu { code, name, polygon, area_m2, center }.
export function splitPolygonIntoZones(polygon, count = 4) {
  if (!polygon || polygon.length < 3) return [];
  const bounds = polygonBounds(polygon);
  if (!bounds) return [];
  const [minLat, maxLat, minLng, maxLng] = bounds;

  // Chọn lưới rows × cols sao cho đủ ≥ count ô
  let cols = Math.ceil(Math.sqrt(count));
  let rows = Math.ceil(count / cols);
  if (rows * cols < count) cols = Math.ceil(count / rows);

  const latStep = (maxLat - minLat) / rows;
  const lngStep = (maxLng - minLng) / cols;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect = [
        [minLat + r * latStep, minLat + (r + 1) * latStep],
        [minLng + c * lngStep, minLng + (c + 1) * lngStep]
      ];
      const clipped = clipPolygonToRect(polygon, rect);
      if (clipped.length >= 3) {
        cells.push({ rect, polygon: clipped, area_m2: polygonArea(clipped) });
      }
    }
  }

  // Giữ đúng `count` ô lớn nhất (nếu lưới cho nhiều hơn)
  cells.sort((a, b) => b.area_m2 - a.area_m2);
  const chosen = cells.slice(0, count);
  // Sắp lại theo vị trí (trên→dưới, trái→phải) để tên A/B/C... dễ đọc
  chosen.sort((a, b) => (a.rect[0][0] - b.rect[0][0]) || (a.rect[0][1] - b.rect[0][1]));

  const codes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return chosen.map((cell, i) => ({
    code: codes[i] || String(i + 1),
    name: `Khu ${codes[i] || String(i + 1)}`,
    polygon: cell.polygon,
    area_m2: Math.round(cell.area_m2),
    center: polygonCentroid(cell.polygon)
  }));
}
