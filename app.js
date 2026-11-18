/* ==========================================================================
   ARENA POS v3.0 - Complete Operations System
   Includes: Live Dashboard, PS5 Room Cards + Double-Click, Cafe Tables,
   Visual POS Grid + Smart Icons, Single<->Multi Switch, Receipt Designer,
   Notah Credit System, Reservations, Shift Handover + WhatsApp Reports, Offline Queue
   ========================================================================== */

const DEFAULT_SB_URL = 'https://ixzsopivjyuxlesagkju.supabase.co';
const DEFAULT_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4enNvcGl2anl1eGxlc2Fna2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NjU3NTksImV4cCI6MjExMDQ0MTc1OX0.odcj0uVh5DkQ99wxJiywhcxZs4XIFCLkLfcHbR2zGD0';

const STORAGE_KEYS = {
  URL: 'arena_sb_url',
  KEY: 'arena_sb_key',
  CACHE: 'arena_local_db_v3',
  QUEUE: 'arena_offline_queue_v3',
  USER: 'arena_active_user_v3'
};

let sbClient = null;
let isOnline = navigator.onLine;
let activeUser = null;
let liveTimerInterval = null;
let sysStateSchema = { idCol: 'id', valCol: 'data' };

let state = {
  rooms: [],
  tables: [],
  games: [],
  menuItems: [],
  users: [],
  clients: [],
  shifts: [],
  handovers: [],
  transactions: [],
  expenses: [],
  reservations: [],
  settings: {
    receiptLogo: '',
    receiptHeader: 'ARENA PLAYSTATION & CAFE\nأهلاً بكم في أرينا',
    receiptFooter: 'شكراً لزيارتكم - نتمنى لكم وقتاً ممتعاً!',
    ownerWhatsapp: ''
  }
};

// UI Working State
let directCart = {};
let roomPosCart = {};
let directActiveCat = 'الكل';
let roomPosActiveCat = 'الكل';
let selectedStartGame = '';
let selectedStartMode = 'Single';
let selectedStartTimeType = 'open';
let pendingReservationId = null;
let lastClosedShiftReportText = '';
let lastHandoverReportText = '';

/* ================= 1. INITIALIZATION & OFFLINE WORKER ================= */

document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  setupNetworkListeners();
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const qUrl = params.get('url');
  const qKey = params.get('key');
  if (qUrl && qKey) {
    localStorage.setItem(STORAGE_KEYS.URL, qUrl.trim());
    localStorage.setItem(STORAGE_KEYS.KEY, qKey.trim());
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const sbUrl = localStorage.getItem(STORAGE_KEYS.URL) || DEFAULT_SB_URL;
  const sbKey = localStorage.getItem(STORAGE_KEYS.KEY) || DEFAULT_SB_KEY;

  if (!sbUrl || !sbKey) {
    showScreen('setupScreen');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.URL, sbUrl);
  localStorage.setItem(STORAGE_KEYS.KEY, sbKey);

  initSupabase(sbUrl, sbKey);
  loadLocalCache();
  await syncAllDataFromCloud();

  const savedUser = sessionStorage.getItem(STORAGE_KEYS.USER);
  if (savedUser) {
    try {
      activeUser = JSON.parse(savedUser);
      enterMainApp();
      return;
    } catch (_) {}
  }

  showScreen('loginScreen');
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function setupNetworkListeners() {
  const updateNetUI = () => {
    isOnline = navigator.onLine;
    const badge = document.getElementById('connectionBadge');
    const text = document.getElementById('connectionText');
    const loginHint = document.getElementById('loginOfflineHint');
    if (isOnline) {
      badge.className = 'status-badge online';
      text.textContent = 'متصل Live';
      if (loginHint) loginHint.classList.add('hidden');
      flushOfflineQueue();
    } else {
      badge.className = 'status-badge offline';
      text.textContent = 'أوفلاين (محلي)';
      if (loginHint) loginHint.classList.remove('hidden');
    }
    updateQueueBadge();
  };

  window.addEventListener('online', updateNetUI);
  window.addEventListener('offline', updateNetUI);
  updateNetUI();
}

function initSupabase(url, key) {
  try {
    sbClient = window.supabase.createClient(url, key);
  } catch (err) {
    console.error('Supabase init error:', err);
  }
}

/* ================= 2. LOCAL CACHE & OFFLINE QUEUE ================= */

function saveLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(state));
  } catch (_) {}
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        ...state,
        ...parsed,
        settings: { ...state.settings, ...(parsed.settings || {}) }
      };
    }
  } catch (_) {}

  ensureDefaultsIfEmpty();
}

function ensureDefaultsIfEmpty() {
  if (!state.users || state.users.length === 0) {
    state.users = [{ id: 'admin-default', name: 'المدير العام', pin: '1234', role: 'admin' }];
  }
  if (!state.games || state.games.length === 0) {
    state.games = [
      { id: 'g1', name: 'FC 26' },
      { id: 'g2', name: 'PES 2021' },
      { id: 'g3', name: 'GTA V' },
      { id: 'g4', name: 'Mortal Kombat' }
    ];
  }
  if (!state.tables || state.tables.length === 0) {
    state.tables = [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `tbl-${n}`,
      name: `ترابيزة ${n}`,
      status: 'idle',
      session: null
    }));
  }
}

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
  } catch (_) {
    return [];
  }
}

function setOfflineQueue(q) {
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(q));
  updateQueueBadge();
}

function updateQueueBadge() {
  const q = getOfflineQueue();
  const btn = document.getElementById('syncQueueBtn');
  const count = document.getElementById('syncQueueCount');
  if (!btn || !count) return;
  count.textContent = q.length;
  btn.classList.toggle('hidden', q.length === 0);
}

async function dbMutate(table, action, payload, matchCol = 'id', matchVal = null) {
  saveLocalCache();

  if (!sbClient || !navigator.onLine) {
    const q = getOfflineQueue();
    q.push({ table, action, payload, matchCol, matchVal, ts: Date.now() });
    setOfflineQueue(q);
    return;
  }

  const ok = await executeSingleCloudOp({ table, action, payload, matchCol, matchVal });
  if (!ok) {
    const q = getOfflineQueue();
    q.push({ table, action, payload, matchCol, matchVal, ts: Date.now() });
    setOfflineQueue(q);
  }
}

async function executeSingleCloudOp(op) {
  if (!sbClient) return false;
  try {
    let res;
    if (op.action === 'upsert') {
      res = await sbClient.from(op.table).upsert(op.payload);
    } else if (op.action === 'insert') {
      res = await sbClient.from(op.table).insert(op.payload);
    } else if (op.action === 'update') {
      res = await sbClient.from(op.table).update(op.payload).eq(op.matchCol, op.matchVal);
    } else if (op.action === 'delete') {
      res = await sbClient.from(op.table).delete().eq(op.matchCol, op.matchVal);
    }
    if (res && res.error) {
      if (res.error.code === 'PGRST204' || res.error.code === '42703') {
        const msg = res.error.message || '';
        const match = msg.match(/'([^']+)'/);
        if (match && match[1] && op.payload && typeof op.payload === 'object') {
          const cleanPayload = { ...op.payload };
          delete cleanPayload[match[1]];
          return executeSingleCloudOp({ ...op, payload: cleanPayload });
        }
      }
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function flushOfflineQueue() {
  if (!sbClient || !navigator.onLine) return;
  const q = getOfflineQueue();
  if (q.length === 0) return;

  const remaining = [];
  for (const op of q) {
    const ok = await executeSingleCloudOp(op);
    if (!ok) remaining.push(op);
  }
  setOfflineQueue(remaining);
  if (remaining.length === 0) {
    showToast('تمت مزامنة جميع عمليات الأوفلاين مع السحابة ✅', 'success');
    await syncAllDataFromCloud();
  }
}

/* ================= 3. CLOUD SYNC & REALTIME ================= */

async function syncAllDataFromCloud() {
  if (!sbClient || !navigator.onLine) return;

  try {
    const [
      roomsRes,
      gamesRes,
      menuRes,
      usersRes,
      clientsRes,
      shiftsRes,
      txRes,
      expRes,
      resvRes,
      sysRes
    ] = await Promise.all([
      sbClient.from('rooms').select('*').order('id', { ascending: true }),
      sbClient.from('games').select('*'),
      sbClient.from('menu_items').select('*'),
      sbClient.from('users').select('*'),
      sbClient.from('clients').select('*'),
      sbClient.from('shifts').select('*').order('start_time', { ascending: false }).limit(30),
      sbClient.from('transactions').select('*').order('created_at', { ascending: false }).limit(250),
      sbClient.from('expenses').select('*').order('created_at', { ascending: false }).limit(150),
      sbClient.from('reservations').select('*').order('res_datetime', { ascending: true }),
      sbClient.from('system_state').select('*')
    ]);

    if (roomsRes.data && roomsRes.data.length > 0) {
      state.rooms = roomsRes.data.map(normalizeRoom);
    }
    if (gamesRes.data && gamesRes.data.length > 0) {
      state.games = gamesRes.data;
    }
    if (menuRes.data) {
      state.menuItems = menuRes.data.map((m) => ({
        ...m,
        category: m.category || 'مشروبات ساخنة',
        icon: m.icon || 'auto',
        price: Number(m.price || 0)
      }));
    }
    if (usersRes.data && usersRes.data.length > 0) {
      state.users = usersRes.data;
    }
    if (clientsRes.data) {
      state.clients = clientsRes.data.map((c) => ({
        ...c,
        notah_balance: Number(c.notah_balance || 0),
        notah_history: Array.isArray(c.notah_history) ? c.notah_history : []
      }));
    }
    if (shiftsRes.data) {
      state.shifts = shiftsRes.data;
    }
    if (txRes.data) {
      state.transactions = txRes.data;
    }
    if (expRes.data) {
      state.expenses = expRes.data;
    }
    if (resvRes.data) {
      state.reservations = resvRes.data;
    }
    if (sysRes.data && sysRes.data.length > 0) {
      const sample = sysRes.data[0];
      if ('key' in sample && 'value' in sample) {
        sysStateSchema = { idCol: 'key', valCol: 'value' };
      } else {
        sysStateSchema = { idCol: 'id', valCol: 'data' };
      }
      const cfgRow = sysRes.data.find((r) => r[sysStateSchema.idCol] === 'arena_settings');
      if (cfgRow && cfgRow[sysStateSchema.valCol]) {
        state.settings = { ...state.settings, ...cfgRow[sysStateSchema.valCol] };
      }
      const tblRow = sysRes.data.find((r) => r[sysStateSchema.idCol] === 'arena_tables');
      if (tblRow && Array.isArray(tblRow[sysStateSchema.valCol]) && tblRow[sysStateSchema.valCol].length > 0) {
        state.tables = tblRow[sysStateSchema.valCol];
      }
      const hoRow = sysRes.data.find((r) => r[sysStateSchema.idCol] === 'arena_handovers');
      if (hoRow && Array.isArray(hoRow[sysStateSchema.valCol])) {
        state.handovers = hoRow[sysStateSchema.valCol];
      }
    }

    ensureDefaultsIfEmpty();
    saveLocalCache();
    if (activeUser) renderAll();
  } catch (err) {
    console.warn('Cloud fetch fallback to local cache:', err);
  }
}

function normalizeRoom(r) {
  return {
    id: String(r.id),
    name: r.name || `Room ${r.id}`,
    type: r.type || r.device_type || 'PS5',
    single_rate: Number(r.single_rate ?? r.singleRate ?? 50),
    multi_rate: Number(r.multi_rate ?? r.multiRate ?? 70),
    status: r.status || 'idle',
    session: r.session || null
  };
}

function subscribeRealtime() {
  if (!sbClient) return;
  try {
    sbClient
      .channel('arena-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (getOfflineQueue().length === 0) {
          syncAllDataFromCloud();
        }
      })
      .subscribe();
  } catch (_) {}
}

async function saveSystemStateKey(keyName, valueObj) {
  const payload = {
    [sysStateSchema.idCol]: keyName,
    [sysStateSchema.valCol]: valueObj
  };
  await dbMutate('system_state', 'upsert', payload, sysStateSchema.idCol, keyName);
}

/* ================= 4. AUTH & NAVIGATION ================= */

function showScreen(screenId) {
  ['setupScreen', 'loginScreen', 'mainApp'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== screenId);
  });
}

function handleLogin() {
  const pinInput = document.getElementById('loginPin');
  const errEl = document.getElementById('loginError');
  const pin = (pinInput.value || '').trim();

  const found = state.users.find((u) => String(u.pin) === pin);
  if (!found) {
    errEl.classList.remove('hidden');
    pinInput.value = '';
    return;
  }

  errEl.classList.add('hidden');
  pinInput.value = '';
  activeUser = found;
  sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(found));
  enterMainApp();
}

function enterMainApp() {
  showScreen('mainApp');
  document.getElementById('currentUserBadge').textContent =
    `${activeUser.name} (${activeUser.role === 'admin' ? 'مدير' : 'كاشير'})`;

  document.querySelectorAll('.admin-only').forEach((el) => {
    el.classList.toggle('hidden', activeUser.role !== 'admin');
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const fromEl = document.getElementById('reportDateFrom');
  const toEl = document.getElementById('reportDateTo');
  if (fromEl && !fromEl.value) fromEl.value = todayStr;
  if (toEl && !toEl.value) toEl.value = todayStr;

  subscribeRealtime();
  startLiveTicker();
  renderAll();
  flushOfflineQueue();
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'rooms') renderRooms();
  if (tabName === 'tables') renderTables();
  if (tabName === 'cafe') renderDirectCafePos();
  if (tabName === 'reservations') renderReservationsTab();
  if (tabName === 'clients') renderClientsTab();
  if (tabName === 'shift') renderShiftTab();
  if (tabName === 'reports') renderReports();
  if (tabName === 'settings') renderSettings();
}

/* ================= 5. LIVE DASHBOARD ================= */

function renderDashboard() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const todayTxs = state.transactions.filter((t) => new Date(t.created_at).getTime() >= todayMs);

  let todaySales = 0;
  let todayNotah = 0;
  let todayNotahCollected = 0;
  let todayVfCash = 0;

  todayTxs.forEach((t) => {
    const amt = Number(t.amount || 0);
    if (t.type === 'room' || t.type === 'cafe' || t.type === 'table') {
      todaySales += amt;
    } else if (t.type === 'notah_collection') {
      todayNotahCollected += amt;
    }
    todayNotah += Number(t.notah_amount || 0);
    todayVfCash += Number(t.vfcash_amount || 0);
  });

  const openShift = getOpenShift();
  const drawerCash = openShift ? computeShiftStats(openShift).expectedDrawer : 0;

  const runningRooms = state.rooms.filter((r) => r.status === 'running');
  const openTables = state.tables.filter((t) => t.status === 'open');
  const totalMarketNotah = state.clients.reduce((s, c) => s + Number(c.notah_balance || 0), 0);

  document.getElementById('dashTodayTotal').textContent = `${todaySales} ج.م`;
  document.getElementById('dashDrawerCash').textContent = `${drawerCash} ج.م`;
  document.getElementById('dashTodayNotah').textContent = `${todayNotah} ج.م`;
  document.getElementById('dashTodayNotahCollected').textContent = `${todayNotahCollected} ج.م`;
  document.getElementById('dashTodayVfCash').textContent = `${todayVfCash} ج.م`;
  document.getElementById('dashActiveRoomsCount').textContent = `${runningRooms.length} / ${state.rooms.length}`;
  document.getElementById('dashActiveTablesCount').textContent = `${openTables.length} / ${state.tables.length}`;
  document.getElementById('dashMarketNotah').textContent = `${totalMarketNotah} ج.م`;

  // Live Rooms & Tables Quick Grid
  const unitsEl = document.getElementById('dashLiveUnitsGrid');
  if (unitsEl) {
    const roomChips = state.rooms.map((r) => {
      const busy = r.status === 'running' && r.session;
      const m = busy ? calculateSessionMetrics(r) : null;
      return `
        <div class="dash-unit-chip ${busy ? 'busy' : ''}" onclick="switchTab('rooms')">
          <div style="display:flex;justify-content:space-between;">
            <strong>🎮 ${escapeHtml(r.name)}</strong>
            <span style="font-size:0.75rem;color:${busy ? 'var(--ps-cyan)' : 'var(--success)'}">${busy ? r.session.mode : 'متاحة'}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            ${busy ? `${escapeHtml(r.session.game)} • <strong style="color:#fff">${m.totalCost} ج</strong>` : 'جاهزة للتشغيل'}
          </div>
        </div>
      `;
    });

    const tableChips = state.tables.map((t) => {
      const open = t.status === 'open' && t.session;
      const total = open ? (t.session.orders || []).reduce((s, o) => s + o.price * o.qty, 0) : 0;
      return `
        <div class="dash-unit-chip ${open ? 'table-busy' : ''}" onclick="switchTab('tables')">
          <div style="display:flex;justify-content:space-between;">
            <strong>🪑 ${escapeHtml(t.name)}</strong>
            <span style="font-size:0.75rem;color:${open ? 'var(--warning)' : 'var(--success)'}">${open ? 'مفتوحة' : 'متاحة'}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
            ${open ? `طلبات: <strong style="color:#fff">${total} ج</strong>` : 'فارغة'}
          </div>
        </div>
      `;
    });

    unitsEl.innerHTML = [...roomChips, ...tableChips].join('');
  }

  // Top Selling Items & Upcoming Reservations
  const topItemsEl = document.getElementById('dashTopItemsList');
  if (topItemsEl) {
    const itemCounts = {};
    todayTxs.forEach((t) => {
      const desc = t.description || '';
      state.menuItems.forEach((m) => {
        const regex = new RegExp(`${escapeRegExp(m.name)}\\s*×\\s*(\\d+)`, 'g');
        let match;
        while ((match = regex.exec(desc)) !== null) {
          itemCounts[m.name] = (itemCounts[m.name] || 0) + Number(match[1]);
        }
      });
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    topItemsEl.innerHTML =
      sortedItems.length === 0
        ? `<p class="hint-text">ستظهر هنا أكثر الأصناف طلباً خلال اليوم</p>`
        : sortedItems
            .map(
              ([name, qty]) => `
            <div class="mini-list-item">
              <span>☕ ${escapeHtml(name)}</span>
              <strong>${qty} قطعة</strong>
            </div>
          `
            )
            .join('');
  }

  const upResEl = document.getElementById('dashUpcomingResList');
  if (upResEl) {
    const upcoming = state.reservations.filter((r) => r.status === 'Upcoming').slice(0, 4);
    upResEl.innerHTML =
      upcoming.length === 0
        ? `<p class="hint-text">لا توجد حجوزات قادمة حالياً</p>`
        : upcoming
            .map(
              (r) => `
            <div class="mini-list-item">
              <span><strong>${escapeHtml(r.client_name)}</strong> (${escapeHtml(r.game_name)})</span>
              <span style="color:var(--ps-cyan);font-size:0.8rem">${formatDateTime(r.res_datetime)}</span>
            </div>
          `
            )
            .join('');
  }

  // Recent Transactions Today
  const recentBody = document.getElementById('dashRecentTxBody');
  if (recentBody) {
    const recent = todayTxs.slice(0, 10);
    recentBody.innerHTML =
      recent.length === 0
        ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا توجد فواتير مسجلة اليوم بعد</td></tr>`
        : recent
            .map(
              (t) => `
            <tr>
              <td>${formatTimeShort(t.created_at)}</td>
              <td><strong>${escapeHtml(t.description)}</strong></td>
              <td><strong style="color:var(--success)">${t.amount} ج.م</strong></td>
              <td>${escapeHtml(t.payment_summary || '')}</td>
              <td>${escapeHtml(t.staff_name || '-')}</td>
            </tr>
          `
            )
            .join('');
  }
}

/* ================= 6. SMART PRODUCT SVG ICONS ================= */

function detectIconKey(item) {
  if (item.icon && item.icon !== 'auto') return item.icon;
  const n = (item.name || '').toLowerCase();
  const c = (item.category || '').toLowerCase();

  if (/بيبسي|كولا|سبرايت|سفن|ميرندا|فانتا|ريد|كانز|صودا|pepsi|cola|sprite|7up|fanta|soda|can/.test(n)) return 'can';
  if (/مياه|ميه|water/.test(n)) return 'water';
  if (/شاي|ينسون|نعناع|كركديه|قرفة|جنزبيل|tea|mint|herbs/.test(n)) return 'tea';
  if (/آيس|ايس|ميلك|شيك|سموزي|فرابيه|iced|shake|smoothie|frappe/.test(n + ' ' + c)) return 'iced';
  if (/عصير|موهيتو|ليمون|مانجو|فراولة|برتقال|juice|mojito/.test(n)) return 'juice';
  if (/شيبسي|سناكس|فشار|مكسرات|لب|بسكوت|chips|snack|popcorn/.test(n)) return 'snack';
  if (/وافل|مولتن|كيك|دونات|حلو|شوكولاتة|كرواسون|waffle|cake|sweet|chocolate/.test(n + ' ' + c)) return 'sweet';
  if (/قهوة|إسبريسو|اسبريسو|لاتيه|كابتشينو|موكا|امريكان|نسكافيه|coffee|espresso|latte|cappuccino|mocha/.test(n + ' ' + c)) return 'coffee';
  return 'coffee';
}

function getSmartItemSvg(item) {
  const key = detectIconKey(item);
  const svgs = {
    can: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <rect x="20" y="10" width="24" height="44" rx="5" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
      <rect x="22" y="7" width="20" height="4" rx="2" fill="#cbd5e1"/>
      <path d="M20 26 Q32 32 44 26 L44 38 Q32 32 20 38 Z" fill="#ef4444"/>
      <circle cx="32" cy="32" r="5" fill="#ffffff" opacity="0.9"/>
    </svg>`,
    water: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <rect x="26" y="7" width="12" height="5" rx="2" fill="#0284c7"/>
      <path d="M24 12 L40 12 L43 22 L43 53 C43 55 41 57 39 57 L25 57 C23 57 21 55 21 53 L21 22 Z" fill="#bae6fd" stroke="#38bdf8" stroke-width="2"/>
      <rect x="21" y="30" width="22" height="12" fill="#0ea5e9" opacity="0.85"/>
    </svg>`,
    coffee: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <path d="M16 24 H44 V40 C44 48 38 53 30 53 C22 53 16 48 16 40 Z" fill="#78350f" stroke="#d97706" stroke-width="2"/>
      <path d="M44 27 H49 C52 27 54 30 54 33 C54 36 52 39 49 39 H44" stroke="#d97706" stroke-width="3"/>
      <ellipse cx="30" cy="24" rx="14" ry="3.5" fill="#b45309"/>
      <path d="M24 17 Q26 12 24 9 M31 17 Q33 12 31 9 M38 17 Q40 12 38 9" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    tea: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <path d="M18 22 H42 L39 52 H21 Z" fill="#d97706" fill-opacity="0.85" stroke="#fbbf24" stroke-width="2"/>
      <path d="M42 26 H47 C50 26 51 29 51 32 C51 35 50 38 47 38 H41" stroke="#fbbf24" stroke-width="2.5"/>
      <line x1="30" y1="20" x2="35" y2="33" stroke="#fef3c7" stroke-width="1.5"/>
      <rect x="32" y="32" width="6" height="7" rx="1" fill="#ef4444"/>
    </svg>`,
    iced: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <path d="M20 20 H44 L40 55 H24 Z" fill="#c084fc" fill-opacity="0.7" stroke="#e879f9" stroke-width="2"/>
      <path d="M18 20 C18 13 46 13 46 20 Z" fill="#f8fafc"/>
      <line x1="34" y1="7" x2="31" y2="26" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      <rect x="25" y="30" width="6" height="6" rx="1" fill="#fff" opacity="0.6"/>
      <rect x="33" y="38" width="6" height="6" rx="1" fill="#fff" opacity="0.6"/>
    </svg>`,
    juice: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <path d="M21 22 H43 L40 54 H24 Z" fill="#f97316" stroke="#fdba74" stroke-width="2"/>
      <circle cx="43" cy="21" r="7" fill="#facc15" stroke="#fef08a" stroke-width="2"/>
      <line x1="28" y1="9" x2="31" y2="34" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    snack: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <rect x="17" y="12" width="30" height="42" rx="4" fill="#ef4444" stroke="#fca5a5" stroke-width="2"/>
      <circle cx="32" cy="33" r="9" fill="#facc15"/>
      <path d="M17 17 H47 M17 49 H47" stroke="#fde047" stroke-width="2"/>
    </svg>`,
    sweet: `<svg class="pos-tile-svg" viewBox="0 0 64 64" fill="none">
      <rect x="15" y="24" width="34" height="22" rx="6" fill="#d97706" stroke="#fbbf24" stroke-width="2"/>
      <path d="M20 24 Q26 32 32 24 Q38 32 44 24" fill="#451a03"/>
      <circle cx="32" cy="19" r="5" fill="#ef4444"/>
    </svg>`
  };
  return svgs[key] || svgs.coffee;
}

/* ================= 7. PS5 ROOM CARDS & LIVE TIMER ================= */

function startLiveTicker() {
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  liveTimerInterval = setInterval(() => {
    updateLiveRoomTimers();
  }, 1000);
}

function calculateSessionMetrics(room) {
  const s = room.session;
  if (!s) return { elapsedSec: 0, remainingSec: null, timeCost: 0, ordersCost: 0, totalCost: 0, isExpired: false };

  const now = Date.now();
  const activeMs = s.isPaused
    ? 0
    : Math.max(0, now - Number(s.segmentStart || s.startTime || now));

  const currentRate = s.mode === 'Multi' ? Number(room.multi_rate) : Number(room.single_rate);
  const currentSegmentCost = (activeMs / 3600000) * currentRate;
  const timeCost = Math.ceil(Number(s.accumulatedCost || 0) + currentSegmentCost);

  const totalElapsedSec = Math.floor((Number(s.accumulatedElapsedMs || 0) + activeMs) / 1000);
  const ordersCost = (s.orders || []).reduce((sum, o) => sum + Number(o.price) * Number(o.qty), 0);

  let remainingSec = null;
  let isExpired = false;
  if (s.timeType === 'fixed' && Number(s.fixedMinutes) > 0) {
    const targetSec = Number(s.fixedMinutes) * 60;
    remainingSec = targetSec - totalElapsedSec;
    if (remainingSec <= 0) isExpired = true;
  }

  return {
    elapsedSec: totalElapsedSec,
    remainingSec,
    timeCost,
    ordersCost,
    totalCost: timeCost + ordersCost,
    isExpired
  };
}

function formatDuration(totalSeconds) {
  const abs = Math.abs(Math.floor(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function renderRooms() {
  const grid = document.getElementById('roomsGrid');
  const summaryBar = document.getElementById('roomsSummaryBar');
  if (!grid) return;

  let runningCount = 0;
  let idleCount = 0;

  grid.innerHTML = state.rooms
    .map((room) => {
      const isBusy = room.status === 'running' && room.session;
      if (!isBusy) {
        idleCount++;
        return `
          <div class="ps5-card status-idle" data-room-id="${room.id}" ondblclick="openStartRoomModal('${room.id}')">
            <div class="ps5-led-strip"></div>
            <div class="ps5-card-inner">
              <div class="ps5-card-top">
                <span class="ps5-room-name">${escapeHtml(room.name)}</span>
                <span class="ps5-device-tag">${escapeHtml(room.type)}</span>
              </div>
              <div class="ps5-idle-body">
                <div class="ps5-console-emblem">🎮</div>
                <div class="ps5-idle-status">متاحة للتشغيل</div>
                <div class="ps5-dblclick-hint">اضغط مرتين (Double Click) للتشغيل</div>
              </div>
              <div class="ps5-rates-footer">
                <span>Single: <strong>${room.single_rate} ج</strong></span>
                <span>Multi: <strong>${room.multi_rate} ج</strong></span>
              </div>
            </div>
          </div>
        `;
      }

      runningCount++;
      const s = room.session;
      const m = calculateSessionMetrics(room);
      const statusClass = m.isExpired
        ? 'status-expired'
        : s.isPaused
        ? 'status-paused'
        : 'status-running';

      const timerMain =
        s.timeType === 'fixed'
          ? m.isExpired
            ? `انتهى الوقت (+${formatDuration(m.remainingSec)})`
            : formatDuration(m.remainingSec)
          : formatDuration(m.elapsedSec);

      const timerSub =
        s.timeType === 'fixed'
          ? `المدة المحددة: ${s.fixedMinutes} دقيقة | المنقضي: ${formatDuration(m.elapsedSec)}`
          : s.isPaused
          ? '⏸️ متوقف مؤقتاً (Hold)'
          : `وقت مفتوح • بدأ ${formatTimeShort(s.startTime)}`;

      return `
        <div class="ps5-card ${statusClass}" id="room-card-${room.id}">
          <div class="ps5-led-strip"></div>
          <div class="ps5-card-inner">
            <div class="ps5-card-top">
              <span class="ps5-room-name">${escapeHtml(room.name)}</span>
              <span class="ps5-device-tag">${s.mode === 'Multi' ? '👥 Multi' : '👤 Single'}</span>
            </div>

            <div class="ps5-session-meta">
              <span class="meta-pill">🕹️ ${escapeHtml(s.game || 'بدون لعبة')}</span>
              ${s.clientName ? `<span class="meta-pill">👤 ${escapeHtml(s.clientName)}</span>` : ''}
            </div>

            <div class="ps5-timer-display">
              <span id="room-timer-${room.id}">${timerMain}</span>
              <span class="ps5-timer-sub" id="room-timersub-${room.id}">${timerSub}</span>
            </div>

            <div class="ps5-cost-breakdown">
              <span>لعب: <b id="room-timecost-${room.id}">${m.timeCost} ج</b></span>
              <span>طلبات (${(s.orders || []).reduce((a, b) => a + b.qty, 0)}): <b>${m.ordersCost} ج</b></span>
              <span>الإجمالي: <strong id="room-totalcost-${room.id}">${m.totalCost} ج</strong></span>
            </div>

            <div class="ps5-actions-grid">
              <button class="btn btn-primary btn-sm" onclick="openRoomPosModal('${room.id}')">🛒 + طلبات</button>
              <button class="btn btn-outline btn-sm" onclick="openSwitchModeModal('${room.id}')">🔄 تبديل (${s.mode === 'Single' ? 'Multi' : 'Single'})</button>
              <button class="btn btn-warning btn-sm" onclick="toggleRoomPause('${room.id}')">${s.isPaused ? '▶️ استئناف' : '⏸️ هولد'}</button>
              <button class="btn btn-success btn-sm btn-checkout-full" onclick="openRoomCheckoutModal('${room.id}')">🧾 تقفيل الحساب</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  if (summaryBar) {
    summaryBar.innerHTML = `
      <div class="summary-chip">إجمالي الغرف: <strong>${state.rooms.length}</strong></div>
      <div class="summary-chip" style="color:var(--ps-cyan)">شغالة الآن: <strong>${runningCount}</strong></div>
      <div class="summary-chip" style="color:var(--success)">متاحة: <strong>${idleCount}</strong></div>
    `;
  }
}

function updateLiveRoomTimers() {
  state.rooms.forEach((room) => {
    if (room.status !== 'running' || !room.session) return;
    const m = calculateSessionMetrics(room);
    const card = document.getElementById(`room-card-${room.id}`);
    const timerEl = document.getElementById(`room-timer-${room.id}`);
    const subEl = document.getElementById(`room-timersub-${room.id}`);
    const timeCostEl = document.getElementById(`room-timecost-${room.id}`);
    const totalCostEl = document.getElementById(`room-totalcost-${room.id}`);

    if (!timerEl) return;
    const s = room.session;

    if (m.isExpired && card && !card.classList.contains('status-expired')) {
      card.classList.remove('status-running');
      card.classList.add('status-expired');
    }

    timerEl.textContent =
      s.timeType === 'fixed'
        ? m.isExpired
          ? `انتهى الوقت (+${formatDuration(m.remainingSec)})`
          : formatDuration(m.remainingSec)
        : formatDuration(m.elapsedSec);

    if (subEl && s.timeType === 'fixed') {
      subEl.textContent = `المدة المحددة: ${s.fixedMinutes} دقيقة | المنقضي: ${formatDuration(m.elapsedSec)}`;
    }
    if (timeCostEl) timeCostEl.textContent = `${m.timeCost} ج`;
    if (totalCostEl) totalCostEl.textContent = `${m.totalCost} ج`;
  });
}

/* ================= 8. START ROOM & SINGLE<->MULTI SWITCH ================= */

function openStartRoomModal(roomId, prefill = null) {
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room) return;

  document.getElementById('startRoomId').value = room.id;
  document.getElementById('startRoomTitle').textContent = `🎮 تشغيل ${room.name} (${room.type})`;
  document.getElementById('startSingleRateHint').textContent = `${room.single_rate} ج/ساعة`;
  document.getElementById('startMultiRateHint').textContent = `${room.multi_rate} ج/ساعة`;

  selectedStartMode = prefill?.mode || 'Single';
  selectedStartGame = prefill?.game || (state.games[0]?.name || 'FC 26');
  selectedStartTimeType = 'open';
  pendingReservationId = prefill?.reservationId || null;

  document.getElementById('startClientName').value = prefill?.clientName || '';
  document.getElementById('startClientPhone').value = prefill?.clientPhone || '';
  document.getElementById('startFixedMinutes').value = 60;

  updateStartRoomModalUI();
  openModal('modalStartRoom');
}

function updateStartRoomModalUI() {
  document.getElementById('startModeSingle').classList.toggle('active', selectedStartMode === 'Single');
  document.getElementById('startModeMulti').classList.toggle('active', selectedStartMode === 'Multi');

  document.getElementById('startTimeTypeOpen').classList.toggle('active', selectedStartTimeType === 'open');
  document.getElementById('startTimeTypeFixed').classList.toggle('active', selectedStartTimeType === 'fixed');
  document.getElementById('startFixedMinutesBox').classList.toggle('hidden', selectedStartTimeType !== 'fixed');

  const gamesGrid = document.getElementById('startGamesGrid');
  gamesGrid.innerHTML = state.games
    .map(
      (g) => `
      <button type="button" class="game-pick-btn ${selectedStartGame === g.name ? 'active' : ''}"
        onclick="selectStartGame('${escapeAttr(g.name)}')">
        ${escapeHtml(g.name)}
      </button>
    `
    )
    .join('');
}

function selectStartGame(name) {
  selectedStartGame = name;
  updateStartRoomModalUI();
}

async function confirmStartRoom() {
  if (!requireOpenShift()) return;

  const roomId = document.getElementById('startRoomId').value;
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room) return;

  const now = Date.now();
  const fixedMinutes =
    selectedStartTimeType === 'fixed'
      ? Math.max(5, Number(document.getElementById('startFixedMinutes').value || 60))
      : null;

  room.status = 'running';
  room.session = {
    startTime: now,
    segmentStart: now,
    accumulatedCost: 0,
    accumulatedElapsedMs: 0,
    isPaused: false,
    mode: selectedStartMode,
    game: selectedStartGame,
    timeType: selectedStartTimeType,
    fixedMinutes,
    clientName: document.getElementById('startClientName').value.trim(),
    clientPhone: document.getElementById('startClientPhone').value.trim(),
    orders: [],
    staffName: activeUser.name
  };

  if (pendingReservationId) {
    const resv = state.reservations.find((r) => r.id === pendingReservationId);
    if (resv) {
      resv.status = 'Completed';
      await dbMutate('reservations', 'update', { status: 'Completed' }, 'id', resv.id);
    }
    pendingReservationId = null;
  }

  await dbMutate('rooms', 'update', { status: 'running', session: room.session }, 'id', room.id);
  closeModal('modalStartRoom');
  renderAll();
  showToast(`تم تشغيل ${room.name} (${room.session.mode}) ✅`, 'success');
}

async function toggleRoomPause(roomId) {
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room || !room.session) return;

  const s = room.session;
  const now = Date.now();

  if (!s.isPaused) {
    const activeMs = Math.max(0, now - Number(s.segmentStart || s.startTime));
    const rate = s.mode === 'Multi' ? Number(room.multi_rate) : Number(room.single_rate);
    s.accumulatedCost = Number(s.accumulatedCost || 0) + (activeMs / 3600000) * rate;
    s.accumulatedElapsedMs = Number(s.accumulatedElapsedMs || 0) + activeMs;
    s.isPaused = true;
    showToast(`تم عمل Hold لـ ${room.name}`, 'warning');
  } else {
    s.segmentStart = now;
    s.isPaused = false;
    showToast(`تم استئناف ${room.name} ▶️`, 'success');
  }

  await dbMutate('rooms', 'update', { session: s }, 'id', room.id);
  renderRooms();
}

function openSwitchModeModal(roomId) {
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room || !room.session) return;

  const s = room.session;
  const currentMode = s.mode;
  const targetMode = currentMode === 'Single' ? 'Multi' : 'Single';
  const targetRate = targetMode === 'Multi' ? room.multi_rate : room.single_rate;

  document.getElementById('switchRoomId').value = room.id;
  document.getElementById('switchRoomTitle').textContent = `🔄 تبديل نظام اللعب - ${room.name}`;
  document.getElementById('switchCurrentInfo').innerHTML =
    `الوضع الحالي: <strong>${currentMode}</strong> على لعبة <strong>${escapeHtml(s.game)}</strong>`;
  document.getElementById('switchTargetLabel').textContent =
    `${targetMode === 'Multi' ? '👥 Multi (زوجي)' : '👤 Single (فردي)'} — بسعر ${targetRate} ج/ساعة`;

  openModal('modalSwitchMode');
}

async function confirmSwitchMode() {
  const roomId = document.getElementById('switchRoomId').value;
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room || !room.session) return;

  const s = room.session;
  const now = Date.now();

  if (!s.isPaused) {
    const activeMs = Math.max(0, now - Number(s.segmentStart || s.startTime));
    const currentRate = s.mode === 'Multi' ? Number(room.multi_rate) : Number(room.single_rate);
    s.accumulatedCost = Number(s.accumulatedCost || 0) + (activeMs / 3600000) * currentRate;
    s.accumulatedElapsedMs = Number(s.accumulatedElapsedMs || 0) + activeMs;
    s.segmentStart = now;
  }

  s.mode = s.mode === 'Single' ? 'Multi' : 'Single';

  await dbMutate('rooms', 'update', { session: s }, 'id', room.id);
  closeModal('modalSwitchMode');
  renderRooms();
  showToast(`تم التحويل إلى ${s.mode} على نفس اللعبة ✅`, 'success');
}

/* ================= 9. CAFE TABLES SECTION ================= */

function renderTables() {
  const grid = document.getElementById('tablesGrid');
  const summaryBar = document.getElementById('tablesSummaryBar');
  if (!grid) return;

  let openCount = 0;
  let idleCount = 0;

  grid.innerHTML = state.tables
    .map((tbl) => {
      const isOpen = tbl.status === 'open' && tbl.session;
      if (!isOpen) {
        idleCount++;
        return `
          <div class="table-card idle" ondblclick="openStartTableModal('${tbl.id}')">
            <div class="table-card-header">
              <strong style="font-size:1.1rem">🪑 ${escapeHtml(tbl.name)}</strong>
              <span class="badge badge-completed">متاحة</span>
            </div>
            <div style="text-align:center;padding:24px 8px;color:var(--text-muted)">
              <div style="font-size:1.8rem;margin-bottom:4px">☕</div>
              <div>اضغط مرتين (Double Click) لفتح الترابيزة</div>
            </div>
          </div>
        `;
      }

      openCount++;
      const s = tbl.session;
      const orders = Array.isArray(s.orders) ? s.orders : [];
      const totalCost = orders.reduce((sum, o) => sum + Number(o.price) * Number(o.qty), 0);

      return `
        <div class="table-card open">
          <div class="table-card-header">
            <strong style="font-size:1.1rem">🪑 ${escapeHtml(tbl.name)}</strong>
            <span class="badge badge-debt">مفتوحة • ${formatTimeShort(s.startTime)}</span>
          </div>
          ${s.clientName ? `<div style="font-size:0.84rem;color:var(--ps-cyan)">👤 ${escapeHtml(s.clientName)}</div>` : ''}

          <div class="table-orders-preview">
            ${
              orders.length === 0
                ? `<span style="color:var(--text-muted)">لا توجد طلبات مسجلة بعد</span>`
                : orders
                    .map(
                      (o) => `<div style="display:flex;justify-content:space-between;">
                        <span>${escapeHtml(o.name)} × ${o.qty}</span>
                        <strong>${o.price * o.qty} ج</strong>
                      </div>`
                    )
                    .join('')
            }
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span>إجمالي الترابيزة:</span>
            <strong style="color:var(--success);font-size:1.2rem">${totalCost} ج.م</strong>
          </div>

          <div class="ps5-actions-grid">
            <button class="btn btn-primary btn-sm" onclick="openTablePosModal('${tbl.id}')">🛒 + طلبات</button>
            <button class="btn btn-success btn-sm" onclick="openTableCheckoutModal('${tbl.id}')">🧾 تقفيل الحساب</button>
          </div>
        </div>
      `;
    })
    .join('');

  if (summaryBar) {
    summaryBar.innerHTML = `
      <div class="summary-chip">إجمالي الترابيزات: <strong>${state.tables.length}</strong></div>
      <div class="summary-chip" style="color:var(--warning)">مفتوحة الآن: <strong>${openCount}</strong></div>
      <div class="summary-chip" style="color:var(--success)">متاحة: <strong>${idleCount}</strong></div>
    `;
  }
}

function openStartTableModal(tableId) {
  if (!requireOpenShift()) return;
  const tbl = state.tables.find((t) => String(t.id) === String(tableId));
  if (!tbl) return;
  document.getElementById('startTableId').value = tbl.id;
  document.getElementById('startTableTitle').textContent = `🪑 فتح ${tbl.name}`;
  document.getElementById('startTableClientName').value = '';
  openModal('modalStartTable');
}

async function confirmStartTable() {
  if (!requireOpenShift()) return;
  const tableId = document.getElementById('startTableId').value;
  const tbl = state.tables.find((t) => String(t.id) === String(tableId));
  if (!tbl) return;

  tbl.status = 'open';
  tbl.session = {
    startTime: Date.now(),
    clientName: document.getElementById('startTableClientName').value.trim(),
    orders: [],
    staffName: activeUser.name
  };

  await saveSystemStateKey('arena_tables', state.tables);
  closeModal('modalStartTable');
  renderAll();
  showToast(`تم فتح ${tbl.name} ✅`, 'success');
}

/* ================= 10. WIDE VISUAL POS GRID (ROOMS, TABLES, DIRECT) ================= */

function getCategoriesList() {
  const cats = new Set(['الكل']);
  state.menuItems.forEach((m) => {
    if (m.category) cats.add(m.category);
  });
  return Array.from(cats);
}

function openRoomPosModal(roomId) {
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room || !room.session) return;

  document.getElementById('posTargetType').value = 'room';
  document.getElementById('posTargetRoomId').value = room.id;
  document.getElementById('posModalTitle').textContent = `🛒 إضافة طلبات - ${room.name}`;
  document.getElementById('posSearchInput').value = '';
  roomPosCart = {};
  roomPosActiveCat = 'الكل';

  renderPosInterface('room');
  openModal('modalPosOrders');
}

function openTablePosModal(tableId) {
  const tbl = state.tables.find((t) => String(t.id) === String(tableId));
  if (!tbl || !tbl.session) return;

  document.getElementById('posTargetType').value = 'table';
  document.getElementById('posTargetRoomId').value = tbl.id;
  document.getElementById('posModalTitle').textContent = `🛒 إضافة طلبات - ${tbl.name}`;
  document.getElementById('posSearchInput').value = '';
  roomPosCart = {};
  roomPosActiveCat = 'الكل';

  renderPosInterface('room');
  openModal('modalPosOrders');
}

function renderDirectCafePos() {
  renderPosInterface('direct');
}

function renderPosInterface(mode) {
  const isModal = mode === 'room';
  const catContainer = document.getElementById(isModal ? 'posCategoryTabs' : 'cafeCategoryTabs');
  const gridContainer = document.getElementById(isModal ? 'posProductsGrid' : 'cafeProductsGrid');
  const cartContainer = document.getElementById(isModal ? 'posCartList' : 'directCartList');
  const totalEl = document.getElementById(isModal ? 'posCartTotal' : 'directCartTotal');
  const searchVal = (document.getElementById(isModal ? 'posSearchInput' : 'cafeSearchInput')?.value || '').trim().toLowerCase();

  const activeCat = isModal ? roomPosActiveCat : directActiveCat;
  const cart = isModal ? roomPosCart : directCart;

  const cats = getCategoriesList();
  catContainer.innerHTML = cats
    .map(
      (cat) => `
      <button type="button" class="pos-cat-tab ${activeCat === cat ? 'active' : ''}"
        onclick="selectPosCategory('${mode}', '${escapeAttr(cat)}')">
        ${escapeHtml(cat)}
      </button>
    `
    )
    .join('');

  const filtered = state.menuItems.filter((item) => {
    const matchCat = activeCat === 'الكل' || item.category === activeCat;
    const matchSearch = !searchVal || item.name.toLowerCase().includes(searchVal);
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `<p class="hint-text">لا توجد أصناف مطابقة. أضف أصنافاً من تبويب الإعدادات.</p>`;
  } else {
    gridContainer.innerHTML = filtered
      .map((item) => {
        const qty = Number(cart[item.id] || 0);
        return `
          <div class="pos-tile ${qty > 0 ? 'selected' : ''}" onclick="adjustPosCart('${mode}', '${item.id}', 1)">
            <span class="pos-tile-price">${item.price} ج.م</span>
            ${getSmartItemSvg(item)}
            <div class="pos-tile-name">${escapeHtml(item.name)}</div>
            <div class="pos-tile-qty-bar" onclick="event.stopPropagation()">
              <button type="button" class="tile-qty-btn minus" onclick="adjustPosCart('${mode}', '${item.id}', -1)">-</button>
              <strong>${qty}</strong>
              <button type="button" class="tile-qty-btn plus" onclick="adjustPosCart('${mode}', '${item.id}', 1)">+</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  let total = 0;
  const entries = Object.entries(cart).filter(([, q]) => q > 0);
  if (entries.length === 0) {
    cartContainer.innerHTML = `<p class="hint-text" style="text-align:center;margin-top:20px;">اضغط على أي صنف لإضافته</p>`;
  } else {
    cartContainer.innerHTML = entries
      .map(([id, qty]) => {
        const item = state.menuItems.find((m) => String(m.id) === String(id));
        if (!item) return '';
        const lineTotal = item.price * qty;
        total += lineTotal;
        return `
          <div class="pos-cart-row">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div style="font-size:0.76rem;color:var(--text-muted)">${item.price} × ${qty} = ${lineTotal} ج</div>
            </div>
            <div class="pos-cart-controls">
              <button type="button" class="tile-qty-btn minus" onclick="adjustPosCart('${mode}', '${item.id}', -1)">-</button>
              <strong>${qty}</strong>
              <button type="button" class="tile-qty-btn plus" onclick="adjustPosCart('${mode}', '${item.id}', 1)">+</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  totalEl.textContent = `${total} ج.م`;
}

function selectPosCategory(mode, cat) {
  if (mode === 'room') roomPosActiveCat = cat;
  else directActiveCat = cat;
  renderPosInterface(mode);
}

function adjustPosCart(mode, itemId, delta) {
  const cart = mode === 'room' ? roomPosCart : directCart;
  const next = Math.max(0, Number(cart[itemId] || 0) + delta);
  if (next === 0) delete cart[itemId];
  else cart[itemId] = next;
  renderPosInterface(mode);
}

async function confirmPosModalOrders() {
  const targetType = document.getElementById('posTargetType').value;
  const targetId = document.getElementById('posTargetRoomId').value;

  const entries = Object.entries(roomPosCart).filter(([, q]) => q > 0);
  if (entries.length === 0) {
    showToast('اختر صنفاً واحداً على الأقل', 'warning');
    return;
  }

  if (targetType === 'table') {
    const tbl = state.tables.find((t) => String(t.id) === String(targetId));
    if (!tbl || !tbl.session) return;
    if (!Array.isArray(tbl.session.orders)) tbl.session.orders = [];

    entries.forEach(([id, qty]) => {
      const item = state.menuItems.find((m) => String(m.id) === String(id));
      if (!item) return;
      const existing = tbl.session.orders.find((o) => String(o.id) === String(id));
      if (existing) existing.qty += qty;
      else tbl.session.orders.push({ id: item.id, name: item.name, price: item.price, qty });
    });

    await saveSystemStateKey('arena_tables', state.tables);
    closeModal('modalPosOrders');
    renderAll();
    showToast(`تمت إضافة الطلبات لحساب ${tbl.name} ✅`, 'success');
    return;
  }

  const room = state.rooms.find((r) => String(r.id) === String(targetId));
  if (!room || !room.session) return;
  if (!Array.isArray(room.session.orders)) room.session.orders = [];

  entries.forEach(([id, qty]) => {
    const item = state.menuItems.find((m) => String(m.id) === String(id));
    if (!item) return;
    const existing = room.session.orders.find((o) => String(o.id) === String(id));
    if (existing) existing.qty += qty;
    else room.session.orders.push({ id: item.id, name: item.name, price: item.price, qty });
  });

  await dbMutate('rooms', 'update', { session: room.session }, 'id', room.id);
  closeModal('modalPosOrders');
  renderAll();
  showToast(`تمت إضافة الطلبات لحساب ${room.name} ✅`, 'success');
}

/* ================= 11. CHECKOUT & NOTAH SYSTEM ================= */

let activeCheckoutData = null;

function openRoomCheckoutModal(roomId) {
  if (!requireOpenShift()) return;
  const room = state.rooms.find((r) => String(r.id) === String(roomId));
  if (!room || !room.session) return;

  const s = room.session;
  const m = calculateSessionMetrics(room);

  const lines = [
    { label: `لعب ${room.name} (${s.game} - ${s.mode}) [${formatDuration(m.elapsedSec)}]`, amount: m.timeCost }
  ];
  (s.orders || []).forEach((o) => {
    lines.push({ label: `${o.name} × ${o.qty}`, amount: o.price * o.qty });
  });

  activeCheckoutData = {
    contextType: 'room',
    contextId: room.id,
    title: `فاتورة ${room.name}`,
    description: `${room.name} (${s.game} - ${s.mode})${(s.orders || []).length ? ' + ' + s.orders.map((o) => `${o.name} × ${o.qty}`).join('، ') : ''}`,
    lines,
    timeCost: m.timeCost,
    ordersCost: m.ordersCost,
    subtotal: m.totalCost,
    defaultClientName: s.clientName || ''
  };

  prepareCheckoutModal();
}

function openTableCheckoutModal(tableId) {
  if (!requireOpenShift()) return;
  const tbl = state.tables.find((t) => String(t.id) === String(tableId));
  if (!tbl || !tbl.session) return;

  const s = tbl.session;
  const orders = Array.isArray(s.orders) ? s.orders : [];
  if (orders.length === 0) {
    showToast('الترابيزة ليس عليها طلبات — يمكنك إغلاقها أو إضافة طلبات أولاً', 'warning');
  }

  let subtotal = 0;
  const lines = orders.map((o) => {
    const amt = Number(o.price) * Number(o.qty);
    subtotal += amt;
    return { label: `${o.name} × ${o.qty}`, amount: amt };
  });

  activeCheckoutData = {
    contextType: 'table',
    contextId: tbl.id,
    title: `فاتورة ${tbl.name}`,
    description: `${tbl.name} (${lines.map((l) => l.label).join('، ') || 'بدون طلبات'})`,
    lines,
    timeCost: 0,
    ordersCost: subtotal,
    subtotal,
    defaultClientName: s.clientName || ''
  };

  prepareCheckoutModal();
}

function openDirectCafeCheckout() {
  if (!requireOpenShift()) return;
  const entries = Object.entries(directCart).filter(([, q]) => q > 0);
  if (entries.length === 0) {
    showToast('السلة فارغة!', 'warning');
    return;
  }

  const lines = [];
  let subtotal = 0;
  entries.forEach(([id, qty]) => {
    const item = state.menuItems.find((m) => String(m.id) === String(id));
    if (!item) return;
    const amt = item.price * qty;
    subtotal += amt;
    lines.push({ label: `${item.name} × ${qty}`, amount: amt });
  });

  activeCheckoutData = {
    contextType: 'cafe',
    contextId: 'direct',
    title: 'فاتورة كافيه / تيك أواي',
    description: `تيك أواي (${lines.map((l) => l.label).join('، ')})`,
    lines,
    timeCost: 0,
    ordersCost: subtotal,
    subtotal,
    defaultClientName: ''
  };

  prepareCheckoutModal();
}

function prepareCheckoutModal() {
  const d = activeCheckoutData;
  document.getElementById('checkoutTitle').textContent = `🧾 تقفيل - ${d.title}`;
  document.getElementById('checkoutBreakdownBox').innerHTML = d.lines
    .map((l) => `<div class="receipt-row"><span>${escapeHtml(l.label)}</span><strong>${l.amount} ج.م</strong></div>`)
    .join('');

  document.getElementById('checkoutSubtotal').textContent = `${d.subtotal} ج.م`;
  document.getElementById('checkoutDiscount').value = 0;
  document.getElementById('payCash').value = d.subtotal;
  document.getElementById('payVfCash').value = 0;
  document.getElementById('payNotah').value = 0;

  populateNotahClientSelect(d.defaultClientName);
  document.getElementById('quickClientForm').classList.add('hidden');
  recalculateCheckoutSplit('init');
  openModal('modalCheckout');
}

function populateNotahClientSelect(matchName = '') {
  const sel = document.getElementById('checkoutNotahClientSelect');
  sel.innerHTML =
    `<option value="">-- اختر العميل --</option>` +
    state.clients
      .map(
        (c) =>
          `<option value="${c.id}" ${matchName && c.name.includes(matchName) ? 'selected' : ''}>
            ${escapeHtml(c.name)} (${c.phone || 'بدون رقم'}) - عليه: ${c.notah_balance || 0} ج
          </option>`
      )
      .join('');
}

function recalculateCheckoutSplit(changedField) {
  if (!activeCheckoutData) return;
  const subtotal = activeCheckoutData.subtotal;
  const discount = Math.max(0, Number(document.getElementById('checkoutDiscount').value || 0));
  const grandTotal = Math.max(0, subtotal - discount);
  document.getElementById('checkoutGrandTotal').textContent = `${grandTotal} ج.م`;

  const cashEl = document.getElementById('payCash');
  const vfEl = document.getElementById('payVfCash');
  const notahEl = document.getElementById('payNotah');

  if (changedField === 'discount') {
    cashEl.value = Math.max(0, grandTotal - Number(vfEl.value || 0) - Number(notahEl.value || 0));
  } else if (changedField === 'notah' || changedField === 'vfcash') {
    const vf = Math.max(0, Number(vfEl.value || 0));
    const notah = Math.max(0, Number(notahEl.value || 0));
    const rem = grandTotal - vf - notah;
    if (rem >= 0) cashEl.value = rem;
  }

  const cash = Math.max(0, Number(cashEl.value || 0));
  const vf = Math.max(0, Number(vfEl.value || 0));
  const notah = Math.max(0, Number(notahEl.value || 0));
  const sum = cash + vf + notah;
  const diff = grandTotal - sum;

  document.getElementById('checkoutNotahClientBox').classList.toggle('hidden', notah <= 0);

  const statusEl = document.getElementById('checkoutBalanceStatus');
  if (Math.abs(diff) < 0.01) {
    statusEl.className = 'balance-status valid';
    statusEl.textContent = `المبلغ مطابق للإجمالي (${grandTotal} ج.م) ✅`;
    return true;
  } else if (diff > 0) {
    statusEl.className = 'balance-status invalid';
    statusEl.textContent = `متبقي ${diff} ج.م لم يتم توزيعها ⚠️`;
    return false;
  } else {
    statusEl.className = 'balance-status invalid';
    statusEl.textContent = `المبلغ المدخل يزيد عن الفاتورة بمقدار ${Math.abs(diff)} ج.م ⚠️`;
    return false;
  }
}

async function handleQuickCreateClient() {
  const name = document.getElementById('quickClientName').value.trim();
  const phone = document.getElementById('quickClientPhone').value.trim();
  if (!name) return showToast('اكتب اسم العميل أولاً', 'warning');

  const newClient = {
    id: 'cli-' + Date.now(),
    name,
    phone,
    notah_balance: 0,
    notah_history: []
  };

  state.clients.unshift(newClient);
  await dbMutate('clients', 'insert', newClient);

  populateNotahClientSelect();
  document.getElementById('checkoutNotahClientSelect').value = newClient.id;
  document.getElementById('quickClientForm').classList.add('hidden');
  document.getElementById('quickClientName').value = '';
  document.getElementById('quickClientPhone').value = '';
  renderClientsTab();
  showToast(`تم إنشاء بروفايل العميل "${name}" ✅`, 'success');
}

async function finalizeCheckoutAndPrint() {
  if (!activeCheckoutData) return;
  if (!recalculateCheckoutSplit('verify')) {
    showToast('تأكد من تطابق المبالغ المدفوعة مع إجمالي الفاتورة', 'error');
    return;
  }

  const discount = Math.max(0, Number(document.getElementById('checkoutDiscount').value || 0));
  const grandTotal = Math.max(0, activeCheckoutData.subtotal - discount);
  const cashPaid = Math.max(0, Number(document.getElementById('payCash').value || 0));
  const vfPaid = Math.max(0, Number(document.getElementById('payVfCash').value || 0));
  const notahPaid = Math.max(0, Number(document.getElementById('payNotah').value || 0));

  let targetClient = null;
  if (notahPaid > 0) {
    const clientId = document.getElementById('checkoutNotahClientSelect').value;
    targetClient = state.clients.find((c) => String(c.id) === String(clientId));
    if (!targetClient) {
      showToast('يجب اختيار بروفايل العميل لتسجيل المبلغ على النوتة!', 'error');
      return;
    }
  }

  const openShift = getOpenShift();
  const nowIso = new Date().toISOString();

  const payParts = [];
  if (cashPaid > 0) payParts.push(`كاش: ${cashPaid} ج`);
  if (vfPaid > 0) payParts.push(`فودافون كاش: ${vfPaid} ج`);
  if (notahPaid > 0) payParts.push(`على النوتة (${targetClient.name}): ${notahPaid} ج`);

  const tx = {
    id: 'tx-' + Date.now(),
    shift_id: openShift ? openShift.id : 'unassigned',
    type: activeCheckoutData.contextType,
    description: activeCheckoutData.description,
    time_cost: activeCheckoutData.timeCost,
    orders_cost: activeCheckoutData.ordersCost,
    discount,
    amount: grandTotal,
    cash_amount: cashPaid,
    vfcash_amount: vfPaid,
    notah_amount: notahPaid,
    payment_summary: payParts.join(' + ') || '0 ج',
    client_id: targetClient ? targetClient.id : null,
    client_name: targetClient ? targetClient.name : null,
    staff_name: activeUser.name,
    created_at: nowIso
  };

  if (grandTotal > 0) {
    state.transactions.unshift(tx);
    await dbMutate('transactions', 'insert', tx);
  }

  if (targetClient && notahPaid > 0) {
    targetClient.notah_balance = Number(targetClient.notah_balance || 0) + notahPaid;
    if (!Array.isArray(targetClient.notah_history)) targetClient.notah_history = [];
    targetClient.notah_history.unshift({
      id: 'nh-' + Date.now(),
      date: nowIso,
      entryType: 'debt',
      description: activeCheckoutData.description,
      lines: activeCheckoutData.lines,
      totalBill: grandTotal,
      paidAtCheckout: cashPaid + vfPaid,
      notahAdded: notahPaid,
      staffName: activeUser.name
    });

    await dbMutate(
      'clients',
      'update',
      {
        notah_balance: targetClient.notah_balance,
        notah_history: targetClient.notah_history
      },
      'id',
      targetClient.id
    );
  }

  if (activeCheckoutData.contextType === 'room') {
    const room = state.rooms.find((r) => String(r.id) === String(activeCheckoutData.contextId));
    if (room) {
      room.status = 'idle';
      room.session = null;
      await dbMutate('rooms', 'update', { status: 'idle', session: null }, 'id', room.id);
    }
  } else if (activeCheckoutData.contextType === 'table') {
    const tbl = state.tables.find((t) => String(t.id) === String(activeCheckoutData.contextId));
    if (tbl) {
      tbl.status = 'idle';
      tbl.session = null;
      await saveSystemStateKey('arena_tables', state.tables);
    }
  } else {
    directCart = {};
  }

  const linesToPrint = [...activeCheckoutData.lines];
  closeModal('modalCheckout');
  renderAll();
  showToast(`تم تقفيل الفاتورة (${grandTotal} ج.م) ✅`, 'success');
  printReceipt(tx, linesToPrint);
}

/* ================= 12. CLIENTS & NOTAH COLLECTION ================= */

function renderClientsTab() {
  const tbody = document.getElementById('clientsTableBody');
  const totalEl = document.getElementById('totalMarketNotah');
  if (!tbody) return;

  const q = (document.getElementById('clientSearchInput')?.value || '').trim().toLowerCase();
  const totalMarket = state.clients.reduce((s, c) => s + Number(c.notah_balance || 0), 0);
  if (totalEl) totalEl.textContent = `${totalMarket} ج.م`;

  const filtered = state.clients.filter(
    (c) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا يوجد عملاء مسجلين</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((c) => {
      const debt = Number(c.notah_balance || 0);
      return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td dir="ltr">${escapeHtml(c.phone || '-')}</td>
          <td>
            <span class="badge ${debt > 0 ? 'badge-debt' : 'badge-completed'}">
              ${debt} ج.م
            </span>
          </td>
          <td>
            <button class="btn btn-primary btn-xs" onclick="openClientDetailsModal('${c.id}')">📂 فتح البروفايل</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function handleAddClient() {
  const name = document.getElementById('newClientName').value.trim();
  const phone = document.getElementById('newClientPhone').value.trim();
  if (!name) return showToast('أدخل اسم العميل', 'warning');

  const client = {
    id: 'cli-' + Date.now(),
    name,
    phone,
    notah_balance: 0,
    notah_history: []
  };

  state.clients.unshift(client);
  await dbMutate('clients', 'insert', client);

  document.getElementById('newClientName').value = '';
  document.getElementById('newClientPhone').value = '';
  renderClientsTab();
  showToast('تم حفظ العميل بنجاح ✅', 'success');
}

function openClientDetailsModal(clientId) {
  const client = state.clients.find((c) => String(c.id) === String(clientId));
  if (!client) return;

  document.getElementById('detailClientId').value = client.id;
  document.getElementById('detailClientName').textContent = client.name;
  document.getElementById('detailClientPhone').textContent = client.phone || 'بدون رقم موبايل';
  document.getElementById('detailClientDebt').textContent = `${Number(client.notah_balance || 0)} ج.م`;
  document.getElementById('collectNotahAmount').value = '';
  document.getElementById('collectNotahNote').value = '';

  const histEl = document.getElementById('clientNotahHistoryList');
  const history = Array.isArray(client.notah_history) ? client.notah_history : [];

  if (history.length === 0) {
    histEl.innerHTML = `<p class="hint-text">لا توجد حركات مسجلة على النوتة لهذا العميل.</p>`;
  } else {
    histEl.innerHTML = history
      .map((h) => {
        if (h.entryType === 'payment') {
          return `
            <div class="ledger-item payment">
              <div style="display:flex;justify-content:space-between;">
                <strong>✅ سداد / تحصيل من النوتة: ${h.amountPaid} ج.م</strong>
                <span>${formatDateTime(h.date)}</span>
              </div>
              <div style="color:var(--text-muted);font-size:0.8rem;margin-top:3px;">
                الطريقة: ${h.method === 'vfcash' ? 'فودافون كاش' : 'كاش (بالدرج)'} | الكاشير: ${escapeHtml(h.staffName || '-')}
                ${h.note ? ` | ملاحظة: ${escapeHtml(h.note)}` : ''}
              </div>
            </div>
          `;
        }
        return `
          <div class="ledger-item">
            <div style="display:flex;justify-content:space-between;">
              <strong>📒 تسجيل على النوتة: +${h.notahAdded} ج.م</strong>
              <span>${formatDateTime(h.date)}</span>
            </div>
            <div style="margin-top:4px;">التفاصيل: <strong>${escapeHtml(h.description || '')}</strong></div>
            <div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">
              إجمالي الفاتورة: ${h.totalBill} ج | دفع وقتها: ${h.paidAtCheckout} ج | الكاشير: ${escapeHtml(h.staffName || '-')}
            </div>
          </div>
        `;
      })
      .join('');
  }

  openModal('modalClientDetails');
}

async function handleCollectNotahPayment() {
  if (!requireOpenShift()) return;
  const clientId = document.getElementById('detailClientId').value;
  const client = state.clients.find((c) => String(c.id) === String(clientId));
  if (!client) return;

  const currentDebt = Number(client.notah_balance || 0);
  const payAmount = Number(document.getElementById('collectNotahAmount').value || 0);
  const method = document.getElementById('collectNotahMethod').value;
  const note = document.getElementById('collectNotahNote').value.trim();

  if (payAmount <= 0) return showToast('أدخل مبلغ التحصيل الصحيح', 'warning');
  if (payAmount > currentDebt) {
    return showToast(`المبلغ المدخل أكبر من المستحق على العميل (${currentDebt} ج.م)`, 'error');
  }

  const nowIso = new Date().toISOString();
  client.notah_balance = currentDebt - payAmount;
  if (!Array.isArray(client.notah_history)) client.notah_history = [];
  client.notah_history.unshift({
    id: 'nh-' + Date.now(),
    date: nowIso,
    entryType: 'payment',
    amountPaid: payAmount,
    method,
    note,
    staffName: activeUser.name
  });

  await dbMutate(
    'clients',
    'update',
    {
      notah_balance: client.notah_balance,
      notah_history: client.notah_history
    },
    'id',
    client.id
  );

  const openShift = getOpenShift();
  const tx = {
    id: 'tx-' + Date.now(),
    shift_id: openShift.id,
    type: 'notah_collection',
    description: `تحصيل نوتة (حساب آجل من يوم سابق) — العميل: ${client.name}${note ? ` (${note})` : ''}`,
    amount: payAmount,
    cash_amount: method === 'cash' ? payAmount : 0,
    vfcash_amount: method === 'vfcash' ? payAmount : 0,
    notah_amount: 0,
    payment_summary: method === 'cash' ? `تحصيل نوتة كاش: ${payAmount} ج` : `تحصيل نوتة فودافون كاش: ${payAmount} ج`,
    client_id: client.id,
    client_name: client.name,
    staff_name: activeUser.name,
    created_at: nowIso
  };

  state.transactions.unshift(tx);
  await dbMutate('transactions', 'insert', tx);

  renderAll();
  openClientDetailsModal(client.id);
  showToast(`تم تحصيل ${payAmount} ج.م من ${client.name} وإضافتها لحساب اليوم ✅`, 'success');
}

/* ================= 13. RESERVATIONS ================= */

function renderReservationsTab() {
  const gameSel = document.getElementById('resGameSelect');
  if (gameSel) {
    gameSel.innerHTML = state.games
      .map((g) => `<option value="${escapeAttr(g.name)}">${escapeHtml(g.name)}</option>`)
      .join('');
  }

  const upcomingCount = state.reservations.filter((r) => r.status === 'Upcoming').length;
  const badge = document.getElementById('upcomingResBadge');
  if (badge) {
    badge.textContent = upcomingCount;
    badge.classList.toggle('hidden', upcomingCount === 0);
  }

  const tbody = document.getElementById('reservationsTableBody');
  if (!tbody) return;

  const filter = document.getElementById('resFilterStatus')?.value || 'Upcoming';
  const list = state.reservations.filter((r) => filter === 'All' || r.status === filter);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا توجد حجوزات في هذا التصنيف</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((r) => {
      const statusBadge =
        r.status === 'Upcoming'
          ? '<span class="badge badge-upcoming">قادم</span>'
          : r.status === 'Completed'
          ? '<span class="badge badge-completed">تم الحضور</span>'
          : '<span class="badge badge-cancelled">ملغي</span>';

      return `
        <tr>
          <td><strong>${formatDateTime(r.res_datetime)}</strong></td>
          <td>
            <strong>${escapeHtml(r.client_name)}</strong>
            <div style="font-size:0.78rem;color:var(--text-muted)" dir="ltr">${escapeHtml(r.phone || '')}</div>
          </td>
          <td>
            ${escapeHtml(r.game_name)} (${r.mode})
            ${r.notes ? `<div style="font-size:0.76rem;color:var(--warning)">${escapeHtml(r.notes)}</div>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td>
            ${
              r.status === 'Upcoming'
                ? `<div class="btn-row">
                    <button class="btn btn-success btn-xs" onclick="startSessionFromReservation('${r.id}')">▶️ بدء الجلسة</button>
                    <button class="btn btn-danger btn-xs" onclick="cancelReservation('${r.id}')">✕</button>
                   </div>`
                : '-'
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

async function handleAddReservation() {
  const clientName = document.getElementById('resClientName').value.trim();
  const phone = document.getElementById('resClientPhone').value.trim();
  const gameName = document.getElementById('resGameSelect').value;
  const mode = document.getElementById('resModeSelect').value;
  const dt = document.getElementById('resDateTime').value;
  const notes = document.getElementById('resNotes').value.trim();

  if (!clientName || !dt) return showToast('أدخل اسم العميل وموعد الحجز', 'warning');

  const resv = {
    id: 'res-' + Date.now(),
    client_name: clientName,
    phone,
    game_name: gameName,
    mode,
    res_datetime: new Date(dt).toISOString(),
    notes,
    status: 'Upcoming',
    created_at: new Date().toISOString(),
    staff_name: activeUser.name
  };

  state.reservations.push(resv);
  state.reservations.sort((a, b) => new Date(a.res_datetime) - new Date(b.res_datetime));
  await dbMutate('reservations', 'insert', resv);

  document.getElementById('resClientName').value = '';
  document.getElementById('resClientPhone').value = '';
  document.getElementById('resNotes').value = '';
  renderAll();
  showToast('تم تسجيل الحجز بنجاح ✅', 'success');
}

function startSessionFromReservation(resId) {
  const resv = state.reservations.find((r) => r.id === resId);
  if (!resv) return;

  const idleRoom = state.rooms.find((r) => r.status !== 'running');
  if (!idleRoom) return showToast('جميع الغرف مشغولة حالياً! أقفل غرفة أولاً.', 'error');

  switchTab('rooms');
  openStartRoomModal(idleRoom.id, {
    reservationId: resv.id,
    clientName: resv.client_name,
    clientPhone: resv.phone,
    game: resv.game_name,
    mode: resv.mode
  });
}

async function cancelReservation(resId) {
  const resv = state.reservations.find((r) => r.id === resId);
  if (!resv) return;
  resv.status = 'Cancelled';
  await dbMutate('reservations', 'update', { status: 'Cancelled' }, 'id', resv.id);
  renderAll();
  showToast('تم إلغاء الحجز', 'warning');
}

/* ================= 14. SHIFT MANAGEMENT, HANDOVER & WHATSAPP ================= */

function getOpenShift() {
  return state.shifts.find((s) => s.status === 'open') || null;
}

function requireOpenShift() {
  if (!getOpenShift()) {
    showToast('يجب فتح وردية أولاً من تبويب "الوردية والتسليم"!', 'error');
    switchTab('shift');
    return false;
  }
  return true;
}

function computeShiftStats(shift) {
  const txs = state.transactions.filter((t) => String(t.shift_id) === String(shift.id));
  const exps = state.expenses.filter((e) => String(e.shift_id) === String(shift.id));
  const handovers = state.handovers.filter((h) => String(h.shift_id) === String(shift.id));

  let roomsRev = 0;
  let cafeRev = 0;
  let notahCollected = 0;
  let notahSales = 0;
  let cashIn = 0;
  let vfCashIn = 0;
  const notahClientsToday = [];

  txs.forEach((t) => {
    const amt = Number(t.amount || 0);
    const cash = Number(t.cash_amount || 0);
    const vf = Number(t.vfcash_amount || 0);
    const notah = Number(t.notah_amount || 0);

    if (t.type === 'room') roomsRev += amt;
    else if (t.type === 'cafe' || t.type === 'table') cafeRev += amt;
    else if (t.type === 'notah_collection') notahCollected += amt;

    cashIn += cash;
    vfCashIn += vf;
    notahSales += notah;

    if (notah > 0 && t.client_name) {
      notahClientsToday.push(`${t.client_name} (${notah} ج)`);
    }
  });

  const expensesTotal = exps.reduce((s, e) => s + Number(e.amount || 0), 0);
  const startCash = Number(shift.start_cash || 0);
  const expectedDrawer = startCash + cashIn - expensesTotal;

  return {
    txs,
    exps,
    handovers,
    startCash,
    roomsRev,
    cafeRev,
    notahCollected,
    notahSales,
    cashIn,
    vfCashIn,
    expensesTotal,
    expectedDrawer,
    notahClientsToday
  };
}

function renderShiftTab() {
  const shift = getOpenShift();
  const badge = document.getElementById('shiftStatusBadge');
  const badgeText = document.getElementById('shiftStatusText');

  if (!shift) {
    badge.className = 'shift-pill closed';
    badgeText.textContent = 'الوردية مغلقة';
    document.getElementById('shiftClosedCard').classList.remove('hidden');
    document.getElementById('shiftOpenCard').classList.add('hidden');
    return;
  }

  badge.className = 'shift-pill open';
  badgeText.textContent = `الوردية مفتوحة (${shift.staff_name})`;
  document.getElementById('shiftClosedCard').classList.add('hidden');
  document.getElementById('shiftOpenCard').classList.remove('hidden');

  const st = computeShiftStats(shift);
  document.getElementById('shiftStaffName').textContent = shift.staff_name || '-';
  document.getElementById('shiftStartTime').textContent = formatDateTime(shift.start_time);
  document.getElementById('shiftStartCash').textContent = `${st.startCash} ج.م`;
  document.getElementById('shiftRoomsRev').textContent = `${st.roomsRev} ج.م`;
  document.getElementById('shiftCafeRev').textContent = `${st.cafeRev} ج.م`;
  document.getElementById('shiftNotahCollected').textContent = `${st.notahCollected} ج.م`;
  document.getElementById('shiftNotahSales').textContent = `${st.notahSales} ج.م`;
  document.getElementById('shiftVfCashTotal').textContent = `${st.vfCashIn} ج.م`;
  document.getElementById('shiftExpensesTotal').textContent = `${st.expensesTotal} ج.م`;
  document.getElementById('shiftExpectedDrawer').textContent = `${st.expectedDrawer} ج.م`;

  document.getElementById('shiftExpensesList').innerHTML =
    st.exps.length === 0
      ? `<p class="hint-text">لا توجد مصروفات في هذه الوردية</p>`
      : st.exps
          .map(
            (e) => `
          <div class="mini-list-item">
            <span>${escapeHtml(e.title)}</span>
            <strong style="color:var(--danger)">-${e.amount} ج.م</strong>
          </div>
        `
          )
          .join('');

  document.getElementById('shiftHandoversList').innerHTML =
    st.handovers.length === 0
      ? `<p class="hint-text">لم يتم تسليم الوردية بين موظفين بعد</p>`
      : st.handovers
          .map(
            (h) => `
          <div class="mini-list-item">
            <div>
              <strong>من ${escapeHtml(h.from_staff)} ⬅️ إلى ${escapeHtml(h.to_staff)}</strong>
              <div style="font-size:0.75rem;color:var(--text-muted)">${formatDateTime(h.time)} • كاش مُسلَّم: ${h.actual_cash} ج ${h.notes ? `(${escapeHtml(h.notes)})` : ''}</div>
            </div>
            <span class="badge ${h.diff === 0 ? 'badge-completed' : 'badge-debt'}">${h.diff === 0 ? 'مظبوط' : `فرق ${h.diff} ج`}</span>
          </div>
        `
          )
          .join('');

  document.getElementById('shiftTransactionsList').innerHTML =
    st.txs.length === 0
      ? `<p class="hint-text">لا توجد حركات مسجلة بعد</p>`
      : st.txs
          .map(
            (t) => `
          <div class="mini-list-item">
            <div>
              <strong>${escapeHtml(t.description)}</strong>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(t.payment_summary || '')}</div>
            </div>
            <strong style="color:var(--success)">${t.amount} ج</strong>
          </div>
        `
          )
          .join('');
}

async function confirmOpenShift() {
  if (getOpenShift()) return;
  const startCash = Math.max(0, Number(document.getElementById('openShiftCashInput').value || 0));
  const shift = {
    id: 'sh-' + Date.now(),
    staff_name: activeUser.name,
    start_time: new Date().toISOString(),
    end_time: null,
    start_cash: startCash,
    end_cash: 0,
    expected_cash: startCash,
    status: 'open',
    total_notah_sales: 0,
    total_notah_collections: 0
  };

  state.shifts.unshift(shift);
  await dbMutate('shifts', 'insert', shift);
  closeModal('modalOpenShift');
  renderAll();
  showToast('تم فتح الوردية بنجاح 🟢', 'success');
}

async function handleAddExpense() {
  if (!requireOpenShift()) return;
  const title = document.getElementById('expenseTitle').value.trim();
  const amount = Number(document.getElementById('expenseAmount').value || 0);
  if (!title || amount <= 0) return showToast('أدخل بيان المصروف والمبلغ', 'warning');

  const shift = getOpenShift();
  const exp = {
    id: 'exp-' + Date.now(),
    shift_id: shift.id,
    title,
    amount,
    staff_name: activeUser.name,
    created_at: new Date().toISOString()
  };

  state.expenses.unshift(exp);
  await dbMutate('expenses', 'insert', exp);
  document.getElementById('expenseTitle').value = '';
  document.getElementById('expenseAmount').value = '';
  renderAll();
  showToast('تم خصم المصروف من الدرج ✅', 'success');
}

// Shift Handover Between Employees
function openHandoverShiftModal() {
  const shift = getOpenShift();
  if (!shift) return;
  if (state.users.length < 2) {
    return showToast('أضف حساب موظف آخر أولاً من الإعدادات لتسليمه الوردية!', 'warning');
  }

  const st = computeShiftStats(shift);
  document.getElementById('handoverSummaryPreview').innerHTML = `
    <div>👤 الموظف المُسلِّم: <strong>${escapeHtml(activeUser.name)}</strong></div>
    <div>🎮 الغرف: <strong>${st.roomsRev} ج</strong> | ☕ الكافيه والترابيزات: <strong>${st.cafeRev} ج</strong></div>
    <div>📒 نوتة اليوم: <strong>${st.notahSales} ج</strong> | ✅ تحصيل نوتة: <strong>${st.notahCollected} ج</strong></div>
    <div style="color:var(--success);font-size:1.05rem;margin-top:4px;">💰 الكاش المفروض تسليمه في الدرج: <strong>${st.expectedDrawer} ج.م</strong></div>
  `;

  const sel = document.getElementById('handoverTargetUser');
  sel.innerHTML = state.users
    .filter((u) => String(u.id) !== String(activeUser.id))
    .map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role === 'admin' ? 'مدير' : 'كاشير'})</option>`)
    .join('');

  document.getElementById('handoverTargetPin').value = '';
  document.getElementById('handoverActualCash').value = st.expectedDrawer;
  document.getElementById('handoverNotes').value = '';
  document.getElementById('preHandoverInputBox').classList.remove('hidden');
  document.getElementById('postHandoverActionsBox').classList.add('hidden');
  updateHandoverDiff();
  openModal('modalHandoverShift');
}

function updateHandoverDiff() {
  const shift = getOpenShift();
  if (!shift) return;
  const st = computeShiftStats(shift);
  const actual = Number(document.getElementById('handoverActualCash').value || 0);
  const diff = actual - st.expectedDrawer;
  const badge = document.getElementById('handoverDiffBadge');
  if (diff === 0) {
    badge.className = 'balance-status valid';
    badge.textContent = 'الكاش المُسلَّم مطابق للدرج تماماً ✅';
  } else if (diff > 0) {
    badge.className = 'balance-status valid';
    badge.textContent = `زيادة في الدرج عند التسليم: +${diff} ج.م`;
  } else {
    badge.className = 'balance-status invalid';
    badge.textContent = `عجز في الدرج عند التسليم: ${diff} ج.م ⚠️`;
  }
}

async function confirmHandoverShift() {
  const shift = getOpenShift();
  if (!shift) return;

  const targetId = document.getElementById('handoverTargetUser').value;
  const targetUser = state.users.find((u) => String(u.id) === String(targetId));
  const pin = document.getElementById('handoverTargetPin').value.trim();
  const actualCash = Number(document.getElementById('handoverActualCash').value || 0);
  const notes = document.getElementById('handoverNotes').value.trim();

  if (!targetUser) return showToast('اختر الموظف المُستلِم', 'warning');
  if (String(targetUser.pin) !== pin) {
    return showToast('الرقم السري (PIN) للموظف المُستلِم غير صحيح!', 'error');
  }

  const st = computeShiftStats(shift);
  const diff = actualCash - st.expectedDrawer;
  const fromName = activeUser.name;
  const nowIso = new Date().toISOString();

  const handoverRecord = {
    id: 'ho-' + Date.now(),
    shift_id: shift.id,
    from_staff: fromName,
    to_staff: targetUser.name,
    time: nowIso,
    expected_cash: st.expectedDrawer,
    actual_cash: actualCash,
    diff,
    notes
  };

  state.handovers.unshift(handoverRecord);
  shift.staff_name = targetUser.name;

  await saveSystemStateKey('arena_handovers', state.handovers);
  await dbMutate('shifts', 'update', { staff_name: targetUser.name }, 'id', shift.id);

  // Switch active user to incoming employee seamlessly
  activeUser = targetUser;
  sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(targetUser));
  document.getElementById('currentUserBadge').textContent =
    `${activeUser.name} (${activeUser.role === 'admin' ? 'مدير' : 'كاشير'})`;
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.classList.toggle('hidden', activeUser.role !== 'admin');
  });

  lastHandoverReportText = [
    `🤝 *إشعار تسليم وردية - ARENA POS*`,
    `━━━━━━━━━━━━━━━━━━`,
    `📤 *المُسلِّم:* ${fromName}`,
    `📥 *المُستلِم:* ${targetUser.name}`,
    `🕒 *الوقت:* ${formatDateTime(nowIso)}`,
    `💰 *الكاش المفروض بالدرج:* ${st.expectedDrawer} ج.م`,
    `🧮 *الكاش المُسلَّم فعلياً:* ${actualCash} ج.م`,
    `⚖️ *الفرق:* ${diff === 0 ? 'مظبوط (0 ج)' : `${diff} ج`}`,
    notes ? `📝 *ملاحظات:* ${notes}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  document.getElementById('preHandoverInputBox').classList.add('hidden');
  document.getElementById('postHandoverActionsBox').classList.remove('hidden');
  renderAll();
  showToast(`تم تسليم الوردية إلى ${targetUser.name} بنجاح 🤝`, 'success');
}

function openCloseShiftModal() {
  const shift = getOpenShift();
  if (!shift) return;

  const busyRooms = state.rooms.filter((r) => r.status === 'running');
  if (busyRooms.length > 0) {
    showToast(`تنبيه: يوجد ${busyRooms.length} غرفة ما زالت شغالة! يفضل تقفيلها أولاً.`, 'warning');
  }

  const st = computeShiftStats(shift);
  document.getElementById('closeShiftSummaryPreview').innerHTML = `
    <div>👤 الكاشير: <strong>${escapeHtml(shift.staff_name)}</strong></div>
    <div>💵 رصيد بداية الدرج: <strong>${st.startCash} ج.م</strong></div>
    <div>🎮 إيراد الغرف: <strong>${st.roomsRev} ج.م</strong> | ☕ الترابيزات والكافيه: <strong>${st.cafeRev} ج.م</strong></div>
    <div>✅ تحصيل نوتة سابقة: <strong>${st.notahCollected} ج.م</strong></div>
    <div>📒 مبيعات على النوتة اليوم: <strong>${st.notahSales} ج.م</strong></div>
    <div>📱 فودافون كاش: <strong>${st.vfCashIn} ج.م</strong> | 💸 مصروفات: <strong>${st.expensesTotal} ج.م</strong></div>
    <hr class="divider"/>
    <div style="font-size:1.05rem;color:var(--success)">💰 الكاش المفروض بالدرج: <strong>${st.expectedDrawer} ج.م</strong></div>
  `;

  document.getElementById('closeShiftActualCash').value = st.expectedDrawer;
  document.getElementById('preCloseInputBox').classList.remove('hidden');
  document.getElementById('postCloseActionsBox').classList.add('hidden');
  updateCloseShiftDiff();
  openModal('modalCloseShift');
}

function updateCloseShiftDiff() {
  const shift = getOpenShift();
  if (!shift) return;
  const st = computeShiftStats(shift);
  const actual = Number(document.getElementById('closeShiftActualCash').value || 0);
  const diff = actual - st.expectedDrawer;
  const el = document.getElementById('closeShiftDiffBadge');

  if (diff === 0) {
    el.className = 'balance-status valid';
    el.textContent = 'الدرج مظبوط تماماً بدون عجز أو زيادة ✅';
  } else if (diff > 0) {
    el.className = 'balance-status valid';
    el.textContent = `زيادة في الدرج: +${diff} ج.م`;
  } else {
    el.className = 'balance-status invalid';
    el.textContent = `عجز في الدرج: ${diff} ج.م ⚠️`;
  }
}

async function confirmCloseShift() {
  const shift = getOpenShift();
  if (!shift) return;

  const st = computeShiftStats(shift);
  const actualCash = Number(document.getElementById('closeShiftActualCash').value || 0);
  const diff = actualCash - st.expectedDrawer;
  const endTime = new Date().toISOString();

  shift.status = 'closed';
  shift.end_time = endTime;
  shift.end_cash = actualCash;
  shift.expected_cash = st.expectedDrawer;
  shift.total_notah_sales = st.notahSales;
  shift.total_notah_collections = st.notahCollected;

  await dbMutate(
    'shifts',
    'update',
    {
      status: 'closed',
      end_time: endTime,
      end_cash: actualCash,
      expected_cash: st.expectedDrawer,
      total_notah_sales: st.notahSales,
      total_notah_collections: st.notahCollected
    },
    'id',
    shift.id
  );

  lastClosedShiftReportText = buildWhatsAppShiftReportText(shift, st, actualCash, diff);

  document.getElementById('preCloseInputBox').classList.add('hidden');
  document.getElementById('postCloseActionsBox').classList.remove('hidden');
  renderAll();
  showToast('تم تقفيل الوردية بنجاح ✅', 'success');
}

function buildWhatsAppShiftReportText(shift, st, actualCash, diff) {
  const diffLabel = diff === 0 ? 'مظبوط (0 ج)' : diff > 0 ? `زيادة (+${diff} ج)` : `عجز (${diff} ج)`;
  const notahListLine =
    st.notahClientsToday.length > 0 ? `\n   └ العملاء: ${st.notahClientsToday.join(' | ')}` : '';
  const handoverLine =
    st.handovers.length > 0
      ? `\n🤝 *تسليمات الوردية:* ${st.handovers.map((h) => `${h.from_staff} ⬅️ ${h.to_staff} (${h.actual_cash} ج)`).join(' | ')}`
      : '';

  return [
    `📊 *تقرير تقفيل الوردية - ARENA POS*`,
    `━━━━━━━━━━━━━━━━━━`,
    `👤 *الكاشير:* ${shift.staff_name}`,
    `🕒 *من:* ${formatDateTime(shift.start_time)}`,
    `🕒 *إلى:* ${formatDateTime(shift.end_time || new Date().toISOString())}${handoverLine}`,
    `━━━━━━━━━━━━━━━━━━`,
    `🎮 *إيراد الغرف:* ${st.roomsRev} ج.م`,
    `☕ *إيراد الترابيزات والكافيه:* ${st.cafeRev} ج.م`,
    `✅ *تحصيل نوتة سابقة:* ${st.notahCollected} ج.م`,
    `📒 *مبيعات آجلة (نوتة اليوم):* ${st.notahSales} ج.م${notahListLine}`,
    `━━━━━━━━━━━━━━━━━━`,
    `💵 *بداية الدرج:* ${st.startCash} ج.م`,
    `📱 *فودافون كاش:* ${st.vfCashIn} ج.م`,
    `💸 *المصروفات:* ${st.expensesTotal} ج.م`,
    `💰 *الكاش المفروض بالدرج:* ${st.expectedDrawer} ج.م`,
    `🧮 *الكاش الفعلي المعدود:* ${actualCash} ج.م`,
    `⚖️ *حالة الدرج:* ${diffLabel}`
  ].join('\n');
}

function sendReportToWhatsApp(customText = null) {
  const phone = (state.settings.ownerWhatsapp || '').replace(/[^0-9]/g, '');
  if (!phone) return showToast('لم يتم تسجيل رقم واتساب المدير في الإعدادات!', 'error');
  const msg = customText || lastClosedShiftReportText;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ================= 15. REPORTS (ADMIN) ================= */

function renderReports() {
  const fromStr = document.getElementById('reportDateFrom')?.value || '';
  const toStr = document.getElementById('reportDateTo')?.value || '';

  const fromMs = fromStr ? new Date(fromStr + 'T00:00:00').getTime() : 0;
  const toMs = toStr ? new Date(toStr + 'T23:59:59').getTime() : Infinity;

  const txs = state.transactions.filter((t) => {
    const ms = new Date(t.created_at).getTime();
    return ms >= fromMs && ms <= toMs;
  });

  const exps = state.expenses.filter((e) => {
    const ms = new Date(e.created_at).getTime();
    return ms >= fromMs && ms <= toMs;
  });

  let roomsRev = 0;
  let cafeRev = 0;
  let notahSales = 0;
  let notahCollected = 0;

  txs.forEach((t) => {
    const amt = Number(t.amount || 0);
    if (t.type === 'room') roomsRev += amt;
    else if (t.type === 'cafe' || t.type === 'table') cafeRev += amt;
    else if (t.type === 'notah_collection') notahCollected += amt;
    notahSales += Number(t.notah_amount || 0);
  });

  const expTotal = exps.reduce((s, e) => s + Number(e.amount || 0), 0);

  document.getElementById('repTotalRevenue').textContent = `${roomsRev + cafeRev} ج.م`;
  document.getElementById('repRoomsRev').textContent = `${roomsRev} ج.م`;
  document.getElementById('repCafeRev').textContent = `${cafeRev} ج.م`;
  document.getElementById('repNotahSales').textContent = `${notahSales} ج.م`;
  document.getElementById('repNotahCollected').textContent = `${notahCollected} ج.م`;
  document.getElementById('repExpenses').textContent = `${expTotal} ج.م`;

  const tbody = document.getElementById('reportsTransactionsBody');
  tbody.innerHTML =
    txs.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا توجد عمليات في هذه الفترة</td></tr>`
      : txs
          .map(
            (t) => `
          <tr>
            <td>${formatDateTime(t.created_at)}</td>
            <td><strong>${escapeHtml(t.description)}</strong></td>
            <td><strong>${t.amount} ج.م</strong></td>
            <td>${escapeHtml(t.payment_summary || '')}</td>
            <td>${escapeHtml(t.staff_name || '-')}</td>
          </tr>
        `
          )
          .join('');
}

/* ================= 16. SETTINGS, RECEIPT DESIGNER & PRINT ================= */

function renderSettings() {
  document.getElementById('setReceiptHeader').value = state.settings.receiptHeader || '';
  document.getElementById('setReceiptFooter').value = state.settings.receiptFooter || '';
  document.getElementById('setOwnerWhatsapp').value = state.settings.ownerWhatsapp || '';
  updateReceiptPreview();

  document.getElementById('settingsUsersList').innerHTML = state.users
    .map(
      (u) => `
      <div class="mini-list-item">
        <span><strong>${escapeHtml(u.name)}</strong> (${u.role === 'admin' ? 'مدير' : 'كاشير'}) — PIN: <code>${escapeHtml(u.pin)}</code></span>
        ${u.id !== 'admin-default' ? `<button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')">حذف</button>` : ''}
      </div>
    `
    )
    .join('');

  document.getElementById('settingsRoomsList').innerHTML = state.rooms
    .map(
      (r) => `
      <div class="mini-list-item">
        <span><strong>${escapeHtml(r.name)}</strong> (${r.type}) — Single: ${r.single_rate} ج | Multi: ${r.multi_rate} ج</span>
        <button class="btn btn-danger btn-xs" onclick="deleteRoom('${r.id}')">حذف</button>
      </div>
    `
    )
    .join('');

  document.getElementById('settingsTablesList').innerHTML = state.tables
    .map(
      (t) => `
      <div class="mini-list-item">
        <span>🪑 <strong>${escapeHtml(t.name)}</strong></span>
        <button class="btn btn-danger btn-xs" onclick="deleteTable('${t.id}')">حذف</button>
      </div>
    `
    )
    .join('');

  document.getElementById('settingsGamesList').innerHTML = state.games
    .map(
      (g) => `
      <span class="tag-chip">
        ${escapeHtml(g.name)}
        <button type="button" style="background:none;border:none;color:var(--danger);cursor:pointer;font-weight:900" onclick="deleteGame('${g.id}')">×</button>
      </span>
    `
    )
    .join('');

  document.getElementById('settingsMenuList').innerHTML = state.menuItems
    .map(
      (m) => `
      <div class="mini-list-item">
        <span><strong>${escapeHtml(m.name)}</strong> [${escapeHtml(m.category)}] — ${m.price} ج.م</span>
        <button class="btn btn-danger btn-xs" onclick="deleteMenuItem('${m.id}')">حذف</button>
      </div>
    `
    )
    .join('');
}

function handleLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 260;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      state.settings.receiptLogo = canvas.toDataURL('image/png', 0.85);
      updateReceiptPreview();
      showToast('تم تحميل اللوجو — اضغط "حفظ تصميم الفاتورة" لتثبيته', 'info');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function buildReceiptHtml(sampleTx = null, sampleLines = null) {
  const logoHtml = state.settings.receiptLogo
    ? `<img src="${state.settings.receiptLogo}" class="receipt-logo-img" alt="Logo" />`
    : '';

  const headerText = escapeHtml(
    document.getElementById('setReceiptHeader')?.value ?? state.settings.receiptHeader ?? ''
  );
  const footerText = escapeHtml(
    document.getElementById('setReceiptFooter')?.value ?? state.settings.receiptFooter ?? ''
  );

  const lines = sampleLines || [
    { label: 'Room 1 (FC 26 - Multi) [01:00:00]', amount: 70 },
    { label: 'بيبسي × 2', amount: 40 }
  ];
  const total = sampleTx ? sampleTx.amount : 110;
  const dateStr = formatDateTime(sampleTx ? sampleTx.created_at : new Date().toISOString());
  const payStr = sampleTx ? sampleTx.payment_summary : 'كاش: 110 ج';

  return `
    ${logoHtml}
    <div class="receipt-header-text">${headerText}</div>
    <div class="receipt-divider"></div>
    <div style="font-size:10px;">التاريخ: ${dateStr}</div>
    <div class="receipt-divider"></div>
    ${lines
      .map((l) => `<div class="receipt-row"><span>${escapeHtml(l.label)}</span><strong>${l.amount} ج</strong></div>`)
      .join('')}
    <div class="receipt-divider"></div>
    <div class="receipt-row" style="font-size:14px;"><strong>الإجمالي:</strong><strong>${total} ج.م</strong></div>
    <div style="font-size:10px;text-align:right;margin-top:4px;">الدفع: ${escapeHtml(payStr)}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer-text">${footerText}</div>
  `;
}

function updateReceiptPreview() {
  const box = document.getElementById('receiptLivePreview');
  if (box) box.innerHTML = buildReceiptHtml();
}

function printReceipt(tx, lines) {
  const printBox = document.getElementById('receiptPrintContent');
  if (!printBox) return;
  printBox.innerHTML = buildReceiptHtml(tx, lines);
  setTimeout(() => window.print(), 150);
}

/* ================= 17. RENDER ALL & EVENT BINDINGS ================= */

function renderAll() {
  renderDashboard();
  renderRooms();
  renderTables();
  renderDirectCafePos();
  renderReservationsTab();
  renderClientsTab();
  renderShiftTab();
  if (activeUser?.role === 'admin') {
    renderReports();
    renderSettings();
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeRegExp(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTimeShort(ms) {
  return new Date(ms).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return iso || '-';
  }
}

function bindEvents() {
  document.getElementById('btnSaveSetup')?.addEventListener('click', async () => {
    const u = document.getElementById('setupUrl').value.trim();
    const k = document.getElementById('setupKey').value.trim();
    if (!u || !k) return showToast('أدخل بيانات الربط كاملة', 'error');
    localStorage.setItem(STORAGE_KEYS.URL, u);
    localStorage.setItem(STORAGE_KEYS.KEY, k);
    initSupabase(u, k);
    await syncAllDataFromCloud();
    showScreen('loginScreen');
  });

  document.querySelectorAll('.pin-key[data-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.key;
      const inp = document.getElementById('loginPin');
      if (k === 'C') inp.value = '';
      else if (inp.value.length < 8) inp.value += k;
    });
  });
  document.getElementById('btnLogin')?.addEventListener('click', handleLogin);
  document.getElementById('loginPin')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    activeUser = null;
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    showScreen('loginScreen');
  });

  document.getElementById('syncQueueBtn')?.addEventListener('click', flushOfflineQueue);

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Start Room & Table Modals
  document.getElementById('startModeSingle')?.addEventListener('click', () => {
    selectedStartMode = 'Single';
    updateStartRoomModalUI();
  });
  document.getElementById('startModeMulti')?.addEventListener('click', () => {
    selectedStartMode = 'Multi';
    updateStartRoomModalUI();
  });
  document.getElementById('startTimeTypeOpen')?.addEventListener('click', () => {
    selectedStartTimeType = 'open';
    updateStartRoomModalUI();
  });
  document.getElementById('startTimeTypeFixed')?.addEventListener('click', () => {
    selectedStartTimeType = 'fixed';
    updateStartRoomModalUI();
  });
  document.querySelectorAll('.preset-min-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('startFixedMinutes').value = btn.dataset.mins;
    });
  });
  document.getElementById('btnConfirmStartRoom')?.addEventListener('click', confirmStartRoom);
  document.getElementById('btnConfirmStartTable')?.addEventListener('click', confirmStartTable);

  // Switch Mode Modal
  document.getElementById('btnConfirmSwitchMode')?.addEventListener('click', confirmSwitchMode);

  // POS Search & Actions
  document.getElementById('posSearchInput')?.addEventListener('input', () => renderPosInterface('room'));
  document.getElementById('cafeSearchInput')?.addEventListener('input', () => renderPosInterface('direct'));
  document.getElementById('btnConfirmRoomOrders')?.addEventListener('click', confirmPosModalOrders);
  document.getElementById('btnClearDirectCart')?.addEventListener('click', () => {
    directCart = {};
    renderDirectCafePos();
  });
  document.getElementById('btnDirectCheckout')?.addEventListener('click', openDirectCafeCheckout);

  // Checkout Modal Split Inputs & Single Print Button
  document.getElementById('checkoutDiscount')?.addEventListener('input', () => recalculateCheckoutSplit('discount'));
  document.getElementById('payCash')?.addEventListener('input', () => recalculateCheckoutSplit('cash'));
  document.getElementById('payVfCash')?.addEventListener('input', () => recalculateCheckoutSplit('vfcash'));
  document.getElementById('payNotah')?.addEventListener('input', () => recalculateCheckoutSplit('notah'));

  document.getElementById('btnToggleQuickClient')?.addEventListener('click', () => {
    document.getElementById('quickClientForm').classList.toggle('hidden');
  });
  document.getElementById('btnSaveQuickClient')?.addEventListener('click', handleQuickCreateClient);
  document.getElementById('btnConfirmCheckoutPrint')?.addEventListener('click', finalizeCheckoutAndPrint);

  // Clients & Notah Collection
  document.getElementById('btnAddClient')?.addEventListener('click', handleAddClient);
  document.getElementById('clientSearchInput')?.addEventListener('input', renderClientsTab);
  document.getElementById('btnCollectFullNotah')?.addEventListener('click', () => {
    const clientId = document.getElementById('detailClientId').value;
    const client = state.clients.find((c) => String(c.id) === String(clientId));
    if (client) document.getElementById('collectNotahAmount').value = Number(client.notah_balance || 0);
  });
  document.getElementById('btnConfirmNotahCollect')?.addEventListener('click', handleCollectNotahPayment);

  // Reservations
  document.getElementById('btnAddReservation')?.addEventListener('click', handleAddReservation);
  document.getElementById('resFilterStatus')?.addEventListener('change', renderReservationsTab);

  // Shift, Handover & Close
  document.getElementById('btnShowOpenShift')?.addEventListener('click', () => openModal('modalOpenShift'));
  document.getElementById('btnConfirmOpenShift')?.addEventListener('click', confirmOpenShift);
  document.getElementById('btnAddExpense')?.addEventListener('click', handleAddExpense);

  document.getElementById('btnShowHandoverShift')?.addEventListener('click', openHandoverShiftModal);
  document.getElementById('handoverActualCash')?.addEventListener('input', updateHandoverDiff);
  document.getElementById('btnConfirmHandoverShift')?.addEventListener('click', confirmHandoverShift);
  document.getElementById('btnSendHandoverWhatsapp')?.addEventListener('click', () => sendReportToWhatsApp(lastHandoverReportText));

  document.getElementById('btnShowCloseShift')?.addEventListener('click', openCloseShiftModal);
  document.getElementById('closeShiftActualCash')?.addEventListener('input', updateCloseShiftDiff);
  document.getElementById('btnConfirmCloseShift')?.addEventListener('click', confirmCloseShift);
  document.getElementById('btnSendWhatsappReport')?.addEventListener('click', () => sendReportToWhatsApp());
  document.getElementById('btnCopyShiftReport')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(lastClosedShiftReportText);
    showToast('تم نسخ نص التقرير ✅', 'success');
  });

  // Reports Filter
  document.getElementById('btnFilterReports')?.addEventListener('click', renderReports);

  // Settings: Receipt Designer
  document.getElementById('setReceiptLogoInput')?.addEventListener('change', handleLogoUpload);
  document.getElementById('btnRemoveReceiptLogo')?.addEventListener('click', () => {
    state.settings.receiptLogo = '';
    updateReceiptPreview();
  });
  document.getElementById('setReceiptHeader')?.addEventListener('input', updateReceiptPreview);
  document.getElementById('setReceiptFooter')?.addEventListener('input', updateReceiptPreview);
  document.getElementById('btnSaveReceiptSettings')?.addEventListener('click', async () => {
    state.settings.receiptHeader = document.getElementById('setReceiptHeader').value;
    state.settings.receiptFooter = document.getElementById('setReceiptFooter').value;
    await saveSystemStateKey('arena_settings', state.settings);
    showToast('تم حفظ تصميم الفاتورة وتطبيقه على كل الأجهزة ✅', 'success');
  });

  // Settings: WhatsApp
  document.getElementById('btnSaveWhatsapp')?.addEventListener('click', async () => {
    state.settings.ownerWhatsapp = document.getElementById('setOwnerWhatsapp').value.trim();
    await saveSystemStateKey('arena_settings', state.settings);
    showToast('تم حفظ رقم واتساب المدير ✅', 'success');
  });
  document.getElementById('btnTestWhatsapp')?.addEventListener('click', () => {
    state.settings.ownerWhatsapp = document.getElementById('setOwnerWhatsapp').value.trim();
    sendReportToWhatsApp('✅ رسالة تجريبية من سيستم ARENA POS - الربط مع واتساب المدير يعمل بنجاح!');
  });

  // Settings: Users, Rooms, Tables, Games, Menu
  document.getElementById('btnAddUser')?.addEventListener('click', async () => {
    const name = document.getElementById('setUserName').value.trim();
    const pin = document.getElementById('setUserPin').value.trim();
    const role = document.getElementById('setUserRole').value;
    if (!name || !pin) return showToast('أدخل الاسم والرقم السري', 'warning');

    const existing = state.users.find((u) => String(u.pin) === pin);
    if (existing) {
      existing.name = name;
      existing.role = role;
      await dbMutate('users', 'update', { name, role }, 'id', existing.id);
    } else {
      const u = { id: 'usr-' + Date.now(), name, pin, role };
      state.users.push(u);
      await dbMutate('users', 'insert', u);
    }
    document.getElementById('setUserName').value = '';
    document.getElementById('setUserPin').value = '';
    renderSettings();
    showToast('تم حفظ الحساب ✅', 'success');
  });

  document.getElementById('btnAddRoom')?.addEventListener('click', async () => {
    const name = document.getElementById('setRoomName').value.trim();
    const type = document.getElementById('setRoomType').value;
    const single_rate = Number(document.getElementById('setRoomSingleRate').value || 50);
    const multi_rate = Number(document.getElementById('setRoomMultiRate').value || 70);
    if (!name) return showToast('أدخل اسم الغرفة', 'warning');

    const room = {
      id: String(Date.now()),
      name,
      type,
      single_rate,
      multi_rate,
      status: 'idle',
      session: null
    };
    state.rooms.push(room);
    await dbMutate('rooms', 'insert', room);
    document.getElementById('setRoomName').value = '';
    renderAll();
    showToast('تمت إضافة الغرفة ✅', 'success');
  });

  document.getElementById('btnAddTable')?.addEventListener('click', async () => {
    const name = document.getElementById('setTableName').value.trim();
    if (!name) return showToast('أدخل اسم أو رقم الترابيزة', 'warning');

    state.tables.push({
      id: 'tbl-' + Date.now(),
      name,
      status: 'idle',
      session: null
    });
    await saveSystemStateKey('arena_tables', state.tables);
    document.getElementById('setTableName').value = '';
    renderAll();
    showToast('تمت إضافة الترابيزة ✅', 'success');
  });

  document.getElementById('btnAddGame')?.addEventListener('click', async () => {
    const name = document.getElementById('setGameName').value.trim();
    if (!name) return;
    const g = { id: 'gm-' + Date.now(), name };
    state.games.push(g);
    await dbMutate('games', 'insert', g);
    document.getElementById('setGameName').value = '';
    renderSettings();
    renderReservationsTab();
    showToast('تمت إضافة اللعبة ✅', 'success');
  });

  document.getElementById('btnAddMenuItem')?.addEventListener('click', async () => {
    const name = document.getElementById('setMenuName').value.trim();
    const category = document.getElementById('setMenuCategory').value;
    const price = Number(document.getElementById('setMenuPrice').value || 0);
    const icon = document.getElementById('setMenuIcon').value;
    if (!name || price <= 0) return showToast('أدخل اسم الصنف والسعر', 'warning');

    const item = { id: 'mn-' + Date.now(), name, category, price, icon };
    state.menuItems.push(item);
    await dbMutate('menu_items', 'insert', item);
    document.getElementById('setMenuName').value = '';
    document.getElementById('setMenuPrice').value = '';
    renderAll();
    showToast('تمت إضافة الصنف للمنيو ✅', 'success');
  });
}

// Global Delete Helpers
window.deleteUser = async (id) => {
  state.users = state.users.filter((u) => String(u.id) !== String(id));
  await dbMutate('users', 'delete', null, 'id', id);
  renderSettings();
};

window.deleteRoom = async (id) => {
  state.rooms = state.rooms.filter((r) => String(r.id) !== String(id));
  await dbMutate('rooms', 'delete', null, 'id', id);
  renderAll();
};

window.deleteTable = async (id) => {
  state.tables = state.tables.filter((t) => String(t.id) !== String(id));
  await saveSystemStateKey('arena_tables', state.tables);
  renderAll();
};

window.deleteGame = async (id) => {
  state.games = state.games.filter((g) => String(g.id) !== String(id));
  await dbMutate('games', 'delete', null, 'id', id);
  renderSettings();
};

window.deleteMenuItem = async (id) => {
  state.menuItems = state.menuItems.filter((m) => String(m.id) !== String(id));
  await dbMutate('menu_items', 'delete', null, 'id', id);
  renderAll();
};
