/* ==========================================================================
   ARENA POS v5.1 — PlayStation Lounge, Cafe Tables & Direct POS System
   Features:
   - Supabase Live Sync + LocalStorage Cache + Offline Queue
   - Detailed Single & Multi Time/Cost Tracking per Session
   - Multi-Client Notah (Credit) Split Payment on Checkout
   - Thermal Receipt Printing (80mm / 58mm) with Subtotal, Discount & Breakdown
   - Room Selection Modal when Starting from Reservations
   - Unified Shift & Dashboard Financials + Full Expense Tracking
   - Management Password Lock, Business Day Correction & Data Reset Controls
   ========================================================================== */

const STORAGE_KEYS = {
  URL: 'arena_sb_url',
  KEY: 'arena_sb_key',
  LOCAL_DB: 'arena_local_db_v4',
  SYNC_QUEUE: 'arena_sync_queue_v4',
  SESSION_USER: 'arena_session_user_v4'
};

const DEFAULT_ROOMS = [
  { id: 'room-1', name: 'Room 1', device: 'PS5', singleRate: 50, multiRate: 70, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] },
  { id: 'room-2', name: 'Room 2', device: 'PS5', singleRate: 50, multiRate: 70, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] },
  { id: 'room-3', name: 'Room 3', device: 'PS5', singleRate: 50, multiRate: 70, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] },
  { id: 'room-4', name: 'Room 4', device: 'PS5', singleRate: 50, multiRate: 70, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] },
  { id: 'room-5', name: 'Room 5', device: 'PS5', singleRate: 60, multiRate: 80, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] },
  { id: 'room-6', name: 'VIP Room', device: 'PS5', singleRate: 80, multiRate: 110, status: 'idle', mode: 'Single', game: 'FC 26', timeType: 'open', fixedMinutes: 60, startTime: null, accumulatedElapsedMs: 0, accumulatedCost: 0, singleElapsedMs: 0, singleCost: 0, multiElapsedMs: 0, multiCost: 0, clientName: '', clientPhone: '', orders: [] }
];

const DEFAULT_TABLES = [
  { id: 'tbl-1', name: 'ترابيزة 1', status: 'idle', clientName: '', openedAt: null, orders: [] },
  { id: 'tbl-2', name: 'ترابيزة 2', status: 'idle', clientName: '', openedAt: null, orders: [] },
  { id: 'tbl-3', name: 'ترابيزة 3', status: 'idle', clientName: '', openedAt: null, orders: [] },
  { id: 'tbl-4', name: 'ترابيزة 4', status: 'idle', clientName: '', openedAt: null, orders: [] }
];

const DEFAULT_MENU = [
  { id: 'm-1', name: 'إسبريسو', category: 'قهوة', price: 25, cost: 8, stock: 100, minStock: 10, unit: 'كوب', icon: 'coffee' },
  { id: 'm-2', name: 'قهوة تركي', category: 'قهوة', price: 20, cost: 6, stock: 100, minStock: 10, unit: 'فنجان', icon: 'coffee' },
  { id: 'm-3', name: 'فرنساوي', category: 'قهوة', price: 25, cost: 8, stock: 100, minStock: 10, unit: 'فنجان', icon: 'coffee' },
  { id: 'm-4', name: 'كابتشينو', category: 'قهوة', price: 35, cost: 12, stock: 80, minStock: 10, unit: 'كوب', icon: 'coffee' },
  { id: 'm-5', name: 'شاي', category: 'مشروبات ساخنة', price: 15, cost: 3, stock: 150, minStock: 15, unit: 'كوب', icon: 'tea' },
  { id: 'm-6', name: 'ينسون / نعناع', category: 'مشروبات ساخنة', price: 15, cost: 4, stock: 100, minStock: 10, unit: 'كوب', icon: 'tea' },
  { id: 'm-7', name: 'هوت شوكليت', category: 'مشروبات ساخنة', price: 35, cost: 12, stock: 60, minStock: 8, unit: 'كوب', icon: 'coffee' },
  { id: 'm-8', name: 'آيس لاتيه', category: 'آيس كوفي', price: 40, cost: 14, stock: 60, minStock: 8, unit: 'كوب', icon: 'iced' },
  { id: 'm-9', name: 'آيس موكا', category: 'آيس كوفي', price: 45, cost: 16, stock: 60, minStock: 8, unit: 'كوب', icon: 'iced' },
  { id: 'm-10', name: 'بيبسي كانز', category: 'صودا ومياه', price: 20, cost: 13, stock: 96, minStock: 12, unit: 'علبة', icon: 'can' },
  { id: 'm-11', name: 'سفن أب / ميرندا', category: 'صودا ومياه', price: 20, cost: 13, stock: 72, minStock: 12, unit: 'علبة', icon: 'can' },
  { id: 'm-12', name: 'مياه معدنية', category: 'صودا ومياه', price: 10, cost: 5, stock: 120, minStock: 20, unit: 'زجاجة', icon: 'water' },
  { id: 'm-13', name: 'ريد بول', category: 'صودا ومياه', price: 55, cost: 38, stock: 48, minStock: 6, unit: 'علبة', icon: 'can' },
  { id: 'm-14', name: 'ميلك شيك أوريو', category: 'سموزي وميلك شيك', price: 50, cost: 18, stock: 40, minStock: 5, unit: 'كوب', icon: 'iced' },
  { id: 'm-15', name: 'سموزي مانجو', category: 'سموزي وميلك شيك', price: 45, cost: 16, stock: 40, minStock: 5, unit: 'كوب', icon: 'juice' },
  { id: 'm-16', name: 'شيبسي عائلي', category: 'سناكس وحلويات', price: 20, cost: 14, stock: 50, minStock: 8, unit: 'كيس', icon: 'snack' },
  { id: 'm-17', name: 'وافل نوتيلا', category: 'سناكس وحلويات', price: 55, cost: 20, stock: 30, minStock: 5, unit: 'قطعة', icon: 'sweet' }
];

const DEFAULT_GAMES = ['FC 26', 'FC 25', 'eFootball PES', 'GTA V', 'Mortal Kombat 1', 'Tekken 8', 'Spider-Man 2', 'Call of Duty'];

const DEFAULT_USERS = [
  { id: 'usr-admin', name: 'المدير (Admin)', pin: '0000', role: 'admin' },
  { id: 'usr-cashier1', name: 'كاشير 1', pin: '1234', role: 'staff' }
];

const DEFAULT_SETTINGS = {
  brandTitle: 'ARENA POS',
  mgmtPassword: '0000',
  ownerWhatsapp: '',
  receiptPaperSize: '80mm',
  receiptFontSize: 'normal',
  receiptLogo: '',
  receiptHeader: 'ARENA PLAYSTATION & CAFE\nأهلاً بكم في أرينا',
  receiptFooter: 'شكراً لزيارتكم - نتمنى لكم وقتاً ممتعاً!',
  games: [...DEFAULT_GAMES]
};

let supabaseClient = null;
let isOnline = navigator.onLine;
let mgmtUnlocked = false;
let timerInterval = null;

const state = {
  currentUser: null,
  rooms: [],
  tables: [],
  menu: [],
  clients: [],
  notahLedger: [],
  reservations: [],
  shifts: [],
  transactions: [],
  expenses: [],
  handovers: [],
  users: [],
  settings: { ...DEFAULT_SETTINGS },
  directCart: [],
  posCart: [],
  cafeCategory: 'الكل',
  posCategory: 'الكل',
  checkout: {
    type: null, // 'room' | 'table' | 'direct'
    targetId: null,
    title: '',
    items: [],
    roomTimeCost: 0,
    ordersCost: 0,
    subtotal: 0,
    discount: 0,
    grandTotal: 0,
    singleMs: 0,
    singleCost: 0,
    multiMs: 0,
    multiCost: 0,
    gameName: '',
    totalDurationMs: 0,
    notahSplits: [] // [{ id, clientId, amount }]
  },
  pendingReservationId: null
};

/* ==========================================================================
   HELPERS & UTILITIES
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function fmtMoney(val) {
  const num = Math.round((Number(val) || 0) * 100) / 100;
  return `${num % 1 === 0 ? num : num.toFixed(1)} ج.م`;
}

function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getArabicDayName(dateStr) {
  if (!dateStr) return '';
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? '' : days[dt.getDay()];
}

function formatTimeShort(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTimeAr(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTimerClock(ms) {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDurationAr(ms) {
  const totalMins = Math.max(0, Math.round((ms || 0) / 60000));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins} دقيقة`;
  if (mins === 0) return `${hrs} ساعة`;
  return `${hrs} س و ${mins} د`;
}

function showToast(msg, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function openModal(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

function getActiveShift() {
  return state.shifts.find((s) => s.status === 'open') || null;
}

function getCurrentBusinessDate() {
  const active = getActiveShift();
  return active ? active.business_date : getTodayDateStr();
}

/* ==========================================================================
   LOCAL CACHE & SUPABASE SYNC ENGINE
   ========================================================================== */
function saveLocalDB() {
  try {
    const payload = {
      rooms: state.rooms,
      tables: state.tables,
      menu: state.menu,
      clients: state.clients,
      notahLedger: state.notahLedger,
      reservations: state.reservations,
      shifts: state.shifts,
      transactions: state.transactions,
      expenses: state.expenses,
      handovers: state.handovers,
      users: state.users,
      settings: state.settings
    };
    localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }
}

function loadLocalDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DB);
    if (!raw) {
      state.rooms = JSON.parse(JSON.stringify(DEFAULT_ROOMS));
      state.tables = JSON.parse(JSON.stringify(DEFAULT_TABLES));
      state.menu = JSON.parse(JSON.stringify(DEFAULT_MENU));
      state.users = JSON.parse(JSON.stringify(DEFAULT_USERS));
      state.settings = { ...DEFAULT_SETTINGS, games: [...DEFAULT_GAMES] };
      saveLocalDB();
      return;
    }
    const db = JSON.parse(raw);
    state.rooms = Array.isArray(db.rooms) && db.rooms.length ? db.rooms.map(normalizeRoom) : JSON.parse(JSON.stringify(DEFAULT_ROOMS));
    state.tables = Array.isArray(db.tables) && db.tables.length ? db.tables : JSON.parse(JSON.stringify(DEFAULT_TABLES));
    state.menu = Array.isArray(db.menu) && db.menu.length ? db.menu : JSON.parse(JSON.stringify(DEFAULT_MENU));
    state.clients = Array.isArray(db.clients) ? db.clients : [];
    state.notahLedger = Array.isArray(db.notahLedger) ? db.notahLedger : [];
    state.reservations = Array.isArray(db.reservations) ? db.reservations : [];
    state.shifts = Array.isArray(db.shifts) ? db.shifts : [];
    state.transactions = Array.isArray(db.transactions) ? db.transactions : [];
    state.expenses = Array.isArray(db.expenses) ? db.expenses : [];
    state.handovers = Array.isArray(db.handovers) ? db.handovers : [];
    state.users = Array.isArray(db.users) && db.users.length ? db.users : JSON.parse(JSON.stringify(DEFAULT_USERS));
    state.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
    if (!Array.isArray(state.settings.games) || !state.settings.games.length) {
      state.settings.games = [...DEFAULT_GAMES];
    }
  } catch (e) {
    console.error('Error loading local DB:', e);
  }
}

function normalizeRoom(r) {
  const singleMs = Number(r.singleElapsedMs) || 0;
  const multiMs = Number(r.multiElapsedMs) || 0;
  const singleCost = Number(r.singleCost) || 0;
  const multiCost = Number(r.multiCost) || 0;
  const accMs = Number(r.accumulatedElapsedMs) || (singleMs + multiMs);
  const accCost = Number(r.accumulatedCost) || (singleCost + multiCost);
  return {
    ...r,
    singleElapsedMs: singleMs,
    singleCost: singleCost,
    multiElapsedMs: multiMs,
    multiCost: multiCost,
    accumulatedElapsedMs: accMs,
    accumulatedCost: accCost,
    orders: Array.isArray(r.orders) ? r.orders : []
  };
}

function getSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE) || '[]');
  } catch {
    return [];
  }
}

function setSyncQueue(q) {
  localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(q));
  updateSyncBadge();
}

function updateSyncBadge() {
  const q = getSyncQueue();
  const btn = $('syncQueueBtn');
  const cnt = $('syncQueueCount');
  if (!btn || !cnt) return;
  if (q.length > 0) {
    cnt.textContent = q.length;
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function queueCloudSync(table, action, payload) {
  saveLocalDB();
  if (!supabaseClient) return;
  const q = getSyncQueue();
  q.push({ id: uid('sq'), table, action, payload, ts: Date.now() });
  setSyncQueue(q);
  if (navigator.onLine) {
    flushSyncQueue();
  }
}

async function flushSyncQueue() {
  if (!supabaseClient || !navigator.onLine) return;
  const q = getSyncQueue();
  if (!q.length) return;
  const remaining = [];
  for (const job of q) {
    try {
      if (job.action === 'upsert') {
        const { error } = await supabaseClient.from(job.table).upsert(job.payload);
        if (error) throw error;
      } else if (job.action === 'delete') {
        const { error } = await supabaseClient.from(job.table).delete().eq('id', job.payload.id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn('Sync job deferred:', job.table, err.message);
      remaining.push(job);
    }
  }
  setSyncQueue(remaining);
  if (remaining.length === 0) {
    showToast('تمت مزامنة البيانات مع السحابة ✅', 'success');
  }
}

async function pullFromSupabase() {
  if (!supabaseClient || !navigator.onLine) return;
  try {
    const tablesToFetch = [
      { key: 'rooms', table: 'arena_rooms', normalize: normalizeRoom },
      { key: 'tables', table: 'arena_tables' },
      { key: 'menu', table: 'arena_menu' },
      { key: 'clients', table: 'arena_clients' },
      { key: 'notahLedger', table: 'arena_notah_ledger' },
      { key: 'reservations', table: 'arena_reservations' },
      { key: 'shifts', table: 'arena_shifts' },
      { key: 'transactions', table: 'arena_transactions' },
      { key: 'expenses', table: 'arena_expenses' },
      { key: 'handovers', table: 'arena_handovers' },
      { key: 'users', table: 'arena_users' }
    ];

    for (const item of tablesToFetch) {
      const { data, error } = await supabaseClient.from(item.table).select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        state[item.key] = item.normalize ? data.map(item.normalize) : data;
      }
    }

    const { data: settingsData, error: setErr } = await supabaseClient.from('arena_settings').select('*').eq('id', 'main').maybeSingle();
    if (!setErr && settingsData && settingsData.data) {
      state.settings = { ...DEFAULT_SETTINGS, ...settingsData.data };
    }

    saveLocalDB();
    renderAll();
  } catch (e) {
    console.warn('Supabase pull skipped (using local cache):', e.message);
  }
}

function updateConnectionUI() {
  isOnline = navigator.onLine;
  const badge = $('connectionBadge');
  const text = $('connectionText');
  const loginHint = $('loginOfflineHint');
  if (badge && text) {
    badge.className = `status-badge ${isOnline ? 'online' : 'offline'}`;
    text.textContent = isOnline ? 'متصل Live' : 'أوفلاين (محلي)';
  }
  if (loginHint) {
    loginHint.classList.toggle('hidden', isOnline);
  }
  updateSyncBadge();
}

/* ==========================================================================
   INITIALIZATION & AUTHENTICATION
   ========================================================================== */
async function initApp() {
  loadLocalDB();
  updateConnectionUI();

  window.addEventListener('online', () => {
    updateConnectionUI();
    flushSyncQueue();
  });
  window.addEventListener('offline', updateConnectionUI);

  const sbUrl = localStorage.getItem(STORAGE_KEYS.URL);
  const sbKey = localStorage.getItem(STORAGE_KEYS.KEY);

  if (sbUrl && sbKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(sbUrl, sbKey);
    } catch (e) {
      console.error('Supabase init error:', e);
    }
  }

  bindEvents();

  if (!sbUrl || !sbKey) {
    $('setupScreen').classList.remove('hidden');
    return;
  }

  if (supabaseClient && navigator.onLine) {
    await flushSyncQueue();
    await pullFromSupabase();
  }

  populateLoginUsers();

  const savedUserRaw = sessionStorage.getItem(STORAGE_KEYS.SESSION_USER);
  if (savedUserRaw) {
    try {
      state.currentUser = JSON.parse(savedUserRaw);
      enterMainApp();
      return;
    } catch { /* ignore */ }
  }

  $('loginScreen').classList.remove('hidden');
}

function populateLoginUsers() {
  const sel = $('loginUserSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- دخول سريع بالرقم السري / الباسورد --</option>';
  state.users.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.name} (${u.role === 'admin' ? 'مدير' : 'كاشير'})`;
    sel.appendChild(opt);
  });
}

function handleLogin() {
  const selectedId = $('loginUserSelect').value;
  const pin = $('loginPin').value.trim();
  const errEl = $('loginError');

  let matchedUser = null;
  if (selectedId) {
    matchedUser = state.users.find((u) => u.id === selectedId && String(u.pin) === pin);
  } else {
    matchedUser = state.users.find((u) => String(u.pin) === pin);
  }

  if (!matchedUser) {
    errEl.classList.remove('hidden');
    return;
  }

  errEl.classList.add('hidden');
  $('loginPin').value = '';
  state.currentUser = matchedUser;
  sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, JSON.stringify(matchedUser));
  enterMainApp();
}

function enterMainApp() {
  $('setupScreen').classList.add('hidden');
  $('loginScreen').classList.add('hidden');
  $('mainApp').classList.remove('hidden');

  $('currentUserBadge').textContent = `${state.currentUser.name} (${state.currentUser.role === 'admin' ? 'مدير' : 'كاشير'})`;
  $('brandTitleHeader').textContent = state.settings.brandTitle || 'ARENA POS';

  mgmtUnlocked = false;
  updateMgmtLockUI();
  renderAll();
  startLiveTimers();
}

function handleLogout() {
  state.currentUser = null;
  mgmtUnlocked = false;
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_USER);
  if (timerInterval) clearInterval(timerInterval);
  $('mainApp').classList.add('hidden');
  populateLoginUsers();
  $('loginScreen').classList.remove('hidden');
}

/* ==========================================================================
   MANAGEMENT PASSWORD & TABS NAVIGATION
   ========================================================================== */
function openMgmtAuthModal(targetTab = 'dashboard') {
  if (mgmtUnlocked) {
    switchTab(targetTab);
    return;
  }
  $('mgmtTargetTab').value = targetTab;
  $('mgmtPasswordInput').value = '';
  $('mgmtAuthError').classList.add('hidden');
  openModal('modalMgmtAuth');
  setTimeout(() => $('mgmtPasswordInput').focus(), 80);
}

function verifyMgmtPassword() {
  const entered = $('mgmtPasswordInput').value.trim();
  const adminUsers = state.users.filter((u) => u.role === 'admin');
  const validAdminPin = adminUsers.some((u) => String(u.pin) === entered);
  const validMgmtPass = entered && entered === String(state.settings.mgmtPassword || '0000');

  if (!validAdminPin && !validMgmtPass) {
    $('mgmtAuthError').classList.remove('hidden');
    return;
  }

  mgmtUnlocked = true;
  closeModal('modalMgmtAuth');
  updateMgmtLockUI();
  const target = $('mgmtTargetTab').value || 'dashboard';
  switchTab(target);
  showToast('تم فتح صلاحيات الإدارة بنجاح 🔓', 'success');
}

function lockManagement() {
  mgmtUnlocked = false;
  updateMgmtLockUI();
  switchTab('rooms');
  showToast('تم قفل الإدارة 🔒', 'info');
}

function updateMgmtLockUI() {
  const pill = $('mgmtLockIndicator');
  if (pill) {
    pill.className = `mgmt-pill ${mgmtUnlocked ? 'unlocked' : 'locked'}`;
    pill.textContent = mgmtUnlocked ? '🔓 الإدارة مفتوحة' : '🔒 الإدارة مقفولة';
  }

  const protectedSections = [
    { gate: 'dashboardLockedGate', content: 'dashboardUnlockedContent' },
    { gate: 'reportsLockedGate', content: 'reportsUnlockedContent' },
    { gate: 'settingsLockedGate', content: 'settingsUnlockedContent' }
  ];

  protectedSections.forEach(({ gate, content }) => {
    const gEl = $(gate);
    const cEl = $(content);
    if (gEl && cEl) {
      gEl.classList.toggle('hidden', mgmtUnlocked);
      cEl.classList.toggle('hidden', !mgmtUnlocked);
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  if (tabName === 'dashboard' && mgmtUnlocked) {
    populateDashboardFilters();
    renderDashboard();
  } else if (tabName === 'reports' && mgmtUnlocked) {
    populateReportFilters();
    renderReports();
  } else if (tabName === 'settings' && mgmtUnlocked) {
    renderSettings();
  } else if (tabName === 'shift') {
    renderShiftTab();
  } else if (tabName === 'clients') {
    renderClientsTab();
  } else if (tabName === 'reservations') {
    renderReservationsTab();
  } else if (tabName === 'cafe') {
    renderDirectCafePOS();
  }
}

/* ==========================================================================
   ROOM TIMERS & SINGLE / MULTI DETAILED COST CALCULATION
   ========================================================================== */
function getRoomLiveMetrics(room) {
  let singleMs = Number(room.singleElapsedMs) || 0;
  let singleCost = Number(room.singleCost) || 0;
  let multiMs = Number(room.multiElapsedMs) || 0;
  let multiCost = Number(room.multiCost) || 0;

  let activeSegMs = 0;
  if (room.status === 'running' && room.startTime) {
    activeSegMs = Math.max(0, Date.now() - new Date(room.startTime).getTime());
  }

  const activeRate = room.mode === 'Multi' ? Number(room.multiRate) : Number(room.singleRate);
  const activeSegCost = (activeSegMs / 3600000) * activeRate;

  if (room.mode === 'Multi') {
    multiMs += activeSegMs;
    multiCost += activeSegCost;
  } else {
    singleMs += activeSegMs;
    singleCost += activeSegCost;
  }

  const totalMs = singleMs + multiMs;
  const rawTimeCost = singleCost + multiCost;
  const roundedSingleCost = Math.round(singleCost);
  const roundedMultiCost = Math.round(multiCost);
  const roundedTimeCost = Math.round(rawTimeCost);

  const ordersCost = (room.orders || []).reduce((sum, o) => sum + (Number(o.price) * Number(o.qty)), 0);
  const grandTotal = roundedTimeCost + ordersCost;

  let remainingMs = null;
  let isExpired = false;
  if (room.timeType === 'fixed' && room.fixedMinutes) {
    const targetMs = Number(room.fixedMinutes) * 60000;
    remainingMs = targetMs - totalMs;
    if (remainingMs <= 0 && (room.status === 'running' || room.status === 'paused')) {
      isExpired = true;
    }
  }

  return {
    totalMs,
    singleMs,
    singleCost: roundedSingleCost,
    multiMs,
    multiCost: roundedMultiCost,
    timeCost: roundedTimeCost,
    ordersCost,
    grandTotal,
    remainingMs,
    isExpired
  };
}

function startLiveTimers() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    state.rooms.forEach((room) => {
      if (room.status !== 'running' && room.status !== 'paused') return;
      const metrics = getRoomLiveMetrics(room);
      const clockEl = document.getElementById(`room-clock-${room.id}`);
      const subEl = document.getElementById(`room-sub-${room.id}`);
      const timeCostEl = document.getElementById(`room-tcost-${room.id}`);
      const totalEl = document.getElementById(`room-total-${room.id}`);
      const cardEl = document.getElementById(`room-card-${room.id}`);

      if (clockEl) {
        if (room.timeType === 'fixed' && metrics.remainingMs !== null) {
          clockEl.textContent = metrics.remainingMs > 0
            ? formatTimerClock(metrics.remainingMs)
            : `انتهى الوقت (+${formatTimerClock(Math.abs(metrics.remainingMs))})`;
        } else {
          clockEl.textContent = formatTimerClock(metrics.totalMs);
        }
      }
      if (subEl) {
        subEl.textContent = room.timeType === 'fixed'
          ? `منقضي: ${formatDurationAr(metrics.totalMs)} / ${room.fixedMinutes} د`
          : `وقت مفتوح (${room.mode})`;
      }
      if (timeCostEl) timeCostEl.textContent = fmtMoney(metrics.timeCost);
      if (totalEl) totalEl.textContent = fmtMoney(metrics.grandTotal);
      if (cardEl && metrics.isExpired && !cardEl.classList.contains('status-expired')) {
        cardEl.classList.add('status-expired');
      }
    });
  }, 1000);
}

/* ==========================================================================
   ROOMS RENDERING & SESSION CONTROLS
   ========================================================================== */
function renderRoomsTab() {
  const grid = $('roomsGrid');
  const bar = $('roomsSummaryBar');
  if (!grid || !bar) return;

  const runningCount = state.rooms.filter((r) => r.status === 'running' || r.status === 'paused').length;
  const idleCount = state.rooms.length - runningCount;

  bar.innerHTML = `
    <div class="summary-chip">🎮 إجمالي الغرف: <strong>${state.rooms.length}</strong></div>
    <div class="summary-chip" style="color:var(--ps-cyan)">🔥 شغالة حالياً: <strong>${runningCount}</strong></div>
    <div class="summary-chip" style="color:var(--success)">✅ متاحة: <strong>${idleCount}</strong></div>
  `;

  grid.innerHTML = state.rooms.map((room) => {
    const isIdle = room.status === 'idle';
    const metrics = getRoomLiveMetrics(room);
    const statusClass = isIdle
      ? 'status-idle'
      : metrics.isExpired
        ? 'status-expired'
        : room.status === 'paused'
          ? 'status-paused'
          : 'status-running';

    if (isIdle) {
      return `
        <div id="room-card-${room.id}" class="ps5-card ${statusClass}" ondblclick="openStartRoomModal('${room.id}')" title="اضغط مرتين لتشغيل الغرفة">
          <div class="ps5-led-strip"></div>
          <div class="ps5-card-inner">
            <div class="ps5-card-top">
              <span class="ps5-room-name">${room.name}</span>
              <span class="ps5-device-tag">${room.device || 'PS5'}</span>
            </div>
            <div class="ps5-idle-body">
              <div class="ps5-console-emblem">🎮</div>
              <div class="ps5-idle-status">متاحة الآن</div>
              <div class="ps5-dblclick-hint">اضغط مرتين (Double Click) للتشغيل</div>
              <div style="margin-top:10px;">
                <button type="button" class="btn btn-primary btn-xs" onclick="event.stopPropagation();openStartRoomModal('${room.id}')">▶️ تشغيل الغرفة</button>
              </div>
            </div>
            <div class="ps5-rates-footer">
              <span>Single: <strong>${room.singleRate} ج</strong></span>
              <span>Multi: <strong>${room.multiRate} ج</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    const clockText = room.timeType === 'fixed' && metrics.remainingMs !== null
      ? (metrics.remainingMs > 0 ? formatTimerClock(metrics.remainingMs) : `انتهى (+${formatTimerClock(Math.abs(metrics.remainingMs))})`)
      : formatTimerClock(metrics.totalMs);

    const hasSwitched = (metrics.singleMs > 0 && metrics.multiMs > 0);
    const periodBadge = hasSwitched
      ? `<span class="meta-pill" style="border-color:var(--warning);color:var(--warning);">S+M مدمج</span>`
      : '';

    return `
      <div id="room-card-${room.id}" class="ps5-card ${statusClass}">
        <div class="ps5-led-strip"></div>
        <div class="ps5-card-inner">
          <div class="ps5-card-top">
            <span class="ps5-room-name">${room.name}</span>
            <span class="ps5-device-tag">${room.device || 'PS5'}</span>
          </div>

          <div class="ps5-session-meta">
            <span class="meta-pill">${room.mode === 'Multi' ? '👥 Multi' : '👤 Single'}</span>
            <span class="meta-pill">🕹️ ${room.game || 'PS5'}</span>
            ${periodBadge}
            ${room.clientName ? `<span class="meta-pill">👤 ${room.clientName}</span>` : ''}
          </div>

          <div class="ps5-timer-display">
            <span id="room-clock-${room.id}">${clockText}</span>
            <span id="room-sub-${room.id}" class="ps5-timer-sub">${room.status === 'paused' ? '⏸️ متوقف مؤقتاً' : `بدأ ${formatTimeShort(room.startTime)}`}</span>
          </div>

          <div class="ps5-cost-breakdown">
            <div>لعب: <strong id="room-tcost-${room.id}">${fmtMoney(metrics.timeCost)}</strong></div>
            <div>طلبات (${(room.orders || []).reduce((s, o) => s + o.qty, 0)}): <strong>${fmtMoney(metrics.ordersCost)}</strong></div>
            <div>الإجمالي: <strong id="room-total-${room.id}">${fmtMoney(metrics.grandTotal)}</strong></div>
          </div>

          <div class="ps5-actions-grid">
            <button type="button" class="btn btn-primary btn-sm" onclick="openPosOrdersModal('room', '${room.id}')">☕ طلبات</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="openSwitchModeModal('${room.id}')">🔄 تبديل S/M</button>
            <button type="button" class="btn btn-warning btn-sm" onclick="togglePauseRoom('${room.id}')">${room.status === 'paused' ? '▶️ استكمال' : '⏸️ إيقاف'}</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="cancelRoomSession('${room.id}')">✖ إلغاء</button>
            <button type="button" class="btn btn-success btn-sm btn-checkout-full" onclick="openRoomCheckoutModal('${room.id}')">🧾 تقفيل الحساب</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openStartRoomModal(preferredRoomId = '', prefill = null) {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول قبل تشغيل الغرف!', 'warning');
    switchTab('shift');
    return;
  }

  const idleRooms = state.rooms.filter((r) => r.status === 'idle');
  if (!idleRooms.length && !preferredRoomId) {
    showToast('كل الغرف مشغولة حالياً!', 'warning');
    return;
  }

  state.pendingReservationId = prefill && prefill.reservationId ? prefill.reservationId : null;

  // Populate Room Selector dropdown
  const roomSel = $('startRoomSelect');
  const candidateRooms = idleRooms.length ? idleRooms : state.rooms;
  roomSel.innerHTML = candidateRooms.map((r) =>
    `<option value="${r.id}">${r.name} (${r.device || 'PS5'}) — Single: ${r.singleRate}ج | Multi: ${r.multiRate}ج</option>`
  ).join('');

  const chosenRoomId = (preferredRoomId && candidateRooms.some((r) => r.id === preferredRoomId))
    ? preferredRoomId
    : candidateRooms[0].id;

  roomSel.value = chosenRoomId;
  syncStartRoomModalRates(chosenRoomId);

  // Mode selection
  const targetMode = (prefill && prefill.mode) || 'Single';
  document.querySelectorAll('#modalStartRoom .mode-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === targetMode);
  });

  // Games grid
  const games = state.settings.games || DEFAULT_GAMES;
  const selectedGame = (prefill && prefill.game && games.includes(prefill.game)) ? prefill.game : games[0];
  $('startGamesGrid').innerHTML = games.map((g) => `
    <button type="button" class="game-pick-btn ${g === selectedGame ? 'active' : ''}" data-game="${g}">${g}</button>
  `).join('');

  $('startGamesGrid').querySelectorAll('.game-pick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('startGamesGrid').querySelectorAll('.game-pick-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Time Type reset
  document.querySelectorAll('#modalStartRoom .time-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === 'open');
  });
  $('startFixedMinutesBox').classList.add('hidden');
  $('startFixedMinutes').value = '60';

  $('startClientName').value = (prefill && prefill.clientName) || '';
  $('startClientPhone').value = (prefill && prefill.clientPhone) || '';

  openModal('modalStartRoom');
}

function syncStartRoomModalRates(roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return;
  $('startRoomId').value = room.id;
  $('startRoomTitle').textContent = state.pendingReservationId
    ? `📅 تشغيل حجز — اختيار الغرفة (${room.name})`
    : `🎮 تشغيل ${room.name}`;
  $('startSingleRateHint').textContent = `${room.singleRate} ج/ساعة`;
  $('startMultiRateHint').textContent = `${room.multiRate} ج/ساعة`;
}

function confirmStartRoom() {
  const roomId = $('startRoomSelect').value || $('startRoomId').value;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return;

  if (room.status === 'running' || room.status === 'paused') {
    showToast('الغرفة المختارة مشغولة بالفعل، اختر غرفة متاحة!', 'error');
    return;
  }

  const activeModeBtn = document.querySelector('#modalStartRoom .mode-btn.active');
  const mode = activeModeBtn ? activeModeBtn.dataset.mode : 'Single';
  const activeGameBtn = document.querySelector('#startGamesGrid .game-pick-btn.active');
  const game = activeGameBtn ? activeGameBtn.dataset.game : (state.settings.games[0] || 'FC 26');
  const activeTimeBtn = document.querySelector('#modalStartRoom .time-btn.active');
  const timeType = activeTimeBtn ? activeTimeBtn.dataset.type : 'open';
  const fixedMinutes = Math.max(5, Number($('startFixedMinutes').value) || 60);

  room.status = 'running';
  room.mode = mode;
  room.game = game;
  room.timeType = timeType;
  room.fixedMinutes = fixedMinutes;
  room.startTime = new Date().toISOString();
  room.accumulatedElapsedMs = 0;
  room.accumulatedCost = 0;
  room.singleElapsedMs = 0;
  room.singleCost = 0;
  room.multiElapsedMs = 0;
  room.multiCost = 0;
  room.clientName = $('startClientName').value.trim();
  room.clientPhone = $('startClientPhone').value.trim();
  room.orders = [];

  queueCloudSync('arena_rooms', 'upsert', room);

  if (state.pendingReservationId) {
    const res = state.reservations.find((r) => r.id === state.pendingReservationId);
    if (res) {
      res.status = 'Completed';
      res.assignedRoom = room.name;
      queueCloudSync('arena_reservations', 'upsert', res);
    }
    state.pendingReservationId = null;
  }

  closeModal('modalStartRoom');
  renderRoomsTab();
  renderReservationsTab();
  showToast(`تم تشغيل ${room.name} (${mode} - ${game}) ▶️`, 'success');
}

function openSwitchModeModal(roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.status === 'idle') return;
  const nextMode = room.mode === 'Single' ? 'Multi' : 'Single';
  const currentRate = room.mode === 'Multi' ? room.multiRate : room.singleRate;
  const nextRate = nextMode === 'Multi' ? room.multiRate : room.singleRate;

  $('switchRoomId').value = room.id;
  $('switchRoomTitle').textContent = `🔄 تبديل نظام اللعب — ${room.name}`;
  $('switchCurrentInfo').innerHTML = `النظام الحالي: <strong>${room.mode}</strong> (${currentRate} ج/ساعة)`;
  $('switchTargetLabel').textContent = `${nextMode} (${nextRate} ج/ساعة)`;
  openModal('modalSwitchMode');
}

function confirmSwitchMode() {
  const roomId = $('switchRoomId').value;
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.status === 'idle') return;

  const now = new Date();
  let segMs = 0;
  if (room.status === 'running' && room.startTime) {
    segMs = Math.max(0, now.getTime() - new Date(room.startTime).getTime());
  }

  const currentRate = room.mode === 'Multi' ? Number(room.multiRate) : Number(room.singleRate);
  const segCost = (segMs / 3600000) * currentRate;

  if (room.mode === 'Multi') {
    room.multiElapsedMs = (Number(room.multiElapsedMs) || 0) + segMs;
    room.multiCost = (Number(room.multiCost) || 0) + segCost;
  } else {
    room.singleElapsedMs = (Number(room.singleElapsedMs) || 0) + segMs;
    room.singleCost = (Number(room.singleCost) || 0) + segCost;
  }

  room.accumulatedElapsedMs = room.singleElapsedMs + room.multiElapsedMs;
  room.accumulatedCost = room.singleCost + room.multiCost;
  room.mode = room.mode === 'Single' ? 'Multi' : 'Single';

  if (room.status === 'running') {
    room.startTime = now.toISOString();
  }

  queueCloudSync('arena_rooms', 'upsert', room);
  closeModal('modalSwitchMode');
  renderRoomsTab();
  showToast(`تم التحويل إلى ${room.mode} مع حفظ تفاصيل الفترة السابقة 🔄`, 'success');
}

function togglePauseRoom(roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.status === 'idle') return;

  if (room.status === 'running') {
    const segMs = room.startTime ? Math.max(0, Date.now() - new Date(room.startTime).getTime()) : 0;
    const rate = room.mode === 'Multi' ? Number(room.multiRate) : Number(room.singleRate);
    const segCost = (segMs / 3600000) * rate;

    if (room.mode === 'Multi') {
      room.multiElapsedMs = (Number(room.multiElapsedMs) || 0) + segMs;
      room.multiCost = (Number(room.multiCost) || 0) + segCost;
    } else {
      room.singleElapsedMs = (Number(room.singleElapsedMs) || 0) + segMs;
      room.singleCost = (Number(room.singleCost) || 0) + segCost;
    }
    room.accumulatedElapsedMs = room.singleElapsedMs + room.multiElapsedMs;
    room.accumulatedCost = room.singleCost + room.multiCost;
    room.status = 'paused';
    room.startTime = null;
    showToast(`تم إيقاف ${room.name} مؤقتاً ⏸️`, 'warning');
  } else if (room.status === 'paused') {
    room.status = 'running';
    room.startTime = new Date().toISOString();
    showToast(`تم استكمال ${room.name} ▶️`, 'success');
  }

  queueCloudSync('arena_rooms', 'upsert', room);
  renderRoomsTab();
}

function cancelRoomSession(roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room) return;
  if (!confirm(`هل أنت متأكد من إلغاء جلسة ${room.name} بدون حفظ فاتورة؟`)) return;

  (room.orders || []).forEach((o) => adjustMenuStock(o.id, o.qty));

  resetRoomObject(room);
  queueCloudSync('arena_rooms', 'upsert', room);
  renderRoomsTab();
  showToast(`تم إلغاء جلسة ${room.name}`, 'info');
}

function resetRoomObject(room) {
  room.status = 'idle';
  room.startTime = null;
  room.accumulatedElapsedMs = 0;
  room.accumulatedCost = 0;
  room.singleElapsedMs = 0;
  room.singleCost = 0;
  room.multiElapsedMs = 0;
  room.multiCost = 0;
  room.clientName = '';
  room.clientPhone = '';
  room.orders = [];
}

/* ==========================================================================
   CAFE TABLES
   ========================================================================== */
function renderTablesTab() {
  const grid = $('tablesGrid');
  const bar = $('tablesSummaryBar');
  if (!grid || !bar) return;

  const openCount = state.tables.filter((t) => t.status === 'open').length;
  bar.innerHTML = `
    <div class="summary-chip">🪑 إجمالي الترابيزات: <strong>${state.tables.length}</strong></div>
    <div class="summary-chip" style="color:var(--warning)">☕ مفتوحة حالياً: <strong>${openCount}</strong></div>
    <div class="summary-chip" style="color:var(--success)">✅ متاحة: <strong>${state.tables.length - openCount}</strong></div>
  `;

  grid.innerHTML = state.tables.map((tbl) => {
    if (tbl.status !== 'open') {
      return `
        <div class="table-card idle" ondblclick="openStartTableModal('${tbl.id}')">
          <div class="table-card-header">
            <strong style="font-size:1.1rem;">🪑 ${tbl.name}</strong>
            <span class="badge badge-completed">متاحة</span>
          </div>
          <p class="hint-text" style="margin:14px 0;">اضغط مرتين لفتح الترابيزة أو اضغط بالأسفل</p>
          <button type="button" class="btn btn-primary btn-block btn-sm" onclick="openStartTableModal('${tbl.id}')">▶️ فتح الترابيزة</button>
        </div>
      `;
    }

    const total = (tbl.orders || []).reduce((s, o) => s + (o.price * o.qty), 0);
    const ordersHtml = (tbl.orders || []).length
      ? tbl.orders.map((o) => `<div style="display:flex;justify-content:space-between;"><span>${o.name} × ${o.qty}</span><strong>${fmtMoney(o.price * o.qty)}</strong></div>`).join('')
      : '<span class="hint-text">لا توجد طلبات مسجلة بعد</span>';

    return `
      <div class="table-card open">
        <div class="table-card-header">
          <strong style="font-size:1.1rem;">🪑 ${tbl.name}</strong>
          <span class="badge badge-debt">${tbl.clientName || 'عميل كافيه'}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);">فُتحت الساعة: ${formatTimeShort(tbl.openedAt)}</div>
        <div class="table-orders-preview">${ordersHtml}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span>إجمالي الطلبات:</span>
          <strong style="color:var(--success);font-size:1.15rem;">${fmtMoney(total)}</strong>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-sm" style="flex:1;" onclick="openPosOrdersModal('table', '${tbl.id}')">☕ إضافة طلبات</button>
          <button type="button" class="btn btn-success btn-sm" style="flex:1;" onclick="openTableCheckoutModal('${tbl.id}')">🧾 تقفيل</button>
        </div>
      </div>
    `;
  }).join('');
}

function openStartTableModal(tableId) {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول قبل فتح الترابيزات!', 'warning');
    switchTab('shift');
    return;
  }
  const tbl = state.tables.find((t) => t.id === tableId);
  if (!tbl) return;
  $('startTableId').value = tbl.id;
  $('startTableTitle').textContent = `🪑 فتح ${tbl.name}`;
  $('startTableClientName').value = '';
  openModal('modalStartTable');
}

function confirmStartTable() {
  const tableId = $('startTableId').value;
  const tbl = state.tables.find((t) => t.id === tableId);
  if (!tbl) return;
  tbl.status = 'open';
  tbl.clientName = $('startTableClientName').value.trim();
  tbl.openedAt = new Date().toISOString();
  tbl.orders = [];
  queueCloudSync('arena_tables', 'upsert', tbl);
  closeModal('modalStartTable');
  renderTablesTab();
  showToast(`تم فتح ${tbl.name} ✅`, 'success');
}

/* ==========================================================================
   VISUAL POS CATALOG & ORDERS (DIRECT CAFE + ROOMS + TABLES)
   ========================================================================== */
function getMenuSvgIcon(type, name = '') {
  let resolved = type;
  if (!resolved || resolved === 'auto') {
    const n = name.toLowerCase();
    if (n.includes('مياه')) resolved = 'water';
    else if (n.includes('بيبسي') || n.includes('سفن') || n.includes('كانز') || n.includes('ريد')) resolved = 'can';
    else if (n.includes('آيس') || n.includes('شيك')) resolved = 'iced';
    else if (n.includes('شاي') || n.includes('ينسون')) resolved = 'tea';
    else if (n.includes('سموزي') || n.includes('عصير')) resolved = 'juice';
    else if (n.includes('شيبسي') || n.includes('سناكس')) resolved = 'snack';
    else if (n.includes('وافل') || n.includes('مولتن')) resolved = 'sweet';
    else resolved = 'coffee';
  }

  const icons = {
    coffee: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><rect x="14" y="24" width="28" height="24" rx="6" fill="#d97706"/><path d="M42 28h6a6 6 0 0 1 0 12h-6" fill="none" stroke="#f59e0b" stroke-width="4"/><path d="M22 14c0-4 4-4 4-8M30 14c0-4 4-4 4-8" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/></svg>`,
    tea: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><path d="M16 22h32l-4 28H20z" fill="#10b981"/><path d="M48 26h5a5 5 0 0 1 0 10h-5" fill="none" stroke="#34d399" stroke-width="4"/></svg>`,
    iced: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><path d="M18 18h28l-4 36H22z" fill="#38bdf8"/><path d="M15 18h34" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/><path d="M34 8l-4 14" stroke="#f43f5e" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    can: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><rect x="20" y="12" width="24" height="40" rx="5" fill="#0070d1"/><rect x="20" y="26" width="24" height="10" fill="#00d4ff"/></svg>`,
    water: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><rect x="22" y="18" width="20" height="36" rx="6" fill="#0ea5e9"/><rect x="26" y="10" width="12" height="8" rx="2" fill="#e2e8f0"/></svg>`,
    juice: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><path d="M18 20h28l-5 34H23z" fill="#f59e0b"/><circle cx="44" cy="18" r="7" fill="#10b981"/></svg>`,
    snack: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><rect x="16" y="14" width="32" height="38" rx="6" fill="#ef4444"/><circle cx="32" cy="33" r="9" fill="#facc15"/></svg>`,
    sweet: `<svg class="pos-tile-svg" viewBox="0 0 64 64"><rect x="14" y="22" width="36" height="24" rx="6" fill="#b45309"/><path d="M18 26h28M18 34h28M24 22v24M32 22v24M40 22v24" stroke="#78350f" stroke-width="2.5"/></svg>`
  };
  return icons[resolved] || icons.coffee;
}

function adjustMenuStock(menuId, delta) {
  const item = state.menu.find((m) => m.id === menuId);
  if (!item) return;
  item.stock = Math.max(0, (Number(item.stock) || 0) + delta);
  queueCloudSync('arena_menu', 'upsert', item);
}

function renderDirectCafePOS() {
  const catTabs = $('cafeCategoryTabs');
  const grid = $('cafeProductsGrid');
  if (!catTabs || !grid) return;

  const categories = ['الكل', ...new Set(state.menu.map((m) => m.category))];
  catTabs.innerHTML = categories.map((cat) => `
    <button type="button" class="pos-cat-tab ${state.cafeCategory === cat ? 'active' : ''}" onclick="setCafeCategory('${cat}')">${cat}</button>
  `).join('');

  const search = ($('cafeSearchInput').value || '').trim().toLowerCase();
  const filtered = state.menu.filter((m) => {
    const matchCat = state.cafeCategory === 'الكل' || m.category === state.cafeCategory;
    const matchSearch = !search || m.name.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  grid.innerHTML = filtered.map((m) => {
    const inCart = state.directCart.find((c) => c.id === m.id);
    const qty = inCart ? inCart.qty : 0;
    const stock = Number(m.stock) || 0;
    const minStock = Number(m.minStock) || 5;
    const stockTagClass = stock <= 0 ? 'out' : stock <= minStock ? 'low' : 'ok';

    return `
      <div class="pos-tile ${qty > 0 ? 'selected' : ''} ${stock <= 0 ? 'out-of-stock' : ''}" onclick="changeDirectCartQty('${m.id}', 1)">
        <div class="pos-tile-price">${fmtMoney(m.price)}</div>
        ${getMenuSvgIcon(m.icon, m.name)}
        <div class="pos-tile-name">${m.name}</div>
        <span class="pos-tile-stock-tag ${stockTagClass}">المخزون: ${stock}</span>
        <div class="pos-tile-qty-bar" onclick="event.stopPropagation()">
          <button type="button" class="tile-qty-btn minus" onclick="changeDirectCartQty('${m.id}', -1)">-</button>
          <strong>${qty}</strong>
          <button type="button" class="tile-qty-btn plus" onclick="changeDirectCartQty('${m.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  renderDirectCartSidebar();
}

function setCafeCategory(cat) {
  state.cafeCategory = cat;
  renderDirectCafePOS();
}

function changeDirectCartQty(menuId, delta) {
  const item = state.menu.find((m) => m.id === menuId);
  if (!item) return;
  const idx = state.directCart.findIndex((c) => c.id === menuId);
  if (idx === -1 && delta > 0) {
    state.directCart.push({ id: item.id, name: item.name, price: Number(item.price), qty: 1 });
  } else if (idx !== -1) {
    state.directCart[idx].qty += delta;
    if (state.directCart[idx].qty <= 0) state.directCart.splice(idx, 1);
  }
  renderDirectCafePOS();
}

function renderDirectCartSidebar() {
  const list = $('directCartList');
  const totalEl = $('directCartTotal');
  if (!list || !totalEl) return;

  if (!state.directCart.length) {
    list.innerHTML = '<p class="hint-text" style="text-align:center;margin-top:20px;">اختر الأصناف من القائمة لإضافتها</p>';
    totalEl.textContent = '0 ج.م';
    return;
  }

  let total = 0;
  list.innerHTML = state.directCart.map((c) => {
    const lineTotal = c.price * c.qty;
    total += lineTotal;
    return `
      <div class="pos-cart-row">
        <div>
          <strong>${c.name}</strong>
          <div style="font-size:0.78rem;color:var(--text-muted);">${fmtMoney(c.price)} × ${c.qty}</div>
        </div>
        <div class="pos-cart-controls">
          <strong>${fmtMoney(lineTotal)}</strong>
          <button type="button" class="tile-qty-btn minus" onclick="changeDirectCartQty('${c.id}', -1)">-</button>
          <button type="button" class="tile-qty-btn plus" onclick="changeDirectCartQty('${c.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.textContent = fmtMoney(total);
}

/* Modal POS for Rooms & Tables */
function openPosOrdersModal(targetType, targetId) {
  $('posTargetType').value = targetType;
  $('posTargetRoomId').value = targetId;
  state.posCart = [];
  state.posCategory = 'الكل';
  $('posSearchInput').value = '';

  const unit = targetType === 'room'
    ? state.rooms.find((r) => r.id === targetId)
    : state.tables.find((t) => t.id === targetId);
  $('posModalTitle').textContent = `🛒 إضافة طلبات — ${unit ? unit.name : ''}`;

  renderModalPosGrid();
  openModal('modalPosOrders');
}

function renderModalPosGrid() {
  const catTabs = $('posCategoryTabs');
  const grid = $('posProductsGrid');
  const categories = ['الكل', ...new Set(state.menu.map((m) => m.category))];

  catTabs.innerHTML = categories.map((cat) => `
    <button type="button" class="pos-cat-tab ${state.posCategory === cat ? 'active' : ''}" onclick="setModalPosCategory('${cat}')">${cat}</button>
  `).join('');

  const search = ($('posSearchInput').value || '').trim().toLowerCase();
  const filtered = state.menu.filter((m) => {
    const matchCat = state.posCategory === 'الكل' || m.category === state.posCategory;
    const matchSearch = !search || m.name.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  grid.innerHTML = filtered.map((m) => {
    const inCart = state.posCart.find((c) => c.id === m.id);
    const qty = inCart ? inCart.qty : 0;
    return `
      <div class="pos-tile ${qty > 0 ? 'selected' : ''}" onclick="changeModalPosQty('${m.id}', 1)">
        <div class="pos-tile-price">${fmtMoney(m.price)}</div>
        ${getMenuSvgIcon(m.icon, m.name)}
        <div class="pos-tile-name">${m.name}</div>
        <div class="pos-tile-qty-bar" onclick="event.stopPropagation()">
          <button type="button" class="tile-qty-btn minus" onclick="changeModalPosQty('${m.id}', -1)">-</button>
          <strong>${qty}</strong>
          <button type="button" class="tile-qty-btn plus" onclick="changeModalPosQty('${m.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  const list = $('posCartList');
  let total = 0;
  list.innerHTML = state.posCart.map((c) => {
    const line = c.price * c.qty;
    total += line;
    return `
      <div class="pos-cart-row">
        <span>${c.name} × ${c.qty}</span>
        <strong>${fmtMoney(line)}</strong>
      </div>
    `;
  }).join('') || '<p class="hint-text" style="text-align:center;">اختر الأصناف للإضافة</p>';

  $('posCartTotal').textContent = fmtMoney(total);
}

function setModalPosCategory(cat) {
  state.posCategory = cat;
  renderModalPosGrid();
}

function changeModalPosQty(menuId, delta) {
  const item = state.menu.find((m) => m.id === menuId);
  if (!item) return;
  const idx = state.posCart.findIndex((c) => c.id === menuId);
  if (idx === -1 && delta > 0) {
    state.posCart.push({ id: item.id, name: item.name, price: Number(item.price), qty: 1 });
  } else if (idx !== -1) {
    state.posCart[idx].qty += delta;
    if (state.posCart[idx].qty <= 0) state.posCart.splice(idx, 1);
  }
  renderModalPosGrid();
}

function confirmModalPosOrders() {
  if (!state.posCart.length) {
    showToast('اختر صنف واحد على الأقل!', 'warning');
    return;
  }
  const targetType = $('posTargetType').value;
  const targetId = $('posTargetRoomId').value;

  const targetObj = targetType === 'room'
    ? state.rooms.find((r) => r.id === targetId)
    : state.tables.find((t) => t.id === targetId);
  if (!targetObj) return;

  if (!Array.isArray(targetObj.orders)) targetObj.orders = [];
  state.posCart.forEach((c) => {
    const existing = targetObj.orders.find((o) => o.id === c.id);
    if (existing) existing.qty += c.qty;
    else targetObj.orders.push({ ...c });
    adjustMenuStock(c.id, -c.qty);
  });

  queueCloudSync(targetType === 'room' ? 'arena_rooms' : 'arena_tables', 'upsert', targetObj);
  closeModal('modalPosOrders');
  renderRoomsTab();
  renderTablesTab();
  showToast('تمت إضافة الطلبات لحساب الوحدة ✅', 'success');
}

/* ==========================================================================
   CHECKOUT, MULTI-CLIENT NOTAH SPLIT & THERMAL RECEIPT PRINTING
   ========================================================================== */
function openRoomCheckoutModal(roomId) {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول قبل تقفيل الحسابات!', 'warning');
    switchTab('shift');
    return;
  }
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || room.status === 'idle') return;

  const m = getRoomLiveMetrics(room);
  state.checkout = {
    type: 'room',
    targetId: room.id,
    title: `تقفيل ${room.name} (${room.game})`,
    items: (room.orders || []).map((o) => ({ ...o })),
    roomTimeCost: m.timeCost,
    ordersCost: m.ordersCost,
    subtotal: m.grandTotal,
    discount: 0,
    grandTotal: m.grandTotal,
    singleMs: m.singleMs,
    singleCost: m.singleCost,
    multiMs: m.multiMs,
    multiCost: m.multiCost,
    gameName: room.game,
    totalDurationMs: m.totalMs,
    notahSplits: []
  };

  let breakdownHtml = `
    <div style="display:flex;justify-content:space-between;font-weight:800;margin-bottom:4px;">
      <span>🎮 وقت اللعب (${room.game} — ${formatDurationAr(m.totalMs)}):</span>
      <strong>${fmtMoney(m.timeCost)}</strong>
    </div>
  `;

  if (m.singleMs > 0) {
    breakdownHtml += `
      <div class="checkout-sub-line" style="display:flex;justify-content:space-between;">
        <span>• فترة Single (${formatDurationAr(m.singleMs)}):</span>
        <span>${fmtMoney(m.singleCost)}</span>
      </div>
    `;
  }
  if (m.multiMs > 0) {
    breakdownHtml += `
      <div class="checkout-sub-line" style="display:flex;justify-content:space-between;">
        <span>• فترة Multi (${formatDurationAr(m.multiMs)}):</span>
        <span>${fmtMoney(m.multiCost)}</span>
      </div>
    `;
  }

  if (state.checkout.items.length) {
    breakdownHtml += `<hr class="divider" style="margin:6px 0;" />`;
    state.checkout.items.forEach((it) => {
      breakdownHtml += `
        <div style="display:flex;justify-content:space-between;margin-top:3px;">
          <span>☕ ${it.name} × ${it.qty}</span>
          <strong>${fmtMoney(it.price * it.qty)}</strong>
        </div>
      `;
    });
  }

  $('checkoutBreakdownBox').innerHTML = breakdownHtml;
  setupCheckoutModalUI();
}

function openTableCheckoutModal(tableId) {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول قبل تقفيل الحسابات!', 'warning');
    switchTab('shift');
    return;
  }
  const tbl = state.tables.find((t) => t.id === tableId);
  if (!tbl || tbl.status !== 'open') return;

  const ordersCost = (tbl.orders || []).reduce((s, o) => s + (o.price * o.qty), 0);
  state.checkout = {
    type: 'table',
    targetId: tbl.id,
    title: `تقفيل ${tbl.name}`,
    items: (tbl.orders || []).map((o) => ({ ...o })),
    roomTimeCost: 0,
    ordersCost,
    subtotal: ordersCost,
    discount: 0,
    grandTotal: ordersCost,
    singleMs: 0,
    singleCost: 0,
    multiMs: 0,
    multiCost: 0,
    gameName: '',
    totalDurationMs: 0,
    notahSplits: []
  };

  $('checkoutBreakdownBox').innerHTML = state.checkout.items.map((it) => `
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
      <span>☕ ${it.name} × ${it.qty}</span>
      <strong>${fmtMoney(it.price * it.qty)}</strong>
    </div>
  `).join('') || '<span class="hint-text">لا توجد طلبات</span>';

  setupCheckoutModalUI();
}

function openDirectCheckoutModal() {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول قبل تقفيل الطلبات!', 'warning');
    switchTab('shift');
    return;
  }
  if (!state.directCart.length) {
    showToast('السلة فارغة! اختر أصناف أولاً.', 'warning');
    return;
  }

  const ordersCost = state.directCart.reduce((s, o) => s + (o.price * o.qty), 0);
  state.checkout = {
    type: 'direct',
    targetId: 'direct-cafe',
    title: 'فاتورة كافيه / تيك أواي',
    items: state.directCart.map((o) => ({ ...o })),
    roomTimeCost: 0,
    ordersCost,
    subtotal: ordersCost,
    discount: 0,
    grandTotal: ordersCost,
    singleMs: 0,
    singleCost: 0,
    multiMs: 0,
    multiCost: 0,
    gameName: '',
    totalDurationMs: 0,
    notahSplits: []
  };

  $('checkoutBreakdownBox').innerHTML = state.checkout.items.map((it) => `
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
      <span>☕ ${it.name} × ${it.qty}</span>
      <strong>${fmtMoney(it.price * it.qty)}</strong>
    </div>
  `).join('');

  setupCheckoutModalUI();
}

function setupCheckoutModalUI() {
  $('checkoutTitle').textContent = `🧾 ${state.checkout.title}`;
  $('checkoutSubtotal').textContent = fmtMoney(state.checkout.subtotal);
  $('checkoutDiscount').value = '0';
  $('checkoutGrandTotal').textContent = fmtMoney(state.checkout.grandTotal);
  $('payCash').value = String(state.checkout.grandTotal);
  $('payVfCash').value = '0';
  $('payNotah').value = '0';
  $('quickClientForm').classList.add('hidden');
  state.checkout.notahSplits = [];

  recalculateCheckoutSplit();
  openModal('modalCheckout');
}

function ensureDefaultNotahSplitRow(totalNotahAmt) {
  if (totalNotahAmt <= 0) {
    state.checkout.notahSplits = [];
    renderNotahSplitsList();
    return;
  }
  if (state.checkout.notahSplits.length === 0) {
    state.checkout.notahSplits.push({
      id: uid('ns'),
      clientId: state.clients[0] ? state.clients[0].id : '',
      amount: totalNotahAmt
    });
  } else if (state.checkout.notahSplits.length === 1) {
    state.checkout.notahSplits[0].amount = totalNotahAmt;
  }
  renderNotahSplitsList();
}

function addNotahSplitRow() {
  const totalNotah = Number($('payNotah').value) || 0;
  const allocated = state.checkout.notahSplits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const rem = Math.max(0, totalNotah - allocated);

  state.checkout.notahSplits.push({
    id: uid('ns'),
    clientId: '',
    amount: rem
  });
  renderNotahSplitsList();
  validateNotahSplitsStatus();
}

function removeNotahSplitRow(splitId) {
  state.checkout.notahSplits = state.checkout.notahSplits.filter((r) => r.id !== splitId);
  renderNotahSplitsList();
  validateNotahSplitsStatus();
}

function updateNotahSplitRow(splitId, field, value) {
  const row = state.checkout.notahSplits.find((r) => r.id === splitId);
  if (!row) return;
  row[field] = field === 'amount' ? (Number(value) || 0) : value;
  validateNotahSplitsStatus();
}

function renderNotahSplitsList() {
  const container = $('notahSplitsList');
  if (!container) return;

  if (!state.clients.length) {
    container.innerHTML = '<p class="hint-text" style="color:var(--danger);margin:4px 0;">لا يوجد عملاء مسجلون بعد — اضغط "+ إنشاء عميل جديد" بالأعلى لإضافة عميل.</p>';
    validateNotahSplitsStatus();
    return;
  }

  container.innerHTML = state.checkout.notahSplits.map((row) => {
    const optionsHtml = [
      '<option value="">-- اختر العميل --</option>',
      ...state.clients.map((c) => `<option value="${c.id}" ${c.id === row.clientId ? 'selected' : ''}>${c.name} (${c.phone || '-'})</option>`)
    ].join('');

    return `
      <div class="notah-split-row">
        <select onchange="updateNotahSplitRow('${row.id}', 'clientId', this.value)">${optionsHtml}</select>
        <input type="number" min="0" step="0.5" value="${row.amount}" placeholder="المبلغ" oninput="updateNotahSplitRow('${row.id}', 'amount', this.value)" />
        <button type="button" class="btn btn-danger btn-xs" onclick="removeNotahSplitRow('${row.id}')" title="حذف">✕</button>
      </div>
    `;
  }).join('');

  validateNotahSplitsStatus();
}

function validateNotahSplitsStatus() {
  const statusEl = $('notahSplitStatus');
  if (!statusEl) return true;

  const totalNotah = Number($('payNotah').value) || 0;
  if (totalNotah <= 0) {
    statusEl.className = 'notah-split-status';
    statusEl.textContent = '';
    return true;
  }

  if (!state.checkout.notahSplits.length) {
    statusEl.className = 'notah-split-status invalid';
    statusEl.textContent = 'أضف عميل واحد على الأقل لتسجيل النوتة ❌';
    return false;
  }

  const hasMissingClient = state.checkout.notahSplits.some((r) => !r.clientId || (Number(r.amount) || 0) <= 0);
  const sumSplits = state.checkout.notahSplits.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = Math.round((totalNotah - sumSplits) * 100) / 100;

  if (hasMissingClient) {
    statusEl.className = 'notah-split-status invalid';
    statusEl.textContent = 'اختر اسم العميل وأدخل مبلغ أكبر من صفر لكل صف ❌';
    return false;
  }

  if (Math.abs(diff) > 0.01) {
    statusEl.className = 'notah-split-status invalid';
    statusEl.textContent = diff > 0
      ? `متبقي من النوتة لم يُوزّع: ${fmtMoney(diff)} ❌`
      : `إجمالي توزيع العملاء أكبر من النوتة بـ ${fmtMoney(Math.abs(diff))} ❌`;
    return false;
  }

  statusEl.className = 'notah-split-status valid';
  statusEl.textContent = `توزيع النوتة (${fmtMoney(totalNotah)}) على ${state.checkout.notahSplits.length} عميل مطابق ✅`;
  return true;
}

function recalculateCheckoutSplit(changedField = null) {
  const discount = Math.max(0, Math.min(state.checkout.subtotal, Number($('checkoutDiscount').value) || 0));
  state.checkout.discount = discount;
  const grandTotal = Math.max(0, state.checkout.subtotal - discount);
  state.checkout.grandTotal = grandTotal;
  $('checkoutGrandTotal').textContent = fmtMoney(grandTotal);

  if (changedField === 'discount') {
    $('payCash').value = String(grandTotal);
    $('payVfCash').value = '0';
    $('payNotah').value = '0';
  }

  const cash = Math.max(0, Number($('payCash').value) || 0);
  const vfCash = Math.max(0, Number($('payVfCash').value) || 0);
  const notah = Math.max(0, Number($('payNotah').value) || 0);

  const notahBox = $('checkoutNotahClientBox');
  if (notah > 0) {
    notahBox.classList.remove('hidden');
    ensureDefaultNotahSplitRow(notah);
  } else {
    notahBox.classList.add('hidden');
    state.checkout.notahSplits = [];
  }

  const paidSum = cash + vfCash + notah;
  const diff = Math.round((grandTotal - paidSum) * 100) / 100;
  const badge = $('checkoutBalanceStatus');

  if (Math.abs(diff) <= 0.01) {
    badge.className = 'balance-status valid';
    badge.textContent = 'المبلغ مطابق للإجمالي ✅';
  } else if (diff > 0) {
    badge.className = 'balance-status invalid';
    badge.textContent = `متبقي من الحساب: ${fmtMoney(diff)} ❌`;
  } else {
    badge.className = 'balance-status invalid';
    badge.textContent = `المبلغ المدخل أكبر من المطلوب بـ ${fmtMoney(Math.abs(diff))} ❌`;
  }
}

function finalizeCheckoutAndPrint() {
  const grandTotal = state.checkout.grandTotal;
  const cash = Math.max(0, Number($('payCash').value) || 0);
  const vfCash = Math.max(0, Number($('payVfCash').value) || 0);
  const notah = Math.max(0, Number($('payNotah').value) || 0);

  if (Math.abs((cash + vfCash + notah) - grandTotal) > 0.01) {
    showToast('إجمالي طرق الدفع لازم يساوي المطلوب سداده بالظبط!', 'error');
    return;
  }

  if (notah > 0 && !validateNotahSplitsStatus()) {
    showToast('راجع توزيع مبلغ النوتة على العملاء الأول!', 'error');
    return;
  }

  const activeShift = getActiveShift();
  const businessDate = getCurrentBusinessDate();
  const nowIso = new Date().toISOString();

  const resolvedNotahSplits = notah > 0
    ? state.checkout.notahSplits.map((row) => {
        const client = state.clients.find((c) => c.id === row.clientId);
        return {
          clientId: row.clientId,
          clientName: client ? client.name : 'عميل',
          amount: Number(row.amount) || 0
        };
      })
    : [];

  const txData = {
    id: uid('tx'),
    shift_id: activeShift ? activeShift.id : null,
    business_date: businessDate,
    created_at: nowIso,
    type: state.checkout.type,
    unit_id: state.checkout.targetId,
    title: state.checkout.title,
    items: state.checkout.items,
    room_time_cost: state.checkout.roomTimeCost,
    orders_cost: state.checkout.ordersCost,
    subtotal: state.checkout.subtotal,
    discount: state.checkout.discount,
    total: grandTotal,
    cash_paid: cash,
    vfcash_paid: vfCash,
    notah_paid: notah,
    notah_splits: resolvedNotahSplits,
    single_ms: state.checkout.singleMs || 0,
    single_cost: state.checkout.singleCost || 0,
    multi_ms: state.checkout.multiMs || 0,
    multi_cost: state.checkout.multiCost || 0,
    total_duration_ms: state.checkout.totalDurationMs || 0,
    game_name: state.checkout.gameName || '',
    staff_name: state.currentUser ? state.currentUser.name : 'كاشير'
  };

  state.transactions.unshift(txData);
  queueCloudSync('arena_transactions', 'upsert', txData);

  resolvedNotahSplits.forEach((sp) => {
    const client = state.clients.find((c) => c.id === sp.clientId);
    if (client) {
      client.notah_balance = (Number(client.notah_balance) || 0) + sp.amount;
      queueCloudSync('arena_clients', 'upsert', client);
    }
    const ledgerEntry = {
      id: uid('nl'),
      client_id: sp.clientId,
      tx_id: txData.id,
      business_date: businessDate,
      created_at: nowIso,
      entry_type: 'debt',
      amount: sp.amount,
      method: 'notah',
      note: `${txData.title}${resolvedNotahSplits.length > 1 ? ' (تقسيم نوتة)' : ''}`,
      staff_name: txData.staff_name
    };
    state.notahLedger.unshift(ledgerEntry);
    queueCloudSync('arena_notah_ledger', 'upsert', ledgerEntry);
  });

  if (state.checkout.type === 'room') {
    const room = state.rooms.find((r) => r.id === state.checkout.targetId);
    if (room) {
      resetRoomObject(room);
      queueCloudSync('arena_rooms', 'upsert', room);
    }
  } else if (state.checkout.type === 'table') {
    const tbl = state.tables.find((t) => t.id === state.checkout.targetId);
    if (tbl) {
      tbl.status = 'idle';
      tbl.clientName = '';
      tbl.openedAt = null;
      tbl.orders = [];
      queueCloudSync('arena_tables', 'upsert', tbl);
    }
  } else if (state.checkout.type === 'direct') {
    state.directCart.forEach((c) => adjustMenuStock(c.id, -c.qty));
    state.directCart = [];
  }

  closeModal('modalCheckout');
  renderAll();
  printThermalReceipt(txData);
  showToast('تم تقفيل الفاتورة وطباعة الريسيت ✅', 'success');
}

function buildReceiptHtml(tx) {
  const s = state.settings;
  const logoHtml = s.receiptLogo ? `<img src="${s.receiptLogo}" class="receipt-logo-img" alt="Logo" />` : '';
  const subtotal = Number(tx.subtotal) || (Number(tx.total) + (Number(tx.discount) || 0));
  const discount = Number(tx.discount) || 0;

  let linesHtml = '';
  if (tx.room_time_cost > 0 || tx.type === 'room') {
    linesHtml += `
      <div class="receipt-row">
        <span><strong>${tx.title}</strong> (${formatDurationAr(tx.total_duration_ms)})</span>
        <span><strong>${fmtMoney(tx.room_time_cost)}</strong></span>
      </div>
    `;
    if (tx.single_ms > 0) {
      linesHtml += `
        <div class="receipt-sub-row">
          <span>• Single (${formatDurationAr(tx.single_ms)})</span>
          <span>${fmtMoney(tx.single_cost)}</span>
        </div>
      `;
    }
    if (tx.multi_ms > 0) {
      linesHtml += `
        <div class="receipt-sub-row">
          <span>• Multi (${formatDurationAr(tx.multi_ms)})</span>
          <span>${fmtMoney(tx.multi_cost)}</span>
        </div>
      `;
    }
  }

  (tx.items || []).forEach((it) => {
    linesHtml += `
      <div class="receipt-row">
        <span>${it.name} × ${it.qty}</span>
        <span>${fmtMoney(it.price * it.qty)}</span>
      </div>
    `;
  });

  let discountBlock = '';
  if (discount > 0) {
    discountBlock = `
      <div class="receipt-divider"></div>
      <div class="receipt-row">
        <span>المجموع قبل الخصم:</span>
        <span>${fmtMoney(subtotal)}</span>
      </div>
      <div class="receipt-row">
        <span>الخصم:</span>
        <span>- ${fmtMoney(discount)}</span>
      </div>
    `;
  }

  let paymentBlock = '';
  if (tx.cash_paid > 0) {
    paymentBlock += `<div class="receipt-row"><span>مدفوع كاش:</span><span>${fmtMoney(tx.cash_paid)}</span></div>`;
  }
  if (tx.vfcash_paid > 0) {
    paymentBlock += `<div class="receipt-row"><span>مدفوع فودافون كاش:</span><span>${fmtMoney(tx.vfcash_paid)}</span></div>`;
  }
  if (tx.notah_paid > 0) {
    paymentBlock += `<div class="receipt-row"><span>على النوتة:</span><span>${fmtMoney(tx.notah_paid)}</span></div>`;
    (tx.notah_splits || []).forEach((sp) => {
      paymentBlock += `<div class="receipt-sub-row"><span>• ${sp.clientName}</span><span>${fmtMoney(sp.amount)}</span></div>`;
    });
  }

  return `
    ${logoHtml}
    <div class="receipt-header-text">${s.receiptHeader || 'ARENA POS'}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><span>التاريخ: ${tx.business_date || getTodayDateStr()}</span><span>${formatTimeShort(tx.created_at)}</span></div>
    <div class="receipt-row"><span>الكاشير: ${tx.staff_name || '-'}</span><span>#${String(tx.id).slice(-5)}</span></div>
    <div class="receipt-divider"></div>
    ${linesHtml}
    ${discountBlock}
    <div class="receipt-divider"></div>
    <div class="receipt-row" style="font-size:1.15em;font-weight:900;">
      <span>الإجمالي النهائي:</span>
      <span>${fmtMoney(tx.total)}</span>
    </div>
    ${paymentBlock}
    <div class="receipt-divider"></div>
    <div class="receipt-footer-text">${s.receiptFooter || ''}</div>
  `;
}

function printThermalReceipt(tx) {
  const el = $('receiptPrintContent');
  if (!el) return;
  const sizeClass = state.settings.receiptPaperSize === '58mm' ? 'receipt-58mm' : 'receipt-80mm';
  const fontClass = state.settings.receiptFontSize === 'large'
    ? 'receipt-font-large'
    : state.settings.receiptFontSize === 'compact'
      ? 'receipt-font-compact'
      : '';
  el.className = `receipt-paper ${sizeClass} ${fontClass}`;
  el.innerHTML = buildReceiptHtml(tx);
  setTimeout(() => window.print(), 120);
}

/* ==========================================================================
   RESERVATIONS
   ========================================================================== */
function renderReservationsTab() {
  const gameSel = $('resGameSelect');
  if (gameSel) {
    gameSel.innerHTML = (state.settings.games || DEFAULT_GAMES).map((g) => `<option value="${g}">${g}</option>`).join('');
  }

  const filter = $('resFilterStatus') ? $('resFilterStatus').value : 'Upcoming';
  const tbody = $('reservationsTableBody');
  if (!tbody) return;

  const upcomingCount = state.reservations.filter((r) => r.status === 'Upcoming').length;
  const badge = $('upcomingResBadge');
  if (badge) {
    badge.textContent = upcomingCount;
    badge.classList.toggle('hidden', upcomingCount === 0);
  }

  const list = state.reservations.filter((r) => filter === 'All' || r.status === filter);
  tbody.innerHTML = list.map((r) => {
    const badgeCls = r.status === 'Upcoming' ? 'badge-upcoming' : r.status === 'Completed' ? 'badge-completed' : 'badge-cancelled';
    const statusAr = r.status === 'Upcoming' ? 'قادم' : r.status === 'Completed' ? 'تم الحضور' : 'ملغي';

    return `
      <tr>
        <td>${formatDateTimeAr(r.datetime)}</td>
        <td><strong>${r.client_name}</strong><br><small style="color:var(--text-muted)">${r.client_phone || ''}</small></td>
        <td>${r.game} (${r.mode})${r.notes ? `<br><small style="color:var(--ps-cyan)">${r.notes}</small>` : ''}</td>
        <td><span class="badge ${badgeCls}">${statusAr}</span></td>
        <td>
          ${r.status === 'Upcoming' ? `
            <div class="btn-row">
              <button type="button" class="btn btn-success btn-xs" onclick="startSessionFromReservation('${r.id}')">▶️ بدء بالغرفة</button>
              <button type="button" class="btn btn-danger btn-xs" onclick="cancelReservation('${r.id}')">إلغاء</button>
            </div>
          ` : (r.assignedRoom || '-')}
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">لا توجد حجوزات</td></tr>';
}

function addReservation() {
  const client_name = $('resClientName').value.trim();
  const datetime = $('resDateTime').value;
  if (!client_name || !datetime) {
    showToast('أدخل اسم العميل وموعد الحجز!', 'warning');
    return;
  }

  const resObj = {
    id: uid('res'),
    client_name,
    client_phone: $('resClientPhone').value.trim(),
    game: $('resGameSelect').value,
    mode: $('resModeSelect').value,
    datetime,
    notes: $('resNotes').value.trim(),
    status: 'Upcoming'
  };

  state.reservations.unshift(resObj);
  queueCloudSync('arena_reservations', 'upsert', resObj);

  $('resClientName').value = '';
  $('resClientPhone').value = '';
  $('resNotes').value = '';
  renderReservationsTab();
  showToast('تم تسجيل الحجز بنجاح 📅', 'success');
}

function startSessionFromReservation(resId) {
  const res = state.reservations.find((r) => r.id === resId);
  if (!res) return;
  const idleRooms = state.rooms.filter((r) => r.status === 'idle');
  if (!idleRooms.length) {
    showToast('لا توجد غرف متاحة حالياً لبدء الحجز!', 'error');
    return;
  }

  openStartRoomModal(idleRooms[0].id, {
    reservationId: res.id,
    clientName: res.client_name,
    clientPhone: res.client_phone,
    game: res.game,
    mode: res.mode
  });
}

function cancelReservation(resId) {
  const res = state.reservations.find((r) => r.id === resId);
  if (!res) return;
  res.status = 'Cancelled';
  queueCloudSync('arena_reservations', 'upsert', res);
  renderReservationsTab();
  showToast('تم إلغاء الحجز', 'info');
}

/* ==========================================================================
   CLIENTS & NOTAH LEDGER
   ========================================================================== */
function renderClientsTab() {
  const totalDebt = state.clients.reduce((s, c) => s + (Number(c.notah_balance) || 0), 0);
  if ($('totalMarketNotah')) $('totalMarketNotah').textContent = fmtMoney(totalDebt);

  const search = ($('clientSearchInput') ? $('clientSearchInput').value : '').trim().toLowerCase();
  const tbody = $('clientsTableBody');
  if (!tbody) return;

  const filtered = state.clients.filter((c) =>
    !search || c.name.toLowerCase().includes(search) || (c.phone || '').includes(search)
  );

  tbody.innerHTML = filtered.map((c) => {
    const bal = Number(c.notah_balance) || 0;
    return `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td dir="ltr">${c.phone || '-'}</td>
        <td><strong style="color:${bal > 0 ? 'var(--warning)' : 'var(--success)'};">${fmtMoney(bal)}</strong></td>
        <td><button type="button" class="btn btn-primary btn-xs" onclick="openClientDetailsModal('${c.id}')">📒 كشف الحساب</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">لا يوجد عملاء</td></tr>';
}

function addNewClient() {
  const name = $('newClientName').value.trim();
  const phone = $('newClientPhone').value.trim();
  if (!name) {
    showToast('أدخل اسم العميل!', 'warning');
    return;
  }
  const client = { id: uid('cli'), name, phone, notah_balance: 0 };
  state.clients.unshift(client);
  queueCloudSync('arena_clients', 'upsert', client);
  $('newClientName').value = '';
  $('newClientPhone').value = '';
  renderClientsTab();
  showToast('تم حفظ بروفايل العميل ✅', 'success');
}

function saveQuickClientFromCheckout() {
  const name = $('quickClientName').value.trim();
  const phone = $('quickClientPhone').value.trim();
  if (!name) {
    showToast('أدخل اسم العميل الجديد!', 'warning');
    return;
  }
  const client = { id: uid('cli'), name, phone, notah_balance: 0 };
  state.clients.unshift(client);
  queueCloudSync('arena_clients', 'upsert', client);

  $('quickClientName').value = '';
  $('quickClientPhone').value = '';
  $('quickClientForm').classList.add('hidden');

  const emptyRow = state.checkout.notahSplits.find((r) => !r.clientId);
  if (emptyRow) {
    emptyRow.clientId = client.id;
  } else {
    state.checkout.notahSplits.push({ id: uid('ns'), clientId: client.id, amount: 0 });
  }
  renderNotahSplitsList();
  renderClientsTab();
  showToast(`تم إضافة واختيار العميل (${name}) ✅`, 'success');
}

function openClientDetailsModal(clientId) {
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return;
  $('detailClientId').value = client.id;
  $('detailClientName').textContent = client.name;
  $('detailClientPhone').textContent = client.phone || 'بدون رقم';
  $('detailClientDebt').textContent = fmtMoney(client.notah_balance || 0);
  $('collectNotahAmount').value = '';
  $('collectNotahNote').value = '';

  const history = state.notahLedger.filter((l) => l.client_id === client.id);
  $('clientNotahHistoryList').innerHTML = history.map((h) => `
    <div class="ledger-item ${h.entry_type === 'payment' ? 'payment' : ''}">
      <div style="display:flex;justify-content:space-between;font-weight:800;">
        <span>${h.entry_type === 'payment' ? '💰 سداد / تحصيل' : '📒 إضافة على النوتة'}</span>
        <strong style="color:${h.entry_type === 'payment' ? 'var(--success)' : 'var(--warning)'};">
          ${h.entry_type === 'payment' ? '-' : '+'} ${fmtMoney(h.amount)}
        </strong>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);margin-top:3px;">
        ${h.business_date} (${formatTimeShort(h.created_at)}) — ${h.note || ''} (${h.staff_name || ''})
      </div>
    </div>
  `).join('') || '<p class="hint-text">لا توجد حركات مسجلة لهذا العميل.</p>';

  openModal('modalClientDetails');
}

function confirmNotahCollection() {
  if (!getActiveShift()) {
    showToast('افتح وردية الأول لتسجيل تحصيل النوتة في الدرج!', 'warning');
    return;
  }
  const clientId = $('detailClientId').value;
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return;

  const amount = Number($('collectNotahAmount').value) || 0;
  if (amount <= 0) {
    showToast('أدخل مبلغ التحصيل!', 'warning');
    return;
  }

  const method = $('collectNotahMethod').value;
  const note = $('collectNotahNote').value.trim() || 'سداد من حساب النوتة';

  client.notah_balance = Math.max(0, (Number(client.notah_balance) || 0) - amount);
  queueCloudSync('arena_clients', 'upsert', client);

  const entry = {
    id: uid('nl'),
    client_id: client.id,
    business_date: getCurrentBusinessDate(),
    created_at: new Date().toISOString(),
    entry_type: 'payment',
    amount,
    method,
    note,
    staff_name: state.currentUser ? state.currentUser.name : 'كاشير'
  };
  state.notahLedger.unshift(entry);
  queueCloudSync('arena_notah_ledger', 'upsert', entry);

  openClientDetailsModal(client.id);
  renderClientsTab();
  renderShiftTab();
  showToast(`تم تحصيل ${fmtMoney(amount)} من ${client.name} ✅`, 'success');
}

/* ==========================================================================
   UNIFIED FINANCIAL CALCULATIONS (SHIFT & DASHBOARD)
   ========================================================================== */
function computeFinancialStats(txList, expList, ledgerList, startCash = 0) {
  let roomsRev = 0;
  let cafeRev = 0;
  let cashSales = 0;
  let vfCashSales = 0;
  let notahSales = 0;

  txList.forEach((tx) => {
    const total = Number(tx.total) || 0;
    const discount = Number(tx.discount) || 0;
    if (tx.type === 'room') {
      const rawTime = Number(tx.room_time_cost) || 0;
      const rawOrders = Number(tx.orders_cost) || 0;
      const netTime = Math.max(0, rawTime - discount);
      const excessDisc = Math.max(0, discount - rawTime);
      const netOrders = Math.max(0, rawOrders - excessDisc);
      roomsRev += netTime;
      cafeRev += netOrders;
    } else {
      cafeRev += total;
    }

    cashSales += Number(tx.cash_paid) || 0;
    vfCashSales += Number(tx.vfcash_paid) || 0;
    notahSales += Number(tx.notah_paid) || 0;
  });

  const totalSales = roomsRev + cafeRev;

  let notahCollectedCash = 0;
  let notahCollectedVf = 0;
  ledgerList.forEach((l) => {
    if (l.entry_type === 'payment') {
      if (l.method === 'vfcash') notahCollectedVf += Number(l.amount) || 0;
      else notahCollectedCash += Number(l.amount) || 0;
    }
  });

  const notahCollected = notahCollectedCash + notahCollectedVf;
  const vfCashTotal = vfCashSales + notahCollectedVf;
  const expensesTotal = expList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expectedDrawer = (Number(startCash) || 0) + cashSales + notahCollectedCash - expensesTotal;

  return {
    totalSales,
    roomsRev,
    cafeRev,
    cashSales,
    vfCashTotal,
    notahSales,
    notahCollected,
    notahCollectedCash,
    expensesTotal,
    expectedDrawer
  };
}

function getShiftStats(shift) {
  if (!shift) {
    return computeFinancialStats([], [], [], 0);
  }
  const shiftTxs = state.transactions.filter((t) => t.shift_id === shift.id || (!t.shift_id && t.business_date === shift.business_date));
  const shiftExps = state.expenses.filter((e) => e.shift_id === shift.id || (!e.shift_id && e.business_date === shift.business_date));
  const shiftLedger = state.notahLedger.filter((l) => l.business_date === shift.business_date && l.entry_type === 'payment');
  return computeFinancialStats(shiftTxs, shiftExps, shiftLedger, shift.start_cash || 0);
}

/* ==========================================================================
   SHIFT TAB, HANDOVER & CLOSE SHIFT
   ========================================================================== */
function renderShiftTab() {
  const active = getActiveShift();
  const pill = $('shiftStatusBadge');
  const pillText = $('shiftStatusText');

  if (!active) {
    if (pill) pill.className = 'shift-pill closed';
    if (pillText) pillText.textContent = 'الوردية مغلقة';
    $('shiftClosedCard').classList.remove('hidden');
    $('shiftOpenCard').classList.add('hidden');
    return;
  }

  if (pill) pill.className = 'shift-pill open';
  if (pillText) pillText.textContent = `وردية: ${active.business_date}`;
  $('shiftClosedCard').classList.add('hidden');
  $('shiftOpenCard').classList.remove('hidden');

  $('shiftBusinessDateBadge').textContent = `${active.business_date} (${getArabicDayName(active.business_date)})`;
  $('shiftBusinessDateNote').textContent = active.business_date;
  $('shiftStaffName').textContent = active.staff_name;
  $('shiftStartTime').textContent = formatDateTimeAr(active.opened_at);

  const stats = getShiftStats(active);
  $('shiftStartCash').textContent = fmtMoney(active.start_cash || 0);
  $('shiftTotalSales').textContent = fmtMoney(stats.totalSales);
  $('shiftRoomsRev').textContent = fmtMoney(stats.roomsRev);
  $('shiftCafeRev').textContent = fmtMoney(stats.cafeRev);
  $('shiftNotahCollected').textContent = fmtMoney(stats.notahCollected);
  $('shiftNotahSales').textContent = fmtMoney(stats.notahSales);
  $('shiftVfCashTotal').textContent = fmtMoney(stats.vfCashTotal);
  $('shiftExpensesTotal').textContent = fmtMoney(stats.expensesTotal);
  $('shiftExpectedDrawer').textContent = fmtMoney(stats.expectedDrawer);

  const shiftExps = state.expenses.filter((e) => e.shift_id === active.id || (!e.shift_id && e.business_date === active.business_date));
  $('shiftExpensesList').innerHTML = shiftExps.map((e) => `
    <div class="mini-list-item expense-item">
      <span>💸 ${e.title} <small style="color:var(--text-muted)">(${formatTimeShort(e.created_at)})</small></span>
      <strong style="color:var(--danger)">- ${fmtMoney(e.amount)}</strong>
    </div>
  `).join('') || '<p class="hint-text">لا توجد مصروفات مسجلة في هذه الوردية</p>';

  const shiftHandovers = state.handovers.filter((h) => h.shift_id === active.id);
  $('shiftHandoversList').innerHTML = shiftHandovers.map((h) => `
    <div class="mini-list-item">
      <span>🤝 من <strong>${h.from_staff}</strong> إلى <strong>${h.to_staff}</strong> (${formatTimeShort(h.created_at)})</span>
      <strong>درج: ${fmtMoney(h.actual_cash)}</strong>
    </div>
  `).join('') || '<p class="hint-text">لا توجد تسليمات داخلية في هذه الوردية</p>';

  const shiftTxs = state.transactions.filter((t) => t.shift_id === active.id || (!t.shift_id && t.business_date === active.business_date));
  const combinedFeed = [
    ...shiftTxs.map((t) => ({ kind: 'tx', ts: new Date(t.created_at).getTime() || 0, data: t })),
    ...shiftExps.map((e) => ({ kind: 'exp', ts: new Date(e.created_at).getTime() || 0, data: e }))
  ].sort((a, b) => b.ts - a.ts);

  $('shiftTransactionsList').innerHTML = combinedFeed.map((entry) => {
    if (entry.kind === 'exp') {
      const e = entry.data;
      return `
        <div class="mini-list-item expense-item">
          <div>
            <strong>💸 مصروف: ${e.title}</strong>
            <div style="font-size:0.76rem;color:var(--text-muted);">${formatTimeShort(e.created_at)} — ${e.staff_name || ''}</div>
          </div>
          <strong style="color:var(--danger);">- ${fmtMoney(e.amount)}</strong>
        </div>
      `;
    }
    const t = entry.data;
    return `
      <div class="mini-list-item tx-item">
        <div>
          <strong>🧾 ${t.title}</strong>
          <div style="font-size:0.76rem;color:var(--text-muted);">${formatTimeShort(t.created_at)} — ${t.staff_name || ''}</div>
        </div>
        <div class="btn-row" style="align-items:center;">
          <strong style="color:var(--success);">+ ${fmtMoney(t.total)}</strong>
          <button type="button" class="btn btn-outline btn-xs" onclick="reprintTxById('${t.id}')">🖨️</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="hint-text">لا توجد حركات مسجلة في الوردية بعد</p>';
}

function reprintTxById(txId) {
  const tx = state.transactions.find((t) => t.id === txId);
  if (tx) printThermalReceipt(tx);
}

function openOpenShiftModal() {
  const today = getTodayDateStr();
  $('openShiftBusinessDate').value = today;
  $('openShiftDayNameHint').textContent = `يوم: ${getArabicDayName(today)}`;
  $('openShiftCashInput').value = '0';
  openModal('modalOpenShift');
}

function confirmOpenShift() {
  const bDate = $('openShiftBusinessDate').value;
  if (!bDate) {
    showToast('اختر يوم العمل الأول!', 'warning');
    return;
  }
  const startCash = Math.max(0, Number($('openShiftCashInput').value) || 0);
  const newShift = {
    id: uid('shf'),
    business_date: bDate,
    opened_at: new Date().toISOString(),
    closed_at: null,
    status: 'open',
    staff_id: state.currentUser ? state.currentUser.id : '',
    staff_name: state.currentUser ? state.currentUser.name : 'كاشير',
    start_cash: startCash
  };

  state.shifts.unshift(newShift);
  queueCloudSync('arena_shifts', 'upsert', newShift);
  closeModal('modalOpenShift');
  renderAll();
  showToast(`تم فتح الوردية ليوم ${bDate} 🟢`, 'success');
}

function addShiftExpense() {
  const active = getActiveShift();
  if (!active) {
    showToast('افتح وردية الأول قبل تسجيل المصروفات!', 'warning');
    return;
  }
  const title = $('expenseTitle').value.trim();
  const amount = Number($('expenseAmount').value) || 0;
  if (!title || amount <= 0) {
    showToast('أدخل بيان المصروف والمبلغ!', 'warning');
    return;
  }

  const exp = {
    id: uid('exp'),
    shift_id: active.id,
    business_date: active.business_date,
    created_at: new Date().toISOString(),
    title,
    amount,
    staff_name: state.currentUser ? state.currentUser.name : 'كاشير'
  };

  state.expenses.unshift(exp);
  queueCloudSync('arena_expenses', 'upsert', exp);
  $('expenseTitle').value = '';
  $('expenseAmount').value = '';
  renderShiftTab();
  if (mgmtUnlocked) renderDashboard();
  showToast(`تم خصم مصروف (${title}) بقيمة ${fmtMoney(amount)} 💸`, 'warning');
}

function openHandoverModal() {
  const active = getActiveShift();
  if (!active) return;
  const stats = getShiftStats(active);

  $('handoverSummaryPreview').innerHTML = `
    <div>يوم العمل: <strong>${active.business_date}</strong> | المُسلِّم: <strong>${active.staff_name}</strong></div>
    <div>إجمالي مبيعات الوردية: <strong>${fmtMoney(stats.totalSales)}</strong> | المصروفات: <strong>${fmtMoney(stats.expensesTotal)}</strong></div>
    <div>الكاش المفروض بالدرج الآن: <strong style="color:var(--success)">${fmtMoney(stats.expectedDrawer)}</strong></div>
  `;

  const sel = $('handoverTargetUser');
  sel.innerHTML = state.users.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');
  $('handoverTargetPin').value = '';
  $('handoverActualCash').value = String(stats.expectedDrawer);
  $('handoverNotes').value = '';
  $('preHandoverInputBox').classList.remove('hidden');
  $('postHandoverActionsBox').classList.add('hidden');
  openModal('modalHandoverShift');
}

function confirmHandoverShift() {
  const active = getActiveShift();
  if (!active) return;
  const targetUserId = $('handoverTargetUser').value;
  const targetPin = $('handoverTargetPin').value.trim();
  const targetUser = state.users.find((u) => u.id === targetUserId && String(u.pin) === targetPin);

  if (!targetUser) {
    showToast('الباسورد / PIN للموظف المستلم غير صحيح!', 'error');
    return;
  }

  const stats = getShiftStats(active);
  const actualCash = Number($('handoverActualCash').value) || 0;
  const diff = actualCash - stats.expectedDrawer;
  const notes = $('handoverNotes').value.trim();

  const ho = {
    id: uid('ho'),
    shift_id: active.id,
    business_date: active.business_date,
    created_at: new Date().toISOString(),
    from_staff: active.staff_name,
    to_staff: targetUser.name,
    expected_cash: stats.expectedDrawer,
    actual_cash: actualCash,
    diff,
    notes
  };
  state.handovers.unshift(ho);
  queueCloudSync('arena_handovers', 'upsert', ho);

  active.staff_id = targetUser.id;
  active.staff_name = targetUser.name;
  queueCloudSync('arena_shifts', 'upsert', active);

  state.currentUser = targetUser;
  sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, JSON.stringify(targetUser));
  $('currentUserBadge').textContent = `${targetUser.name} (${targetUser.role === 'admin' ? 'مدير' : 'كاشير'})`;

  $('preHandoverInputBox').classList.add('hidden');
  $('postHandoverActionsBox').classList.remove('hidden');

  $('btnSendHandoverWhatsapp').onclick = () => {
    const msg = `🤝 تسليم وردية — ${state.settings.brandTitle}\n📅 يوم: ${active.business_date}\n👤 من: ${ho.from_staff} ➡️ إلى: ${ho.to_staff}\n💵 الدرج المتوقع: ${fmtMoney(ho.expected_cash)}\n✅ الدرج الفعلي: ${fmtMoney(ho.actual_cash)}\n📊 الفرق: ${fmtMoney(ho.diff)}`;
    openWhatsappWithText(msg);
  };

  renderShiftTab();
  showToast(`تم تسليم الوردية إلى ${targetUser.name} بنجاح 🤝`, 'success');
}

function openCloseShiftModal() {
  const active = getActiveShift();
  if (!active) return;

  const busyRooms = state.rooms.filter((r) => r.status !== 'idle');
  if (busyRooms.length > 0) {
    showToast(`يوجد ${busyRooms.length} غرفة شغالة حالياً — قفّل الغرف الأول قبل تقفيل الوردية!`, 'warning');
    return;
  }

  const stats = getShiftStats(active);
  $('closeShiftSummaryPreview').innerHTML = `
    <div>يوم العمل: <strong>${active.business_date}</strong> | الكاشير: <strong>${active.staff_name}</strong></div>
    <div>إجمالي المبيعات (لعب + كافيه): <strong style="color:var(--success)">${fmtMoney(stats.totalSales)}</strong> (لعب: ${fmtMoney(stats.roomsRev)} | كافيه: ${fmtMoney(stats.cafeRev)})</div>
    <div>نوتة آجلة: <strong>${fmtMoney(stats.notahSales)}</strong> | تحصيل نوتة: <strong>${fmtMoney(stats.notahCollected)}</strong> | فودافون كاش: <strong>${fmtMoney(stats.vfCashTotal)}</strong></div>
    <div>المصروفات: <strong style="color:var(--danger)">${fmtMoney(stats.expensesTotal)}</strong> | الكاش المفروض بالدرج: <strong style="color:var(--ps-cyan)">${fmtMoney(stats.expectedDrawer)}</strong></div>
  `;

  $('closeShiftActualCash').value = String(stats.expectedDrawer);
  $('closeShiftDiffBadge').className = 'balance-status valid';
  $('closeShiftDiffBadge').textContent = 'المبلغ مطابق للدرج ✅';
  $('preCloseInputBox').classList.remove('hidden');
  $('postCloseActionsBox').classList.add('hidden');
  openModal('modalCloseShift');
}

function confirmCloseShift() {
  const active = getActiveShift();
  if (!active) return;
  const stats = getShiftStats(active);
  const actualCash = Number($('closeShiftActualCash').value) || 0;
  const diff = actualCash - stats.expectedDrawer;

  active.status = 'closed';
  active.closed_at = new Date().toISOString();
  active.actual_cash = actualCash;
  active.expected_cash = stats.expectedDrawer;
  active.cash_diff = diff;

  queueCloudSync('arena_shifts', 'upsert', active);

  const reportText = [
    `📊 تقرير تقفيل وردية — ${state.settings.brandTitle || 'ARENA POS'}`,
    `📅 يوم العمل: ${active.business_date} (${getArabicDayName(active.business_date)})`,
    `👤 الكاشير: ${active.staff_name}`,
    `━━━━━━━━━━━━━━`,
    `💰 إجمالي المبيعات: ${fmtMoney(stats.totalSales)}`,
    `🎮 إيراد وقت اللعب: ${fmtMoney(stats.roomsRev)}`,
    `☕ إيراد الكافيه والطلبات: ${fmtMoney(stats.cafeRev)}`,
    `📒 مبيعات آجلة (نوتة): ${fmtMoney(stats.notahSales)}`,
    `📥 تحصيلات نوتة سابقة: ${fmtMoney(stats.notahCollected)}`,
    `📱 فودافون كاش: ${fmtMoney(stats.vfCashTotal)}`,
    `💸 المصروفات النثرية: ${fmtMoney(stats.expensesTotal)}`,
    `━━━━━━━━━━━━━━`,
    `💵 الكاش المفروض بالدرج: ${fmtMoney(stats.expectedDrawer)}`,
    `✅ الكاش الفعلي بالدرج: ${fmtMoney(actualCash)}`,
    `⚖️ العجز / الزيادة: ${fmtMoney(diff)}`
  ].join('\n');

  $('preCloseInputBox').classList.add('hidden');
  $('postCloseActionsBox').classList.remove('hidden');

  $('btnSendWhatsappReport').onclick = () => openWhatsappWithText(reportText);
  $('btnCopyShiftReport').onclick = () => {
    navigator.clipboard.writeText(reportText);
    showToast('تم نسخ تقرير الوردية 📋', 'success');
  };

  renderAll();
  showToast('تم تقفيل الوردية وحفظ التقرير بنجاح 🔒', 'success');
}

function openWhatsappWithText(text) {
  const phone = (state.settings.ownerWhatsapp || '').replace(/[^0-9]/g, '');
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ==========================================================================
   MANAGEMENT DASHBOARD & REPORTS (UNIFIED CALCULATIONS)
   ========================================================================== */
function populateDashboardFilters() {
  const daySel = $('dashFilterBusinessDay');
  const wrongSel = $('dashWrongDaySelect');
  const roomSel = $('dashFilterRoom');
  const drinkSel = $('dashFilterDrink');
  const cashierSel = $('dashFilterCashier');

  const allDays = [...new Set([
    getCurrentBusinessDate(),
    ...state.shifts.map((s) => s.business_date),
    ...state.transactions.map((t) => t.business_date)
  ])].filter(Boolean).sort().reverse();

  if (daySel) {
    daySel.innerHTML = [
      '<option value="CURRENT">اليوم / الوردية الحالية</option>',
      '<option value="ALL">كل الأيام المسجلة</option>',
      ...allDays.map((d) => `<option value="${d}">${d} (${getArabicDayName(d)})</option>`)
    ].join('');
  }

  if (wrongSel) {
    wrongSel.innerHTML = allDays.map((d) => `<option value="${d}">${d} (${getArabicDayName(d)})</option>`).join('');
  }

  if (roomSel) {
    roomSel.innerHTML = [
      '<option value="ALL">كل الغرف والكافيه</option>',
      '<option value="ROOMS_ONLY">كل الغرف فقط</option>',
      '<option value="CAFE_ONLY">الترابيزات والتيك أواي فقط</option>',
      ...state.rooms.map((r) => `<option value="${r.id}">${r.name}</option>`)
    ].join('');
  }

  if (drinkSel) {
    drinkSel.innerHTML = [
      '<option value="ALL">كل المشاريب والأصناف</option>',
      ...state.menu.map((m) => `<option value="${m.id}">${m.name}</option>`)
    ].join('');
  }

  if (cashierSel) {
    cashierSel.innerHTML = [
      '<option value="ALL">كل الكاشيرية</option>',
      ...state.users.map((u) => `<option value="${u.name}">${u.name}</option>`)
    ].join('');
  }
}

function renderDashboard() {
  if (!mgmtUnlocked) return;

  const dayFilter = $('dashFilterBusinessDay') ? $('dashFilterBusinessDay').value : 'CURRENT';
  const dateFrom = $('dashFilterDateFrom') ? $('dashFilterDateFrom').value : '';
  const dateTo = $('dashFilterDateTo') ? $('dashFilterDateTo').value : '';
  const roomFilter = $('dashFilterRoom') ? $('dashFilterRoom').value : 'ALL';
  const drinkFilter = $('dashFilterDrink') ? $('dashFilterDrink').value : 'ALL';
  const cashierFilter = $('dashFilterCashier') ? $('dashFilterCashier').value : 'ALL';

  const currentBDate = getCurrentBusinessDate();
  const activeShift = getActiveShift();

  const matchesDateAndCashier = (recordDate, staffName) => {
    if (dateFrom && recordDate < dateFrom) return false;
    if (dateTo && recordDate > dateTo) return false;
    if (!dateFrom && !dateTo) {
      if (dayFilter === 'CURRENT' && recordDate !== currentBDate) return false;
      if (dayFilter !== 'CURRENT' && dayFilter !== 'ALL' && recordDate !== dayFilter) return false;
    }
    if (cashierFilter !== 'ALL' && staffName !== cashierFilter) return false;
    return true;
  };

  const filteredTxs = state.transactions.filter((tx) => {
    if (!matchesDateAndCashier(tx.business_date, tx.staff_name)) return false;
    if (roomFilter === 'ROOMS_ONLY' && tx.type !== 'room') return false;
    if (roomFilter === 'CAFE_ONLY' && tx.type === 'room') return false;
    if (!['ALL', 'ROOMS_ONLY', 'CAFE_ONLY'].includes(roomFilter) && tx.unit_id !== roomFilter) return false;
    if (drinkFilter !== 'ALL') {
      const hasDrink = (tx.items || []).some((it) => it.id === drinkFilter);
      if (!hasDrink) return false;
    }
    return true;
  });

  const filteredExps = state.expenses.filter((e) => matchesDateAndCashier(e.business_date, e.staff_name));
  const filteredLedger = state.notahLedger.filter((l) => l.entry_type === 'payment' && matchesDateAndCashier(l.business_date, l.staff_name));

  const startCash = (dayFilter === 'CURRENT' && !dateFrom && !dateTo && activeShift) ? (activeShift.start_cash || 0) : 0;
  const stats = computeFinancialStats(filteredTxs, filteredExps, filteredLedger, startCash);
  const marketNotah = state.clients.reduce((s, c) => s + (Number(c.notah_balance) || 0), 0);

  $('dashTodayTotal').textContent = fmtMoney(stats.totalSales);
  $('dashFilteredRoomsRev').textContent = fmtMoney(stats.roomsRev);
  $('dashFilteredDrinksRev').textContent = fmtMoney(stats.cafeRev);
  $('dashDrawerCash').textContent = fmtMoney(stats.expectedDrawer);
  $('dashTodayNotah').textContent = fmtMoney(stats.notahSales);
  $('dashTodayNotahCollected').textContent = fmtMoney(stats.notahCollected);
  $('dashTodayVfCash').textContent = fmtMoney(stats.vfCashTotal);
  if ($('dashTodayExpenses')) $('dashTodayExpenses').textContent = fmtMoney(stats.expensesTotal);
  $('dashMarketNotah').textContent = fmtMoney(marketNotah);

  // Live Units Grid
  const activeRooms = state.rooms.filter((r) => r.status !== 'idle');
  const activeTables = state.tables.filter((t) => t.status === 'open');
  $('dashActiveRoomsCount').textContent = `${activeRooms.length}/${state.rooms.length}`;
  $('dashActiveTablesCount').textContent = `${activeTables.length}/${state.tables.length}`;

  $('dashLiveUnitsGrid').innerHTML = [
    ...state.rooms.map((r) => {
      const busy = r.status !== 'idle';
      const m = busy ? getRoomLiveMetrics(r) : null;
      return `
        <div class="dash-unit-chip ${busy ? 'busy' : ''}" onclick="switchTab('rooms')">
          <strong>🎮 ${r.name}</strong>
          <div style="font-size:0.78rem;color:${busy ? 'var(--ps-cyan)' : 'var(--success)'};">
            ${busy ? `${r.mode} — ${fmtMoney(m.grandTotal)}` : 'متاحة'}
          </div>
        </div>
      `;
    }),
    ...state.tables.map((t) => {
      const busy = t.status === 'open';
      const tot = busy ? (t.orders || []).reduce((s, o) => s + o.price * o.qty, 0) : 0;
      return `
        <div class="dash-unit-chip ${busy ? 'table-busy' : ''}" onclick="switchTab('tables')">
          <strong>🪑 ${t.name}</strong>
          <div style="font-size:0.78rem;color:${busy ? 'var(--warning)' : 'var(--success)'};">
            ${busy ? `مفتوحة — ${fmtMoney(tot)}` : 'متاحة'}
          </div>
        </div>
      `;
    })
  ].join('');

  // Analytics Breakdown Table
  const breakdownMap = new Map();
  filteredTxs.forEach((tx) => {
    if (tx.type === 'room' && tx.room_time_cost > 0) {
      const key = `room:${tx.unit_id}`;
      const cur = breakdownMap.get(key) || { name: tx.title.split('(')[0].trim(), type: 'وقت لعب', count: 0, rev: 0 };
      cur.count += 1;
      cur.rev += Math.max(0, (Number(tx.room_time_cost) || 0) - (Number(tx.discount) || 0));
      breakdownMap.set(key, cur);
    }
    (tx.items || []).forEach((it) => {
      const key = `item:${it.name}`;
      const cur = breakdownMap.get(key) || { name: it.name, type: 'كافيه / صنف', count: 0, rev: 0 };
      cur.count += Number(it.qty) || 1;
      cur.rev += (Number(it.price) || 0) * (Number(it.qty) || 1);
      breakdownMap.set(key, cur);
    });
  });

  const breakdownRows = [...breakdownMap.values()].sort((a, b) => b.rev - a.rev);
  $('dashAnalyticsBreakdownBody').innerHTML = breakdownRows.map((row) => `
    <tr>
      <td><strong>${row.name}</strong></td>
      <td>${row.type}</td>
      <td>${row.count}</td>
      <td><strong>${fmtMoney(row.rev)}</strong></td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">لا توجد بيانات مطابقة للفلتر</td></tr>';

  // Top Items
  const topDrinks = breakdownRows.filter((r) => r.type === 'كافيه / صنف').slice(0, 5);
  $('dashTopItemsList').innerHTML = topDrinks.map((d) => `
    <div class="mini-list-item">
      <span>☕ ${d.name} (${d.count})</span>
      <strong>${fmtMoney(d.rev)}</strong>
    </div>
  `).join('') || '<p class="hint-text">لا توجد مبيعات أصناف بعد</p>';

  // Upcoming Reservations
  const upcomingRes = state.reservations.filter((r) => r.status === 'Upcoming').slice(0, 4);
  $('dashUpcomingResList').innerHTML = upcomingRes.map((r) => `
    <div class="mini-list-item">
      <span>📅 ${r.client_name} (${r.game})</span>
      <strong>${formatDateTimeAr(r.datetime)}</strong>
    </div>
  `).join('') || '<p class="hint-text">لا توجد حجوزات قادمة</p>';

  // Filtered Transactions + Expenses Table
  const combinedDashRows = [
    ...filteredTxs.map((tx) => ({
      ts: new Date(tx.created_at).getTime() || 0,
      dateCol: `${tx.business_date} (${formatTimeShort(tx.created_at)})`,
      titleCol: `🧾 ${tx.title}${tx.discount > 0 ? ` <small style="color:var(--warning)">(خصم ${fmtMoney(tx.discount)})</small>` : ''}`,
      amountCol: `<strong style="color:var(--success)">${fmtMoney(tx.total)}</strong>`,
      payCol: [
        tx.cash_paid > 0 ? `كاش: ${fmtMoney(tx.cash_paid)}` : '',
        tx.vfcash_paid > 0 ? `فودافون: ${fmtMoney(tx.vfcash_paid)}` : '',
        tx.notah_paid > 0 ? `نوتة: ${fmtMoney(tx.notah_paid)}` : ''
      ].filter(Boolean).join(' | '),
      staffCol: tx.staff_name || '-'
    })),
    ...filteredExps.map((ex) => ({
      ts: new Date(ex.created_at).getTime() || 0,
      dateCol: `${ex.business_date} (${formatTimeShort(ex.created_at)})`,
      titleCol: `💸 مصروف: ${ex.title}`,
      amountCol: `<strong style="color:var(--danger)">- ${fmtMoney(ex.amount)}</strong>`,
      payCol: 'خصم من الدرج',
      staffCol: ex.staff_name || '-'
    }))
  ].sort((a, b) => b.ts - a.ts);

  $('dashRecentTxBody').innerHTML = combinedDashRows.map((r) => `
    <tr>
      <td>${r.dateCol}</td>
      <td>${r.titleCol}</td>
      <td>${r.amountCol}</td>
      <td>${r.payCol}</td>
      <td>${r.staffCol}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">لا توجد عمليات</td></tr>';
}

function fixWrongBusinessDay() {
  const wrongDay = $('dashWrongDaySelect').value;
  const correctDay = $('dashCorrectDayInput').value;
  const keepTimers = $('dashKeepActiveTimers').checked;

  if (!wrongDay || !correctDay) {
    showToast('اختر اليوم الغلط واليوم الصح!', 'warning');
    return;
  }
  if (wrongDay === correctDay) {
    showToast('اليوم الصح هو نفس اليوم المختار!', 'warning');
    return;
  }
  if (!confirm(`هل أنت متأكد من إلغاء يوم (${wrongDay}) بالكامل واستبداله بيوم (${correctDay})؟`)) return;

  const txsToDel = state.transactions.filter((t) => t.business_date === wrongDay);
  txsToDel.forEach((t) => queueCloudSync('arena_transactions', 'delete', { id: t.id }));
  state.transactions = state.transactions.filter((t) => t.business_date !== wrongDay);

  const expsToDel = state.expenses.filter((e) => e.business_date === wrongDay);
  expsToDel.forEach((e) => queueCloudSync('arena_expenses', 'delete', { id: e.id }));
  state.expenses = state.expenses.filter((e) => e.business_date !== wrongDay);

  const activeShift = getActiveShift();
  if (activeShift && activeShift.business_date === wrongDay) {
    activeShift.business_date = correctDay;
    queueCloudSync('arena_shifts', 'upsert', activeShift);
  } else {
    const shiftsToDel = state.shifts.filter((s) => s.business_date === wrongDay);
    shiftsToDel.forEach((s) => queueCloudSync('arena_shifts', 'delete', { id: s.id }));
    state.shifts = state.shifts.filter((s) => s.business_date !== wrongDay);
  }

  if (!keepTimers) {
    state.rooms.forEach((r) => {
      if (r.status !== 'idle') {
        resetRoomObject(r);
        queueCloudSync('arena_rooms', 'upsert', r);
      }
    });
  }

  saveLocalDB();
  populateDashboardFilters();
  renderAll();
  showToast(`تم إلغاء يوم ${wrongDay} وتصحيحه إلى ${correctDay} ✅`, 'success');
}

/* Reports Tab */
function populateReportFilters() {
  const today = getCurrentBusinessDate();
  if ($('reportDateFrom') && !$('reportDateFrom').value) $('reportDateFrom').value = today;
  if ($('reportDateTo') && !$('reportDateTo').value) $('reportDateTo').value = today;

  if ($('reportFilterRoom')) {
    $('reportFilterRoom').innerHTML = [
      '<option value="ALL">الكل</option>',
      ...state.rooms.map((r) => `<option value="${r.id}">${r.name}</option>`)
    ].join('');
  }
  if ($('reportFilterItem')) {
    $('reportFilterItem').innerHTML = [
      '<option value="ALL">كل الأصناف</option>',
      ...state.menu.map((m) => `<option value="${m.id}">${m.name}</option>`)
    ].join('');
  }
}

function renderReports() {
  if (!mgmtUnlocked) return;
  const from = $('reportDateFrom').value;
  const to = $('reportDateTo').value;
  const roomF = $('reportFilterRoom').value;
  const itemF = $('reportFilterItem').value;

  const txs = state.transactions.filter((t) => {
    if (from && t.business_date < from) return false;
    if (to && t.business_date > to) return false;
    if (roomF !== 'ALL' && t.unit_id !== roomF) return false;
    if (itemF !== 'ALL' && !(t.items || []).some((i) => i.id === itemF)) return false;
    return true;
  });

  const exps = state.expenses.filter((e) => {
    if (from && e.business_date < from) return false;
    if (to && e.business_date > to) return false;
    return true;
  });

  const ledger = state.notahLedger.filter((l) => {
    if (l.entry_type !== 'payment') return false;
    if (from && l.business_date < from) return false;
    if (to && l.business_date > to) return false;
    return true;
  });

  const stats = computeFinancialStats(txs, exps, ledger, 0);
  $('repTotalRevenue').textContent = fmtMoney(stats.totalSales);
  $('repRoomsRev').textContent = fmtMoney(stats.roomsRev);
  $('repCafeRev').textContent = fmtMoney(stats.cafeRev);
  $('repNotahSales').textContent = fmtMoney(stats.notahSales);
  $('repNotahCollected').textContent = fmtMoney(stats.notahCollected);
  $('repExpenses').textContent = fmtMoney(stats.expensesTotal);

  $('reportsTransactionsBody').innerHTML = txs.map((tx) => `
    <tr>
      <td>${tx.business_date} (${formatTimeShort(tx.created_at)})</td>
      <td>${tx.title}${tx.discount > 0 ? ` <small style="color:var(--warning)">(خصم ${fmtMoney(tx.discount)})</small>` : ''}</td>
      <td><strong>${fmtMoney(tx.total)}</strong></td>
      <td>${[
        tx.cash_paid > 0 ? `كاش: ${fmtMoney(tx.cash_paid)}` : '',
        tx.vfcash_paid > 0 ? `فودافون: ${fmtMoney(tx.vfcash_paid)}` : '',
        tx.notah_paid > 0 ? `نوتة: ${fmtMoney(tx.notah_paid)}` : ''
      ].filter(Boolean).join(' | ')}</td>
      <td>${tx.staff_name || '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">لا توجد سجلات في هذه الفترة</td></tr>';
}

/* ==========================================================================
   SETTINGS TAB (RECEIPT DESIGNER, USERS, MENU/INVENTORY, ROOMS, TABLES, GAMES)
   ========================================================================== */
function renderSettings() {
  if (!mgmtUnlocked) return;
  const s = state.settings;

  $('setReceiptPaperSize').value = s.receiptPaperSize || '80mm';
  $('setReceiptFontSize').value = s.receiptFontSize || 'normal';
  $('setReceiptHeader').value = s.receiptHeader || '';
  $('setReceiptFooter').value = s.receiptFooter || '';
  $('setOwnerWhatsapp').value = s.ownerWhatsapp || '';
  renderReceiptLivePreview();

  // Users list
  $('settingsUsersList').innerHTML = state.users.map((u) => `
    <div class="mini-list-item">
      <span>👤 <strong>${u.name}</strong> (${u.role === 'admin' ? 'مدير' : 'كاشير'}) — PIN: <code dir="ltr">${u.pin}</code></span>
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-xs" onclick="editUser('${u.id}')">تعديل</button>
        ${u.id !== 'usr-admin' ? `<button type="button" class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">حذف</button>` : ''}
      </div>
    </div>
  `).join('');

  // Menu & Stock list
  const menuSearch = ($('settingsMenuSearch').value || '').trim().toLowerCase();
  const filteredMenu = state.menu.filter((m) => !menuSearch || m.name.toLowerCase().includes(menuSearch));
  $('settingsMenuList').innerHTML = filteredMenu.map((m) => `
    <div class="mini-list-item">
      <div>
        <strong>${m.name}</strong> <small style="color:var(--ps-cyan)">[${m.category}]</small>
        <div style="font-size:0.78rem;color:var(--text-muted);">بيع: ${fmtMoney(m.price)} | تكلفة: ${fmtMoney(m.cost || 0)} | مخزون: <strong>${m.stock}</strong> ${m.unit || 'قطعة'}</div>
      </div>
      <div class="btn-row">
        <div class="stock-quick-controls">
          <button type="button" class="tile-qty-btn minus" onclick="quickStockAdjust('${m.id}', -1)">-</button>
          <span style="font-size:0.8rem;font-weight:800;">${m.stock}</span>
          <button type="button" class="tile-qty-btn plus" onclick="quickStockAdjust('${m.id}', 1)">+</button>
        </div>
        <button type="button" class="btn btn-outline btn-xs" onclick="editMenuItem('${m.id}')">تعديل</button>
        <button type="button" class="btn btn-danger btn-xs" onclick="deleteMenuItem('${m.id}')">حذف</button>
      </div>
    </div>
  `).join('');

  // Rooms list
  $('settingsRoomsList').innerHTML = state.rooms.map((r) => `
    <div class="mini-list-item">
      <span>🎮 <strong>${r.name}</strong> (${r.device || 'PS5'}) — Single: ${r.singleRate}ج | Multi: ${r.multiRate}ج</span>
      <div class="btn-row">
        <button type="button" class="btn btn-outline btn-xs" onclick="editRoom('${r.id}')">تعديل</button>
        <button type="button" class="btn btn-danger btn-xs" onclick="deleteRoom('${r.id}')">حذف</button>
      </div>
    </div>
  `).join('');

  // Tables list
  $('settingsTablesList').innerHTML = state.tables.map((t) => `
    <div class="mini-list-item">
      <span>🪑 <strong>${t.name}</strong></span>
      <button type="button" class="btn btn-danger btn-xs" onclick="deleteTable('${t.id}')">حذف</button>
    </div>
  `).join('');

  // Games list
  const games = state.settings.games || DEFAULT_GAMES;
  $('settingsGamesList').innerHTML = games.map((g, idx) => `
    <div class="mini-list-item">
      <span>🕹️ <strong>${g}</strong></span>
      <button type="button" class="btn btn-danger btn-xs" onclick="deleteGame(${idx})">حذف</button>
    </div>
  `).join('') || '<p class="hint-text">لا توجد ألعاب مضافة</p>';
}

function renderReceiptLivePreview() {
  const preview = $('receiptLivePreview');
  const tag = $('previewPaperSizeTag');
  if (!preview) return;
  const size = $('setReceiptPaperSize').value || '80mm';
  const font = $('setReceiptFontSize').value || 'normal';
  if (tag) tag.textContent = size;

  preview.className = `receipt-paper receipt-${size} ${font === 'large' ? 'receipt-font-large' : font === 'compact' ? 'receipt-font-compact' : ''}`;
  const sampleTx = {
    id: 'tx-10245',
    business_date: getTodayDateStr(),
    created_at: new Date().toISOString(),
    type: 'room',
    title: 'Room 1 (FC 26)',
    room_time_cost: 60,
    single_ms: 1800000,
    single_cost: 25,
    multi_ms: 1800000,
    multi_cost: 35,
    total_duration_ms: 3600000,
    items: [{ name: 'بيبسي كانز', qty: 2, price: 20 }],
    subtotal: 100,
    discount: 10,
    total: 90,
    cash_paid: 90,
    vfcash_paid: 0,
    notah_paid: 0,
    staff_name: 'كاشير 1'
  };

  const tempSettings = {
    ...state.settings,
    receiptPaperSize: size,
    receiptFontSize: font,
    receiptHeader: $('setReceiptHeader').value,
    receiptFooter: $('setReceiptFooter').value
  };
  const orig = state.settings;
  state.settings = tempSettings;
  preview.innerHTML = buildReceiptHtml(sampleTx);
  state.settings = orig;
}

function quickStockAdjust(id, delta) {
  adjustMenuStock(id, delta);
  renderSettings();
  renderDirectCafePOS();
}

function editMenuItem(id) {
  const m = state.menu.find((x) => x.id === id);
  if (!m) return;
  $('setEditMenuId').value = m.id;
  $('setMenuName').value = m.name;
  $('setMenuCategory').value = m.category;
  $('setMenuPrice').value = m.price;
  $('setMenuCost').value = m.cost || 0;
  $('setMenuStock').value = m.stock || 0;
  $('setMenuMinStock').value = m.minStock || 5;
  $('setMenuUnit').value = m.unit || 'قطعة';
  $('setMenuIcon').value = m.icon || 'auto';
  $('btnAddMenuItem').textContent = '💾 حفظ تعديل الصنف';
  $('btnCancelEditMenu').classList.remove('hidden');
}

function resetMenuForm() {
  $('setEditMenuId').value = '';
  $('setMenuName').value = '';
  $('setMenuPrice').value = '';
  $('setMenuCost').value = '';
  $('setMenuStock').value = '';
  $('btnAddMenuItem').textContent = '➕ إضافة صنف للمنيو والمخزون';
  $('btnCancelEditMenu').classList.add('hidden');
}

function saveMenuItem() {
  const name = $('setMenuName').value.trim();
  const price = Number($('setMenuPrice').value);
  if (!name || isNaN(price) || price < 0) {
    showToast('أدخل اسم الصنف وسعر البيع!', 'warning');
    return;
  }

  const editId = $('setEditMenuId').value;
  const payload = {
    id: editId || uid('m'),
    name,
    category: $('setMenuCategory').value,
    price,
    cost: Number($('setMenuCost').value) || 0,
    stock: Number($('setMenuStock').value) || 0,
    minStock: Number($('setMenuMinStock').value) || 5,
    unit: $('setMenuUnit').value.trim() || 'قطعة',
    icon: $('setMenuIcon').value || 'auto'
  };

  if (editId) {
    const idx = state.menu.findIndex((m) => m.id === editId);
    if (idx !== -1) state.menu[idx] = payload;
  } else {
    state.menu.push(payload);
  }

  queueCloudSync('arena_menu', 'upsert', payload);
  resetMenuForm();
  renderSettings();
  renderDirectCafePOS();
  showToast('تم حفظ الصنف في المنيو والمخزون ✅', 'success');
}

function deleteMenuItem(id) {
  if (!confirm('حذف هذا الصنف من المنيو؟')) return;
  state.menu = state.menu.filter((m) => m.id !== id);
  queueCloudSync('arena_menu', 'delete', { id });
  renderSettings();
  renderDirectCafePOS();
  showToast('تم حذف الصنف', 'info');
}

function editUser(id) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return;
  $('setEditUserId').value = u.id;
  $('setUserName').value = u.name;
  $('setUserPin').value = u.pin;
  $('setUserRole').value = u.role;
  $('btnAddUser').textContent = '💾 حفظ التعديل';
  $('btnCancelEditUser').classList.remove('hidden');
}

function resetUserForm() {
  $('setEditUserId').value = '';
  $('setUserName').value = '';
  $('setUserPin').value = '';
  $('btnAddUser').textContent = '➕ إضافة يوزر جديد';
  $('btnCancelEditUser').classList.add('hidden');
}

function saveUser() {
  const name = $('setUserName').value.trim();
  const pin = $('setUserPin').value.trim();
  const role = $('setUserRole').value;
  if (!name || !pin) {
    showToast('أدخل اسم اليوزر والباسورد!', 'warning');
    return;
  }
  const editId = $('setEditUserId').value;
  const userObj = { id: editId || uid('usr'), name, pin, role };
  if (editId) {
    const idx = state.users.findIndex((u) => u.id === editId);
    if (idx !== -1) state.users[idx] = userObj;
  } else {
    state.users.push(userObj);
  }
  queueCloudSync('arena_users', 'upsert', userObj);
  resetUserForm();
  populateLoginUsers();
  renderSettings();
  showToast('تم حفظ بيانات اليوزر ✅', 'success');
}

function deleteUser(id) {
  if (!confirm('حذف هذا اليوزر؟')) return;
  state.users = state.users.filter((u) => u.id !== id);
  queueCloudSync('arena_users', 'delete', { id });
  populateLoginUsers();
  renderSettings();
  showToast('تم حذف اليوزر', 'info');
}

function editRoom(id) {
  const r = state.rooms.find((x) => x.id === id);
  if (!r) return;
  $('setEditRoomId').value = r.id;
  $('setRoomName').value = r.name;
  $('setRoomType').value = r.device || 'PS5';
  $('setRoomSingleRate').value = r.singleRate;
  $('setRoomMultiRate').value = r.multiRate;
  $('btnAddRoom').textContent = '💾 حفظ تعديل الغرفة';
  $('btnCancelEditRoom').classList.remove('hidden');
}

function resetRoomForm() {
  $('setEditRoomId').value = '';
  $('setRoomName').value = '';
  $('setRoomSingleRate').value = '';
  $('setRoomMultiRate').value = '';
  $('btnAddRoom').textContent = '➕ إضافة / حفظ غرفة';
  $('btnCancelEditRoom').classList.add('hidden');
}

function saveRoom() {
  const name = $('setRoomName').value.trim();
  const singleRate = Number($('setRoomSingleRate').value) || 50;
  const multiRate = Number($('setRoomMultiRate').value) || 70;
  const device = $('setRoomType').value;
  if (!name) {
    showToast('أدخل اسم الغرفة!', 'warning');
    return;
  }

  const editId = $('setEditRoomId').value;
  if (editId) {
    const r = state.rooms.find((x) => x.id === editId);
    if (r) {
      r.name = name;
      r.device = device;
      r.singleRate = singleRate;
      r.multiRate = multiRate;
      queueCloudSync('arena_rooms', 'upsert', r);
    }
  } else {
    const newR = normalizeRoom({
      id: uid('room'),
      name,
      device,
      singleRate,
      multiRate,
      status: 'idle',
      mode: 'Single',
      game: state.settings.games[0] || 'FC 26',
      timeType: 'open',
      fixedMinutes: 60,
      startTime: null
    });
    state.rooms.push(newR);
    queueCloudSync('arena_rooms', 'upsert', newR);
  }

  resetRoomForm();
  renderSettings();
  renderRoomsTab();
  showToast('تم حفظ بيانات الغرفة ✅', 'success');
}

function deleteRoom(id) {
  const r = state.rooms.find((x) => x.id === id);
  if (r && r.status !== 'idle') {
    showToast('لا يمكن حذف غرفة شغالة حالياً!', 'error');
    return;
  }
  if (!confirm('حذف هذه الغرفة؟')) return;
  state.rooms = state.rooms.filter((x) => x.id !== id);
  queueCloudSync('arena_rooms', 'delete', { id });
  renderSettings();
  renderRoomsTab();
  showToast('تم حذف الغرفة', 'info');
}

function addTable() {
  const name = $('setTableName').value.trim();
  if (!name) {
    showToast('أدخل اسم الترابيزة!', 'warning');
    return;
  }
  const tbl = { id: uid('tbl'), name, status: 'idle', clientName: '', openedAt: null, orders: [] };
  state.tables.push(tbl);
  queueCloudSync('arena_tables', 'upsert', tbl);
  $('setTableName').value = '';
  renderSettings();
  renderTablesTab();
  showToast('تمت إضافة الترابيزة ✅', 'success');
}

function deleteTable(id) {
  const t = state.tables.find((x) => x.id === id);
  if (t && t.status === 'open') {
    showToast('لا يمكن حذف ترابيزة مفتوحة حالياً!', 'error');
    return;
  }
  if (!confirm('حذف هذه الترابيزة؟')) return;
  state.tables = state.tables.filter((x) => x.id !== id);
  queueCloudSync('arena_tables', 'delete', { id });
  renderSettings();
  renderTablesTab();
  showToast('تم حذف الترابيزة', 'info');
}

function addGame() {
  const name = $('setGameName').value.trim();
  if (!name) {
    showToast('أدخل اسم اللعبة!', 'warning');
    return;
  }
  if (!Array.isArray(state.settings.games)) state.settings.games = [...DEFAULT_GAMES];
  if (state.settings.games.includes(name)) {
    showToast('اللعبة موجودة بالفعل في القائمة!', 'warning');
    return;
  }
  state.settings.games.push(name);
  saveSettingsToCloud();
  $('setGameName').value = '';
  renderSettings();
  renderReservationsTab();
  showToast(`تمت إضافة لعبة (${name}) ✅`, 'success');
}

function deleteGame(index) {
  if (!Array.isArray(state.settings.games)) return;
  const gameName = state.settings.games[index];
  if (!confirm(`هل تريد حذف لعبة "${gameName}" من القائمة؟`)) return;
  state.settings.games.splice(index, 1);
  saveSettingsToCloud();
  renderSettings();
  renderReservationsTab();
  showToast(`تم حذف لعبة (${gameName})`, 'info');
}

function saveSettingsToCloud() {
  queueCloudSync('arena_settings', 'upsert', { id: 'main', data: state.settings });
}

/* ==========================================================================
   DATA RESET CONTROLS (OPERATIONAL RESET & FACTORY RESET)
   ========================================================================== */
async function resetOperationalData() {
  if (!mgmtUnlocked) {
    showToast('يجب فتح قفل الإدارة أولاً!', 'error');
    return;
  }
  if (!confirm('⚠️ هل أنت متأكد من تصفير كل الفواتير، الورديات، المصروفات، الحجوزات، وأرصدة النوتة؟\n(سيتم الإبقاء على الغرف والمنيو واليوزرز كما هم)')) return;

  state.transactions = [];
  state.shifts = [];
  state.expenses = [];
  state.handovers = [];
  state.notahLedger = [];
  state.reservations = [];

  state.clients.forEach((c) => {
    c.notah_balance = 0;
  });

  state.rooms.forEach((r) => resetRoomObject(r));
  state.tables.forEach((t) => {
    t.status = 'idle';
    t.clientName = '';
    t.openedAt = null;
    t.orders = [];
  });

  localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  updateSyncBadge();
  saveLocalDB();

  if (supabaseClient && navigator.onLine) {
    try {
      const tablesToClear = [
        'arena_transactions',
        'arena_shifts',
        'arena_expenses',
        'arena_handovers',
        'arena_notah_ledger',
        'arena_reservations'
      ];
      for (const tbl of tablesToClear) {
        await supabaseClient.from(tbl).delete().neq('id', '_none_');
      }
      if (state.clients.length) await supabaseClient.from('arena_clients').upsert(state.clients);
      if (state.rooms.length) await supabaseClient.from('arena_rooms').upsert(state.rooms);
      if (state.tables.length) await supabaseClient.from('arena_tables').upsert(state.tables);
    } catch (e) {
      console.warn('Cloud reset warning:', e.message);
    }
  }

  renderAll();
  showToast('تم تصفير الفواتير والورديات والحسابات بنجاح 🧹✅', 'success');
}

function factoryResetSystem() {
  if (!mgmtUnlocked) {
    showToast('يجب فتح قفل الإدارة أولاً!', 'error');
    return;
  }
  if (!confirm('🚨 تحذير: سيتم مسح جميع البيانات المحلية وإعدادات الربط وإعادة تشغيل النظام من الصفر. هل تريد المتابعة؟')) return;
  if (!confirm('تأكيد أخير: لا يمكن التراجع عن هذه الخطوة!')) return;

  localStorage.removeItem(STORAGE_KEYS.LOCAL_DB);
  localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  localStorage.removeItem(STORAGE_KEYS.URL);
  localStorage.removeItem(STORAGE_KEYS.KEY);
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_USER);
  location.reload();
}

/* ==========================================================================
   MASTER RENDER & EVENT BINDINGS
   ========================================================================== */
function renderAll() {
  renderRoomsTab();
  renderTablesTab();
  renderDirectCafePOS();
  renderReservationsTab();
  renderClientsTab();
  renderShiftTab();
  if (mgmtUnlocked) {
    renderDashboard();
    renderReports();
    renderSettings();
  }
}

function bindEvents() {
  // Setup Screen
  $('btnSaveSetup').addEventListener('click', async () => {
    const url = $('setupUrl').value.trim();
    const key = $('setupKey').value.trim();
    if (!url || !key) {
      showToast('أدخل رابط Supabase والمفتاح!', 'warning');
      return;
    }
    localStorage.setItem(STORAGE_KEYS.URL, url);
    localStorage.setItem(STORAGE_KEYS.KEY, key);
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(url, key);
      await pullFromSupabase();
    }
    $('setupScreen').classList.add('hidden');
    populateLoginUsers();
    $('loginScreen').classList.remove('hidden');
  });

  // Login Screen & PIN Pad
  document.querySelectorAll('.pin-key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      if (!k) return;
      if (k === 'C') $('loginPin').value = '';
      else $('loginPin').value += k;
    });
  });
  $('btnLogin').addEventListener('click', handleLogin);
  $('loginPin').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  $('btnLogout').addEventListener('click', handleLogout);
  $('syncQueueBtn').addEventListener('click', flushSyncQueue);

  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (tab.classList.contains('mgmt-protected') && !mgmtUnlocked) {
        openMgmtAuthModal(target);
        return;
      }
      switchTab(target);
    });
  });

  // Management Password Modal
  $('btnUnlockMgmt').addEventListener('click', verifyMgmtPassword);
  $('mgmtPasswordInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyMgmtPassword(); });
  $('btnLockMgmt').addEventListener('click', lockManagement);

  // Start Room Modal
  $('startRoomSelect').addEventListener('change', (e) => syncStartRoomModalRates(e.target.value));
  document.querySelectorAll('#modalStartRoom .mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modalStartRoom .mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelectorAll('#modalStartRoom .time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modalStartRoom .time-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $('startFixedMinutesBox').classList.toggle('hidden', btn.dataset.type !== 'fixed');
    });
  });
  document.querySelectorAll('.preset-min-btn').forEach((btn) => {
    btn.addEventListener('click', () => { $('startFixedMinutes').value = btn.dataset.mins; });
  });
  $('btnConfirmStartRoom').addEventListener('click', confirmStartRoom);

  // Start Table & Switch Mode
  $('btnConfirmStartTable').addEventListener('click', confirmStartTable);
  $('btnConfirmSwitchMode').addEventListener('click', confirmSwitchMode);

  // POS & Direct Cafe
  $('cafeSearchInput').addEventListener('input', renderDirectCafePOS);
  $('btnClearDirectCart').addEventListener('click', () => {
    state.directCart = [];
    renderDirectCafePOS();
  });
  $('btnDirectCheckout').addEventListener('click', openDirectCheckoutModal);
  $('posSearchInput').addEventListener('input', renderModalPosGrid);
  $('btnConfirmRoomOrders').addEventListener('click', confirmModalPosOrders);

  // Checkout & Multi-Client Notah Split
  $('checkoutDiscount').addEventListener('input', () => recalculateCheckoutSplit('discount'));
  $('payCash').addEventListener('input', () => recalculateCheckoutSplit('cash'));
  $('payVfCash').addEventListener('input', () => recalculateCheckoutSplit('vfcash'));
  $('payNotah').addEventListener('input', () => recalculateCheckoutSplit('notah'));
  $('btnAddNotahSplitRow').addEventListener('click', addNotahSplitRow);
  $('btnToggleQuickClient').addEventListener('click', () => $('quickClientForm').classList.toggle('hidden'));
  $('btnSaveQuickClient').addEventListener('click', saveQuickClientFromCheckout);
  $('btnConfirmCheckoutPrint').addEventListener('click', finalizeCheckoutAndPrint);

  // Reservations & Clients
  $('btnAddReservation').addEventListener('click', addReservation);
  $('resFilterStatus').addEventListener('change', renderReservationsTab);
  $('btnAddClient').addEventListener('click', addNewClient);
  $('clientSearchInput').addEventListener('input', renderClientsTab);
  $('btnCollectFullNotah').addEventListener('click', () => {
    const client = state.clients.find((c) => c.id === $('detailClientId').value);
    if (client) $('collectNotahAmount').value = String(client.notah_balance || 0);
  });
  $('btnConfirmNotahCollect').addEventListener('click', confirmNotahCollection);

  // Shift, Handover & Close
  $('btnShowOpenShift').addEventListener('click', openOpenShiftModal);
  $('openShiftBusinessDate').addEventListener('change', (e) => {
    $('openShiftDayNameHint').textContent = `يوم: ${getArabicDayName(e.target.value)}`;
  });
  $('btnConfirmOpenShift').addEventListener('click', confirmOpenShift);
  $('btnAddExpense').addEventListener('click', addShiftExpense);
  $('btnShowHandoverShift').addEventListener('click', openHandoverModal);
  $('handoverActualCash').addEventListener('input', () => {
    const active = getActiveShift();
    if (!active) return;
    const expected = getShiftStats(active).expectedDrawer;
    const diff = (Number($('handoverActualCash').value) || 0) - expected;
    const badge = $('handoverDiffBadge');
    badge.className = `balance-status ${Math.abs(diff) <= 0.01 ? 'valid' : 'invalid'}`;
    badge.textContent = Math.abs(diff) <= 0.01 ? 'الكاش المُسلَّم مطابق للدرج ✅' : `فرق الدرج: ${fmtMoney(diff)}`;
  });
  $('btnConfirmHandoverShift').addEventListener('click', confirmHandoverShift);
  $('btnShowCloseShift').addEventListener('click', openCloseShiftModal);
  $('closeShiftActualCash').addEventListener('input', () => {
    const active = getActiveShift();
    if (!active) return;
    const expected = getShiftStats(active).expectedDrawer;
    const diff = (Number($('closeShiftActualCash').value) || 0) - expected;
    const badge = $('closeShiftDiffBadge');
    badge.className = `balance-status ${Math.abs(diff) <= 0.01 ? 'valid' : 'invalid'}`;
    badge.textContent = Math.abs(diff) <= 0.01 ? 'المبلغ مطابق للدرج ✅' : `العجز / الزيادة: ${fmtMoney(diff)}`;
  });
  $('btnConfirmCloseShift').addEventListener('click', confirmCloseShift);

  // Dashboard & Reports Filters
  $('btnApplyDashFilter').addEventListener('click', renderDashboard);
  $('btnResetDashFilter').addEventListener('click', () => {
    $('dashFilterBusinessDay').value = 'CURRENT';
    $('dashFilterDateFrom').value = '';
    $('dashFilterDateTo').value = '';
    $('dashFilterRoom').value = 'ALL';
    $('dashFilterDrink').value = 'ALL';
    $('dashFilterCashier').value = 'ALL';
    renderDashboard();
  });
  $('btnFixWrongBusinessDay').addEventListener('click', fixWrongBusinessDay);
  $('btnFilterReports').addEventListener('click', renderReports);

  // Settings: Receipt Designer
  $('setReceiptPaperSize').addEventListener('change', renderReceiptLivePreview);
  $('setReceiptFontSize').addEventListener('change', renderReceiptLivePreview);
  $('setReceiptHeader').addEventListener('input', renderReceiptLivePreview);
  $('setReceiptFooter').addEventListener('input', renderReceiptLivePreview);
  $('setReceiptLogoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.settings.receiptLogo = reader.result;
      renderReceiptLivePreview();
    };
    reader.readAsDataURL(file);
  });
  $('btnRemoveReceiptLogo').addEventListener('click', () => {
    state.settings.receiptLogo = '';
    $('setReceiptLogoInput').value = '';
    renderReceiptLivePreview();
  });
  $('btnSaveReceiptSettings').addEventListener('click', () => {
    state.settings.receiptPaperSize = $('setReceiptPaperSize').value;
    state.settings.receiptFontSize = $('setReceiptFontSize').value;
    state.settings.receiptHeader = $('setReceiptHeader').value;
    state.settings.receiptFooter = $('setReceiptFooter').value;
    saveSettingsToCloud();
    showToast('تم حفظ تصميم الفاتورة ✅', 'success');
  });

  // Settings: Mgmt Password, Users, WhatsApp, Reset, Menu, Rooms, Tables, Games
  $('btnSaveMgmtPass').addEventListener('click', () => {
    const p1 = $('setMgmtNewPass').value.trim();
    const p2 = $('setMgmtConfirmPass').value.trim();
    if (!p1 || p1 !== p2) {
      showToast('تأكد من إدخال الباسورد وتطابقه!', 'error');
      return;
    }
    state.settings.mgmtPassword = p1;
    saveSettingsToCloud();
    $('setMgmtNewPass').value = '';
    $('setMgmtConfirmPass').value = '';
    showToast('تم تحديث باسورد الإدارة ✅', 'success');
  });

  $('btnAddUser').addEventListener('click', saveUser);
  $('btnCancelEditUser').addEventListener('click', resetUserForm);

  $('btnSaveWhatsapp').addEventListener('click', () => {
    state.settings.ownerWhatsapp = $('setOwnerWhatsapp').value.trim();
    saveSettingsToCloud();
    showToast('تم حفظ رقم واتساب الإدارة ✅', 'success');
  });
  $('btnTestWhatsapp').addEventListener('click', () => {
    state.settings.ownerWhatsapp = $('setOwnerWhatsapp').value.trim();
    openWhatsappWithText(`✅ رسالة تجريبية من نظام ${state.settings.brandTitle || 'ARENA POS'}`);
  });

  $('btnResetOperations').addEventListener('click', resetOperationalData);
  $('btnFactoryReset').addEventListener('click', factoryResetSystem);

  $('btnAddMenuItem').addEventListener('click', saveMenuItem);
  $('btnCancelEditMenu').addEventListener('click', resetMenuForm);
  $('settingsMenuSearch').addEventListener('input', renderSettings);

  $('btnAddRoom').addEventListener('click', saveRoom);
  $('btnCancelEditRoom').addEventListener('click', resetRoomForm);
  $('btnAddTable').addEventListener('click', addTable);
  $('btnAddGame').addEventListener('click', addGame);
}

// Register Service Worker & Boot
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', initApp);
