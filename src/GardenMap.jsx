import React, { useState, useRef, useEffect } from 'react';
import { Undo2, Check, Trash2, Loader2, Split, PenLine, Plus } from 'lucide-react';
import { polygonArea, polygonCentroid, splitPolygonIntoZones } from './zoneService';

// ============================================================================
// GardenMap (Phase C) — trình vẽ ranh giới vườn + chia Zone, KHÔNG cần bản đồ
// ngoài (không tile network) nên chạy được cả offline / qua HTTP LAN.
//
// Sửa lỗi quan trọng:
//  - Hệ toạ độ được ĐÓNG BĂNG (freeze) ngay khi mở editor → điểm không "nhảy".
//  - Kéo điểm ranh giới hoạt động đúng (không thêm điểm nhầm do click lan).
//  - Điểm chạm to (dễ bấm trên điện thoại).
// ============================================================================

const SIZE = 1000; // viewBox vuông

// Chuyển đổi lat/lng ↔ toạ độ SVG dùng chung 1 hệ toạ độ đóng băng (box).
function latLngToSvg(lat, lng, box) {
  const pad = 0.08;
  const x = ((lng - box.minLng) / box.span) * (1 - 2 * pad) * SIZE + pad * SIZE;
  const y = SIZE - (((lat - box.minLat) / box.span) * (1 - 2 * pad) * SIZE + pad * SIZE);
  return [x, y];
}
function svgToLatLng(x, y, box) {
  const pad = 0.08;
  const lng = ((x - pad * SIZE) / ((1 - 2 * pad) * SIZE)) * box.span + box.minLng;
  const lat = box.maxLat - ((y - pad * SIZE) / ((1 - 2 * pad) * SIZE)) * box.span;
  return [lat, lng];
}

// Tính bounding box từ 1 polygon (để mở rộng hệ toạ độ theo ranh giới đã có).
function boundsOf(points) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  if (!Number.isFinite(minLat)) return null;
  const span = Math.max(maxLat - minLat, maxLng - minLng) || 1;
  return { minLat, maxLat, minLng, maxLng, span };
}

const ZONE_COLORS = {
  A: '#4caf50', B: '#2196f3', C: '#ff9800', D: '#9c27b0', E: '#00bcd4',
  F: '#f44336', G: '#795548', H: '#607d8b'
};

export default function GardenMap({ boundary, zones, onBoundaryChange, onZonesChange, readonly, initialCenter }) {
  const [mode, setMode] = useState(boundary && boundary.length >= 3 ? 'editing' : 'draw');
  const [localBoundary, setLocalBoundary] = useState(boundary || []);
  const [localZones, setLocalZones] = useState(zones || []);
  const [splitCount, setSplitCount] = useState(4);
  const [splitBusy, setSplitBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const svgRef = useRef(null);
  const dragIdxRef = useRef(null);
  const boundaryRef = useRef(localBoundary);
  boundaryRef.current = localBoundary;

  // ---- Hệ toạ độ ĐÓNG BĂNG (tính 1 lần khi vườn đổi) ----
  const [box, setBox] = useState(() =>
    boundary && boundary.length >= 2 ? boundsOf(boundary) : makeAnchorBox(initialCenter)
  );

  useEffect(() => {
    setLocalBoundary(boundary || []);
    setLocalZones(zones || []);
    setMode(boundary && boundary.length >= 3 ? 'editing' : 'draw');
    // Đóng băng hệ toạ độ theo ranh giới đã có, hoặc neo quanh tâm vườn
    setBox(boundary && boundary.length >= 2 ? boundsOf(boundary) : makeAnchorBox(initialCenter));
  }, [boundary, zones, initialCenter]);

  const area = localBoundary.length >= 3 ? polygonArea(localBoundary) : 0;

  const commitBoundary = (nb) => {
    setLocalBoundary(nb);
    onBoundaryChange?.(nb);
  };

  // Thêm điểm ranh giới khi chạm vào vùng trống của bản đồ
  const handleSvgPointerDown = (e) => {
    if (readonly || mode === 'done') return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const pt = svgToLatLng(x, y, box);
    const nb = [...boundaryRef.current, pt];
    commitBoundary(nb);
    if (nb.length >= 3 && mode === 'draw') setMode('editing');
  };

  // Bắt đầu kéo 1 điểm (chặn click lan để không thêm điểm nhầm)
  const handleCirclePointerDown = (e, idx) => {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    dragIdxRef.current = idx;
    setDragIdx(idx);
  };

  const handlePointerMove = (e) => {
    if (dragIdxRef.current === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const pt = svgToLatLng(x, y, box);
    const idx = dragIdxRef.current;
    const nb = boundaryRef.current.map((p, i) => (i === idx ? pt : p));
    setLocalBoundary(nb);
  };

  const handlePointerUp = () => {
    if (dragIdxRef.current !== null) {
      onBoundaryChange?.(boundaryRef.current);
      dragIdxRef.current = null;
      setDragIdx(null);
    }
  };

  const undoPoint = () => {
    const nb = boundaryRef.current.slice(0, -1);
    commitBoundary(nb);
    if (nb.length < 3) setMode('draw');
  };

  const clearAll = () => {
    commitBoundary([]);
    setLocalZones([]);
    onZonesChange?.([]);
    setMode('draw');
  };

  const doSplit = () => {
    if (boundaryRef.current.length < 3) return;
    setSplitBusy(true);
    try {
      const z = splitPolygonIntoZones(boundaryRef.current, splitCount);
      setLocalZones(z);
      onZonesChange?.(z);
    } finally {
      setSplitBusy(false);
    }
  };

  // Render các điểm / polygon dùng hệ toạ độ đã đóng băng
  const pts = localBoundary.map(([lat, lng]) => latLngToSvg(lat, lng, box));
  const polygonPath = pts.length >= 2 ? `M ${pts.map(p => p.join(' ')).join(' L ')} ${pts.length >= 3 ? 'Z' : ''}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{
            width: '100%', height: '330px', border: '2px dashed var(--border-color)',
            borderRadius: '12px', background: '#e8f0e8',
            cursor: readonly ? 'default' : dragIdx !== null ? 'grabbing' : 'crosshair',
            touchAction: 'none', userSelect: 'none'
          }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Lưới nhẹ */}
          {[0.2, 0.4, 0.6, 0.8].map(t => (
            <g key={t} stroke="#cdd8cd" strokeWidth="1">
              <line x1={t * SIZE} y1={0} x2={t * SIZE} y2={SIZE} />
              <line x1={0} y1={t * SIZE} x2={SIZE} y2={t * SIZE} />
            </g>
          ))}

          {/* Các khu đã chia */}
          {localZones.map(z => {
            const zPts = z.polygon.map(([lat, lng]) => latLngToSvg(lat, lng, box));
            const zPath = zPts.length >= 3 ? `M ${zPts.map(p => p.join(' ')).join(' L ')} Z` : '';
            return (
              <g key={z.code}>
                {zPath && <path d={zPath} fill={`${ZONE_COLORS[z.code] || '#888'}38`} stroke={ZONE_COLORS[z.code] || '#888'} strokeWidth="2" />}
                {z.center && (() => {
                  const c = latLngToSvg(z.center[0], z.center[1], box);
                  return <text x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="middle" fontSize="30" fontWeight="700" fill={ZONE_COLORS[z.code] || '#333'}>{z.code}</text>;
                })()}
              </g>
            );
          })}

          {/* Ranh giới vườn */}
          {polygonPath && <path d={polygonPath} fill="rgba(76,175,80,0.15)" stroke="#2e7d32" strokeWidth="4" strokeLinejoin="round" />}

          {/* Điểm ranh giới — vòng chạm lớn cho nông dân */}
          {pts.map((p, i) => (
            <g key={i} onPointerDown={(e) => handleCirclePointerDown(e, i)} style={{ cursor: readonly ? 'default' : 'grab' }}>
              {/* Vùng bắt sự kiện rộng */}
              <circle cx={p[0]} cy={p[1]} r="28" fill="transparent" />
              <circle cx={p[0]} cy={p[1]} r="12" fill="#fff" stroke="#e65100" strokeWidth="4" />
            </g>
          ))}

          {/* Hướng dẫn khi chưa vẽ */}
          {localBoundary.length === 0 && (
            <text x={SIZE / 2} y={SIZE / 2} textAnchor="middle" fontSize="20" fill="#52796f">
              👆 Chạm để thêm từng điểm góc vườn
            </text>
          )}
        </svg>

        {/* Badge diện tích (khi đã vẽ) */}
        {area > 0 && (
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(46,125,50,0.92)', color: 'white', borderRadius: '10px', padding: '7px 11px', fontSize: '13px', fontWeight: 700 }}>
            📐 {area.toLocaleString('vi-VN')} m²
          </div>
        )}
        {localBoundary.length > 0 && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}>
            {localBoundary.length} điểm
          </div>
        )}
      </div>

      {/* Thanh điều khiển */}
      {mode === 'draw' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }} disabled={localBoundary.length < 3} onClick={() => setMode('editing')}>
            <Check size={16} /> Xác nhận ranh giới ({localBoundary.length} điểm)
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '13px' }} onClick={undoPoint} disabled={localBoundary.length === 0}>
            <Undo2 size={16} /> Hoàn tác
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '13px' }} onClick={clearAll}>
            <Trash2 size={16} /> Xóa
          </button>
        </div>
      )}

      {mode === 'editing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PenLine size={13} /> Chia thành:
            </span>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', background: splitCount === 4 ? '#e8f5e9' : 'transparent' }} onClick={() => setSplitCount(4)}>
              4 khu
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px', background: splitCount === 5 ? '#e8f5e9' : 'transparent' }} onClick={() => setSplitCount(5)}>
              5 khu
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }} onClick={doSplit} disabled={splitBusy || localBoundary.length < 3}>
              {splitBusy ? <Loader2 size={16} className="spin" /> : <Split size={16} />} Chia khu
            </button>
          </div>

          {localZones.length > 0 && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {localZones.map(z => (
                  <span key={z.code} style={{ fontSize: '12px', background: `${ZONE_COLORS[z.code]}22`, color: ZONE_COLORS[z.code], border: `1px solid ${ZONE_COLORS[z.code]}55`, borderRadius: '8px', padding: '4px 9px', fontWeight: 700 }}>
                    {z.code} — {z.area_m2.toLocaleString('vi-VN')} m²
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                🖐 <strong>Kéo các chấm đỏ</strong> để chỉnh ranh giới (& chạm vùng trống để thêm điểm). Các khu luôn nằm trong vườn. Bấm "Xác nhận & hoàn tất" để lưu.
              </div>
              <button type="button" className="btn btn-primary" style={{ fontSize: '13px' }} onClick={() => setMode('done')}>
                <Check size={16} /> Xác nhận & hoàn tất
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2e7d32', fontSize: '13px', fontWeight: 600 }}>
          <Check size={16} /> Đã tạo {localZones.length} khu {localZones.map(z => z.code).join(', ')}
          <button type="button" className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: '12px', padding: '5px 10px' }} onClick={() => setMode('editing')}>
            <PenLine size={14} /> Chỉnh lại
          </button>
        </div>
      )}
    </div>
  );
}

// Tạo hệ toạ độ neo quanh tâm vườn (khi chưa có ranh giới).
function makeAnchorBox(center) {
  const c = center && center.length === 2 && Number.isFinite(center[0]) ? center : [12.6667, 108.05];
  const half = 0.02; // ~ ±2.2 km — đủ rộng cho thao tác vẽ
  return { minLat: c[0] - half, maxLat: c[0] + half, minLng: c[1] - half, maxLng: c[1] + half, span: half * 2 };
}
