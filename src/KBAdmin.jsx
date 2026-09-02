import React, { useState, useEffect } from 'react';
import { Database, ListChecks, Plus, CheckCircle2, BookOpen, Loader2, Trash2, Eye } from 'lucide-react';
import { supabase } from './supabaseClient';

// KB Admin — Quản trị Tri thức & luồng duyệt (PRD Mục 4)
// Tab 1: Hàng đợi duyệt (raw_articles) → Editor gán cấu trúc → Expert Approve → Published
// Tab 2: Tri thức đã duyệt (kb_entries)
// Tab 3: Thêm mục mới (form nhập cấu trúc chuẩn)

const PLANTS = [
  { value: 'cafe', label: '☕ Cà phê' },
  { value: 'sau_rieng', label: '🌳 Sầu riêng' },
  { value: 'ho_tieu', label: '🌿 Hồ tiêu' }
];
const CATEGORIES = [
  { value: 'benh_hat', label: 'Bệnh hại' },
  { value: 'sau_hat', label: 'Sâu hại' },
  { value: 'dinh_duong', label: 'Dinh dưỡng' },
  { value: 'dat', label: 'Quản lý đất' }
];
const PARTS = ['lá', 'quả', 'thân', 'cành', 'rễ', 'toàn thân'].map(v => ({ value: v, label: v }));

const emptyForm = {
  plant_type: 'cafe', category: 'benh_hat', target_part: 'la',
  problem_name: '', scientific_name: '', agents: '',
  symptoms_description: '', severity_levels: 'Trung bình',
  farming_method: '', biological_method: '',
  active_ingredients_text: '', dosage_notes: '', source_url: ''
};

export default function KBAdmin({ isAdmin = false, onPostPublished }) {
  const [tab, setTab] = useState('queue');
  const [entries, setEntries] = useState([]);
  const [raws, setRaws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const [e, r] = await Promise.all([
        supabase.from('kb_entries').select('*').order('id', { ascending: false }).limit(30),
        supabase.from('raw_articles').select('*').order('created_at', { ascending: false }).limit(20)
      ]);
      if (e.data) setEntries(e.data);
      if (r.data) setRaws(r.data);
    } catch (err) { console.warn('Lỗi tải KB:', err); }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  // ---- Thêm mục KB mới (cấu trúc chuẩn PRD) ----
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.problem_name.trim()) { setMsg('⚠️ Cần nhập tên bệnh/vấn đề.'); return; }
    setSaving(true);
    setMsg('');
    const ingredients = form.active_ingredients_text
      .split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from('kb_entries').insert([{
      plant_type: form.plant_type,
      category: form.category,
      target_part: form.target_part,
      problem_name: form.problem_name.trim(),
      scientific_name: form.scientific_name.trim() || null,
      agents: form.agents.trim() || null,
      symptoms_description: form.symptoms_description.trim() || null,
      severity_levels: form.severity_levels,
      farming_method: form.farming_method.trim() || null,
      biological_method: form.biological_method.trim() || null,
      active_ingredients: ingredients,
      dosage_notes: form.dosage_notes.trim() || null,
      source_url: form.source_url.trim() || null,
      status: 'published',
      verified_by: null
    }]);
    setSaving(false);
    if (error) setMsg('❌ ' + error.message);
    else {
      setMsg('✅ Đã thêm mục tri thức (published).');
      setForm(emptyForm);
      reload();
    }
  };

  // Bóc tách raw_content → cấu trúc kb_entries chuẩn (PRD Mục 2) — tự động khi duyệt
  const rawToKbEntry = (raw) => {
    // Xác định plant_type từ matched_keywords
    const kw = (raw.matched_keywords || []).join(' ').toLowerCase();
    const plant_type =
      kw.includes('sầu') || kw.includes('sau rieng') || kw.includes('sầu riêng') ? 'sau_rieng' :
      kw.includes('cà phê') || kw.includes('cafe') || kw.includes('ca phe') ? 'cafe' :
      kw.includes('tiêu') || kw.includes('tieu') || kw.includes('hồ tiêu') ? 'ho_tieu' : null;
    // Đoán category dựa trên từ khóa bệnh/dinh dưỡng
    const text = (raw.title + ' ' + (raw.raw_content || '')).toLowerCase();
    const category =
      /bệnh|nấm|phytophthora|rỉ sắt|thán thư|tuyến trùng|sâu|virus|vi khuẩn/.test(text) ? 'benh_hat' :
      /phân bón|kali|đạm|lân|dinh dưỡng|thu hoạch|năng suất/.test(text) ? 'dinh_duong' :
      /đất|ph|vôi|độ phì/.test(text) ? 'dat' : 'sau_hat';

    return {
      plant_type: plant_type || 'cafe',
      category,
      target_part: 'toan_than',
      problem_name: raw.title || 'Bài viết nông nghiệp',
      scientific_name: null,
      agents: null,
      symptoms_description: raw.raw_content || null,
      severity_levels: null,
      farming_method: null,
      biological_method: null,
      active_ingredients: [], // crawler chưa bóc tách được hoạt chất — để admin bổ sung sau
      dosage_notes: null,
      source_url: raw.source_url || null,
      source_name: raw.source_name || null,
      status: 'published',
      verified_by: null
    };
  };

  // Duyệt raw article → Published + tạo kb_entries + tự đăng cộng đồng
  const approveRaw = async (raw, silent = false) => {
    if (!silent && !window.confirm('Phê duyệt? Bài sẽ: ① thành tri thức KB ② đăng lên cộng đồng (kèm nguồn).')) return;
    const uid = (await supabase.auth.getUser())?.data?.user?.id;

    // 1. Tạo bản ghi tri thức chuẩn hóa (kb_entries) — để sau này truy vấn
    const kb = rawToKbEntry(raw);
    const { error: kbErr } = await supabase.from('kb_entries').insert([kb]);

    // 2. Chuyển raw_article thành published
    const { error } = await supabase.from('raw_articles').update({
      status: 'published',
      reviewer_id: uid
    }).eq('id', raw.id);
    if (error) { setMsg('❌ ' + error.message); return; }

    // 3. Đăng lên cộng đồng (posts, approved) — nội dung chính + link + nguồn
    const postContent = `📌 ${raw.title}

${raw.raw_content || ''}

${
  raw.source_url
    ? `\n🔗 Nguồn chính thống: ${raw.source_name || 'nguồn'} — ${raw.source_url}`
    : ''
}`;
    const { error: postErr } = await supabase.from('posts').insert([{
      profile_id: uid,
      author_name: '📚 Kiến thức từ ' + (raw.source_name || 'nguồn chính thống'),
      content: postContent,
      image_url: null,
      status: 'approved',
      flagged_chemical: null
    }]);

    if (kbErr) console.warn('⚠️ Chưa tạo được kb_entries:', kbErr.message);
    if (postErr) console.warn('⚠️ Chưa tạo được bài cộng đồng:', postErr.message);

    if (!silent) {
      setMsg(kbErr || postErr
        ? '⚠️ Đã duyệt nhưng có lỗi: ' + (kbErr?.message || postErr?.message)
        : '✅ Đã phê duyệt + thêm KB + đăng cộng đồng: ' + raw.title);
      if (onPostPublished) onPostPublished();
    }
    return { kbErr, postErr };
  };

  // Phê duyệt TẤT CẢ draft
  const approveAll = async () => {
    const drafts = raws.filter(r => r.status === 'draft');
    if (drafts.length === 0) { setMsg('Không còn bài draft.'); return; }
    if (!window.confirm(`Phê duyệt tất cả ${drafts.length} bài? Mỗi bài sẽ: ① thành KB ② đăng cộng đồng.`)) return;
    setSaving(true);
    let okCount = 0, errCount = 0;
    for (const raw of drafts) {
      const res = await approveRaw(raw, true);
      if (!res?.kbErr && !res?.postErr) okCount++;
      else errCount++;
    }
    setSaving(false);
    setMsg(`✅ Đã phê duyệt ${okCount} bài (KB + cộng đồng)${errCount ? `, ${errCount} bài có lỗi` : ''}.`);
    if (onPostPublished) onPostPublished();
    reload();
  };

  const rejectRaw = async (raw) => {
    if (!window.confirm('Từ chối bài này?')) return;
    await supabase.from('raw_articles').update({ status: 'rejected' }).eq('id', raw.id);
    reload();
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Xóa mục tri thức này?')) return;
    await supabase.from('kb_entries').delete().eq('id', id);
    reload();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white' }}>
          <Database size={20} /> Quản trị Tri thức (KB)
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Nguồn dữ liệu chuẩn hóa cho AI chẩn đoán & tra cứu. Dữ liệu publish mới được app dùng.
        </p>
      </div>

      {/* Tab menu */}
      <div style={{ display: 'flex', background: 'var(--primary-light)', borderRadius: '12px', padding: '4px', overflowX: 'auto' }}>
        {[
          { key: 'queue', label: `📥 Hàng đợi (${raws.filter(r => r.status === 'draft').length})` },
          { key: 'entries', label: '📚 Tri thức' },
          { key: 'add', label: '➕ Thêm mục' }
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(''); }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap',
              background: tab === t.key ? 'white' : 'transparent',
              color: tab === t.key ? 'var(--primary-dark)' : 'var(--text-secondary)',
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}>{t.label}</button>
        ))}
      </div>

      {msg && <div style={{ fontSize: '12px', color: 'var(--text-primary)', background: 'var(--primary-light)', padding: '10px 12px', borderRadius: '8px' }}>{msg}</div>}

      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Loader2 size={18} className="spin" /> Đang tải...
        </div>
      ) : tab === 'queue' ? (
        <>
          <div className="card">
            <div className="card-title" style={{ fontSize: '15px', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ListChecks size={18} /> Hàng đợi duyệt (bài thô từ nguồn)</span>
              {raws.filter(r => r.status === 'draft').length > 0 && (
                <button
                  onClick={approveAll}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ padding: '8px 12px', fontSize: '12px', width: 'auto' }}
                >
                  {saving ? 'Đang duyệt...' : `✅ Phê duyệt tất cả (${raws.filter(r => r.status === 'draft').length})`}
                </button>
              )}
            </div>
            {raws.filter(r => r.status !== 'rejected').length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
                Chưa có bài thô. (Khi crawler/nguồn chạy, bài sẽ vào đây ở trạng thái <strong>Draft</strong>.)
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {raws.filter(r => r.status !== 'rejected').map(r => (
                  <div key={r.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{r.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                      {r.source_name || 'Nguồn'} • {new Date(r.created_at).toLocaleString('vi-VN')} • <span style={{ background: '#fff3e0', padding: '2px 7px', borderRadius: '8px', fontWeight: 600 }}>{r.status}</span>
                    </div>
                    {r.raw_content && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxHeight: '60px', overflow: 'hidden' }}>{r.raw_content}</div>}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px', background: 'var(--success-color)' }} onClick={() => approveRaw(r)}>
                        <CheckCircle2 size={14} /> Phê duyệt (Expert)
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={() => rejectRaw(r)}>Từ chối</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : tab === 'entries' ? (
        <div className="card">
          <div className="card-title" style={{ fontSize: '15px' }}><BookOpen size={18} /> Tri thức đã duyệt ({entries.length})</div>
          {entries.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>Chưa có mục tri thức.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {entries.map(el => (
                <div key={el.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{el.problem_name}{el.scientific_name ? ` (${el.scientific_name})` : ''}</div>
                    <button onClick={() => deleteEntry(el.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Xóa"><Trash2 size={15} /></button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                    [{el.plant_type}/{el.category}/{el.target_part}] • {el.severity_levels}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    🧪 Hoạt chất: <strong>{(el.active_ingredients || []).join(', ') || 'N/A'}</strong>
                  </div>
                  {el.dosage_notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Lưu ý: {el.dosage_notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-title" style={{ fontSize: '15px' }}><Plus size={18} /> Thêm mục tri thức (cấu trúc chuẩn PRD)</div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group"><label>Cây</label>
                <select className="form-select" value={form.plant_type} onChange={e => setForm({ ...form, plant_type: e.target.value })}>
                  {PLANTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select></div>
              <div className="form-group"><label>Loại</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group"><label>Bộ phận</label>
                <select className="form-select" value={form.target_part} onChange={e => setForm({ ...form, target_part: e.target.value })}>
                  {PARTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select></div>
              <div className="form-group"><label>Mức độ</label>
                <select className="form-select" value={form.severity_levels} onChange={e => setForm({ ...form, severity_levels: e.target.value })}>
                  <option>Nhẹ</option><option>Trung bình</option><option>Nặng</option>
                </select></div>
            </div>
            <div className="form-group"><label>Tên phổ thông *</label>
              <input type="text" className="form-input" placeholder="Vd: Thán thư" value={form.problem_name} onChange={e => setForm({ ...form, problem_name: e.target.value })} required /></div>
            <div className="form-group"><label>Tên khoa học</label>
              <input type="text" className="form-input" placeholder="Vd: Colletotrichum gloeosporioides" value={form.scientific_name} onChange={e => setForm({ ...form, scientific_name: e.target.value })} /></div>
            <div className="form-group"><label>Tác nhân</label>
              <input type="text" className="form-input" placeholder="Vd: Nấm, Tuyến trùng, Thiếu Kali" value={form.agents} onChange={e => setForm({ ...form, agents: e.target.value })} /></div>
            <div className="form-group"><label>Triệu chứng (mô tả)</label>
              <textarea className="form-textarea" placeholder="Mô tả chi tiết triệu chứng..." value={form.symptoms_description} onChange={e => setForm({ ...form, symptoms_description: e.target.value })} /></div>
            <div className="form-group"><label>Biện pháp canh tác</label>
              <input type="text" className="form-input" placeholder="Vd: Tỉa cành, thoát nước, bón vôi" value={form.farming_method} onChange={e => setForm({ ...form, farming_method: e.target.value })} /></div>
            <div className="form-group"><label>Biện pháp sinh học</label>
              <input type="text" className="form-input" placeholder="Vd: Nấm đối kháng, thiên địch" value={form.biological_method} onChange={e => setForm({ ...form, biological_method: e.target.value })} /></div>
            <div className="form-group"><label>Hoạt chất (tách riêng — mỗi chất cách nhau dấu phẩy)</label>
              <input type="text" className="form-input" placeholder="Vd: Metalaxyl, Phosphonate" value={form.active_ingredients_text} onChange={e => setForm({ ...form, active_ingredients_text: e.target.value })} />
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>🧪 Trường này tách riêng để map với danh mục thuốc BVTV.</div></div>
            <div className="form-group"><label>Lưu ý dùng (liều, PHI)</label>
              <input type="text" className="form-input" placeholder="Vd: Phun lá, cách ly 7-14 ngày" value={form.dosage_notes} onChange={e => setForm({ ...form, dosage_notes: e.target.value })} /></div>
            <div className="form-group"><label>Nguồn (URL)</label>
              <input type="text" className="form-input" placeholder="https://..." value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Thêm mục (published)'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
