# ============================================================
# DEPLOY-ONE.md — Chạy 1 lần để đẩy GitHub + deploy Netlify
# (không cần gửi token cho ai; tự dán token vào đây rồi chạy)
# ============================================================
# BƯỚC 0: Dán token của bạn vào các biến trong Terminal (PowerShell):
#   $env:GH_TOKEN="<GitHub PAT quyền repo>"
#   $env:NETLIFY_TOKEN="<Netlify PAT quyền site:write + env>"
#   $env:REPO_NAME="agri-community-app"
#   $env:GITHUB_USER="<tên user GitHub>"
#
# BƯỚC 1: Đẩy lên GitHub (tự tạo repo + push)
#   gh repo create $env:GITHUB_USER/$env:REPO_NAME --public --source . --push
#   (nếu chưa cài gh: dùng git thay thế ở mục "Cách thay thế không cần gh" bên dưới)
#
# BƯỚC 2: Deploy lên Netlify (tự tạo site + build + env + đặt env)
#   npx -y netlify-cli login --auth $env:NETLIFY_TOKEN
#   npx -y netlify-cli deploy --build --prod --auth $env:NETLIFY_TOKEN
#   Nếu muốn tạo site mới tự động: npx netlify-cli sites:create --name <ten-site> --auth $env:NETLIFY_TOKEN
#
# BƯỚC 3: Đặt biến môi trường trên Netlify (Site ID từ "Netlify -> Site settings" hoặc lệnh sites:list)
#   npx -y netlify-cli env:set VITE_SUPABASE_URL "https://gjavupiyrnuwtersagnw.supabase.co" --site <SITE_ID> --auth $env:NETLIFY_TOKEN
#   npx -y netlify-cli env:set VITE_SUPABASE_ANON_KEY "<anon key>" --site <SITE_ID> --auth $env:NETLIFY_TOKEN
#   npx -y netlify-cli env:set VITE_GEMINI_API_KEY "<gemini key>" --site <SITE_ID> --auth $env:NETLIFY_TOKEN
#   -> Sau đó redeploy: npx -y netlify-cli deploy --prod --auth $env:NETLIFY_TOKEN
#
# ============================================================
# CÁCH THAY THẾ KHÔNG CẦN GH CLI (chỉ cần git + GitHub PAT):
#   1) Tạo repo trống trên GitHub (giao diện web).
#   2) git remote add origin https://<GH_TOKEN>@github.com/<user>/<repo>.git
#   3) git push -u origin main
# ============================================================
