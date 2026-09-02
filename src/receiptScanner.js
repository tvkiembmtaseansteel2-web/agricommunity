// Quét hóa đơn mua phân bón / thuốc BVTV bằng AI (Gemini vision).
// Chụp ảnh hóa đơn → AI đọc và trích xuất: tên sản phẩm, loại (phân/thuốc), liều lượng, hoạt chất.
// Trả về danh sách sản phẩm để nông dân chọn → tự điền vào nhật ký.

const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Trích xuất từ ảnh hóa đơn qua Gemini
export const scanReceipt = async (imageBase64) => {
  if (!GEMINI_API_KEY) {
    throw new Error('Chưa cấu hình VITE_GEMINI_API_KEY để quét hóa đơn.');
  }
  if (!imageBase64) throw new Error('Chưa có ảnh hóa đơn.');

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
Bạn là trợ lý nông nghiệp. Hãy đọc ảnh hóa đơn/phiếu mua phân bón hoặc thuốc bảo vệ thực vật và trích xuất các sản phẩm nông dân đã mua.

Hãy trả về JSON thuần (KHÔNG có markdown \`\`\`json) với cấu trúc:
{
  "products": [
    {
      "name": "Tên sản phẩm đầy đủ (ví dụ: Phân NPK Đầu Trâu 20-20-15, Thuốc Anvil 5SC)",
      "type": "phan" | "thuoc" | "khac",
      "quantity": "số lượng (nếu đọc được)",
      "dosage": "liều lượng gợi ý (ví dụ: 1kg/gốc, 20ml/bình 20L; bỏ trống nếu không rõ)",
      "active_ingredient": "hoạt chất chính (ví dụ: Hexaconazole) — bỏ trống nếu không rõ"
    }
  ]
}

Chỉ trả về danh sách sản phẩm nông nghiệp (phân bón, thuốc BVTV, hạt giống, vật tư nông nghiệp). Bỏ qua các mặt hàng không phải nông nghiệp. Nếu không phải hóa đơn nông nghiệp, trả {"products": []}.
`;

  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng.');

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: match[1], data: match[2] } }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Lỗi kết nối Gemini: ${res.statusText}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini không trả về dữ liệu.');
  return JSON.parse(text.trim());
};

// Đọc ảnh → nén nhỏ rồi chuyển base64 (tái dùng để tiết kiệm, giảm chi phí)
export const fileToBase64 = (file, maxSize = 1024) => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};
