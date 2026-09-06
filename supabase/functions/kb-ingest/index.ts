// ============================================================================
// Edge Function: kb-ingest (Tầng 2 — tự động hóa raw_articles → kb_entries)
// ----------------------------------------------------------------------------
// Đọc raw_articles (chưa ingest) → AI trích cấu trúc kb_entries → ghi vào bảng.
// - Nếu confidence cao & không mâu thuẫn → status='published' (vào AI luôn).
// - Nếu mơ hồ / có hoạt chất không chắc → status='draft' (chờ admin duyệt).
// - Đánh dấu raw_articles.status='ingested' để không xử lý lại.
//
// Bảo mật: verify_jwt = true (chỉ admin gọi). GEMINI_API_KEY nằm server.
// ============================================================================
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE = Deno.env.get('GEMINI_PROXY_SERVICE_ROLE');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

// Bệnh/dinh dưỡng theo từng cây → helpers validate
const VALID_PLANT = ['cafe', 'sau_rieng', 'ho_tieu', 'chung'];
const VALID_CATEGORY = ['sau_hat', 'benh_hat', 'dinh_duong', 'dat', 'khac'];
const VALID_PART = ['la', 'qua', 'than', 'canh', 're', 'toan_than'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !GEMINI_API_KEY) {
    return json({ error: 'Thiếu cấu hình server.' }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body?.limit) || 10, 50); // số bài xử lý mỗi lần

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  // 1) Lấy raw_articles chưa ingest (ưu tiên draft, bỏ đã xử lý)
  const { data: articles, error: aErr } = await db.from('raw_articles')
    .select('id, title, raw_content, source_name, source_url, matched_keywords, source_credibility')
    .not('status', 'eq', 'ingested')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (aErr) return json({ error: 'Không đọc được raw_articles', detail: aErr.message }, 500);

  const results = [];
  for (const art of articles || []) {
    try {
      const r = await ingestOne(db, art);
      results.push(r);
    } catch (e) {
      results.push({ raw_id: art.id, ok: false, error: String(e.message || e) });
    }
  }

  return json({ ok: true, processed: results.length, results }, 200);
});

async function ingestOne(db, art) {
  const prompt = `Bạn là chuyên gia nông nghiệp (cà phê, sầu riêng, hồ tiêu). Đọc bài viết dưới đây và trích xuất kiến thức CHUẨN HOÁ theo cấu trúc kb_entries.
CHỈ lấy thông tin CÓ TRONG BÀI, không suy diễn. Nếu bài không phải về một bệnh/dinh dưỡng cụ thể (mà là tin hội thảo, phát thải, chung chung), trả {"skip":true}.

Trả về JSON thuần:
{
  "skip": true|false,
  "plant_type": "cafe"|"sau_rieng"|"ho_tieu"|"chung",
  "category": "sau_hat"|"benh_hat"|"dinh_duong"|"dat"|"khac",
  "target_part": "la"|"qua"|"than"|"canh"|"re"|"toan_than",
  "problem_name": "Tên bệnh/dinh dưỡng (phổ thông, dễ hiểu)",
  "scientific_name": "tên khoa học (nếu có) | null",
  "agents": "tác nhân (nấm/vi khuẩn/thiếu vi lượng...) | null",
  "symptoms_description": "mô tả triệu chứng chi tiết",
  "severity_levels": "Nhẹ/Trung bình/Nặng | null",
  "farming_method": "biện pháp canh tác | null",
  "biological_method": "biện pháp sinh học | null",
  "active_ingredients": ["hoạt chất khuyến cáo, chỉ lấy nếu bài nêu rõ; nếu không chắc trả []"],
  "dosage_notes": "lưu ý liều/cách dùng (nếu có); nếu không chắc → 'cần xác minh'",
  "confidence": "cao"|"trung_binh"|"thap"
}
Bài viết:
${(art.raw_content || '').slice(0, 9000)}`;

  const gurl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const gres = await fetch(gurl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  const gtext = await gres.text();
  if (!gres.ok) throw new Error(`Gemini ${gres.status}`);
  const gdata = JSON.parse(gtext);
  const rt = gdata?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rt.trim());

  // Đánh dấu bài đã xử lý (kể cả skip)
  await db.from('raw_articles').update({ status: 'ingested' }).eq('id', art.id).select();

  if (parsed.skip || !parsed.problem_name) {
    return { raw_id: art.id, ok: true, skipped: true, reason: 'Không phải nội dung bệnh/dinh dưỡng cụ thể' };
  }

  // Validate + chuẩn hóa
  const plant_type = VALID_PLANT.includes(parsed.plant_type) ? parsed.plant_type : 'chung';
  const category = VALID_CATEGORY.includes(parsed.category) ? parsed.category : 'khac';
  const target_part = VALID_PART.includes(parsed.target_part) ? parsed.target_part : 'toan_than';
  const confidence = parsed.confidence || 'thap';
  // Chỉ published khi confidence cao; draft khi mơ hồ/cần xác minh liều
  const status = confidence === 'cao' ? 'published' : 'draft';

  const { data: ins, error: insErr } = await db.from('kb_entries').insert([{
    plant_type,
    category,
    target_part,
    problem_name: parsed.problem_name,
    scientific_name: parsed.scientific_name || null,
    agents: parsed.agents || null,
    symptoms_description: parsed.symptoms_description || '',
    severity_levels: parsed.severity_levels || null,
    farming_method: parsed.farming_method || null,
    biological_method: parsed.biological_method || null,
    active_ingredients: parsed.active_ingredients || [],
    dosage_notes: parsed.dosage_notes || '',
    source_url: art.source_url || null,
    source_name: art.source_name || null,
    source_raw_id: art.id,
    source_credibility: art.source_credibility || 0,
    status,
  }]).select().single();

  if (insErr) throw new Error('Không ghi kb_entries: ' + insErr.message);

  return { raw_id: art.id, ok: true, kb_id: ins.id, status, confidence, problem: parsed.problem_name };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}
