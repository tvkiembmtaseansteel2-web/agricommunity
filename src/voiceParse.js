// Bóc tách dữ liệu nhật ký từ câu nói tự nhiên bằng Gemini.
// Ví dụ: "Hôm nay tôi bón 2 ký NPK cho 50 cây sầu riêng khu A"
//   → { crop_type:'sau_rieng', activity_type:'bon_phan', product_name:'NPK', dosage:'2 kg', area:'khu A', plant_count:50 }
// Gọi qua Edge Function `gemini-proxy` (server giữ key).
import { supabase, IS_MOCK } from './supabaseClient';

const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite';
const hasRealAi = () => !!GEMINI_API_KEY && !IS_MOCK;

// Map tiếng Việt → enum
const ACTIVITY_MAP = {
  'bón phân': 'bon_phan', 'bón': 'bon_phan', 'phân bón': 'bon_phan', 'bón phân': 'bon_phan',
  'phun thuốc': 'phun_thuoc', 'phun': 'phun_thuoc', 'thuốc': 'phun_thuoc',
  'tưới': 'tuoi_nuoc', 'tưới nước': 'tuoi_nuoc',
  'tỉa': 'cat_tia', 'cắt tỉa': 'cat_tia', 'tỉa cành': 'cat_tia',
  'thu hoạch': 'thu_hoach',
  'kiểm tra': 'kiem_tra', 'thăm vườn': 'kiem_tra'
};
const CROP_MAP = {
  'sầu riêng': 'sau_rieng', 'sầu': 'sau_rieng', 'sau rieng': 'sau_rieng',
  'cà phê': 'cafe', 'cafe': 'cafe', 'ca phe': 'cafe',
  'tiêu': 'ho_tieu', 'hồ tiêu': 'ho_tieu', 'ho tieu': 'ho_tieu'
};

// Parse cục bộ (offline, dùng map) — fallback khi không có API key
export const parseLocally = (text) => {
  const t = (text || '').toLowerCase();
  const result = { raw: text };

  // Cây trồng
  for (const [kw, crop] of Object.entries(CROP_MAP)) {
    if (t.includes(kw)) { result.crop_type = crop; break; }
  }
  // Hoạt động
  for (const [kw, act] of Object.entries(ACTIVITY_MAP)) {
    if (t.includes(kw)) { result.activity_type = act; break; }
  }
  // Liều lượng: số + kg/g/ml/lít/phần
  const dosageMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|lit|lit|lít|l)\b/);
  if (dosageMatch) result.dosage = `${dosageMatch[1]} ${dosageMatch[2]}`;
  // Số cây
  const countMatch = t.match(/(\d+)\s*cây|cây\s*(\d+)/);
  if (countMatch) result.plant_count = parseInt(countMatch[1] || countMatch[2], 10);
  // Khu vực
  const areaMatch = t.match(/khu\s*([a-z0-9]+)/i);
  if (areaMatch) result.area = 'Khu ' + areaMatch[1].toUpperCase();
  // Sản phẩm thường đứng sau "bón/phun" + danh từ — lấy đoạn sau động từ
  const productMatch = t.match(/(?:bón|phun|dùng)\s+([a-z0-9\s\-\.\+]+?)(?:\s+\d|\s*cho|\s*khu|$)/i);
  if (productMatch && productMatch[1].trim()) result.product_name = productMatch[1].trim();

  return result;
};

// Bóc tách qua Gemini (chính xác hơn — hiểu ngữ cảnh)
export const parseVoice = async (text) => {
  if (!hasRealAi()) {
    // offline: parse cục bộ + delay nhẹ cho thật
    await new Promise(r => setTimeout(r, 500));
    return parseLocally(text);
  }
  try {
    const prompt = `
Bạn là trợ lý nhật ký nông nghiệp. Đọc câu nói của nông dân về hoạt động chăm sóc vườn và trích xuất dữ liệu.
Trả về JSON thuần (không markdown):
{
  "crop_type": "sau_rieng" | "cafe" | "ho_tieu" | null,
  "activity_type": "bon_phan" | "phun_thuoc" | "tuoi_nuoc" | "cat_tia" | "thu_hoach" | "kiem_tra" | "khac",
  "product_name": "tên sản phẩm/phân/thuốc nếu có" | null,
  "dosage": "liều lượng (vd: 2 kg, 20ml/bình)" | null,
  "area": "khu vực (vd: Khu A)" | null,
  "plant_count": số cây (nếu có) | null,
  "notes": "tóm tắt ngắn phần còn lại"
}
Câu nói: "${text}"
`;
    const res = await supabase.functions.invoke('gemini-proxy', {
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }
    });
    if (res.error) throw new Error(res.error.message || 'Lỗi AI');
    const data = res.data;
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(out.trim());
    return { ...parseLocally(text), ...parsed, raw: text };
  } catch (e) {
    console.warn('Không bóc tách được qua Gemini, dùng cục bộ:', e);
    return parseLocally(text);
  }
};

export const hasActivity = (parsed) => parsed.activity_type || parsed.crop_type || parsed.product_name || parsed.dosage;
