// Storage Service — upload ảnh vườn lên Supabase Storage bucket 'farm-images'
// - Chế độ Mock: không có storage thật → lưu ảnh dạng data URL (đủ cho demo)
// - Chế độ thật: nén ảnh (≤1024px, JPEG 80%) rồi upload, trả về public URL
import { supabase, IS_MOCK } from './supabaseClient';

const BUCKET = 'farm-images';

// Nén ảnh xuống tối đa maxSize px, chất lượng quality, trả về Blob + dataUrl
export const compressImage = (file, maxSize = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File không phải ảnh hợp lệ'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Chuyển dataUrl → Blob để upload
        const bin = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: 'image/jpeg' });
        resolve({ dataUrl, blob, width, height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

// Upload ảnh vườn, trả về URL hiển thị được.
// Mock: trả dataUrl (không cần backend). Thật: upload lên Storage → public URL.
export const uploadFarmImage = async (file) => {
  const { dataUrl, blob } = await compressImage(file);

  if (IS_MOCK) {
    // Mock: lưu dataUrl trực tiếp (localStorage)
    await new Promise(r => setTimeout(r, 300)); // mô phỏng độ trễ upload
    return dataUrl;
  }

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    throw new Error(`Upload ảnh thất bại: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
};

// Kiểm tra bucket đã tồn tại chưa (dùng cho thông báo hướng dẫn)
export const checkBucketExists = async () => {
  if (IS_MOCK) return true;
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    return !error && !!data;
  } catch {
    return false;
  }
};
