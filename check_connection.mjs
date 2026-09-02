// Script kiểm tra kết nối thực tế (KHÔNG in key ra ngoài)
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
};

const supabaseUrl = get('VITE_SUPABASE_URL');
const anonKey = get('VITE_SUPABASE_ANON_KEY');
const geminiKey = get('VITE_GEMINI_API_KEY');

console.log('Cấu hình: supabase_url=' + (supabaseUrl ? 'OK (' + supabaseUrl.length + ' chars)' : 'THIẾU'));
console.log('          anon_key=' + (anonKey ? 'OK (' + anonKey.length + ' chars)' : 'THIẾU'));
console.log('          gemini_key=' + (geminiKey ? 'OK (' + geminiKey.length + ' chars)' : 'THIẾU'));

if (!supabaseUrl || !anonKey) {
  console.log('\n❌ Thiếu Supabase config — bỏ qua kiểm tra DB.');
} else {
  const supabase = createClient(supabaseUrl, anonKey);

  // 1. Kiểm tra auth hoạt động
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log('\n[auth.getUser] ' + (userError ? 'ERROR: ' + userError.message : 'OK (chưa đăng nhập - đúng kỳ vọng)'));

  // 2. Kiểm tra bảng export_standards
  const { data: std, error: stdErr } = await supabase.from('export_standards').select('crop_type, market, chemical_name, mrl_ppm, status').limit(3);
  if (stdErr) console.log('[export_standards] ERROR: ' + stdErr.message);
  else console.log('[export_standards] OK — ' + std.length + ' hàng mẫu, ví dụ: ' + JSON.stringify(std[0] || {}));

  // 3. Kiểm tra bảng profiles
  const { data: prof, error: profErr } = await supabase.from('profiles').select('id').limit(1);
  if (profErr) console.log('[profiles] ERROR: ' + profErr.message);
  else console.log('[profiles] OK');

  // 4. Kiểm tra bảng posts
  const { data: posts, error: postsErr } = await supabase.from('posts').select('id, status').limit(1);
  if (postsErr) console.log('[posts] ERROR: ' + postsErr.message);
  else console.log('[posts] OK');
}

if (!geminiKey) {
  console.log('\n❌ Thiếu Gemini key — bỏ qua kiểm tra Gemini.');
} else {
  // 5. Kiểm tra Gemini: liệt kê model (không tốn token)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const body = await res.json();
    if (!res.ok) console.log('[gemini/models] ERROR: ' + (body.error?.message || res.status));
    else {
      const models = (body.models || []).map(m => m.name.replace('models/', ''));
      console.log('[gemini/models] OK — ' + models.length + ' models; có gemini-2.5-flash: ' + models.includes('gemini-2.5-flash'));
    }
  } catch (e) {
    console.log('[gemini/models] LỖI MẠNG: ' + e.message);
  }
}

console.log('\n--- Kết thúc kiểm tra ---');
