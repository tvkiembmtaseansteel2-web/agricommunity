// Supabase Client with LocalStorage Mock Fallback
// Trình kết nối Supabase tự động chuyển sang chế độ Mock dữ liệu ở LocalStorage nếu chưa cấu hình Env.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Khởi tạo Mock Database ở LocalStorage nếu chưa có
const initMockDB = () => {
  if (!localStorage.getItem('agri_gardens')) {
    localStorage.setItem('agri_gardens', JSON.stringify([
      { id: 1, profile_id: 'user-1', name: 'Vườn sầu riêng A', crop_type: 'sau_rieng', area_m2: 12000, plant_count: 320, plant_age_years: 6, latitude: 12.6667, longitude: 108.05, notes: 'Khu A thoát nước kém' },
      { id: 2, profile_id: 'user-1', name: 'Vườn cà phê B', crop_type: 'cafe', area_m2: 8000, plant_count: 1500, plant_age_years: 9, latitude: null, longitude: null, notes: '' }
    ]));
  }

  if (!localStorage.getItem('agri_profiles')) {
    // Tài khoản nông dân mẫu
    localStorage.setItem('agri_profiles', JSON.stringify([
      {
        id: 'user-1',
        phone_number: '0912345678',
        full_name: 'Nguyễn Văn Ruộng',
        address: 'Hợp tác xã sầu riêng Krông Pắc, Đắk Lắk',
        farm_area_m2: 12000,
        primary_crops: ['sau_rieng', 'cafe'],
        consent_granted: true,
        consent_date: new Date().toISOString(),
        is_admin: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'admin-1',
        phone_number: '0900000000',
        full_name: 'Kỹ sư Lâm (Quản trị viên)',
        address: 'Trung tâm khuyến nông Đắk Lắk',
        farm_area_m2: 0,
        primary_crops: [],
        consent_granted: true,
        consent_date: new Date().toISOString(),
        is_admin: true,
        created_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem('agri_logs')) {
    localStorage.setItem('agri_logs', JSON.stringify([
      {
        id: 1,
        profile_id: 'user-1',
        crop_type: 'sau_rieng',
        activity_type: 'bon_phan',
        activity_date: '2026-08-20',
        product_name: 'Phân bón NPK 15-15-15',
        dosage: '1.5 kg / gốc',
        notes: 'Bón thúc đợt 2 sau khi tỉa cành tạo tán',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        profile_id: 'user-1',
        crop_type: 'cafe',
        activity_type: 'phun_thuoc',
        activity_date: '2026-08-25',
        product_name: 'Thuốc trừ nấm Hexaconazole (Anvil)',
        dosage: '20ml / bình 20L',
        notes: 'Phun phòng bệnh rỉ sắt mùa mưa',
        created_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem('agri_yields')) {
    localStorage.setItem('agri_yields', JSON.stringify([
      {
        id: 1,
        profile_id: 'user-1',
        crop_type: 'sau_rieng',
        harvest_date: '2025-07-15',
        quantity_kg: 8500,
        quality_grade: 'Xuất khẩu Loại A',
        revenue_vnd: 595000000,
        notes: 'Được giá tốt 70,000đ/kg thu mua tại vườn',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        profile_id: 'user-1',
        crop_type: 'cafe',
        harvest_date: '2025-11-20',
        quantity_kg: 3200,
        quality_grade: 'Cà phê nhân xô',
        revenue_vnd: 288000000,
        notes: 'Phơi sấy kỹ, độ ẩm đạt 12.5%',
        created_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem('agri_posts')) {
    localStorage.setItem('agri_posts', JSON.stringify([
      {
        id: 1,
        profile_id: 'user-1',
        author_name: 'Nguyễn Văn Ruộng',
        content: 'Năm nay thời tiết mưa nhiều quá, bà con chú ý thăm vườn kiểm tra nấm hồng trên sầu riêng nhé. Vườn nhà em vừa phun phòng bằng hoạt chất Metalaxyl xong, hi vọng ổn áp.',
        image_url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80',
        status: 'approved',
        likes_count: 12,
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 2,
        profile_id: 'user-1',
        author_name: 'Trần Văn Tiêu',
        content: 'Hồ tiêu nhà em bị vàng lá héo chậm nhiều quá, có bác nào có kinh nghiệm trị bệnh này chia sẻ em với ạ. Dùng thuốc hóa học nhiều sợ ảnh hưởng tiêu chuẩn xuất khẩu sang EU.',
        image_url: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?auto=format&fit=crop&w=600&q=80',
        status: 'pending',
        likes_count: 0,
        created_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem('agri_export_standards')) {
    localStorage.setItem('agri_export_standards', JSON.stringify([
      { crop_type: 'sau_rieng', market: 'China', chemical_name: 'Carbendazim', mrl_ppm: 0.5, status: 'restricted', rei_days: 21, notes: 'Giới hạn chặt chẽ, khuyên dùng hoạt chất sinh học thay thế' },
      { crop_type: 'sau_rieng', market: 'China', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'CẤM hoàn toàn nhập khẩu sầu riêng có dư lượng chất này' },
      { crop_type: 'sau_rieng', market: 'China', chemical_name: 'Metalaxyl', mrl_ppm: 0.1, status: 'restricted', rei_days: 30, notes: 'Trị nấm Phytophthora nhưng phải tính đủ thời gian cách ly' },
      { crop_type: 'sau_rieng', market: 'China', chemical_name: 'Dimethoate', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'CẤM — thuốc trừ sâu độc cao' },
      { crop_type: 'sau_rieng', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'EU cấm toàn cầu từ 2020' },
      { crop_type: 'sau_rieng', market: 'EU', chemical_name: 'Carbendazim', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Không có MRL cho phép — xem như cấm' },
      { crop_type: 'cafe', market: 'EU', chemical_name: 'Glyphosate', mrl_ppm: 0.1, status: 'restricted', rei_days: 45, notes: 'EU kiểm soát cực kỳ nghiêm ngặt thuốc trừ cỏ này' },
      { crop_type: 'cafe', market: 'EU', chemical_name: 'Ochratoxin A', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Độc tố nấm mốc - yêu cầu phơi sấy đạt chuẩn' },
      { crop_type: 'cafe', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'Cấm toàn cầu' },
      { crop_type: 'cafe', market: 'EU', chemical_name: 'Hexaconazole', mrl_ppm: 0.01, status: 'restricted', rei_days: 30, notes: 'Trị rỉ sắt nhưng MRL rất thấp — ưu tiên phòng ngừa' },
      { crop_type: 'cafe', market: 'US', chemical_name: 'Chlorpyrifos', mrl_ppm: 0.1, status: 'restricted', rei_days: 30, notes: 'Mỹ còn cho phép ở mức thấp (khác EU)' },
      { crop_type: 'ho_tieu', market: 'EU', chemical_name: 'Metalaxyl', mrl_ppm: 0.05, status: 'restricted', rei_days: 30, notes: 'Thường dùng trị nấm nhưng EU giới hạn dư lượng rất thấp' },
      { crop_type: 'ho_tieu', market: 'EU', chemical_name: 'Carbendazim', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'CẤM hoàn toàn' },
      { crop_type: 'ho_tieu', market: 'EU', chemical_name: 'Chlorpyrifos', mrl_ppm: -1, status: 'banned', rei_days: null, notes: 'CẤM hoàn toàn' }
    ]));
  }
};

// Tạo Mock Client
class MockSupabase {
  constructor() {
    initMockDB();
    // Khôi phục phiên đăng nhập đã lưu (nếu có); mặc định CHƯA đăng nhập để hiện màn hình login
    const savedId = localStorage.getItem('agri_current_user_id');
    const profiles = JSON.parse(localStorage.getItem('agri_profiles')) || [];
    this.currentUser = savedId ? profiles.find(p => p.id === savedId) || null : null;
  }

  get auth() {
    return {
      getUser: async () => {
        return { data: { user: this.currentUser }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        // Mock đăng nhập bằng SĐT (lấy số điện thoại thay cho email); không kiểm tra mật khẩu
        const profiles = JSON.parse(localStorage.getItem('agri_profiles'));
        const user = profiles.find(p => p.phone_number === email);
        if (user) {
          this.currentUser = user;
          localStorage.setItem('agri_current_user_id', user.id);
          return { data: { user }, error: null };
        }
        return { data: null, error: { message: 'Không tìm thấy số điện thoại này!' } };
      },
      signUp: async ({ email, password, options }) => {
        const profiles = JSON.parse(localStorage.getItem('agri_profiles'));
        const phone = email; // dùng email làm SĐT
        if (profiles.some(p => p.phone_number === phone)) {
          return { data: null, error: { message: 'Số điện thoại này đã được đăng ký!' } };
        }
        const newUser = {
          id: 'user-' + Date.now(),
          phone_number: phone,
          full_name: options.data.full_name,
          address: options.data.address || '',
          farm_area_m2: options.data.farm_area_m2 || 0,
          primary_crops: options.data.primary_crops || [],
          consent_granted: options.data.consent_granted || false,
          consent_date: new Date().toISOString(),
          is_admin: false,
          created_at: new Date().toISOString()
        };
        profiles.push(newUser);
        localStorage.setItem('agri_profiles', JSON.stringify(profiles));
        this.currentUser = newUser;
        localStorage.setItem('agri_current_user_id', newUser.id);
        return { data: { user: newUser }, error: null };
      },
      signOut: async () => {
        this.currentUser = null;
        localStorage.removeItem('agri_current_user_id');
        return { error: null };
      }
    };
  }

  from(table) {
    const key = `agri_${table}`;
    const getItems = () => JSON.parse(localStorage.getItem(key)) || [];
    const setItems = (items) => localStorage.setItem(key, JSON.stringify(items));

    return {
      select: (columns = '*') => {
        let data = getItems();
        
        // Mô phỏng bộ lọc cơ bản
        return {
          eq: (field, value) => {
            data = data.filter(item => item[field] === value);
            return {
              order: (sortField, { ascending = true } = {}) => {
                data.sort((a, b) => {
                  if (a[sortField] < b[sortField]) return ascending ? -1 : 1;
                  if (a[sortField] > b[sortField]) return ascending ? 1 : -1;
                  return 0;
                });
                return { data, error: null };
              },
              data,
              error: null
            };
          },
          order: (sortField, { ascending = true } = {}) => {
            data.sort((a, b) => {
              if (a[sortField] < b[sortField]) return ascending ? -1 : 1;
              if (a[sortField] > b[sortField]) return ascending ? 1 : -1;
              return 0;
            });
            return { data, error: null };
          },
          data,
          error: null
        };
      },
      insert: async (newRow) => {
        const data = getItems();
        const row = Array.isArray(newRow) ? newRow[0] : newRow;
        const insertedRow = {
          id: Date.now(),
          profile_id: this.currentUser?.id || 'user-1',
          created_at: new Date().toISOString(),
          ...row
        };
        data.push(insertedRow);
        setItems(data);
        return { data: [insertedRow], error: null };
      },
      update: (updates) => makeFilterChain((filters) => {
        const data = getItems();
        const updatedData = data.map(item => {
          if (filters.every(([f, v]) => item[f] === v)) {
            return { ...item, ...updates, updated_at: new Date().toISOString() };
          }
          return item;
        });
        setItems(updatedData);
        return { data: updatedData.filter(item => filters.every(([f, v]) => item[f] === v)), error: null };
      }),
      delete: () => makeFilterChain((filters) => {
        const data = getItems();
        const removed = data.filter(item => filters.every(([f, v]) => item[f] === v));
        setItems(data.filter(item => !filters.every(([f, v]) => item[f] === v)));
        return { data: removed, error: null };
      })
    };
  }
}

// Tạo chuỗi điều kiện .eq() nhiều cấp + thenable (mô phỏng supabase-js)
function makeFilterChain(executor) {
  const filters = [];
  const chain = {
    eq(field, value) {
      filters.push([field, value]);
      return chain;
    },
    then(resolve, reject) {
      try { resolve(executor(filters)); } catch (e) { reject(e); }
    }
  };
  return chain;
}

// Xuất Client thật hoặc Mock Client dựa trên cấu hình môi trường
let supabase;
let IS_MOCK = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Đang kết nối tới Supabase Cloud thực tế.');
  } catch (e) {
    console.warn('Lỗi khi kết nối Supabase, sử dụng Mock Database thay thế:', e);
    IS_MOCK = true;
    supabase = new MockSupabase();
  }
} else {
  console.log('Chưa cấu hình Supabase URL/Key. Ứng dụng tự động chạy ở chế độ Mock LocalStorage.');
  IS_MOCK = true;
  supabase = new MockSupabase();
}

export { supabase, IS_MOCK };
