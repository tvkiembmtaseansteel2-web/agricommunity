import React from 'react';

// ErrorBoundary — chặn "trang trắng", hiện thông báo thân thiện + log chi tiết.
// Đồng thời giúp phát hiện chính xác component nào lỗi lúc runtime.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('❌ React ErrorBoundary bắt được lỗi:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#f7f9f6' }}>
          <div className="card" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌱</div>
            <h2 style={{ fontSize: '18px', color: 'var(--primary-dark)', marginBottom: '8px' }}>Ứng dụng gặp sự cố</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Đã có lỗi xảy ra khi hiển thị. Vui lòng tải lại trang.
            </p>
            {/* Chi tiết kỹ thuật để dev debug */}
            <div style={{ fontSize: '11px', color: '#b71c1c', background: '#ffebee', borderRadius: '8px', padding: '10px', textAlign: 'left', overflowX: 'auto', marginBottom: '12px' }}>
              <strong>Chi tiết lỗi:</strong><br />{this.state.error && this.state.error.message}<br /><br />
              <code style={{ fontSize: '10px' }}>{(this.state.error && this.state.error.stack || '').slice(0, 400)}</code>
            </div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              🔄 Tải lại
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
