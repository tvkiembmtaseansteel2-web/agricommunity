-- ============================================================
-- AgriCommunity — pg_cron: lên lịch KB (ĐÃ CHẠY trên Production)
-- ============================================================
-- 2 job đang chạy (đã schedule qua Management API, secret CRAWLER_SECRET đặt qua CLI):
--   • kb-crawler-weekly: 06:00 thứ 2 hàng tuần — crawler RSS nguồn mới → raw_articles
--   • kb-ingest-daily:   07:00 hằng ngày     — trích raw_articles → kb_entries + tạo embedding (pgvector)
-- Cả 2 dùng chung header x-crawler-secret = CRAWLER_SECRET (không lộ trong repo).
--
-- Cách kiểm tra:  select jobid, jobname, schedule, command from cron.job;
-- Cách thêm lại nếu reset (thay <CRAWLER_SECRET> bằng giá trị thật):
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Crawler mỗi tuần (thứ 2 06:00)
SELECT cron.schedule(
  'kb-crawler-weekly', '0 6 * * 1',
  $$SELECT net.http_post(url := 'https://gjavupiyrnuwtersagnw.supabase.co/functions/v1/kb-crawler', headers := jsonb_build_object('Content-Type','application/json','x-crawler-secret','<CRAWLER_SECRET>'), body := '{}'::jsonb);$$
);

-- Ingest + embedding mỗi ngày (07:00)
SELECT cron.schedule(
  'kb-ingest-daily', '0 7 * * *',
  $$SELECT net.http_post(url := 'https://gjavupiyrnuwtersagnw.supabase.co/functions/v1/kb-ingest', headers := jsonb_build_object('Content-Type','application/json','x-crawler-secret','<CRAWLER_SECRET>'), body := '{"limit":30}'::jsonb);$$
);
