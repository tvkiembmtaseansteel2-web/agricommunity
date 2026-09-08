// ============================================================================
// Edge Function: kb-embed (Tầng 3 — pgvector semantic search)
// ----------------------------------------------------------------------------
// 1) action='backfill': tạo embedding (gemini-embedding-001, 3072) cho các
//    kb_entries chưa có embedding. Trả về số bản đã xử lý.
// 2) action='query': nhận text → trả về embedding vector (để client gọi
//    match_kb_similarity qua RPC, hoặc để function nội bộ).
// 3) action='search': nhận text → generate embedding → match_kb_similarity →
//    trả về các kb_entries gần nhất theo ngữ nghĩa (published).
//
// Bảo mật: verify_jwt = true. GEMINI_API_KEY nằm server.
// ============================================================================
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE = Deno.env.get('GEMINI_PROXY_SERVICE_ROLE');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 3072;

Deno.serve(async (req) => {
  // CORS preflight (browser gọi cross-origin) — trả 204 + CORS header
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !GEMINI_API_KEY) {
    return json({ error: 'Thiếu cấu hình server.' }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'search';
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  if (action === 'backfill') {
    const limit = Math.min(Number(body?.limit) || 50, 200);
    const { data: rows } = await db.from('kb_entries')
      .select('id, problem_name, scientific_name, symptoms_description, farming_method, biological_method, active_ingredients, dosage_notes')
      .is('embedding', null)
      .limit(limit);
    let done = 0;
    for (const r of rows || []) {
      try {
        const text = buildText(r);
        const vec = await embed(text);
        if (!vec) continue;
        const { error } = await db.from('kb_entries')
          .update({ embedding: vec }).eq('id', r.id);
        if (!error) done++;
      } catch (e) { /* tiếp tục */ }
    }
    return json({ ok: true, action, backfilled: done, totalMissing: rows?.length ?? 0 }, 200);
  }

  if (action === 'query' || action === 'search') {
    const text = (body.text || '').trim();
    if (!text) return json({ error: 'Thiếu text.' }, 400);
    const vec = await embed(text);
    if (!vec) return json({ error: 'Không tạo được embedding.' }, 500);

    if (action === 'query') {
      return json({ ok: true, embedding: vec, dims: EMBED_DIMS }, 200);
    }

    // search → match_kb_similarity (RPC qua service_role)
    const { data, error } = await db.rpc('match_kb_similarity', {
      query_embedding: vec,
      match_count: Math.min(Number(body?.match_count) || 5, 10),
    });
    if (error) return json({ error: 'Không tìm được KB', detail: error.message }, 500);
    return json({ ok: true, results: data }, 200);
  }

  return json({ error: 'Unknown action' }, 400);
});

async function embed(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }),
  });
  if (!res.ok) { console.error('embed lỗi', res.status, await res.text()); return null; }
  const d = await res.json();
  const vals = d?.embedding?.values;
  if (!vals || vals.length !== EMBED_DIMS) return null;
  return '[' + vals.join(',') + ']';
}

function buildText(r) {
  const parts = [r.problem_name, r.scientific_name, r.symptoms_description, r.farming_method, r.biological_method];
  if (Array.isArray(r.active_ingredients)) parts.push(r.active_ingredients.join(', '));
  parts.push(r.dosage_notes);
  return parts.filter(Boolean).join('. ').slice(0, 2000);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders() });
}

// CORS headers đầy đủ cho phép browser gọi cross-origin (netlify.app → supabase.co)
function corsHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  };
}
