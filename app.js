let sb = null;
let currentUser = null;
let appState = null;
let pinBuffer = '';
let alarmInterval = null;
let protectedUnlockedForSession = false;
let realtimeChannel = null;
const mutedSessionKeys = new Set();

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function genId(prefix) {
  return prefix + '-' + Math.floor(100000 + Math.random() * 900000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function todayDateStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ==================== SUPABASE INIT & CONFIG ==================== */
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('url') && urlParams.get('key')) {
    localStorage.setItem('ARENA_SB_URL', urlParams.get('url'));
    localStorage.setItem('ARENA_SB_KEY', urlParams.get('key'));
  }
  const url = localStorage.getItem('ARENA_SB_URL');
  const key = localStorage.getItem('ARENA_SB_KEY');
  if (url && key) {
    initSupabaseClient(url, key);
    document.getElementById('loginView').style.display = 'flex';
  } else {
    document.getElementById('configView').style.display = 'flex';
  }
});

function initSupabaseClient(url, key) {
  sb = window.supabase.createClient(url, key);
  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb.channel('arena-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => { if (currentUser) loadFullState(false); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => { if (currentUser) loadFullState(false); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_orders' }, () => { if (currentUser) loadFullState(false); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => { if (currentUser) loadFullState(false); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_state' }, () => { if (currentUser) loadFullState(false); })
    .subscribe();
}

function saveSupabaseConfig() {
  const url = document.getElementById('cfgUrl').value.trim();
  const key = document.getElementById('cfgKey').value.trim();
  if (!url || !key) return toast('أدخل Project URL و anon key', true);
  localStorage.setItem('ARENA_SB_URL', url);
  localStorage.setItem('ARENA_SB_KEY', key);
  initSupabaseClient(url, key);
  document.getElementById('configView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
  toast('✅ تم الربط بنجاح');
}

function resetSupabaseConfig() {
  document.getElementById('cfgUrl').value = localStorage.getItem('ARENA_SB_URL') || '';
  document.getElementById('cfgKey').value = localStorage.getItem('ARENA_SB_KEY') || '';
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('configView').style.display = 'flex';
}

/* ==================== UI HELPERS ==================== */
function showLoader(show) {
  document.getElementById('loader').style.display = show ? 'block' : 'none';
}

function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = isErr ? 'var(--danger)' : 'var(--primary)';
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

function switchTab(tabId, btn) {
  ['pos', 'inventory', 'clients', 'games', 'dashboard'].forEach(id => {
    document.getElementById('tab-' + id).style.display = id === tabId ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tabId === 'dashboard') renderDashboard();
}

/* ==================== AUTH & PROTECTED TABS ==================== */
function pressPin(d) {
  if (pinBuffer.length < 6) {
    pinBuffer += String(d);
    document.getElementById('pinDisplay').textContent = '•'.repeat(pinBuffer.length);
  }
}

function clearPin() {
  pinBuffer = '';
  document.getElementById('pinDisplay').textContent = '';
}

async function submitPin() {
  if (!pinBuffer) return;
  showLoader(true);
  const { data, error } = await sb.from('users').select('*').eq('pin', pinBuffer).eq('active', true).maybeSingle();
  showLoader(false);
  if (error || !data) {
    toast('كود الدخول (PIN) غير صحيح أو الحساب غير مفعل', true);
    clearPin();
    return;
  }
  currentUser = { id: data.id, name: data.name, role: data.role };
  protectedUnlockedForSession = (currentUser.role === 'Admin');
  clearPin();
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appView').style.display = 'block';
  await loadFullState(true);
}

document.addEventListener('keydown', function (e) {
  const loginView = document.getElementById('loginView');
  if (loginView && loginView.style.display !== 'none') {
    if (e.key >= '0' && e.key <= '9') pressPin(e.key);
    else if (e.key === 'Backspace' || e.key === 'Escape') clearPin();
    else if (e.key === 'Enter') submitPin();
  }
});

function logout() {
  currentUser = null;
  protectedUnlockedForSession = false;
  evaluateAlarms([]);
  switchTab('pos', document.querySelector('.nav-tab[data-tab="pos"]'));
  document.getElementById('appView').style.display = 'none';
  document.getElementById('loginView').style.display = 'flex';
}

function requestProtectedTab(tabId, btn) {
  if (currentUser && (currentUser.role === 'Admin' || protectedUnlockedForSession)) {
    switchTab(tabId, btn);
    return;
  }
  openModal(`
    <div style="text-align:center;">
      <div style="font-size:34px; margin-bottom:6px;">🔐</div>
      <h3 style="margin-bottom:6px;">صفحة محمية بكود الإدارة</h3>
      <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">أدخل Admin PIN لفتح صفحة ${tabId === 'dashboard' ? 'التقارير وتعديل الفواتير' : 'الألعاب والإعدادات'}</p>
      <div class="form-group">
        <input type="password" id="adminGatePin" placeholder="Admin PIN..." style="text-align:center; font-size:20px; letter-spacing:6px;" onkeydown="if(event.key==='Enter') submitProtectedTab('${tabId}')" />
      </div>
      <div class="row-2" style="margin-top:12px;">
        <button type="button" class="btn-sm btn-primary" onclick="submitProtectedTab('${tabId}')">🔓 فتح الصفحة</button>
        <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('adminGatePin')?.focus(), 100);
}

async function submitProtectedTab(tabId) {
  const pin = (document.getElementById('adminGatePin')?.value || '').trim();
  if (!pin) return toast('أدخل كود الإدارة', true);
  showLoader(true);
  const { data } = await sb.from('users').select('id').eq('pin', pin).eq('role', 'Admin').eq('active', true).maybeSingle();
  showLoader(false);
  if (!data) return toast('كود الإدارة غير صحيح', true);
  protectedUnlockedForSession = true;
  closeModal();
  switchTab(tabId, document.querySelector(`.nav-tab[data-tab="${tabId}"]`));
  toast('🔓 تم التحقق وفتح الصفحة');
}

/* ==================== LOAD FULL CLOUD STATE (PARALLEL FAST QUERIES) ==================== */
async function loadFullState(withLoader = false) {
  if (withLoader) showLoader(true);
  const [
    sysRes, shiftsRes, roomsRes, gamesRes, menuRes, tablesRes,
    ordersRes, roomLogsRes, expRes, clientsRes, txRes, invLogsRes, editLogsRes, usersRes
  ] = await Promise.all([
    sb.from('system_state').select('*'),
    sb.from('shifts').select('*').order('opened_at', { ascending: false }).limit(50),
    sb.from('rooms').select('*').order('id'),
    sb.from('games').select('*').order('name'),
    sb.from('menu_items').select('*').order('name'),
    sb.from('cafe_tables').select('*').order('id'),
    sb.from('cafe_orders').select('*').eq('status', 'Open'),
    sb.from('room_logs').select('*').eq('status', 'Closed').order('end_time', { ascending: false }).limit(200),
    sb.from('expenses').select('*').order('timestamp', { ascending: false }).limit(200),
    sb.from('clients').select('*').order('name'),
    sb.from('transactions').select('*').order('timestamp', { ascending: false }).limit(300),
    sb.from('inventory_logs').select('*').order('timestamp', { ascending: false }).limit(100),
    sb.from('edit_logs').select('*').order('timestamp', { ascending: false }).limit(120),
    sb.from('users').select('*').order('id')
  ]);
  if (withLoader) showLoader(false);

  const stateMap = {};
  (sysRes.data || []).forEach(r => { stateMap[r.key] = r.value; });
  const shifts = shiftsRes.data || [];
  const activeShiftRaw = shifts.find(s => s.id === stateMap['ACTIVE_SHIFT_ID'] && s.status === 'OPEN') || null;

  let activeShift = null;
  if (activeShiftRaw) {
    const sid = activeShiftRaw.id;
    const sTx = (txRes.data || []).filter(t => t.shift_id === sid);
    const sRoomRev = sTx.reduce((s, t) => s + Number(t.room_part || 0), 0);
    const sCafeRev = sTx.reduce((s, t) => s + Number(t.cafe_part || 0), 0);
    const sDisc = sTx.reduce((s, t) => s + Number(t.discount_amount || 0), 0);
    const sCash = sTx.filter(t => t.type !== 'Shift Open' && t.type !== 'Shift Close' && t.type !== 'Shift Handover' && t.type !== 'Expense')
      .reduce((s, t) => s + Number(t.cash_amount || 0), 0);
    const sVoda = sTx.filter(t => t.type !== 'Shift Open' && t.type !== 'Shift Close' && t.type !== 'Shift Handover' && t.type !== 'Expense')
      .reduce((s, t) => s + Number(t.vodafone_amount || 0), 0);
    const sExp = sTx.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const openCash = Number(activeShiftRaw.opening_cash || 0);

    activeShift = {
      ...activeShiftRaw,
      roomRevenue: round2(sRoomRev),
      cafeRevenue: round2(sCafeRev),
      totalDiscounts: round2(sDisc),
      cashSales: round2(sCash),
      vodafoneSales: round2(sVoda),
      expenses: round2(sExp),
      expectedDrawerCash: round2(openCash + sCash - sExp)
    };
  }

  appState = {
    shiftStatus: stateMap['SHIFT_STATUS'] || 'CLOSED',
    activeShift,
    shiftsHistory: shifts,
    rooms: roomsRes.data || [],
    allGames: gamesRes.data || [],
    games: (gamesRes.data || []).filter(g => g.active),
    allMenu: menuRes.data || [],
    menu: (menuRes.data || []).filter(m => m.active),
    tables: tablesRes.data || [],
    openOrders: ordersRes.data || [],
    roomLogs: roomLogsRes.data || [],
    expenses: expRes.data || [],
    clients: clientsRes.data || [],
    transactions: txRes.data || [],
    invLogs: invLogsRes.data || [],
    editLogs: editLogsRes.data || [],
    users: usersRes.data || []
  };

  renderAll();
}

async function logEdit(action, target, details) {
  await sb.from('edit_logs').insert({
    id: genId('LOG'),
    user_name: currentUser.name,
    role: currentUser.role,
    action,
    target,
    details
  });
}

function renderAll() {
  document.getElementById('userBadge').textContent = '👤 ' + currentUser.name + ' (' + currentUser.role + ')';
  const isAdmin = currentUser.role === 'Admin';
  document.getElementById('tabGamesBtn').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('addMenuBtn').style.display = isAdmin ? 'inline-block' : 'none';

  const shiftBadge = document.getElementById('shiftBadge');
  const shiftBtn = document.getElementById('shiftActionBtn');
  const handoverBtn = document.getElementById('handoverShiftBtn');

  if (appState.shiftStatus === 'OPEN' && appState.activeShift) {
    shiftBadge.className = 'badge badge-green';
    shiftBadge.textContent = '📅 يومية: ' + appState.activeShift.shift_date + ' | المستلم: ' + appState.activeShift.current_holder;
    shiftBtn.className = 'btn-sm btn-danger';
    shiftBtn.textContent = 'تقفيل اليومية';
    handoverBtn.style.display = 'inline-block';
  } else {
    shiftBadge.className = 'badge badge-red';
    shiftBadge.textContent = 'اليومية مغلقة';
    shiftBtn.className = 'btn-sm btn-success';
    shiftBtn.textContent = 'فتح يومية';
    handoverBtn.style.display = 'none';
  }

  populateReportFilterDropdowns();
  renderLiveShiftStrip();
  renderRoomsAndTables();
  renderInventoryAndMenu();
  renderClientsTab();
  renderAdminSetup();
  renderDashboard();
}

function renderLiveShiftStrip() {
  const strip = document.getElementById('liveShiftStrip');
  const activeRooms = appState.rooms.filter(r => r.status !== 'Available').length;
  if (appState.shiftStatus !== 'OPEN' || !appState.activeShift) {
    strip.innerHTML = `
      <div class="shift-strip" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <strong style="font-size:16px; color:var(--warning);">⚠️ لا توجد يومية مفتوحة حالياً</strong>
          <div style="font-size:13px; color:var(--muted);">اختر تاريخ اليوم وافتح يومية جديدة لبدء تشغيل الغرف وتسجيل المبيعات</div>
        </div>
        <button type="button" class="btn-sm btn-success" style="padding:10px 18px;" onclick="handleShiftBtn()">🔓 فتح يومية جديدة</button>
      </div>`;
    return;
  }
  const s = appState.activeShift;
  strip.innerHTML = `
    <div class="shift-strip">
      <div class="strip-item">
        <div class="strip-label">📅 تاريخ اليومية / المستلم</div>
        <div class="strip-val" style="color:var(--primary); font-size:16px;">${escapeHtml(s.shift_date)}</div>
        <div style="font-size:11px; color:var(--muted);">المسؤول الآن: <strong>${escapeHtml(s.current_holder)}</strong></div>
      </div>
      <div class="strip-item"><div class="strip-label">💵 الكاش في الدرج الآن</div><div class="strip-val" style="color:var(--success);">${s.expectedDrawerCash} ج.م</div></div>
      <div class="strip-item"><div class="strip-label">📱 فودافون كاش</div><div class="strip-val" style="color:var(--primary);">${s.vodafoneSales} ج.م</div></div>
      <div class="strip-item"><div class="strip-label">💸 مصروفات اليومية</div><div class="strip-val" style="color:var(--danger);">${s.expenses} ج.م</div></div>
      <div class="strip-item"><div class="strip-label">🎮 الغرف الشغالة</div><div class="strip-val" style="color:var(--warning);">${activeRooms} / ${appState.rooms.length}</div></div>
      <div class="strip-item"><div class="strip-label">📊 صافي مبيعات اليومية</div><div class="strip-val" style="color:var(--purple);">${round2(s.roomRevenue + s.cafeRevenue)} ج.م</div></div>
    </div>`;
}

/* ==================== AUDIO ALARM & LIVE ROOM TIMER ==================== */
function getSessionAlarmKey(r) {
  return (r.session_id || r.id) + '_' + (r.target_minutes || 0);
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1150, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.48);
  } catch (e) {}
}

function evaluateAlarms(unmuted) {
  const btn = document.getElementById('muteAlarmBtn');
  if (!btn) return;
  if (unmuted.length > 0) {
    btn.style.display = 'inline-block';
    if (!alarmInterval) {
      playBeep();
      alarmInterval = setInterval(playBeep, 3500);
    }
  } else {
    btn.style.display = 'none';
    if (alarmInterval) {
      clearInterval(alarmInterval);
      alarmInterval = null;
    }
  }
}

function muteRoomAlarm(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  if (r) mutedSessionKeys.add(getSessionAlarmKey(r));
  renderRoomsAndTables();
  toast('🔕 تم كتم صوت التنبيه لهذه الغرفة');
}

function muteAllActiveAlarms() {
  appState.rooms.forEach(r => {
    if (r.status !== 'Available' && computeRoomLive(r)?.isTimeUp) {
      mutedSessionKeys.add(getSessionAlarmKey(r));
    }
  });
  evaluateAlarms([]);
  renderRoomsAndTables();
}

function computeRoomLive(r) {
  if (r.status === 'Available') return null;
  let segMins = 0, segCost = 0;
  const game = appState.allGames.find(g => g.id === r.game_id);
  const rate = game ? (r.mode === 'Multi' ? Number(game.multi_rate) : Number(game.single_rate)) : 0;
  if (r.hold_state !== 'HOLD_PAUSED' && r.segment_start) {
    segMins = Math.max(0, (Date.now() - new Date(r.segment_start).getTime()) / 60000);
    segCost = (segMins / 60) * rate;
  }
  const totalMins = Number(r.accumulated_minutes || 0) + segMins;
  let rawRoomCost = Number(r.accumulated_cost || 0) + segCost;
  const isMinApplied = totalMins < 30;
  if (isMinApplied) rawRoomCost += ((30 - totalMins) / 60) * rate;
  const roomCost = round2(rawRoomCost);
  const cafeCost = round2(r.cafe_cost || 0);
  const grandTotal = round2(roomCost + cafeCost);

  let isTimeUp = false, displaySeconds = Math.floor(totalMins * 60);
  if (r.session_type === 'Fixed') {
    const targetSec = Number(r.target_minutes || 30) * 60;
    const remSec = targetSec - displaySeconds;
    if (remSec <= 0) {
      isTimeUp = true;
      displaySeconds = Math.abs(remSec);
    } else {
      displaySeconds = remSec;
    }
  }
  return { totalMins: Math.floor(totalMins), isMinApplied, roomCost, cafeCost, grandTotal, rate, isTimeUp, displaySeconds };
}

function formatHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function renderRoomsAndTables() {
  if (!appState) return;
  document.getElementById('roomsCount').textContent = appState.rooms.length;
  const unmutedExpired = [];

  document.getElementById('roomsGrid').innerHTML = appState.rooms.map(r => {
    if (r.status === 'Available') {
      return `
        <div class="room-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><h3 style="font-size:18px;">${escapeHtml(r.name)}</h3><span style="font-size:12px; color:var(--muted);">${escapeHtml(r.category)}</span></div>
            <span class="badge badge-green">متاحة</span>
          </div>
          <div class="timer-box" style="color:var(--muted); padding:26px;">جاهزة للتشغيل</div>
          <button type="button" class="btn-sm btn-primary" style="width:100%; padding:12px;" onclick="openStartRoomModal('${r.id}')">▶ فتح الغرفة</button>
        </div>`;
    }
    const live = computeRoomLive(r);
    const isMuted = mutedSessionKeys.has(getSessionAlarmKey(r));
    if (live.isTimeUp && !isMuted) unmutedExpired.push(r.id);

    const isHold = r.hold_state !== 'NONE';
    const cardClass = live.isTimeUp ? 'room-card alarm' : (isHold ? 'room-card hold' : 'room-card running');
    let statusBadge = `<span class="badge badge-green">شغالة (${r.session_type === 'Fixed' ? r.target_minutes + 'د' : 'مفتوح'})</span>`;
    if (r.hold_state === 'HOLD_RUNNING') statusBadge = `<span class="badge badge-amber">هولد — الوقت شغال</span>`;
    if (r.hold_state === 'HOLD_PAUSED') statusBadge = `<span class="badge badge-amber">هولد — الوقت متوقف</span>`;
    if (live.isTimeUp) statusBadge = `<span class="badge badge-red">⏰ انتهى الوقت!</span>`;

    const openOrd = appState.openOrders.find(o => o.order_type === 'Room' && o.target_id === r.id);
    return `
      <div class="${cardClass}">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <div><h3 style="font-size:18px;">${escapeHtml(r.name)}</h3>${r.client_name ? `<span style="font-size:11px; color:var(--primary);">👤 ${escapeHtml(r.client_name)}</span>` : ''}</div>
          ${statusBadge}
        </div>
        <div style="background:rgba(56,189,248,0.08); padding:8px 12px; border-radius:10px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
          <div><strong>${escapeHtml(r.game_name)} (${escapeHtml(r.model)})</strong> — <span style="color:var(--primary);">${escapeHtml(r.mode)}</span><div style="color:var(--muted); font-size:12px;">سعر الساعة: ${live.rate} ج.م</div></div>
          ${r.session_type === 'Fixed' ? `<button type="button" class="btn-xs btn-warning" onclick="openExtendTimeModal('${r.id}')">⏰ تمديد</button>` : ''}
        </div>
        <div class="timer-box">
          <div style="font-size:11px; color:var(--muted);">${r.session_type === 'Fixed' ? (live.isTimeUp ? 'وقت إضافي:' : 'المتبقي:') : 'الوقت المنقضي:'}</div>
          <div class="timer-digits" id="timer-${r.id}">${formatHMS(live.displaySeconds)}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:4px;" id="costline-${r.id}">لعب: <strong>${live.roomCost}</strong> ج.م ${live.isMinApplied ? '(حد أدنى 30د)' : ''} | كافيه: <strong>${live.cafeCost}</strong> ج.م</div>
          <div style="font-size:16px; font-weight:900; color:var(--success); margin-top:4px;" id="totalline-${r.id}">الإجمالي: ${live.grandTotal} ج.م</div>
        </div>
        ${openOrd ? `<div class="open-items-pill">🥤 <strong>الطلبات:</strong> ${escapeHtml(openOrd.items_summary)}</div>` : ''}
        ${live.isTimeUp && !isMuted ? `<button type="button" class="btn-sm btn-danger" style="width:100%;" onclick="muteRoomAlarm('${r.id}')">🔕 كتم صوت المنبه</button>` : ''}
        <div class="row-2">
          <button type="button" class="btn-sm btn-primary" onclick="openOrderModal('Room', '${r.id}')">☕ + طلبات</button>
          <button type="button" class="btn-sm btn-ghost" onclick="openSwitchModal('${r.id}')">🔄 تبديل لعبة/وضع</button>
        </div>
        <div class="row-2">
          <button type="button" class="btn-sm btn-warning" onclick="openHoldModal('${r.id}')">⏸️ خيارات Hold</button>
          <button type="button" class="btn-sm btn-danger" onclick="openCheckoutRoomModal('${r.id}')">💰 تقفيل الحساب</button>
        </div>
      </div>`;
  }).join('');
  evaluateAlarms(unmutedExpired);

  document.getElementById('tablesGrid').innerHTML = appState.tables.map(t => {
    const occ = t.status === 'Occupied';
    const ord = appState.openOrders.find(o => o.order_type === 'Table' && o.target_id === t.id);
    return `
      <div class="table-card ${occ ? 'occupied' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>${escapeHtml(t.name)}</strong><span class="badge ${occ ? 'badge-purple' : 'badge-green'}">${occ ? 'مشغولة' : 'متاحة'}</span>
        </div>
        <div style="font-size:13px; color:var(--muted); margin-bottom:8px;">${occ ? 'الحساب الحالي: <strong style="color:var(--text);">' + (ord ? ord.total_amount : 0) + ' ج.م</strong>' : 'لا يوجد طلبات'}</div>
        ${ord ? `<div class="open-items-pill" style="margin-bottom:10px;">${escapeHtml(ord.items_summary)}</div>` : ''}
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn-sm btn-primary" style="flex:1;" onclick="openOrderModal('Table', '${t.id}')">+ طلب</button>
          ${occ ? `<button type="button" class="btn-sm btn-success" onclick="openCheckoutTableModal('${t.id}')">حساب</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

setInterval(() => {
  if (!appState) return;
  const unmuted = [];
  appState.rooms.forEach(r => {
    if (r.status === 'Available') return;
    const live = computeRoomLive(r);
    if (live.isTimeUp && !mutedSessionKeys.has(getSessionAlarmKey(r))) unmuted.push(r.id);
    const tEl = document.getElementById('timer-' + r.id);
    const cEl = document.getElementById('costline-' + r.id);
    const totEl = document.getElementById('totalline-' + r.id);
    if (tEl) tEl.textContent = formatHMS(live.displaySeconds);
    if (cEl) cEl.innerHTML = `لعب: <strong>${live.roomCost}</strong> ج.م ${live.isMinApplied ? '(حد أدنى 30د)' : ''} | كافيه: <strong>${live.cafeCost}</strong> ج.م`;
    if (totEl) totEl.textContent = `الإجمالي: ${live.grandTotal} ج.م`;
  });
  evaluateAlarms(unmuted);
}, 1000);

/* ==================== SHIFT OPEN (WITH DATE), HANDOVER & CLOSE ==================== */
function handleShiftBtn() {
  if (appState.shiftStatus === 'OPEN') {
    const s = appState.activeShift;
    openModal(`
      <h3 style="margin-bottom:12px;">🔒 تقفيل يومية (${escapeHtml(s.shift_date)}) نهائياً</h3>
      <div style="background:var(--bg); padding:14px; border-radius:12px; font-size:13px; margin-bottom:14px; line-height:1.9;">
        <div>تاريخ اليومية: <strong style="color:var(--primary);">${escapeHtml(s.shift_date)}</strong> (سيتم التقفيل على نفس التاريخ تلقائياً)</div>
        <div>فتح بواسطة: <strong>${escapeHtml(s.opened_by)}</strong> | المسؤول الحالي: <strong>${escapeHtml(s.current_holder)}</strong></div>
        <div>عهدة البداية: <strong>${s.opening_cash} ج.م</strong></div>
        <div>صافي إيراد البلايستيشن: <strong>${s.roomRevenue} ج.م</strong></div>
        <div>صافي إيراد الكافيه: <strong>${s.cafeRevenue} ج.م</strong></div>
        <div>إجمالي الخصومات الممنوحة: <strong style="color:var(--warning);">${s.totalDiscounts} ج.م</strong></div>
        <div>إجمالي فودافون كاش: <strong>${s.vodafoneSales} ج.م</strong></div>
        <div>إجمالي المصروفات: <strong style="color:var(--danger);">${s.expenses} ج.م</strong></div>
        <div style="font-size:16px; color:var(--success); border-top:1px solid var(--border); padding-top:6px;">
          الكاش المفترض بالدرج: <strong>${s.expectedDrawerCash} ج.م</strong>
        </div>
      </div>
      <div class="form-group">
        <label>الكاش الفعلي المعدود في الدرج</label>
        <input type="number" id="shActual" value="${s.expectedDrawerCash}" />
      </div>
      <div class="form-group">
        <label>ملاحظات التقفيل</label>
        <input id="shNotes" placeholder="أي ملاحظات..." />
      </div>
      <div class="row-2">
        <button type="button" class="btn-sm btn-danger" onclick="submitCloseShift()">تأكيد تقفيل اليومية (${escapeHtml(s.shift_date)})</button>
        <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  } else {
    openModal(`
      <h3 style="margin-bottom:12px;">🔓 فتح يومية / شيفت جديد</h3>
      <div class="form-group">
        <label>📅 اختر تاريخ اليومية (اليوم المراد فتحه)</label>
        <input type="date" id="shDate" value="${todayDateStr()}" />
      </div>
      <div class="form-group">
        <label>💵 عهدة الدرج الافتتاحية (ج.م)</label>
        <input type="number" id="shOpenCash" value="0" />
      </div>
      <div class="row-2" style="margin-top:14px;">
        <button type="button" class="btn-sm btn-success" onclick="submitOpenShift()">فتح اليومية الآن</button>
        <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
      </div>
    `);
  }
}

async function submitOpenShift() {
  const chosenDate = document.getElementById('shDate').value;
  if (!chosenDate) return toast('اختر تاريخ اليومية أولاً', true);
  const openCash = Number(document.getElementById('shOpenCash').value || 0);
  const shiftId = genId('SHF');
  showLoader(true);
  closeModal();

  const { error } = await sb.from('shifts').insert({
    id: shiftId,
    shift_date: chosenDate,
    opened_by: currentUser.name,
    current_holder: currentUser.name,
    opening_cash: openCash,
    expected_drawer_cash: openCash,
    status: 'OPEN'
  });
  if (error) {
    showLoader(false);
    return toast(error.message, true);
  }

  await Promise.all([
    sb.from('system_state').upsert([
      { key: 'SHIFT_STATUS', value: 'OPEN', updated_by: currentUser.name, updated_at: new Date().toISOString() },
      { key: 'ACTIVE_SHIFT_ID', value: shiftId, updated_by: currentUser.name, updated_at: new Date().toISOString() }
    ]),
    sb.from('transactions').insert({
      id: genId('TX'),
      shift_id: shiftId,
      shift_date: chosenDate,
      type: 'Shift Open',
      ref_id: shiftId,
      target: 'فتح يومية (' + chosenDate + ')',
      subtotal_amount: openCash,
      discount_amount: 0,
      amount: openCash,
      payment_method: 'Cash',
      cash_amount: openCash,
      staff_name: currentUser.name,
      details: 'عهدة بداية اليومية (' + chosenDate + ')'
    }),
    logEdit('OPEN_SHIFT', shiftId, 'فتح يومية تاريخ: ' + chosenDate + ' | عهدة: ' + openCash + ' ج.م')
  ]);

  await loadFullState(true);
  toast('تم فتح يومية ' + chosenDate + ' بنجاح');
}

function openHandoverModal() {
  if (!appState.activeShift) return;
  const s = appState.activeShift;
  openModal(`
    <h3 style="margin-bottom:8px;">🔄 تسليم واستلام الشيفت (نفس اليومية)</h3>
    <p style="font-size:13px; color:var(--muted); margin-bottom:12px;">
      سيتم تسجيل خروج <strong>${escapeHtml(currentUser.name)}</strong> وتسليم يومية <strong>${escapeHtml(s.shift_date)}</strong> بنفس أرقامها ومبيعاتها للموظف التالي.
    </p>
    <div style="background:var(--bg); padding:12px; border-radius:12px; font-size:13px; margin-bottom:12px;">
      <div>الكاش المفترض بالدرج حالياً: <strong style="color:var(--success);">${s.expectedDrawerCash} ج.م</strong></div>
    </div>
    <div class="form-group">
      <label>💵 الكاش الفعلي المعدود في الدرج وقت التسليم</label>
      <input type="number" id="hoCash" value="${s.expectedDrawerCash}" />
    </div>
    <div class="form-group">
      <label>🔑 كود الدخول (PIN) الخاص بالموظف المستلم</label>
      <input type="password" id="hoNextPin" placeholder="الموظف المستلم يكتب الـ PIN الخاص به..." style="text-align:center; font-size:20px; letter-spacing:6px;" onkeydown="if(event.key==='Enter') submitHandoverShift()" />
    </div>
    <div class="row-2" style="margin-top:14px;">
      <button type="button" class="btn-sm btn-purple" onclick="submitHandoverShift()">✅ تأكيد التسليم والاستلام</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
  setTimeout(() => document.getElementById('hoNextPin')?.focus(), 100);
}

async function submitHandoverShift() {
  const nextPin = (document.getElementById('hoNextPin')?.value || '').trim();
  const countedCash = Number(document.getElementById('hoCash')?.value || 0);
  if (!nextPin) return toast('الموظف المستلم يجب أن يكتب الـ PIN الخاص به', true);

  showLoader(true);
  const { data: nextUser } = await sb.from('users').select('*').eq('pin', nextPin).eq('active', true).maybeSingle();
  if (!nextUser) {
    showLoader(false);
    return toast('كود الدخول (PIN) للموظف المستلم غير صحيح', true);
  }

  closeModal();
  const s = appState.activeShift;
  const diff = round2(countedCash - s.expectedDrawerCash);
  const prevHolder = s.current_holder;
  const oldNotes = s.notes ? s.notes + ' | ' : '';
  const handoverNote = `تسليم من ${prevHolder} إلى ${nextUser.name} (الدرج: ${countedCash}ج، فرق: ${diff}ج)`;

  await Promise.all([
    sb.from('shifts').update({ current_holder: nextUser.name, notes: oldNotes + handoverNote }).eq('id', s.id),
    sb.from('transactions').insert({
      id: genId('TX'),
      shift_id: s.id,
      shift_date: s.shift_date,
      type: 'Shift Handover',
      ref_id: s.id,
      target: 'تسليم شيفت (' + s.shift_date + ')',
      subtotal_amount: countedCash,
      discount_amount: 0,
      amount: countedCash,
      payment_method: 'Cash',
      cash_amount: countedCash,
      staff_name: nextUser.name,
      details: `من ${prevHolder} إلى ${nextUser.name} (المتوقع: ${s.expectedDrawerCash} | الفرق: ${diff})`
    }),
    logEdit('SHIFT_HANDOVER', s.id, `تسليم شيفت (${s.shift_date}) إلى ${nextUser.name} | المتوقع: ${s.expectedDrawerCash} | المستلم: ${countedCash}`)
  ]);

  currentUser = { id: nextUser.id, name: nextUser.name, role: nextUser.role };
  protectedUnlockedForSession = (currentUser.role === 'Admin');
  switchTab('pos', document.querySelector('.nav-tab[data-tab="pos"]'));
  await loadFullState(true);
  toast('🔄 تم تسليم الشيفت بنجاح إلى: ' + currentUser.name);
}

async function submitCloseShift() {
  const s = appState.activeShift;
  const actual = Number(document.getElementById('shActual').value || 0);
  const notes = document.getElementById('shNotes').value.trim();
  const diff = round2(actual - s.expectedDrawerCash);
  const oldNotes = s.notes ? s.notes + ' | ' : '';
  const nowIso = new Date().toISOString();

  showLoader(true);
  closeModal();

  await Promise.all([
    sb.from('shifts').update({
      closed_by: currentUser.name,
      closed_at: nowIso,
      room_revenue: s.roomRevenue,
      cafe_revenue: s.cafeRevenue,
      total_discounts: s.totalDiscounts,
      total_cash_sales: s.cashSales,
      total_vodafone_cash: s.vodafoneSales,
      total_expenses: s.expenses,
      expected_drawer_cash: s.expectedDrawerCash,
      actual_cash: actual,
      difference: diff,
      status: 'CLOSED',
      notes: oldNotes + notes
    }).eq('id', s.id),
    sb.from('system_state').upsert([
      { key: 'SHIFT_STATUS', value: 'CLOSED', updated_by: currentUser.name, updated_at: nowIso },
      { key: 'ACTIVE_SHIFT_ID', value: '', updated_by: currentUser.name, updated_at: nowIso }
    ]),
    sb.from('transactions').insert({
      id: genId('TX'),
      shift_id: s.id,
      shift_date: s.shift_date,
      type: 'Shift Close',
      ref_id: s.id,
      target: 'تقفيل يومية (' + s.shift_date + ')',
      subtotal_amount: actual,
      discount_amount: 0,
      amount: actual,
      payment_method: 'Cash',
      cash_amount: actual,
      staff_name: currentUser.name,
      details: `تقفيل يومية ${s.shift_date} | المتوقع: ${s.expectedDrawerCash} | الفرق: ${diff}`
    }),
    logEdit('CLOSE_SHIFT', s.id, `تقفيل يومية (${s.shift_date}) | المتوقع: ${s.expectedDrawerCash} | الفعلي: ${actual} | الفرق: ${diff}`)
  ]);

  await loadFullState(true);
  toast('تم تقفيل يومية ' + s.shift_date + ' وحفظ التقرير');
}

/* ==================== ROOM SESSION CONTROLS ==================== */
function buildClientOptionsHtml(selectedName) {
  const opts = (appState.clients || []).map(c =>
    `<option value="${escapeHtml(c.name)}" ${c.name === selectedName ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.phone || '')})</option>`
  ).join('');
  return `<option value="">-- بدون عميل محدد --</option>` + opts;
}

function openStartRoomModal(roomId) {
  if (appState.shiftStatus !== 'OPEN') return toast('يجب فتح يومية أولاً قبل تشغيل الغرف', true);
  const r = appState.rooms.find(x => x.id === roomId);
  const gameOpts = appState.games.map(g =>
    `<option value="${g.id}">${escapeHtml(g.name)} (${escapeHtml(g.model)}) — Single: ${g.single_rate} / Multi: ${g.multi_rate}</option>`
  ).join('');

  openModal(`
    <h3 style="margin-bottom:14px;">▶ فتح ${escapeHtml(r.name)}</h3>
    <div class="form-group"><label>اختر اللعبة والموديل</label><select id="stGame">${gameOpts}</select></div>
    <div class="row-2">
      <div class="form-group">
        <label>عدد اللاعبين (الوضع)</label>
        <select id="stMode"><option value="Single">Single (فردي)</option><option value="Multi">Multi (زوجي / متعدد)</option></select>
      </div>
      <div class="form-group">
        <label>نظام الوقت</label>
        <select id="stType" onchange="document.getElementById('fixedBox').style.display = this.value === 'Fixed' ? 'block' : 'none'">
          <option value="Open">وقت مفتوح (Open Time)</option>
          <option value="Fixed">وقت محدد (بمنبه تنبيه)</option>
        </select>
      </div>
    </div>
    <div class="form-group" id="fixedBox" style="display:none;">
      <label>المدة بالدقائق (الحد الأدنى 30 دقيقة)</label>
      <div class="row-3" style="margin-bottom:8px;">
        <button type="button" class="btn-sm btn-ghost" onclick="document.getElementById('stMins').value=30">30 دقيقة</button>
        <button type="button" class="btn-sm btn-ghost" onclick="document.getElementById('stMins').value=60">ساعة (60)</button>
        <button type="button" class="btn-sm btn-ghost" onclick="document.getElementById('stMins').value=120">ساعتين (120)</button>
      </div>
      <input type="number" id="stMins" value="60" min="30" />
    </div>
    <div class="form-group"><label>ربط بعميل (اختياري)</label><select id="stClient">${buildClientOptionsHtml('')}</select></div>
    <div class="row-2" style="margin-top:16px;">
      <button type="button" class="btn-sm btn-success" onclick="submitStartRoom('${roomId}')">بدء التشغيل</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitStartRoom(roomId) {
  const mins = Number(document.getElementById('stMins').value || 30);
  const sType = document.getElementById('stType').value;
  if (sType === 'Fixed' && mins < 30) return toast('أقل مدة مسموحة هي 30 دقيقة', true);

  const r = appState.rooms.find(x => x.id === roomId);
  const game = appState.games.find(g => g.id === document.getElementById('stGame').value);
  const mode = document.getElementById('stMode').value;
  const clientName = document.getElementById('stClient').value;
  const sessionId = genId('SES');
  const nowIso = new Date().toISOString();

  showLoader(true);
  closeModal();

  await Promise.all([
    sb.from('rooms').update({
      status: 'Running',
      session_id: sessionId,
      game_id: game.id,
      game_name: game.name,
      model: game.model,
      mode,
      session_type: sType,
      target_minutes: sType === 'Fixed' ? mins : 0,
      segment_start: nowIso,
      accumulated_minutes: 0,
      accumulated_cost: 0,
      cafe_cost: 0,
      hold_state: 'NONE',
      hold_start: null,
      segments_json: [],
      client_name: clientName
    }).eq('id', roomId),
    sb.from('room_logs').insert({
      session_id: sessionId,
      shift_id: appState.activeShift.id,
      room_id: r.id,
      room_name: r.name,
      client_name: clientName,
      start_time: nowIso,
      staff_name: currentUser.name,
      status: 'Active'
    }),
    logEdit('START_ROOM', r.name, `${game.name} (${game.model}) - ${mode} ${sType === 'Fixed' ? '[' + mins + 'د]' : '[مفتوح]'}`)
  ]);

  await loadFullState(true);
  toast('تم فتح ' + r.name);
}

function openExtendTimeModal(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  openModal(`
    <h3 style="margin-bottom:10px;">⏰ تمديد وقت — ${escapeHtml(r.name)}</h3>
    <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">الوقت المحدد الحالي: <strong>${r.target_minutes} دقيقة</strong></p>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button type="button" class="btn-sm btn-primary" style="padding:12px;" onclick="submitExtendTime('${roomId}', 'Fixed', 30)">+ 30 دقيقة إضافية</button>
      <button type="button" class="btn-sm btn-primary" style="padding:12px;" onclick="submitExtendTime('${roomId}', 'Fixed', 60)">+ 60 دقيقة (ساعة إضافية)</button>
      <button type="button" class="btn-sm btn-primary" style="padding:12px;" onclick="submitExtendTime('${roomId}', 'Fixed', 120)">+ 120 دقيقة (ساعتين)</button>
      <button type="button" class="btn-sm btn-success" style="padding:12px;" onclick="submitExtendTime('${roomId}', 'Open', 0)">∞ تحويل إلى وقت مفتوح (Open Time)</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitExtendTime(roomId, mode, addMins) {
  const r = appState.rooms.find(x => x.id === roomId);
  showLoader(true);
  closeModal();
  if (mode === 'Open') {
    await sb.from('rooms').update({ session_type: 'Open', target_minutes: 0 }).eq('id', roomId);
    await logEdit('EXTEND_TIME', r.name, 'تحويل الجلسة إلى وقت مفتوح');
  } else {
    const newTarget = Number(r.target_minutes || 30) + addMins;
    await sb.from('rooms').update({ session_type: 'Fixed', target_minutes: newTarget }).eq('id', roomId);
    await logEdit('EXTEND_TIME', r.name, `تمديد الوقت +${addMins} دقيقة (الإجمالي: ${newTarget}د)`);
  }
  await loadFullState(true);
  toast('تم تمديد وقت الغرفة');
}

function openSwitchModal(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  const gameOpts = appState.games.map(g =>
    `<option value="${g.id}" ${g.id === r.game_id ? 'selected' : ''}>${escapeHtml(g.name)} (${escapeHtml(g.model)}) — S:${g.single_rate} / M:${g.multi_rate}</option>`
  ).join('');

  openModal(`
    <h3 style="margin-bottom:10px;">🔄 تبديل اللعبة أو Single / Multi (${escapeHtml(r.name)})</h3>
    <p style="font-size:13px; color:var(--muted); margin-bottom:14px;">سيتم احتساب الوقت السابق بسعره تلقائياً وبدء حساب الوقت الجديد بالتسعيرة الجديدة.</p>
    <div class="form-group"><label>اللعبة / الموديل الجديد</label><select id="swGame">${gameOpts}</select></div>
    <div class="form-group">
      <label>الوضع الجديد</label>
      <select id="swMode">
        <option value="Single" ${r.mode === 'Single' ? 'selected' : ''}>Single</option>
        <option value="Multi" ${r.mode === 'Multi' ? 'selected' : ''}>Multi</option>
      </select>
    </div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-primary" onclick="submitSwitch('${roomId}')">تأكيد التبديل</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitSwitch(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  const newGame = appState.games.find(g => g.id === document.getElementById('swGame').value);
  const newMode = document.getElementById('swMode').value;
  const nowIso = new Date().toISOString();

  let segMins = 0, segCost = 0;
  const oldGame = appState.allGames.find(g => g.id === r.game_id);
  const oldRate = oldGame ? (r.mode === 'Multi' ? Number(oldGame.multi_rate) : Number(oldGame.single_rate)) : 0;
  if (r.hold_state !== 'HOLD_PAUSED' && r.segment_start) {
    segMins = Math.max(0, (Date.now() - new Date(r.segment_start).getTime()) / 60000);
    segCost = (segMins / 60) * oldRate;
  }

  const segments = Array.isArray(r.segments_json) ? [...r.segments_json] : [];
  if (segMins > 0.05) {
    segments.push({ game: `${r.game_name} (${r.model})`, mode: r.mode, mins: round2(segMins), cost: round2(segCost) });
  }

  showLoader(true);
  closeModal();
  await Promise.all([
    sb.from('rooms').update({
      game_id: newGame.id,
      game_name: newGame.name,
      model: newGame.model,
      mode: newMode,
      segment_start: r.hold_state === 'HOLD_PAUSED' ? null : nowIso,
      accumulated_minutes: Number(r.accumulated_minutes || 0) + segMins,
      accumulated_cost: Number(r.accumulated_cost || 0) + segCost,
      segments_json: segments
    }).eq('id', roomId),
    logEdit('SWITCH_GAME_MODE', r.name, `تحويل إلى: ${newGame.name} (${newGame.model}) - ${newMode}`)
  ]);
  await loadFullState(true);
  toast('تم تبديل اللعبة/الوضع بنجاح');
}

function openHoldModal(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  openModal(`
    <h3 style="margin-bottom:12px;">⏸️ خيارات الهولد — ${escapeHtml(r.name)}</h3>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <button type="button" class="btn-sm btn-warning" style="padding:12px;" onclick="submitHold('${roomId}', 'HOLD_RUNNING')">⏳ هولد والوقت شغال (الغرفة محجوزة والعداد مستمر)</button>
      <button type="button" class="btn-sm btn-danger" style="padding:12px;" onclick="submitHold('${roomId}', 'HOLD_PAUSED')">🛑 هولد مع إيقاف الوقت مؤقتاً (Pause Timer)</button>
      ${r.hold_state !== 'NONE' ? `<button type="button" class="btn-sm btn-success" style="padding:12px;" onclick="submitHold('${roomId}', 'RESUME')">▶ إلغاء الهولد واستئناف اللعب</button>` : ''}
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

async function submitHold(roomId, action) {
  const r = appState.rooms.find(x => x.id === roomId);
  const nowIso = new Date().toISOString();
  showLoader(true);
  closeModal();

  if (action === 'HOLD_RUNNING') {
    await sb.from('rooms').update({
      status: 'Hold - Running',
      segment_start: r.hold_state === 'HOLD_PAUSED' ? nowIso : r.segment_start,
      hold_state: 'HOLD_RUNNING',
      hold_start: nowIso
    }).eq('id', roomId);
  } else if (action === 'HOLD_PAUSED') {
    let segMins = 0, segCost = 0;
    const g = appState.allGames.find(x => x.id === r.game_id);
    const rate = g ? (r.mode === 'Multi' ? Number(g.multi_rate) : Number(g.single_rate)) : 0;
    if (r.hold_state !== 'HOLD_PAUSED' && r.segment_start) {
      segMins = Math.max(0, (Date.now() - new Date(r.segment_start).getTime()) / 60000);
      segCost = (segMins / 60) * rate;
    }
    const segments = Array.isArray(r.segments_json) ? [...r.segments_json] : [];
    if (segMins > 0.05) {
      segments.push({ game: `${r.game_name} (${r.model})`, mode: r.mode, mins: round2(segMins), cost: round2(segCost) });
    }
    await sb.from('rooms').update({
      status: 'Hold - Paused',
      segment_start: null,
      accumulated_minutes: Number(r.accumulated_minutes || 0) + segMins,
      accumulated_cost: Number(r.accumulated_cost || 0) + segCost,
      hold_state: 'HOLD_PAUSED',
      hold_start: nowIso,
      segments_json: segments
    }).eq('id', roomId);
  } else if (action === 'RESUME') {
    await sb.from('rooms').update({
      status: 'Running',
      segment_start: r.hold_state === 'HOLD_PAUSED' ? nowIso : r.segment_start,
      hold_state: 'NONE',
      hold_start: null
    }).eq('id', roomId);
  }

  await logEdit('ROOM_HOLD_' + action, r.name, 'تغيير حالة الهولد');
  await loadFullState(true);
  toast('تم تحديث حالة الغرفة');
}

/* ==================== ORDERS & UNIFIED DISCOUNT ON TAKEAWAY ==================== */
let cart = [];
let orderCatFilter = 'ALL';

function getOrderTargetName(targetType, targetId) {
  if (targetType === 'Takeaway') return 'تيك أواي سريع';
  if (targetType === 'Room') return appState.rooms.find(x => x.id === targetId)?.name || targetId;
  if (targetType === 'Table') return appState.tables.find(x => x.id === targetId)?.name || targetId;
  return targetId;
}

function openOrderModal(targetType, targetId) {
  if (appState.shiftStatus !== 'OPEN') return toast('يجب فتح يومية أولاً قبل تسجيل أي طلبات', true);
  cart = [];
  orderCatFilter = 'ALL';
  const targetName = getOrderTargetName(targetType, targetId);
  const existingOrd = appState.openOrders.find(o => o.order_type === targetType && o.target_id === targetId);
  const isTakeaway = targetType === 'Takeaway';

  openModal(`
    <h3 style="margin-bottom:8px;">🥤 إضافة طلبات — ${escapeHtml(targetName)}</h3>
    ${existingOrd ? `<div class="open-items-pill" style="margin-bottom:10px;"><strong>الطلبات المسجلة مسبقاً (${existingOrd.subtotal_amount} ج.م):</strong><br>${escapeHtml(existingOrd.items_summary)}</div>` : ''}

    <div style="display:flex; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
      <input id="ordSearchInp" style="flex:1; min-width:160px;" placeholder="🔍 ابحث عن صنف..." oninput="renderOrderMenuList()" />
      <button type="button" class="btn-xs btn-primary" id="catBtn-ALL" onclick="setOrderCat('ALL')">الكل</button>
      <button type="button" class="btn-xs btn-ghost" id="catBtn-Stocked" onclick="setOrderCat('Stocked')">🥤 تلاجة وسناكس</button>
      <button type="button" class="btn-xs btn-ghost" id="catBtn-Cafe" onclick="setOrderCat('Cafe')">☕ كافيه</button>
    </div>

    <div id="orderMenuList" style="max-height:190px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; margin-bottom:10px;"></div>
    <div id="cartSummary" style="background:var(--bg); padding:10px; border-radius:10px; margin-bottom:12px; font-size:13px;">السلة فارغة — اضغط "+ إضافة"</div>

    ${isTakeaway ? `
      <div class="row-2">
        <div class="form-group"><label>عميل (اختياري)</label><select id="tkClient">${buildClientOptionsHtml('')}</select></div>
        <div class="form-group"><label>🏷️ خصم على الفاتورة (ج.م)</label><input type="number" id="tkDiscount" value="0" min="0" oninput="recalcTakeawayPay()" /></div>
      </div>
      <div class="form-group"><label>سبب الخصم (اختياري)</label><input id="tkDiscReason" placeholder="مثلاً: عرض / عميل مميز..." /></div>
      <div style="font-size:16px; font-weight:900; color:var(--success); margin-bottom:8px;">الصافي المطلوب: <span id="tkNetFinal">0</span> ج.م</div>
      <div style="margin-bottom:8px;">
        <div class="row-3">
          <button type="button" class="btn-xs btn-success" onclick="set1ClickPay('tk', 'Cash')">💵 كاش بالكامل</button>
          <button type="button" class="btn-xs btn-primary" onclick="set1ClickPay('tk', 'Vodafone')">📱 فودافون كاش</button>
          <button type="button" class="btn-xs btn-ghost" onclick="set1ClickPay('tk', 'Split')">✂️ تقسيم</button>
        </div>
      </div>
      <div class="row-2" style="margin-bottom:10px;">
        <div class="form-group"><label>كاش</label><input type="number" id="tkCash" value="0" /></div>
        <div class="form-group"><label>فودافون كاش</label><input type="number" id="tkVoda" value="0" /></div>
      </div>
    ` : ''}

    <div class="row-2">
      <button type="button" class="btn-sm btn-success" onclick="submitOrder('${targetType}', '${targetId}')">تأكيد الطلب</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
  renderOrderMenuList();
}

function setOrderCat(cat) {
  orderCatFilter = cat;
  ['ALL', 'Stocked', 'Cafe'].forEach(c => {
    const b = document.getElementById('catBtn-' + c);
    if (b) b.className = c === cat ? 'btn-xs btn-primary' : 'btn-xs btn-ghost';
  });
  renderOrderMenuList();
}

function renderOrderMenuList() {
  const q = (document.getElementById('ordSearchInp')?.value || '').trim().toLowerCase();
  const filtered = appState.menu.filter(m => {
    if (orderCatFilter !== 'ALL' && m.category !== orderCatFilter) return false;
    if (q && !String(m.name).toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById('orderMenuList').innerHTML = filtered.map(m => {
    const out = m.track_stock && Number(m.current_stock) <= 0;
    const info = m.track_stock ? (out ? '<span style="color:var(--danger);">(نفذ)</span>' : `(متاح: ${m.current_stock})`) : '(كافيه)';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid var(--border);">
        <div><strong>${escapeHtml(m.name)}</strong><div style="font-size:12px; color:var(--muted);">${m.price} ج.م ${info}</div></div>
        <button type="button" class="btn-xs btn-primary" ${out ? 'disabled' : ''} onclick="addToCart('${m.id}')">+ إضافة</button>
      </div>`;
  }).join('') || '<div style="padding:14px; text-align:center; color:var(--muted);">لا توجد أصناف مطابقة</div>';
}

function addToCart(itemId) {
  const m = appState.menu.find(x => x.id === itemId);
  const ex = cart.find(c => c.itemId === itemId);
  if (ex) ex.qty += 1;
  else cart.push({ itemId: m.id, name: m.name, price: Number(m.price), qty: 1 });
  renderCartSummary();
}

function changeCartQty(itemId, delta) {
  const idx = cart.findIndex(c => c.itemId === itemId);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCartSummary();
}

function recalcTakeawayPay() {
  const sub = round2(cart.reduce((s, c) => s + c.price * c.qty, 0));
  const disc = Number(document.getElementById('tkDiscount')?.value || 0);
  const net = Math.max(0, round2(sub - disc));
  if (document.getElementById('tkNetFinal')) document.getElementById('tkNetFinal').textContent = net;
  if (document.getElementById('tkCash')) {
    document.getElementById('tkCash').value = net;
    document.getElementById('tkVoda').value = 0;
  }
}

function renderCartSummary() {
  const box = document.getElementById('cartSummary');
  if (!cart.length) {
    box.innerHTML = 'السلة فارغة — اضغط "+ إضافة" لاختيار الأصناف';
    recalcTakeawayPay();
    return;
  }
  const sub = round2(cart.reduce((s, c) => s + c.price * c.qty, 0));
  box.innerHTML = cart.map(c => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
      <span><strong>${escapeHtml(c.name)}</strong> (${c.price}ج)</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <button type="button" class="btn-xs btn-danger" onclick="changeCartQty('${c.itemId}', -1)">-</button>
        <strong style="min-width:20px; text-align:center;">${c.qty}</strong>
        <button type="button" class="btn-xs btn-success" onclick="changeCartQty('${c.itemId}', 1)">+</button>
        <span style="min-width:55px; text-align:left; font-weight:800;">${round2(c.price * c.qty)} ج.م</span>
      </div>
    </div>`).join('') + `<div style="margin-top:8px; font-weight:900; font-size:14px; color:var(--primary);">الإجمالي قبل الخصم: ${sub} ج.م</div>`;
  recalcTakeawayPay();
}

async function submitOrder(targetType, targetId) {
  if (!cart.length) return toast('اختر صنف واحد على الأقل', true);
  const targetName = getOrderTargetName(targetType, targetId);

  for (const c of cart) {
    const m = appState.menu.find(x => x.id === c.itemId);
    if (m.track_stock && Number(m.current_stock) < c.qty) {
      return toast(`الكمية غير متوفرة للصنف: ${m.name} (المتاح: ${m.current_stock})`, true);
    }
  }

  const subTotal = round2(cart.reduce((s, c) => s + c.price * c.qty, 0));
  const disc = targetType === 'Takeaway' ? Number(document.getElementById('tkDiscount')?.value || 0) : 0;
  const discReason = targetType === 'Takeaway' ? (document.getElementById('tkDiscReason')?.value || '') : '';
  const netTotal = Math.max(0, round2(subTotal - disc));
  const cashPaid = targetType === 'Takeaway' ? Number(document.getElementById('tkCash')?.value || 0) : 0;
  const vodaPaid = targetType === 'Takeaway' ? Number(document.getElementById('tkVoda')?.value || 0) : 0;
  const clientName = targetType === 'Takeaway' ? (document.getElementById('tkClient')?.value || '') : '';

  if (targetType === 'Takeaway' && Math.abs((cashPaid + vodaPaid) - netTotal) > 0.05) {
    return toast('مجموع الكاش وفودافون كاش يجب أن يساوي الصافي (' + netTotal + ' ج.م)', true);
  }

  showLoader(true);
  closeModal();

  const processedItems = cart.map(c => ({ itemId: c.itemId, name: c.name, qty: c.qty, price: c.price, total: round2(c.price * c.qty) }));
  const nowIso = new Date().toISOString();

  for (const c of processedItems) {
    const m = appState.menu.find(x => x.id === c.itemId);
    if (m.track_stock) {
      const newStock = Number(m.current_stock) - c.qty;
      await sb.from('menu_items').update({ current_stock: newStock }).eq('id', m.id);
      await sb.from('inventory_logs').insert({
        id: genId('INV'), item_id: m.id, item_name: m.name, action: 'Sale',
        qty_change: -c.qty, stock_after: newStock, ref_id: targetName, staff_name: currentUser.name
      });
    }
  }

  if (targetType === 'Takeaway') {
    const orderId = genId('ORD');
    const summary = processedItems.map(i => `${i.name} x${i.qty}`).join(' | ');
    const pm = vodaPaid > 0 && cashPaid > 0 ? 'Split' : (vodaPaid > 0 ? 'Vodafone Cash' : 'Cash');
    const receipt = {
      receiptId: orderId, date: fmtDateTime(nowIso), type: 'تيك أواي (بيع سريع)', target: 'Takeaway',
      clientName, staffName: currentUser.name, segments: [], cafeItems: processedItems,
      roomCost: 0, cafeCost: subTotal, subtotal: subTotal, discount: disc, discountReason: discReason,
      totalBill: netTotal, paymentMethod: pm, cashPaid, vodafonePaid: vodaPaid
    };

    await Promise.all([
      sb.from('cafe_orders').insert({
        id: orderId, shift_id: appState.activeShift.id, order_type: 'Takeaway', target_id: 'TAKEAWAY',
        target_name: 'تيك أواي (بيع سريع)', client_name: clientName, items_json: processedItems,
        items_summary: summary, subtotal_amount: subTotal, discount: disc, discount_reason: discReason,
        total_amount: netTotal, payment_method: pm, cash_paid: cashPaid, vodafone_cash_paid: vodaPaid,
        status: 'Paid', closed_at: nowIso, staff_name: currentUser.name
      }),
      sb.from('transactions').insert({
        id: orderId, shift_id: appState.activeShift.id, shift_date: appState.activeShift.shift_date,
        type: 'Takeaway', ref_id: orderId, target: 'تيك أواي', client_name: clientName,
        subtotal_amount: subTotal, discount_amount: disc, amount: netTotal, room_part: 0, cafe_part: netTotal,
        payment_method: pm, cash_amount: cashPaid, vodafone_amount: vodaPaid, staff_name: currentUser.name,
        details: summary + (disc > 0 ? ` [خصم: ${disc}ج]` : ''), receipt_json: receipt
      })
    ]);
    if (disc > 0) await logEdit('INVOICE_DISCOUNT', orderId, `خصم تيك أواي: ${disc} ج.م (${discReason})`);
    await updateClientStats(clientName, netTotal, '');
    await loadFullState(true);
    openReceiptPreviewModal(receipt);
    toast('تم تسجيل البيع السريع');
    return;
  }

  const existing = appState.openOrders.find(o => o.order_type === targetType && o.target_id === targetId);
  if (existing) {
    const oldItems = Array.isArray(existing.items_json) ? [...existing.items_json] : [];
    processedItems.forEach(pi => {
      const match = oldItems.find(oi => oi.itemId === pi.itemId);
      if (match) {
        match.qty += pi.qty;
        match.total = round2(match.total + pi.total);
      } else {
        oldItems.push(pi);
      }
    });
    const newSub = round2(Number(existing.subtotal_amount || existing.total_amount || 0) + subTotal);
    const newSummary = oldItems.map(i => `${i.name} x${i.qty}`).join(' | ');
    await sb.from('cafe_orders').update({ items_json: oldItems, items_summary: newSummary, subtotal_amount: newSub, total_amount: newSub }).eq('id', existing.id);
    if (targetType === 'Room') await sb.from('rooms').update({ cafe_cost: newSub }).eq('id', targetId);
  } else {
    const orderId = genId('ORD');
    const summary = processedItems.map(i => `${i.name} x${i.qty}`).join(' | ');
    await sb.from('cafe_orders').insert({
      id: orderId, shift_id: appState.activeShift.id, order_type: targetType, target_id: targetId,
      target_name: targetName, items_json: processedItems, items_summary: summary,
      subtotal_amount: subTotal, total_amount: subTotal, status: 'Open', staff_name: currentUser.name
    });
    if (targetType === 'Room') await sb.from('rooms').update({ cafe_cost: subTotal }).eq('id', targetId);
    else if (targetType === 'Table') await sb.from('cafe_tables').update({ status: 'Occupied', order_id: orderId, opened_at: nowIso, staff_name: currentUser.name }).eq('id', targetId);
  }

  await loadFullState(true);
  toast('تم إضافة الطلب وخصم المخزون');
}

/* ==================== CHECKOUT ROOM & TABLE (WITH DISCOUNT ON ALL INVOICES) ==================== */
function set1ClickPay(prefix, mode) {
  let total = 0;
  if (prefix === 'chk') total = Number(document.getElementById('chkFinal').textContent || 0);
  else if (prefix === 'tb') total = Number(document.getElementById('tbFinal').textContent || 0);
  else if (prefix === 'tk') total = Number(document.getElementById('tkNetFinal')?.textContent || 0);
  else if (prefix === 'ed') total = Number(document.getElementById('edNetTotal')?.textContent || 0);

  const cashInp = document.getElementById(prefix + 'Cash');
  const vodaInp = document.getElementById(prefix + 'Voda');
  if (mode === 'Cash') {
    cashInp.value = total;
    vodaInp.value = 0;
  } else if (mode === 'Vodafone') {
    cashInp.value = 0;
    vodaInp.value = total;
  } else if (mode === 'Split') {
    const half = Math.floor(total / 2);
    cashInp.value = half;
    vodaInp.value = round2(total - half);
    cashInp.focus();
  }
}

function openCheckoutRoomModal(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  const live = computeRoomLive(r);
  const openOrd = appState.openOrders.find(o => o.order_type === 'Room' && o.target_id === roomId);

  openModal(`
    <h3 style="margin-bottom:10px;">💰 تقفيل حساب — ${escapeHtml(r.name)}</h3>
    <div style="background:var(--bg); padding:12px 14px; border-radius:12px; margin-bottom:12px; font-size:13px;">
      <div>الوقت الفعلي: <strong>${live.totalMins} دقيقة</strong> ${live.isMinApplied ? '<span class="badge badge-amber">حد أدنى 30 دقيقة</span>' : ''}</div>
      <div style="margin-top:4px;">حساب البلايستيشن: <strong>${live.roomCost} ج.م</strong></div>
      <div style="margin-top:4px;">طلبات الكافيه والتلاجة: <strong>${live.cafeCost} ج.م</strong></div>
      ${openOrd ? `<div style="font-size:12px; color:var(--muted); margin-top:3px;">(${escapeHtml(openOrd.items_summary)})</div>` : ''}
      <div style="margin-top:6px; border-top:1px solid var(--border); padding-top:6px;">الإجمالي قبل الخصم: <strong>${live.grandTotal} ج.م</strong></div>
      <div style="font-size:20px; font-weight:900; color:var(--success); margin-top:4px;">الصافي المطلوب: <span id="chkFinal">${live.grandTotal}</span> ج.م</div>
    </div>

    <div class="row-2">
      <div class="form-group"><label>🏷️ خصم على الفاتورة (ج.م)</label><input type="number" id="chkDiscount" value="0" min="0" oninput="recalcRoomCheckout(${live.grandTotal})" /></div>
      <div class="form-group"><label>العميل</label><select id="chkClient">${buildClientOptionsHtml(r.client_name || '')}</select></div>
    </div>
    <div class="form-group"><label>سبب الخصم (اختياري)</label><input id="chkDiscReason" placeholder="مثلاً: تعويض وقت / عميل VIP..." /></div>

    <div style="margin-bottom:10px;">
      <div class="row-3">
        <button type="button" class="btn-sm btn-success" onclick="set1ClickPay('chk', 'Cash')">💵 كاش بالكامل</button>
        <button type="button" class="btn-sm btn-primary" onclick="set1ClickPay('chk', 'Vodafone')">📱 فودافون كاش</button>
        <button type="button" class="btn-sm btn-ghost" onclick="set1ClickPay('chk', 'Split')">✂️ تقسيم</button>
      </div>
    </div>
    <div class="row-2">
      <div class="form-group"><label>كاش</label><input type="number" id="chkCash" value="${live.grandTotal}" /></div>
      <div class="form-group"><label>فودافون كاش</label><input type="number" id="chkVoda" value="0" /></div>
    </div>
    <div class="row-2" style="margin-top:10px;">
      <button type="button" class="btn-sm btn-success" onclick="submitCheckoutRoom('${roomId}')">✅ تأكيد التحصيل وإغلاق الغرفة</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

function recalcRoomCheckout(baseTotal) {
  const disc = Number(document.getElementById('chkDiscount').value || 0);
  const net = Math.max(0, round2(baseTotal - disc));
  document.getElementById('chkFinal').textContent = net;
  document.getElementById('chkCash').value = net;
  document.getElementById('chkVoda').value = 0;
}

async function submitCheckoutRoom(roomId) {
  const r = appState.rooms.find(x => x.id === roomId);
  const live = computeRoomLive(r);
  const netTotal = Number(document.getElementById('chkFinal').textContent || 0);
  const cash = Number(document.getElementById('chkCash').value || 0);
  const voda = Number(document.getElementById('chkVoda').value || 0);
  const disc = Number(document.getElementById('chkDiscount').value || 0);
  const discReason = document.getElementById('chkDiscReason').value.trim();
  const clientName = document.getElementById('chkClient').value;

  if (Math.abs((cash + voda) - netTotal) > 0.05) {
    return toast('مجموع المدفوع لا يساوي الصافي (' + netTotal + ' ج.م)', true);
  }

  const pm = voda > 0 && cash > 0 ? 'Split' : (voda > 0 ? 'Vodafone Cash' : 'Cash');
  const nowIso = new Date().toISOString();

  let segMins = 0, segCost = 0;
  const g = appState.allGames.find(x => x.id === r.game_id);
  const rate = g ? (r.mode === 'Multi' ? Number(g.multi_rate) : Number(g.single_rate)) : 0;
  if (r.hold_state !== 'HOLD_PAUSED' && r.segment_start) {
    segMins = Math.max(0, (Date.now() - new Date(r.segment_start).getTime()) / 60000);
    segCost = (segMins / 60) * rate;
  }
  const segments = Array.isArray(r.segments_json) ? [...r.segments_json] : [];
  if (segMins > 0.01) {
    segments.push({ game: `${r.game_name} (${r.model})`, mode: r.mode, mins: round2(segMins), cost: round2(segCost) });
  }

  const actualMins = Math.round(Number(r.accumulated_minutes || 0) + segMins);
  const billedMins = Math.max(30, actualMins);
  const finalRoomCost = live.roomCost;
  const cafeCost = live.cafeCost;
  const subTotal = round2(finalRoomCost + cafeCost);
  const netRoomPart = Math.max(0, round2(finalRoomCost - disc));
  const segSummary = segments.map(s => `${s.game} [${s.mode}] ${s.mins}د`).join(' + ');

  showLoader(true);
  closeModal();

  const openOrd = appState.openOrders.find(o => o.order_type === 'Room' && o.target_id === r.id);
  const cafeItems = openOrd ? (openOrd.items_json || []) : [];
  if (openOrd) {
    const cVoda = Math.min(cafeCost, voda);
    const cCash = Math.max(0, round2(cafeCost - cVoda));
    await sb.from('cafe_orders').update({
      payment_method: pm, cash_paid: cCash, vodafone_cash_paid: cVoda, status: 'Paid', closed_at: nowIso, client_name: clientName
    }).eq('id', openOrd.id);
  }

  const receipt = {
    receiptId: r.session_id, date: fmtDateTime(nowIso), type: 'جلسة بلايستيشن', target: r.name,
    clientName, staffName: currentUser.name, actualMins, billedMins, segments, cafeItems,
    roomCost: finalRoomCost, cafeCost, subtotal: subTotal, discount: disc, discountReason: discReason,
    totalBill: netTotal, paymentMethod: pm, cashPaid: cash, vodafonePaid: voda
  };

  await Promise.all([
    sb.from('room_logs').update({
      client_name: clientName, end_time: nowIso, actual_minutes: actualMins, billed_minutes: billedMins,
      segments_summary: segSummary, room_cost: finalRoomCost, cafe_cost: cafeCost, discount: disc,
      discount_reason: discReason, total_bill: netTotal, payment_method: pm, cash_paid: cash,
      vodafone_cash_paid: voda, staff_name: currentUser.name, status: 'Closed'
    }).eq('session_id', r.session_id),
    sb.from('transactions').insert({
      id: r.session_id, shift_id: appState.activeShift.id, shift_date: appState.activeShift.shift_date,
      type: 'Room Session', ref_id: r.session_id, target: r.name, client_name: clientName,
      subtotal_amount: subTotal, discount_amount: disc, amount: netTotal,
      room_part: netRoomPart, cafe_part: cafeCost, payment_method: pm, cash_amount: cash,
      vodafone_amount: voda, staff_name: currentUser.name,
      details: segSummary + (cafeCost > 0 ? ` + كافيه ${cafeCost}ج` : '') + (disc > 0 ? ` [خصم: ${disc}ج]` : ''),
      receipt_json: receipt
    }),
    sb.from('rooms').update({
      status: 'Available', session_id: null, game_id: null, game_name: null, model: null, mode: null,
      session_type: null, target_minutes: 0, segment_start: null, accumulated_minutes: 0,
      accumulated_cost: 0, cafe_cost: 0, hold_state: 'NONE', hold_start: null, segments_json: [], client_name: ''
    }).eq('id', roomId)
  ]);

  if (disc > 0) await logEdit('INVOICE_DISCOUNT', r.name, `خصم على فاتورة ${r.session_id}: ${disc} ج.م (${discReason})`);
  await updateClientStats(clientName, netTotal, r.game_name);
  await loadFullState(true);
  openReceiptPreviewModal(receipt);
  toast('تم تقفيل حساب الغرفة بنجاح');
}

function openCheckoutTableModal(tableId) {
  const t = appState.tables.find(x => x.id === tableId);
  const ord = appState.openOrders.find(o => o.order_type === 'Table' && o.target_id === tableId);
  const subTotal = ord ? Number(ord.subtotal_amount || ord.total_amount || 0) : 0;

  openModal(`
    <h3 style="margin-bottom:10px;">💰 تقفيل حساب ${escapeHtml(t.name)}</h3>
    ${ord ? `<div class="open-items-pill" style="margin-bottom:10px;">${escapeHtml(ord.items_summary)}</div>` : ''}
    <div style="font-size:14px; margin-bottom:4px;">الإجمالي قبل الخصم: <strong>${subTotal} ج.م</strong></div>
    <p style="font-size:20px; font-weight:900; color:var(--success); margin-bottom:12px;">الصافي المطلوب: <span id="tbFinal">${subTotal}</span> ج.م</p>

    <div class="row-2">
      <div class="form-group"><label>🏷️ خصم على الفاتورة (ج.م)</label><input type="number" id="tbDiscount" value="0" min="0" oninput="recalcTableCheckout(${subTotal})" /></div>
      <div class="form-group"><label>العميل (اختياري)</label><select id="tbClient">${buildClientOptionsHtml(t.client_name || '')}</select></div>
    </div>
    <div class="form-group"><label>سبب الخصم (اختياري)</label><input id="tbDiscReason" placeholder="سبب الخصم..." /></div>

    <div style="margin-bottom:10px;">
      <div class="row-3">
        <button type="button" class="btn-sm btn-success" onclick="set1ClickPay('tb', 'Cash')">💵 كاش بالكامل</button>
        <button type="button" class="btn-sm btn-primary" onclick="set1ClickPay('tb', 'Vodafone')">📱 فودافون كاش</button>
        <button type="button" class="btn-sm btn-ghost" onclick="set1ClickPay('tb', 'Split')">✂️ تقسيم</button>
      </div>
    </div>
    <div class="row-2">
      <div class="form-group"><label>كاش</label><input type="number" id="tbCash" value="${subTotal}" /></div>
      <div class="form-group"><label>فودافون كاش</label><input type="number" id="tbVoda" value="0" /></div>
    </div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-success" onclick="submitCheckoutTable('${tableId}', ${subTotal})">✅ تأكيد الدفع</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

function recalcTableCheckout(subTotal) {
  const disc = Number(document.getElementById('tbDiscount').value || 0);
  const net = Math.max(0, round2(subTotal - disc));
  document.getElementById('tbFinal').textContent = net;
  document.getElementById('tbCash').value = net;
  document.getElementById('tbVoda').value = 0;
}

async function submitCheckoutTable(tableId, subTotal) {
  const t = appState.tables.find(x => x.id === tableId);
  const ord = appState.openOrders.find(o => o.order_type === 'Table' && o.target_id === tableId);
  const disc = Number(document.getElementById('tbDiscount').value || 0);
  const discReason = document.getElementById('tbDiscReason').value.trim();
  const netTotal = Math.max(0, round2(subTotal - disc));
  const cash = Number(document.getElementById('tbCash').value || 0);
  const voda = Number(document.getElementById('tbVoda').value || 0);
  const clientName = document.getElementById('tbClient').value;

  if (Math.abs((cash + voda) - netTotal) > 0.05) {
    return toast('مجموع المدفوع لا يساوي الصافي (' + netTotal + ' ج.م)', true);
  }

  const pm = voda > 0 && cash > 0 ? 'Split' : (voda > 0 ? 'Vodafone Cash' : 'Cash');
  const nowIso = new Date().toISOString();

  showLoader(true);
  closeModal();

  let receipt = null;
  if (ord) {
    receipt = {
      receiptId: ord.id, date: fmtDateTime(nowIso), type: 'فاتورة كافيه (ترابيزة)', target: t.name,
      clientName, staffName: currentUser.name, segments: [], cafeItems: ord.items_json || [],
      roomCost: 0, cafeCost: subTotal, subtotal: subTotal, discount: disc, discountReason: discReason,
      totalBill: netTotal, paymentMethod: pm, cashPaid: cash, vodafonePaid: voda
    };
    await Promise.all([
      sb.from('cafe_orders').update({
        client_name: clientName, subtotal_amount: subTotal, discount: disc, discount_reason: discReason,
        total_amount: netTotal, payment_method: pm, cash_paid: cash, vodafone_cash_paid: voda,
        status: 'Paid', closed_at: nowIso
      }).eq('id', ord.id),
      sb.from('transactions').insert({
        id: ord.id, shift_id: appState.activeShift.id, shift_date: appState.activeShift.shift_date,
        type: 'Cafe Table', ref_id: ord.id, target: t.name, client_name: clientName,
        subtotal_amount: subTotal, discount_amount: disc, amount: netTotal, room_part: 0, cafe_part: netTotal,
        payment_method: pm, cash_amount: cash, vodafone_amount: voda, staff_name: currentUser.name,
        details: ord.items_summary + (disc > 0 ? ` [خصم: ${disc}ج]` : ''), receipt_json: receipt
      })
    ]);
    if (disc > 0) await logEdit('INVOICE_DISCOUNT', ord.id, `خصم على ${t.name}: ${disc} ج.م (${discReason})`);
    await updateClientStats(clientName, netTotal, '');
  }

  await sb.from('cafe_tables').update({ status: 'Available', order_id: null, client_name: '', opened_at: null, staff_name: '' }).eq('id', tableId);
  await loadFullState(true);
  if (receipt) openReceiptPreviewModal(receipt);
  toast('تم تقفيل حساب الترابيزة');
}

/* ==================== RECEIPT PREVIEW & THERMAL PRINT (SHOWS DISCOUNT CLEARLY) ==================== */
let currentReceiptToPrint = null;

function openReceiptPreviewModal(rc) {
  if (!rc) return;
  currentReceiptToPrint = rc;
  openModal(`
    <div style="text-align:center; margin-bottom:10px;">
      <span class="badge badge-green">✅ الفاتورة جاهزة</span>
      <h3 style="margin-top:6px;">معاينة الفاتورة (${escapeHtml(rc.receiptId)})</h3>
    </div>
    <div style="background:#ffffff; color:#000000; border-radius:12px; padding:16px; max-height:370px; overflow-y:auto; font-size:13px;">
      ${buildReceiptMarkup(rc)}
    </div>
    <div class="row-2" style="margin-top:14px;">
      <button type="button" class="btn-sm btn-primary" style="padding:12px;" onclick="triggerPrintCurrentReceipt()">🖨️ طباعة الفاتورة</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

function buildReceiptMarkup(rc) {
  const segRows = (rc.segments || []).map(s => `<tr><td>${escapeHtml(s.game)} (${escapeHtml(s.mode)})</td><td>${s.mins}د</td><td>${s.cost} ج.م</td></tr>`).join('');
  const itemRows = (rc.cafeItems || []).map(i => `<tr><td>${escapeHtml(i.name)}</td><td>×${i.qty}</td><td>${i.total} ج.م</td></tr>`).join('');
  const subTotal = Number(rc.subtotal || (Number(rc.roomCost || 0) + Number(rc.cafeCost || 0)) || rc.totalBill || 0);
  const disc = Number(rc.discount || 0);

  return `
    <div style="text-align:center;">
      <h2 style="margin:0; font-weight:900; letter-spacing:2px;">ARENA</h2>
      <div style="font-size:11px;">PlayStation Lounge & Cafe</div>
    </div>
    <div class="rc-line" style="border-top:1px dashed #333; margin:8px 0;"></div>
    <div class="rc-row" style="display:flex; justify-content:space-between;"><span>رقم الفاتورة:</span><strong>${escapeHtml(rc.receiptId)}</strong></div>
    <div class="rc-row" style="display:flex; justify-content:space-between;"><span>التاريخ:</span><span>${escapeHtml(rc.date)}</span></div>
    <div class="rc-row" style="display:flex; justify-content:space-between;"><span>المكان / النوع:</span><strong>${escapeHtml(rc.target)}</strong></div>
    ${rc.clientName ? `<div class="rc-row" style="display:flex; justify-content:space-between;"><span>العميل:</span><span>${escapeHtml(rc.clientName)}</span></div>` : ''}
    <div class="rc-row" style="display:flex; justify-content:space-between;"><span>الكاشير:</span><span>${escapeHtml(rc.staffName || '')}</span></div>
    <div class="rc-line" style="border-top:1px dashed #333; margin:8px 0;"></div>

    ${segRows ? `
      <div style="font-weight:800; margin-bottom:4px;">🎮 تفاصيل وقت اللعب:</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <thead><tr><th style="text-align:right; color:#000; background:none;">اللعبة</th><th style="text-align:right; color:#000; background:none;">المدة</th><th style="text-align:right; color:#000; background:none;">القيمة</th></tr></thead>
        <tbody>${segRows}</tbody>
      </table>` : ''}

    ${itemRows ? `
      <div style="font-weight:800; margin-bottom:4px;">☕ الكافيه والسناكس:</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <thead><tr><th style="text-align:right; color:#000; background:none;">الصنف</th><th style="text-align:right; color:#000; background:none;">الكمية</th><th style="text-align:right; color:#000; background:none;">الإجمالي</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}

    <div class="rc-line" style="border-top:1px dashed #333; margin:8px 0;"></div>
    ${rc.roomCost > 0 ? `<div style="display:flex; justify-content:space-between;"><span>إجمالي اللعب:</span><span>${rc.roomCost} ج.م</span></div>` : ''}
    ${rc.cafeCost > 0 ? `<div style="display:flex; justify-content:space-between;"><span>إجمالي الكافيه:</span><span>${rc.cafeCost} ج.م</span></div>` : ''}
    <div style="display:flex; justify-content:space-between; font-weight:700; margin-top:3px;"><span>الإجمالي قبل الخصم:</span><span>${subTotal} ج.م</span></div>
    ${disc > 0 ? `
      <div style="display:flex; justify-content:space-between; font-weight:800; color:#000;">
        <span>الخصم ${rc.discountReason ? '(' + escapeHtml(rc.discountReason) + ')' : ''}:</span>
        <span>-${disc} ج.م</span>
      </div>
    ` : ''}
    <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:900; margin-top:5px; border-top:1px solid #000; padding-top:4px;">
      <span>الصافي النهائي:</span><span>${rc.totalBill} ج.م</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:4px;">
      <span>الدفع (${escapeHtml(rc.paymentMethod)}):</span>
      <span>كاش: ${rc.cashPaid}ج | فودافون: ${rc.vodafonePaid}ج</span>
    </div>
    <div class="rc-line" style="border-top:1px dashed #333; margin:8px 0;"></div>
    <div style="text-align:center; font-size:11px;">شكراً لزيارتكم ARENA — نتمنى لكم وقتاً ممتعاً!</div>
  `;
}

function triggerPrintCurrentReceipt() {
  if (!currentReceiptToPrint) return;
  document.getElementById('printReceiptArea').innerHTML = buildReceiptMarkup(currentReceiptToPrint);
  setTimeout(() => window.print(), 120);
}

function printTxById(txId) {
  const tx = appState.transactions.find(t => t.id === txId);
  if (!tx || !tx.receipt_json) return toast('لا توجد فاتورة قابلة للطباعة لهذه الحركة', true);
  openReceiptPreviewModal(tx.receipt_json);
}

/* ==================== ADMIN INVOICE & DETAILS EDITOR (FROM DASHBOARD) ==================== */
function openEditInvoiceModal(txId) {
  const tx = appState.transactions.find(t => t.id === txId);
  if (!tx) return;
  const subVal = Number(tx.subtotal_amount || tx.amount || 0);
  const discVal = Number(tx.discount_amount || 0);
  const netVal = Number(tx.amount || 0);

  const clientOpts = (appState.clients || []).map(c =>
    `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`
  ).join('');

  openModal(`
    <h3 style="margin-bottom:8px;">✏️ تعديل بيانات الفاتورة (${escapeHtml(tx.id)})</h3>
    <p style="font-size:12px; color:var(--muted); margin-bottom:12px;">
      أي تعديل هنا سيُحدّث الفاتورة في التقارير والفاتورة المطبوعة ويُسجل في سجل المراجعة.
    </p>

    <div class="row-2">
      <div class="form-group">
        <label>المكان / البيان (Target)</label>
        <input id="edTarget" value="${escapeHtml(tx.target || '')}" />
      </div>
      <div class="form-group">
        <label>اسم العميل (اختر من القائمة أو اكتب)</label>
        <input id="edClient" list="edClientsList" value="${escapeHtml(tx.client_name || '')}" placeholder="اسم العميل..." />
        <datalist id="edClientsList">${clientOpts}</datalist>
      </div>
    </div>

    <div class="row-2">
      <div class="form-group">
        <label>الإجمالي قبل الخصم (Subtotal)</label>
        <input type="number" id="edSub" value="${subVal}" oninput="recalcEditInvoice()" />
      </div>
      <div class="form-group">
        <label>قيمة الخصم (Discount)</label>
        <input type="number" id="edDisc" value="${discVal}" oninput="recalcEditInvoice()" />
      </div>
    </div>

    <div style="background:var(--bg); padding:10px 14px; border-radius:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <span>الصافي بعد التعديل:</span>
      <strong style="font-size:18px; color:var(--success);"><span id="edNetTotal">${netVal}</span> ج.م</strong>
    </div>

    <div style="margin-bottom:8px;">
      <div class="row-3">
        <button type="button" class="btn-xs btn-success" onclick="set1ClickPay('ed', 'Cash')">💵 كاش بالكامل</button>
        <button type="button" class="btn-xs btn-primary" onclick="set1ClickPay('ed', 'Vodafone')">📱 فودافون كاش</button>
        <button type="button" class="btn-xs btn-ghost" onclick="set1ClickPay('ed', 'Split')">✂️ تقسيم</button>
      </div>
    </div>

    <div class="row-2">
      <div class="form-group"><label>المبلغ كاش (Cash)</label><input type="number" id="edCash" value="${tx.cash_amount || 0}" /></div>
      <div class="form-group"><label>فودافون كاش (Vodafone)</label><input type="number" id="edVoda" value="${tx.vodafone_amount || 0}" /></div>
    </div>

    <div class="row-2">
      <div class="form-group"><label>الكاشير / الموظف</label><input id="edStaff" value="${escapeHtml(tx.staff_name || '')}" /></div>
      <div class="form-group"><label>تفاصيل / ملاحظات الفاتورة</label><input id="edDetails" value="${escapeHtml(tx.details || '')}" /></div>
    </div>

    <div class="row-2" style="margin-top:12px;">
      <button type="button" class="btn-sm btn-primary" onclick="submitEditInvoice('${tx.id}')">💾 حفظ التعديلات</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

function recalcEditInvoice() {
  const sub = Number(document.getElementById('edSub').value || 0);
  const disc = Number(document.getElementById('edDisc').value || 0);
  const net = Math.max(0, round2(sub - disc));
  document.getElementById('edNetTotal').textContent = net;
  document.getElementById('edCash').value = net;
  document.getElementById('edVoda').value = 0;
}

async function submitEditInvoice(txId) {
  const tx = appState.transactions.find(t => t.id === txId);
  if (!tx) return;

  const target = document.getElementById('edTarget').value.trim();
  const clientName = document.getElementById('edClient').value.trim();
  const sub = Number(document.getElementById('edSub').value || 0);
  const disc = Number(document.getElementById('edDisc').value || 0);
  const net = Math.max(0, round2(sub - disc));
  const cash = Number(document.getElementById('edCash').value || 0);
  const voda = Number(document.getElementById('edVoda').value || 0);
  const staffName = document.getElementById('edStaff').value.trim();
  const details = document.getElementById('edDetails').value.trim();

  if (tx.type !== 'Expense' && tx.type !== 'Shift Open' && tx.type !== 'Shift Close' && tx.type !== 'Shift Handover') {
    if (Math.abs((cash + voda) - net) > 0.05) {
      return toast('مجموع الكاش وفودافون كاش يجب أن يساوي الصافي (' + net + ' ج.م)', true);
    }
  }

  const pm = voda > 0 && cash > 0 ? 'Split' : (voda > 0 ? 'Vodafone Cash' : 'Cash');

  let updatedReceipt = tx.receipt_json ? { ...tx.receipt_json } : null;
  if (updatedReceipt) {
    updatedReceipt.target = target;
    updatedReceipt.clientName = clientName;
    updatedReceipt.subtotal = sub;
    updatedReceipt.discount = disc;
    updatedReceipt.totalBill = net;
    updatedReceipt.paymentMethod = pm;
    updatedReceipt.cashPaid = cash;
    updatedReceipt.vodafonePaid = voda;
    updatedReceipt.staffName = staffName;
  }

  let roomPart = Number(tx.room_part || 0);
  let cafePart = Number(tx.cafe_part || 0);
  if (tx.type === 'Room Session') {
    roomPart = Math.max(0, round2(net - cafePart));
  } else if (tx.type === 'Cafe Table' || tx.type === 'Takeaway') {
    cafePart = net;
  }

  showLoader(true);
  closeModal();

  const tasks = [
    sb.from('transactions').update({
      target, client_name: clientName, subtotal_amount: sub, discount_amount: disc,
      amount: net, room_part: roomPart, cafe_part: cafePart, payment_method: pm,
      cash_amount: cash, vodafone_amount: voda, staff_name: staffName, details,
      receipt_json: updatedReceipt
    }).eq('id', txId),
    logEdit('EDIT_INVOICE', txId, `تعديل فاتورة (${target}) | العميل: ${clientName || 'بدون'} | الصافي: ${net}ج (خصم: ${disc}ج)`)
  ];

  if (tx.type === 'Room Session') {
    tasks.push(sb.from('room_logs').update({
      room_name: target, client_name: clientName, discount: disc, total_bill: net,
      payment_method: pm, cash_paid: cash, vodafone_cash_paid: voda, staff_name: staffName
    }).eq('session_id', tx.ref_id));
  } else if (tx.type === 'Cafe Table' || tx.type === 'Takeaway') {
    tasks.push(sb.from('cafe_orders').update({
      target_name: target, client_name: clientName, subtotal_amount: sub, discount: disc,
      total_amount: net, payment_method: pm, cash_paid: cash, vodafone_cash_paid: voda, staff_name: staffName
    }).eq('id', tx.ref_id));
  } else if (tx.type === 'Expense') {
    tasks.push(sb.from('expenses').update({ title: target, amount: net, staff_name: staffName }).eq('id', tx.ref_id));
  }

  await Promise.all(tasks);
  await loadFullState(true);
  toast('✅ تم تعديل الفاتورة وتحديث التقارير');
}

/* ==================== EXPENSES ==================== */
function openExpenseModal() {
  if (appState.shiftStatus !== 'OPEN') return toast('يجب فتح يومية أولاً لتسجيل المصروفات', true);
  openModal(`
    <h3 style="margin-bottom:12px;">💸 تسجيل مصروف طارئ من الدرج</h3>
    <div class="form-group"><label>بيان المصروف (مثلاً: لبن، سكر، ثلج)</label><input id="expTitle" /></div>
    <div class="form-group"><label>المبلغ (ج.م)</label><input type="number" id="expAmount" /></div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-warning" onclick="submitExpense()">حفظ المصروف</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitExpense() {
  const title = document.getElementById('expTitle').value.trim();
  const amount = Number(document.getElementById('expAmount').value || 0);
  if (!title || amount <= 0) return toast('أدخل البيان والمبلغ', true);

  const expId = genId('EXP');
  showLoader(true);
  closeModal();

  await Promise.all([
    sb.from('expenses').insert({ id: expId, shift_id: appState.activeShift.id, title, amount, staff_name: currentUser.name }),
    sb.from('transactions').insert({
      id: expId, shift_id: appState.activeShift.id, shift_date: appState.activeShift.shift_date,
      type: 'Expense', ref_id: expId, target: title, subtotal_amount: amount, discount_amount: 0,
      amount, payment_method: 'Cash', cash_amount: amount, staff_name: currentUser.name, details: title
    })
  ]);
  await loadFullState(true);
  toast('تم تسجيل المصروف وخصمه من الدرج');
}

/* ==================== CLIENTS, INVENTORY & ADMIN CRUD ==================== */
async function updateClientStats(clientName, amountSpent, lastGame) {
  if (!clientName || clientName === 'عميل نقدي عام') return;
  const c = (appState.clients || []).find(x => String(x.name).trim() === String(clientName).trim());
  if (!c) return;
  await sb.from('clients').update({
    favorite_game: lastGame || c.favorite_game || '',
    total_visits: Number(c.total_visits || 0) + 1,
    total_spent: round2(Number(c.total_spent || 0) + Number(amountSpent || 0)),
    last_visit: new Date().toISOString()
  }).eq('id', c.id);
}

function renderClientsTab() {
  if (!appState) return;
  const q = (document.getElementById('clientSearchInp')?.value || '').trim().toLowerCase();
  const list = (appState.clients || []).filter(c => !q || String(c.name).toLowerCase().includes(q) || String(c.phone || '').includes(q));
  document.getElementById('clientsTableBody').innerHTML = list.map(c => `
    <tr>
      <td>${escapeHtml(c.id)}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${escapeHtml(c.phone || '—')}</td>
      <td>${escapeHtml(c.favorite_game || '—')}</td>
      <td><span class="badge badge-blue">${c.total_visits || 0}</span></td>
      <td><strong>${round2(c.total_spent || 0)} ج.م</strong></td>
      <td>${c.last_visit ? fmtDateTime(c.last_visit) : '—'}</td>
      <td>${escapeHtml(c.notes || '')}</td>
      <td><button type="button" class="btn-xs btn-ghost" onclick="openClientModal('${c.id}')">تعديل</button></td>
    </tr>`).join('');
}

function openClientModal(clientId) {
  const c = clientId ? appState.clients.find(x => x.id === clientId) : null;
  openModal(`
    <h3 style="margin-bottom:12px;">${c ? 'تعديل بيانات عميل' : '+ إضافة عميل جديد'}</h3>
    <div class="form-group"><label>اسم العميل</label><input id="clName" value="${escapeHtml(c ? c.name : '')}" /></div>
    <div class="form-group"><label>رقم الموبايل</label><input id="clPhone" value="${escapeHtml(c ? (c.phone || '') : '')}" /></div>
    <div class="form-group"><label>اللعبة المفضلة</label><input id="clGame" value="${escapeHtml(c ? (c.favorite_game || '') : 'FIFA 25')}" /></div>
    <div class="form-group"><label>ملاحظات</label><input id="clNotes" value="${escapeHtml(c ? (c.notes || '') : '')}" /></div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-primary" onclick="submitClient('${clientId || ''}')">حفظ</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitClient(clientId) {
  const name = document.getElementById('clName').value.trim();
  if (!name) return toast('أدخل اسم العميل', true);
  const payload = {
    name,
    phone: document.getElementById('clPhone').value.trim(),
    favorite_game: document.getElementById('clGame').value.trim(),
    notes: document.getElementById('clNotes').value.trim()
  };
  showLoader(true);
  closeModal();
  if (clientId) {
    await sb.from('clients').update(payload).eq('id', clientId);
    await logEdit('EDIT_CLIENT', name, 'تعديل بيانات عميل');
  } else {
    await sb.from('clients').insert({ id: genId('CL'), ...payload });
    await logEdit('ADD_CLIENT', name, 'إضافة عميل جديد');
  }
  await loadFullState(true);
  toast('تم حفظ بيانات العميل');
}

function renderInventoryAndMenu() {
  const isAdmin = currentUser.role === 'Admin';
  document.getElementById('menuTableBody').innerHTML = appState.allMenu.map(m => {
    const low = m.track_stock && Number(m.current_stock) <= Number(m.min_stock);
    return `
      <tr>
        <td><strong>${escapeHtml(m.name)}</strong></td>
        <td><span class="badge ${m.track_stock ? 'badge-blue' : 'badge-amber'}">${m.track_stock ? 'تلاجة/سناكس' : 'كافيه'}</span></td>
        <td>${m.price} ج.م</td>
        <td>${m.track_stock ? `<span class="badge ${low ? 'badge-red' : 'badge-green'}">${m.current_stock}</span>` : '—'}</td>
        <td>${m.track_stock ? m.min_stock : '—'}</td>
        <td style="display:flex; gap:6px;">
          ${m.track_stock ? `<button type="button" class="btn-xs btn-success" onclick="openRestockModal('${m.id}')">+ توريد</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn-xs btn-ghost" onclick="openMenuModal('${m.id}')">تعديل</button>
                       <button type="button" class="btn-xs btn-danger" onclick="delMenu('${m.id}')">حذف</button>` : ''}
        </td>
      </tr>`;
  }).join('');

  document.getElementById('invLogsBody').innerHTML = appState.invLogs.map(l => `
    <tr>
      <td>${fmtDateTime(l.timestamp)}</td><td>${escapeHtml(l.item_name)}</td><td>${escapeHtml(l.action)}</td>
      <td style="color:${l.qty_change < 0 ? 'var(--danger)' : 'var(--success)'}; font-weight:800;">${l.qty_change}</td>
      <td>${l.stock_after}</td><td>${escapeHtml(l.ref_id)}</td><td>${escapeHtml(l.staff_name)}</td>
    </tr>`).join('');
}

function openRestockModal(itemId) {
  const item = appState.allMenu.find(x => x.id === itemId);
  openModal(`
    <h3 style="margin-bottom:12px;">📦 توريد مخزون — ${escapeHtml(item.name)}</h3>
    <div class="form-group"><label>الكمية المضافة</label><input type="number" id="rsQty" value="12" min="1" /></div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-success" onclick="submitRestock('${itemId}')">إضافة للمخزون</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitRestock(itemId) {
  const item = appState.allMenu.find(x => x.id === itemId);
  const addQty = Number(document.getElementById('rsQty').value || 0);
  if (addQty <= 0) return toast('أدخل كمية صحيحة', true);
  const newStock = Number(item.current_stock || 0) + addQty;
  showLoader(true);
  closeModal();
  await Promise.all([
    sb.from('menu_items').update({ current_stock: newStock }).eq('id', itemId),
    sb.from('inventory_logs').insert({
      id: genId('INV'), item_id: item.id, item_name: item.name, action: 'Restock',
      qty_change: addQty, stock_after: newStock, ref_id: 'توريد مخزن', staff_name: currentUser.name
    }),
    logEdit('RESTOCK', item.name, `إضافة كمية: +${addQty} (الرصيد الجديد: ${newStock})`)
  ]);
  await loadFullState(true);
  toast('تم تحديث رصيد المخزون');
}

function openMenuModal(itemId) {
  const m = itemId ? appState.allMenu.find(x => x.id === itemId) : null;
  openModal(`
    <h3 style="margin-bottom:12px;">${m ? 'تعديل صنف' : '+ إضافة صنف جديد'}</h3>
    <div class="form-group"><label>اسم الصنف</label><input id="mnName" value="${escapeHtml(m ? m.name : '')}" /></div>
    <div class="form-group">
      <label>التصنيف</label>
      <select id="mnCat">
        <option value="Stocked" ${m && m.category === 'Stocked' ? 'selected' : ''}>تلاجة / سناكس (يخصم من المخزون)</option>
        <option value="Cafe" ${m && m.category === 'Cafe' ? 'selected' : ''}>مشاريب كافيه (شاي/قهوة/عصاير)</option>
      </select>
    </div>
    <div class="row-2">
      <div class="form-group"><label>سعر البيع</label><input type="number" id="mnPrice" value="${m ? m.price : 20}" /></div>
      <div class="form-group"><label>التكلفة</label><input type="number" id="mnCost" value="${m ? m.cost : 10}" /></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label>الرصيد الحالي</label><input type="number" id="mnStock" value="${m ? m.current_stock : 24}" /></div>
      <div class="form-group"><label>حد التنبيه الأدنى</label><input type="number" id="mnMin" value="${m ? m.min_stock : 6}" /></div>
    </div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-primary" onclick="submitMenu('${itemId || ''}')">حفظ</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitMenu(itemId) {
  const cat = document.getElementById('mnCat').value;
  const payload = {
    name: document.getElementById('mnName').value.trim(),
    category: cat,
    price: Number(document.getElementById('mnPrice').value || 0),
    cost: Number(document.getElementById('mnCost').value || 0),
    track_stock: cat === 'Stocked',
    current_stock: Number(document.getElementById('mnStock').value || 0),
    min_stock: Number(document.getElementById('mnMin').value || 5)
  };
  showLoader(true);
  closeModal();
  if (itemId) await sb.from('menu_items').update(payload).eq('id', itemId);
  else await sb.from('menu_items').insert({ id: genId('M'), ...payload });
  await logEdit(itemId ? 'EDIT_MENU' : 'ADD_MENU', payload.name, 'حفظ صنف منيو/تلاجة');
  await loadFullState(true);
  toast('تم حفظ الصنف');
}

async function delMenu(itemId) {
  if (!confirm('متأكد من حذف الصنف؟')) return;
  showLoader(true);
  await sb.from('menu_items').delete().eq('id', itemId);
  await loadFullState(true);
  toast('تم الحذف');
}

function renderAdminSetup() {
  document.getElementById('gamesTableBody').innerHTML = appState.allGames.map(g => `
    <tr>
      <td><strong>${escapeHtml(g.name)}</strong></td>
      <td><span class="badge badge-blue">${escapeHtml(g.model)}</span></td>
      <td>${g.single_rate} ج.م</td>
      <td>${g.multi_rate} ج.م</td>
      <td style="display:flex; gap:6px;">
        <button type="button" class="btn-xs btn-ghost" onclick="openGameModal('${g.id}')">تعديل</button>
        <button type="button" class="btn-xs btn-danger" onclick="delGame('${g.id}')">حذف</button>
      </td>
    </tr>`).join('');

  document.getElementById('roomsTablesManageList').innerHTML =
    '<strong>الغرف:</strong> ' + appState.rooms.map(r => `${escapeHtml(r.name)} <a href="#" style="color:var(--danger);" onclick="delEntity('Room','${r.id}')">[×]</a>`).join(' | ') +
    '<br><br><strong>الترابيزات:</strong> ' + appState.tables.map(t => `${escapeHtml(t.name)} <a href="#" style="color:var(--danger);" onclick="delEntity('Table','${t.id}')">[×]</a>`).join(' | ');

  document.getElementById('usersTableBody').innerHTML = appState.users.map(u => `
    <tr>
      <td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.pin)}</td><td>${escapeHtml(u.role)}</td>
      <td><button type="button" class="btn-xs btn-ghost" onclick="openUserModal('${u.id}')">تعديل</button></td>
    </tr>`).join('');
}

function openGameModal(gameId) {
  const g = gameId ? appState.allGames.find(x => x.id === gameId) : null;
  openModal(`
    <h3 style="margin-bottom:12px;">${g ? 'تعديل لعبة' : '+ إضافة لعبة / موديل جديد'}</h3>
    <div class="form-group"><label>اسم اللعبة</label><input id="gmName" value="${escapeHtml(g ? g.name : '')}" /></div>
    <div class="form-group"><label>الموديل / الجهاز</label><input id="gmModel" value="${escapeHtml(g ? g.model : 'PS5')}" /></div>
    <div class="row-2">
      <div class="form-group"><label>سعر الساعة Single</label><input type="number" id="gmSingle" value="${g ? g.single_rate : 50}" /></div>
      <div class="form-group"><label>سعر الساعة Multi</label><input type="number" id="gmMulti" value="${g ? g.multi_rate : 70}" /></div>
    </div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-primary" onclick="submitGame('${gameId || ''}')">حفظ</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitGame(gameId) {
  const payload = {
    name: document.getElementById('gmName').value.trim(),
    model: document.getElementById('gmModel').value.trim(),
    single_rate: Number(document.getElementById('gmSingle').value || 0),
    multi_rate: Number(document.getElementById('gmMulti').value || 0)
  };
  showLoader(true);
  closeModal();
  if (gameId) await sb.from('games').update(payload).eq('id', gameId);
  else await sb.from('games').insert({ id: genId('G'), ...payload });
  await loadFullState(true);
  toast('تم حفظ اللعبة');
}

async function delGame(gameId) {
  if (!confirm('حذف هذه اللعبة؟')) return;
  showLoader(true);
  await sb.from('games').delete().eq('id', gameId);
  await loadFullState(true);
  toast('تم حذف اللعبة');
}

async function addEntity(entity) {
  const inp = document.getElementById(entity === 'Room' ? 'newRoomName' : 'newTableName');
  const name = inp.value.trim();
  if (!name) return;
  showLoader(true);
  if (entity === 'Room') await sb.from('rooms').insert({ id: genId('R'), name, category: 'Standard' });
  else await sb.from('cafe_tables').insert({ id: genId('T'), name });
  inp.value = '';
  await loadFullState(true);
  toast('تمت الإضافة');
}

async function delEntity(entity, id) {
  if (!confirm('تأكيد الحذف؟')) return;
  showLoader(true);
  if (entity === 'Room') await sb.from('rooms').delete().eq('id', id).eq('status', 'Available');
  else await sb.from('cafe_tables').delete().eq('id', id).eq('status', 'Available');
  await loadFullState(true);
}

function openUserModal(userId) {
  const u = userId ? appState.users.find(x => x.id === userId) : null;
  openModal(`
    <h3 style="margin-bottom:12px;">${u ? 'تعديل مستخدم' : '+ إضافة موظف'}</h3>
    <div class="form-group"><label>الاسم</label><input id="usName" value="${escapeHtml(u ? u.name : '')}" /></div>
    <div class="form-group"><label>كود الدخول PIN</label><input id="usPin" value="${escapeHtml(u ? u.pin : '')}" /></div>
    <div class="form-group">
      <label>الصلاحية</label>
      <select id="usRole">
        <option value="Staff" ${u && u.role === 'Staff' ? 'selected' : ''}>Staff (كاشير)</option>
        <option value="Admin" ${u && u.role === 'Admin' ? 'selected' : ''}>Admin (إدارة كاملة)</option>
      </select>
    </div>
    <div class="row-2">
      <button type="button" class="btn-sm btn-primary" onclick="submitUser('${userId || ''}')">حفظ</button>
      <button type="button" class="btn-sm btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>
  `);
}

async function submitUser(userId) {
  const payload = {
    name: document.getElementById('usName').value.trim(),
    pin: document.getElementById('usPin').value.trim(),
    role: document.getElementById('usRole').value
  };
  showLoader(true);
  closeModal();
  if (userId) await sb.from('users').update(payload).eq('id', userId);
  else await sb.from('users').insert({ id: genId('U'), ...payload });
  await loadFullState(true);
  toast('تم حفظ المستخدم');
}

/* ==================== REPORTS, FILTERS & TRANSACTIONS DASHBOARD ==================== */
function populateReportFilterDropdowns() {
  const shSel = document.getElementById('fltShift');
  const stSel = document.getElementById('fltStaff');
  if (!shSel || !stSel) return;
  const curSh = shSel.value, curSt = stSel.value;
  shSel.innerHTML = '<option value="">كل اليوميات</option>' +
    appState.shiftsHistory.map(s => `<option value="${s.id}">يومية ${escapeHtml(s.shift_date)} (${escapeHtml(s.opened_by)})</option>`).join('');
  shSel.value = curSh;
  stSel.innerHTML = '<option value="">كل الموظفين</option>' +
    appState.users.map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join('');
  stSel.value = curSt;
}

function setQuickDateFilter(preset) {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const fromEl = document.getElementById('fltFrom'), toEl = document.getElementById('fltTo');
  if (preset === 'today') {
    fromEl.value = fmt(today);
    toEl.value = fmt(today);
  } else if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    fromEl.value = fmt(y);
    toEl.value = fmt(y);
  } else if (preset === 'week') {
    const w = new Date(today);
    w.setDate(today.getDate() - 7);
    fromEl.value = fmt(w);
    toEl.value = fmt(today);
  } else {
    fromEl.value = '';
    toEl.value = '';
  }
  renderDashboard();
}

function renderDashboard() {
  if (!appState) return;
  const fFrom = document.getElementById('fltFrom')?.value || '';
  const fTo = document.getElementById('fltTo')?.value || '';
  const fShift = document.getElementById('fltShift')?.value || '';
  const fType = document.getElementById('fltType')?.value || '';
  const fPay = document.getElementById('fltPay')?.value || '';
  const fStaff = document.getElementById('fltStaff')?.value || '';
  const fSearch = (document.getElementById('fltSearch')?.value || '').trim().toLowerCase();

  const filteredTx = (appState.transactions || []).filter(tx => {
    const txDate = tx.shift_date || String(tx.timestamp || '').slice(0, 10);
    if (fFrom && txDate < fFrom) return false;
    if (fTo && txDate > fTo) return false;
    if (fShift && tx.shift_id !== fShift) return false;
    if (fType && tx.type !== fType) return false;
    if (fPay && tx.payment_method !== fPay) return false;
    if (fStaff && tx.staff_name !== fStaff) return false;
    if (fSearch) {
      const hay = `${tx.id} ${tx.target} ${tx.client_name} ${tx.details}`.toLowerCase();
      if (!hay.includes(fSearch)) return false;
    }
    return true;
  });

  let fltRoomRev = 0, fltCafeRev = 0, fltDisc = 0, fltCash = 0, fltVoda = 0, fltExp = 0, fltCustody = 0;
  filteredTx.forEach(tx => {
    const amt = Number(tx.amount || 0);
    fltDisc += Number(tx.discount_amount || 0);
    if (tx.type === 'Shift Open') {
      fltCustody += amt;
    } else if (tx.type === 'Room Session' || tx.type === 'Cafe Table' || tx.type === 'Takeaway') {
      fltRoomRev += Number(tx.room_part || 0);
      fltCafeRev += Number(tx.cafe_part || 0);
      fltCash += Number(tx.cash_amount || 0);
      fltVoda += Number(tx.vodafone_amount || 0);
    } else if (tx.type === 'Expense') {
      fltExp += amt;
    }
  });

  const expectedDrawer = round2(fltCustody + fltCash - fltExp);
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card" style="border-color:var(--success);">
      <div>💵 صافي الكاش بالدرج (بالعهدة)</div>
      <div class="kpi-val" style="color:var(--success);">${expectedDrawer} ج.م</div>
      <div style="font-size:11px; color:var(--muted);">العهدة (${round2(fltCustody)}) + كاش (${round2(fltCash)}) - مصروف (${round2(fltExp)})</div>
    </div>
    <div class="kpi-card"><div>🔓 عهدة البداية</div><div class="kpi-val">${round2(fltCustody)} ج.م</div></div>
    <div class="kpi-card"><div>📊 صافي المبيعات</div><div class="kpi-val">${round2(fltRoomRev + fltCafeRev)} ج.م</div></div>
    <div class="kpi-card"><div>🎮 صافي وقت اللعب</div><div class="kpi-val" style="color:var(--primary);">${round2(fltRoomRev)} ج.م</div></div>
    <div class="kpi-card"><div>☕ صافي الكافيه</div><div class="kpi-val" style="color:var(--purple);">${round2(fltCafeRev)} ج.م</div></div>
    <div class="kpi-card"><div>🏷️ إجمالي الخصومات</div><div class="kpi-val" style="color:var(--warning);">${round2(fltDisc)} ج.م</div></div>
    <div class="kpi-card"><div>📱 فودافون كاش</div><div class="kpi-val">${round2(fltVoda)} ج.م</div></div>
    <div class="kpi-card"><div>💸 المصروفات</div><div class="kpi-val" style="color:var(--danger);">${round2(fltExp)} ج.م</div></div>
  `;

  document.getElementById('txBody').innerHTML = filteredTx.map(tx => `
    <tr>
      <td><strong>${escapeHtml(tx.id)}</strong></td>
      <td>${escapeHtml(tx.shift_date || fmtDateTime(tx.timestamp).slice(0, 10))}</td>
      <td><span class="badge ${tx.type === 'Expense' ? 'badge-red' : (tx.type === 'Shift Handover' ? 'badge-purple' : 'badge-blue')}">${escapeHtml(tx.type)}</span></td>
      <td>${escapeHtml(tx.target)}</td>
      <td>${escapeHtml(tx.client_name || '—')}</td>
      <td>${round2(tx.subtotal_amount || tx.amount)} ج.م</td>
      <td style="color:var(--warning);">${Number(tx.discount_amount || 0) > 0 ? '-' + round2(tx.discount_amount) + ' ج.م' : '0'}</td>
      <td><strong>${round2(tx.amount)} ج.م</strong></td>
      <td>${escapeHtml(tx.payment_method || '—')}</td>
      <td>${escapeHtml(tx.staff_name || '')}</td>
      <td style="display:flex; gap:5px; white-space:nowrap;">
        <button type="button" class="btn-xs btn-warning" onclick="openEditInvoiceModal('${tx.id}')">✏️ تعديل</button>
        ${tx.receipt_json ? `<button type="button" class="btn-xs btn-primary" onclick="printTxById('${tx.id}')">🖨️</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="11" style="text-align:center; color:var(--muted);">لا توجد معاملات مطابقة</td></tr>';

  document.getElementById('shiftsBody').innerHTML = appState.shiftsHistory.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.shift_date)}</strong></td>
      <td>${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.opened_by)}</td>
      <td>${escapeHtml(s.current_holder)}</td>
      <td>${round2(s.room_revenue)}</td>
      <td>${round2(s.cafe_revenue)}</td>
      <td style="color:var(--warning);">${round2(s.total_discounts)}</td>
      <td>${round2(s.total_cash_sales)}</td>
      <td>${round2(s.total_vodafone_cash)}</td>
      <td>${round2(s.total_expenses)}</td>
      <td>${round2(s.expected_drawer_cash)}</td>
      <td>${round2(s.actual_cash)}</td>
      <td>${round2(s.difference)}</td>
      <td><span class="badge ${s.status === 'OPEN' ? 'badge-green' : 'badge-blue'}">${escapeHtml(s.status)}</span></td>
    </tr>`).join('');

  document.getElementById('editLogsBody').innerHTML = appState.editLogs.map(l => `
    <tr><td>${fmtDateTime(l.timestamp)}</td><td>${escapeHtml(l.user_name)}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.target)}</td><td>${escapeHtml(l.details)}</td></tr>`).join('');
}