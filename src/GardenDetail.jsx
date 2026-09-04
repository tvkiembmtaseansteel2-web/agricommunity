import React from 'react';
import { ArrowLeft, MapPin, Droplets, Wind, CloudSun, CheckCircle2, AlertTriangle } from 'lucide-react';

// ============================================================================
// GardenDetail — xem chi tiết một vườn: thời tiết theo đúng tọa độ vườn,
// trạng thái + khu vực, nhật ký và nhắc công việc của riêng vườn đó.
// ============================================================================

const ACTIVITY_LABELS = {
  bon_phan: '🌱 Bón phân', phun_thuoc: '🧪 Phun thuốc', tuoi_nuoc: '💧 Tưới nước',
  cat_tia: '✂️ Cắt tỉa', lam_co: '🌿 Làm cỏ', khac: '📝 Khác'
};
const CROP_LABELS = { sau_rieng: 'Sầu riêng', cafe: 'Cà phê', ho_tieu: 'Hồ tiêu' };
const ZONE_COLORS = { A: '#4caf50', B: '#2196f3', C: '#ff9800', D: '#9c27b0', E: '#00bcd4' };

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.max(0, Math.round((t - s) / 86400000));
}

export default function GardenDetail({ garden, gardenWeather, gardenLogs, zones, zoneHealth, todayTasks = [], statusLabel, statusDot, onBack }) {
  const crop = CROP_LABELS[garden.crop_type] || garden.crop_type;
  const gw = gardenWeather || null;
  const hasCoords = garden.center_lat || garden.center_lng || garden.latitude || garden.longitude;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            ← Quay lại
          </button>
          <span style={{ fontSize: '12px', opacity: 0.9 }}>📍 Chi tiết vườn</span>
        </div>
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{crop} — {garden.name}</div>
          {hasCoords
            ? <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>📍 {parseFloat(garden.center_lat || garden.latitude).toFixed(4)}, {parseFloat(garden.center_lng || garden.longitude).toFixed(4)}</div>
            : <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px' }}>📍 Chưa ghi vị trí — dùng khu vực mặc định</div>}
        </div>
      </div>

      {/* Thời tiết theo đúng khu vực vườn */}
      {gw ? (
        <div className={`card weather-widget ${gw.isDay === false ? 'weather-widget--night' : ''}`} style={{ padding: '16px' }}>
          <div className="card-title" style={{ color: 'white', fontSize: '14px' }}>
            <CloudSun size={18} /> Thời tiết tại khu vực vườn
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', color: 'white' }}>
            <div>
              <div style={{ fontSize: '34px', fontWeight: 700 }}>{gw.temp}°C</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>{gw.desc} • Độ ẩm {gw.humidity}%</div>
            </div>
            <div style={{ fontSize: '34px' }}>{gw.icon}</div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', opacity: 0.85, marginTop: '8px', color: 'white' }}>
            <span><Wind size={13} /> Gió {gw.wind} km/h</span>
            <span><Droplets size={13} /> Mưa {gw.rain} mm</span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Đang cập nhật thời tiết khu vực vườn...
        </div>
      )}

      {/* ✅ Việc cần làm / nhắc lịch cho vườn này */}
      <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
        <div className="card-title" style={{ fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✅ Việc cần làm hôm nay</span>
          {statusLabel && <span style={{ fontSize: '12px' }}>{statusDot} {statusLabel}</span>}
        </div>
        {todayTasks.length === 0 ? (
          <p style={{ color: '#2e7d32', fontSize: '13px', padding: '8px 0', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <CheckCircle2 size={16} /> Vườn này không có việc gì cần ưu tiên — duy trì chăm sóc.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayTasks.map((t, i) => (
              <div key={i} style={{
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                background: t.priority === 'cao' ? '#fff3e0' : 'var(--primary-light)',
                border: '1px solid var(--border-color)', borderLeft: `4px solid ${t.priority === 'cao' ? '#e65100' : '#f9a825'}`,
                borderRadius: '8px', padding: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{t.text}</div>
                  <div style={{ fontSize: '11px', color: t.priority === 'cao' ? '#b71c1c' : '#8d6e00', marginTop: '3px', fontWeight: 600 }}>
                    ⏳ {t.when}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trạng thái + khu vực */}
      <div className="card">
        <div className="card-title" style={{ fontSize: '15px' }}>🧩 Khu vực trong vườn</div>
        {zoneHealth && zoneHealth.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {zoneHealth.map((zh) => (
              <div key={zh.zone.id ?? zh.zone.code} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: zh.status === 'risk' ? '#fff3e0' : zh.status === 'warn' ? '#fffde7' : '#f5f5f5',
                border: '1px solid var(--border-color)', borderLeft: `4px solid ${zh.status === 'risk' ? '#e65100' : zh.status === 'warn' ? '#f9a825' : '#2e7d32'}`,
                borderRadius: '8px', padding: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{zh.dot} Khu {zh.code} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px' }}>{zh.name}</span></div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {zh.unresolvedIssues.length > 0 ? `⚠️ ${zh.unresolvedIssues.length} vấn đề chưa xử lý` : zh.findings[0]?.text}
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: zh.status === 'risk' ? '#b71c1c' : zh.status === 'warn' ? '#8d6e00' : '#1b5e20' }}>{zh.statusLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '8px 0' }}>Vườn chưa được chia khu (A/B/C/D).</p>
        )}
      </div>

      {/* Nhật ký riêng của vườn */}
      <div className="card">
        <div className="card-title" style={{ fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📔 Nhật ký vườn</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{gardenLogs.length} bản ghi</span>
        </div>
        {gardenLogs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>Chưa có nhật ký cho vườn này.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {gardenLogs.slice(0, 20).map((log) => (
              <div key={log.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {ACTIVITY_LABELS[log.activity_type] || log.activity_type}
                  <span className={`crop-tag ${log.crop_type}`} style={{ marginLeft: '6px' }}>{CROP_LABELS[log.crop_type] || log.crop_type}</span>
                </div>
                {log.product_name && <div style={{ fontSize: '12px', marginTop: '3px' }}>Vật tư: {log.product_name}{log.dosage ? ` (${log.dosage})` : ''}</div>}
                {log.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{log.notes}</div>}
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  📅 {fmtDate(log.activity_date)}{(() => { const d = daysSince(log.activity_date); return d !== null ? ` • ${d === 0 ? 'hôm nay' : `${d} ngày trước`}` : ''; })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
