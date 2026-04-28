

/* ══════════════════════════════════════════
   PayBack — To'lov Tiklash Tizimi
   Full Application Logic v4.0 — Supabase Edition
   ══════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════
const SUPABASE_URL     = 'https://mzrjabmppzghdzuifjpn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16cmphYm1wcHpnaGR6dWlmanBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzMzMDgsImV4cCI6MjA5MjkwOTMwOH0.Dd4ehk_ehDRCCaWdRZPfSGFWg8tdcMi9uNyv_EjaR6E';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
const App = {
  user:     null,
  profile:  null,
  invoices: [],
  clients:  [],
  settings: {
    auto1day:     true,
    auto3days:    true,
    auto7days:    false,
    darkMode:     false,
    profileRole:  '',
    profilePhone: '',
    tplFriendly:  '',
    tplWarning:   '',
    tplFinal:     ''
  },
  notifications:     [],
  currentPage:       'dashboard',
  currentFilter:     'all',
  editingInvoiceId:  null,
  editingClientId:   null,
  viewingClientId:   null,
  viewingInvoiceId:  null,
  confirmCallback:   null,
  appInitialized:    false
};

// ═══════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════
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
  if (!dateStr) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0);
  return Math.floor((due - today) / 86400000);
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(str) {
  let hash = 0;
  for (const c of (str || '')) hash = (hash << 5) - hash + c.charCodeAt(0);
  return 'avatar-color-' + (Math.abs(hash) % 8);
}

function getStatusLabel(status) {
  const map = { paid: "To'langan", pending: 'Kutilmoqda', overdue: "Muddati o'tgan" };
  return map[status] || status;
}

function getRatingLabel(r) {
  const map = { reliable: '🟢 Ishonchli', medium: "🟡 O'rtacha", risky: '🔴 Xavfli' };
  return map[r] || r;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Hozir';
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} soat oldin`;
  return `${Math.floor(hrs / 24)} kun oldin`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.style.display   = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? ''     : 'none';
}

// ═══════════════════════════════════════════
// OVERDUE CALCULATION (UI-only — never writes to DB)
// ═══════════════════════════════════════════
function resolveInvoiceStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (daysUntil(inv.due_date) < 0) return 'overdue';
  return inv.status;
}

function getEffectiveInvoices() {
  return App.invoices.map(inv => ({
    ...inv,
    status: resolveInvoiceStatus(inv)
  }));
}

// ═══════════════════════════════════════════
// UI VISIBILITY
// ═══════════════════════════════════════════
function showLanding() {
  document.getElementById('landing-page').style.display = '';
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'none';
}

function showLogin() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'grid';
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-form').style.display   = '';
  document.getElementById('signup-form').style.display  = 'none';
}

function showSignup() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'grid';
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-form').style.display   = 'none';
  document.getElementById('signup-form').style.display  = '';
}

function showApp() {
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════
async function handleSignup() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;

  if (!name)                    return showToast('Ismingizni kiriting', 'error');
  if (!email)                   return showToast('Email kiriting', 'error');
  if (!pass || pass.length < 6) return showToast("Parol kamida 6 ta belgi bo'lishi kerak", 'error');

  setButtonLoading('signup-btn', true);
  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error;

    if (!data.user) {
      showToast("Ro'yxatdan o'tish uchun emailingizni tasdiqlang 📧", 'success');
      return;
    }

    const { error: profileErr } = await sb
      .from('profiles')
      .insert({ id: data.user.id, name });
    if (profileErr) throw profileErr;

    App.user    = data.user;
    App.profile = { id: data.user.id, name };
    App.settings.profileRole  = '';
    App.settings.profilePhone = '';

    await _postLoginSetup();
    showToast(`Hisob yaratildi! Xush kelibsiz, ${name}! 🎉`, 'success');
  } catch (err) {
    console.error('[Signup]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  } finally {
    setButtonLoading('signup-btn', false);
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  if (!email) return showToast('Email kiriting', 'error');
  if (!pass)  return showToast('Parol kiriting', 'error');

  setButtonLoading('login-btn', true);
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    App.user = data.user;
    await _postLoginSetup();
    showToast('Xush kelibsiz! 👋', 'success');
  } catch (err) {
    console.error('[Login]', err);
    showToast(err.message || "Login yoki parol noto'g'ri", 'error');
  } finally {
    setButtonLoading('login-btn', false);
  }
}

async function handleLogout() {
  closeAllDropdowns();
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  } catch (err) {
    console.error('[Logout]', err);
  }
  App.user           = null;
  App.profile        = null;
  App.clients        = [];
  App.invoices       = [];
  App.notifications  = [];
  App.appInitialized = false;
  showLanding();
  showToast('Tizimdan chiqdingiz', 'warning');
}

async function _postLoginSetup() {
  await Promise.all([loadProfile(), loadAllData()]);
  showApp();
  initAppUI();
}

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════
async function loadProfile() {
  if (!App.user) return;

  try {
    const { data, error } = await sb
  .from('profiles')
  .select('*')
  .eq('id', App.user.id)
  .maybeSingle(); // ✅ SHUNI QO‘YASAN

    if (error) throw error;

    App.profile = data;
    if (data.role)  App.settings.profileRole  = data.role;
    if (data.phone) App.settings.profilePhone = data.phone;
    if (data.settings) {
      try { Object.assign(App.settings, JSON.parse(data.settings)); } catch (_) {}
    }
  } catch (err) {
    console.error('[loadProfile]', err);
  }
}

async function saveProfile() {
  if (!App.user) return showToast('Foydalanuvchi topilmadi', 'error');

  const name  = document.getElementById('profile-name')?.value.trim()  || '';
  const role  = document.getElementById('profile-role')?.value.trim()  || '';
  const phone = document.getElementById('profile-phone')?.value.trim() || '';

  const settingsJson = JSON.stringify({
    auto1day:    App.settings.auto1day,
    auto3days:   App.settings.auto3days,
    auto7days:   App.settings.auto7days,
    darkMode:    App.settings.darkMode,
    tplFriendly: App.settings.tplFriendly,
    tplWarning:  App.settings.tplWarning,
    tplFinal:    App.settings.tplFinal
  });

  try {
    const { error } = await sb
      .from('profiles')
      .update({ name, role, phone, settings: settingsJson })
      .eq('id', App.user.id);

    if (error) throw error;

    App.profile = { ...App.profile, name, role, phone };
    App.settings.profileRole  = role;
    App.settings.profilePhone = phone;

    showToast('Profil saqlandi ✓', 'success');
    updateGreeting();
    updateProfileHeader();
  } catch (err) {
    console.error('[saveProfile]', err);
    showToast(err.message || 'Saqlashda xatolik', 'error');
  }
}

async function saveProfileModal() {
  if (!App.user) return;

  const name  = document.getElementById('pm-name')?.value.trim()  || '';
  const role  = document.getElementById('pm-role')?.value.trim()  || '';
  const phone = document.getElementById('pm-phone')?.value.trim() || '';

  try {
    const { error } = await sb
      .from('profiles')
      .update({ name, role, phone })
      .eq('id', App.user.id);

    if (error) throw error;

    App.profile = { ...App.profile, name, role, phone };
    App.settings.profileRole  = role;
    App.settings.profilePhone = phone;

    closeModal('profile-modal');
    updateProfileHeader();
    updateGreeting();
    showToast('Profil saqlandi ✓', 'success');
  } catch (err) {
    console.error('[saveProfileModal]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

function updateProfileHeader() {
  const name     = App.profile?.name || 'F';
  const initials = getInitials(name);
  const email    = App.user?.email || '';

  const headerAvatar = document.getElementById('header-avatar');
  const pdAvatar     = document.getElementById('pd-avatar');
  const pdName       = document.getElementById('pd-name');
  const pdEmail      = document.getElementById('pd-email');

  if (headerAvatar) { headerAvatar.textContent = initials; headerAvatar.className = `header-avatar ${avatarColor(name)}`; }
  if (pdAvatar)     { pdAvatar.textContent = initials;     pdAvatar.className = `pd-avatar ${avatarColor(name)}`; }
  if (pdName)  pdName.textContent  = name;
  if (pdEmail) pdEmail.textContent = email;
}

function navigateToProfile() {
  const s = App.settings;
  const pmName  = document.getElementById('pm-name');
  const pmRole  = document.getElementById('pm-role');
  const pmPhone = document.getElementById('pm-phone');
  if (pmName)  pmName.value  = App.profile?.name || '';
  if (pmRole)  pmRole.value  = s.profileRole  || '';
  if (pmPhone) pmPhone.value = s.profilePhone || '';

  const av          = document.getElementById('profile-modal-avatar');
  const nm          = document.getElementById('profile-modal-name');
  const rl          = document.getElementById('profile-modal-role');
  const profileName = App.profile?.name || 'Freelancer';
  if (av) { av.textContent = getInitials(profileName); av.className = `profile-modal-avatar ${avatarColor(profileName)}`; }
  if (nm) nm.textContent = profileName;
  if (rl) rl.textContent = s.profileRole || 'Web Developer';

  updatePlanUI();
  openModal('profile-modal');
}

// ═══════════════════════════════════════════
// DATA LOADING (scoped to auth user via RLS)
// ═══════════════════════════════════════════
async function loadAllData() {
  await Promise.all([loadClients(), loadInvoices()]);
}

async function loadClients() {
  if (!App.user) return;

  try {
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .eq('user_id', App.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    App.clients = data || [];
  } catch (err) {
    console.error('[loadClients]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

async function loadInvoices() {
  if (!App.user) return;

  try {
    const { data, error } = await sb
      .from('invoices')
      .select('*')
      .eq('user_id', App.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Overdue status is computed on the frontend only (resolveInvoiceStatus).
    // We intentionally do NOT write overdue status back to the DB from here.
    App.invoices = data || [];
  } catch (err) {
    console.error('[loadInvoices]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

// ═══════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════
async function saveClient() {
  const name    = document.getElementById('client-name').value.trim();
  const company = document.getElementById('client-company').value.trim();
  const email   = document.getElementById('client-email').value.trim();
  const phone   = document.getElementById('client-phone').value.trim();
  const status  = document.getElementById('client-rating')?.value || 'reliable';
  const notes   = document.getElementById('client-notes').value.trim();

  if (!name) return showToast('Iltimos, mijoz ismini kiriting', 'error');
  if (!App.user) return showToast('Autentifikatsiya xatosi', 'error');

  setButtonLoading('save-client', true);
  try {
    if (App.editingClientId) {
      const { data, error } = await sb
        .from('clients')
        .update({ name, company, email, phone, status, description: notes })
        .eq('id', App.editingClientId)
        .eq('user_id', App.user.id)
        .select()
        .single();

      if (error) throw error;

      const idx = App.clients.findIndex(c => c.id === App.editingClientId);
      if (idx !== -1) App.clients[idx] = data;
      showToast('Mijoz yangilandi ✓', 'success');
    } else {
      const { data, error } = await sb
        .from('clients')
        .insert({ user_id: App.user.id, name, company, email, phone, status, description: notes })
        .select()
        .single();

      if (error) throw error;

      App.clients.unshift(data);
      addNotification(`Yangi mijoz qo'shildi: ${name}`, '👤');
      showToast("Yangi mijoz qo'shildi ✓", 'success');
    }

    closeModal('client-modal');
    populateClientSelect();
    renderPage(App.currentPage);
  } catch (err) {
    console.error('[saveClient]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  } finally {
    setButtonLoading('save-client', false);
  }
}

async function deleteClient(id) {
  confirmDialog("Bu mijozni o'chirmoqchimisiz? Unga bog'liq invoicelar ham o'chiriladi.", async () => {
    if (!App.user) return;

    try {
      await sb.from('invoices').delete().eq('client_id', id).eq('user_id', App.user.id);
      const { error } = await sb.from('clients').delete().eq('id', id).eq('user_id', App.user.id);
      if (error) throw error;

      App.clients  = App.clients.filter(c => c.id !== id);
      App.invoices = App.invoices.filter(i => i.client_id !== id);

      showToast("Mijoz o'chirildi", 'warning');
      closeModal('client-detail-modal');
      renderPage(App.currentPage);
      populateClientSelect();
      updateBadge();
    } catch (err) {
      console.error('[deleteClient]', err);
      showToast(err.message || "O'chirishda xatolik", 'error');
    }
  });
}

// ═══════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════
async function saveInvoice() {
  const clientId = document.getElementById('invoice-client').value;
  const number   = document.getElementById('invoice-number').value.trim();
  const amount   = document.getElementById('invoice-amount').value;
  const dueDate  = document.getElementById('invoice-due').value;
  const project  = document.getElementById('invoice-project').value.trim();
  const status   = document.getElementById('invoice-status').value;
  const notes    = document.getElementById('invoice-notes').value.trim();

  if (!clientId)                                       return showToast('Iltimos, mijozni tanlang', 'error');
  if (!number)                                         return showToast('Invoice raqamini kiriting', 'error');
  if (!amount || isNaN(amount) || Number(amount) <= 0) return showToast("To'g'ri summa kiriting", 'error');
  if (!dueDate)                                        return showToast("To'lov muddatini kiriting", 'error');
  if (!App.user)                                       return showToast('Autentifikatsiya xatosi', 'error');

  setButtonLoading('save-invoice', true);
  try {
    if (App.editingInvoiceId) {
      const { data, error } = await sb
        .from('invoices')
        .update({
          client_id:    clientId,
          number,
          amount:       Number(amount),
          due_date:     dueDate,
          project_name: project,
          status,
          note:         notes
        })
        .eq('id', App.editingInvoiceId)
        .eq('user_id', App.user.id)
        .select()
        .single();

      if (error) throw error;

      const idx = App.invoices.findIndex(i => i.id === App.editingInvoiceId);
      if (idx !== -1) App.invoices[idx] = data;
      showToast('Invoice yangilandi ✓', 'success');
    } else {
      const { data, error } = await sb
        .from('invoices')
        .insert({
          user_id:      App.user.id,
          client_id:    clientId,
          number,
          amount:       Number(amount),
          due_date:     dueDate,
          project_name: project,
          status,
          note:         notes
        })
        .select()
        .single();

      if (error) throw error;

      App.invoices.unshift(data);
      addNotification(`Yangi invoice qo'shildi: ${number} — ${getClientName(clientId)}`, '📄');
      showToast("Yangi invoice qo'shildi ✓", 'success');
    }

    closeModal('invoice-modal');
    renderPage(App.currentPage);
    updateBadge();
  } catch (err) {
    console.error('[saveInvoice]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  } finally {
    setButtonLoading('save-invoice', false);
  }
}

async function markAsPaid(id) {
  if (!App.user) return;

  try {
    const { data, error } = await sb
      .from('invoices')
      .update({ status: 'paid' })
      .eq('id', id)
      .eq('user_id', App.user.id)
      .select()
      .single();

    if (error) throw error;

    const idx = App.invoices.findIndex(i => i.id === id);
    if (idx !== -1) App.invoices[idx] = data;

    addNotification(`${data.number} — to'landi! ${formatCurrency(data.amount)}`, '✅');
    showToast(`${data.number} — to'langan deb belgilandi ✓`, 'success');
    renderPage(App.currentPage);
    updateBadge();
  } catch (err) {
    console.error('[markAsPaid]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

async function deleteInvoice(id) {
  confirmDialog("Bu invoiceni o'chirishni istaysizmi?", async () => {
    if (!App.user) return;

    try {
      const { error } = await sb
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', App.user.id);

      if (error) throw error;

      App.invoices = App.invoices.filter(i => i.id !== id);
      showToast("Invoice o'chirildi", 'warning');
      renderPage(App.currentPage);
      updateBadge();
      closeModal('invoice-detail-modal');
    } catch (err) {
      console.error('[deleteInvoice]', err);
      showToast(err.message || "O'chirishda xatolik", 'error');
    }
  });
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

function updateStats() {
  const invoices = getEffectiveInvoices();
  const total    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pending  = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const overdue  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const allPaid  = invoices.filter(i => i.status === 'paid').length;
  const allCount = invoices.length;
  const rate     = allCount > 0 ? Math.round((allPaid / allCount) * 100) : 0;

  setText('stat-total',        formatCurrency(total));
  setText('stat-pending',      formatCurrency(pending));
  setText('stat-overdue',      formatCurrency(overdue));
  setText('stat-rate',         rate + '%');
  setText('stat-total-meta',   `${allPaid} ta to'langan invoice`);
  setText('stat-pending-meta', `${invoices.filter(i => i.status === 'pending').length} ta kutilmoqda`);
  setText('stat-overdue-meta', `${invoices.filter(i => i.status === 'overdue').length} ta muddati o'tgan`);
  setText('stat-rate-meta',    `${allCount} invoicesdan ${allPaid} tasi`);
}

function renderOverdueList() {
  const el = document.getElementById('overdue-list');
  if (!el) return;

  const overdueInvs = getEffectiveInvoices()
    .filter(i => i.status === 'overdue')
    .sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date))
    .slice(0, 5);

  if (!overdueInvs.length) {
    el.innerHTML = `<div class="empty-state-small">Hozircha muddati o'tgan invoice yo'q ✓</div>`;
    return;
  }

  el.innerHTML = overdueInvs.map(inv => {
    const name = getClientName(inv.client_id);
    const days = Math.abs(daysUntil(inv.due_date));
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
    item.addEventListener('click', () => openInvoiceDetail(item.dataset.inv));
  });
}

function renderRecentInvoices() {
  const el = document.getElementById('recent-invoices');
  if (!el) return;

  const recent = [...getEffectiveInvoices()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  if (!recent.length) {
    el.innerHTML = `<div class="empty-state-small">Hali invoice qo'shilmagan. Boshlash uchun "+ Yangi Invoice" tugmasini bosing.</div>`;
    return;
  }

  el.innerHTML = recent.map(inv => `
    <div class="recent-item" data-inv="${inv.id}">
      <div class="recent-info">
        <div class="recent-name">${getClientName(inv.client_id)}</div>
        <div class="recent-project">${inv.project_name || inv.number}</div>
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

function openStatModal(filterType) {
  let title    = '';
  let invoices = getEffectiveInvoices();

  switch (filterType) {
    case 'paid':    title = "To'langan Invoicelar";      invoices = invoices.filter(i => i.status === 'paid');    break;
    case 'pending': title = 'Kutilayotgan Invoicelar';   invoices = invoices.filter(i => i.status === 'pending'); break;
    case 'overdue': title = "Muddati O'tgan Invoicelar"; invoices = invoices.filter(i => i.status === 'overdue'); break;
    default:        title = 'Barcha Invoicelar';
  }

  setText('stat-modal-title', title);

  const total     = invoices.reduce((s, i) => s + Number(i.amount), 0);
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
        <span class="stat-summary-val">${new Set(invoices.map(i => i.client_id)).size}</span>
        <span class="stat-summary-label">Mijozlar</span>
      </div>
    `;
  }

  const listEl = document.getElementById('stat-modal-list');
  if (listEl) {
    if (!invoices.length) {
      listEl.innerHTML = `<div class="empty-state-small">Hozircha invoice yo'q</div>`;
    } else {
      const sorted = [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto">` +
        sorted.map(inv => `
          <div class="detail-invoice-item" style="cursor:pointer" onclick="closeModal('stat-modal');openInvoiceDetail('${inv.id}')">
            <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
            <span class="inv-name">${getClientName(inv.client_id)} — ${inv.number}${inv.project_name ? ': ' + inv.project_name : ''}</span>
            <span class="inv-amount">${formatCurrency(inv.amount)}</span>
            <span style="font-size:.75rem;color:var(--text-muted)">${formatDate(inv.due_date)}</span>
          </div>
        `).join('') + '</div>';
    }
  }

  openModal('stat-modal');
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
async function saveSettings() {
  const s = App.settings;
  s.auto1day    = document.getElementById('auto-1day')?.checked  ?? true;
  s.auto3days   = document.getElementById('auto-3days')?.checked ?? true;
  s.auto7days   = document.getElementById('auto-7days')?.checked ?? false;
  s.tplFriendly = document.getElementById('tpl-friendly')?.value || '';
  s.tplWarning  = document.getElementById('tpl-warning')?.value  || '';
  s.tplFinal    = document.getElementById('tpl-final')?.value    || '';

  if (!App.user) return;

  try {
    const { error } = await sb
      .from('profiles')
      .update({ settings: JSON.stringify(s) })
      .eq('id', App.user.id);

    if (error) throw error;
  } catch (err) {
    console.error('[saveSettings]', err);
    showToast(err.message || 'Xatolik yuz berdi', 'error');
  }
}

function renderSettings() {
  const s = App.settings;
  setChecked('auto-1day',  s.auto1day  !== false);
  setChecked('auto-3days', s.auto3days !== false);
  setChecked('auto-7days', !!s.auto7days);
  setChecked('settings-dark-toggle', document.documentElement.getAttribute('data-theme') === 'dark');

  const el = id => document.getElementById(id);
  if (el('tpl-friendly')) el('tpl-friendly').value = s.tplFriendly || getDefaultTemplate('friendly');
  if (el('tpl-warning'))  el('tpl-warning').value  = s.tplWarning  || getDefaultTemplate('warning');
  if (el('tpl-final'))    el('tpl-final').value    = s.tplFinal    || getDefaultTemplate('final');
  if (el('profile-name'))  el('profile-name').value  = App.profile?.name || '';
  if (el('profile-role'))  el('profile-role').value  = s.profileRole  || '';
  if (el('profile-phone')) el('profile-phone').value = s.profilePhone || '';
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
// NOTIFICATIONS (UI-only)
// ═══════════════════════════════════════════
function addNotification(text, icon = '🔔') {
  App.notifications.unshift({
    id:        crypto.randomUUID(),
    text,
    icon,
    read:      false,
    createdAt: new Date().toISOString()
  });
  App.notifications = App.notifications.slice(0, 20);
  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = App.notifications.filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent   = unread > 9 ? '9+' : unread;
  badge.style.display = unread > 0 ? 'grid' : 'none';
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const notifs = App.notifications;
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

function clearNotifications() {
  App.notifications = App.notifications.map(n => ({ ...n, read: true }));
  updateNotifBadge();
  renderNotifications();
}

function buildNotificationsFromInvoices() {
  if (App.notifications.length > 0) return;
  checkReminders().forEach(r => {
    const icon = r.startsWith('🚨') ? '🚨' : r.startsWith('⚠️') ? '⚠️' : '⏰';
    App.notifications.push({
      id:        crypto.randomUUID(),
      text:      r.replace(/^[⏰⚠️🚨]\s/, ''),
      icon,
      read:      false,
      createdAt: new Date().toISOString()
    });
  });
  updateNotifBadge();
}

// ═══════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════
function checkReminders() {
  const reminders = [];
  getEffectiveInvoices().forEach(inv => {
    if (inv.status === 'paid') return;
    const days       = daysUntil(inv.due_date);
    const clientName = getClientName(inv.client_id);
    if (days === 1 && App.settings.auto1day) {
      reminders.push(`⏰ "${clientName}" — ${inv.number} muddati ertaga tugaydi!`);
    } else if (days < 0 && days >= -3 && App.settings.auto3days) {
      reminders.push(`⚠️ "${clientName}" — ${inv.number} ${Math.abs(days)} kun muddati o'tdi!`);
    } else if (days < -7 && App.settings.auto7days) {
      reminders.push(`🚨 "${clientName}" — ${inv.number} YAKUNIY OGOHLANTIRISH: ${Math.abs(days)} kun o'tdi!`);
    }
  });
  return reminders;
}

function showReminderBanner() {
  const reminders = checkReminders();
  const banner    = document.getElementById('reminder-banner');
  const textEl    = document.getElementById('reminder-text');
  if (!banner || !textEl) return;
  if (reminders.length) {
    textEl.textContent   = reminders[0];
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function sendReminder(id) {
  const inv = App.invoices.find(i => i.id === id);
  if (!inv) return;
  const clientName = getClientName(inv.client_id);
  const days       = daysUntil(inv.due_date);
  let msg;
  if (days >= 0) {
    msg = (App.settings.tplFriendly || getDefaultTemplate('friendly'))
      .replace('[MIJOZ_ISM]',     clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SANA]',          formatDate(inv.due_date))
      .replace('[SUMMA]',         formatCurrency(inv.amount));
  } else if (Math.abs(days) <= 7) {
    msg = (App.settings.tplWarning || getDefaultTemplate('warning'))
      .replace('[MIJOZ_ISM]',     clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SUMMA]',         formatCurrency(inv.amount));
  } else {
    msg = (App.settings.tplFinal || getDefaultTemplate('final'))
      .replace('[MIJOZ_ISM]',     clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SUMMA]',         formatCurrency(inv.amount));
  }
  addNotification(`Eslatma yuborildi: ${clientName} — ${inv.number}`, '🔔');
  showToast(`Eslatma yuborildi: ${clientName}`, 'success');
  console.log('[PayBack Reminder]', msg);
}

// ═══════════════════════════════════════════
// INVOICES PAGE
// ═══════════════════════════════════════════
function renderInvoices() {
  updateFilterCounts();
  renderInvoiceList();
}

function updateFilterCounts() {
  const invs = getEffectiveInvoices();
  setText('count-all',     invs.length);
  setText('count-pending', invs.filter(i => i.status === 'pending').length);
  setText('count-overdue', invs.filter(i => i.status === 'overdue').length);
  setText('count-paid',    invs.filter(i => i.status === 'paid').length);
}

function renderInvoiceList() {
  const el = document.getElementById('invoice-list');
  if (!el) return;

  let filtered = getEffectiveInvoices();
  if (App.currentFilter !== 'all') filtered = filtered.filter(i => i.status === App.currentFilter);
  filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!filtered.length) {
    const msgs = {
      all:     "Hali invoice qo'shilmagan. Boshlash uchun yuqoridagi tugmani bosing.",
      pending: "Kutilmoqda invoicelar yo'q.",
      overdue: "Muddati o'tgan invoice yo'q. Ajoyib! ✓",
      paid:    "To'langan invoice yo'q."
    };
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><h3>Invoice yo'q</h3><p>${msgs[App.currentFilter] || ''}</p></div>`;
    return;
  }

  el.innerHTML = filtered.map(inv => {
    const clientName = getClientName(inv.client_id);
    const days       = daysUntil(inv.due_date);
    let dueText      = formatDate(inv.due_date);
    if (inv.status !== 'paid') {
      if (days < 0)       dueText = `${Math.abs(days)} kun o'tdi`;
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
          ${inv.project_name ? `<div class="invoice-project">${inv.project_name}</div>` : ''}
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

function openAddInvoice() {
  App.editingInvoiceId = null;
  setText('invoice-modal-title', 'Yangi Invoice');
  document.getElementById('invoice-edit-id').value  = '';
  document.getElementById('invoice-number').value   = generateInvoiceNumber();
  document.getElementById('invoice-amount').value   = '';
  document.getElementById('invoice-due').value      = '';
  document.getElementById('invoice-project').value  = '';
  document.getElementById('invoice-status').value   = 'pending';
  document.getElementById('invoice-notes').value    = '';
  populateClientSelect();
  openModal('invoice-modal');
}

function openEditInvoice(id) {
  const inv = App.invoices.find(i => i.id === id);
  if (!inv) return;
  App.editingInvoiceId = id;
  setText('invoice-modal-title', 'Invoice Tahrirlash');
  document.getElementById('invoice-edit-id').value   = id;
  populateClientSelect(inv.client_id);
  document.getElementById('invoice-number').value    = inv.number;
  document.getElementById('invoice-amount').value    = inv.amount;
  document.getElementById('invoice-due').value       = inv.due_date;
  document.getElementById('invoice-project').value   = inv.project_name || '';
  document.getElementById('invoice-status').value    = inv.status;
  document.getElementById('invoice-notes').value     = inv.note || '';
  openModal('invoice-modal');
}

function openInvoiceDetail(id) {
  const inv = App.invoices.find(i => i.id === id);
  if (!inv) return;
  App.viewingInvoiceId = id;

  const effective  = resolveInvoiceStatus(inv);
  const clientName = getClientName(inv.client_id);
  const days       = daysUntil(inv.due_date);

  setText('inv-detail-number', inv.number);

  document.getElementById('invoice-detail-content').innerHTML = `
    <div class="inv-detail-item"><div class="inv-detail-label">Mijoz</div><div class="inv-detail-val">${clientName}</div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Summa</div><div class="inv-detail-val mono">${formatCurrency(inv.amount)}</div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Holati</div><div class="inv-detail-val"><span class="badge badge-${effective}">${getStatusLabel(effective)}</span></div></div>
    <div class="inv-detail-item"><div class="inv-detail-label">Muddati</div><div class="inv-detail-val ${effective !== 'paid' && days < 0 ? 'text-red' : ''}">${formatDate(inv.due_date)}${effective !== 'paid' && days < 0 ? ` (${Math.abs(days)} kun o'tdi)` : ''}</div></div>
    ${inv.project_name ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Loyiha</div><div class="inv-detail-val">${inv.project_name}</div></div>` : ''}
    <div class="inv-detail-item"><div class="inv-detail-label">Yaratilgan</div><div class="inv-detail-val">${formatDate(inv.created_at)}</div></div>
    ${inv.note ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Izoh</div><div class="inv-detail-val">${inv.note}</div></div>` : ''}
  `;

  document.getElementById('invoice-detail-actions').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal('invoice-detail-modal')">Yopish</button>
    <button class="btn btn-ghost btn-sm" onclick="openEditInvoice('${inv.id}'); closeModal('invoice-detail-modal')">✏️ Tahrirlash</button>
    ${effective !== 'paid' ? `<button class="btn btn-success" onclick="markAsPaid('${inv.id}'); closeModal('invoice-detail-modal')">✓ To'landi</button>` : ''}
    ${effective !== 'paid' ? `<button class="btn btn-warning" onclick="sendReminder('${inv.id}')">🔔 Eslatma</button>` : ''}
    <button class="btn btn-danger" onclick="deleteInvoice('${inv.id}')">🗑</button>
  `;

  openModal('invoice-detail-modal');
}

function generateInvoiceNumber() {
  const count = App.invoices.length + 1;
  return `INV-${String(count).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════
// CLIENTS PAGE
// ═══════════════════════════════════════════
function renderClients() {
  const el = document.getElementById('clients-grid');
  if (!el) return;

  if (!App.clients.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👥</div><h3>Mijoz yo'q</h3><p>Birinchi mijozni qo'shish uchun yuqoridagi tugmani bosing</p></div>`;
    return;
  }

  const effective = getEffectiveInvoices();

  el.innerHTML = App.clients.map(client => {
    const invoices   = effective.filter(i => i.client_id === client.id);
    const unpaid     = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.amount), 0);
    const paid       = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
    const colorClass = avatarColor(client.name);
    return `
      <div class="client-card" data-id="${client.id}">
        <div class="client-card-header">
          <div class="client-avatar ${colorClass}">${getInitials(client.name)}</div>
          <div style="flex:1;min-width:0">
            <div class="client-name">${client.name}</div>
            ${client.company ? `<div class="client-company">${client.company}</div>` : ''}
            <span class="badge badge-${client.status}" style="margin-top:4px;display:inline-block">${getRatingLabel(client.status)}</span>
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

function openAddClient() {
  App.editingClientId = null;
  setText('client-modal-title', 'Yangi Mijoz');
  ['client-edit-id', 'client-name', 'client-company', 'client-email', 'client-phone', 'client-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const rating = document.getElementById('client-rating');
  if (rating) rating.value = 'reliable';
  openModal('client-modal');
}

function openEditClient(id) {
  const c = App.clients.find(c => c.id === id);
  if (!c) return;
  App.editingClientId = id;
  setText('client-modal-title', 'Mijoz Tahrirlash');
  document.getElementById('client-edit-id').value  = id;
  document.getElementById('client-name').value     = c.name;
  document.getElementById('client-company').value  = c.company    || '';
  document.getElementById('client-email').value    = c.email      || '';
  document.getElementById('client-phone').value    = c.phone      || '';
  document.getElementById('client-rating').value   = c.status     || 'reliable';
  document.getElementById('client-notes').value    = c.description || '';
  openModal('client-modal');
}

function openClientDetail(id) {
  const c = App.clients.find(c => c.id === id);
  if (!c) return;
  App.viewingClientId = id;

  const colorClass = avatarColor(c.name);
  const avatarEl   = document.getElementById('detail-avatar');
  if (avatarEl) {
    avatarEl.textContent = getInitials(c.name);
    avatarEl.className   = `client-avatar-large ${colorClass}`;
  }

  setText('detail-client-name',    c.name);
  setText('detail-client-company', c.company || '');

  const invoices = getEffectiveInvoices().filter(i => i.client_id === id);
  const paid     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const unpaid   = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.amount), 0);

  setText('detail-total',  invoices.length);
  setText('detail-paid',   formatCurrency(paid));
  setText('detail-unpaid', formatCurrency(unpaid));

  const contactEl = document.getElementById('detail-contact');
  if (contactEl) {
    let contactHtml = '';
    if (c.email) contactHtml += `<span class="detail-contact-item">📧 ${c.email}</span>`;
    if (c.phone) contactHtml += `<span class="detail-contact-item">📞 ${c.phone}</span>`;
    contactHtml += `<span class="detail-contact-item badge-${c.status}" style="padding:5px 10px">${getRatingLabel(c.status)}</span>`;
    contactEl.innerHTML = contactHtml;
  }

  const listEl = document.getElementById('detail-invoice-list');
  if (listEl) {
    listEl.innerHTML = invoices.length
      ? invoices.map(inv => `
          <div class="detail-invoice-item">
            <span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span>
            <span class="inv-name">${inv.number}${inv.project_name ? ' — ' + inv.project_name : ''}</span>
            <span class="inv-amount">${formatCurrency(inv.amount)}</span>
            <span style="font-size:.75rem;color:var(--text-muted)">${formatDate(inv.due_date)}</span>
          </div>`).join('')
      : `<div class="empty-state-small">Bu mijoz uchun invoice yo'q</div>`;
  }

  const notesWrap = document.getElementById('detail-notes-wrap');
  if (notesWrap) {
    if (c.description) {
      setText('detail-notes', c.description);
      notesWrap.style.display = '';
    } else {
      notesWrap.style.display = 'none';
    }
  }

  openModal('client-detail-modal');
}

function getClientInvoices(clientId) {
  return App.invoices.filter(i => i.client_id === clientId);
}

function getClientName(clientId) {
  const c = App.clients.find(c => c.id === clientId);
  return c ? c.name : "Noma'lum";
}

function populateClientSelect(selectedId = '') {
  const sel = document.getElementById('invoice-client');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Mijozni tanlang —</option>' +
    App.clients.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('');
}

// ═══════════════════════════════════════════
// DARK MODE
// ═══════════════════════════════════════════
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('payback_theme', dark ? 'dark' : 'light');
  App.settings.darkMode = dark;
  const toggle = document.getElementById('settings-dark-toggle');
  if (toggle) toggle.checked = dark;
  if (App.currentPage === 'dashboard') drawChart();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  saveSettings();
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
    case 'invoices':  renderInvoices();  break;
    case 'clients':   renderClients();   break;
    case 'settings':  renderSettings();  break;
  }
}

function showPageLoader() {
  const mc = document.getElementById('main-content');
  if (mc) { mc.style.opacity = '.5'; mc.style.pointerEvents = 'none'; }
}

function hidePageLoader() {
  const mc = document.getElementById('main-content');
  if (mc) { mc.style.opacity = ''; mc.style.pointerEvents = ''; }
}

function updateGreeting() {
  const d = new Date();
  const h = d.getHours();
  let greet = 'Salom';
  if (h >= 5  && h < 12) greet = 'Xayrli tong';
  else if (h >= 12 && h < 18) greet = 'Xayrli kun';
  else if (h >= 18 && h < 22) greet = 'Xayrli kech';
  else greet = 'Xayrli tun';

  const name = App.profile?.name || 'Freelancer';
  const el   = document.getElementById('greeting-text');
  if (el) el.textContent = `${greet}, ${name} 👋`;

  const dateEl = document.getElementById('header-date');
  if (dateEl) {
    const days   = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dateEl.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function updateBadge() {
  const count = getEffectiveInvoices().filter(i => i.status === 'overdue').length;
  const badge = document.getElementById('overdue-badge');
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle('visible', count > 0);
}

// ═══════════════════════════════════════════
// CANVAS CHART
// ═══════════════════════════════════════════
function drawChart() {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  const ctx       = canvas.getContext('2d');
  const dpr       = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const W         = container.clientWidth || 500;
  const H         = 200;
  canvas.width    = W * dpr;
  canvas.height   = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const invoices = getEffectiveInvoices();
  const paid     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pending  = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const overdue  = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0);
  const total    = paid + pending + overdue;

  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (total === 0) {
    const barH = 44, barY = (H - barH) / 2, barR = 22;
    roundRect(ctx, 40, barY, W - 80, barH, barR, isDark ? '#21262d' : '#f1f5f9');
    ctx.fillStyle = isDark ? '#6e7681' : '#94a3b8';
    ctx.font = '500 13px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText("Invoice qo'shilgandan so'ng grafik ko'rinadi", W / 2, H / 2 + 5);
    return;
  }

  const textColor = isDark ? '#8b949e' : '#64748b';
  const segments  = [
    { val: paid,    color: '#22c55e', label: "To'langan"  },
    { val: pending, color: '#f59e0b', label: 'Kutilmoqda' },
    { val: overdue, color: '#ef4444', label: "O'tgan"     }
  ].filter(s => s.val > 0);

  const barH = 44, barY = 40, barX = 40, barW = W - 80, barR = 22;
  roundRect(ctx, barX, barY, barW, barH, barR, isDark ? '#21262d' : '#f1f5f9');

  let x = barX;
  segments.forEach((seg, idx) => {
    const w = (seg.val / total) * barW;
    ctx.save();
    if (idx === 0 && idx === segments.length - 1)      roundRect(ctx, x, barY, w, barH, barR, seg.color, true);
    else if (idx === 0)                                 roundRectLeft(ctx, x, barY, w, barH, barR, seg.color);
    else if (idx === segments.length - 1)               roundRectRight(ctx, x, barY, w, barH, barR, seg.color);
    else { ctx.fillStyle = seg.color; ctx.fillRect(x, barY, w, barH); }
    ctx.restore();
    x += w;
  });

  const labelY = barY + barH + 22;
  x = barX;
  ctx.textBaseline = 'alphabetic';
  segments.forEach(seg => {
    const w   = (seg.val / total) * barW;
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
  ctx.textAlign = 'right';
  ctx.font = '500 11px Plus Jakarta Sans';
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
  ctx.moveTo(x + r, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function roundRectRight(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

// ═══════════════════════════════════════════
// MODALS  &  TOAST  &  CONFIRM
// ═══════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
}

function confirmDialog(message, callback) {
  const msgEl = document.getElementById('confirm-message');
  if (msgEl) msgEl.textContent = message;
  App.confirmCallback = callback;
  openModal('confirm-modal');
}

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
// DROPDOWN HELPERS
// ═══════════════════════════════════════════
function toggleNotifDropdown(e) {
  e.stopPropagation();
  const dd        = document.getElementById('notif-dropdown');
  const profileDd = document.getElementById('profile-dropdown');
  if (!dd || !profileDd) return;
  profileDd.classList.remove('open');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) renderNotifications();
}

function toggleProfileDropdown(e) {
  e.stopPropagation();
  const dd      = document.getElementById('profile-dropdown');
  const notifDd = document.getElementById('notif-dropdown');
  if (!dd || !notifDd) return;
  notifDd.classList.remove('open');
  dd.classList.toggle('open');
}

function closeAllDropdowns() {
  document.getElementById('notif-dropdown')?.classList.remove('open');
  document.getElementById('profile-dropdown')?.classList.remove('open');
}

// ═══════════════════════════════════════════
// SIDEBAR (Mobile)
// ═══════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

// ═══════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════
function toggleLandingMenu() {
  document.getElementById('landing-mobile-menu')?.classList.toggle('open');
}

function closeLandingMenu() {
  document.getElementById('landing-mobile-menu')?.classList.remove('open');
}

function togglePasswordVis(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ═══════════════════════════════════════════
// PAYMENT SYSTEM  (subscription stays in localStorage)
// ═══════════════════════════════════════════
const PLAN_PRICES = { Basic: 3, Pro: 5, Business: 15 };

function getUserPlan() {
  try {
    const sub = JSON.parse(localStorage.getItem('offpay_subscription') || 'null');
    return sub?.status === 'active' ? sub : null;
  } catch (_) { return null; }
}

function saveUserPlan(plan, price) {
  const sub = { plan, price, status: 'active', date: new Date().toISOString() };
  localStorage.setItem('offpay_subscription', JSON.stringify(sub));
  const hist = getPaymentHistory();
  hist.unshift({ plan, price, date: sub.date, status: 'paid' });
  localStorage.setItem('offpay_payment_history', JSON.stringify(hist.slice(0, 20)));
}

function getPaymentHistory() {
  try { return JSON.parse(localStorage.getItem('offpay_payment_history') || '[]'); }
  catch (_) { return []; }
}

function openPaymentModal(plan) {
  const defaultPlan = plan || 'Pro';
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
  setText('summary-plan-name', planName);
  setText('summary-amount',    `$${price}.00`);
  setText('summary-total',     `$${price}.00`);
}

function formatCardNumber(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
  input.value = v;
}

function validatePaymentForm() {
  const cardNum = (document.getElementById('pay-card-number')?.value || '').replace(/\s/g, '');
  const expiry  = document.getElementById('pay-expiry')?.value || '';
  const cvv     = document.getElementById('pay-cvv')?.value    || '';
  const holder  = (document.getElementById('pay-holder')?.value || '').trim();

  if (cardNum.length < 16)              { showToast("To'liq karta raqamini kiriting", 'error');        return false; }
  if (!expiry.match(/^\d{2}\/\d{2}$/)) { showToast('Amal qilish muddatini kiriting (MM/YY)', 'error'); return false; }

  const [mm, yy] = expiry.split('/').map(Number);
  const expDate  = new Date(2000 + yy, mm - 1, 1);
  const nowDate  = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  if (expDate < nowDate)                { showToast("Karta muddati o'tib ketgan", 'error');             return false; }
  if (cvv.length < 3)                   { showToast('CVV kodni kiriting', 'error');                    return false; }
  if (!holder || holder.length < 3)     { showToast("Karta egasining ismini kiriting", 'error');        return false; }
  return true;
}

function handlePaymentSubmit() {
  if (!validatePaymentForm()) return;
  const selectedCard = document.querySelector('.plan-selector-card.selected');
  const planName     = selectedCard ? selectedCard.dataset.plan  : 'Pro';
  const planPrice    = Number(selectedCard ? selectedCard.dataset.price : 5);

  setButtonLoading('payment-submit-btn', true);
  setTimeout(() => {
    setButtonLoading('payment-submit-btn', false);
    saveUserPlan(planName, planPrice);
    closeModal('payment-modal');
    showToast("To'lov muvaffaqiyatli amalga oshirildi 🎉", 'success');
    addNotification('Obuna faollashtirildi — ' + planName + ' reja', '🚀');
    addNotification("To'lov muvaffaqiyatli qabul qilindi ($" + planPrice + ')', '✅');
    updatePlanUI();
    ['pay-card-number', 'pay-expiry', 'pay-cvv', 'pay-holder'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }, 2000);
}

function updatePlanUI() {
  const sub      = getUserPlan();
  const planName = sub ? sub.plan : 'Bepul';
  const isActive = !!sub;

  const dbBadge = document.getElementById('dashboard-plan-badge');
  const dbText  = document.getElementById('dashboard-plan-text');
  if (dbBadge) dbBadge.classList.toggle('active-plan', isActive);
  if (dbText)  dbText.textContent = planName + ' reja';

  const profileBadge = document.getElementById('profile-current-plan');
  if (profileBadge) {
    profileBadge.textContent = planName;
    profileBadge.className   = 'profile-current-plan-badge';
    if (planName === 'Pro')      profileBadge.classList.add('plan-pro');
    if (planName === 'Business') profileBadge.classList.add('plan-business');
  }

  renderPaymentHistory();
}

function renderPaymentHistory() {
  const wrap = document.getElementById('profile-payment-history');
  if (!wrap) return;
  const history = getPaymentHistory();
  if (!history.length) { wrap.innerHTML = ''; return; }
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

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
function initEvents() {
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.id === 'mobile-add-btn') return;
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.page;
      if (page) navigateTo(page);
    });
  });

  document.querySelectorAll('.card-action[data-page]').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('settings-dark-toggle')?.addEventListener('change', e => {
    applyTheme(e.target.checked);
    saveSettings();
  });

  document.getElementById('quick-add-btn')?.addEventListener('click', openAddInvoice);
  document.getElementById('add-invoice-btn')?.addEventListener('click', openAddInvoice);
  document.getElementById('mobile-add-btn')?.addEventListener('click', e => { e.preventDefault(); openAddInvoice(); });
  document.getElementById('add-client-btn')?.addEventListener('click', openAddClient);

  document.getElementById('close-invoice-modal')?.addEventListener('click', () => closeModal('invoice-modal'));
  document.getElementById('cancel-invoice')?.addEventListener('click',      () => closeModal('invoice-modal'));
  document.getElementById('save-invoice')?.addEventListener('click',        saveInvoice);

  document.getElementById('close-client-modal')?.addEventListener('click', () => closeModal('client-modal'));
  document.getElementById('cancel-client')?.addEventListener('click',       () => closeModal('client-modal'));
  document.getElementById('save-client')?.addEventListener('click',         saveClient);

  document.getElementById('close-client-detail')?.addEventListener('click', () => closeModal('client-detail-modal'));
  document.getElementById('edit-client-from-detail')?.addEventListener('click', () => {
    if (App.viewingClientId) { closeModal('client-detail-modal'); openEditClient(App.viewingClientId); }
  });
  document.getElementById('delete-client-btn')?.addEventListener('click', () => {
    if (App.viewingClientId) deleteClient(App.viewingClientId);
  });

  document.getElementById('close-invoice-detail')?.addEventListener('click', () => closeModal('invoice-detail-modal'));

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      App.currentFilter = tab.dataset.filter;
      renderInvoiceList();
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
      }
    });
  });

  document.getElementById('confirm-cancel')?.addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    if (App.confirmCallback) { App.confirmCallback(); App.confirmCallback = null; }
    closeModal('confirm-modal');
  });

  document.getElementById('reminder-close')?.addEventListener('click', () => {
    const banner = document.getElementById('reminder-banner');
    if (banner) banner.style.display = 'none';
  });

  document.getElementById('save-templates-btn')?.addEventListener('click', async () => {
    await saveSettings();
    showToast("Shablonlar saqlandi ✓", 'success');
  });
  document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

  document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', () => { if (toggle.id !== 'settings-dark-toggle') saveSettings(); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
      const open = document.querySelector('.modal-overlay.open');
      if (open) {
        open.classList.remove('open');
        if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
      }
    }
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('notif-wrap')?.contains(e.target))   document.getElementById('notif-dropdown')?.classList.remove('open');
    if (!document.getElementById('profile-wrap')?.contains(e.target)) document.getElementById('profile-dropdown')?.classList.remove('open');
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (App.currentPage === 'dashboard') drawChart(); }, 150);
  });
}

// ═══════════════════════════════════════════
// APP INIT
// ═══════════════════════════════════════════
function initAppUI() {
  applyTheme(!!App.settings.darkMode);
  buildNotificationsFromInvoices();
  initEvents();
  populateClientSelect();
  updateProfileHeader();
  updateNotifBadge();
  updatePlanUI();
  navigateTo('dashboard');
}

// ═══════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════
async function init() {
  setTimeout(() => {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
  }, 800);

  const savedDark = localStorage.getItem('payback_theme') === 'dark';
  applyTheme(savedDark);

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      if (App.appInitialized) return;
      App.user           = session.user;
      App.appInitialized = true;
      await loadProfile();
      await loadAllData();
      showApp();
      initAppUI();
    } else if (event === 'SIGNED_OUT') {
      App.user           = null;
      App.profile        = null;
      App.clients        = [];
      App.invoices       = [];
      App.notifications  = [];
      App.appInitialized = false;
      showLanding();
    }
  });

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      if (App.appInitialized) return;
      App.user           = session.user;
      App.appInitialized = true;
      await loadProfile();
      await loadAllData();
      showApp();
      initAppUI();
    } else {
      showLanding();
    }
  } catch (err) {
    console.error('[init] Session check failed:', err);
    showLanding();
  }
}

document.addEventListener('DOMContentLoaded', init);

async function loginWithGoogle() {
  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://offpay.uz'
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error('Google login error:', err);
    showToast('Google login xatolik', 'error');
  }
}
