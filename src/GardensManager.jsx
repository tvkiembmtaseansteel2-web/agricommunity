import React, { useState, useEffect } from 'react';
import { Trees, Plus, MapPin, Trash2, Loader2, Map as MapIcon, Save } from 'lucide-react';
import { supabase } from './supabaseClient';
import GardenMap from './GardenMap';
import { polygonCentroid, polygonArea } from './zoneService';

// "Vườn của tôi" — entity trung tâm (theo UX Blueprint).
// Thêm/sửa/xóa vườn, mỗi vườn gắn cây trồng + diện tích + số cây + tuổi.
// Nhật ký & sản lượng sau này gắn với garden_id.

const CROPS = [
  { value: 'sau_rieng', label: '🌳 Sầu riêng' },
  { value: 'cafe', label: '☕ Cà phê' },
  { value: 'ho_tieu', label: '🌿 Hồ tiêu' }
];

export default function GardensManager({ onGardensChange }) {
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', crop_type: 'sau_rieng', area_m2: '', plant_count: '', plant_age_years: '', notes: '' });
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState(null);

  // Vẽ ranh giới / chia khu cho từng vườn (Phase C)
  const [mapGardenId, setMapGardenId] = useState(null); // vườn đang mở bản đồ
  const [mapBoundary, setMapBoundary] = useState(null); // polygon ranh giới đang chỉnh
  const [mapZones, setMapZones] = useState([]); // khu đang chỉnh
  const [savingMap, setSavingMap] = useState(false);
  const [mapMsg, setMapMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
      await reload();
      setLoading(false);
    })();
  }, []);

  const reload = async () => {
    const { data } = await supabase.from('gardens').select('*').order('created_at', { ascending: false });
    if (data) { setGardens(data); onGardensChange?.(data); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('⚠️ Nhập tên vườn.'); return; }
    setAdding(true);
    const { error } = await supabase.from('gardens').insert([{
      profile_id: userId,
      name: form.name.trim(),
      crop_type: form.crop_type,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      plant_count: form.plant_count ? parseInt(form.plant_count, 10) : null,
      plant_age_years: form.plant_age_years ? parseInt(form.plant_age_years, 10) : null,
      notes: form.notes.trim() || null
    }]);
    setAdding(false);
    if (error) { setMsg('❌ ' + error.message); }
    else {
      setMsg('✅ Đã thêm vườn.');
      setForm({ name: '', crop_type: 'sau_rieng', area_m2: '', plant_count: '', plant_age_years: '', notes: '' });
      reload();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa vườn này?')) return;
    const { error } = await supabase.from('gardens').delete().eq('id', id);
    if (error) setMsg('❌ ' + error.message);
    else { setMsg('✅ Đã xóa.'); reload(); }
  };

  // Mở bản đồ vẽ ranh giới cho một vườn
  const openMap = async (g) => {
    setMapGardenId(g.id);
    setMapMsg('');
    setMapBoundary(g.boundary_polygon || []);
    const { data: gz } = await supabase.from('zones').select('*').eq('garden_id', g.id).order('id', { ascending: true });
    setMapZones(gz || []);
  };

  // Lưu ranh giới + các khu vào DB
  const saveBoundaryAndZones = async () => {
    if (!mapGardenId) return;
    if (!mapBoundary || mapBoundary.length < 3) { setMapMsg('⚠️ Vẽ ranh giới vườn (ít nhất 3 điểm) trước khi lưu.'); return; }
    setSavingMap(true);
    try {
      const center = polygonCentroid(mapBoundary);
      // 1) Cập nhật ranh giới + tâm vườn
      const { error: gErr } = await supabase.from('gardens')
        .update({
          boundary_polygon: mapBoundary,
          area_m2: Math.round(polygonArea(mapBoundary)),
          center_lat: center?.[0] || null,
          center_lng: center?.[1] || null,
          latitude: center?.[0] || null,
          longitude: center?.[1] || null
        })
        .eq('id', mapGardenId);
      if (gErr) throw gErr;

      // 2) Xóa khu cũ rồi thêm các khu mới (đơn giản, MVP)
      await supabase.from('zones').delete().eq('garden_id', mapGardenId);
      if (mapZones.length > 0) {
        const rows = mapZones.map(z => ({
          garden_id: mapGardenId,
          code: z.code,
          name: z.name || `Khu ${z.code}`,
          polygon: z.polygon,
          area_m2: z.area_m2 || null,
          center_lat: z.center?.[0] ?? null,
          center_lng: z.center?.[1] ?? null
        }));
        const { error: zErr } = await supabase.from('zones').insert(rows);
        if (zErr) throw zErr;
      }
      setMapMsg('✅ Đã lưu ranh giới + ' + mapZones.length + ' khu.');
      setMapGardenId(null);
      reload();
    } catch (err) {
      console.error('Không lưu được ranh giới:', err);
      setMapMsg('❌ ' + (err.message || 'Lỗi khi lưu'));
    } finally {
      setSavingMap(false);
    }
  };

  const cropLabel = (v) => CROPS.find(c => c.value === v)?.label || v;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white' }}>
          <Trees size={20} /> Vườn của tôi
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Tạo vườn để AgriCommunity hiểu và chăm vườn của bạn. Nhật ký, sản lượng,
          cảnh báo sẽ gắn theo từng vườn.
        </p>
      </div>

      {/* Danh sách vườn */}
      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Loader2 size={18} className="spin" /> Đang tải vườn...
        </div>
      ) : gardens.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌳</div>
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>Bạn chưa thêm vườn nào.</p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 14px' }}>
            Thêm vườn để theo dõi sức khỏe, chăm sóc và sản lượng.
          </p>
          <button className="btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Plus size={18} /> Thêm vườn đầu tiên
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {gardens.map(g => (
            <div key={g.id} className="card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--primary-dark)' }}>{g.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{cropLabel(g.crop_type)}</div>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  title="Xóa vườn"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {g.area_m2 && <span>📐 {g.area_m2.toLocaleString()} m²</span>}
                {g.plant_count && <span>🌱 {g.plant_count.toLocaleString()} cây</span>}
                {g.plant_age_years && <span>⏳ {g.plant_age_years} năm</span>}
                {(g.latitude || g.longitude) && <span><MapPin size={12} /> đã có tọa độ</span>}
                {g.boundary_polygon && <span><MapIcon size={12} /> đã vẽ ranh giới</span>}
              </div>
              {g.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>{g.notes}</div>}
              <button
                type="button"
                onClick={() => openMap(g)}
                style={{ marginTop: '8px', width: '100%', padding: '8px', borderRadius: '10px', border: '2px dashed var(--primary-color)', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <MapIcon size={15} /> {g.boundary_polygon ? 'Xem / chỉnh ranh giới & khu' : '🗺️ Vẽ ranh giới & chia khu'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 🗺️ Trình vẽ ranh giới & chia khu (Phase C) */}
      {mapGardenId !== null && (
        <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
          <div className="card-title" style={{ fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><MapIcon size={16} /> Ranh giới & khu — {gardens.find(g => g.id === mapGardenId)?.name || ''}</span>
            <button onClick={() => setMapGardenId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Đóng">
              ✕
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
            Chạm để thêm điểm góc vườn → xác nhận ranh giới → chia 4/5 khu → kéo chỉnh → lưu. Các khu luôn nằm trong vườn.
          </p>
          <GardenMap
            boundary={mapBoundary}
            zones={mapZones}
            initialCenter={(() => {
              const g = gardens.find(x => x.id === mapGardenId);
              return g ? [parseFloat(g.latitude) || 12.6667, parseFloat(g.longitude) || 108.05] : [12.6667, 108.05];
            })()}
            onBoundaryChange={setMapBoundary}
            onZonesChange={setMapZones}
          />
          {mapMsg && <div style={{ fontSize: '12px', marginTop: '10px', color: 'var(--text-primary)' }}>{mapMsg}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={saveBoundaryAndZones} disabled={savingMap || !mapBoundary || mapBoundary.length < 3} style={{ fontSize: '13px' }}>
              {savingMap ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Lưu ranh giới & khu
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMapGardenId(null)} style={{ fontSize: '13px' }}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Form thêm vườn */}
      <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
        <div className="card-title" style={{ fontSize: '15px' }}>
          <Plus size={16} /> Thêm vườn mới
        </div>
        {msg && <div style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--text-primary)' }}>{msg}</div>}
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label>Tên vườn</label>
            <input type="text" className="form-input" placeholder="Ví dụ: Vườn sầu riêng A" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Trồng cây gì?</label>
            <select className="form-select" value={form.crop_type} onChange={e => setForm({ ...form, crop_type: e.target.value })}>
              {CROPS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label>Diện tích (m²)</label>
              <input type="number" className="form-input" placeholder="Ví dụ: 12000" value={form.area_m2}
                onChange={e => setForm({ ...form, area_m2: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Số cây</label>
              <input type="number" className="form-input" placeholder="Ví dụ: 320" value={form.plant_count}
                onChange={e => setForm({ ...form, plant_count: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Tuổi vườn (năm)</label>
            <input type="number" className="form-input" placeholder="Ví dụ: 6" value={form.plant_age_years}
              onChange={e => setForm({ ...form, plant_age_years: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Ghi chú (tùy chọn)</label>
            <input type="text" className="form-input" placeholder="Ví dụ: Khu A thoát nước kém" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Đang thêm...' : 'Thêm vườn'}
          </button>
        </form>
      </div>
    </div>
  );
}
