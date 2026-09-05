import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  BookOpen, 
  Activity, 
  Users, 
  User, 
  Plus, 
  Camera, 
  ShieldAlert, 
  Send, 
  Check, 
  X, 
  AlertCircle, 
  CloudSun, 
  TrendingUp, 
  Heart, 
  Share2,
  Globe2,
  LogOut,
  Bell,
  BarChart3,
  Loader2,
  AlertTriangle,
  Trees,
  MapPin
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { analyzeCropDisease } from './geminiService';
import { computeAllGardensHealth, computeTodayTasks, fmtDateShort } from './gardenHealth';
import { fetchWeatherData, reverseGeocode, getCurrentPosition, coordsFromProfile, DEFAULT_LABEL } from './weatherService';
import { resolveZoneFromGps, generateSampleZones } from './zoneService';
import { computeAllZonesHealth, ISSUE_STATUS_LABELS } from './zoneHealth';
import WeatherIcon from './WeatherIcon';
import MRLAdvisor from './MRLAdvisor';
import AuthScreen from './AuthScreen';
import VoiceInput from './VoiceInput';
import { parseVoice } from './voiceParse';
import Statistics from './Statistics';
import GardensManager from './GardensManager';
import KBAdmin from './KBAdmin';
import GardenMap from './GardenMap';
import RoleManager from './RoleManager';
import GardenDetail from './GardenDetail';
import { uploadFarmImage } from './storageService';
import { scanReceipt, fileToBase64 } from './receiptScanner';

// Nhãn cho hội thoại voice (bóc tách dữ liệu)
const ACTIVITY_LABEL = {
  bon_phan: '🌱 Bón phân', phun_thuoc: '🧪 Phun thuốc', tuoi_nuoc: '💧 Tưới nước',
  cat_tia: '✂️ Tỉa cành', thu_hoach: '🌾 Thu hoạch', kiem_tra: '🔍 Kiểm tra', khac: '📝 Khác'
};
const CROP_LABEL = { sau_rieng: 'Sầu riêng', cafe: 'Cà phê', ho_tieu: 'Hồ tiêu' };

// ---- Lịch sử chat AI (lưu 5 phiên hội thoại gần nhất vào localStorage) ----
const CHAT_HISTORY_KEY = 'agri_chat_history_v1';
const CHAT_HISTORY_MAX = 5; // 5 phiên gần nhất

const WELCOME_MSG = {
  id: 1,
  sender: 'ai',
  text: 'Xin chào! Tôi là Trợ lý AI nông nghiệp. Hãy mô tả triệu chứng cây trồng (sầu riêng, cà phê, hồ tiêu) hoặc chọn trường hợp thử nghiệm nhanh dưới đây để tôi hỗ trợ chẩn đoán nhé.',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

// Nạp lịch sử chat (mảng các phiên) từ localStorage; trả về mảng phiên (mỗi phiên là mảng messages).
function loadChatSessions() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Không đọc được lịch sử chat:', e);
  }
  return [];
}

function saveChatSessions(sessions) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(-CHAT_HISTORY_MAX)));
  } catch (e) {
    console.warn('Không lưu được lịch sử chat:', e);
  }
}

// Rút gọn chữ ký của một hội thoại (dùng để nhận biết trùng lặp & hiển thị tiêu đề).
function sessionSignature(messages) {
  const firstUser = messages.find((m) => m.sender === 'user');
  if (!firstUser) return 'Trống';
  return (firstUser.text || '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Trống';
}

// Số ngày trôi qua từ một ngày (YYYY-MM-DD) → hôm nay (chuẩn hoá đầu ngày địa phương).
// Dùng cho hiển thị nhật ký "X ngày trước" — căn cứ cho Bác sĩ AI phân tích.
function daysFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const startLog = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const startToday = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.max(0, Math.round((startToday - startLog) / 86400000));
}

// Nhận biết 2 câu hỏi trùng lặp (bỏ dấu, hoa-thường, khoảng trắng).
function normalizeQuestion(q) {  return (q || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/[^\p{L}\p{N}]/gu, ' ') // chỉ giữ chữ & số
    .replace(/\s+/g, ' ')
    .trim();
}

// Độ tương đồng Jaccard giữa 2 chuỗi (theo bộ từ) — dùng để nhận diện câu hỏi trùng lặp.
function similarity(a, b) {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}


export default function App() {
  // Navigation State: 'home', 'logs', 'ai', 'community', 'profile'
  const [activeTab, setActiveTab] = useState('home');
  // Trong tab "Tôi": section hiện tại
  const [profileSection, setProfileSection] = useState('gardens'); // 'gardens' | 'stats' | 'export' | 'profile'
  const [authLoading, setAuthLoading] = useState(true); // Đang kiểm tra phiên đăng nhập
  
  // User Authentication / Profile State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('farmer'); // farmer | admin_v1 | admin_v0
  const [consentChecked, setConsentChecked] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone_number: '',
    address: '',
    farm_area_m2: '',
    latitude: '',
    longitude: '',
    primary_crops: []
  });

  // Phân cấp vai trò: farmer < admin_v1 < admin_v0. Bậc (rank) để so sánh quyền.
  const ROLE_RANK = { farmer: 0, admin_v1: 1, admin_v0: 2 };
  const ROLE_LABEL = { farmer: 'Nông dân', admin_v1: 'Admin V1', admin_v0: 'Admin V0' };
  const userRank = ROLE_RANK[userRole] ?? 0;
  const isAdminV0 = userRank >= 2; // toàn quyền

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logForm, setLogForm] = useState({
    garden_id: null,
    crop_type: 'sau_rieng',
    activity_type: 'bon_phan',
    activity_date: new Date().toISOString().split('T')[0],
    product_name: '',
    dosage: '',
    notes: ''
  });
  const [gardensList, setGardensList] = useState([]); // danh sách vườn của người dùng

  // ---- Zone (Phase A): bác sĩ AI gắn Zone + Issue ----
  const [zonesList, setZonesList] = useState([]); // dữ liệu zones của các vườn
  const [issues, setIssues] = useState([]); // issues đã ghi nhận
  const [aiIssue, setAiIssue] = useState(null); // context phản hồi AI để tạo issue
  const [aiGardenId, setAiGardenId] = useState(null); // vườn đang chọn trong Bác sĩ AI
  const [aiZoneId, setAiZoneId] = useState(null); // zone đã xác định / chọn thủ công
  const [aiZoneStatus, setAiZoneStatus] = useState('idle'); // idle|found|near|none|manual
  const [issueSaving, setIssueSaving] = useState(false);

  // Voice bóc tách dữ liệu (nói → tự điền nhật ký, xác nhận trước khi lưu)
  const [voiceParsed, setVoiceParsed] = useState(null); // kết quả bóc tách, hiện modal xác nhận
  const [voiceParsing, setVoiceParsing] = useState(false);

  // Ghi nhật ký NHANH: chỉ 3 trường bắt buộc (cây, hoạt động, ngày)
  const [quickLog, setQuickLog] = useState({
    crop_type: 'sau_rieng',
    activity_type: 'bon_phan',
    activity_date: new Date().toISOString().split('T')[0]
  });

  // Quét hóa đơn (AI đọc ảnh hóa đơn → tự điền sản phẩm)
  const [receiptProducts, setReceiptProducts] = useState([]); // danh sách sản phẩm từ hóa đơn
  const [receiptOpen, setReceiptOpen] = useState(false); // mở hộp thoại quét
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const receiptInputRef = useRef(null);

  // Yields state (for tracking production)
  const [yields, setYields] = useState([]);
  const [showYieldModal, setShowYieldModal] = useState(false);
  const [yieldForm, setYieldForm] = useState({
    crop_type: 'sau_rieng',
    harvest_date: new Date().toISOString().split('T')[0],
    quantity_kg: '',
    quality_grade: 'Xuất khẩu Loại A',
    notes: ''
  });

  // AI Doctor State — khôi phục phiên hội thoại gần nhất từ localStorage
  const [chatSessions, setChatSessions] = useState(() => loadChatSessions());
  const [chatMessages, setChatMessages] = useState(() => {
    const s = loadChatSessions();
    return s.length > 0 ? s[s.length - 1] : [WELCOME_MSG];
  });
  const [userQuery, setUserQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [chatImage, setChatImage] = useState(null); // Ảnh lá cây chính (base64) — giữ tương thích
  const [chatImages, setChatImages] = useState([]); // Mảng tối đa 3 ảnh gửi cho AI chẩn đoán
  const chatEndRef = useRef(null);
  // Hạn mức AI (lượt còn lại/ngày + gói) — hiển thị cho nông dân
  const [aiQuota, setAiQuota] = useState(null); // { plan, used, limit, remaining }

  // Chế độ phân tích của Bác sĩ AI: 'myGarden' (vườn của nông dân) | 'other' (vùng/vườn khác)
  const [aiMode, setAiMode] = useState('myGarden');

  // Nút send: nhấn = gửi văn bản; NHẤN GIỮ ~2s = nhập thoại (Bác sĩ AI).
  const [aiVoiceOpen, setAiVoiceOpen] = useState(false);   // overlay thoại đang mở
  const [aiVoiceListening, setAiVoiceListening] = useState(false);
  const [aiVoiceText, setAiVoiceText] = useState('');
  const aiRecognitionRef = useRef(null); // Web Speech API cho Bác sĩ AI
  const aiVoiceTextRef = useRef('');
  const sendHoldTimerRef = useRef(null); // hẹn giờ nhấn giữ
  const sendHoldFiredRef = useRef(false); // đã kích hoạt thoại chưa
  const [sendHolding, setSendHolding] = useState(false); // đang giữ nút gửi (hiệu ứng)

  // Community State
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(''); // URL sau khi upload (hoặc dataUrl ở mock)
  const [postImageFile, setPostImageFile] = useState(null); // File ảnh được chọn
  const [postImagePreview, setPostImagePreview] = useState(''); // Ảnh xem trước trước khi đăng
  const [postUploading, setPostUploading] = useState(false);
  const [communityTab, setCommunityTab] = useState('feed'); // 'feed' hoặc 'moderation'

  // Weather State (Open-Meteo — miễn phí, không cần API key)
  const [weather, setWeather] = useState(null); // { temp, humidity, wind, rain, desc, code }
  // Thông tin nguồn vị trí thời tiết: { source: 'gps'|'garden'|'default', label, latitude, longitude }
  const [weatherLoc, setWeatherLoc] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherLocating, setWeatherLocating] = useState(false); // đang bật định vị GPS
  // Thông báo mềm (không chặn) khi không thể định vị — thay cho alert gây phiền
  const [weatherNotice, setWeatherNotice] = useState('');
  // Thời tiết riêng cho từng vườn (theo tọa độ vườn) — map garden_id → weather
  const [gardenWeather, setGardenWeather] = useState({});
  // Vườn đang mở chi tiết (null = chưa mở)
  const [openGardenId, setOpenGardenId] = useState(null);

  // Notifications State (thông báo duyệt bài)
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Load Initial Data
  useEffect(() => {
    fetchUserData().finally(() => setAuthLoading(false));
    fetchLogs();
    fetchYields();
    fetchPosts();
    fetchWeather();
    fetchZones();
    fetchIssues();
    // Tự định vị GPS lần đầu (chỉ khi secure context — HTTPS/localhost — và trình duyệt hỗ trợ).
    // Không bắt buộc: nếu bị từ chối/không hỗ trợ → vẫn dùng tọa độ vườn hoặc mặc định Đắk Lắk.
    if (navigator.geolocation && typeof window !== 'undefined' && window.isSecureContext) {
      const t = setTimeout(() => locateMe(), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Cập nhật thời tiết "theo thời gian thực": tự làm mới mỗi 10 phút (Open-Meteo đổi ~15 phút).
  useEffect(() => {
    const id = setInterval(() => {
      // Làm mới theo đúng nguồn vị trí đang dùng (GPS / vườn / mặc định)
      if (weatherLoc) {
        fetchWeather({ latitude: weatherLoc.latitude, longitude: weatherLoc.longitude, source: weatherLoc.source });
      } else {
        fetchWeather();
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [weatherLoc]);

  // Nạp thông báo của user hiện tại
  const fetchNotifications = async (userId = currentUser?.id) => {
    if (!userId) return;
    const { data } = await supabase.from('notifications')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
    if (data) setNotifications(data);
  };

  // Khi danh sách vườn thay đổi → nạp thời tiết riêng cho từng vườn.
  useEffect(() => {
    if (gardensList.length > 0) fetchAllGardenWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gardensList]);

  // Đánh dấu tất cả đã đọc
  const markAllNotificationsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    }
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Tự lưu lịch sử chat mỗi khi hội thoại thay đổi: cập nhật phiên hiện tại là phiên cuối.
  useEffect(() => {
    setChatSessions((prev) => {
      const next = prev.length === 0 ? [chatMessages] : [...prev.slice(0, -1), chatMessages];
      saveChatSessions(next);
      return next;
    });
  }, [chatMessages]);

  const fetchUserData = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    setCurrentUser(user);

    // Hồ sơ nông hộ lưu ở bảng profiles (Supabase thật) hoặc nhúng sẵn trong user (Mock)
    let profile = user;
    try {
      const { data: profileRows } = await supabase.from('profiles').select().eq('id', user.id);
      if (profileRows && profileRows.length > 0) profile = profileRows[0];
    } catch (e) {
      console.warn('Không tải được hồ sơ từ bảng profiles, dùng thông tin auth:', e);
    }

    setIsAdmin(profile.is_admin || false);
    setUserRole(profile.user_role || (profile.is_admin ? 'admin_v0' : 'farmer'));
    setConsentChecked(profile.consent_granted || false);
    setProfileForm({
      full_name: profile.full_name || '',
      phone_number: profile.phone_number || '',
      address: profile.address || '',
      farm_area_m2: profile.farm_area_m2 || '',
      latitude: profile.latitude || '',
      longitude: profile.longitude || '',
      primary_crops: profile.primary_crops || []
    });
    // Sau khi có tọa độ vườn → cập nhật thời tiết theo vị trí (nếu chưa đang dùng GPS)
    if (profile.latitude && profile.longitude && weatherLoc?.source !== 'gps') fetchWeather();
    // Nạp danh sách vườn (để gắn nhật ký/sản lượng với vườn)
    const { data: gardens } = await supabase.from('gardens').select('*').eq('profile_id', user.id);
    if (gardens) setGardensList(gardens);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('logs').select().order('activity_date', { ascending: false });
    if (data) setLogs(data);
  };

  const fetchYields = async () => {
    const { data } = await supabase.from('yields').select().order('harvest_date', { ascending: false });
    if (data) setYields(data);
  };

  const fetchPosts = async () => {
    const { data } = await supabase.from('posts').select().order('created_at', { ascending: false });
    if (data) setPosts(data);
  };

  const fetchZones = async () => {
    const { data } = await supabase.from('zones').select().order('id', { ascending: true });
    if (data) setZonesList(data);
  };

  const fetchIssues = async () => {
    const { data } = await supabase.from('issues').select().order('created_at', { ascending: false });
    if (data) setIssues(data);
  };

  // Lấy danh sách Zone của một vườn. Ưu tiên dữ liệu DB (zonesList);
  // nếu vườn chưa có zone, sinh nhanh 4 khu mẫu quanh tâm vườn (để hiển thị Zone status sớm).
  const getGardenZones = (garden) => {
    const fromDb = zonesList.filter(z => z.garden_id === garden.id);
    if (fromDb.length > 0) return fromDb;
    const lat = parseFloat(garden.center_lat) || parseFloat(garden.latitude) || 12.6667;
    const lng = parseFloat(garden.center_lng) || parseFloat(garden.longitude) || 108.05;
    return generateSampleZones([lat, lng], 0.02).map((z, i) => ({ ...z, id: -1 - i, garden_id: garden.id }));
  };

  // Thời tiết thật từ Open-Meteo (miễn phí, không cần API key).
  // Ưu tiên 1: tọa độ GPS thực tế của nông dân (định vị).
  // Ưu tiên 2: tọa độ vườn trong hồ sơ nông hộ.
  // Dự phòng: mặc định Đắk Lắk (Buôn Ma Thuột: 12.6667, 108.05).
  const fetchWeather = async (latLng) => {
    let coords;
    if (latLng) {
      coords = latLng;
    } else {
      coords = coordsFromProfile(profileForm.latitude, profileForm.longitude);
    }
    setWeatherLoading(true);
    try {
      const data = await fetchWeatherData(coords.latitude, coords.longitude);
      if (data) {
        setWeather(data);
        // Ghi nhận nguồn vị trí để hiển thị cho nông dân
        let label = '';
        if (coords.source === 'default') {
          label = DEFAULT_LABEL;
        } else if (coords.source === 'garden') {
          label = 'Vườn của bạn';
        } else {
          label = 'Vị trí hiện tại';
        }
        setWeatherLoc({ source: coords.source, label, latitude: coords.latitude, longitude: coords.longitude });
        // Nếu đang lấy từ GPS/public, thử đảo ngược địa chỉ để hiện tên khu vực
        if (coords.source !== 'default') {
          reverseGeocode(coords.latitude, coords.longitude).then((name) => {
            if (name) setWeatherLoc((prev) => (prev ? { ...prev, place: name } : prev));
          });
        }
      }
    } catch (e) {
      console.warn('Không lấy được thời tiết Open-Meteo:', e);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Toạ độ ưu tiên của 1 vườn: center (từ ranh giới) → lat/lng của vườn → mặc định Đắk Lắk.
  const getGardenCoords = (g) => {
    const lat = parseFloat(g?.center_lat) || parseFloat(g?.latitude);
    const lng = parseFloat(g?.center_lng) || parseFloat(g?.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { latitude: lat, longitude: lng };
    return { latitude: 12.6667, longitude: 108.05 }; // Đắk Lắk mặc định
  };

  // Lấy thời tiết theo đúng tọa độ từng vườn (mỗi vườn ở khu vực khác nhau).
  const fetchGardenWeather = async (garden) => {
    if (!garden?.id) return;
    const { latitude, longitude } = getGardenCoords(garden);
    try {
      const data = await fetchWeatherData(latitude, longitude);
      if (data) {
        setGardenWeather((prev) => ({ ...prev, [garden.id]: { ...data, ...getGardenCoords(garden) } }));
      }
    } catch (e) {
      console.warn('Không lấy được thời tiết vườn:', e);
    }
  };

  // Nạp thời tiết cho tất cả vườn (khi coords khác nhau).
  const fetchAllGardenWeather = () => {
    (gardensList || []).forEach((g) => fetchGardenWeather(g));
  };

  // Đọc hạn mức AI hiện tại (gói + lượt đã dùng + còn lại) → hiển thị banner.
  const fetchAiQuota = async () => {
    if (!currentUser?.id) return;
    try {
      const { data: prof } = await supabase.from('profiles')
        .select('plan').eq('id', currentUser.id).maybeSingle();
      const plan = prof?.plan || 'free';
      const limit = plan === 'pro' ? 100 : 5;
      const { data: usage } = await supabase.from('ai_usage')
        .select('request_count').eq('profile_id', currentUser.id)
        .eq('use_date', new Date().toISOString().slice(0, 10)).maybeSingle();
      const used = usage?.request_count || 0;
      setAiQuota({ plan, used, limit, remaining: Math.max(0, limit - used) });
    } catch (e) {
      console.warn('Không đọc được hạn mức AI:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai') fetchAiQuota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentUser?.id]);

  // Bật định vị GPS của nông dân → lấy thời tiết theo vị trí thực tế, theo thời gian thực.
  // Đồng thời điền tọa độ vào hồ sơ (nông dân có thể lưu lại).
  const locateMe = async (e) => {
    e?.preventDefault?.();
    setWeatherNotice('');

    // Trình duyệt chỉ cho phép định vị trên HTTPS hoặc localhost (secure context).
    // Nếu đang mở qua HTTP/IP LAN (không phải secure context) → không thể định vị,
    // nhưng khỏi báo alert chặn: chỉ thông báo mềm + dùng tọa độ đã lưu/mặc định.
    const notSecure = typeof window !== 'undefined' && window.isSecureContext === false;
    if (!navigator.geolocation || notSecure) {
      setWeatherNotice(notSecure
        ? 'Định vị cần HTTPS (hoặc localhost). Đang dùng thời tiết khu vực mặc định/đã lưu.'
        : 'Trình duyệt không hỗ trợ định vị. Đang dùng thời tiết khu vực mặc định/đã lưu.');
      await fetchWeather();
      return;
    }

    setWeatherLocating(true);
    try {
      const pos = await getCurrentPosition();
      // Điền tọa độ vào form hồ sơ để nông dân lưu (lat/lng vốn là chuỗi để hiển thị)
      setProfileForm((prev) => ({ ...prev, latitude: String(pos.latitude), longitude: String(pos.longitude) }));
      await fetchWeather({ ...pos, source: 'gps' });
    } catch (err) {
      console.warn('Không định vị được, dùng tọa độ đã lưu/mặc định:', err);
      setWeatherNotice('Không lấy được vị trí (có thể bạn đã từ chối quyền). Đang dùng thời tiết khu vực mặc định/đã lưu.');
      await fetchWeather();
    } finally {
      setWeatherLocating(false);
    }
  };

  // User Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!consentChecked) {
      alert("Bạn phải đồng ý với cam kết bảo mật thông tin nông hộ để tiếp tục.");
      return;
    }
    const updates = {
      ...profileForm,
      consent_granted: true,
      consent_date: new Date().toISOString()
      // KHÔNG gửi is_admin từ client: quyền admin chỉ do quản trị hệ thống cấp (bảo mật)
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);
    if (!error) {
      alert("Đã cập nhật hồ sơ nông hộ thành công!");
      fetchUserData();
    }
  };

  // Sau khi đăng nhập/đăng ký thành công: tải lại toàn bộ dữ liệu của user
  const handleAuthSuccess = async (user) => {
    setActiveTab('home');
    await fetchUserData();
    const uid = user?.id || currentUser?.id;
    fetchLogs();
    fetchYields();
    fetchPosts();
    fetchMyLikes(uid);
    fetchNotifications(uid);
  };

  // Đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
    setConsentChecked(false);
    setProfileForm({
      full_name: '',
      phone_number: '',
      address: '',
      farm_area_m2: '',
      primary_crops: []
    });
    setLogs([]);
    setYields([]);
    setPosts([]);
    setActiveTab('home');
  };

  // Activity Log Submit
  const handleLogSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('logs').insert([{ ...logForm, profile_id: currentUser?.id }]);
    if (!error) {
      setLogForm({
        ...logForm,
        product_name: '',
        dosage: '',
        notes: ''
      });
      fetchLogs();
      alert("✅ Đã ghi nhật ký chăm sóc thành công!");
    } else {
      console.error('Không ghi được nhật ký:', error);
      alert('⚠️ Không lưu được: ' + (error.message || 'vui lòng thử lại'));
    }
  };

  // ---- Ghi nhật ký nhanh (chỉ 3 trường bắt buộc) ----
  const handleQuickLogSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('logs').insert([{
      ...quickLog,
      profile_id: currentUser?.id
    }]);
    if (!error) {
      fetchLogs();
      alert('✅ Đã ghi nhanh! Bạn có thể bổ sung chi tiết (sản phẩm, liều lượng...) trong nhật ký dưới đây.');
    } else {
      console.error('Lỗi ghi nhanh:', error);
      alert('Lỗi khi ghi nhật ký. Vui lòng thử lại.');
    }
  };

  // ---- Voice bóc tách: nói → parse → hiện xác nhận trước khi điền ----
  const handleVoiceResult = async (text) => {
    setVoiceParsing(true);
    try {
      const parsed = await parseVoice(text);
      if (parsed.activity_type || parsed.crop_type || parsed.product_name || parsed.dosage) {
        setVoiceParsed(parsed);
      } else {
        // Không bóc tách được gì → ghi vào ghi chú
        setLogForm(prev => ({ ...prev, notes: prev.notes ? prev.notes + ' ' + text : text }));
        alert('Không nhận diện được hoạt động. Đã lưu vào ghi chú.');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi khi phân tích giọng nói.');
    } finally {
      setVoiceParsing(false);
    }
  };

  // Xác nhận: áp dữ liệu bóc tách vào form nhật ký
  const applyVoiceParsed = () => {
    const p = voiceParsed;
    setLogForm(prev => ({
      ...prev,
      crop_type: p.crop_type || prev.crop_type,
      activity_type: p.activity_type || prev.activity_type,
      product_name: p.product_name || prev.product_name,
      dosage: p.dosage || prev.dosage,
      notes: p.notes ? (prev.notes ? prev.notes + ' ' + p.notes : p.notes) : prev.notes
    }));
    setVoiceParsed(null);
  };

  // ---- Quét hóa đơn: chọn ảnh → AI đọc → liệt kê sản phẩm ----
  const handleReceiptImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptLoading(true);
    setReceiptError('');
    setReceiptOpen(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await scanReceipt(base64);
      setReceiptProducts(result.products || []);
      if (result.products.length === 0) {
        setReceiptError('Không tìm thấy sản phẩm nông nghiệp trong hóa đơn này.');
      }
    } catch (err) {
      console.error('Lỗi quét hóa đơn:', err);
      setReceiptError(err.message || 'Không đọc được hóa đơn. Vui lòng thử lại.');
    } finally {
      setReceiptLoading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  // Chọn 1 sản phẩm từ hóa đơn → tự điền vào form nhật ký
  const applyReceiptProduct = (p) => {
    setLogForm(prev => ({
      ...prev,
      product_name: p.name || prev.product_name,
      dosage: p.dosage || prev.dosage,
      activity_type: p.type === 'thuoc' ? 'phun_thuoc' : 'bon_phan'
    }));
    setReceiptOpen(false);
    alert(`Đã điền sản phẩm: ${p.name}`);
  };

  // Yield Record Submit
  const handleYieldSubmit = async (e) => {
    e.preventDefault();
    // Validate trước khi gửi
    if (!yieldForm.quantity_kg || isNaN(parseFloat(yieldForm.quantity_kg)) || parseFloat(yieldForm.quantity_kg) <= 0) {
      alert('⚠️ Vui lòng nhập sản lượng (số kg) hợp lệ.');
      return;
    }
    const { error } = await supabase.from('yields').insert([{
      crop_type: yieldForm.crop_type,
      garden_id: yieldForm.garden_id || null,
      harvest_date: yieldForm.harvest_date || new Date().toISOString().split('T')[0],
      quantity_kg: parseFloat(yieldForm.quantity_kg),
      quality_grade: yieldForm.quality_grade || null,
      notes: yieldForm.notes || null,
      profile_id: currentUser?.id
    }]);
    if (!error) {
      setYieldForm({
        crop_type: 'sau_rieng',
        harvest_date: new Date().toISOString().split('T')[0],
        quantity_kg: '',
        quality_grade: 'Xuất khẩu Loại A',
        notes: ''
      });
      setShowYieldModal(false);
      fetchYields();
      alert("✅ Đã ghi nhận sản lượng thành công!");
    } else {
      console.error('Không ghi được sản lượng:', error);
      alert('⚠️ Không lưu được: ' + (error.message || 'vui lòng thử lại'));
    }
  };

  // AI Doctor Query
  const sendToAI = async (queryText, images = []) => {
    if (!queryText.trim() && images.length === 0) return;

    const primaryImage = images[0] || null;
    const extraImages = images.slice(1, 3); // tối đa 3 ảnh

    // Trùng lặp: nếu câu hỏi gần giống một phiên trước, nhắc dùng lại câu trả lời cũ
    // (tiết kiệm chi phí, nhanh, và tránh AI lặp lại).
    const askedText = (queryText || (primaryImage ? 'Ảnh cây trồng' : '')).toLowerCase().trim();
    if (askedText && images.length === 0 && chatSessions.length > 0) {
      const sig = normalizeQuestion(askedText);
      let bestMatch = null;
      let bestScore = 0;
      for (const sess of chatSessions) {
        const sSig = normalizeQuestion(sessionSignature(sess));
        if (!sSig) continue;
        const score = similarity(sig, sSig);
        if (score > bestScore) { bestScore = score; bestMatch = sess; }
      }
      if (bestMatch && bestScore >= 0.7) {
        const aiReplies = bestMatch.filter((m) => m.sender === 'ai' && m.text && !m.text.includes('Xin chào'));
        if (aiReplies.length > 0) {
          const lastReply = aiReplies[aiReplies.length - 1];
          // Chèn câu hỏi người dùng + tái sử dụng câu trả lời trước đó
          setChatMessages(prev => [...prev,
            { ...newUserMessage, id: Date.now() },
            { id: Date.now() + 1, sender: 'ai', text: lastReply.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
          setUserQuery('');
          setChatImages([]);
          setChatImage(null);
          return;
        }
      }
    }

    // Thêm tin nhắn của User
    const newUserMessage2 = {
      id: Date.now(),
      sender: 'user',
      text: queryText || (primaryImage ? '📷 Gửi ảnh cây trồng nhờ chẩn đoán' : ''),
      image: primaryImage,
      images: extraImages,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newUserMessage2]);
    setUserQuery('');
    setChatImages([]);
    setChatImage(null);
    setAiLoading(true);

    try {
      // Chế độ phân tích: vườn của nông dân (bám nhật ký) hay vùng/vườn khác (độc lập).
      const isOther = aiMode === 'other';
      const iGarden = gardensList.find(g => g.id === aiGardenId);
      const cropHint = !isOther && iGarden ? (translateCrop(iGarden.crop_type) || '') : '';
      const response = await analyzeCropDisease(
        queryText, primaryImage, extraImages,
        isOther ? [] : logs,
        { vineyardMode: isOther ? 'other' : 'myGarden', cropHint }
      );

      // Cập nhật hạn mức AI để hiển thị "lượt còn lại" / "hết lượt"
      if (response?.__quota) setAiQuota(response.__quota);
      if (response?.limit_reached) {
        setAiQuota({ plan: 'free', used: 1000, limit: 5, remaining: 0 }); // ép hiển thị "hết lượt"
      }

      // Độ tin cậy
      const confLabel = { cao: 'Cao', trung_binh: 'Trung bình', thap: 'Thấp' };
      const conf = confLabel[response.confidence] || 'Trung bình';
      const confBadge = response.confidence === 'cao' ? '✅' : response.confidence === 'thap' ? '⚠️' : '🔶';

      // Định dạng phản hồi của AI
      const cropEmoji = { sau_rieng: '🌳', cafe: '☕', ho_tieu: '🌿' }[response.crop] || '🌱';
      const cropBadge = response.crop_name
        ? `\n🌿 **Cây nhận diện: ${cropEmoji} ${response.crop_name}**\n`
        : '';
      const aiReplyText = `
${confBadge} **Độ tin cậy chẩn đoán: ${conf}**${cropBadge}
${response.reasoning ? `**🔍 Đặc điểm & suy luận:**
${response.reasoning}

` : ''}**📋 Chẩn đoán:** ${response.diagnosis}

${response.alternatives && response.alternatives.length ? `**⚖️ Chẩn đoán phân biệt:**
${response.alternatives.map(a => `• ${a.name} — ~${a.chance || '?'} (${a.why || ''})`).join('\n')}

` : ''}**💡 Nguyên nhân:** ${response.explanation}

${response.symptoms && response.symptoms.length ? `**👀 Dấu hiệu nhận biết:**
${response.symptoms.map(s => `• ${s}`).join('\n')}

` : ''}**🛠️ Quy trình xử lý:**
${response.protocol.map((step, i) => `${i+1}. ${step}`).join('\n')}

**🧪 Hoạt chất khuyên dùng:** ${response.active_ingredients}

${response.export_warning}

ℹ️ *Đây là gợi ý tham khảo từ AI. Nếu bệnh lan rộng hoặc không cải thiện, hãy liên hệ kỹ sư khuyến nông địa phương.*
      `;

      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiReplyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      // Lưu ngữ cảnh phản hồi AI để có thể "Ghi nhận vấn đề" thành Issue
      setAiIssue({
        response,
        photos: [primaryImage, ...extraImages].filter(Boolean),
        garden_id: aiGardenId,
        zone_id: aiZoneId,
        status: aiZoneStatus,
        query: queryText,
        mode: aiMode,
        crop: response?.crop || null,
        crop_name: response?.crop_name || null
      });
    } catch (err) {
      console.error(err);
      // Error state thân thiện — không hiển thị lỗi kỹ thuật
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: '⚠️ **Chưa kết nối được.**\n\nKiểm tra mạng rồi thử lại nhé. Nếu ảnh bị mờ, hãy chụp lại gần vết bệnh hơn.\n\n*Hoặc liên hệ kỹ sư khuyến nông địa phương.*',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Quick Diagnose Test
  const handleQuickTest = (cropName, issue) => {
    sendToAI(`Cây ${cropName} của tôi bị ${issue}, hãy chẩn đoán và tư vấn giúp tôi.`);
  };

  // ---- Nhập thoại cho Bác sĩ AI (nút send: nhấn giữ ~2s) ----
  const aiStartVoice = () => {
    // Mở overlay trước (kể cả khi micro chưa sẵn sàng), để nông dân thấy phản hồi ngay.
    setAiVoiceOpen(true);
    setAiVoiceListening(true);
    setAiVoiceText('');
    aiVoiceTextRef.current = '';

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setAiVoiceListening(false);
      setAiVoiceText('(Trình duyệt không hỗ trợ nhập thoại — hãy dùng Chrome hoặc Edge)');
      return;
    }

    const rec = new SR();
    aiRecognitionRef.current = rec;
    rec.lang = 'vi-VN';
    rec.continuous = false; // KHÔNG chạy liên tục → tránh lặp từ khi có khoảng dừng
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    rec.onresult = (event) => {
      // Chỉ gộp các kết quả FINAL (đã hoàn chỉnh), còn interim chỉ để xem trước.
      // Không nối chồng → không bị lặp "cây cây sầu cây sầu riêng...".
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const full = (finalText + ' ' + interim).trim();
      aiVoiceTextRef.current = finalText.trim() || interim.trim();
      setAiVoiceText(full);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setAiVoiceText('(Cần cho phép micro trên trình duyệt)');
      else if (e.error === 'no-speech') setAiVoiceText('(Không nghe thấy tiếng nói — thử lại)');
    };
    rec.onend = () => { setAiVoiceListening(false); aiRecognitionRef.current = null; };

    try { rec.start(); } catch (err) {
      console.warn('Không khởi động được nhận diện thoại:', err);
      setAiVoiceListening(false);
      setAiVoiceText('(Không khởi động được micro — thử lại)');
    }
  };

  const aiStopVoice = () => {
    if (aiRecognitionRef.current) aiRecognitionRef.current.stop();
  };

  const aiCancelVoice = () => {
    aiStopVoice();
    setAiVoiceOpen(false);
    setAiVoiceListening(false);
  };

  const aiSendVoice = () => {
    const text = (aiVoiceTextRef.current || '').trim();
    aiStopVoice();
    setAiVoiceOpen(false);
    setAiVoiceListening(false);
    if (text) sendToAI(text, chatImages);
  };

  // Nút send: phân biệt "nhấn" (gửi) vs "nhấn giữ 2s" (thoại)
  const handleSendPointerDown = (e) => {
    if (aiLoading) return;
    e.preventDefault();
    setSendHolding(true);
    sendHoldFiredRef.current = false;
    sendHoldTimerRef.current = setTimeout(() => {
      // Đủ 2s → kích hoạt nhập thoại
      sendHoldFiredRef.current = true;
      setSendHolding(false);
      aiStartVoice();
    }, 2000);
  };
  const handleSendPointerUp = (e) => {
    e.preventDefault();
    clearTimeout(sendHoldTimerRef.current);
    setSendHolding(false);
    if (!sendHoldFiredRef.current) {
      // Nhấn nhanh → gửi văn bản
      sendToAI(userQuery, chatImages);
    }
    sendHoldFiredRef.current = false;
  };
  const handleSendPointerLeave = () => {
    clearTimeout(sendHoldTimerRef.current);
    setSendHolding(false);
  };

  // Ghi nhận vấn đề (Issue) từ phản hồi Bác sĩ AI → gắn với vườn + khu + GPS.
  // Zone.md §12: AI không tự khẳng định bệnh 100% → trạng thái mặc định NEEDS_REVIEW.
  const handleSaveIssue = async () => {
    if (!aiIssue) return;
    if (aiMode !== 'myGarden') {
      alert('⚠️ Vấn đề (Issue) chỉ ghi cho vườn của bạn. Hãy chuyển sang chế độ "Vườn của tôi" rồi chọn vườn/ khu để ghi nhận.');
      return;
    }
    if (!aiGardenId) {
      alert('⚠️ Vui lòng chọn vườn để gắn vấn đề (Zone). Nếu chưa có vườn, hãy tạo vườn trong "Tôi → Vườn".');
      return;
    }
    setIssueSaving(true);
    try {
      const { response, photos, query, crop, crop_name } = aiIssue;
      let lat = null;
      let lng = null;
      // Lấy GPS hiện tại nếu có (có thể thất bại → vẫn lưu issue, GPS để trống)
      try {
        const pos = await getCurrentPosition();
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (e) {
        console.warn('Không lấy được GPS khi ghi vấn đề:', e);
      }
      const issue_type = response?.diagnosis ? response.diagnosis.slice(0, 200) : 'Vấn đề cây trồng';
      const { error } = await supabase.from('issues').insert([{
        profile_id: currentUser?.id,
        garden_id: aiGardenId,
        zone_id: aiZoneId || null,
        issue_type,
        description: [query, crop_name ? `Cây: ${crop_name}` : ''].filter(Boolean).join(' — '),
        photo: photos?.[0] || null,
        latitude: lat,
        longitude: lng,
        ai_result: response || null,
        confidence: response?.confidence || null,
        status: 'NEEDS_REVIEW'
      }]);
      if (!error) {
        await fetchIssues();
        setAiIssue(null);
        alert('✅ Đã ghi nhận vấn đề vào vườn' + (aiZoneId ? ' — khu đã chọn' : '') + '. Trạng thái "Cần kiểm tra" (NEEDS_REVIEW). Bạn có thể theo dõi & xử lý sau.');
      } else {
        console.error('Không ghi được issue:', error);
        alert('⚠️ Không lưu được: ' + (error.message || 'vui lòng thử lại'));
      }
    } catch (err) {
      console.error('Lỗi khi ghi vấn đề:', err);
      alert('⚠️ Đã có lỗi khi lưu. Vui lòng thử lại.');
    } finally {
      setIssueSaving(false);
    }
  };

  // Chọn ảnh lá cây từ camera/thư viện — tối đa 3 ảnh (nhiều góc → chẩn đoán chính xác hơn)
  const handleChatImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = Math.max(0, 3 - chatImages.length);
    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      alert(`⚠️ Chỉ tải được tối đa 3 ảnh. ${remaining === 0 ? 'Đã đủ 3 ảnh — xóa bớt nếu muốn thay.' : `Đã giữ ${remaining} ảnh.`}`);
    }
    let loaded = 0;
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        loaded++;
        setChatImages(prev => prev.length < 3 ? [...prev, reader.result] : prev);
      };
      reader.readAsDataURL(file);
    });
  };

  // Xóa 1 ảnh khỏi danh sách
  const removeChatImage = (index) => {
    setChatImages(prev => prev.filter((_, i) => i !== index));
  };

  // Chọn ảnh vườn để đăng bài (nén trước khi upload để tiết kiệm dung lượng)
  const handlePostImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImageFile(file);
    // Hiện ảnh xem trước ngay khi chọn
    const reader = new FileReader();
    reader.onload = () => setPostImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Quét nội dung bài đăng xem có chứa hoạt chất CẤM không (kiểm duyệt lớp 2 tự động)
  const scanBannedChemicals = async (content) => {
    try {
      const { data: banned } = await supabase
        .from('export_standards')
        .select('chemical_name')
        .eq('status', 'banned');
      if (!banned || banned.length === 0) return null;
      const text = content.toLowerCase();
      const hit = banned.find(b => b.chemical_name && text.includes(b.chemical_name.toLowerCase()));
      return hit ? hit.chemical_name : null;
    } catch (e) {
      console.warn('Không quét được hoạt chất cấm:', e);
      return null;
    }
  };

  // Community Post Submit
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    setPostUploading(true);
    try {
      // Nếu có ảnh → upload lên Storage (hoặc lưu dataUrl ở chế độ mock)
      let imageUrl = newPostImage;
      if (postImageFile) {
        imageUrl = await uploadFarmImage(postImageFile);
      }

      // Kiểm duyệt lớp 2 (tự động): phát hiện hoạt chất cấm trong nội dung
      const flagged = await scanBannedChemicals(newPostContent);

      const { error } = await supabase.from('posts').insert([{
        profile_id: currentUser?.id,
        author_name: currentUser?.full_name || 'Nông dân ẩn danh',
        content: newPostContent,
        image_url: imageUrl || null,
        status: 'pending', // Chờ duyệt trước khi đăng công khai
        flagged_chemical: flagged // NULL nếu không có, tên chất nếu phát hiện
      }]);

      if (!error) {
        setNewPostContent('');
        setNewPostImage('');
        setPostImageFile(null);
        setPostImagePreview('');
        fetchPosts();
        alert(flagged
          ? `⚠️ Bài đăng chứa hoạt chất CẤM (${flagged}) — đã chuyển cho admin kiểm tra kỹ trước khi duyệt.`
          : "Bài đăng đã được gửi thành công! Bài viết của bạn sẽ hiển thị trên bảng tin chung sau khi được Quản trị viên duyệt.");
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi tải ảnh lên: ' + (err.message || 'vui lòng thử lại'));
    } finally {
      setPostUploading(false);
    }
  };

  // Like Community Post — dùng bảng post_likes để chống thích trùng (Phase 2)
  const [myLikes, setMyLikes] = useState([]); // danh sách post_id user đã thích

  const fetchMyLikes = async (userId = currentUser?.id) => {
    if (!userId) return;
    const { data } = await supabase.from('post_likes').select('post_id').eq('profile_id', userId);
    if (data) setMyLikes(data.map(r => r.post_id));
  };

  const handleLikePost = async (postId, currentLikes) => {
    if (!currentUser?.id) return;
    const already = myLikes.includes(postId);
    // 1) Ghi/bỏ ghi lượt thích trong bảng post_likes
    if (already) {
      const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('profile_id', currentUser.id);
      if (error) { console.error('Không bỏ thích được:', error); return; }
      // 2) Giảm likes_count
      await supabase.from('posts').update({ likes_count: Math.max(0, (currentLikes || 0) - 1) }).eq('id', postId);
      setMyLikes(myLikes.filter(id => id !== postId));
    } else {
      const { error } = await supabase.from('post_likes').insert([{ post_id: postId, profile_id: currentUser.id }]);
      if (error) { console.error('Không thích được bài viết:', error); return; }
      // 2) Tăng likes_count
      await supabase.from('posts').update({ likes_count: (currentLikes || 0) + 1 }).eq('id', postId);
      setMyLikes([...myLikes, postId]);
    }
    fetchPosts();
  };

  // Moderation: Approve or Reject (Admin only) + gửi thông báo cho tác giả
  const handleModeratePost = async (postId, newStatus) => {
    const post = posts.find(p => p.id === postId);
    // Dùng .select() để biết chắc có dòng nào thực sự được cập nhật hay không
    // (tránh trường hợp RLS chặn nhưng supabase không báo lỗi → "thành công giả")
    const { error, data: updated } = await supabase.from('posts')
      .update({
        status: newStatus,
        moderated_at: new Date().toISOString(),
        moderator_id: currentUser?.id
      })
      .eq('id', postId)
      .select();
    if (!error && updated && updated.length > 0) {
      fetchPosts();
      // Tạo thông báo cho tác giả khi bài được duyệt/từ chối
      if (post?.profile_id) {
        const isApproved = newStatus === 'approved';
        await supabase.from('notifications').insert([{
          profile_id: post.profile_id,
          title: isApproved ? '✅ Bài đăng của bạn đã được duyệt' : '❌ Bài đăng của bạn bị từ chối',
          body: isApproved
            ? `"${(post.content || '').slice(0, 60)}..." đã được hiển thị trên bảng tin cộng đồng.`
            : `"${(post.content || '').slice(0, 60)}..." không được duyệt. Liên hệ admin để biết chi tiết.`,
          link: 'community'
        }]).then(({ error: notifErr }) => {
          if (notifErr) console.warn('Không gửi được thông báo:', notifErr.message);
        });
      }
      alert(newStatus === 'approved' ? "Đã duyệt bài đăng hiển thị công khai." : "Đã từ chối bài đăng.");
    } else {
      // Không có dòng nào được cập nhật → RLS chặn (người dùng không phải admin thật)
      const reason = error?.message || 'Tài khoản này chưa có quyền quản trị.';
      console.error('Không duyệt được bài viết:', error);
      alert('⚠️ Không thể duyệt: ' + reason + ' Vui lòng đăng nhập bằng tài khoản Admin.');
    }
  };

  // Crop translation helper
  const translateCrop = (crop) => {
    const map = {
      sau_rieng: 'Sầu riêng',
      cafe: 'Cà phê',
      ho_tieu: 'Hồ tiêu'
    };
    return map[crop] || crop;
  };

  // Translate Activity
  const translateActivity = (act) => {
    const map = {
      bon_phan: 'Bón phân',
      phun_thuoc: 'Phun thuốc',
      tuoi_nuoc: 'Tưới nước',
      cat_tia: 'Cắt tỉa cành',
      khac: 'Công việc khác'
    };
    return map[act] || act;
  };

  // Render nội dung bài đăng: tự nhận diện dòng nguồn (chứa URL) → hiển thị link click được
  const renderPostContent = (content) => {
    const lines = (content || '').split('\n');
    return lines.map((line, i) => {
      // Dòng chứa URL nguồn
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[1];
        const before = line.slice(0, line.indexOf(url)).replace(/🔗\s*Nguồn chính thống:\s*/, '');
        return (
          <div key={i} style={{
            fontSize: '12px', marginTop: '8px', background: 'var(--primary-light)',
            padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'
          }}>
            <span style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>🔎 {before || 'Nguồn chính thống'}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'underline', wordBreak: 'break-all' }}>
              Xem nguồn
            </a>
          </div>
        );
      }
      if (!line.trim()) return <div key={i} style={{ height: '4px' }} />;
      return (
        <p key={i} style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          {line}
        </p>
      );
    });
  };

  // Đang kiểm tra phiên đăng nhập
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '48px' }}>🌱</div>
        <div>Đang tải ứng dụng...</div>
      </div>
    );
  }

  // Chưa đăng nhập → hiển thị màn hình Đăng nhập / Đăng ký
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <>
    <div className="animate-fade-in">
      {/* Header */}
      <header className="app-header">
        <div className="app-title-group">
          <span className="app-logo">🌱</span>
          <div>
            <h1>AgriCommunity</h1>
            <div className="app-subtitle">Nông nghiệp khoa học</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {/* Nhãn vai trò (CHỈ ĐỌC — không thể tự đổi, quyền do server quản lý) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span 
              className="status-badge" 
              style={{ 
                border: 'none', 
                cursor: 'default',
                backgroundColor: isAdminV0 ? '#ede7f6' : isAdmin ? '#e8f5e9' : '#e8f5e9',
                color: isAdminV0 ? '#5e35b1' : isAdmin ? '#3949ab' : '#2e7d32',
                fontWeight: 700
              }}
              title={isAdminV0 ? "Toàn quyền — quản lý hệ thống, gán quyền" : isAdmin ? "Quản lý — duyệt bài + xem thống kê" : "Tài khoản nông dân"}
            >
              Vai trò: {ROLE_LABEL[userRole] || 'Nông dân'}
            </span>
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllNotificationsRead(); }}
              title="Thông báo"
              aria-label="Thông báo"
              style={{
                width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--border-color)',
                background: 'white', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', position: 'relative'
              }}
            >
              <Bell size={16} />
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute', top: '-3px', right: '-3px', background: 'var(--error-color)',
                  color: 'white', fontSize: '9px', fontWeight: 700, minWidth: '16px', height: '16px',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px'
                }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <button
              onClick={handleSignOut}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              style={{
                width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--border-color)',
                background: 'white', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          <span style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
            {currentUser?.full_name || currentUser?.phone_number || ''}
          </span>

          {/* Dropdown thông báo */}
          {showNotifications && (
            <div style={{
              position: 'fixed', top: '64px', right: '12px', width: '300px', maxWidth: '90vw',
              maxHeight: '60vh', overflowY: 'auto', background: 'white', borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)', border: '1px solid var(--border-color)',
              zIndex: 200, padding: '12px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                🔔 Thông báo
                <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <X size={16} />
                </button>
              </div>
              {notifications.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>
                  Chưa có thông báo nào.
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
                    background: n.read ? '#fafafa' : 'var(--primary-light)',
                    border: '1px solid var(--border-color)', cursor: 'pointer'
                  }}
                    onClick={() => { setShowNotifications(false); if (n.link) setActiveTab(n.link); }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>{n.body}</div>}
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {new Date(n.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="main-content">
        
        {/* TAB 1: TRANG CHỦ */}
        {activeTab === 'home' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 🏡 Chi tiết một vườn (mở khi bấm vào card vườn) — thay thế nội dung Home */}
            {(() => {
              const g = gardensList.find(x => x.id === openGardenId);
              if (!g) return null;
              const gw = gardenWeather[g.id];
              const logsG = logs.filter(l => l.garden_id === g.id || (l.garden_id == null && l.crop_type === g.crop_type));
              const gz = getGardenZones(g);
              const gh = computeAllGardensHealth([g], logs, weather)[0];
              return (
                <GardenDetail
                  garden={g}
                  gardenWeather={gw}
                  gardenLogs={logsG}
                  zones={gz}
                  zoneHealth={gz.length > 0 ? computeAllZonesHealth(gz, issues, logs, weather) : []}
                  todayTasks={gh ? computeTodayTasks(gh) : []}
                  statusLabel={gh?.statusLabel}
                  statusDot={gh?.dot}
                  onBack={() => setOpenGardenId(null)}
                />
              );
            })()}

            {/* Khi chưa mở chi tiết vườn → hiện nội dung Home đầy đủ (thời tiết toàn cục + Hiểu vườn + ...) */}
            {!openGardenId && (<>
            {/* Weather Widget (dữ liệu thật từ Open-Meteo) — nền đổi theo ngày/đêm */}
            <div className={`card weather-widget ${weather?.isDay === false ? 'weather-widget--night' : ''}`}>
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CloudSun size={20} /> Thời tiết nông vụ hôm nay
                  {weather && (
                    <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: 400 }}>
                      • {weather.isDay === false ? '🌙 Ban đêm' : '☀️ Ban ngày'}
                    </span>
                  )}
                </span>
                <button
                  onClick={locateMe}
                  disabled={weatherLocating}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.35)', color: 'white', borderRadius: '20px',
                    padding: '6px 12px', fontSize: '12px', cursor: weatherLocating ? 'wait' : 'pointer', fontWeight: 600
                  }}
                  title="Lấy thời tiết theo vị trí thực tế của bạn (GPS)"
                >
                  {weatherLocating ? <Loader2 size={13} className="spin" /> : <MapPin size={13} />}
                  {weatherLocating ? 'Đang định vị...' : 'Định vị'}
                </button>
              </div>

              {/* Nguồn vị trí đang dùng */}
              {weatherLoc && (
                <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <MapPin size={12} />
                  <span>
                    {weatherLoc?.place
                      ? `${weatherLoc.place} (${weatherLoc.label})`
                      : weatherLoc.label}
                  </span>
                </div>
              )}

              {/* Thông báo mềm khi không định vị được (không chặn) */}
              {weatherNotice && (
                <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.16)', padding: '7px 10px', borderRadius: '6px', marginTop: '6px', lineHeight: 1.4 }}>
                  ℹ️ {weatherNotice}
                </div>
              )}

              {weather ? (
                <>
                  <div className="weather-info">
                    <div>
                      <div className="weather-temp">{weather.temp}°C</div>
                      <div className="weather-desc">{weather.desc} • Độ ẩm {weather.humidity}%</div>
                    </div>
                    <div style={{ fontSize: '42px' }}><div className="wx-float"><WeatherIcon code={weather.code} isDay={weather.isDay !== false} size={56} /></div></div>
                  </div>
                  <div className="weather-details">
                    <span>💨 Gió: {weather.wind} km/h</span>
                    <span>🌧️ Mưa hiện tại: {weather.rain} mm</span>
                  </div>
                  {/* Khuyến nghị nông vụ theo thời tiết */}
                  <div style={{ fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '8px 12px', borderRadius: '6px', marginTop: '10px' }}>
                    {weather.rain > 0
                      ? '⚠️ Trời mưa ẩm: sầu riêng dễ thối rễ nấm hại. Tránh bón đạm hóa học sát gốc, hạn chế phun thuốc, kiểm tra thoát nước vườn.'
                      : weather.temp >= 34
                        ? '🔥 Trời nắng nóng: tăng cường tưới nước gốc (sáng sớm/chiều mát), che bớt nắng cho cây con, tránh phun thuốc giữa trưa.'
                        : '🌤️ Điều kiện thời tiết thuận lợi cho thăm vườn, ghi nhật ký và phòng trừ sâu bệnh định kỳ.'}
                  </div>
                  {weather.updatedAt && (
                    <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '8px', textAlign: 'right' }}>
                      Cập nhật lúc {new Date(weather.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '13px', opacity: 0.9, padding: '10px 0' }}>
                  {weatherLocating ? 'Đang định vị & cập nhật thời tiết...' : 'Đang cập nhật thời tiết khu vực Đắk Lắk...'}
                </div>
              )}
            </div>

            {/* 🌱 Hôm nay vườn cần làm gì? — trợ lý chăm vườn */}
            <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
              <div className="card-title" style={{ fontSize: '15px' }}>
                🌱 Hôm nay vườn cần làm gì?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Dựa trên thời tiết */}
                {weather?.rain > 0 ? (
                  <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', color: '#e65100', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <strong>🔴 Trời mưa — cần kiểm tra.</strong>
                      <div style={{ marginTop: '2px' }}>Độ ẩm cao → nguy cơ nấm bệnh tăng. Kiểm tra vườn ở khu vực thấp, thoát nước kém.</div>
                      <button className="btn btn-secondary" style={{ marginTop: '8px', padding: '8px', fontSize: '12px' }} onClick={() => setActiveTab('ai')}>
                        🔍 Kiểm tra bằng Bác sĩ AI
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', color: '#2e7d32', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>🟢 Thời tiết thuận lợi.</strong>
                      <div style={{ marginTop: '2px' }}>Có thể thăm vườn, ghi nhật ký hoặc phòng trừ sâu bệnh định kỳ.</div>
                    </div>
                  </div>
                )}

                {/* 🔔 Công việc đề xuất theo TỪNG VƯỜN (rút gọn từ "Hiểu vườn") */}
                {gardensList.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {computeAllGardensHealth(gardensList, logs, weather).filter(h => h.status !== 'good').length === 0 ? (
                      <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', color: '#2e7d32', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <Check size={16} style={{ flexShrink: 0 }} />
                        <div>
                          <strong>✅ Các vườn đều ổn.</strong>
                          <div style={{ marginTop: '2px' }}>Không có việc gì cần ưu tiên hôm nay.</div>
                        </div>
                      </div>
                    ) : (
                      computeAllGardensHealth(gardensList, logs, weather).filter(h => h.status !== 'good').map((h) => {
                        const tasks = computeTodayTasks(h);
                        return (
                          <div key={h.garden.id} onClick={() => setOpenGardenId(h.garden.id)} style={{ cursor: 'pointer', background: h.status === 'risk' ? '#fff3e0' : 'var(--primary-light)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${h.status === 'risk' ? '#e65100' : '#f9a825'}`, borderRadius: '10px', padding: '10px 12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700 }}>{h.dot} {h.cropLabel} — {h.garden.name}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                              {(tasks.length > 0 ? tasks : [{ icon: '💡', text: h.summary, priority: 'trungbinh' }]).map((t, i) => (
                                <div key={i} style={{ fontSize: '12px', color: t.priority === 'cao' ? '#b71c1c' : 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                  <span style={{ flexShrink: 0 }}>{t.icon}</span>
                                  <span style={{ lineHeight: 1.35 }}>{t.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Dựa trên nhật ký gần đây */}
                {logs.length === 0 ? (
                  <div style={{ background: 'var(--primary-light)', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', color: 'var(--primary-dark)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <BookOpen size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>🟡 Chưa ghi hoạt động nào.</strong>
                      <div style={{ marginTop: '2px' }}>Ghi lại lần tưới, bón phân đầu tiên để AgriCommunity hiểu vườn của bạn.</div>
                      <button className="btn btn-secondary" style={{ marginTop: '8px', padding: '8px', fontSize: '12px' }} onClick={() => setActiveTab('logs')}>
                        + Ghi hoạt động
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f5f5f5', border: '1px solid var(--border-color)', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <Check size={16} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>✅ Đã theo dõi {logs.length} hoạt động.</strong>
                      <div style={{ marginTop: '2px' }}>Tiếp tục ghi để có lịch sử canh tác đầy đủ.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 🌱 Hiểu vườn — trạng thái từng vườn theo thời tiết + nhật ký */}
            <div className="card" style={{ borderLeft: '4px solid #e65100' }}>
              <div className="card-title" style={{ fontSize: '15px' }}>
                🌱 Hiểu vườn
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                  (theo thời tiết + nhật ký của bạn)
                </span>
              </div>

              {gardensList.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Chưa có vườn nào để phân tích.{' '}
                  <button className="btn btn-secondary" style={{ marginTop: '10px', padding: '8px 12px', fontSize: '12px' }} onClick={() => setActiveTab('profile')}>
                    + Tạo vườn
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Danh sách vườn gọn — mỗi vườn 1 dòng + "Xem chi tiết" */}
                  {computeAllGardensHealth(gardensList, logs, weather).map((h) => (
                    <div
                      key={h.garden.id}
                      onClick={() => setOpenGardenId(h.garden.id)}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderLeft: `4px solid ${h.status === 'risk' ? '#e65100' : h.status === 'warn' ? '#f9a825' : '#2e7d32'}`,
                        borderRadius: '10px', padding: '12px',
                        background: h.status === 'risk' ? '#fff3e0' : h.status === 'warn' ? '#fffde7' : 'var(--primary-light)',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Dòng 1: tên + trạng thái */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {h.cropLabel} — {h.garden.name}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, flexShrink: 0, marginLeft: '8px' }}>{h.dot} {h.statusLabel}</span>
                      </div>

                      {/* Dòng 2: thời tiết khu vực vườn + việc cần làm */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {(() => {
                          const gw = gardenWeather[h.garden.id];
                          return gw ? <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>{gw.icon} {gw.temp}°C {gw.rain > 0 ? '🌧️' + gw.rain + 'mm' : ''}</span> : null;
                        })()}
                        <span style={{ flex: 1, minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.findings[0]?.text || h.summary}
                        </span>
                      </div>

                      {/* Dòng 3: nút hành động gọn */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); setOpenGardenId(h.garden.id); }}>
                          👁️ Xem chi tiết
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); setActiveTab('logs'); }}>
                          + Ghi nhật ký
                        </button>
                        {h.status !== 'good' && (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', background: '#e65100', border: 'none', color: 'white' }} onClick={(e) => { e.stopPropagation(); setActiveTab('ai'); }}>
                            🔍 Bác sĩ AI
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-primary" onClick={() => setActiveTab('logs')} style={{ height: '70px', borderRadius: '12px' }}>
                <Plus size={20} /> Ghi nhật ký nhanh
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveTab('profile')} style={{ height: '70px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Trees size={20} />
                <span style={{ fontSize: '13px' }}>Quản lý vườn</span>
              </button>
            </div>

            {/* 📊 Tổng hợp sản lượng thu hoạch — tổng + theo từng vườn */}
            <div className="card">
              <div className="card-title">
                <TrendingUp size={20} color="#2e7d32" /> Tổng hợp sản lượng thu hoạch
              </div>

              {/* Tổng cả các vườn (theo loại cây) */}
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-val">{yields.filter(y => y.crop_type === 'sau_rieng').reduce((s, y) => s + (y.quantity_kg || 0), 0).toLocaleString()} kg</div>
                  <div className="stat-lbl">🌳 Sầu riêng (tổng)</div>
                </div>
                <div className="stat-item">
                  <div className="stat-val">{yields.filter(y => y.crop_type === 'cafe').reduce((s, y) => s + (y.quantity_kg || 0), 0).toLocaleString()} kg</div>
                  <div className="stat-lbl">☕ Cà phê (tổng)</div>
                </div>
              </div>

              {/* Theo từng vườn */}
              {gardensList.length > 0 ? (
                <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    📍 Theo từng vườn
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {gardensList.map(g => {
                      const gYields = yields.filter(y => y.garden_id === g.id);
                      const total = gYields.reduce((s, y) => s + (y.quantity_kg || 0), 0);
                      // Gom theo loại cây trong vườn
                      const byCrop = {};
                      gYields.forEach(y => { if (y.crop_type) byCrop[y.crop_type] = (byCrop[y.crop_type] || 0) + (y.quantity_kg || 0); });
                      const crops = Object.entries(byCrop);
                      return (
                        <div key={g.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--primary-light)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{translateCrop(g.crop_type)} — {g.name}</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1b5e20' }}>{total.toLocaleString()} kg</div>
                          </div>
                          {crops.length > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {crops.map(([c, kg]) => `${translateCrop(c)}: ${kg.toLocaleString()} kg`).join(' • ')}
                            </div>
                          )}
                          {total === 0 && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Chưa có dữ liệu thu hoạch.</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setShowYieldModal(true)}>
                + Thêm đợt thu hoạch mới
              </button>
            </div>
            </>)}

          </div>
        )}

        {/* TAB 2: NHẬT KÝ */}
        {activeTab === 'logs' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ⚡ Ghi nhanh — chỉ 3 thao tác */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <div className="card-title" style={{ fontSize: '15px' }}>
                ⚡ Ghi nhanh (30 giây)
              </div>
              <form onSubmit={handleQuickLogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select className="form-select" value={quickLog.crop_type} onChange={e => setQuickLog({ ...quickLog, crop_type: e.target.value })}>
                    <option value="sau_rieng">🌳 Sầu riêng</option>
                    <option value="cafe">☕ Cà phê</option>
                    <option value="ho_tieu">🌿 Hồ tiêu</option>
                  </select>
                  <select className="form-select" value={quickLog.activity_type} onChange={e => setQuickLog({ ...quickLog, activity_type: e.target.value })}>
                    <option value="bon_phan">🌱 Bón phân</option>
                    <option value="tuoi_nuoc">💧 Tưới nước</option>
                    <option value="phun_thuoc">🧪 Phun thuốc</option>
                    <option value="cat_tia">✂️ Tỉa cành</option>
                    <option value="khac">📝 Khác</option>
                  </select>
                </div>
                <input type="date" className="form-input" value={quickLog.activity_date} onChange={e => setQuickLog({ ...quickLog, activity_date: e.target.value })} />
                <button type="submit" className="btn btn-primary">⚡ Lưu nhanh</button>
              </form>
            </div>

            {/* Form Ghi nhật ký chi tiết */}
            <div className="card">
              <div className="card-title"><Plus size={18} /> Ghi hoạt động chi tiết</div>
              <form onSubmit={handleLogSubmit}>
                
                {/* Bộ chọn vườn (nếu đã tạo vườn) */}
                {gardensList.length > 0 && (
                  <div className="form-group">
                    <label>Vườn nào?</label>
                    <select
                      className="form-select"
                      value={logForm.garden_id || ''}
                      onChange={e => {
                        const gid = e.target.value ? parseInt(e.target.value, 10) : null;
                        const g = gardensList.find(x => x.id === gid);
                        setLogForm(prev => ({ ...prev, garden_id: gid, crop_type: g?.crop_type || prev.crop_type }));
                      }}
                    >
                      <option value="">Chọn vườn (tùy chọn)</option>
                      {gardensList.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Vườn / cây gì?</label>
                  <select 
                    className="form-select" 
                    value={logForm.crop_type}
                    onChange={e => setLogForm({...logForm, crop_type: e.target.value})}
                  >
                    <option value="sau_rieng">🌳 Sầu riêng</option>
                    <option value="cafe">☕ Cà phê</option>
                    <option value="ho_tieu">🌿 Hồ tiêu</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Bạn đã làm gì?</label>
                  <select 
                    className="form-select" 
                    value={logForm.activity_type}
                    onChange={e => setLogForm({...logForm, activity_type: e.target.value})}
                  >
                    <option value="bon_phan">🌱 Bón phân</option>
                    <option value="phun_thuoc">🧪 Phun thuốc (trị bệnh / sâu hại)</option>
                    <option value="tuoi_nuoc">💧 Tưới nước</option>
                    <option value="cat_tia">✂️ Cắt tỉa cành / tạo tán</option>
                    <option value="khac">📝 Khác</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ngày làm</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={logForm.activity_date}
                    onChange={e => setLogForm({...logForm, activity_date: e.target.value})}
                    required
                  />
                </div>

                {(logForm.activity_type === 'bon_phan' || logForm.activity_type === 'phun_thuoc') && (
                  <>
                    <div className="form-group">
                      <label>Bạn đã dùng sản phẩm gì?</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ví dụ: Phân NPK Đầu Trâu, Thuốc Anvil 5SC..." 
                        value={logForm.product_name}
                        onChange={e => setLogForm({...logForm, product_name: e.target.value})}
                      />
                      {/* Nút quét hóa đơn */}
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleReceiptImage}
                      />
                      <button
                        type="button"
                        onClick={() => receiptInputRef.current?.click()}
                        style={{
                          marginTop: '8px', width: '100%', padding: '10px', borderRadius: '12px', cursor: 'pointer',
                          fontWeight: 600, fontSize: '13px', border: '2px dashed var(--secondary-color)',
                          background: '#fff8e1', color: '#e65100', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '8px'
                        }}
                        title="Chụp hóa đơn → AI tự đọc tên sản phẩm"
                      >
                        <Camera size={16} /> 📷 Chụp hóa đơn / bao bì cho tự điền
                      </button>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        📸 Chụp ảnh hóa đơn hoặc bao bì → AI đọc tên sản phẩm giúp bạn.
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Bạn dùng bao nhiêu?</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ví dụ: 1kg/gốc hoặc 20ml/bình 20L" 
                        value={logForm.dosage}
                        onChange={e => setLogForm({...logForm, dosage: e.target.value})}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Có điều gì cần ghi lại không? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(không bắt buộc)</span></label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Thời tiết lúc làm, tình trạng sinh trưởng của cây trồng..." 
                    value={logForm.notes}
                    onChange={e => setLogForm({...logForm, notes: e.target.value})}
                  />
                  <VoiceInput
                    onResult={handleVoiceResult}
                    placeholder={voiceParsing ? '⏳ Đang phân tích...' : "🎤 Nói: 'Bón 2kg NPK cho 50 cây sầu riêng'"}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    🎤 Nói câu đầy đủ → AI tự điền cây, hoạt động, sản phẩm, liều lượng.
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">Lưu nhật ký chăm sóc</button>
              </form>
            </div>

            {/* Danh sách toàn bộ nhật ký */}
            <div className="card">
              <div className="card-title"><BookOpen size={18} /> Nhật ký lịch sử chăm sóc</div>
              <div>
                {logs.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '15px' }}>Chưa có nhật ký nào được ghi.</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="log-item">
                      <div className="log-icon">
                        <Activity size={18} />
                      </div>
                      <div className="log-details">
                        <div className="log-title">
                          {translateActivity(log.activity_type)} - <span className={`crop-tag ${log.crop_type}`}>{translateCrop(log.crop_type)}</span>
                        </div>
                        {log.product_name && <div style={{ fontSize: '13px', fontWeight: 500, margin: '2px 0' }}>Vật tư: {log.product_name} ({log.dosage})</div>}
                        {log.notes && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ghi chú: {log.notes}</div>}
                        <div className="log-meta">
                          <span>📅 {log.activity_date}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: BÁC SĨ CÂY TRỒNG AI */}
        {activeTab === 'ai' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="card" style={{ paddingBottom: '12px' }}>
              <div className="card-title" style={{ color: 'var(--primary-dark)' }}>
                🤖 Trợ lý AI Bác sĩ cây trồng
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Chụp ảnh lá/thân/quả có dấu hiệu bất thường để AI hỗ trợ nhận diện sâu bệnh, thiếu chất
                (sầu riêng, cà phê, hồ tiêu). Kết quả mang tính <strong>tham khảo</strong>, không thay thế kiểm tra thực tế của cán bộ kỹ thuật.
              </p>

              {/* 📊 Hạn mức AI / gói dịch vụ */}
              {aiQuota && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  background: aiQuota.remaining <= 0 ? '#fff3e0' : '#e8f5e9',
                  border: `1px solid ${aiQuota.remaining <= 0 ? '#ffe0b2' : '#c8e6c9'}`,
                  borderRadius: '10px', padding: '10px 12px', marginBottom: '10px',
                }}>
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{aiQuota.remaining > 0 ? `🎫 Còn ${aiQuota.remaining} lượt AI hôm nay` : '🚫 Đã hết lượt AI hôm nay'}</span>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>(
                      {aiQuota.plan === 'pro' ? 'Gói Pro' : 'Gói miễn phí'} • đã dùng {aiQuota.used}/{aiQuota.limit}
                    )</span>
                  </div>
                  {aiQuota.remaining <= 0 && (
                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', background: '#e65100', border: 'none', color: 'white' }} onClick={() => setActiveTab('profile')}>
                      ⭐ Nâng cấp Pro
                    </button>
                  )}
                </div>
              )}

              {/* Chế độ phân tích: vườn của tôi (bám nhật ký) ↔ vùng/vườn khác (độc lập) */}
              <div style={{ background: 'var(--primary-light)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: '8px' }}>
                  🗺️ Đang phân tích cho:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setAiMode('myGarden')}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                      border: aiMode === 'myGarden' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: aiMode === 'myGarden' ? '#fff' : 'transparent',
                      color: aiMode === 'myGarden' ? 'var(--primary-dark)' : 'var(--text-secondary)'
                    }}
                    title="Phân tích bám theo nhật ký & vườn đã lưu của bạn"
                  >
                    🌱 Vườn của tôi
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode('other')}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                      border: aiMode === 'other' ? '2px solid var(--secondary-color)' : '1px solid var(--border-color)',
                      background: aiMode === 'other' ? '#fff8e1' : 'transparent',
                      color: aiMode === 'other' ? '#e65100' : 'var(--text-secondary)'
                    }}
                    title="Phân tích độc lập cho vùng/vườn khác — không dùng nhật ký của bạn"
                  >
                    🗺️ Vùng/Vườn khác
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                  {aiMode === 'myGarden'
                    ? <>🌱 AI sẽ đối chiếu <strong>nhật ký + vườn + khu</strong> đã lưu của bạn để phân tích & nhận diện đúng cây.</>
                    : <>🗺️ AI phân tích <strong>độc lập</strong> cho vùng/vườn khác (hàng xóm, mẫu cây mang đến...) — <strong>không</strong> trộn nhật ký vườn của bạn, tránh nhầm lẫn.</>}
                </div>
              </div>

              {/* Lịch sử hội thoại + cuộc trò chuyện mới */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '8px 12px', flexShrink: 0 }}
                  onClick={() => {
                    setChatMessages([WELCOME_MSG]);
                  }}
                  title="Bắt đầu cuộc trò chuyện mới"
                >
                  ✨ Cuộc trò chuyện mới
                </button>
                {chatSessions.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
                    {chatSessions.slice(0, -1).reverse().map((sess, idx) => {
                      const sig = sessionSignature(sess);
                      const isCurrent = sess === chatMessages;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setChatMessages(sess)}
                          style={{
                            fontSize: '11px', padding: '6px 10px', borderRadius: '14px', whiteSpace: 'nowrap',
                            border: '1px solid var(--border-color)', cursor: 'pointer', flexShrink: 0,
                            background: isCurrent ? 'var(--primary-light)' : 'white',
                            color: 'var(--text-secondary)', fontWeight: 600
                          }}
                          title="Mở hội thoại này"
                        >
                          📜 {sig || 'Trống'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 📍 Xác định vị trí / Zone — Bác sĩ AI gắn với vườn & khu (Phase A) — chỉ khi phân tích VƯỜN CỦA TÔI */}
              {aiMode === 'myGarden' && gardensList.length > 0 && (
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <MapPin size={15} /> Ghi nhận vấn đề cho khu vực nào?
                  </div>

                  {/* Chọn vườn */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Vườn</label>
                    <select
                      className="form-select"
                      value={aiGardenId || ''}
                      onChange={(e) => {
                        const gid = e.target.value ? parseInt(e.target.value, 10) : null;
                        setAiGardenId(gid);
                        setAiZoneId(null);
                        setAiZoneStatus(gid ? 'idle' : 'idle');
                      }}
                    >
                      <option value="">Chọn vườn (nếu muốn gắn vấn đề)</option>
                      {gardensList.map(g => (
                        <option key={g.id} value={g.id}>{translateCrop(g.crop_type)} — {g.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Khu (zone) trong vườn đã chọn */}
                  {aiGardenId && (() => {
                    const gZones = zonesList.filter(z => z.garden_id === aiGardenId);
                    const zoneOptions = gZones.length > 0 ? gZones : generateSampleZones(
                      (() => {
                        const g = gardensList.find(x => x.id === aiGardenId);
                        const lat = parseFloat(g?.center_lat) || parseFloat(g?.latitude) || 12.6667;
                        const lng = parseFloat(g?.center_lng) || parseFloat(g?.longitude) || 108.05;
                        return [lat, lng];
                      })(),
                      0.02
                    );
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Khu vực (Zone)</label>
                        <select
                          className="form-select"
                          value={aiZoneId || ''}
                          onChange={(e) => {
                            setAiZoneId(e.target.value ? parseInt(e.target.value, 10) : null);
                            setAiZoneStatus('manual');
                          }}
                        >
                          <option value="">Chọn khu (A/B/C/D?) — hoặc để app tự xác định</option>
                          {zoneOptions.map(z => (
                            <option key={`${z.code}-${z.id || ''}`} value={z.id || z.code}>{z.name || `Khu ${z.code}`}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            setIssueSaving(true);
                            try {
                              const pos = await getCurrentPosition();
                              const gZones2 = zonesList.filter(z => z.garden_id === aiGardenId);
                              const zones2 = gZones2.length > 0 ? gZones2 : generateSampleZones([pos.latitude, pos.longitude], 0.02);
                              const r = resolveZoneFromGps([pos.latitude, pos.longitude], zones2);
                              if (r.status === 'found' && r.zone) {
                                setAiZoneId(r.zone.id ?? r.zone.code);
                                setAiZoneStatus('found');
                              } else if (r.status === 'near') {
                                setAiZoneId(r.candidates[0]?.id ?? r.candidates[0]?.code ?? null);
                                setAiZoneStatus('near');
                              } else {
                                setAiZoneStatus('none');
                              }
                            } catch (err) {
                              console.warn('Không lấy được GPS để xác định khu:', err);
                              setAiZoneStatus('none');
                            } finally {
                              setIssueSaving(false);
                            }
                          }}
                          disabled={issueSaving}
                          style={{ marginTop: '6px', padding: '9px', borderRadius: '10px', border: '2px dashed var(--secondary-color)', background: '#fff8e1', color: '#e65100', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          {issueSaving ? <Loader2 size={15} className="spin" /> : <MapPin size={15} />}
                          {issueSaving ? 'Đang xác định...' : '📍 Tự xác định khu từ vị trí của bạn'}
                        </button>
                        {aiZoneStatus === 'found' && <div style={{ fontSize: '11px', color: '#2e7d32' }}>✅ Đã xác định khu vực từ vị trí của bạn.</div>}
                        {aiZoneStatus === 'near' && <div style={{ fontSize: '11px', color: '#8d6e00' }}>⚠️ Bạn đang ở gần ranh giới. Đã chọn khu gần nhất — bạn có thể sửa ở trên.</div>}
                        {aiZoneStatus === 'none' && <div style={{ fontSize: '11px', color: '#b71c1c' }}>Không xác định được khu (không lấy được vị trí hoặc nằm ngoài khu vực). Vui lòng chọn khu bằng tay.</div>}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Chat Window */}
              <div className="ai-doctor-chat">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`chat-message ${msg.sender}`}>
                    {/* Hiển thị nhiều ảnh trong tin nhắn */}
                    {(msg.image || (msg.images && msg.images.length)) ? (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((msg.image ? 1 : 0) + (msg.images?.length || 0), 3)}, 1fr)`, gap: '6px', marginBottom: '8px' }}>
                        {msg.image && <img src={msg.image} alt="Ảnh cây trồng" className="chat-image-preview" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />}
                        {(msg.images || []).map((img, i) => (
                          <img key={i} src={img} alt={`Ảnh cây trồng ${i + 2}`} className="chat-image-preview" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                        ))}
                      </div>
                    ) : null}
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {/* Xử lý hiển thị Markdown đơn giản trong chat */}
                      {msg.text.split('\n').map((line, i) => {
                        if (line.startsWith('✅ **Độ tin cậy') || line.startsWith('🔶 **Độ tin cậy') || line.startsWith('⚠️ **Độ tin cậy')) {
                          return (
                            <div key={i} style={{
                              background: '#e8f5e9', padding: '8px 12px', borderRadius: '6px', marginTop: '6px',
                              borderLeft: '4px solid #4caf50', fontSize: '13px', fontWeight: 600, color: '#1b5e20'
                            }}>
                              {line.replace(/\*\*/g, '')}
                            </div>
                          );
                        }
                        if (line.startsWith('**📋 Chẩn đoán:**')) return <h4 key={i} style={{ color: '#1b5e20', marginTop: '6px' }}>{line.replace(/\*\*/g, '')}</h4>;
                        if (line.startsWith('**💡 Nguyên nhân:**')) return <p key={i} style={{ marginTop: '4px' }}>{line.replace(/\*\*/g, '')}</p>;
                        if (line.startsWith('**🔍 Đặc điểm & suy luận:**')) return <h5 key={i} style={{ color: '#1565c0', marginTop: '8px' }}>{line.replace(/\*\*/g, '')}</h5>;
                        if (line.startsWith('**⚖️ Chẩn đoán phân biệt:**')) return <h5 key={i} style={{ color: '#6a1b9a', marginTop: '8px' }}>{line.replace(/\*\*/g, '')}</h5>;
                        if (line.startsWith('**👀 Dấu hiệu nhận biết:**')) return <h5 key={i} style={{ color: '#2e7d32', marginTop: '8px' }}>{line.replace(/\*\*/g, '')}</h5>;
                        if (line.startsWith('**🛠️ Quy trình xử lý:**')) return <h5 key={i} style={{ color: '#2e7d32', marginTop: '8px' }}>{line.replace(/\*\*/g, '')}</h5>;
                        if (line.startsWith('**🧪 Hoạt chất khuyên dùng:**')) return <p key={i} style={{ marginTop: '6px', fontWeight: 600 }}>{line.replace(/\*\*/g, '')}</p>;
                        if (line.startsWith('⚠️') || line.startsWith('✅') || line.startsWith('ℹ️') || line.startsWith('🔶')) {
                          const isOk = line.startsWith('✅');
                          const isWarn = line.startsWith('⚠️');
                          return (
                            <div key={i} style={{ 
                              background: isOk ? '#e8f5e9' : isWarn ? '#fff3e0' : '#f5f5f5',
                              padding: '8px 12px', 
                              borderRadius: '6px', 
                              marginTop: '8px',
                              borderLeft: `4px solid ${isOk ? '#4caf50' : isWarn ? '#ff9800' : '#9e9e9e'}`,
                              fontSize: '12px'
                            }}>
                              {line}
                            </div>
                          );
                        }
                        return <div key={i} style={{ margin: '2px 0' }}>{line}</div>;
                      })}
                    </div>
                    <div style={{ fontSize: '9px', opacity: 0.6, textAlign: 'right', marginTop: '4px' }}>{msg.time}</div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="chat-message ai" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="app-logo" style={{ fontSize: '16px' }}>🌱</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      AI đang phân tích<span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Mô tả triệu chứng bệnh ở đây..." 
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendToAI(userQuery, chatImages)}
                  disabled={aiLoading}
                />
                <button 
                  className="btn btn-primary" 
                  style={{ width: '50px', padding: '0', flexShrink: 0, userSelect: 'none', touchAction: 'none', background: sendHolding ? 'var(--primary-dark)' : undefined, transform: sendHolding ? 'scale(0.92)' : undefined, transition: 'all 0.15s' }}
                  onPointerDown={handleSendPointerDown}
                  onPointerUp={handleSendPointerUp}
                  onPointerLeave={handleSendPointerLeave}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={aiLoading}
                  title="Nhấn để gửi • Nhấn giữ 2 giây để nhập thoại"
                >
                  <Send size={18} />
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Send size={12} /> Nhấn để gửi • <span>nhấn giữ nút gửi ~2 giây để <strong>nhập thoại</strong></span>
              </div>

              {/* Chụp ảnh lá cây gửi cho AI chẩn đoán (tối đa 3 ảnh) */}
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label className="camera-box" style={{ flex: 1, padding: '12px', fontSize: '13px' }}>
                  <Camera size={18} />
                  <span>{chatImages.length >= 3 ? 'Đã đủ 3 ảnh' : chatImages.length > 0 ? `Đã chọn ${chatImages.length}/3 — thêm nữa` : 'Chụp ảnh lá cây (tối đa 3)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleChatImageChange}
                    disabled={aiLoading || chatImages.length >= 3}
                  />
                </label>
                {chatImages.length > 0 && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '10px 12px' }}
                    onClick={() => setChatImages([])}
                  >
                    Xóa hết
                  </button>
                )}
              </div>
              {/* Xem trước nhiều ảnh */}
              {chatImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(chatImages.length, 3)}, 1fr)`, gap: '8px', marginTop: '8px' }}>
                  {chatImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={img} alt={`Ảnh lá ${idx + 1}`} className="chat-image-preview" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button
                        onClick={() => removeChatImage(idx)}
                        style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '11px', cursor: 'pointer', lineHeight: '22px', textAlign: 'center' }}
                        aria-label={`Xóa ảnh ${idx + 1}`}
                      >
                        ✕
                      </button>
                      <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '9px', padding: '1px 6px', borderRadius: '6px' }}>
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {chatImages.length > 0 && (
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark)', background: 'var(--primary-light)', padding: '8px 12px', borderRadius: '8px', marginTop: '8px' }}>
                  📸 Đã chọn {chatImages.length}/3 ảnh — gửi kèm mô tả ở trên để AI phân tích nhiều góc chính xác hơn.
                </div>
              )}
              {/* Hướng dẫn chụp ảnh chuẩn để AI nhận diện tốt hơn */}
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                📸 <strong>Mẹo chụp ảnh chuẩn:</strong> chụp gần vết bệnh, đủ sáng, lấy cả <strong>mặt trên + mặt dưới</strong> lá, để rõ màu sắc và tơ/nấm. Gửi 2–3 ảnh (lá, thân, quả) giúp chẩn đoán chính xác hơn.
              </div>
            </div>

            {/* ✅ Ghi nhận vấn đề từ phản hồi AI → tạo Issue (gắn vườn + khu + GPS) */}
            {aiIssue && aiMode === 'myGarden' && (
              <div className="card" style={{ borderLeft: '4px solid #e65100' }}>
                <div className="card-title" style={{ fontSize: '15px' }}>⚠️ Ghi nhận vấn đề này?</div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Lưu lại chẩn đoán của Bác sĩ AI thành một <strong>Issue</strong> gắn với vườn khu vực, để theo dõi & xử lý sau.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', background: 'var(--primary-light)', padding: '8px 12px', borderRadius: '8px', color: 'var(--primary-dark)' }}>
                    <strong>Vườn:</strong> {gardensList.find(g => g.id === aiGardenId)
                      ? `${translateCrop(gardensList.find(g => g.id === aiGardenId).crop_type)} — ${gardensList.find(g => g.id === aiGardenId).name}`
                      : '(chưa chọn)'}
                    {aiZoneId !== null && <> · <strong>Khu:</strong> Khu {typeof aiZoneId === 'string' ? aiZoneId : zonesList.find(z => z.id === aiZoneId)?.code || '?'}</>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#b71c1c' }}>
                    <strong>Chẩn đoán:</strong> {aiIssue.response?.diagnosis || '(không có)'} · Độ tin cậy {aiIssue.response?.confidence || '?'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Trạng thái ban đầu: <strong>Cần kiểm tra (NEEDS_REVIEW)</strong> — bạn sẽ xác nhận / xử lý sau.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleSaveIssue} disabled={issueSaving || !aiGardenId} style={{ fontSize: '13px' }}>
                      {issueSaving ? <Loader2 size={15} className="spin" /> : '✅'} Ghi nhận vấn đề
                    </button>
                    <button className="btn btn-secondary" onClick={() => setAiIssue(null)} style={{ fontSize: '13px' }}>
                      Bỏ qua
                    </button>
                  </div>
                  {!aiGardenId && <div style={{ fontSize: '11px', color: '#e65100' }}>⚠️ Chọn vườn & khu ở phía trên để gắn vấn đề.</div>}
                </div>
              </div>
            )}

            {/* Voice input overlay — nhấn giữ nút gửi ~2s */}
            {aiVoiceOpen && (
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh', zIndex: 1200,
                background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start',
                justifyContent: 'center', overflowY: 'auto', padding: '24px 16px'
              }}>
                <div className="card" style={{
                  width: '100%', maxWidth: '420px', textAlign: 'center', margin: 'auto',
                  maxHeight: '85vh', overflowY: 'auto', animation: 'fadeIn 0.3s ease'
                }}>
                  <div style={{ fontSize: '44px' }}>{aiVoiceListening ? '🎙️' : '🗣️'}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '6px' }}>
                    {aiVoiceListening ? 'Đang nghe... hãy nói câu hỏi của bạn' : 'Đã dừng nghe'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Bác sĩ AI sẽ tự chuyển giọng nói thành câu hỏi gửi.
                  </div>
                  <div style={{
                    margin: '14px 0', minHeight: '60px', maxHeight: '220px', overflowY: 'auto', padding: '12px',
                    borderRadius: '10px', background: 'var(--primary-light)', fontSize: '16px', fontWeight: 600,
                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {aiVoiceText || '…'}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={aiCancelVoice}>✕ Hủy</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={aiSendVoice} disabled={!aiVoiceText.trim()}>
                      ✅ Gửi
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Test Scenarios */}
            <div className="card">
              <div className="card-title" style={{ fontSize: '15px' }}>📌 Thử nghiệm nhanh các bệnh hại mẫu</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'flex-start', fontSize: '13px', padding: '10px' }}
                  onClick={() => handleQuickTest('sầu riêng', 'xì mủ thối gốc')}
                >
                  🍈 Sầu riêng bị xì mủ thối gốc (Phytophthora)
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'flex-start', fontSize: '13px', padding: '10px' }}
                  onClick={() => handleQuickTest('cà phê', 'bột màu vàng rỉ sắt ở mặt dưới lá')}
                >
                  ☕ Cà phê bị bệnh rỉ sắt hại lá
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'flex-start', fontSize: '13px', padding: '10px' }}
                  onClick={() => handleQuickTest('hồ tiêu', 'vàng lá héo rũ chết nhanh')}
                >
                  🌶️ Hồ tiêu bị vàng lá héo rũ chết nhanh
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: CỘNG ĐỒNG */}
        {activeTab === 'community' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Cộng đồng Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
              <button 
                className="btn-secondary" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  border: 'none', 
                  background: communityTab === 'feed' ? 'var(--primary-light)' : 'none',
                  color: communityTab === 'feed' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer'
                }}
                onClick={() => setCommunityTab('feed')}
              >
                Bảng tin chung
              </button>
              <button 
                className="btn-secondary" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  border: 'none', 
                  background: communityTab === 'moderation' ? 'var(--primary-light)' : 'none',
                  color: communityTab === 'moderation' ? 'var(--primary-dark)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onClick={() => setCommunityTab('moderation')}
              >
                Duyệt bài đăng {posts.filter(p => p.status === 'pending').length > 0 && (
                  <span style={{ backgroundColor: 'var(--error-color)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
                    {posts.filter(p => p.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {/* BẢNG TIN CHUNG (FEED) */}
            {communityTab === 'feed' && (
              <>
                {/* Form Đăng bài mới */}
                <div className="card">
                  <div className="card-title">Chia sẻ hình ảnh / thắc mắc của vườn bạn</div>
                  <form onSubmit={handlePostSubmit}>
                    <div className="form-group">
                      <textarea 
                        className="form-textarea" 
                        placeholder="Hôm nay vườn của bạn thế nào? Hãy viết mô tả ngắn..." 
                        value={newPostContent}
                        onChange={e => setNewPostContent(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Ảnh vườn (Tùy chọn)</label>
                      {postImagePreview ? (
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={postImagePreview} 
                            alt="Ảnh vườn đã chọn" 
                            className="post-image" 
                            style={{ maxHeight: '200px', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => { setPostImageFile(null); setPostImagePreview(''); setNewPostImage(''); }}
                            style={{
                              position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)',
                              color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            aria-label="Bỏ ảnh"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="camera-box" style={{ padding: '18px', fontSize: '13px' }}>
                          <Camera size={20} />
                          <span>Chụp / chọn ảnh vườn của bạn</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePostImageChange}
                            disabled={postUploading}
                          />
                        </label>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        📸 Ảnh được nén tự động (≤1024px) để tiết kiệm dung lượng lưu trữ.
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={postUploading}>
                      {postUploading ? 'Đang tải ảnh lên...' : 'Gửi bài đăng (Chờ kiểm duyệt)'}
                    </button>
                  </form>
                </div>

                {/* Danh sách các bài đăng công khai đã duyệt */}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Bài viết từ cộng đồng nông hộ</h3>
                  {posts.filter(p => p.status === 'approved').length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Chưa có bài viết nào được phê duyệt hiển thị.</p>
                  ) : (
                    posts.filter(p => p.status === 'approved').map(post => (
                      <div key={post.id} className="card feed-post">
                        <div className="post-header">
                          <div className="post-avatar">
                            {post.author_name ? post.author_name.charAt(0) : 'N'}
                          </div>
                          <div>
                            <div className="post-author-name">{post.author_name}</div>
                            <div className="post-time">{new Date(post.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>

                        {/* Nội dung bài — tự nhận diện URL nguồn để render thành link click được */}
                        {renderPostContent(post.content)}

                        {post.image_url && (
                          <img src={post.image_url} alt="Garden post" className="post-image" />
                        )}

                        <div className="post-actions">
                          <button 
                            className="post-action-btn"
                            onClick={() => handleLikePost(post.id, post.likes_count)}
                            style={myLikes.includes(post.id) ? { color: '#e53935', fontWeight: 700 } : undefined}
                          >
                            <Heart size={16} fill={myLikes.includes(post.id) ? '#e53935' : 'none'} /> {myLikes.includes(post.id) ? 'Đã thích' : 'Thích'} ({post.likes_count || 0})
                          </button>
                          <button className="post-action-btn">
                            <Share2 size={16} /> Chia sẻ
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* PHÂN HỆ KIỂM DUYỆT (CHO QUẢN TRỊ VIÊN / HỢP TÁC XÃ) */}
            {communityTab === 'moderation' && (
              <div>
                <div style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' }}>
                  💡 **Tính năng Kiểm duyệt trước khi hiển thị:** Tất cả bài viết nông dân gửi lên bảng tin chung phải được kiểm duyệt nội dung bởi Kỹ sư/Ban quản trị để tránh tin rác hoặc thông tin kỹ thuật sai lệch.
                  {!isAdmin && <p style={{ color: 'var(--error-color)', fontWeight: 600, marginTop: '8px' }}>⚠️ Bạn đang xem với vai trò nông dân. Vui lòng bấm vào nút "ADMIN" ở thanh tiêu đề trên cùng để thực hiện duyệt bài.</p>}
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Danh sách bài đăng đang chờ duyệt</h3>
                {posts.filter(p => p.status === 'pending').length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Không có bài viết nào đang chờ duyệt.</p>
                ) : (
                  posts.filter(p => p.status === 'pending').map(post => (
                    <div key={post.id} className="card feed-post" style={{ borderLeft: post.flagged_chemical ? '4px solid var(--error-color)' : '4px solid var(--warning-color)' }}>
                      <div className="post-header">
                        <div className="post-avatar">
                          {post.author_name ? post.author_name.charAt(0) : 'N'}
                        </div>
                        <div>
                          <div className="post-author-name">{post.author_name}</div>
                          <div className="post-time">{new Date(post.created_at).toLocaleDateString()}</div>
                        </div>
                        <span className="status-badge pending">Chờ duyệt</span>
                      </div>

                      {post.flagged_chemical && (
                        <div style={{
                          display: 'flex', gap: '8px', background: '#ffebee', border: '1px solid #ffcdd2',
                          padding: '10px 12px', borderRadius: '10px', fontSize: '12px', color: '#b71c1c', marginBottom: '10px', alignItems: 'flex-start'
                        }}>
                          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>
                            <strong>⚠️ Cảnh báo tự động:</strong> bài viết nhắc tới hoạt chất
                            <strong> {post.flagged_chemical}</strong> (bị CẤM theo danh mục MRL).
                            Hãy kiểm tra kỹ trước khi duyệt — có thể cần từ chối hoặc tư vấn người đăng.
                          </span>
                        </div>
                      )}

                      {renderPostContent(post.content)}

                      {post.image_url && (
                        <img src={post.image_url} alt="Pending garden post" className="post-image" />
                      )}

                      {/* Nút hành động phê duyệt */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--success-color)' }}
                          onClick={() => handleModeratePost(post.id, 'approved')}
                          disabled={!isAdmin}
                        >
                          <Check size={14} /> Duyệt bài viết
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleModeratePost(post.id, 'rejected')}
                          disabled={!isAdmin}
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

        {/* TAB 5: MRL ADVISOR (XUẤT KHẨU) */}
        {activeTab === 'export' && (
          <MRLAdvisor isAdmin={isAdmin} />
        )}

        {/* TAB 6: THỐNG KÊ SẢN LƯỢNG */}
        {activeTab === 'stats' && (
          <Statistics isAdmin={isAdmin} />
        )}

        {/* TAB "TÔI" — menu con: Vườn / Thống kê / Chất cấm / Hồ sơ */}
        {activeTab === 'profile' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Menu con */}
            <div style={{ display: 'flex', background: 'var(--primary-light)', borderRadius: '12px', padding: '4px', overflowX: 'auto' }}>
              {[
                { key: 'gardens', label: '🌳 Vườn' },
                { key: 'stats', label: '📊 Thống kê' },
                { key: 'export', label: '🚫 Chất cấm' },
                { key: 'profile', label: '👤 Hồ sơ' },
                ...(isAdminV0 ? [{ key: 'kb', label: '🧠 KB Admin' }] : []),
                ...(isAdminV0 ? [{ key: 'roles', label: '🔐 Phân quyền' }] : [])
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setProfileSection(s.key)}
                  style={{
                    flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer',
                    fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap',
                    background: profileSection === s.key ? 'white' : 'transparent',
                    color: profileSection === s.key ? 'var(--primary-dark)' : 'var(--text-secondary)',
                    boxShadow: profileSection === s.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Vườn */}
            {profileSection === 'gardens' && <GardensManager />}

            {/* Thống kê — V1 + V0 xem */}
            {profileSection === 'stats' && <Statistics isAdmin={isAdmin} />}

            {/* Chất cấm / tham khảo — mọi người xem; V0 mới sửa */}
            {profileSection === 'export' && <MRLAdvisor isAdmin={isAdminV0} />}

            {/* KB Admin (chỉ V0 toàn quyền) */}
            {profileSection === 'kb' && isAdminV0 && <KBAdmin isAdmin={isAdminV0} onPostPublished={fetchPosts} />}

            {/* Phân quyền người dùng (chỉ V0) */}
            {profileSection === 'roles' && isAdminV0 && <RoleManager currentRole={userRole} onRolesChanged={fetchUserData} />}

            {/* Hồ sơ */}
            {profileSection === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Form Hồ sơ Nông hộ */}
            <div className="card">
              <div className="card-title">Hồ sơ thông tin Nông hộ</div>
              
              <form onSubmit={handleProfileSubmit}>
                
                {/* Thông báo tuân thủ pháp luật */}
                <div className="consent-box">
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <ShieldAlert size={18} color="#e65100" />
                    <strong>Tuân thủ quy định pháp luật (Nghị định 13/2023/NĐ-CP)</strong>
                  </div>
                  Các thông tin dưới đây được thu thập tự nguyện nhằm mục đích quản lý nông vụ nội bộ, phục vụ truy xuất nguồn gốc nông sản xuất khẩu và hỗ trợ tư vấn nông nghiệp số từ hợp tác xã. Chúng tôi cam kết bảo mật tuyệt đối.
                </div>

                <div className="form-group">
                  <label>Họ và tên nông hộ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nhập tên của bạn..." 
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({...profileForm, full_name: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Số điện thoại liên hệ</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="Nhập số điện thoại..." 
                    value={profileForm.phone_number}
                    onChange={e => setProfileForm({...profileForm, phone_number: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Địa chỉ vườn / Tọa độ</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nhập xã, huyện, tỉnh..." 
                    value={profileForm.address}
                    onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Diện tích canh tác (m²)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Ví dụ: 10000" 
                    value={profileForm.farm_area_m2}
                    onChange={e => setProfileForm({...profileForm, farm_area_m2: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Tọa độ vườn (để lấy thời tiết đúng chỗ) — Tùy chọn</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input 
                      type="number" 
                      step="any" 
                      className="form-input" 
                      placeholder="Vĩ độ (lat) VD: 12.6667" 
                      value={profileForm.latitude}
                      onChange={e => setProfileForm({...profileForm, latitude: e.target.value})}
                    />
                    <input 
                      type="number" 
                      step="any" 
                      className="form-input" 
                      placeholder="Kinh độ (lng) VD: 108.05" 
                      value={profileForm.longitude}
                      onChange={e => setProfileForm({...profileForm, longitude: e.target.value})}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={locateMe}
                    disabled={weatherLocating}
                    style={{
                      marginTop: '8px', width: '100%', padding: '9px', borderRadius: '10px', cursor: weatherLocating ? 'wait' : 'pointer',
                      fontWeight: 600, fontSize: '13px', border: '2px dashed var(--secondary-color)',
                      background: '#fff8e1', color: '#e65100', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '8px'
                    }}
                    title="Dùng GPS để tự điền tọa độ vườn của bạn"
                  >
                    {weatherLocating ? <Loader2 size={15} className="spin" /> : <MapPin size={15} />}
                    {weatherLocating ? 'Đang định vị...' : '📍 Lấy vị trí từ GPS'}
                  </button>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    📍 Bấm nút trên (hoặc nhập tay). Để trống — thời tiết mặc định theo khu vực Đắk Lắk.
                  </div>
                </div>

                <div className="form-group">
                  <label>Cây trồng chính canh tác</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <label style={{ fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={profileForm.primary_crops.includes('sau_rieng')}
                        onChange={e => {
                          const crops = [...profileForm.primary_crops];
                          if (e.target.checked) crops.push('sau_rieng');
                          else {
                            const idx = crops.indexOf('sau_rieng');
                            if (idx !== -1) crops.splice(idx, 1);
                          }
                          setProfileForm({...profileForm, primary_crops: crops});
                        }}
                      /> Sầu riêng xuất khẩu
                    </label>
                    <label style={{ fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={profileForm.primary_crops.includes('cafe')}
                        onChange={e => {
                          const crops = [...profileForm.primary_crops];
                          if (e.target.checked) crops.push('cafe');
                          else {
                            const idx = crops.indexOf('cafe');
                            if (idx !== -1) crops.splice(idx, 1);
                          }
                          setProfileForm({...profileForm, primary_crops: crops});
                        }}
                      /> Cà phê nhân
                    </label>
                    <label style={{ fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={profileForm.primary_crops.includes('ho_tieu')}
                        onChange={e => {
                          const crops = [...profileForm.primary_crops];
                          if (e.target.checked) crops.push('ho_tieu');
                          else {
                            const idx = crops.indexOf('ho_tieu');
                            if (idx !== -1) crops.splice(idx, 1);
                          }
                          setProfileForm({...profileForm, primary_crops: crops});
                        }}
                      /> Hồ tiêu xuất khẩu
                    </label>
                  </div>
                </div>

                {/* Checkbox Chấp thuận bảo mật */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="consent-checkbox">
                    <input 
                      type="checkbox" 
                      checked={consentChecked}
                      onChange={e => setConsentChecked(e.target.checked)}
                      required
                    />
                    <span>Tôi đồng ý cung cấp các thông tin nông nghiệp trên để phục vụ chuyển đổi số nông thôn và kết nối thị trường theo quy định của pháp luật hiện hành.</span>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary">Lưu thông tin nông hộ</button>
              </form>
            </div>
            </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL: THÊM SẢN LƯỢNG THU HOẠCH */}
      {showYieldModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100dvh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflowY: 'auto',
          padding: '24px 16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', margin: 'auto', animation: 'fadeIn 0.3s ease' }}>
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <span>📝 Nhập đợt thu hoạch mới</span>
              <button 
                onClick={() => setShowYieldModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleYieldSubmit}>
              <div className="form-group">
                <label>Cây gì?</label>
                <select 
                  className="form-select" 
                  value={yieldForm.crop_type}
                  onChange={e => setYieldForm({...yieldForm, crop_type: e.target.value})}
                >
                  <option value="sau_rieng">🌳 Sầu riêng</option>
                  <option value="cafe">☕ Cà phê</option>
                  <option value="ho_tieu">🌿 Hồ tiêu</option>
                </select>
              </div>

              <div className="form-group">
                <label>Ngày thu hoạch</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={yieldForm.harvest_date}
                  onChange={e => setYieldForm({...yieldForm, harvest_date: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Sản lượng thu hoạch (kg)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Ví dụ: 1500" 
                  value={yieldForm.quantity_kg}
                  onChange={e => setYieldForm({...yieldForm, quantity_kg: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Phân loại chất lượng</label>
                <select 
                  className="form-select" 
                  value={yieldForm.quality_grade}
                  onChange={e => setYieldForm({...yieldForm, quality_grade: e.target.value})}
                >
                  <option value="Xuất khẩu Loại A">Xuất khẩu Loại A</option>
                  <option value="Xuất khẩu Loại B">Xuất khẩu Loại B</option>
                  <option value="Nội địa loại 1">Nội địa loại 1</option>
                  <option value="Nội địa loại 2">Nội địa loại 2</option>
                </select>
              </div>

              <div className="form-group">
                <label>Ghi chú thêm</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Thương lái mua giá bao nhiêu, tỷ lệ rụng nứt vỏ..." 
                  value={yieldForm.notes}
                  onChange={e => setYieldForm({...yieldForm, notes: e.target.value})}
                />
              </div>

              <button type="submit" className="btn btn-primary">Lưu sản lượng</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KẾT QUẢ QUÉT HÓA ĐƠN */}
      {receiptOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex',
          justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '24px 16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', margin: 'auto', maxHeight: '80vh', overflowY: 'auto', animation: 'fadeIn 0.3s ease' }}>
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <span>🧾 Sản phẩm từ hóa đơn</span>
              <button onClick={() => setReceiptOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {receiptLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', padding: '16px 0' }}>
                <Loader2 size={18} className="spin" /> AI đang đọc hóa đơn...
              </div>
            ) : receiptError ? (
              <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b71c1c', padding: '12px', borderRadius: '10px', fontSize: '13px' }}>
                ⚠️ {receiptError}
              </div>
            ) : receiptProducts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>Không tìm thấy sản phẩm nào.</p>
            ) : (
              <>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Bấm chọn sản phẩm để tự điền vào nhật ký:
                </p>
                {receiptProducts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyReceiptProduct(p)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: '8px',
                      borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--primary-light)',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--primary-dark)' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {p.type === 'thuoc' ? '🧪 Thuốc BVTV' : p.type === 'phan' ? '🌱 Phân bón' : '📦 Vật tư'}
                        {p.dosage ? ` • ${p.dosage}` : ''}
                        {p.active_ingredient ? ` • HC: ${p.active_ingredient}` : ''}
                      </div>
                    </div>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '18px' }}>+</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN TỪ GIỌNG NÓI */}
      {voiceParsed && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex',
          justifyContent: 'center', alignItems: 'flex-start',
          overflowY: 'auto', padding: '24px 16px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', margin: 'auto', animation: 'fadeIn 0.3s ease' }}>
            <div className="card-title" style={{ fontSize: '15px' }}>
              🎤 Tôi ghi nhận như sau
            </div>
            <div style={{ background: 'var(--primary-light)', padding: '12px 14px', borderRadius: '10px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--primary-dark)' }}>
                {ACTIVITY_LABEL[voiceParsed.activity_type] || (voiceParsed.activity_type ? voiceParsed.activity_type : '🏷️ Hoạt động')}
                {voiceParsed.crop_type ? ` — ${CROP_LABEL[voiceParsed.crop_type]}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {voiceParsed.product_name && <div>🧪 Sản phẩm: {voiceParsed.product_name}</div>}
                {voiceParsed.dosage && <div>⚖️ Liều lượng: {voiceParsed.dosage}</div>}
                {voiceParsed.area && <div>📍 Khu vực: {voiceParsed.area}</div>}
                {voiceParsed.plant_count && <div>🌱 Số cây: {voiceParsed.plant_count}</div>}
                {voiceParsed.notes && <div>📝 Ghi chú: {voiceParsed.notes}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setVoiceParsed(null)}>✏️ Sửa</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={applyVoiceParsed}>✅ Đúng</button>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <Home />
          Trang chủ
        </button>
        <button 
          className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <BookOpen />
          Nhật ký
        </button>
        <button 
          className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <Activity />
          Bác sĩ AI
        </button>
        <button 
          className={`nav-item ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          <Users />
          Cộng đồng
        </button>
        <button 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User />
          Tôi
        </button>
      </nav>
    </>
  );
}
