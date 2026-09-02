import { test, expect } from '@playwright/test';

// E2E cơ bản: mở app (chế độ mock), đăng nhập nhanh, kiểm tra các tab chính.
// Mỗi test bắt đầu với localStorage sạch (phiên mock mới).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('Mở app và hiển thị màn hình đăng nhập', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AgriCommunity' })).toBeVisible();
  // Tab chuyển chế độ "Đăng nhập" (tránh nhầm với nút submit cùng tên)
  await expect(page.getByRole('button', { name: 'Đăng nhập' }).first()).toBeVisible();
});

test('Đăng nhập nhanh tài khoản nông dân mẫu và xem tab MRL', async ({ page }) => {
  await page.goto('/');
  // Bấm nút demo nông dân mẫu (0912345678)
  await page.getByRole('button', { name: /Nông dân mẫu/ }).click();
  // Vào tab Xuất khẩu (MRL Advisor)
  await page.getByRole('button', { name: 'Xuất khẩu' }).click();
  await expect(page.getByText('MRL Advisor', { exact: false })).toBeVisible();
});
