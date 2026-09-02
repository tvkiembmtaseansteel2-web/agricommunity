import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Globe2, CalendarDays, Loader2, BookOpen } from 'lucide-react';
import { supabase } from './supabaseClient';

// MRL Advisor — tra cứu nhanh quy định dư lượng thuốc BVTV (MRL) + thời gian cách ly (REI)
// theo cây trồng và thị trường xuất khẩu. Giữ giao diện tối giản cho nông dân.

const CROPS = [
  { value: 'sau_rieng', label: 'Sầu riêng', emoji: '🍈' },
  { value: 'cafe', label: 'Cà phê', emoji: '☕' },
  { value: 'ho_tieu', label: 'Hồ tiêu', emoji: '🌶️' }
];

const MARKETS = [
  { value: 'China', label: 'Trung Quốc' },
  { value: 'EU', label: 'EU (Châu Âu)' },
  { value: 'US', label: 'Mỹ' },
  { value: 'Japan', label: 'Nhật Bản' }
];

// Nhãn dạng sản phẩm (commodity_form)
const FORM_LABELS = {
  fresh: 'Quả tươi',
  green_bean: 'Cà phê nhân',
  roasted: 'Cà phê rang',
  ground: 'Xay',
  dried: 'Khô',
  frozen: 'Đông lạnh',
  processed: 'Chế biến'
};

const STATUS_META = {
  banned: { label: 'CẤM TUYỆT ĐỐI', color: '#d32f2f', bg: '#ffebee', icon: '🚫' },
  restricted: { label: 'HẠN CHẾ (MRL thấp)', color: '#e65100', bg: '#fff3e0', icon: '⚠️' },
  allowed: { label: 'ĐƯỢC PHÉP', color: '#2e7d32', bg: '#e8f5e9', icon: '✅' }
};

export default function MRLAdvisor({ isAdmin = false }) {
  const [crop, setCrop] = useState('sau_rieng');
  const [market, setMarket] = useState('China');
  const [standards, setStandards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSprayDate, setLastSprayDate] = useState('');
  const [references, setReferences] = useState([]); // nguồn pháp lý (regulatory_references)

  // Form thêm mới hoạt chất (admin)
  const [newStandard, setNewStandard] = useState({
    chemical_name: '',
    mrl_ppm: '',
    status: 'restricted',
    rei_days: '',
    notes: ''
  });
  const [adding, setAdding] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('export_standards').select('*');
        if (!error && active) setStandards(data || []);
        else if (active) console.warn('Không tải được tiêu chuẩn xuất khẩu:', error?.message);
        // Tải nguồn pháp lý đã xác minh
        const { data: refs, error: refErr } = await supabase.from('regulatory_references').select('*');
        if (!refErr && active) setReferences(refs || []);
      } catch (e) {
        console.warn('Lỗi khi tải tiêu chuẩn xuất khẩu:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = standards.filter(s => s.crop_type === crop && s.market === market);

  // Tính ngày an toàn thu hoạch: ngày phun + REI dài nhất trong danh sách
  const maxRei = Math.max(0, ...filtered.map(s => s.rei_days || 0));
  const safeDate = lastSprayDate && maxRei > 0
    ? new Date(new Date(lastSprayDate).getTime() + maxRei * 86400000).toLocaleDateString('vi-VN')
    : null;

  const translateCrop = (v) => CROPS.find(c => c.value === v)?.label || v;

  // ---- Admin: quản lý hoạt chất MRL ----
  const reloadStandards = async () => {
    const { data } = await supabase.from('export_standards').select('*');
    if (data) setStandards(data);
  };

  const handleAddStandard = async (e) => {
    e.preventDefault();
    setAdding(true);
    setAdminMsg('');
    const mrl = parseFloat(newStandard.mrl_ppm);
    if (!newStandard.chemical_name.trim() || isNaN(mrl)) {
      setAdminMsg('⚠️ Cần nhập tên hoạt chất và MRL (số).');
      setAdding(false);
      return;
    }
    const { error } = await supabase.from('export_standards').insert([{
      crop_type: crop,
      market,
      chemical_name: newStandard.chemical_name.trim(),
      mrl_ppm: mrl,
      status: newStandard.status,
      rei_days: newStandard.rei_days ? parseInt(newStandard.rei_days, 10) : null,
      notes: newStandard.notes.trim() || null
    }]);
    setAdding(false);
    if (error) {
      setAdminMsg('❌ Không thêm được: ' + error.message);
    } else {
      setNewStandard({ chemical_name: '', mrl_ppm: '', status: 'restricted', rei_days: '', notes: '' });
      setAdminMsg('✅ Đã thêm hoạt chất ' + newStandard.chemical_name.trim() + '.');
      reloadStandards();
    }
  };

  const handleDeleteStandard = async (id) => {
    if (!window.confirm('Xóa hoạt chất này khỏi danh mục?')) return;
    const { error } = await supabase.from('export_standards').delete().eq('id', id);
    if (error) {
      setAdminMsg('❌ Không xóa được: ' + error.message);
    } else {
      setAdminMsg('✅ Đã xóa.');
      reloadStandards();
    }
  };

  const handleToggleStatus = async (s) => {
    // Chuyển nhanh trạng thái: allowed ↔ restricted ↔ banned (admin)
    const order = ['allowed', 'restricted', 'banned'];
    const next = order[(order.indexOf(s.status) + 1) % order.length];
    const { error } = await supabase.from('export_standards').update({ status: next }).eq('id', s.id);
    if (error) setAdminMsg('❌ Lỗi: ' + error.message);
    else reloadStandards();
  };

  // Lọc nguồn pháp lý liên quan thị trường hiện chọn
  const marketReferences = references.filter(r => {
    const rk = (r.source_number || '').toLowerCase();
    const mk = market.toLowerCase();
    if (market === 'EU' && (rk.includes('eu') || rk.includes('europe'))) return true;
    if (market === 'US' && (rk.includes('epa') || rk.includes('aphis') || rk.includes('us') || rk.includes('cfr'))) return true;
    if (market === 'China' && (rk.includes('protocol') || rk.includes('cn') || rk.includes('gacc') || rk.includes('trung'))) return true;
    if (market === 'Japan' && (rk.includes('maff') || rk.includes('jp') || rk.includes('nhật'))) return true;
    // Luôn hiện luật nền Việt Nam (áp dụng mọi thị trường)
    if (['31/2018/qh14', '41/2013/qh13', '55/2010/qh12', '28/2026', '75/2025'].some(x => rk.includes(x))) return true;
    return false;
  });

  const TYPE_LABELS = {
    law: 'Luật', circular: 'Thông tư', qcvn: 'QCVN', tcvn: 'TCVN',
    protocol: 'Nghị định thư', foreign_regulation: 'Quy định nước nhập khẩu', decree: 'Nghị định'
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Giới thiệu */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white' }}>
          <Globe2 size={20} /> Tham khảo chất cấm & hạn chế
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Danh mục hoạt chất <strong>cấm</strong> / <strong>hạn chế</strong> theo thị trường xuất khẩu
          — <strong>chỉ để tham khảo</strong>, giúp bạn tránh chất độc hại.
          Quy trình <strong>bón phân / phun thuốc</strong> hãy dựa theo hướng dẫn của
          <strong> "Bác sĩ cây trồng AI"</strong> (tab 🩺), không dùng bảng này làm căn cứ phun thuốc.
        </p>
      </div>

      {/* Bộ chọn cây + thị trường */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Loại cây</label>
            <select className="form-select" value={crop} onChange={e => setCrop(e.target.value)}>
              {CROPS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Thị trường xuất khẩu</label>
            <select className="form-select" value={market} onChange={e => setMarket(e.target.value)}>
              {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {/* Tính ngày an toàn */}
        <div className="form-group" style={{ marginTop: '14px' }}>
          <label>Ngày phun thuốc gần nhất (để tính ngày an toàn thu hoạch)</label>
          <input
            type="date"
            className="form-input"
            value={lastSprayDate}
            onChange={e => setLastSprayDate(e.target.value)}
          />
          {safeDate && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '10px 12px', borderRadius: '8px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarDays size={16} />
              An toàn thu hoạch sau ngày <strong>&nbsp;{safeDate}&nbsp;</strong> (cách ly {maxRei} ngày)
            </div>
          )}
        </div>
      </div>

      {/* Kết quả */}
      <div className="card">
        <div className="card-title" style={{ fontSize: '15px' }}>
          📋 Hoạt chất — {translateCrop(crop)} sang {MARKETS.find(m => m.value === market)?.label}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', padding: '10px 0' }}>
            <Loader2 size={18} className="spin" /> Đang tải dữ liệu quy định...
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
            Chưa có dữ liệu quy định cho {translateCrop(crop)} → thị trường này.
            <br /><span style={{ fontSize: '12px' }}>Quản trị viên có thể bổ sung qua bảng export_standards.</span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.some(s => s.requires_verification) && (
              <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', padding: '9px 12px', borderRadius: '10px', fontSize: '12px', color: '#e65100', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>Một số dữ liệu dưới đây <strong>đang chờ xác minh từ văn bản pháp lý gốc</strong> (đánh dấu 🔒). Chỉ dùng làm tham chiếu — kiểm tra với database chính thức trước khi xuất khẩu.</span>
              </div>
            )}
            {filtered.map((s, i) => {
              const meta = STATUS_META[s.status] || STATUS_META.restricted;
              return (
                <div key={i} style={{
                  border: `1px solid ${meta.bg}`,
                  background: meta.bg,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ fontSize: '20px', lineHeight: 1 }}>{meta.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px', color: meta.color }}>{s.chemical_name}</strong>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: 'white', background: meta.color,
                        padding: '3px 8px', borderRadius: '10px', letterSpacing: '0.3px'
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-primary)' }}>
                      MRL: <strong>{s.mrl_ppm < 0 ? 'Không cho phép' : `${s.mrl_ppm} ppm`}</strong>
                      {s.rei_days ? ` • Cách ly: ${s.rei_days} ngày` : ''}
                    </div>
                    {s.commodity_form && (
                      <div style={{ fontSize: '11px', marginTop: '3px', color: 'var(--text-secondary)' }}>
                        📦 Dạng sản phẩm: <strong>{FORM_LABELS[s.commodity_form] || s.commodity_form}</strong>
                      </div>
                    )}
                    {s.requires_verification && (
                      <div style={{ fontSize: '11px', marginTop: '3px', color: '#e65100', fontWeight: 600 }}>
                        🔒 Dữ liệu đang chờ xác minh từ văn bản pháp lý gốc
                      </div>
                    )}
                    {s.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>{s.notes}</div>}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', color: 'var(--text-primary)' }}
                          title="Bấm để chuyển trạng thái: Được phép → Hạn chế → Cấm"
                        >
                          🔄 Đổi trạng thái
                        </button>
                        <button
                          onClick={() => handleDeleteStandard(s.id)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: '1px solid #ffcdd2', background: '#ffebee', cursor: 'pointer', color: '#b71c1c' }}
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.some(s => s.status === 'banned') && (
              <div style={{ display: 'flex', gap: '8px', background: '#ffebee', border: '1px solid #ffcdd2', padding: '10px 12px', borderRadius: '10px', fontSize: '12px', color: '#b71c1c', alignItems: 'flex-start' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  <strong>Lưu ý:</strong> Dùng hoạt chất bị cấm có thể khiến <strong>cả lô hàng bị trả về</strong> và mất mã vùng trồng.
                  Ưu tiên chế phẩm sinh học. Nếu chưa chắc, hãy hỏi "Bác sĩ cây trồng AI".
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nguồn pháp lý (kèm nguồn đã xác minh) */}
      {marketReferences.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ fontSize: '15px' }}>
            <BookOpen size={18} /> 📚 Nguồn pháp lý áp dụng — {MARKETS.find(m => m.value === market)?.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {marketReferences.map(r => (
              <div key={r.id} style={{
                padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '10px',
                background: '#fafdfa', display: 'flex', gap: '10px', alignItems: 'flex-start'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {r.source_number} — {r.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', padding: '2px 7px', borderRadius: '8px', fontWeight: 600 }}>
                      {TYPE_LABELS[r.source_type] || r.source_type}
                    </span>
                    {r.legal_status && r.legal_status !== 'effective' && (
                      <span style={{ background: '#fff3e0', color: '#e65100', padding: '2px 7px', borderRadius: '8px', marginLeft: '6px', fontWeight: 600 }}>
                        {r.legal_status === 'amended' ? 'Đã sửa đổi' : r.legal_status === 'voluntary' ? 'Tự nguyện' : r.legal_status}
                      </span>
                    )}
                    {r.effective_date && <span> • Hiệu lực: {new Date(r.effective_date).toLocaleDateString('vi-VN')}</span>}
                  </div>
                  {r.notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{r.notes}</div>}
                  {r.verification_url && (
                    <a href={r.verification_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--primary-color)', display: 'inline-block', marginTop: '5px' }}>
                      🔗 Xem văn bản gốc
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: Thêm hoạt chất mới */}
      {isAdmin && (
        <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
          <div className="card-title" style={{ fontSize: '15px' }}>
            🛠️ Quản lý hoạt chất ({translateCrop(crop)} → {MARKETS.find(m => m.value === market)?.label})
          </div>
          {adminMsg && <div style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--text-primary)' }}>{adminMsg}</div>}
          <form onSubmit={handleAddStandard}>
            <div className="form-group">
              <label>Tên hoạt chất</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: Abamectin"
                value={newStandard.chemical_name}
                onChange={e => setNewStandard({ ...newStandard, chemical_name: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label>MRL (ppm, -1 = cấm)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="Ví dụ: 0.05"
                  value={newStandard.mrl_ppm}
                  onChange={e => setNewStandard({ ...newStandard, mrl_ppm: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>REI (ngày cách ly)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Ví dụ: 30"
                  value={newStandard.rei_days}
                  onChange={e => setNewStandard({ ...newStandard, rei_days: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Trạng thái</label>
              <select
                className="form-select"
                value={newStandard.status}
                onChange={e => setNewStandard({ ...newStandard, status: e.target.value })}
              >
                <option value="allowed">Được phép</option>
                <option value="restricted">Hạn chế (MRL thấp)</option>
                <option value="banned">Cấm tuyệt đối</option>
              </select>
            </div>
            <div className="form-group">
              <label>Ghi chú</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: Cấm theo GACC Trung Quốc"
                value={newStandard.notes}
                onChange={e => setNewStandard({ ...newStandard, notes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Đang thêm...' : '+ Thêm hoạt chất'}
            </button>
          </form>
        </div>
      )}

      {/* Ghi chú pháp lý */}
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 10px 8px', lineHeight: 1.5 }}>
        ⚖️ Dữ liệu MRL mang tính tham khảo cho cộng đồng nông hộ; quy định có thể thay đổi theo từng quốc gia.
        Luôn kiểm chứng với cơ quan chuyên môn / doanh nghiệp thu mua trước khi giao hàng.
      </div>
    </div>
  );
}
