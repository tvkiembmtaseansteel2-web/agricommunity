// Tra cứu knowledge base bệnh cây (bảng kb_entries chuẩn hóa) → nhúng vào prompt (RAG-lite).
// Giúp AI chẩn đoán DỰA TRÊN DỮ LIỆU thay vì dựa vào trí nhớ model.
// Tầng 3: dùng pgvector (kb-embed search) để tìm theo NGỮ NGHĨA; fallback lọc theo loại cây.
import { supabase } from './supabaseClient';

// Nhận diện cây từ mô tả
const detectCrop = (text) => {
  const t = (text || '').toLowerCase();
  if (t.includes('sầu') || t.includes('sau rieng') || t.includes('sầu riêng')) return 'sau_rieng';
  if (t.includes('cà phê') || t.includes('ca phe') || t.includes('cafe')) return 'cafe';
  if (t.includes('tiêu') || t.includes('tieu')) return 'ho_tieu';
  return null;
};

// Truy vấn kiến thức liên quan (ưu tiên pgvector ngữ nghĩa; fallback lọc theo cây)
export const fetchKnowledge = async (userMessage) => {
  const crop = detectCrop(userMessage);
  if (!crop) return [];

  // Thử semantic search qua kb-embed (nếu function có sẵn & không lỗi)
  try {
    const { data, error } = await supabase.functions.invoke('kb-embed', {
      body: { action: 'search', text: userMessage, match_count: 4 }
    });
    if (!error && data?.ok && Array.isArray(data.results) && data.results.length > 0) {
      // Chuyển về dạng giống fetchKnowledge (để formatKnowledge hiểu được)
      return data.results.map(r => ({
        plant_type: r.plant_type,
        category: r.category,
        target_part: null,
        problem_name: r.problem_name,
        scientific_name: r.scientific_name,
        agents: null,
        symptoms_description: r.symptoms_description,
        severity_levels: null,
        farming_method: null,
        biological_method: null,
        active_ingredients: r.active_ingredients || [],
        dosage_notes: r.dosage_notes,
        similarity: r.similarity,
      }));
    }
  } catch (e) {
    console.warn('pgvector search lỗi, fallback lọc cây:', e?.message || e);
  }

  // Fallback: lọc theo loại cây + đã duyệt (như cũ)
  try {
    let query = supabase.from('kb_entries').select('*').eq('plant_type', crop).eq('status', 'published');
    query = query.order('id', { ascending: true }).limit(4);
    const { data } = await query;
    return data || [];
  } catch (e) {
    console.warn('Không tra được knowledge base:', e);
    return [];
  }
};

// Định dạng kiến thức thành đoạn văn để nhúng vào prompt
export const formatKnowledge = (items) => {
  if (!items || items.length === 0) return '';
  return items.map(k => {
    const symptoms = k.symptoms_description ? `  - ${k.symptoms_description}` : '  - (chưa mô tả)';
    const ingredients = (k.active_ingredients || []).join(', ') || 'N/A';
    return (
`### ${k.problem_name}${k.scientific_name ? ` (${k.scientific_name})` : ''} — [${k.plant_type}/${k.category}/${k.target_part}]
- Tác nhân: ${k.agents || 'N/A'} | Mức độ: ${k.severity_levels || 'N/A'}
- Triệu chứng:
${symptoms}
- Biện pháp canh tác: ${k.farming_method || 'N/A'}
- Biện pháp sinh học: ${k.biological_method || 'N/A'}
- Hoạt chất: ${ingredients}
- Lưu ý dùng: ${k.dosage_notes || 'N/A'}`
    );
  }).join('\n\n');
};

// Lấy dữ liệu MRL CHUẨN theo cây (crop × form × market × chemical → MRL+REI+status+requires_verification)
// để AI đối chiếu đúng cấu trúc khi khuyên dùng hoạt chất.
export const fetchMRLForCrop = async (userMessage) => {
  const crop = detectCrop(userMessage);
  if (!crop) return [];
  try {
    const { data } = await supabase.from('export_standards').select('*').eq('crop_type', crop);
    return data || [];
  } catch (e) {
    console.warn('Không tra được MRL:', e);
    return [];
  }
};

// Định dạng MRL thành đoạn văn nhúng vào prompt — giữ đúng cấu trúc chuẩn
export const formatMRL = (items) => {
  if (!items || items.length === 0) return '';
  return items.map(m => {
    const statusLabel = m.status === 'banned' ? 'CẤM' : m.status === 'restricted' ? 'HẠN CHẾ' : 'Cho phép';
    const form = m.commodity_form || 'n/a';
    const mrl = m.mrl_ppm < 0 ? 'không cho phép' : `${m.mrl_ppm} ppm`;
    const verify = m.requires_verification ? ' [chờ xác minh]' : '';
    return `- ${m.chemical_name} (${m.crop_type}/${form}/${m.market}): MRL=${mrl}, REI=${m.rei_days || 'n/a'}, trạng thái=${statusLabel}${verify}${m.notes ? ' — ' + m.notes : ''}`;
  }).join('\n');
};
