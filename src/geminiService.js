// Gemini AI Assistant Service
// Hỗ trợ gọi API Gemini qua Edge Function `gemini-proxy` (server giữ key, không lộ trong bundle).
// Tích hợp Mock AI tự động chẩn đoán bệnh cây trồng khi chưa có key/server.
import { fetchKnowledge, formatKnowledge, fetchMRLForCrop, formatMRL } from './knowledgeService';
import { supabase, IS_MOCK } from './supabaseClient';

const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY;
// Model mặc định: gemini-3.1-flash-lite (rẻ, nhanh, hỗ trợ vision, đang khả dụng)
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Có dùng được AI thật không? (mock nếu chưa cấu hình key hoặc đang chạy mock mode)
const hasRealAi = () => !!GEMINI_API_KEY && !IS_MOCK;

// Gọi Gemini qua Edge Function (server giữ key) — an toàn cho Production.
// Trả về { data, quota } với quota = { plan, used, limit, remaining } (nếu có).
export const callGemini = async (contents, generationConfig = { responseMimeType: 'application/json' }) => {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { contents, generationConfig }
  });
  if (error) throw error;
  const quota = data?.__quota || null;
  return { data, quota };
};

// Đọc thông tin hạn mức AI hiện tại (nếu đã có từ lần gọi trước).
export const getQuotaFromResponse = (quota) => quota || null;

// Nhãn hoạt động chăm sóc (ánh xạ từ logs.activity_type) — dùng để đưa vào prompt
const ACTIVITY_LABELS = {
  bon_phan: 'Bón phân', phun_thuoc: 'Phun thuốc', tuoi_nuoc: 'Tưới nước',
  cat_tia: 'Cắt tỉa cành', lam_co: 'Làm cỏ', khac: 'Khác'
};
const CROP_LABELS = { sau_rieng: 'Sầu riêng', cafe: 'Cà phê', ho_tieu: 'Hồ tiêu' };

// Số ngày trôi qua từ một ngày (YYYY-MM-DD) → hôm nay (chuẩn hoá đầu ngày địa phương).
const daysAgoLag = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const startLog = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const startToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.max(0, Math.round((startToday - startLog) / 86400000));
};

// Chuyển danh sách nhật ký vườn thành khối văn bản ngắn gọn cho prompt (tối đa 8 gần nhất).
// Kèm số ngày trôi qua từ ngày hoạt động (activity_date) → hôm nay, để AI ước lượng đúng
// mốc thời gian (VD: "5 ngày trước") thay vì chỉ thấy ngày thô.
export const formatGardenLogs = (logs = []) => {
  if (!Array.isArray(logs) || logs.length === 0) return '';
  const recent = [...logs].sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date))).slice(0, 8);
  return recent.map((l) => {
    const activity = ACTIVITY_LABELS[l.activity_type] || l.activity_type;
    const crop = CROP_LABELS[l.crop_type] || l.crop_type || '';
    const lag = daysAgoLag(l.activity_date);
    const parts = [`- ${l.activity_date}${lag !== null ? ` (${lag === 0 ? 'hôm nay' : `${lag} ngày trước`})` : ''}: ${activity}`];
    if (crop) parts.push(crop);
    if (l.product_name) parts.push(`sp: ${l.product_name}`);
    if (l.dosage) parts.push(`liều: ${l.dosage}`);
    if (l.notes) parts.push(`ghi chú: ${l.notes}`);
    return parts.join(' | ');
  }).join('\n');
};


// Mock chuẩn đoán offline khi không có API Key
const mockDiagnose = (userText, imageBase64) => {
  const text = userText.toLowerCase();
  
  if (text.includes('sầu riêng') || text.includes('sầu') || text.includes('sau rieng')) {
    if (text.includes('vàng lá') || text.includes('thối rễ') || text.includes('xì mủ')) {
      return {
        diagnosis: "Bệnh Xì mủ / Thối rễ do nấm Phytophthora palmivora gây ra trên cây Sầu Riêng.",
        explanation: "Nấm Phytophthora phát triển mạnh trong điều kiện vườn ẩm ướt, thoát nước kém, đọng nước mùa mưa. Nấm tấn công vào cổ rễ và vỏ thân gây xì mủ, vàng lá rụng lá hàng loạt.",
        protocol: [
          "Bước 1: Tiêu hủy tàn dư bệnh hại xung quanh gốc, khơi thông rãnh thoát nước, tránh đọng nước.",
          "Bước 2: Cạo sạch vết bệnh xì mủ trên thân, để khô rồi quét thuốc.",
          "Bước 3: Sử dụng hoạt chất để tưới gốc và quét lên vết cạo vỏ cây."
        ],
        active_ingredients: "Hoạt chất khuyên dùng: Metalaxyl hoặc Phosphonate (Lân 2 chiều). Hoạt chất Fosetyl-Aluminium.",
        export_warning: "⚠️ Lưu ý Xuất khẩu Trung Quốc: Hoạt chất Metalaxyl được hạn chế sử dụng (MRL < 0.5 ppm). CẤM HOÀN TOÀN hoạt chất Chlorpyrifos trên sầu riêng xuất khẩu. Ưu tiên quét Phosphonate sinh học đạt chuẩn Organic."
      };
    }
    
    // Mặc định cho sầu riêng
    return {
      diagnosis: "Nghi ngờ thiếu Magie (Mg) hoặc Vi lượng trên Sầu Riêng, hoặc chớm bệnh Cháy lá chết ngọn (Rhizoctonia).",
      explanation: "Lá sầu riêng có hiện tượng nhạt màu ở phần thịt lá nhưng gân lá vẫn xanh, hoặc chớm khô từ chóp lá vào trong. Cần phân biệt giữa thiếu chất dinh dưỡng và bệnh do nấm.",
      protocol: [
        "Bước 1: Bổ sung phân bón trung vi lượng (Canxi-Magie-Kẽm) qua gốc hoặc phun qua lá.",
        "Bước 2: Sử dụng chế phẩm nấm đối kháng Trichoderma bón lót quanh tán cây.",
        "Bước 3: Hạn chế bón quá nhiều phân đạm (N) làm cây yếu và dễ nhiễm nấm Rhizoctonia."
      ],
      active_ingredients: "Hoạt chất sinh học: Phân bón vi lượng EDTA kẽm, EDTA magie. Hoạt chất sinh học Trichoderma.",
      export_warning: "✅ Đạt chuẩn xuất khẩu: Nhóm vi lượng và chế phẩm sinh học Trichoderma hoàn toàn được chấp nhận tại các thị trường khó tính (EU, Mỹ, Trung Quốc)."
    };
  }

  if (text.includes('cà phê') || text.includes('cafe') || text.includes('ca phe')) {
    if (text.includes('rỉ sắt') || text.includes('ri sat') || text.includes('đốm lá')) {
      return {
        diagnosis: "Bệnh Rỉ sắt (Hemileia vastatrix) trên cây Cà Phê.",
        explanation: "Bệnh gây ra bởi nấm ký sinh chuyên tính. Mặt dưới lá xuất hiện các đốm bột màu màu vàng cam/rỉ sắt. Bệnh làm rụng lá sớm, suy kiệt cây cà phê và làm giảm năng suất nghiêm trọng.",
        protocol: [
          "Bước 1: Cắt tỉa cành thông thoáng sau thu hoạch để giảm độ ẩm vườn.",
          "Bước 2: Phun phòng ngừa vào đầu mùa mưa khi bệnh chớm xuất hiện.",
          "Bước 3: Thu gom lá rụng nhiễm bệnh ra khỏi vườn tiêu hủy."
        ],
        active_ingredients: "Hoạt chất hóa học: Hexaconazole, Propiconazole, hoặc gốc đồng (Copper Hydroxide) sinh học.",
        export_warning: "⚠️ Lưu ý Xuất khẩu EU: EU giới hạn dư lượng Hexaconazole cực kỳ nghiêm ngặt. Khuyến nghị phun Đồng đỏ hoặc Đồng Oxyclorua sinh học và ngưng phun hóa chất trước thu hoạch tối thiểu 30-45 ngày để kiểm soát MRL."
      };
    }
    
    // Mặc định cà phê
    return {
      diagnosis: "Thiếu Kali (K) hoặc Rệp sáp hại rễ cây Cà phê.",
      explanation: "Mép lá già bị cháy vàng rồi khô sạm đi, hoặc cây phát triển kém, vàng úa từ ngọn xuống. Cần kiểm tra kỹ phần cổ rễ xem có lớp sáp trắng của rệp sáp bám vào hay không.",
      protocol: [
        "Bước 1: Nếu do thiếu Kali, bón bổ sung Kali Sulphate (K2SO4), hạn chế dùng Kali Clorua (KCl) nếu đất nhiễm mặn.",
        "Bước 2: Nếu do rệp sáp, làm sạch cỏ quanh gốc, phun xịt nước áp lực cao vào gốc hoặc dùng thuốc sinh học.",
        "Bước 3: Sử dụng nấm ký sinh Beauveria bassiana để diệt rệp sáp tự nhiên."
      ],
      active_ingredients: "Sản phẩm: Phân Kali Sulphate. Sinh học: Nấm xanh Beauveria bassiana.",
      export_warning: "✅ Đạt chuẩn xuất khẩu: Nấm ký sinh Beauveria bassiana và Kali Sulphate không để lại dư lượng độc hại, hoàn toàn đạt chuẩn xuất khẩu EU/Mỹ."
    };
  }

  if (text.includes('tiêu') || text.includes('tieu') || text.includes('hồ tiêu')) {
    if (text.includes('vàng lá') || text.includes('chết nhanh') || text.includes('chết chậm')) {
      return {
        diagnosis: "Bệnh Chết nhanh (Phytophthora) hoặc Chết chậm (Tuyến trùng & nấm Fusarium) hại Hồ Tiêu.",
        explanation: "Đây là bệnh nguy hiểm nhất trên hồ tiêu. Bệnh chết nhanh làm lá rụng, thối gốc chỉ trong vài ngày. Chết chậm khiến cây vàng lá từ từ, rễ bị u sưng do tuyến trùng đục lỗ tạo điều kiện cho nấm Fusarium tấn công.",
        protocol: [
          "Bước 1: Đào rãnh cách ly cây bị bệnh nặng để tránh lây lan qua dòng nước tưới.",
          "Bước 2: Dọn sạch gốc hồ tiêu, rải vôi bột khử trùng đất xung quanh.",
          "Bước 3: Xử lý tuyến trùng bằng chế phẩm sinh học kết hợp bón phân hữu cơ hoai mục."
        ],
        active_ingredients: "Hoạt chất hóa học: Metalaxyl + Mancozeb hoặc dùng thuốc trừ tuyến trùng sinh học (Chitosan, Clinoptilolite).",
        export_warning: "⚠️ Lưu ý Xuất khẩu EU: EU giới hạn hoạt chất Metalaxyl ở mức cực thấp (0.05 ppm). CẤM HOÀN TOÀN Carbendazim và Glyphosate. Khuyến khích sử dụng chế phẩm Chitosan sinh học để quản lý tuyến trùng đất."
      };
    }
  }

  // Mặc định chung
  return {
    diagnosis: "Không xác định rõ loại cây trồng. Nghi ngờ thiếu chất dinh dưỡng hoặc bệnh nấm thông thường.",
    explanation: "Vui lòng ghi rõ tên cây trồng (Ví dụ: 'Sầu riêng bị vàng lá', 'Cà phê bị đốm lá rỉ sắt') hoặc tải ảnh rõ nét của lá/bệnh hại lên để hệ thống phân tích chính xác hơn.",
    protocol: [
      "Bước 1: Kiểm tra lại xem cây trồng thuộc nhóm nào (cà phê, sầu riêng, hồ tiêu).",
      "Bước 2: Chụp ảnh cận cảnh vết bệnh dưới ánh sáng rõ nét tự nhiên.",
      "Bước 3: Giữ vườn thông thoáng và kiểm tra độ ẩm đất."
    ],
    active_ingredients: "Nên sử dụng các chế phẩm sinh học hữu cơ lành tính trước khi dùng hóa chất.",
    export_warning: "ℹ️ Lưu ý: Mọi hoạt chất hóa học dùng trên nông sản xuất khẩu cần tuân thủ thời gian cách ly (PHI) ghi trên nhãn chai."
  };
};

export const analyzeCropDisease = async (userMessage, imageBase64 = null, extraImages = [], gardenLogs = [], options = {}) => {
  if (!hasRealAi()) {
    // Không có API key/server -> Chạy offline bằng Mock Diagnosis trì hoãn 1 giây cho chân thực
    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockDiagnose(userMessage, imageBase64);
  }

  try {
    const model = GEMINI_MODEL;

    // Gom tất cả ảnh (1 chính + các ảnh phụ)
    const allImages = [imageBase64, ...(extraImages || [])].filter(Boolean);
    const allImagesCount = allImages.length;

    // Tra knowledge base (RAG-lite): lấy hồ sơ bệnh liên quan để AI dựa vào dữ liệu thật
    const knowledgeItems = await fetchKnowledge(userMessage);
    const knowledgeBlock = formatKnowledge(knowledgeItems);

    // Tra DỮ LIỆU MRL CHUẨN (crop × form × market × chemical) để AI đối chiếu khi khuyên hoạt chất
    const mrlItems = await fetchMRLForCrop(userMessage);
    const mrlBlock = formatMRL(mrlItems);

    const promptText = `
Bạn là một Bác sĩ Cây trồng — kỹ sư nông nghiệp Việt Nam chuyên sâu về cà phê, sầu riêng, hồ tiêu (Tây Nguyên). Nhiệm vụ: chẩn đoán bệnh/thiếu dinh dưỡng và đưa phương án điều trị THỰC TẾ, AN TOÀN cho nông dân.

BƯỚC 0 — BẮT BUỘC: NHẬN DIỆN ĐÚNG CÂY TRỒNG. Quan sát kỹ ảnh/mô tả để xác định đây là cây gì (SẦU RIÊNG, CÀ PHÊ, HỒ TIÊU, hoặc cây khác). Nếu có người dùng cho biết cây, ưu tiên theo người dùng; nếu không, tự nhận diện. Nếu KHÔNG chắc chắn loại cây → ghi "crop":"khong_xac_dinh", hạ confidence, và nói rõ cần thêm thông tin. Mọi bước chẩn đoán phải theo đúng cây đã nhận diện.

${(options.vineyardMode === 'other')
  ? `=== PHẠM VI: KHU VỰC / VƯỜN KHÁC ===
Đây là phân tích cho một khu vực KHÁC NGOÀI vườn của nông dân (vườn hàng xóm, vùng mới, mẫu cây mang đến...). TUYỆT ĐỐI KHÔNG áp nhật ký/vườn của nông dân vào đây. Hãy nhận diện cây từ chính ảnh/mô tả, ghi rõ vị trí/khu vực nếu người dùng cung cấp, và phân tích độc lập như một vùng mới. ${options.cropHint ? `Người dùng cho biết cây: ${options.cropHint}.` : ''}`
  : `=== PHẠM VI: VƯỜN CỦA NÔNG DÂN ===
Đây là phân tích cho chính vườn của nông dân. Đối chiếu & bám sát nhật ký/vườn bên dưới để phân tích (phun thuốc, bón phân, tưới mưa...). ${options.cropHint ? `Cây trồng của vườn: ${options.cropHint}. Hãy đối chiếu đúng cây này (vườn có thể xen canh nhiều cây — xác định đúng cây đang được hỏi/chụp).` : ''}`}

=== DỮ LIỆU BỆNH (knowledge base nội bộ — HÃY DỰA VÀO ĐÂY) ===
${knowledgeBlock || '(Không có hồ sơ phù hợp trong knowledge base. Hãy dựa vào kiến thức chuyên môn và ảnh.)'}
=== HẾT DỮ LIỆU BỆNH ===

=== DỮ LIỆU MRL CHUẨN (crop × form × market × chemical → MRL + REI + status + requires_verification) ===
${mrlBlock || '(Không có dữ liệu MRL chuẩn cho cây này.)'}
=== HẾT DỮ LIỆU MRL ===

${options.vineyardMode === 'other'
  ? `=== LƯU Ý: KHÔNG ÁP NHẬT KÝ VƯỜN (vùng ngoài vườn nông dân) ===`
  : `=== NHẬT KÝ VƯỜN GẦN ĐÂY (đã ghi của nông dân — HÃY ĐỐI CHIẾU & PHÂN TÍCH) ===
${formatGardenLogs(gardenLogs) || '(Chưa có nhật ký vườn nào.)'}
=== HẾT NHẬT KÝ VƯỜN ===`}

Đầu vào: ${userMessage ? 'Mô tả: "' + userMessage + '"' : ''}
${allImagesCount > 0 ? `CÓ kèm ${allImagesCount} ảnh (nhiều góc). Hãy QUAN SÁT TẤT CẢ ảnh: đối chiếu lá, thân, quả, mặt trên/dưới để chẩn đoán chính xác hơn.` : 'KHÔNG có ảnh — chỉ dựa vào mô tả; nếu mô tả mơ hồ, nêu rõ độ tin cậy thấp.'}

PHẢI TRẢ LỜI THEO 2 GIAI ĐOẠN TRONG CÙNG PHẢN HỒI (dùng đoạn "reasoning" để ghi rõ quá trình):
1. NHẬN DIỆN CÂY + MÔ TẢ KHÁCH QUAN: xác định loại cây, màu sắc, hình dạng/vị trí đốm, mép lá, gân lá, mặt dưới lá, thân/quả, độ ẩm ước đoán. KHÔNG kết luận vội.
2. CHẨN ĐOÁN & ĐỐI CHIẾU: so sánh đặc điểm vừa mô tả với các bệnh trong dữ liệu tham chiếu + kiến thức chuyên môn. Đưa ra chẩn đoán và CHẨN ĐOÁN PHÂN BIỆT. ${options.vineyardMode === 'other' ? '' : 'ĐỒNG THỜI đối chiếu với NHẬT KÝ VƯỜN: nếu có hoạt động gần đây liên quan (phun thuốc, bón phân, tưới mưa...) hãy phân tích ảnh hưởng qua lại (ví dụ: phun thuốc nấm rồi trời mưa 3 giờ sau → thuốc có bị trôi? cần phun lại?; bón phân hóa học trộn phân vi sinh / vôi trộn phân hóa học → có phản ứng gì? cách bón đúng?).'}

Phản hồi PHẢI là JSON thuần (không \`\`\`json, không chú thích): 
{
  "crop": "sau_rieng" | "cafe" | "ho_tieu" | "khac" | "khong_xac_dinh",
  "crop_name": "Sầu riêng" | "Cà phê" | "Hồ tiêu" | "Cây khác" | "Không xác định",
  "confidence": "cao" | "trung_binh" | "thap",
  "reasoning": "Nhận diện cây + Mô tả khách quan đặc điểm + quá trình suy luận (2-3 câu)",
  "diagnosis": "Tên bệnh hại cụ thể (dễ hiểu, có tên khoa học trong ngoặc)",
  "alternatives": [
    {"name": "Bệnh ứng viên thứ 2", "chance": "xác suất ước đoán %", "why": "vì sao ít khả năng hơn"}
  ],
  "explanation": "Nguyên nhân + cách phân biệt (1-2 câu)",
  "symptoms": ["Triệu chứng quan sát được, 2-4 mục"],
  "protocol": [
    "Bước 1 (an toàn ngay): ...",
    "Bước 2 (xử lý): ...",
    "Bước 3 (phục hồi & phòng ngừa): ..."
  ],
  "active_ingredients": "Ưu tiên SINH HỌC. Nếu hóa chất ghi rõ: tên hoạt chất + nồng độ + cách dùng + thời gian cách ly (REI) + số lần",
  "export_warning": "Ghi chú NGẮN GỌN về chất cấm/hạn chế (nếu có). Đây CHỈ là thông tin phụ tham khảo — KHÔNG được để nó thay đổi/phụ thuộc quy trình điều trị chính."
}

Quy tắc BẮT BUỘC:
1. ƯU TIÊN HÀNG ĐẦU là NHẬN DIỆN ĐÚNG CÂY, rồi CHẨN ĐOÁN ĐÚNG BỆNH và đưa QUY TRÌNH ĐIỀU TRỊ đúng kỹ thuật (bón phân/phun thuốc phù hợp bệnh & giai đoạn). Quy trình này căn cứ vào dữ liệu tham chiếu (knowledge base) + kiến thức nông học — KHÔNG căn cứ vào mối lo MRL xuất khẩu.
2. Khi khuyên dùng một hoạt chất, BẮT BUỘC đối chiếu với DỮ LIỆU MRL CHUẨN ở trên: ghi rõ MRL + REI + trạng thái (cấm/hạn chế/cho phép) theo đúng crop × form × market của hoạt chất đó. Nếu hoạt chất không có trong dữ liệu MRL, ghi rõ "chưa có trong dữ liệu MRL chuẩn — cần kiểm tra".
3. Cấm tư vấn hoạt chất có trạng thái "banned" (cấm) trong dữ liệu MRL. Ưu tiên sinh học.
4. Chỉ lưu ý MRL như thông tin phụ liên quan trực tiếp tới hoạt chất khuyên dùng — không để nó thay đổi quy trình điều trị chính.
5. Ngôn ngữ mộc mạc, gần gũi nông dân; số liệu (liều, REI, nồng độ) cụ thể và an toàn.
6. Nếu ảnh mờ/quá nhỏ/không đủ dữ kiện → confidence="thap", nêu rõ lý do, khuyên liên hệ kỹ sư khuyến nông.
7. output "reasoning" phải mô tả đặc điểm ảnh một cách trung thực — không bịa đặc điểm không nhìn thấy.
    `;

    const contents = [];
    const parts = [{ text: promptText }];

    // Thêm tất cả ảnh (dùng biến allImages đã tính ở trên) thành các inlineData
    for (const img of allImages) {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    contents.push({ parts });

    const { data, quota } = await callGemini(contents, { responseMimeType: 'application/json' });

    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error('Gemini không trả về kết quả.');

    // Parse chuỗi JSON nhận được từ Gemini
    const parsed = JSON.parse(resultText.trim());
    // Đính kèm hạn mức để UI hiển thị "lượt còn lại"
    if (quota) parsed.__quota = quota;
    return parsed;
  } catch (error) {
    // Hết lượt AI (edge function trả 429 limit_reached) → trả object có cờ limit_reached
    if (error?.message === 'limit_reached' || (error?.context?.message || '').includes('limit_reached')) {
      return {
        limit_reached: true,
        diagnosis: 'Bạn đã dùng hết lượt AI hôm nay.',
        explanation: 'Nâng gói Pro để tiếp tục dùng Bác sĩ AI không giới hạn.',
        __quota: error?.context?.__quota || null,
      };
    }
    console.error('Lỗi khi gọi Gemini API:', error);
    // Fallback sang mock chẩn đoán nếu API gặp lỗi mạng/key sai
    return {
      ...mockDiagnose(userMessage, imageBase64),
      diagnosis: `[Lỗi API: Chạy ở chế độ ngoại tuyến] ${mockDiagnose(userMessage, imageBase64).diagnosis}`
    };
  }
};
