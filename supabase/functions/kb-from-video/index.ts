// ============================================================================
// Edge Function: kb-from-video
// ----------------------------------------------------------------------------
// PoC: Lấy kiến thức nông nghiệp từ video YouTube của kênh ĐƯỢC WHITELIST.
// Quy trình kiểm chứng:
//   1) Bóc transcript video (qua youtube-transcript-api công khai ở client gọi).
//      → Client gửi { videoId, channelName, transcript } cho function.
//   2) AI tóm tắt + trích cấu trúc giống kb_entries (triệu chứng, cơ chế, biện pháp).
//   3) ĐỐI CHIẾU CHÉO với KB đã có: nếu khớp/không mâu thuẫn → tăng tin cậy;
//      nếu trái ngược → gắn cờ, KHÔNG đưa vào published.
//   4) Chỉ ghi raw_articles ở trạng thái draft; admin/expert duyệt mới thành published.
//
// Bảo mật: verify_jwt = true (chỉ admin gọi được).
// ============================================================================
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE = Deno.env.get('GEMINI_PROXY_SERVICE_ROLE');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !GEMINI_API_KEY) {
    return json({ error: 'Thiếu cấu hình server.' }, 500);
  }

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'Body không hợp lệ.' }, 400); }

  const { videoId, channelName, transcript, videoTitle } = body;
  if (!videoId || !transcript) return json({ error: 'Thiếu videoId hoặc transcript.' }, 400);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  // 1) Tìm kênh trong whitelist (bắt buộc phải có để đảm bảo nguồn tin cậy)
  // Client truyền channelName; ta tra bảng video_sources.
  let source = null;
  if (channelName) {
    const { data } = await db.from('video_sources')
      .select('*').ilike('channel_name', `%${channelName}%`).eq('enabled', true).limit(1).maybeSingle();
    source = data || null;
  }
  const credibility = source?.credibility_score ?? 0;
  if (credibility < 2) {
    // Không thuộc kênh whitelist đáng tin → từ chối đưa vào KB (an toàn)
    return json({ error: 'Nguồn chưa được xác minh/đáng tin (credibility < 2). Thêm kênh vào whiteliest trước.', source: source?.channel_name || null }, 403);
  }

  // 2) AI tóm tắt + trích cấu trúc
  const prompt = `Bạn là chuyên gia nông nghiệp. Đọc transcript video YouTube về cây trồng và đất (hóa sinh, kỹ thuật) và trích xuất kiến thức CHUẨN HOÁ.
Chỉ RÚT RA những nội dung có cơ sở khoa học, KHÔNG thêm/không suy diễn. Nếu video chứa liều lượng/hóa chất cụ thể, ghi rõ "cần xác minh thêm nguồn" và KHÔNG coi là chắc chắn.

Trả về JSON thuần:
{
  "plant_type": "cafe"|"sau_rieng"|"ho_tieu"|"chung",
  "category": "dinh_duong"|"dat"|"benh_hat"|"sau_hat"|"khac",
  "topic": "chủ đề ngắn",
  "summary": "tóm tắt 3-5 câu về cơ chế/quy trình",
  "key_points": ["điểm chính 1", "điểm chính 2", ...],
  "active_ingredients": ["hoạt chất nếu video nêu; nếu không chắc → []"],
  "dosage_notes": "ghi chú liều/cách dùng nếu có; nếu không chắc → 'cần xác minh'",
  "uncertain": true|false,  // true nếu có nội dung chưa chắc chắn / cần nguồn thứ 2
  "confidence": "cao"|"trung_binh"|"thap"
}
Video tiêu đề: ${videoTitle || '(không tiêu đề)'}
Transcript (truncate):
${(transcript || '').slice(0, 12000)}`;

  let structured = null;
  try {
    const gurl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const gres = await fetch(gurl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    const gtext = await gres.text();
    if (!gres.ok) throw new Error(`Gemini ${gres.status}`);
    const gdata = JSON.parse(gtext);
    const rt = gdata?.candidates?.[0]?.content?.parts?.[0]?.text;
    structured = JSON.parse(rt.trim());
  } catch (e) {
    return json({ error: 'Lỗi phân tích AI', detail: String(e.message || e) }, 502);
  }

  // 3) ĐỐI CHIẾU CHÉO với KB đã có (chống mâu thuẫn)
  let crossMatch = null; let conflict = false;
  if (structured?.topic) {
    const { data: existing } = await db.from('kb_entries')
      .select('problem_name, scientific_name, active_ingredients, source_credibility')
      .eq('status', 'published')
      .ilike('problem_name', `%${structured.topic.split(' ').slice(0, 3).join('%')}%`)
      .limit(3);
    if (existing && existing.length > 0) {
      crossMatch = existing[0];
      // Đối chiếu hoạt chất: nếu video nêu hoạt chất KHÁC với KB đã duyệt → cờ xung đột
      if (Array.isArray(structured.active_ingredients) && structured.active_ingredients.length > 0
          && Array.isArray(existing[0]?.active_ingredients) && existing[0].active_ingredients.length > 0) {
        const hit = structured.active_ingredients.some(ai =>
          existing[0].active_ingredients.some(e => e.toLowerCase() === ai.toLowerCase()));
        if (!hit) conflict = true;
      }
    }
  }

  const finalConfidence = structured?.confidence === 'cao' && !conflict ? 'cao' : structured?.confidence ?? 'thap';

  // 4) Ghi raw_articles ở trạng thái draft (CHƯA vào AI)
  const { data: inserted, error: insErr } = await db.from('raw_articles').insert([{
    title: structured?.topic || videoTitle || ('Video ' + videoId),
    source_url: `https://youtu.be/${videoId}`,
    source_name: source?.channel_name || channelName || 'YouTube',
    raw_content: structured?.summary || '',
    matched_keywords: Array.isArray(structured?.key_points) ? structured.key_points.slice(0, 5) : [structured?.topic].filter(Boolean),
    status: 'draft',
    source_credibility: credibility,
    manual_verified: false,
  }]).select().single();

  if (insErr) return json({ error: 'Không ghi được raw_articles', detail: insErr.message }, 500);

  return json({
    ok: true,
    draft_id: inserted.id,
    status: 'draft (chờ admin duyệt — chưa vào AI)',
    credibility,
    conflict,            // true nếu phát hiện mâu thuẫn với KB → admin ưu tiên xem
    crossSource: crossMatch ? { problem: crossMatch.problem_name, source_credibility: crossMatch.source_credibility } : null,
    structured_summary: structured?.summary,
    key_points: structured?.key_points,
    active_ingredients: structured?.active_ingredients,
    confidence: finalConfidence,
  }, 200);
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}
