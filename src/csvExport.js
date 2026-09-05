// Export CSV — tiện ích tải dữ liệu nông dân (nhật ký, sản lượng) ra file .csv
// Vừa là tính năng hữu ích, vừa là lưới an toàn dữ liệu cho người dùng.

// Chuyển mảng object → CSV (UTF-8 BOM để Excel mở đúng tiếng Việt)
export const toCSV = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  // Gom các key (theo thứ tự hàng đầu tiên + bổ sung key mới)
  const keys = [];
  rows.forEach((r) => {
    Object.keys(r || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); });
  });
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    // Nếu chứa dấu phẩy / nháy kép / xuống dòng → bọc nháy kép
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => esc(r[k])).join(','));
  return [header, ...lines].join('\n');
};

// Tải chuỗi CSV thành file tải xuống (kèm BOM cho UTF-8)
export const downloadCSV = (filename, csv) => {
  if (!csv) return;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Định dạng ngày YYYY-MM-DD → DD/MM/YYYY (dễ đọc trong CSV)
export const fmtDateCSV = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

// Nhãn tiếng Việt cho hoạt động & loại cây (tái dùng để xuất CSV)
export const CSV_ACTIVITY = {
  bon_phan: 'Bón phân', phun_thuoc: 'Phun thuốc', tuoi_nuoc: 'Tưới nước',
  cat_tia: 'Cắt tỉa cành', lam_co: 'Làm cỏ', thu_hoach: 'Thu hoạch', khac: 'Khác'
};
export const CSV_CROP = {
  sau_rieng: 'Sầu riêng', cafe: 'Cà phê', ho_tieu: 'Hồ tiêu'
};

// Nhãn cột cho từng loại dữ liệu
export const CSV_HEADERS = {
  logs: {
    'Ngày': 'Ngày', 'Loại hoạt động': 'Hoạt động', 'Cây trồng': 'Cây trồng',
    'Sản phẩm': 'Sản phẩm', 'Liều lượng': 'Liều lượng', 'Ghi chú': 'Ghi chú', 'Khu vực': 'Khu vực'
  },
  yields: {
    'Ngày thu hoạch': 'Ngày thu hoạch', 'Cây trồng': 'Cây trồng', 'Sản lượng (kg)': 'Sản lượng (kg)',
    'Phẩm cấp': 'Phẩm cấp', 'Doanh thu (đ)': 'Doanh thu (đ)', 'Ghi chú': 'Ghi chú'
  }
};
