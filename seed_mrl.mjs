// ============================================================
// Seed MRL dữ liệu — nạp qua Management API (quyền admin).
// EU Pesticides Database KHÔNG có public API, nên dữ liệu MRL chính thức
// cần được nhập từ văn bản gốc (EU Reg 396/2005, GB 2763-2026, EPA, MAFF).
// Mọi dòng đều gắn requires_verification=true cho tới khi xác minh từ nguồn chính thức.
//
// Chạy:  $env:SB_PAT='...'; node seed_mrl.mjs
// ============================================================

import { readFileSync } from 'fs';

const PAT = process.env.SB_PAT;
const REF = process.env.SB_REF || 'gjavupiyrnuwtersagnw';
if (!PAT) { console.error('Thiếu SB_PAT. Thiết lập: $env:SB_PAT="sbp_..."'); process.exit(1); }

// ⇒ DÁN DỮ LIỆU ĐÃ XÁC MINH VÀO ĐÂY (từ văn bản gốc).
//   Cần xác minh từ văn bản gốc trước khi coi là chính thức.
const seedData = [
  { crop_type: 'sau_rieng', commodity_form: 'fresh', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'EU cấm. Nhạy cảm — EU tăng kiểm tra ngẫu nhiên với sầu riêng VN.', requires_verification: true },
  { crop_type: 'sau_rieng', commodity_form: 'fresh', market: 'EU', chemical_name: 'Carbendazim', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Không có MRL cho phép → xem như cấm.', requires_verification: true },
  { crop_type: 'sau_rieng', commodity_form: 'fresh', market: 'China', chemical_name: 'Carbendazim', mrl_ppm: 0.5, status: 'restricted', rei_days: 21, notes: 'GB 2763-2026. Giới hạn chặt, ưu tiên sinh học.', requires_verification: true },
  { crop_type: 'sau_rieng', commodity_form: 'fresh', market: 'China', chemical_name: 'Dimethoate', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Cấm — thuốc trừ sâu độc cao.', requires_verification: true },
  { crop_type: 'sau_rieng', commodity_form: 'fresh', market: 'EU', chemical_name: 'Methiocarb', mrl_ppm: 0.2, status: 'restricted', rei_days: null, notes: 'EU MRL durian (cần xác minh lại từ văn bản gốc).', requires_verification: true },

  { crop_type: 'cafe', commodity_form: 'green_bean', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'EU cấm toàn cầu từ 2020.', requires_verification: true },
  { crop_type: 'cafe', commodity_form: 'green_bean', market: 'EU', chemical_name: 'Glyphosate', mrl_ppm: 0.1, status: 'restricted', rei_days: 45, notes: 'EU kiểm soát nghiêm ngặt thuốc trừ cỏ.', requires_verification: true },
  { crop_type: 'cafe', commodity_form: 'green_bean', market: 'EU', chemical_name: 'Hexaconazole', mrl_ppm: 0.01, status: 'restricted', rei_days: 30, notes: 'Trị rỉ sắt nhưng MRL rất thấp.', requires_verification: true },
  { crop_type: 'cafe', commodity_form: 'roasted', market: 'EU', chemical_name: 'Ochratoxin A', mrl_ppm: 0.005, status: 'restricted', rei_days: null, notes: 'Mycotoxin EU 2023/915 cho cà phê rang (~5 µg/kg).', requires_verification: true },

  { crop_type: 'ho_tieu', commodity_form: 'dried', market: 'EU', chemical_name: 'Metalaxyl', mrl_ppm: 0.05, status: 'restricted', rei_days: 30, notes: 'Trị nấm nhưng MRL thấp.', requires_verification: true },
  { crop_type: 'ho_tieu', commodity_form: 'dried', market: 'EU', chemical_name: 'Carbendazim', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Cấm.', requires_verification: true },
  { crop_type: 'ho_tieu', commodity_form: 'dried', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Cấm.', requires_verification: true },
  { crop_type: 'ho_tieu', commodity_form: 'dried', market: 'EU', chemical_name: 'Ochratoxin A', mrl_ppm: 0.01, status: 'restricted', rei_days: null, notes: 'Mycotoxin EU 2023/915 cho tiêu khô (~10 µg/kg).', requires_verification: true }
];

// Nhóm thành các INSERT nhiều dòng + ON CONFLICT (4 cột) DO UPDATE
const valuesSql = seedData.map(r => {
  const notes = (r.notes || '').replace(/'/g, "''");
  return `('${r.crop_type}','${r.commodity_form}','${r.market}','${r.chemical_name}',${r.mrl_ppm},'${r.status}',${r.rei_days === null ? 'NULL' : r.rei_days},'${notes}', true)`;
}).join(',\n');

const upsertSql = `
INSERT INTO public.export_standards (crop_type, commodity_form, market, chemical_name, mrl_ppm, status, rei_days, notes, requires_verification)
VALUES
${valuesSql}
ON CONFLICT (crop_type, market, chemical_name, commodity_form) DO UPDATE SET
  mrl_ppm = EXCLUDED.mrl_ppm,
  status = EXCLUDED.status,
  rei_days = EXCLUDED.rei_days,
  notes = EXCLUDED.notes,
  requires_verification = EXCLUDED.requires_verification;
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: upsertSql })
});
const text = await res.text();
if (res.ok) {
  console.log('✅ Đã nạp', seedData.length, 'dòng MRL (gắn cờ requires_verification=true).');
} else {
  console.log('❌ HTTP', res.status, text.slice(0, 500));
  process.exit(1);
}
