import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Loader2, User } from 'lucide-react';
import { supabase } from './supabaseClient';

// Phân quyền người dùng (chỉ Admin V0 — toàn quyền).
// Liệt kê hồ sơ, cho phép gán farmer / admin_v1 / admin_v0.
const ROLES = [
  { value: 'farmer', label: '👨‍🌾 Nông dân', desc: 'Chức năng cơ bản' },
  { value: 'admin_v1', label: '🛡️ Admin V1', desc: 'Duyệt bài + xem thống kê' },
  { value: 'admin_v0', label: '👑 Admin V0', desc: 'Toàn quyền (KB, MRL, phân quyền)' }
];

export default function RoleManager({ currentRole, onRolesChanged }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingId, setSavingId] = useState(null);

  const reload = async () => {
    setLoading(true);
    // Chỉ admin V0 (RLS bảo vệ) xem được toàn bộ profiles. Chỉ lấy các cột cần thiết.
    const { data, error } = await supabase.from('profiles')
      .select('id, full_name, phone_number, user_role, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setUsers(data);
    if (error) setMsg('❌ ' + error.message);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const setRole = async (u, role) => {
    if (role === u.user_role) return;
    if (!window.confirm(`Đổi vai trò của ${u.full_name || u.phone_number} thành ${ROLES.find(r => r.value === role)?.label}?`)) return;
    setSavingId(u.id);
    setMsg('');
    // Cập nhật user_role (trigger sẽ đồng bộ is_admin). RLS: chỉ V0 được.
    const { error } = await supabase.from('profiles').update({ user_role: role }).eq('id', u.id);
    if (error) setMsg('❌ ' + error.message);
    else {
      setMsg(`✅ Đã đổi vai trò cho ${u.full_name || u.phone_number} → ${ROLES.find(r => r.value === role)?.label}`);
      reload();
      onRolesChanged?.();
    }
    setSavingId(null);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #4527a0, #5e35b1)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> Phân quyền người dùng (Admin V0)
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Chỉ <strong>Admin V0</strong> gán được vai trò. Vai trò quyết định quyền: Nông dân (cơ bản) →
          Admin V1 (duyệt bài + xem thống kê) → Admin V0 (toàn quyền: KB, MRL, phân quyền).
        </p>
      </div>

      {msg && <div style={{ fontSize: '13px', background: 'var(--primary-light)', padding: '10px 12px', borderRadius: '8px', color: 'var(--primary-dark)' }}>{msg}</div>}

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👥 Danh sách tài khoản ({users.length})</span>
          <button onClick={reload} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
            <RefreshCw size={14} /> Tải lại
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', padding: '12px' }}>
            <Loader2 size={18} className="spin" /> Đang tải...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            Không có tài khoản hoặc bạn không có quyền xem.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map(u => (
              <div key={u.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '0' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(u.full_name || u.phone_number || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {u.full_name || (u.phone_number ? 'SĐT ' + u.phone_number : '(không tên)')}
                      {u.id === currentRole ? '' : ''}
                    </div>
                    {u.phone_number && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.phone_number}</div>}
                  </div>
                </div>
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: '150px', fontSize: '13px', padding: '8px' }}
                  value={u.user_role || 'farmer'}
                  disabled={savingId === u.id}
                  onChange={(e) => setRole(u, e.target.value)}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
