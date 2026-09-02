import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

let supabase;

beforeAll(async () => {
  // Ép chế độ Mock: không có env URL/key → supabaseClient tự dùng MockSupabase (localStorage)
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  const mod = await import('../supabaseClient.js');
  supabase = mod.supabase;
});

describe('MockSupabase — chuỗi điều kiện .eq() (Phase 2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('insert + delete với 2 điều kiện .eq()', async () => {
    // Seed 2 lượt thích của 2 user khác nhau cho cùng post
    await supabase.from('post_likes').insert([{ post_id: 1, profile_id: 'user-a' }]);
    await supabase.from('post_likes').insert([{ post_id: 1, profile_id: 'user-b' }]);

    // Xóa chỉ lượt thích của user-a
    const { error } = await supabase.from('post_likes').delete().eq('post_id', 1).eq('profile_id', 'user-a');
    expect(error).toBeNull();

    const { data } = await supabase.from('post_likes').select().eq('post_id', 1);
    // user-b vẫn còn — chứng minh xóa đúng điều kiện kép
    expect(data).toHaveLength(1);
    expect(data[0].profile_id).toBe('user-b');
  });

  it('update với điều kiện .eq() trả dữ liệu đúng', async () => {
    await supabase.from('post_likes').insert([{ post_id: 2, profile_id: 'user-a' }]);

    const { data } = await supabase.from('post_likes').update({ read: true }).eq('post_id', 2);
    expect(data).toHaveLength(1);
    expect(data[0].read).toBe(true);
  });
});
