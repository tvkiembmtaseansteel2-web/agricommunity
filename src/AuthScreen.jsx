import React, { useState } from 'react';
import { Smartphone, Lock, User as UserIcon, LogIn, UserPlus, ShieldAlert, Check, Eye, EyeOff } from 'lucide-react';
import { supabase, IS_MOCK } from './supabaseClient';

// Màn hình Đăng nhập / Đăng ký — đơn giản cho nông dân:
// - Đăng nhập bằng SĐT + mật khẩu
// - Đăng ký kèm cam kết bảo mật dữ liệu (Nghị định 13/2023/NĐ-CP)
// - Chế độ Mock: SĐT demo 0912345678 (nông dân) / 0900000000 (admin)

const DEMO_ACCOUNTS = [
  { phone: '0912345678', label: 'Nông dân mẫu' },
  { phone: '0900000000', label: 'Admin mẫu' }
];

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Supabase thật dùng email; ta ánh xạ SĐT → email nội bộ để không cần cấu hình SMS
  const toEmail = (p) => IS_MOCK ? p : `${p}@agri.vn`;

  const validate = () => {
    const phoneOk = /^0\d{9}$/.test(phone);
    if (!phoneOk) return 'Số điện thoại chưa đúng (10 số, bắt đầu bằng 0).';
    if (password.length < 6) return 'Mật khẩu cần ít nhất 6 ký tự.';
    if (mode === 'register') {
      if (!fullName.trim()) return 'Vui lòng nhập họ tên.';
      if (password !== confirmPassword) return 'Xác nhận mật khẩu chưa khớp.';
      if (!consent) return 'Bạn cần đồng ý cam kết bảo mật thông tin để đăng ký.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const invalid = validate();
    if (invalid) { setError(invalid); return; }

    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await supabase.auth.signInWithPassword({
          email: toEmail(phone),
          password
        });
      } else {
        result = await supabase.auth.signUp({
          email: toEmail(phone),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone_number: phone,
              consent_granted: consent
            }
          }
        });
      }

      const { data, error: authError } = result;
      if (authError) {
        // Đã đăng ký nhưng cần xác nhận email (chế độ thật) → vẫn chuyển qua đăng nhập
        if (mode === 'register' && !IS_MOCK && authError.message?.toLowerCase().includes('email')) {
          setMode('login');
          setError('Tài khoản đã tạo. Vui lòng đăng nhập (kiểm tra email xác nhận nếu có).');
        } else {
          setError(authError.message || 'Đã có lỗi xảy ra, vui lòng thử lại.');
        }
        return;
      }

      if (data?.user) {
        // Mock / đăng ký tự đăng nhập luôn
        onAuthSuccess(data.user);
      } else if (data?.session === null) {
        // Supabase thật: yêu cầu xác nhận email
        setMode('login');
        setError('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận, sau đó đăng nhập.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối mạng hoặc máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Đăng nhập nhanh tài khoản demo (chỉ chế độ Mock)
  const handleDemoLogin = async (demoPhone) => {
    setError('');
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: toEmail(demoPhone),
      password: 'demo123456'
    });
    setLoading(false);
    if (authError) setError(authError.message);
    else if (data?.user) onAuthSuccess(data.user);
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 14px 14px 42px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    fontSize: '16px',
    color: 'var(--text-primary)',
    background: '#fafdfa',
    outline: 'none'
  };

  const iconStyle = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Logo & Slogan */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '56px', marginBottom: '8px' }}>🌱</div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--primary-dark)' }}>AgriCommunity</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Nhật ký nông vụ • Bác sĩ cây trồng AI • Xuất khẩu an toàn
        </p>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        {/* Tab chuyển chế độ */}
        <div style={{ display: 'flex', background: 'var(--primary-light)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              background: mode === 'login' ? 'white' : 'transparent',
              color: mode === 'login' ? 'var(--primary-dark)' : 'var(--text-secondary)',
              boxShadow: mode === 'login' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              background: mode === 'register' ? 'white' : 'transparent',
              color: mode === 'register' ? 'var(--primary-dark)' : 'var(--text-secondary)',
              boxShadow: mode === 'register' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Tạo tài khoản
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Họ và tên</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={iconStyle} />
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Ví dụ: Nguyễn Văn Năm"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Số điện thoại</label>
            <div style={{ position: 'relative' }}>
              <Smartphone size={18} style={iconStyle} />
              <input
                type="tel"
                inputMode="numeric"
                style={inputStyle}
                placeholder="09xxxxxxxx"
                maxLength={10}
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={iconStyle} />
              <input
                type={showPassword ? 'text' : 'password'}
                style={{ ...inputStyle, paddingRight: '44px' }}
                placeholder={mode === 'register' ? 'Ít nhất 6 ký tự' : 'Nhập mật khẩu'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Hiện/ẩn mật khẩu"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div className="form-group">
                <label>Xác nhận mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={iconStyle} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={inputStyle}
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Cam kết bảo mật (Nghị định 13) */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  Tôi đồng ý cung cấp thông tin để phục vụ quản lý nông vụ và kết nối thị trường,
                  theo cam kết bảo mật dữ liệu (<strong>Nghị định 13/2023/NĐ-CP</strong>).
                </span>
              </label>
            </>
          )}

          {error && (
            <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b71c1c', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', marginBottom: '14px' }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Đang xử lý...' : mode === 'login' ? (<><LogIn size={18} /> Đăng nhập</>) : (<><UserPlus size={18} /> Tạo tài khoản</>)}
          </button>
        </form>

        {/* Nút demo nhanh (chỉ Mock) */}
        {IS_MOCK && (
          <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '8px' }}>
              🔑 Chế độ demo — bấm để vào nhanh:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DEMO_ACCOUNTS.map(a => (
                <button
                  key={a.phone}
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px', fontSize: '12px' }}
                  onClick={() => handleDemoLogin(a.phone)}
                  disabled={loading}
                >
                  {a.label} ({a.phone})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '18px', textAlign: 'center' }}>
        <ShieldAlert size={14} color="#e65100" />
        Thông tin của bạn được bảo mật theo quy định pháp luật Việt Nam
      </div>
    </div>
  );
}
