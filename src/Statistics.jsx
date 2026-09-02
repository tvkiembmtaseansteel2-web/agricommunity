import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

// Thống kê sản lượng theo vùng (cho HTX/admin) + xuất CSV.
// Đơn giản, phù hợp nông dân: xem tổng sản lượng theo cây, theo tỉnh/huyện.

export default function Statistics({ isAdmin = false }) {
  const [rows, setRows] = useState([]); // join yields + profiles
  const [loading, setLoading] = useState(true);

  const CROP_LABELS = { sau_rieng: 'Sầu riêng', cafe: 'Cà phê', ho_tieu: 'Hồ tiêu' };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // Lấy nhật ký thu hoạch + tên/địa chỉ nông hộ
        const { data: yields, error } = await supabase.from('yields').select('*, profiles(full_name, address)');
        if (!error && active) setRows(yields || []);
      } catch (e) {
        console.warn('Không tải được thống kê:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ---- Tính toán ----
  const totalByCrop = rows.reduce((acc, r) => {
    const k = r.crop_type || 'khac';
    acc[k] = (acc[k] || 0) + Number(r.quantity_kg || 0);
    return acc;
  }, {});

  const totalByRegion = rows.reduce((acc, r) => {
    // Lấy huyện/tỉnh từ địa chỉ (phần cuối, tách bằng dấu phẩy)
    const addr = r.profiles?.address || 'Chưa rõ';
    const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
    const region = parts.length >= 2 ? parts[parts.length - 2] + ', ' + parts[parts.length - 1] : (parts[0] || 'Chưa rõ');
    acc[region] = (acc[region] || 0) + Number(r.quantity_kg || 0);
    return acc;
  }, {});

  const totalKg = rows.reduce((s, r) => s + Number(r.quantity_kg || 0), 0);

  // ---- Xuất CSV (tương thích Excel) ----
  const exportCsv = () => {
    const header = ['Cây trồng', 'Sản lượng (kg)', 'Chất lượng', 'Ngày thu hoạch', 'Nông hộ', 'Địa chỉ', 'Ghi chú'];
    const lines = rows.map(r => [
      CROP_LABELS[r.crop_type] || r.crop_type,
      r.quantity_kg,
      r.quality_grade || '',
      r.harvest_date || '',
      r.profiles?.full_name || '',
      r.profiles?.address || '',
      (r.notes || '').replace(/"/g, '""')
    ]);
    const csv = [header, ...lines].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    // Thêm BOM để Excel mở tiếng Việt đúng
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `san-luong-agricommunity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #4a148c, #6a1b9a)', color: 'white', border: 'none' }}>
        <div className="card-title" style={{ color: 'white' }}>
          <BarChart3 size={20} /> Thống kê sản lượng theo vùng
        </div>
        <p style={{ fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
          Tổng hợp nhật ký thu hoạch của cộng đồng — xem năng suất theo từng loại cây và khu vực, xuất báo cáo cho HTX.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <Loader2 size={18} className="spin" /> Đang tổng hợp dữ liệu...
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
          Chưa có dữ liệu thu hoạch nào được ghi nhận.
        </div>
      ) : (
        <>
          {/* Tổng quan */}
          <div className="card">
            <div className="card-title" style={{ fontSize: '15px' }}>📊 Tổng quan</div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-item">
                <div className="stat-val">{(totalKg / 1000).toFixed(1)} tấn</div>
                <div className="stat-lbl">Tổng sản lượng</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">{rows.length}</div>
                <div className="stat-lbl">Đợt thu hoạch</div>
              </div>
              <div className="stat-item">
                <div className="stat-val">{Object.keys(totalByRegion).length}</div>
                <div className="stat-lbl">Khu vực</div>
              </div>
            </div>
          </div>

          {/* Theo cây trồng */}
          <div className="card">
            <div className="card-title" style={{ fontSize: '15px' }}>🌱 Sản lượng theo cây trồng</div>
            {Object.entries(totalByCrop).map(([crop, kg]) => (
              <div key={crop} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <strong>{CROP_LABELS[crop] || crop}</strong>
                  <span>{(kg / 1000).toFixed(1)} tấn ({(kg / Math.max(totalKg, 1) * 100).toFixed(0)}%)</span>
                </div>
                <div style={{ background: 'var(--border-color)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${kg / Math.max(totalKg, 1) * 100}%`, background: 'var(--primary-color)', height: '100%', borderRadius: '6px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Theo vùng */}
          <div className="card">
            <div className="card-title" style={{ fontSize: '15px' }}>📍 Sản lượng theo khu vực</div>
            {Object.entries(totalByRegion).sort((a, b) => b[1] - a[1]).map(([region, kg]) => (
              <div key={region} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <strong>{region}</strong>
                  <span>{(kg / 1000).toFixed(1)} tấn</span>
                </div>
                <div style={{ background: 'var(--border-color)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${kg / Math.max(totalKg, 1) * 100}%`, background: 'var(--secondary-color)', height: '100%', borderRadius: '6px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Nút xuất báo cáo */}
          <button className="btn btn-primary" onClick={exportCsv}>
            <Download size={18} /> Xuất báo cáo CSV (mở được bằng Excel)
          </button>

          {!isAdmin && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Bạn chỉ thấy dữ liệu công khai. Admin/HTX xem được thêm chi tiết nông hộ khi đăng nhập quyền quản trị.
            </div>
          )}
        </>
      )}
    </div>
  );
}
