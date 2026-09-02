// ============================================================
// Supabase Edge Function: kb-crawler
// Crawl dữ liệu nông nghiệp từ các nguồn chính thống → raw_articles (Draft)
// Chạy định kỳ qua pg_cron (mỗi thứ 2 hàng tuần) hoặc gọi thủ công.
// Nguồn: ppd.gov.vn, khuyennongvn.gov.vn, wasi.org.vn, sofri.org.vn, nongnghiep.vn
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Bí mật xác thực lời gọi crawler (đặt qua: supabase secrets set CRAWLER_SECRET=<mật khẩu mạnh>).
// Bảo vệ để người lạ KHÔNG thể tự gọi/kích hoạt crawl (tiêu tốn tài nguyên, chèn dữ liệu rác).
const CRAWLER_SECRET = Deno.env.get('CRAWLER_SECRET');

// Danh sách nguồn RSS (ĐÃ xác minh URL feed thực tế 28/08/2026).
// ✅ Có feed thật: wasi.org.vn, khuyennongvn.gov.vn
// ⚠️ Chưa có feed (cần web scraper riêng): ppd.gov.vn, sofri.org.vn, nongnghiep.vn
const RSS_SOURCES = [
  { name: 'Viện WASI', url: 'https://wasi.org.vn/feed/' },
  { name: 'Khuyến nông Quốc gia', url: 'https://khuyennongvn.gov.vn/feed/' }
];

// Từ khóa lọc (theo PRD Mục 3.2)
const KEYWORDS = ['cà phê', 'cafe', 'sầu riêng', 'sau rieng', 'tiêu', 'hồ tiêu', 'ho tieu'];

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  // Xác thực: yêu cầu secret khớp (tránh người lạ kích hoạt crawler).
  // Nếu chưa đặt CRAWLER_SECRET → chặn (chỉ chạy được khi admin đã cấu hình).
  if (!CRAWLER_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'CRAWLER_SECRET chưa được cấu hình — chặn lời gọi.' }), { status: 503, headers: cors });
  }
  const provided = req.headers.get('x-crawler-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== CRAWLER_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Sai hoặc thiếu x-crawler-secret.' }), { status: 401, headers: cors });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const report = { sources_checked: 0, articles_fetched: 0, matched: 0, errors: [] };

    for (const source of RSS_SOURCES) {
      report.sources_checked++;
      try {
        const res = await fetch(source.url, { headers: { 'User-Agent': 'AgriCommunityBot/1.0' } });
        if (!res.ok) { report.errors.push(`${source.name}: HTTP ${res.status}`); continue; }
        const xml = await res.text();
        const items = parseRSS(xml); // bóc tách <item> title/link/description

        for (const item of items.slice(0, 15)) {
          report.articles_fetched++;
          const matched = KEYWORDS.filter(k => item.title.toLowerCase().includes(k.toLowerCase()));
          if (matched.length === 0) continue;

          report.matched++;
          // Trùng lặp? Kiểm tra source_url
          const { data: dup } = await supabase.from('raw_articles')
            .select('id').eq('source_url', item.link).limit(1);
          if (dup && dup.length > 0) continue;

          await supabase.from('raw_articles').insert([{
            title: item.title,
            source_url: item.link,
            source_name: source.name,
            raw_content: item.description,
            matched_keywords: matched,
            status: 'draft'
          }]);
        }
      } catch (e) {
        report.errors.push(`${source.name}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, report }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: cors });
  }
});

// Parse RSS/Atom đơn giản (không cần thư viện XML để giảm phụ thuộc)
function parseRSS(xml) {
  const items = [];
  // Bóc các <item>...</item> (RSS 2.0) hoặc <entry>...</entry> (Atom)
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
  for (const block of blocks) {
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const link = extractLink(block);
    const description = stripTags(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || '')
      .slice(0, 1000);
    if (title) items.push({ title, link, description });
  }
  return items;
}

function extractLink(block) {
  const m = block.match(/<link[^>]*href="([^"]+)"/i); // Atom
  if (m) return m[1];
  const m2 = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i); // RSS
  if (m2) return stripTags(m2[1]);
  return '';
}

function stripTags(s) {
  return (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
}
