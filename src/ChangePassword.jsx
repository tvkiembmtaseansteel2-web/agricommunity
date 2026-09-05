import React, { useState } from 'react';
import { KeyRound, CheckCircle2, Loader2, Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from './supabaseClient';
import { isBiometricSupported, verifyBiometric } from './biometric';

// Đổi mật khẩu — DÙNG SESSION HIỆN TẠI (không cần mật khẩu cũ).
// Vì nông dân đã đăng nhập, session là bằng chứng xác thực → đổi mật khẩu mới trực tiếp.
// Thêm nút "Xác nhận bằng vân tay/khuôn mặt" (WebAuthn) làm lớp bảo mật bổ sung nếu thiết bị hỗ trợ.
export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioStep, setBioStep] = useState(false); // đang chờ xác thực sinh trắc học

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (newPassword.length < 6) { setError('Mật khẩu mới cần ít nhất 6 ký tự.'); return; }
    if (newPassword !== confirmPassword) { setError('Xác nhận mật khẩu chưa khớp.'); return; }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updErr) setError('Không đổi được: ' + (updErr.message || 'vui lòng thử lại'));
    else {
      setMsg('✅ Đã đổi mật khẩu thành công!');
      setNewPassword(''); setConfirmPassword('');
    }
  };

  // Xác nhận bằng vân tay/khuôn mặt (WebAuthn) — chứng minh chủ máy rồi mới cho nhập mật khẩu mới
  const handleBiometric = async () => {
    setError(''); setMsg('');
    if (!isBiometricSupported()) { setError('Thiết bị không hỗ trợ vân tay/khuôn mặt. Bạn có thể nhập mật khẩu mới trực tiếp.'); return; }
    setBioStep(true);
    const res = await verifyBiometric();
    setBioStep(false);
    if (res.ok) {
      setMsg('🔓 Xác thực thành công! Giờ bạn có thể nhập mật khẩu mới bên dưới.');
    } else {
      setError('Chưa xác thực được vân tay/khuôn mặt. Bạn có thể hủy và nhập mật khẩu mới trực tiếp.');
    }
  };

  const inputStyle = {
    width: '100%', padding: '14px 14px 14px 42px', borderRadius: '12px',
    border: '1px solid var(--border-color)', fontSize: '16px', color: 'var(--text-primary)',
    background: '#fafdfa', outline: 'none'
  };
  const iconStyle = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #2e7d32, #43a047)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} /> Đổi mật khẩu
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Vì bạn đang đăng nhập, chỉ cần nhập <strong>mật khẩu mới</strong> — không cần mật khẩu cũ.
          Nếu muốn an toàn hơn, bạn có thể <strong>xác nhận bằng vân tay/khuôn mặt</strong> trước khi đổi.
        </p>
      </div>

      {msg && <div style={{ fontSize: '13px', background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#1b5e20', padding: '10px 12px', borderRadius: '8px' }}>{msg}</div>}
      {error && <div style={{ fontSize: '13px', background: '#ffebee', border: '1px solid #ffcdd2', color: '#b71c1c', padding: '10px 12px', borderRadius: '8px' }}>⚠️ {error}</div>}

      {/* Nút xác nhận sinh trắc học (lớp bảo mật bổ sung) */}
      {isBiometricSupported() && (
        <div className="card">
          <button
            className="btn btn-secondary"
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={handleBiometric}
            disabled={bioStep}
          >
            {bioStep ? <Loader2 size={18} className="spin" /> : <Fingerprint size={20} color="#2e7d32" />}
            {bioStep ? 'Đang chờ vân tay/khuôn mặt...' : '🔒 Xác nhận bằng vân tay/khuôn mặt để đổi mật khẩu'}
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '6px' }}>
            <ShieldCheck size={12} /> Thông tin sinh trắc học chỉ lưu trên thiết bị, không gửi lên máy chủ.
          </div>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="form-group">
          <label>Mật khẩu mới</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={iconStyle} />
            <input type="password" style={inputStyle} placeholder="Ít nhất 6 ký tự" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Xác nhận mật khẩu mới</label>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={iconStyle} />
            <input type="password" style={inputStyle} placeholder="Nhập lại mật khẩu mới" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
          {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
