// ============================================================================
// Edge Function: gemini-proxy
// ----------------------------------------------------------------------------
// Mục đích: giữ GEMINI_API_KEY ở SERVER (không lộ trong bundle client).
// Client gọi function này với body {contents, generationConfig, ...};
// function forward sang Google Gemini và trả về kết quả.
//
// Bảo mật:
// - verify_jwt = true (xem config.toml) → CHỈ user đã đăng nhập (có JWT hợp lệ)
//   mới gọi được. Không cho phép người lạ dùng key.
// - Giới hạn kích thước body + MIME type.
// - Có thể thêm key header/phụ nếu muốn (xyz-*).
// ============================================================================

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

  // 3) Đọc body
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

  // 4) Giới hạn kích thước payload (chống gửi ảnh quá nặng / spam)
  const rawSize = JSON.stringify(body).length;
  if (rawSize > 6 * 1024 * 1024) {
    return json({ error: 'Payload quá lớn (tối đa ~6MB).' }, 413);
  }

  // Nếu client gửi model, vẫn ép về model server (chống đổi model trái phép)
  const model = GEMINI_MODEL;

  // 5) Forward sang Gemini (key ở URL hoặc header — Google cho phép ?key=)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig })
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error('gemini-proxy: Gemini upstream error', upstream.status, text.slice(0, 300));
      return json({ error: `Gemini lỗi: ${upstream.status} ${upstream.statusText}` }, 502);
    }

    // Trả đúng cấu trúc để client parse
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (e) {
    console.error('gemini-proxy: fetch error', e.message);
    return json({ error: 'Không gọi được Gemini API.', detail: String(e.message || e) }, 502);
  }
});

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}
