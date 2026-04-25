/* ══════════════════════════════════════════
   PayBack — To'lov Tiklash Tizimi
   Full Application Logic v2.0
   ══════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const App = {
  data: {
    invoices: [],
    clients: [],
    settings: {
      auto1day: true,
      auto3days: true,
      auto7days: false,
      darkMode: false,
      profileName: '',
      profileRole: '',
      profilePhone: '',
      tplFriendly: '',
      tplWarning: '',
      tplFinal: ''
    },
    notifications: []
  },
  currentPage: 'dashboard',
  currentFilter: 'all',
  editingInvoiceId: null,
  editingClientId: null,
  viewingClientId: null,
  viewingInvoiceId: null,
  confirmCallback: null,
  isLoggedIn: false
};

// ═══════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 UZS';
  return Number(amount).toLocaleString('uz-UZ') + ' UZS';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.floor((due - today) / 86400000);
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
}

function avatarColor(str) {
  let hash = 0;
  for (let c of (str || '')) hash = (hash << 5) - hash + c.charCodeAt(0);
  return 'avatar-color-' + (Math.abs(hash) % 8);
}

function getStatusLabel(status) {
  const map = { paid: "To'langan", pending: "Kutilmoqda", overdue: "Muddati o'tgan" };
  return map[status] || status;
}

function getRatingLabel(r) {
  const map = { reliable: "🟢 Ishonchli", medium: "🟡 O'rtacha", risky: "🔴 Xavfli" };
  return map[r] || r;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hozir';
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} soat oldin`;
  return `${Math.floor(hrs / 24)} kun oldin`;
}

// ═══════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════
function saveData() {
  localStorage.setItem('payback_data', JSON.stringify(App.data));
}

function loadData() {
  const raw = localStorage.getItem('payback_data');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      App.data = { ...App.data, ...parsed };
      if (!App.data.notifications) App.data.notifications = [];
    } catch (e) {}
  }
}

function saveAuthState(user) {
  localStorage.setItem('payback_auth', JSON.stringify(user));
}

function loadAuthState() {
  const raw = localStorage.getItem('payback_auth');
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return null;
}

function clearAuthState() {
  localStorage.removeItem('payback_auth');
}

// ═══════════════════════════════════════════
// AUTH FLOW
// ═══════════════════════════════════════════
function showLanding() {
  document.getElementById('landing-page').style.display = '';
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-shell').style.display = 'none';
}

function showLogin() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'grid';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-form').style.display = '';
  document.getElementById('signup-form').style.display = 'none';
}

function showSignup() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'grid';
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('signup-form').style.display = '';
}

function showApp() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  App.isLoggedIn = true;
}

function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  if (!email) return showToast('Email kiriting', 'error');
  if (!pass)  return showToast('Parol kiriting', 'error');

  setButtonLoading('login-btn', true);

  setTimeout(() => {
    setButtonLoading('login-btn', false);
    const user = { name: App.data.settings.profileName || email.split('@')[0], email };
    saveAuthState(user);
    App.data.settings.profileName = App.data.settings.profileName || user.name;
    saveData();
    showApp();
    initAppUI();
    showToast(`Xush kelibsiz, ${user.name}! 👋`, 'success');
  }, 1200);
}

function handleSignup() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;

  if (!name)  return showToast('Ismingizni kiriting', 'error');
  if (!email) return showToast('Email kiriting', 'error');
  if (!pass || pass.length < 6) return showToast("Parol kamida 6 ta belgi bo'lishi kerak", 'error');

  setButtonLoading('signup-btn', true);

  setTimeout(() => {
    setButtonLoading('signup-btn', false);
    const user = { name, email };
    saveAuthState(user);
    App.data.settings.profileName = name;
    saveData();
    showApp();
    initAppUI();
    showToast(`Hisob yaratildi! Xush kelibsiz, ${name}! 🎉`, 'success');
  }, 1400);
}

function demoLogin() {
  const user = { name: 'Freelancer', email: 'demo@payback.uz' };
  saveAuthState(user);
  showApp();
  initAppUI();
  showToast('Demo rejimiga xush kelibsiz! 🚀', 'success');
}

function handleLogout() {
  closeAllDropdowns();
  clearAuthState();
  App.isLoggedIn = false;
  showLanding();
  showToast("Tizimdan chiqdingiz", 'warning');
}

function togglePasswordVis(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? '' : 'none';
}

// ═══════════════════════════════════════════
// LANDING PAGE HELPERS
// ═══════════════════════════════════════════
function toggleLandingMenu() {
  const menu = document.getElementById('landing-mobile-menu');
  if (menu) menu.classList.toggle('open');
}

function closeLandingMenu() {
  const menu = document.getElementById('landing-mobile-menu');
  if (menu) menu.classList.remove('open');
}

// ═══════════════════════════════════════════
// TOP HEADER DROPDOWNS
// ═══════════════════════════════════════════
function toggleNotifDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('notif-dropdown');
  const profileDd = document.getElementById('profile-dropdown');
  profileDd.classList.remove('open');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) renderNotifications();
}

function toggleProfileDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('profile-dropdown');
  const notifDd = document.getElementById('notif-dropdown');
  notifDd.classList.remove('open');
  dd.classList.toggle('open');
}

function closeAllDropdowns() {
  document.getElementById('notif-dropdown')?.classList.remove('open');
  document.getElementById('profile-dropdown')?.classList.remove('open');
}

function clearNotifications() {
  App.data.notifications = App.data.notifications.map(n => ({ ...n, read: true }));
  saveData();
  updateNotifBadge();
  renderNotifications();
}

function addNotification(text, icon = '🔔') {
  if (!App.data.notifications) App.data.notifications = [];
  App.data.notifications.unshift({
    id: generateId(),
    text,
    icon,
    read: false,
    createdAt: new Date().toISOString()
  });
  // Keep only last 20
  App.data.notifications = App.data.notifications.slice(0, 20);
  saveData();
  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = (App.data.notifications || []).filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = unread > 9 ? '9+' : unread;
  badge.style.display = unread > 0 ? 'grid' : 'none';
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const notifs = App.data.notifications || [];
  if (!notifs.length) {
    list.innerHTML = `<div class="notif-empty">Yangi bildirishnoma yo'q</div>`;
    return;
  }
  list.innerHTML = notifs.slice(0, 10).map(n => `
    <div class="notif-item">
      <span class="notif-icon">${n.icon}</span>
      <div style="flex:1">
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    </div>
  `).join('');
}

function updateProfileHeader() {
  const name = App.data.settings.profileName || 'F';
  const initials = getInitials(name);
  const auth = loadAuthState();
  const email = auth ? auth.email : 'demo@payback.uz';

  const headerAvatar = document.getElementById('header-avatar');
  const pdAvatar = document.getElementById('pd-avatar');
  const pdName = document.getElementById('pd-name');
  const pdEmail = document.getElementById('pd-email');

  if (headerAvatar) { headerAvatar.textContent = initials; headerAvatar.className = `header-avatar ${avatarColor(name)}`; }
  if (pdAvatar) { pdAvatar.textContent = initials; pdAvatar.className = `pd-avatar ${avatarColor(name)}`; }
  if (pdName) pdName.textContent = name;
  if (pdEmail) pdEmail.textContent = email;
}

// ═══════════════════════════════════════════
// SIDEBAR TOGGLE (Mobile)
// ═══════════════════════════════════════════
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

// ═══════════════════════════════════════════
// AUTO-STATUS UPDATE
// ═══════════════════════════════════════════
function autoUpdateStatuses() {
  let changed = false;
  App.data.invoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = daysUntil(inv.dueDate);
    if (days < 0 && inv.status !== 'overdue') {
      inv.status = 'overdue';
      changed = true;
    }
  });
  if (changed) saveData();
}

function checkReminders() {
  const reminders = [];
  App.data.invoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = daysUntil(inv.dueDate);
    const clientName = getClientName(inv.clientId);
    if (days === 1 && App.data.settings.auto1day) {
      reminders.push(`⏰ "${clientName}" — ${inv.number} muddati ertaga tugaydi!`);
    } else if (days < 0 && days >= -3 && App.data.settings.auto3days) {
      reminders.push(`⚠️ "${clientName}" — ${inv.number} ${Math.abs(days)} kun muddati o'tdi!`);
    } else if (days < -7 && App.data.settings.auto7days) {
      reminders.push(`🚨 "${clientName}" — ${inv.number} YAKUNIY OGOHLANTIRISH: ${Math.abs(days)} kun o'tdi!`);
    }
  });
  return reminders;
}

function buildNotificationsFromInvoices() {
  if (!App.data.notifications) App.data.notifications = [];
  const reminders = checkReminders();
  // Only add if we have no notifications yet (first load)
  if (App.data.notifications.length === 0 && reminders.length > 0) {
    reminders.forEach(r => {
      const icon = r.startsWith('🚨') ? '🚨' : r.startsWith('⚠️') ? '⚠️' : '⏰';
      App.data.notifications.push({
        id: generateId(),
        text: r.replace(/^[⏰⚠️🚨]\s/, ''),
        icon,
        read: false,
        createdAt: new Date().toISOString()
      });
    });
    saveData();
  }
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function navigateTo(page) {
  showPageLoader();
  setTimeout(() => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

    App.currentPage = page;
    renderPage(page);
    closeSidebar();
    hidePageLoader();
  }, 250);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'invoices':  renderInvoices(); break;
    case 'clients':   renderClients(); break;
    case 'settings':  renderSettings(); break;
  }
}

function showPageLoader() {
  // Use a subtle inline loader effect by briefly dimming main-content
  const mc = document.getElementById('main-content');
  if (mc) { mc.style.opacity = '.5'; mc.style.pointerEvents = 'none'; }
}

function hidePageLoader() {
  const mc = document.getElementById('main-content');
  if (mc) { mc.style.opacity = ''; mc.style.pointerEvents = ''; }
}

function navigateToProfile() {
  // Open profile modal
  const s = App.data.settings;
  const pmName = document.getElementById('pm-name');
  const pmRole = document.getElementById('pm-role');
  const pmPhone = document.getElementById('pm-phone');
  if (pmName) pmName.value = s.profileName || '';
  if (pmRole) pmRole.value = s.profileRole || '';
  if (pmPhone) pmPhone.value = s.profilePhone || '';

  const av = document.getElementById('profile-modal-avatar');
  const nm = document.getElementById('profile-modal-name');
  const rl = document.getElementById('profile-modal-role');
  if (av) { av.textContent = getInitials(s.profileName || 'F'); av.className = `profile-modal-avatar ${avatarColor(s.profileName || 'F')}`; }
  if (nm) nm.textContent = s.profileName || 'Freelancer';
  if (rl) rl.textContent = s.profileRole || 'Web Developer';

  openModal('profile-modal');
}

function saveProfileModal() {
  const name  = document.getElementById('pm-name')?.value.trim()  || '';
  const role  = document.getElementById('pm-role')?.value.trim()  || '';
  const phone = document.getElementById('pm-phone')?.value.trim() || '';

  App.data.settings.profileName  = name;
  App.data.settings.profileRole  = role;
  App.data.settings.profilePhone = phone;
  saveData();
  closeModal('profile-modal');
  updateProfileHeader();
  updateGreeting();
  showToast('Profil saqlandi ✓', 'success');
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  updateStats();
  renderOverdueList();
  renderRecentInvoices();
  drawChart();
  showReminderBanner();
  updateBadge();
  updateGreeting();
}

function updateGreeting() {
  const d = new Date();
  const h = d.getHours();
  let greet = 'Salom';
  if (h >= 5 && h < 12) greet = 'Xayrli tong';
  else if (h >= 12 && h < 18) greet = 'Xayrli kun';
  else if (h >= 18 && h < 22) greet = 'Xayrli kech';
  else greet = 'Xayrli tun';

  const name = App.data.settings.profileName || 'Freelancer';
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = `${greet}, ${name} 👋`;

  const dateEl = document.getElementById('header-date');
  if (dateEl) {
    const days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dateEl.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function updateStats() {
  const invoices = App.data.invoices;
  const total   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const pending = invoices.filter(i => i.status === 'pending').reduce((s,i) => s + Number(i.amount), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + Number(i.amount), 0);
  const allPaid = invoices.filter(i => i.status === 'paid').length;
  const allCount = invoices.length;
  const rate = allCount > 0 ? Math.round((allPaid / allCount) * 100) : 0;

  setText('stat-total', formatCurrency(total));
  setText('stat-pending', formatCurrency(pending));
  setText('stat-overdue', formatCurrency(overdue));
  setText('stat-rate', rate + '%');
  setText('stat-total-meta', `${allPaid} ta to'langan invoice`);
  setText('stat-pending-meta', `${invoices.filter(i=>i.status==='pending').length} ta kutilmoqda`);
  setText('stat-overdue-meta', `${invoices.filter(i=>i.status==='overdue').length} ta muddati o'tgan`);
  setText('stat-rate-meta', `${allCount} invoicesdan ${allPaid} tasi`);
}

// ── Clickable stat cards → detail modal ──
function openStatModal(filterType) {
  let title = '';
  let invoices = [];

  switch (filterType) {
    case 'paid':
      title = "To'langan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'paid');
      break;
    case 'pending':
      title = "Kutilayotgan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'pending');
      break;
    case 'overdue':
      title = "Muddati O'tgan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'overdue');
      break;
    default:
      title = 'Barcha Invoicelar';
      invoices = App.data.invoices;
  }

  setText('stat-modal-title', title);

  // Summary
  const total = invoices.reduce((s,i) => s + Number(i.amount), 0);
  const summaryEl = document.getElementById('stat-modal-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="stat-summary-item">
        <span class="stat-summary-val">${invoices.length}</span>
        <span class="stat-summary-label">Jami invoice</span>
      </div>
      <div class="stat-summary-item">
        <span class="stat-summary-val mono" style="color:var(--blue)">${formatCurrency(total)}</span>
        <span class="stat-summary-label">Jami summa</span>
      </div>
      <div class="stat-summary-item">
        <span class="stat-summary-val">${App.data.clients.length > 0 ? new Set(invoices.map(i => i.clientId)).size : 0}</span>
        <span class="stat-summary-label">Mijozlar</span>
      </div>
    `;
  }

  // List
  const listEl = document.getElementById('stat-modal-list');
  if (listEl) {
    if (!invoices.length) {
      listEl.innerHTML = `<div class="empty-state-small">Hozircha invoice yo'q</div>`;
    } else {
      const sorted = [...invoices].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">` +
        sorted.map(inv => `
          <div class="detail-invoice-item" style="cursor:pointer" onclick="closeModal('stat-modal');openInvoiceDetail('${inv.id}')">
            <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
            <span class="inv-name">${getClientName(inv.clientId)} — ${inv.number}${inv.project ? ': ' + inv.project : ''}</span>
            <span class="inv-amount">${formatCurrency(inv.amount)}</span>
            <span style="font-size:.75rem;color:var(--text-muted)">${formatDate(inv.dueDate)}</span>
          </div>
        `).join('') + '</div>';
    }
  }

  openModal('stat-modal');
}

function renderOverdueList() {
  const el = document.getElementById('overdue-list');
  if (!el) return;

  const overdueInvs = App.data.invoices
    .filter(i => i.status === 'overdue')
    .sort((a,b) => daysUntil(a.dueDate) - daysUntil(b.dueDate))
    .slice(0, 5);

  if (!overdueInvs.length) {
    el.innerHTML = `<div class="empty-state-small">Hozircha muddati o'tgan invoice yo'q ✓</div>`;
    return;
  }

  el.innerHTML = overdueInvs.map(inv => {
    const name = getClientName(inv.clientId);
    const days = Math.abs(daysUntil(inv.dueDate));
    return `
      <div class="overdue-item" data-inv="${inv.id}">
        <div class="overdue-avatar">${getInitials(name)}</div>
        <div class="overdue-info">
          <div class="overdue-name">${name}</div>
          <div class="overdue-days">${days} kun muddati o'tdi</div>
        </div>
        <div class="overdue-amount">${formatCurrency(inv.amount)}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.overdue-item').forEach(item => {
    item.addEventListener('click', () => {
      const inv = App.data.invoices.find(i => i.id === item.dataset.inv);
      if (inv) openInvoiceDetail(inv.id);
    });
  });
}

function renderRecentInvoices() {
  const el = document.getElementById('recent-invoices');
  if (!el) return;

  const recent = [...App.data.invoices]
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  if (!recent.length) {
    el.innerHTML = `<div class="empty-state-small">Hali invoice qo'shilmagan. Boshlash uchun "+ Yangi Invoice" tugmasini bosing.</div>`;
    return;
  }

  el.innerHTML = recent.map(inv => `
    <div class="recent-item" data-inv="${inv.id}">
      <div class="recent-info">
        <div class="recent-name">${getClientName(inv.clientId)}</div>
        <div class="recent-project">${inv.project || inv.number}</div>
      </div>
      <div class="recent-right">
        <div class="recent-amount ${inv.status === 'paid' ? 'text-green' : inv.status === 'overdue' ? 'text-red' : 'text-yellow'}">${formatCurrency(inv.amount)}</div>
        <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => openInvoiceDetail(item.dataset.inv));
  });
}

function showReminderBanner() {
  const reminders = checkReminders();
  const banner = document.getElementById('reminder-banner');
  const textEl = document.getElementById('reminder-text');
  if (!banner || !textEl) return;

  if (reminders.length) {
    textEl.textContent = reminders[0];
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function updateBadge() {
  const count = App.data.invoices.filter(i => i.status === 'overdue').length;
  const badge = document.getElementById('overdue-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

// ── CHART ──
function drawChart() {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const W = container.clientWidth || 500;
  const H = 200;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const invoices = App.data.invoices;
  const paid    = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const pending = invoices.filter(i => i.status === 'pending').reduce((s,i) => s + Number(i.amount), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + Number(i.amount), 0);
  const total = paid + pending + overdue;

  ctx.clearRect(0, 0, W, H);

  if (total === 0) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const barH = 44, barY = (H - barH) / 2, barR = 22;
    roundRect(ctx, 40, barY, W - 80, barH, barR, isDark ? '#21262d' : '#f1f5f9');
    ctx.fillStyle = isDark ? '#6e7681' : '#94a3b8';
    ctx.font = '500 13px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText("Invoice qo'shilgandan so'ng grafik ko'rinadi", W / 2, H / 2 + 5);
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#8b949e' : '#64748b';
  const segments = [
    { key: 'paid', val: paid, color: '#22c55e', label: "To'langan" },
    { key: 'pending', val: pending, color: '#f59e0b', label: "Kutilmoqda" },
    { key: 'overdue', val: overdue, color: '#ef4444', label: "O'tgan" }
  ].filter(s => s.val > 0);

  const barH = 44, barY = 40, barX = 40, barW = W - 80, barR = 22;

  roundRect(ctx, barX, barY, barW, barH, barR, isDark ? '#21262d' : '#f1f5f9');

  let x = barX;
  segments.forEach((seg, idx) => {
    const w = (seg.val / total) * barW;
    ctx.save();
    if (idx === 0 && idx === segments.length - 1) {
      roundRect(ctx, x, barY, w, barH, barR, seg.color, true);
    } else if (idx === 0) {
      roundRectLeft(ctx, x, barY, w, barH, barR, seg.color);
    } else if (idx === segments.length - 1) {
      roundRectRight(ctx, x, barY, w, barH, barR, seg.color);
    } else {
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, barY, w, barH);
    }
    ctx.restore();
    x += w;
  });

  const labelY = barY + barH + 22;
  x = barX;
  ctx.textBaseline = 'alphabetic';
  segments.forEach(seg => {
    const w = (seg.val / total) * barW;
    const pct = Math.round((seg.val / total) * 100);
    ctx.fillStyle = seg.color;
    ctx.font = '700 13px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pct + '%', x + w / 2, labelY);
    ctx.fillStyle = textColor;
    ctx.font = '500 11px Plus Jakarta Sans';
    ctx.fillText(seg.label, x + w / 2, labelY + 16);
    x += w;
  });

  ctx.fillStyle = textColor;
  ctx.font = '600 12px Plus Jakarta Sans';
  ctx.textAlign = 'left';
  ctx.fillText('Jami: ' + formatCurrency(total), barX, barY - 14);
  ctx.fillStyle = textColor;
  ctx.font = '500 11px Plus Jakarta Sans';
  ctx.textAlign = 'right';
  ctx.fillText(invoices.length + ' ta invoice', barX + barW, barY - 14);
}

function roundRect(ctx, x, y, w, h, r, color, fill = true) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = color; ctx.fill(); }
}

function roundRectLeft(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function roundRectRight(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

// ═══════════════════════════════════════════
// INVOICES PAGE
// ═══════════════════════════════════════════
function renderInvoices() {
  updateFilterCounts();
  renderInvoiceList();
}

function updateFilterCounts() {
  const invs = App.data.invoices;
  setText('count-all', invs.length);
  setText('count-pending', invs.filter(i => i.status === 'pending').length);
  setText('count-overdue', invs.filter(i => i.status === 'overdue').length);
  setText('count-paid', invs.filter(i => i.status === 'paid').length);
}

function renderInvoiceList() {
  const el = document.getElementById('invoice-list');
  if (!el) return;

  let filtered = App.data.invoices;
  if (App.currentFilter !== 'all') {
    filtered = filtered.filter(i => i.status === App.currentFilter);
  }
  filtered = filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!filtered.length) {
    const msgs = {
      all: "Hali invoice qo'shilmagan. Boshlash uchun yuqoridagi tugmani bosing.",
      pending: "Kutilmoqda invoicelar yo'q.",
      overdue: "Muddati o'tgan invoice yo'q. Ajoyib! ✓",
      paid: "To'langan invoice yo'q."
    };
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><h3>Invoice yo'q</h3><p>${msgs[App.currentFilter]}</p></div>`;
    return;
  }

  el.innerHTML = filtered.map(inv => {
    const clientName = getClientName(inv.clientId);
    const days = daysUntil(inv.dueDate);
    let dueText = formatDate(inv.dueDate);
    if (inv.status !== 'paid') {
      if (days < 0) dueText = `${Math.abs(days)} kun o'tdi`;
      else if (days === 0) dueText = 'Bugun!';
      else if (days === 1) dueText = 'Ertaga!';
    }
    return `
      <div class="invoice-card ${inv.status}" data-id="${inv.id}">
        <div class="invoice-main">
          <div class="invoice-header">
            <span class="invoice-client">${clientName}</span>
            <span class="invoice-number">${inv.number}</span>
            <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
          </div>
          ${inv.project ? `<div class="invoice-project">${inv.project}</div>` : ''}
          <div class="invoice-meta">
            <span>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/></svg>
              ${dueText}
            </span>
          </div>
        </div>
        <div class="invoice-right">
          <div class="invoice-amount">${formatCurrency(inv.amount)}</div>
          <div class="invoice-actions">
            ${inv.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="markAsPaid('${inv.id}')">✓ To'landi</button>` : ''}
            ${inv.status !== 'paid' ? `<button class="btn btn-warning btn-sm" onclick="sendReminder('${inv.id}')">🔔 Eslatma</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="openInvoiceDetail('${inv.id}')">Ko'rish</button>
            <button class="btn btn-ghost btn-sm" onclick="openEditInvoice('${inv.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')">🗑</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── INVOICE CRUD ───
function openAddInvoice() {
  App.editingInvoiceId = null;
  document.getElementById('invoice-modal-title').textContent = 'Yangi Invoice';
  document.getElementById('invoice-edit-id').value = '';
  document.getElementById('invoice-number').value = generateInvoiceNumber();
  document.getElementById('invoice-amount').value = '';
  document.getElementById('invoice-due').value = '';
  document.getElementById('invoice-project').value = '';
  document.getElementById('invoice-status').value = 'pending';
  document.getElementById('invoice-notes').value = '';
  populateClientSelect();
  openModal('invoice-modal');
}

function openEditInvoice(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  App.editingInvoiceId = id;
  document.getElementById('invoice-modal-title').textContent = 'Invoice Tahrirlash';
  document.getElementById('invoice-edit-id').value = id;
  populateClientSelect(inv.clientId);
  document.getElementById('invoice-number').value = inv.number;
  document.getElementById('invoice-amount').value = inv.amount;
  document.getElementById('invoice-due').value = inv.dueDate;
  document.getElementById('invoice-project').value = inv.project || '';
  document.getElementById('invoice-status').value = inv.status;
  document.getElementById('invoice-notes').value = inv.notes || '';
  openModal('invoice-modal');
}

function saveInvoice() {
  const clientId = document.getElementById('invoice-client').value;
  const number   = document.getElementById('invoice-number').value.trim();
  const amount   = document.getElementById('invoice-amount').value;
  const dueDate  = document.getElementById('invoice-due').value;
  const project  = document.getElementById('invoice-project').value.trim();
  const status   = document.getElementById('invoice-status').value;
  const notes    = document.getElementById('invoice-notes').value.trim();

  if (!clientId) return showToast('Iltimos, mijozni tanlang', 'error');
  if (!number)   return showToast("Invoice raqamini kiriting", 'error');
  if (!amount || isNaN(amount) || Number(amount) <= 0) return showToast("To'g'ri summa kiriting", 'error');
  if (!dueDate)  return showToast("To'lov muddatini kiriting", 'error');

  const saveBtn = document.getElementById('save-invoice');
  if (saveBtn) {
    const txt = saveBtn.querySelector('.btn-text');
    const ldr = saveBtn.querySelector('.btn-loader');
    saveBtn.disabled = true;
    if (txt) txt.style.display = 'none';
    if (ldr) ldr.style.display = '';
  }

  setTimeout(() => {
    if (saveBtn) {
      const txt = saveBtn.querySelector('.btn-text');
      const ldr = saveBtn.querySelector('.btn-loader');
      saveBtn.disabled = false;
      if (txt) txt.style.display = '';
      if (ldr) ldr.style.display = 'none';
    }

    if (App.editingInvoiceId) {
      const inv = App.data.invoices.find(i => i.id === App.editingInvoiceId);
      if (inv) {
        inv.clientId = clientId; inv.number = number;
        inv.amount = Number(amount); inv.dueDate = dueDate;
        inv.project = project; inv.status = status; inv.notes = notes;
        inv.updatedAt = new Date().toISOString();
      }
      showToast("Invoice yangilandi ✓", 'success');
    } else {
      const newInv = { id: generateId(), clientId, number, amount: Number(amount), dueDate, project, status, notes, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      App.data.invoices.push(newInv);
      addNotification(`Yangi invoice qo'shildi: ${number} — ${getClientName(clientId)}`, '📄');
      showToast("Yangi invoice qo'shildi ✓", 'success');
    }

    saveData();
    closeModal('invoice-modal');
    renderPage(App.currentPage);
    updateBadge();
  }, 600);
}

function markAsPaid(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString();
  saveData();
  addNotification(`${inv.number} — to'landi! ${formatCurrency(inv.amount)}`, '✅');
  showToast(`${inv.number} — to'langan deb belgilandi ✓`, 'success');
  renderPage(App.currentPage);
  updateBadge();
}

function deleteInvoice(id) {
  confirmDialog("Bu invoiceni o'chirishni istaysizmi?", () => {
    App.data.invoices = App.data.invoices.filter(i => i.id !== id);
    saveData();
    showToast("Invoice o'chirildi", 'warning');
    renderPage(App.currentPage);
    updateBadge();
    closeModal('invoice-detail-modal');
  });
}

function sendReminder(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  const clientName = getClientName(inv.clientId);
  const days = daysUntil(inv.dueDate);
  let msg;
  if (days >= 0) {
    msg = App.data.settings.tplFriendly
      .replace('[MIJOZ_ISM]', clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SANA]', formatDate(inv.dueDate))
      .replace('[SUMMA]', formatCurrency(inv.amount));
  } else if (Math.abs(days) <= 7) {
    msg = App.data.settings.tplWarning
      .replace('[MIJOZ_ISM]', clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SUMMA]', formatCurrency(inv.amount));
  } else {
    msg = App.data.settings.tplFinal
      .replace('[MIJOZ_ISM]', clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SUMMA]', formatCurrency(inv.amount));
  }
  addNotification(`Eslatma yuborildi: ${clientName} — ${inv.number}`, '🔔');
  showToast(`Eslatma yuborildi: ${clientName}`, 'success');
  console.log('[PayBack Reminder]', msg);
}

function generateInvoiceNumber() {
  const count = App.data.invoices.length + 1;
  return `INV-${String(count).padStart(3, '0')}`;
}

function openInvoiceDetail(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  App.viewingInvoiceId = id;
  const clientName = getClientName(inv.clientId);
  const days = daysUntil(inv.dueDate);

  document.getElementById('inv-detail-number').textContent = inv.number;

  const content = document.getElementById('invoice-detail-content');
  content.innerHTML = `
    <div class="inv-detail-item"><div class="inv-detail-label">Mijoz</div><div class="inv-detail-val">${clientName}</div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Summa</div><div class="inv-detail-val mono">${formatCurrency(inv.amount)}</div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Holati</div><div class="inv-detail-val"><span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span></div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Muddati</div><div class="inv-detail-val ${inv.status !== 'paid' && days < 0 ? 'text-red' : ''}">${formatDate(inv.dueDate)}${inv.status !== 'paid' && days < 0 ? ` (${Math.abs(days)} kun o'tdi)` : ''}</div></div>
    ${inv.project ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Loyiha</div><div class="inv-detail-val">${inv.project}</div></div>` : ''}
    <div class="inv-detail-item"><div class="inv-detail-label">Yaratilgan</div><div class="inv-detail-val">${formatDate(inv.createdAt)}</div></div>
    ${inv.paidAt ? `<div class="inv-detail-item"><div class="inv-detail-label">To'langan sana</div><div class="inv-detail-val text-green">${formatDate(inv.paidAt)}</div></div>` : ''}
    ${inv.notes ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Izoh</div><div class="inv-detail-val">${inv.notes}</div></div>` : ''}
  `;

  const actions = document.getElementById('invoice-detail-actions');
  actions.innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('invoice-detail-modal')">Yopish</button>
    <button class="btn btn-ghost btn-sm" onclick="openEditInvoice('${inv.id}'); closeModal('invoice-detail-modal')">✏️ Tahrirlash</button>
    ${inv.status !== 'paid' ? `<button class="btn btn-success" onclick="markAsPaid('${inv.id}'); closeModal('invoice-detail-modal')">✓ To'landi</button>` : ''}
    ${inv.status !== 'paid' ? `<button class="btn btn-warning" onclick="sendReminder('${inv.id}')">🔔 Eslatma</button>` : ''}
    <button class="btn btn-danger" onclick="deleteInvoice('${inv.id}')">🗑</button>
  `;

  openModal('invoice-detail-modal');
}

// ═══════════════════════════════════════════
// CLIENTS PAGE
// ═══════════════════════════════════════════
function renderClients() {
  const el = document.getElementById('clients-grid');
  if (!el) return;

  if (!App.data.clients.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><h3>Mijoz yo'q</h3><p>Birinchi mijozni qo'shish uchun yuqoridagi tugmani bosing</p></div>`;
    return;
  }

  el.innerHTML = App.data.clients.map(client => {
    const invoices = getClientInvoices(client.id);
    const unpaid = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + Number(i.amount), 0);
    const paid   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
    const colorClass = avatarColor(client.name);

    return `
      <div class="client-card" data-id="${client.id}">
        <div class="client-card-header">
          <div class="client-avatar ${colorClass}">${getInitials(client.name)}</div>
          <div style="flex:1;min-width:0">
            <div class="client-name">${client.name}</div>
            ${client.company ? `<div class="client-company">${client.company}</div>` : ''}
            <span class="badge badge-${client.rating}" style="margin-top:4px;display:inline-block">${getRatingLabel(client.rating)}</span>
          </div>
        </div>
        <div class="client-stats">
          <div class="client-stat"><div class="client-stat-val">${invoices.length}</div><div class="client-stat-label">Invoice</div></div>
          <div class="client-stat"><div class="client-stat-val text-green">${formatCurrency(paid)}</div><div class="client-stat-label">To'langan</div></div>
          <div class="client-stat"><div class="client-stat-val client-unpaid">${formatCurrency(unpaid)}</div><div class="client-stat-label">Qarzdorlik</div></div>
        </div>
      </div>`;
  }).join('');

  el.querySelectorAll('.client-card').forEach(card => {
    card.addEventListener('click', () => openClientDetail(card.dataset.id));
  });
}

// ─── CLIENT CRUD ───
function openAddClient() {
  App.editingClientId = null;
  document.getElementById('client-modal-title').textContent = 'Yangi Mijoz';
  document.getElementById('client-edit-id').value = '';
  document.getElementById('client-name').value = '';
  document.getElementById('client-company').value = '';
  document.getElementById('client-email').value = '';
  document.getElementById('client-phone').value = '';
  document.getElementById('client-rating').value = 'reliable';
  document.getElementById('client-notes').value = '';
  openModal('client-modal');
}

function openEditClient(id) {
  const c = App.data.clients.find(c => c.id === id);
  if (!c) return;
  App.editingClientId = id;
  document.getElementById('client-modal-title').textContent = 'Mijoz Tahrirlash';
  document.getElementById('client-edit-id').value = id;
  document.getElementById('client-name').value = c.name;
  document.getElementById('client-company').value = c.company || '';
  document.getElementById('client-email').value = c.email || '';
  document.getElementById('client-phone').value = c.phone || '';
  document.getElementById('client-rating').value = c.rating || 'reliable';
  document.getElementById('client-notes').value = c.notes || '';
  openModal('client-modal');
}

function saveClient() {
  const name    = document.getElementById('client-name').value.trim();
  const company = document.getElementById('client-company').value.trim();
  const email   = document.getElementById('client-email').value.trim();
  const phone   = document.getElementById('client-phone').value.trim();
  const rating  = document.getElementById('client-rating').value;
  const notes   = document.getElementById('client-notes').value.trim();

  if (!name) return showToast('Iltimos, mijoz ismini kiriting', 'error');

  if (App.editingClientId) {
    const c = App.data.clients.find(c => c.id === App.editingClientId);
    if (c) Object.assign(c, { name, company, email, phone, rating, notes, updatedAt: new Date().toISOString() });
    showToast("Mijoz yangilandi ✓", 'success');
  } else {
    App.data.clients.push({ id: generateId(), name, company, email, phone, rating, notes, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    addNotification(`Yangi mijoz qo'shildi: ${name}`, '👤');
    showToast("Yangi mijoz qo'shildi ✓", 'success');
  }

  saveData();
  closeModal('client-modal');
  populateClientSelect();
  renderPage(App.currentPage);
}

function openClientDetail(id) {
  const c = App.data.clients.find(c => c.id === id);
  if (!c) return;
  App.viewingClientId = id;

  const colorClass = avatarColor(c.name);
  const avatarEl = document.getElementById('detail-avatar');
  avatarEl.textContent = getInitials(c.name);
  avatarEl.className = `client-avatar-large ${colorClass}`;

  document.getElementById('detail-client-name').textContent = c.name;
  document.getElementById('detail-client-company').textContent = c.company || '';

  const invoices = getClientInvoices(id);
  const paid   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const unpaid = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + Number(i.amount), 0);

  setText('detail-total', invoices.length);
  setText('detail-paid', formatCurrency(paid));
  setText('detail-unpaid', formatCurrency(unpaid));

  const contactEl = document.getElementById('detail-contact');
  let contactHtml = '';
  if (c.email) contactHtml += `<span class="detail-contact-item">📧 ${c.email}</span>`;
  if (c.phone) contactHtml += `<span class="detail-contact-item">📞 ${c.phone}</span>`;
  contactHtml += `<span class="detail-contact-item badge-${c.rating}" style="padding:5px 10px">${getRatingLabel(c.rating)}</span>`;
  contactEl.innerHTML = contactHtml;

  const listEl = document.getElementById('detail-invoice-list');
  if (invoices.length) {
    listEl.innerHTML = invoices.map(inv => `
      <div class="detail-invoice-item">
        <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
        <span class="inv-name">${inv.number}${inv.project ? ' — ' + inv.project : ''}</span>
        <span class="inv-amount">${formatCurrency(inv.amount)}</span>
        <span style="font-size:.75rem;color:var(--text-muted)">${formatDate(inv.dueDate)}</span>
      </div>`).join('');
  } else {
    listEl.innerHTML = `<div class="empty-state-small">Bu mijoz uchun invoice yo'q</div>`;
  }

  const notesWrap = document.getElementById('detail-notes-wrap');
  if (c.notes) {
    document.getElementById('detail-notes').textContent = c.notes;
    notesWrap.style.display = '';
  } else {
    notesWrap.style.display = 'none';
  }

  openModal('client-detail-modal');
}

function deleteClient(id) {
  confirmDialog("Bu mijozni o'chirmoqchimisiz? Unga bog'liq invoicelar ham o'chiriladi.", () => {
    App.data.clients = App.data.clients.filter(c => c.id !== id);
    App.data.invoices = App.data.invoices.filter(i => i.clientId !== id);
    saveData();
    showToast("Mijoz o'chirildi", 'warning');
    closeModal('client-detail-modal');
    renderPage(App.currentPage);
    populateClientSelect();
    updateBadge();
  });
}

function getClientInvoices(clientId) {
  return App.data.invoices.filter(i => i.clientId === clientId);
}

function getClientName(clientId) {
  const c = App.data.clients.find(c => c.id === clientId);
  return c ? c.name : "Noma'lum";
}

function populateClientSelect(selectedId = '') {
  const sel = document.getElementById('invoice-client');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Mijozni tanlang —</option>' +
    App.data.clients.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('');
}

// ═══════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════
function renderSettings() {
  const s = App.data.settings;
  setChecked('auto-1day', s.auto1day !== false);
  setChecked('auto-3days', s.auto3days !== false);
  setChecked('auto-7days', !!s.auto7days);
  setChecked('settings-dark-toggle', document.documentElement.getAttribute('data-theme') === 'dark');

  const el = id => document.getElementById(id);
  if (el('tpl-friendly')) el('tpl-friendly').value = s.tplFriendly || getDefaultTemplate('friendly');
  if (el('tpl-warning'))  el('tpl-warning').value  = s.tplWarning  || getDefaultTemplate('warning');
  if (el('tpl-final'))    el('tpl-final').value    = s.tplFinal    || getDefaultTemplate('final');
  if (el('profile-name'))  el('profile-name').value  = s.profileName  || '';
  if (el('profile-role'))  el('profile-role').value  = s.profileRole  || '';
  if (el('profile-phone')) el('profile-phone').value = s.profilePhone || '';
}

function saveSettings() {
  const s = App.data.settings;
  s.auto1day  = document.getElementById('auto-1day')?.checked ?? true;
  s.auto3days = document.getElementById('auto-3days')?.checked ?? true;
  s.auto7days = document.getElementById('auto-7days')?.checked ?? false;
  s.tplFriendly = document.getElementById('tpl-friendly')?.value || '';
  s.tplWarning  = document.getElementById('tpl-warning')?.value  || '';
  s.tplFinal    = document.getElementById('tpl-final')?.value    || '';
  saveData();
}

function saveProfile() {
  App.data.settings.profileName  = document.getElementById('profile-name')?.value.trim()  || '';
  App.data.settings.profileRole  = document.getElementById('profile-role')?.value.trim()  || '';
  App.data.settings.profilePhone = document.getElementById('profile-phone')?.value.trim() || '';
  saveData();
  showToast("Profil saqlandi ✓", 'success');
  updateGreeting();
  updateProfileHeader();
}

function getDefaultTemplate(type) {
  const t = {
    friendly: "Salom [MIJOZ_ISM]! Sizning [INVOICE_RAQAM] raqamli invoicengiz muddati [SANA] da tugaydi. Iltimos, o'z vaqtida to'lovni amalga oshiring. Rahmat! 🙏",
    warning:  "Salom [MIJOZ_ISM], [INVOICE_RAQAM] raqamli invoicengiz muddati o'tdi. Iltimos, imkon qadar tezroq [SUMMA] ni to'lang. Muammo bo'lsa, bog'laning. ⚠️",
    final:    "Hurmatli [MIJOZ_ISM], [INVOICE_RAQAM] raqamli [SUMMA] miqdoridagi invoice 7 kundan ko'proq muddati o'tdi. Bu yakuniy eslatma. 🚨"
  };
  return t[type] || '';
}

// ═══════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  App.data.settings.darkMode = dark;
  const toggle = document.getElementById('settings-dark-toggle');
  if (toggle) toggle.checked = dark;
  if (App.currentPage === 'dashboard') drawChart();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  saveData();
}

// ═══════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
}

function confirmDialog(message, callback) {
  document.getElementById('confirm-message').textContent = message;
  App.confirmCallback = callback;
  openModal('confirm-modal');
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

// ═══════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════
function seedDemoData() {
  if (App.data.clients.length || App.data.invoices.length) return;

  const clients = [
    { id: generateId(), name: 'Alisher Karimov', company: 'TechStart UZ', email: 'alisher@techstart.uz', phone: '+998 90 123 45 67', rating: 'reliable', notes: "Doimo o'z vaqtida to'laydi.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'Nilufar Tosheva', company: 'Design Studio', email: 'nilufar@ds.uz', phone: '+998 91 234 56 78', rating: 'medium', notes: "Ba'zan kechikadi.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'Bobur Rahimov', company: '', email: 'bobur@gmail.com', phone: '+998 93 345 67 89', rating: 'risky', notes: "Avvalgi loyihada kech to'lagan.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: generateId(), name: 'Sarvinoz Umarova', company: 'MarketPro', email: 'sarvinoz@mp.uz', phone: '+998 99 456 78 90', rating: 'reliable', notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  App.data.clients = clients;

  const today = new Date();
  const days = (d) => { const x = new Date(today); x.setDate(x.getDate() + d); return x.toISOString().split('T')[0]; };

  App.data.invoices = [
    { id: generateId(), clientId: clients[0].id, number: 'INV-001', amount: 3500000, dueDate: days(-15), project: 'Veb-sayt ishlanmasi', status: 'paid', notes: '', createdAt: days(-30), updatedAt: days(-15), paidAt: days(-15) },
    { id: generateId(), clientId: clients[1].id, number: 'INV-002', amount: 1800000, dueDate: days(-5), project: 'Logotip dizayni', status: 'overdue', notes: "Bir marta eslatildi", createdAt: days(-20), updatedAt: new Date().toISOString() },
    { id: generateId(), clientId: clients[2].id, number: 'INV-003', amount: 4200000, dueDate: days(-10), project: 'Mobil ilova UI', status: 'overdue', notes: '', createdAt: days(-25), updatedAt: new Date().toISOString() },
    { id: generateId(), clientId: clients[3].id, number: 'INV-004', amount: 2100000, dueDate: days(7), project: 'SEO optimallashtirish', status: 'pending', notes: '', createdAt: days(-5), updatedAt: new Date().toISOString() },
    { id: generateId(), clientId: clients[0].id, number: 'INV-005', amount: 5000000, dueDate: days(14), project: 'E-Commerce platformasi', status: 'pending', notes: '', createdAt: days(-3), updatedAt: new Date().toISOString() },
    { id: generateId(), clientId: clients[1].id, number: 'INV-006', amount: 900000, dueDate: days(1), project: 'Banner dizayni', status: 'pending', notes: '', createdAt: days(-7), updatedAt: new Date().toISOString() },
  ];

  App.data.settings.tplFriendly = getDefaultTemplate('friendly');
  App.data.settings.tplWarning  = getDefaultTemplate('warning');
  App.data.settings.tplFinal    = getDefaultTemplate('final');
  App.data.settings.profileName = 'Freelancer';

  saveData();
}

// ═══════════════════════════════════════════
// EVENT LISTENERS (APP)
// ═══════════════════════════════════════════
function initEvents() {
  // Navigation (sidebar + bottom nav)
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.id === 'mobile-add-btn') return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Dashboard card-action links
  document.querySelectorAll('.card-action[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Theme toggles
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Settings dark mode toggle
  document.getElementById('settings-dark-toggle')?.addEventListener('change', (e) => {
    applyTheme(e.target.checked);
    saveData();
  });

  // Quick add (dashboard)
  document.getElementById('quick-add-btn')?.addEventListener('click', openAddInvoice);

  // Add invoice button
  document.getElementById('add-invoice-btn')?.addEventListener('click', openAddInvoice);

  // Mobile add
  document.getElementById('mobile-add-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAddInvoice();
  });

  // Add client button
  document.getElementById('add-client-btn')?.addEventListener('click', openAddClient);

  // Invoice modal
  document.getElementById('close-invoice-modal')?.addEventListener('click', () => closeModal('invoice-modal'));
  document.getElementById('cancel-invoice')?.addEventListener('click', () => closeModal('invoice-modal'));
  document.getElementById('save-invoice')?.addEventListener('click', saveInvoice);

  // Client modal
  document.getElementById('close-client-modal')?.addEventListener('click', () => closeModal('client-modal'));
  document.getElementById('cancel-client')?.addEventListener('click', () => closeModal('client-modal'));
  document.getElementById('save-client')?.addEventListener('click', saveClient);

  // Client detail modal
  document.getElementById('close-client-detail')?.addEventListener('click', () => closeModal('client-detail-modal'));
  document.getElementById('edit-client-from-detail')?.addEventListener('click', () => {
    if (App.viewingClientId) { closeModal('client-detail-modal'); openEditClient(App.viewingClientId); }
  });
  document.getElementById('delete-client-btn')?.addEventListener('click', () => {
    if (App.viewingClientId) deleteClient(App.viewingClientId);
  });

  // Invoice detail modal
  document.getElementById('close-invoice-detail')?.addEventListener('click', () => closeModal('invoice-detail-modal'));

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      App.currentFilter = tab.dataset.filter;
      renderInvoiceList();
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
      }
    });
  });

  // Confirm dialog
  document.getElementById('confirm-cancel')?.addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    if (App.confirmCallback) { App.confirmCallback(); App.confirmCallback = null; }
    closeModal('confirm-modal');
  });

  // Reminder close
  document.getElementById('reminder-close')?.addEventListener('click', () => {
    const banner = document.getElementById('reminder-banner');
    if (banner) banner.style.display = 'none';
  });

  // Settings save
  document.getElementById('save-templates-btn')?.addEventListener('click', () => {
    saveSettings();
    showToast("Shablonlar saqlandi ✓", 'success');
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

  document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      if (toggle.id !== 'settings-dark-toggle') saveSettings();
    });
  });

  // Keyboard: close modal/dropdown on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      const open = document.querySelector('.modal-overlay.open');
      if (open) {
        open.classList.remove('open');
        if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
      }
    }
  });

  // Click outside closes dropdowns
  document.addEventListener('click', (e) => {
    const notifWrap = document.getElementById('notif-wrap');
    const profileWrap = document.getElementById('profile-wrap');
    if (notifWrap && !notifWrap.contains(e.target)) {
      document.getElementById('notif-dropdown')?.classList.remove('open');
    }
    if (profileWrap && !profileWrap.contains(e.target)) {
      document.getElementById('profile-dropdown')?.classList.remove('open');
    }
  });

  // Resize: redraw chart
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (App.currentPage === 'dashboard') drawChart();
    }, 150);
  });
}

// ═══════════════════════════════════════════
// INIT APP UI (called after login)
// ═══════════════════════════════════════════
function initAppUI() {
  loadData();
  seedDemoData();
  autoUpdateStatuses();
  buildNotificationsFromInvoices();
  applyTheme(!!App.data.settings.darkMode);
  initEvents();
  populateClientSelect();
  updateProfileHeader();
  updateNotifBadge();
  navigateTo('dashboard');
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
function init() {
  // Hide loader after short delay
  setTimeout(() => {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');

    // Apply saved theme (even on landing)
    loadData();
    applyTheme(!!App.data.settings.darkMode);

    // Check if already logged in
    const auth = loadAuthState();
    if (auth) {
      showApp();
      initAppUI();
    } else {
      showLanding();
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════
// PAYMENT SYSTEM
// ═══════════════════════════════════════════

/**
 * getUserPlan() — returns the current active subscription plan or null
 */
function getUserPlan() {
  const raw = localStorage.getItem('offpay_subscription');
  if (!raw) return null;
  try {
    const sub = JSON.parse(raw);
    if (sub && sub.status === 'active') return sub;
  } catch (e) {}
  return null;
}

function saveUserPlan(plan, price) {
  const sub = {
    plan,
    price,
    status: 'active',
    date: new Date().toISOString()
  };
  // Save to localStorage
  localStorage.setItem('offpay_subscription', JSON.stringify(sub));
  // Also append to payment history array
  const histRaw = localStorage.getItem('offpay_payment_history');
  let hist = [];
  try { hist = histRaw ? JSON.parse(histRaw) : []; } catch(e) {}
  hist.unshift({ plan, price, date: new Date().toISOString(), status: 'paid' });
  localStorage.setItem('offpay_payment_history', JSON.stringify(hist.slice(0, 20)));
}

function getPaymentHistory() {
  const raw = localStorage.getItem('offpay_payment_history');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch(e) { return []; }
}

// Plan prices map
const PLAN_PRICES = { Basic: 3, Pro: 5, Business: 15 };

// Open payment modal, optionally pre-select a plan
function openPaymentModal(plan) {
  const defaultPlan = plan || 'Pro';
  // Highlight the right card
  document.querySelectorAll('.plan-selector-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === defaultPlan);
  });
  updatePaymentSummary(defaultPlan, PLAN_PRICES[defaultPlan] || 5);
  openModal('payment-modal');
}

function selectPaymentPlan(el) {
  document.querySelectorAll('.plan-selector-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  updatePaymentSummary(el.dataset.plan, Number(el.dataset.price));
}

function updatePaymentSummary(planName, price) {
  const summaryPlan = document.getElementById('summary-plan-name');
  const summaryAmt  = document.getElementById('summary-amount');
  const summaryTot  = document.getElementById('summary-total');
  if (summaryPlan) summaryPlan.textContent = planName;
  if (summaryAmt)  summaryAmt.textContent  = `$${price}.00`;
  if (summaryTot)  summaryTot.textContent  = `$${price}.00`;
}

// Card number auto-format: 1234 5678 9012 3456
function formatCardNumber(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

// Expiry auto-format: MM/YY
function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
  input.value = v;
}

function validatePaymentForm() {
  const cardNum  = (document.getElementById('pay-card-number')?.value || '').replace(/\s/g,'');
  const expiry   = document.getElementById('pay-expiry')?.value || '';
  const cvv      = document.getElementById('pay-cvv')?.value || '';
  const holder   = (document.getElementById('pay-holder')?.value || '').trim();

  if (cardNum.length < 16) {
    showToast("To'liq karta raqamini kiriting", 'error'); return false;
  }
  if (!expiry.match(/^\d{2}\/\d{2}$/)) {
    showToast("Amal qilish muddatini kiriting (MM/YY)", 'error'); return false;
  }
  // Check not expired
  const [mm, yy] = expiry.split('/').map(Number);
  const now = new Date();
  const expDate = new Date(2000 + yy, mm - 1, 1);
  if (expDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
    showToast("Karta muddati o'tib ketgan", 'error'); return false;
  }
  if (cvv.length < 3) {
    showToast("CVV kodni kiriting", 'error'); return false;
  }
  if (!holder || holder.length < 3) {
    showToast("Karta egasining ismini kiriting", 'error'); return false;
  }
  return true;
}

function handlePaymentSubmit() {
  if (!validatePaymentForm()) return;

  // Get selected plan
  const selectedCard = document.querySelector('.plan-selector-card.selected');
  const planName = selectedCard ? selectedCard.dataset.plan : 'Pro';
  const planPrice = Number(selectedCard ? selectedCard.dataset.price : 5);

  // Disable button & show loader
  const btn = document.getElementById('payment-submit-btn');
  if (btn) {
    btn.disabled = true;
    const txt = btn.querySelector('.btn-text');
    const ldr = btn.querySelector('.btn-loader');
    if (txt) txt.style.display = 'none';
    if (ldr) ldr.style.display = 'flex';
  }

  // Simulate API call
  setTimeout(() => {
    // Re-enable button
    if (btn) {
      btn.disabled = false;
      const txt = btn.querySelector('.btn-text');
      const ldr = btn.querySelector('.btn-loader');
      if (txt) txt.style.display = '';
      if (ldr) ldr.style.display = 'none';
    }

    // Save subscription
    saveUserPlan(planName, planPrice);

    // Close modal
    closeModal('payment-modal');

    // Show success toast
    showToast("To'lov muvaffaqiyatli amalga oshirildi 🎉", 'success');

    // Add notifications
    addNotification('Obuna faollashtirildi — ' + planName + ' reja', '🚀');
    addNotification("To'lov muvaffaqiyatli qabul qilindi ($" + planPrice + ")", '✅');

    // Update all UI elements that show plan
    updatePlanUI();

    // Clear form
    ['pay-card-number','pay-expiry','pay-cvv','pay-holder'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }, 2000);
}

function updatePlanUI() {
  const sub = getUserPlan();
  const planName = sub ? sub.plan : 'Bepul';
  const isActive = !!sub;

  // Dashboard badge
  const dbBadge = document.getElementById('dashboard-plan-badge');
  const dbText  = document.getElementById('dashboard-plan-text');
  if (dbBadge) dbBadge.classList.toggle('active-plan', isActive);
  if (dbText) dbText.textContent = planName + ' reja';

  // Profile modal badge
  const profileBadge = document.getElementById('profile-current-plan');
  if (profileBadge) {
    profileBadge.textContent = planName;
    profileBadge.className = 'profile-current-plan-badge';
    if (planName === 'Pro') profileBadge.classList.add('plan-pro');
    if (planName === 'Business') profileBadge.classList.add('plan-business');
  }

  // Payment history in profile
  renderPaymentHistory();
}

function renderPaymentHistory() {
  const wrap = document.getElementById('profile-payment-history');
  if (!wrap) return;
  const history = getPaymentHistory();
  if (!history.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = `
    <div class="payment-history-title">💳 To'lov tarixi</div>
    ${history.slice(0, 5).map(h => `
      <div class="payment-history-item">
        <div>
          <div class="phi-plan">${h.plan} reja</div>
          <div class="phi-date">${formatDate(h.date)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="phi-amount">$${h.price}.00</span>
          <span class="phi-status">✓ To'landi</span>
        </div>
      </div>
    `).join('')}
  `;
}

// ─── Patch navigateToProfile to also show plan info ───
const _origNavigateToProfile = navigateToProfile;
navigateToProfile = function() {
  _origNavigateToProfile();
  updatePlanUI();
};

// ─── Patch initAppUI to update plan UI on load ───
const _origInitAppUI = initAppUI;
initAppUI = function() {
  _origInitAppUI();
  updatePlanUI();
};

