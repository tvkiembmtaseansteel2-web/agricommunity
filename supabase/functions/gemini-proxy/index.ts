// ============================================================================
// Edge Function: gemini-proxy
// ----------------------------------------------------------------------------
// Mục đích: giữ GEMINI_API_KEY ở SERVER (không lộ trong bundle client).
// Client gọi function này với body {contents, generationConfig, ...};
// function forward sang Google Gemini và trả về kết quả.
//
// Bảo mật + kiểm soát chi phí:
// - verify_jwt = true (xem config.toml) → CHỈ user đã đăng nhập (có JWT hợp lệ).
// - Hạn mức AI/user/ngày: free=5, pro=100 (bảng ai_usage + profiles.plan).
//   → Bảo vệ quota free + giới hạn chi phí; chặn user spam AI.
// - Giới hạn kích thước body.
// ============================================================================
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('GEMINI_PROXY_SERVICE_ROLE')!;

Deno.serve(async (req) => {
  // 1) Chỉ nhận POST
  if (req.method !== 'POST') {
    return json({ error: 'Chỉ chấp nhận POST' }, 405);
  }

  // 2) Lấy API key từ server secrets (KHÔNG bao giờ gửi xuống client)
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

  if (!GEMINI_API_KEY) {
    return json({ error: 'Chưa cấu hình GEMINI_API_KEY trên server.' }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return json({ error: 'Chưa cấu hình SUPABASE_URL / GEMINI_PROXY_SERVICE_ROLE.' }, 500);
  }

  // 3) Lấy user id từ JWT (Authorization: Bearer <jwt>)
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) {
    return json({ error: 'Thiếu token xác thực.' }, 401);
  }

  // Parse JWT payload (base64url) để lấy sub (user id) — không cần verify vì
  // verify_jwt=true đã chặn token giả ở tầng Gateway.
  let userId = null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    userId = decoded.sub;
  } catch (e) {
    return json({ error: 'Token không hợp lệ.' }, 401);
  }
  if (!userId) {
    return json({ error: 'Không xác định được người dùng.' }, 401);
  }

  // 4) Client dùng service role để đọc profile/ai_usage (vượt qua RLS)
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 5) Đọc gói & hạn mức
  let plan = 'free';
  try {
    const { data: prof } = await db.from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    if (prof?.plan) plan = prof.plan;
  } catch (e) {
    console.error('gemini-proxy: không đọc được profile', e.message);
  }

  const limit = plan === 'pro' ? 100 : 5;

  // 6) Số lượt đã dùng hôm nay
  let used = 0;
  try {
    const { data } = await db.from('ai_usage')
      .select('request_count')
      .eq('profile_id', userId)
      .eq('use_date', new Date().toISOString().slice(0, 10))
      .maybeSingle();
    used = data?.request_count || 0;
  } catch (e) {
    console.error('gemini-proxy: không đọc được ai_usage', e.message);
  }

  if (used >= limit) {
    return json({
      error: `limit_reached`,
      message: `Bạn đã dùng hết ${limit} lượt AI hôm nay. Nâng gói Pro để dùng thêm.`,
      plan,
      used,
      limit,
    }, 429);
  }

  // 7) Đọc body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'Body không hợp lệ.' }, 400);
  }

  const contents = body.contents;
  const generationConfig = body.generationConfig || { responseMimeType: 'application/json' };
  if (!Array.isArray(contents) || contents.length === 0) {
    return json({ error: 'Thiếu nội dung contents.' }, 400);
  }

  const rawSize = JSON.stringify(body).length;
  if (rawSize > 6 * 1024 * 1024) {
    return json({ error: 'Payload quá lớn (tối đa ~6MB).' }, 413);
  }

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig }),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error('gemini-proxy: Gemini upstream error', upstream.status, text.slice(0, 300));
      return json({ error: `Gemini lỗi: ${upstream.status} ${upstream.statusText}` }, 502);
    }

    // 8) GHI NHẬN LƯỢT CHỈ KHI THÀNH CÔNG (tăng request_count)
    try {
      await db.rpc('increment_ai_usage', { p_user: userId });
    } catch (e) {
      console.error('gemini-proxy: increment_ai_usage lỗi', e.message);
    }

    // Trả kèm thông tin quota để client hiển thị
    const newUsed = used + 1;
    const remaining = Math.max(0, limit - newUsed);
    const responseObj = JSON.parse(text);
    return new Response(JSON.stringify({
      ...responseObj,
      __quota: { plan, used: newUsed, limit, remaining },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    console.error('gemini-proxy: fetch error', e.message);
    return json({ error: 'Không gọi được Gemini API.', detail: String(e.message || e) }, 502);
  }
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
