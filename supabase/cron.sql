-- ============================================================
-- AgriCommunity — pg_cron: lên lịch chạy crawler KB (PRD Mục 3.2)
-- Mỗi thứ 2 hàng tuần lúc 06:00. Dùng pg_net.http_post để gọi Edge Function.
-- Cách dùng: Supabase Dashboard → SQL Editor → dán → Run
-- ============================================================

-- 1. Bật extensions (nếu chưa)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Lên lịch chạy crawler
--    Thay <SUPABASE_URL> bằng URL project (bọc trong $$...$$ string literal nếu dùng cron)
--    Cách gọi: POST https://<SUPABASE_URL>/functions/v1/kb-crawler
--    ⚠️ PHẢI truyền header 'x-crawler-secret' = giá trị đã đặt qua: supabase secrets set CRAWLER_SECRET=<mật khẩu mạnh>
SELECT cron.schedule(
  'kb-crawler-weekly',
  '0 6 * * 1',  -- 06:00 thứ 2 mỗi tuần
  $$
  SELECT net.http_post(
    url := 'https://gjavupiyrnuwtersagnw.supabase.co/functions/v1/kb-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-crawler-secret', '<THAY_BANG_CRAWLER_SECRET_CUA_BAN>'
    ),
    body := '{}'::jsonb
  ) AS status_code;
  $$
);

-- 3. Kiểm tra
-- select jobid, jobname, schedule, command from cron.job;
