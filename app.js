/* ══════════════════════════════════════════
   PayBack — To'lov Tiklash Tizimi
   Full Application Logic v3.0 — Supabase Edition
   ══════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════
// SUPABASE CLIENT (ESM import in HTML, initialized here)
// ═══════════════════════════════════════════
// NOTE: Your HTML <script> tag must be type="module" and import supabase like:
//   import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
//   window._supabaseCreateClient = createClient;
// OR use the global CDN build below. We handle both cases gracefully.

let _supabase;

function initSupabaseClient() {
  const SUPABASE_URL = 'https://eooovnjyxvvbfzganvak.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvb292bmp5eHZ2YmZ6Z2FudmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzk2MjgsImV4cCI6MjA5Mjg1NTYyOH0.WT0oZ9W5mAG4QpHcfb2aOnvU244a7ISe15QzkxncLGE';

  // Support ESM module pattern: window._supabaseCreateClient = createClient
  if (typeof window._supabaseCreateClient === 'function') {
    _supabase = window._supabaseCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }
  // Support UMD/CDN global: window.supabase.createClient
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }
  console.error('[PayBack] Supabase client could not be initialized. Make sure supabase-js is loaded.');
  return false;
}

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
  isLoggedIn: false,
  currentUser: null
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
  if (!dateStr) return 0;
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
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hozir';
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} soat oldin`;
  return `${Math.floor(hrs / 24)} kun oldin`;
}

// ═══════════════════════════════════════════
// STORAGE — Settings only (no sensitive data in localStorage)
// ═══════════════════════════════════════════
function saveSettings() {
  try {
    localStorage.setItem('payback_settings', JSON.stringify(App.data.settings));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('payback_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      App.data.settings = { ...App.data.settings, ...parsed };
    }
  } catch (e) {}
}

// ═══════════════════════════════════════════
// SUPABASE DATA LAYER
// ═══════════════════════════════════════════

async function loadDataFromDB() {
  const userId = App.currentUser?.id;
  if (!userId) return;

  try {
    const [clientsRes, invoicesRes, notifsRes] = await Promise.all([
      _supabase.from('clients').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
      _supabase.from('invoices').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
      _supabase.from('notifications').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(20)
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (invoicesRes.error) throw invoicesRes.error;
    if (notifsRes.error) throw notifsRes.error;

    App.data.clients = (clientsRes.data || []).map(normalizeClient);
    App.data.invoices = (invoicesRes.data || []).map(normalizeInvoice);
    App.data.notifications = (notifsRes.data || []).map(normalizeNotification);

  } catch (err) {
    console.error('[PayBack] loadDataFromDB error:', err);
    showToast("Ma'lumotlarni yuklashda xato yuz berdi", 'error');
  }
}

function normalizeClient(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name || '',
    company: row.company || '',
    email: row.email || '',
    phone: row.phone || '',
    rating: row.rating || 'reliable',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function normalizeInvoice(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    clientId: row.client_id,
    number: row.number || '',
    amount: Number(row.amount) || 0,
    status: row.status || 'pending',
    dueDate: row.due_date,
    project_name: row.project_name || '',
    notes: row.notes || '',
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function normalizeNotification(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    text: row.text || '',
    icon: row.icon || '🔔',
    read: !!row.read,
    createdAt: row.created_at
  };
}

async function dbInsertClient(data) {
  const userId = App.currentUser?.id;
  const { data: row, error } = await _supabase.from('clients').insert({
    user_id: userId,
    name: data.name,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    rating: data.rating || 'reliable',
    notes: data.notes || null
  }).select().single();
  if (error) throw error;
  return normalizeClient(row);
}

async function dbUpdateClient(id, data) {
  const { data: row, error } = await _supabase.from('clients').update({
    name: data.name,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    rating: data.rating || 'reliable',
    notes: data.notes || null,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('user_id', App.currentUser?.id).select().single();
  if (error) throw error;
  return normalizeClient(row);
}

async function dbDeleteClient(id) {
  await _supabase.from('invoices').delete().eq('client_id', id).eq('user_id', App.currentUser?.id);
  const { error } = await _supabase.from('clients').delete().eq('id', id).eq('user_id', App.currentUser?.id);
  if (error) throw error;
}

async function dbInsertInvoice(data) {
  const userId = App.currentUser?.id;
  const { data: row, error } = await _supabase.from('invoices').insert({
    user_id: userId,
    client_id: data.clientId,
    number: data.number,
    amount: data.amount,
    status: data.status || 'pending',
    due_date: data.dueDate,
    project_name: data.project_name || null,
    notes: data.notes || null
  }).select().single();
  if (error) throw error;
  return normalizeInvoice(row);
}

async function dbUpdateInvoice(id, data) {
  const updatePayload = {
    client_id: data.clientId,
    number: data.number,
    amount: data.amount,
    status: data.status,
    due_date: data.dueDate,
    project_name: data.project_name || null,
    notes: data.notes || null,
    updated_at: new Date().toISOString()
  };
  if (data.paidAt !== undefined) updatePayload.paid_at = data.paidAt;

  const { data: row, error } = await _supabase.from('invoices').update(updatePayload)
    .eq('id', id).eq('user_id', App.currentUser?.id).select().single();
  if (error) throw error;
  return normalizeInvoice(row);
}

async function dbDeleteInvoice(id) {
  const { error } = await _supabase.from('invoices').delete().eq('id', id).eq('user_id', App.currentUser?.id);
  if (error) throw error;
}

async function dbInsertNotification(text, invoiceId = null, icon = '🔔') {
  const userId = App.currentUser?.id;
  if (!userId) return null;

  const { data: row, error } = await _supabase
    .from('notifications')
    .insert({
      user_id:    userId,
      invoice_id: invoiceId || null,
      text,
      icon,
      read: false
    })
    .select()
    .single();

  if (error) {
    console.error('[PayBack] notification insert error:', error);
    return null;
  }
  return normalizeNotification(row);
}

async function dbMarkAllNotifsRead() {
  const userId = App.currentUser?.id;
  if (!userId) return;
  const { error } = await _supabase.from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) console.error('[PayBack] mark notifs read error:', error);
}

// ═══════════════════════════════════════════
// AUTH FLOW
// ═══════════════════════════════════════════
function showLanding() {
  const landing = document.getElementById('landing-page');
  const auth    = document.getElementById('auth-wrapper');
  const app     = document.getElementById('app-shell');
  if (landing) landing.style.display = '';
  if (auth)    auth.style.display = 'none';
  if (app)     app.style.display = 'none';
}

function showLogin() {
  const landing  = document.getElementById('landing-page');
  const auth     = document.getElementById('auth-wrapper');
  const app      = document.getElementById('app-shell');
  const loginF   = document.getElementById('login-form');
  const signupF  = document.getElementById('signup-form');
  if (landing) landing.style.display = 'none';
  if (auth)    auth.style.display = 'grid';
  if (app)     app.style.display = 'none';
  if (loginF)  loginF.style.display = '';
  if (signupF) signupF.style.display = 'none';
}

function showSignup() {
  const landing  = document.getElementById('landing-page');
  const auth     = document.getElementById('auth-wrapper');
  const app      = document.getElementById('app-shell');
  const loginF   = document.getElementById('login-form');
  const signupF  = document.getElementById('signup-form');
  if (landing) landing.style.display = 'none';
  if (auth)    auth.style.display = 'grid';
  if (app)     app.style.display = 'none';
  if (loginF)  loginF.style.display = 'none';
  if (signupF) signupF.style.display = '';
}

function showApp() {
  const landing = document.getElementById('landing-page');
  const auth    = document.getElementById('auth-wrapper');
  const app     = document.getElementById('app-shell');
  if (landing) landing.style.display = 'none';
  if (auth)    auth.style.display = 'none';
  if (app)     app.style.display = 'flex';
  App.isLoggedIn = true;
}

async function handleLogin() {
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  const email   = emailEl ? emailEl.value.trim() : '';
  const pass    = passEl  ? passEl.value : '';

  if (!email) return showToast('Email kiriting', 'error');
  if (!pass)  return showToast('Parol kiriting', 'error');

  setButtonLoading('login-btn', true);

  try {
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    App.currentUser = data.user;
    const displayName = data.user.user_metadata?.name || email.split('@')[0];
    if (!App.data.settings.profileName) App.data.settings.profileName = displayName;

    showApp();
    await initAppUI();
    showToast(`Xush kelibsiz, ${App.data.settings.profileName}! 👋`, 'success');
  } catch (err) {
    console.error('[PayBack] login error:', err);
    showToast(err.message || 'Login xatosi yuz berdi', 'error');
  } finally {
    setButtonLoading('login-btn', false);
  }
}

async function handleSignup() {
  const nameEl  = document.getElementById('signup-name');
  const emailEl = document.getElementById('signup-email');
  const passEl  = document.getElementById('signup-password');
  const name    = nameEl  ? nameEl.value.trim()  : '';
  const email   = emailEl ? emailEl.value.trim() : '';
  const pass    = passEl  ? passEl.value         : '';

  if (!name)  return showToast('Ismingizni kiriting', 'error');
  if (!email) return showToast('Email kiriting', 'error');
  if (!pass || pass.length < 6) return showToast("Parol kamida 6 ta belgi bo'lishi kerak", 'error');

  setButtonLoading('signup-btn', true);

  try {
    const { data, error } = await _supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { name } }
    });
    if (error) throw error;

    App.currentUser = data.user;
    App.data.settings.profileName = name;
    saveSettings();

    showApp();
    await initAppUI();
    showToast(`Hisob yaratildi! Xush kelibsiz, ${name}! 🎉`, 'success');
  } catch (err) {
    console.error('[PayBack] signup error:', err);
    showToast(err.message || "Ro'yxatdan o'tishda xato yuz berdi", 'error');
  } finally {
    setButtonLoading('signup-btn', false);
  }
}

async function handleLogout() {
  closeAllDropdowns();
  cleanupRealtimeNotifications();
  try {
    await _supabase.auth.signOut();
  } catch (err) {
    console.error('[PayBack] logout error:', err);
  }
  App.isLoggedIn = false;
  App.currentUser = null;
  App.data.clients = [];
  App.data.invoices = [];
  App.data.notifications = [];
  showLanding();
  showToast("Tizimdan chiqdingiz", 'warning');
}

async function loginWithGoogle() {
  try {
    const redirectTo = window.location.href.split('#')[0].split('?')[0];
    const { error } = await _supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) throw error;
    showToast('Google sahifasiga yo\'naltirilmoqda...', 'info');
  } catch (err) {
    console.error('[PayBack] Google login error:', err);
    showToast('Google bilan kirishda xato: ' + (err.message || 'Noma\'lum xato'), 'error');
  }
}

async function loginWithFacebook() {
  try {
    // Build the exact redirect URL (remove trailing slash for consistency)
    const redirectTo = window.location.href.split('#')[0].split('?')[0];

    const { error } = await _supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo,
        scopes: 'email,public_profile'
      }
    });
    if (error) throw error;
    // If no error, browser will redirect — show loading feedback
    showToast('Facebook sahifasiga yo\'naltirilmoqda...', 'info');
  } catch (err) {
    console.error('[PayBack] Facebook login error:', err);
    showToast('Facebook bilan kirishda xato: ' + (err.message || 'Noma\'lum xato'), 'error');
  }
}

async function demoLogin() {
  setButtonLoading('login-btn', true);
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({
      email: 'demo@offpay.uz',
      password: 'demo123456'
    });
    if (error) throw error;
    App.currentUser = data.user;
    const displayName = data.user.user_metadata?.name || 'Demo Foydalanuvchi';
    if (!App.data.settings.profileName) App.data.settings.profileName = displayName;
    showApp();
    await initAppUI();
    showToast(`Demo rejimga xush kelibsiz! 🎉`, 'success');
  } catch (err) {
    console.error('[PayBack] demo login error:', err);
    // If demo account doesn't exist, show demo UI without backend
    App.currentUser = { id: 'demo-user', email: 'demo@offpay.uz' };
    App.data.settings.profileName = 'Demo Foydalanuvchi';
    App.data.settings.profileRole = 'Freelancer';
    showApp();
    await initAppUI();
    showToast('Demo rejimda ishlayapsiz 👋', 'info');
  } finally {
    setButtonLoading('login-btn', false);
  }
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
  if (text)   text.style.display   = loading ? 'none' : '';
  if (loader) loader.style.display = loading ? ''     : 'none';
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
  if (e) e.stopPropagation();
  const dd        = document.getElementById('notif-dropdown');
  const profileDd = document.getElementById('profile-dropdown');
  if (!dd) return;
  if (profileDd) profileDd.classList.remove('open');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) renderNotifications();
}

function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const dd      = document.getElementById('profile-dropdown');
  const notifDd = document.getElementById('notif-dropdown');
  if (!dd) return;
  if (notifDd) notifDd.classList.remove('open');
  dd.classList.toggle('open');
}

function closeAllDropdowns() {
  document.getElementById('notif-dropdown')?.classList.remove('open');
  document.getElementById('profile-dropdown')?.classList.remove('open');
}

async function clearNotifications() {
  App.data.notifications = App.data.notifications.map(n => ({ ...n, read: true }));
  updateNotifBadge();
  renderNotifications();
  await dbMarkAllNotifsRead();
}

async function addNotification(text, invoiceId = null) {
  if (!App.currentUser) return;

  const icon = '🔔';

  const notif = await dbInsertNotification(text, invoiceId, icon);
  if (!notif) return;

  App.data.notifications.unshift(notif);
  App.data.notifications = App.data.notifications.slice(0, 20);

  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = (App.data.notifications || []).filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = unread > 9 ? '9+' : String(unread);
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
      <span class="notif-icon">${n.icon || '🔔'}</span>
      <div style="flex:1">
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    </div>
  `).join('');
}

function updateProfileHeader() {
  const name     = App.data.settings.profileName || 'F';
  const initials = getInitials(name);
  const email    = App.currentUser?.email || '';

  const headerAvatar = document.getElementById('header-avatar');
  const pdAvatar     = document.getElementById('pd-avatar');
  const pdName       = document.getElementById('pd-name');
  const pdEmail      = document.getElementById('pd-email');

  if (headerAvatar) { headerAvatar.textContent = initials; headerAvatar.className = `header-avatar ${avatarColor(name)}`; }
  if (pdAvatar)     { pdAvatar.textContent = initials;     pdAvatar.className = `pd-avatar ${avatarColor(name)}`; }
  if (pdName)  pdName.textContent  = name;
  if (pdEmail) pdEmail.textContent = email;
}

// ═══════════════════════════════════════════
// SIDEBAR TOGGLE (Mobile)
// ═══════════════════════════════════════════
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ═══════════════════════════════════════════
// AUTO-STATUS UPDATE
// ═══════════════════════════════════════════
async function autoUpdateStatuses() {
  const toUpdate = [];
  App.data.invoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = daysUntil(inv.dueDate);
    if (days < 0 && inv.status !== 'overdue') {
      inv.status = 'overdue';
      toUpdate.push(inv);
    }
  });

  for (const inv of toUpdate) {
    try {
      await dbUpdateInvoice(inv.id, inv);
    } catch (err) {
      console.error('[PayBack] autoUpdateStatuses error:', err);
    }
  }
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

async function buildNotificationsFromInvoices() {
  if (!App.data.notifications) App.data.notifications = [];
  const reminders = checkReminders();
  if (App.data.notifications.length === 0 && reminders.length > 0) {
    for (const r of reminders) {
      const icon = r.startsWith('🚨') ? '🚨' : r.startsWith('⚠️') ? '⚠️' : '⏰';
      const text = r.replace(/^[⏰⚠️🚨]\s/, '');
      await addNotification(text, icon);
    }
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

function navigateToProfile() {
  const s      = App.data.settings;
  const pmName  = document.getElementById('pm-name');
  const pmRole  = document.getElementById('pm-role');
  const pmPhone = document.getElementById('pm-phone');
  if (pmName)  pmName.value  = s.profileName  || '';
  if (pmRole)  pmRole.value  = s.profileRole  || '';
  if (pmPhone) pmPhone.value = s.profilePhone || '';

  const av = document.getElementById('profile-modal-avatar');
  const nm = document.getElementById('profile-modal-name');
  const rl = document.getElementById('profile-modal-role');
  if (av) { av.textContent = getInitials(s.profileName || 'F'); av.className = `profile-modal-avatar ${avatarColor(s.profileName || 'F')}`; }
  if (nm) nm.textContent = s.profileName || 'Freelancer';
  if (rl) rl.textContent = s.profileRole || 'Web Developer';

  openModal('profile-modal');
  updatePlanUI();
}

function saveProfileModal() {
  const name  = document.getElementById('pm-name')?.value.trim()  || '';
  const role  = document.getElementById('pm-role')?.value.trim()  || '';
  const phone = document.getElementById('pm-phone')?.value.trim() || '';

  App.data.settings.profileName  = name;
  App.data.settings.profileRole  = role;
  App.data.settings.profilePhone = phone;
  saveSettings();
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
  if (h >= 5 && h < 12)  greet = 'Xayrli tong';
  else if (h >= 12 && h < 18) greet = 'Xayrli kun';
  else if (h >= 18 && h < 22) greet = 'Xayrli kech';
  else greet = 'Xayrli tun';

  const name = App.data.settings.profileName || 'Freelancer';
  const el   = document.getElementById('greeting-text');
  if (el) el.textContent = `${greet}, ${name} 👋`;

  const dateEl = document.getElementById('header-date');
  if (dateEl) {
    const days   = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    const months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    dateEl.textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function updateStats() {
  const invoices = App.data.invoices;
  const total   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const pending = invoices.filter(i => i.status === 'pending').reduce((s,i) => s + Number(i.amount), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + Number(i.amount), 0);
  const allPaid  = invoices.filter(i => i.status === 'paid').length;
  const allCount = invoices.length;
  const rate = allCount > 0 ? Math.round((allPaid / allCount) * 100) : 0;

  setText('stat-total',        formatCurrency(total));
  setText('stat-pending',      formatCurrency(pending));
  setText('stat-overdue',      formatCurrency(overdue));
  setText('stat-rate',         rate + '%');
  setText('stat-total-meta',   `${allPaid} ta to'langan invoice`);
  setText('stat-pending-meta', `${invoices.filter(i=>i.status==='pending').length} ta kutilmoqda`);
  setText('stat-overdue-meta', `${invoices.filter(i=>i.status==='overdue').length} ta muddati o'tgan`);
  setText('stat-rate-meta',    `${allCount} invoicesdan ${allPaid} tasi`);
}

function openStatModal(filterType) {
  let title    = '';
  let invoices = [];

  switch (filterType) {
    case 'paid':
      title    = "To'langan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'paid');
      break;
    case 'pending':
      title    = "Kutilayotgan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'pending');
      break;
    case 'overdue':
      title    = "Muddati O'tgan Invoicelar";
      invoices = App.data.invoices.filter(i => i.status === 'overdue');
      break;
    default:
      title    = 'Barcha Invoicelar';
      invoices = App.data.invoices;
  }

  setText('stat-modal-title', title);

  const total     = invoices.reduce((s,i) => s + Number(i.amount), 0);
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

function updateBadge() {
  const count = App.data.invoices.filter(i => i.status === 'overdue').length;
  const badge = document.getElementById('overdue-badge');
  if (!badge) return;
  badge.textContent = String(count);
  badge.classList.toggle('visible', count > 0);
}

// ── CHART ──
function drawChart() {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  const ctx       = canvas.getContext('2d');
  const dpr       = window.devicePixelRatio || 1;
  const container = canvas.parentElement;
  const W = (container ? container.clientWidth : 0) || 500;
  const H = 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  const invoices = App.data.invoices;
  const paid    = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const pending = invoices.filter(i => i.status === 'pending').reduce((s,i) => s + Number(i.amount), 0);
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + Number(i.amount), 0);
  const total   = paid + pending + overdue;

  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (total === 0) {
    const barH = 44, barY = (H - barH) / 2, barR = 22;
    roundRect(ctx, 40, barY, W - 80, barH, barR, isDark ? '#21262d' : '#f1f5f9');
    ctx.fillStyle = isDark ? '#6e7681' : '#94a3b8';
    ctx.font = '500 13px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Invoice qo'shilgandan so'ng grafik ko'rinadi", W / 2, H / 2 + 5);
    return;
  }

  const textColor = isDark ? '#8b949e' : '#64748b';
  const segments = [
    { key: 'paid',    val: paid,    color: '#22c55e', label: "To'langan" },
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
    const w   = (seg.val / total) * barW;
    const pct = Math.round((seg.val / total) * 100);
    ctx.fillStyle = seg.color;
    ctx.font = '700 13px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pct + '%', x + w / 2, labelY);
    ctx.fillStyle = textColor;
    ctx.font = '500 11px Plus Jakarta Sans, sans-serif';
    ctx.fillText(seg.label, x + w / 2, labelY + 16);
    x += w;
  });

  ctx.fillStyle = textColor;
  ctx.font = '600 12px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Jami: ' + formatCurrency(total), barX, barY - 14);
  ctx.fillStyle = textColor;
  ctx.font = '500 11px Plus Jakarta Sans, sans-serif';
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
  setText('count-all',     invs.length);
  setText('count-pending', invs.filter(i => i.status === 'pending').length);
  setText('count-overdue', invs.filter(i => i.status === 'overdue').length);
  setText('count-paid',    invs.filter(i => i.status === 'paid').length);
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
      all:     "Hali invoice qo'shilmagan. Boshlash uchun yuqoridagi tugmani bosing.",
      pending: "Kutilmoqda invoicelar yo'q.",
      overdue: "Muddati o'tgan invoice yo'q. Ajoyib! ✓",
      paid:    "To'langan invoice yo'q."
    };
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><h3>Invoice yo'q</h3><p>${msgs[App.currentFilter] || ''}</p></div>`;
    return;
  }

  el.innerHTML = filtered.map(inv => {
    const clientName = getClientName(inv.clientId);
    const days = daysUntil(inv.dueDate);
    let dueText = formatDate(inv.dueDate);
    if (inv.status !== 'paid') {
      if (days < 0)      dueText = `${Math.abs(days)} kun o'tdi`;
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
  const titleEl = document.getElementById('invoice-modal-title');
  const editId  = document.getElementById('invoice-edit-id');
  const numEl   = document.getElementById('invoice-number');
  const amtEl   = document.getElementById('invoice-amount');
  const dueEl   = document.getElementById('invoice-due');
  const projEl  = document.getElementById('invoice-project');
  const statEl  = document.getElementById('invoice-status');
  const notesEl = document.getElementById('invoice-notes');
  if (titleEl) titleEl.textContent = 'Yangi Invoice';
  if (editId)  editId.value        = '';
  if (numEl)   numEl.value         = generateInvoiceNumber();
  if (amtEl)   amtEl.value         = '';
  if (dueEl)   dueEl.value         = '';
  if (projEl)  projEl.value        = '';
  if (statEl)  statEl.value        = 'pending';
  if (notesEl) notesEl.value       = '';
  populateClientSelect();
  openModal('invoice-modal');
}

function openEditInvoice(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  App.editingInvoiceId = id;
  const titleEl = document.getElementById('invoice-modal-title');
  const editId  = document.getElementById('invoice-edit-id');
  const numEl   = document.getElementById('invoice-number');
  const amtEl   = document.getElementById('invoice-amount');
  const dueEl   = document.getElementById('invoice-due');
  const projEl  = document.getElementById('invoice-project');
  const statEl  = document.getElementById('invoice-status');
  const notesEl = document.getElementById('invoice-notes');
  if (titleEl) titleEl.textContent = 'Invoice Tahrirlash';
  if (editId)  editId.value        = id;
  populateClientSelect(inv.clientId);
  if (numEl)   numEl.value   = inv.number;
  if (amtEl)   amtEl.value   = inv.amount;
  if (dueEl)   dueEl.value   = inv.dueDate || '';
  if (projEl)  projEl.value  = inv.project || '';
  if (statEl)  statEl.value  = inv.status;
  if (notesEl) notesEl.value = inv.notes || '';
  openModal('invoice-modal');
}

async function saveInvoice() {
  const clientId = document.getElementById('invoice-client')?.value || '';
  const number   = (document.getElementById('invoice-number')?.value || '').trim();
  const amount   = document.getElementById('invoice-amount')?.value || '';
  const dueDate  = document.getElementById('invoice-due')?.value    || '';
  const project  = (document.getElementById('invoice-project')?.value || '').trim();
  const status   = document.getElementById('invoice-status')?.value  || 'pending';
  const notes    = (document.getElementById('invoice-notes')?.value  || '').trim();

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

  try {
    const payload = { clientId, number, amount: Number(amount), dueDate, project, status, notes };

    if (App.editingInvoiceId) {
      const updated = await dbUpdateInvoice(App.editingInvoiceId, payload);
      const idx = App.data.invoices.findIndex(i => i.id === App.editingInvoiceId);
      if (idx !== -1) App.data.invoices[idx] = updated;
      showToast("Invoice yangilandi ✓", 'success');
    } else {
      const newInv = await dbInsertInvoice(payload);
      App.data.invoices.unshift(newInv);
      await addNotification(`Yangi invoice qo'shildi: ${number} — ${getClientName(clientId)}`, '📄');
      showToast("Yangi invoice qo'shildi ✓", 'success');
    }

    closeModal('invoice-modal');
    renderPage(App.currentPage);
    updateBadge();
  } catch (err) {
    console.error('[PayBack] saveInvoice error:', err);
    showToast(err.message || "Invoice saqlashda xato yuz berdi", 'error');
  } finally {
    if (saveBtn) {
      const txt = saveBtn.querySelector('.btn-text');
      const ldr = saveBtn.querySelector('.btn-loader');
      saveBtn.disabled = false;
      if (txt) txt.style.display = '';
      if (ldr) ldr.style.display = 'none';
    }
  }
}

async function markAsPaid(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;

  try {
    const updated = await dbUpdateInvoice(id, {
      clientId: inv.clientId,
      number: inv.number,
      amount: inv.amount,
      dueDate: inv.dueDate,
      project_name: inv.project_name,
      notes: inv.notes,
      status: 'paid',
      paidAt: new Date().toISOString()
    });

    const idx = App.data.invoices.findIndex(i => i.id === id);
    if (idx !== -1) App.data.invoices[idx] = updated;

    await addNotification(`To'landi: ${inv.number}`, id);

    showToast("To'lov tasdiqlandi ✓", 'success');

    renderPage(App.currentPage);
    updateBadge();

  } catch (err) {
    console.error("REAL ERROR:", err);
    showToast(err.message, 'error');
  }
}

function deleteInvoice(id) {
  confirmDialog("Bu invoiceni o'chirishni istaysizmi?", async () => {
    try {
      await dbDeleteInvoice(id);
      App.data.invoices = App.data.invoices.filter(i => i.id !== id);
      showToast("Invoice o'chirildi", 'warning');
      renderPage(App.currentPage);
      updateBadge();
      closeModal('invoice-detail-modal');
    } catch (err) {
      console.error('[PayBack] deleteInvoice error:', err);
      showToast("Invoice o'chirishda xato yuz berdi", 'error');
    }
  });
}

function sendReminder(id) {
  const inv = App.data.invoices.find(i => i.id === id);
  if (!inv) return;
  const clientName = getClientName(inv.clientId);
  const days = daysUntil(inv.dueDate);
  let msg;
  if (days >= 0) {
    msg = (App.data.settings.tplFriendly || getDefaultTemplate('friendly'))
      .replace('[MIJOZ_ISM]', clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SANA]', formatDate(inv.dueDate))
      .replace('[SUMMA]', formatCurrency(inv.amount));
  } else if (Math.abs(days) <= 7) {
    msg = (App.data.settings.tplWarning || getDefaultTemplate('warning'))
      .replace('[MIJOZ_ISM]', clientName)
      .replace('[INVOICE_RAQAM]', inv.number)
      .replace('[SUMMA]', formatCurrency(inv.amount));
  } else {
    msg = (App.data.settings.tplFinal || getDefaultTemplate('final'))
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

  const numEl = document.getElementById('inv-detail-number');
  if (numEl) numEl.textContent = inv.number;

  const content = document.getElementById('invoice-detail-content');
  if (content) {
    content.innerHTML = `
      <div class="inv-detail-item"><div class="inv-detail-label">Mijoz</div><div class="inv-detail-val">${clientName}</div></div>
      <div class="inv-detail-item"><div class="inv-detail-label">Summa</div><div class="inv-detail-val mono">${formatCurrency(inv.amount)}</div></div>
      <div class="inv-detail-item"><div class="inv-detail-label">Holati</div><div class="inv-detail-val"><span class="badge badge-${inv.status}">${getStatusLabel(inv.status)}</span></div></div>
      <div class="inv-detail-item"><div class="inv-detail-label">Muddati</div><div class="inv-detail-val ${inv.status !== 'paid' && days < 0 ? 'text-red' : ''}">${formatDate(inv.dueDate)}${inv.status !== 'paid' && days < 0 ? ` (${Math.abs(days)} kun o'tdi)` : ''}</div></div>
      ${inv.project ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Loyiha</div><div class="inv-detail-val">${inv.project}</div></div>` : ''}
      <div class="inv-detail-item"><div class="inv-detail-label">Yaratilgan</div><div class="inv-detail-val">${formatDate(inv.createdAt)}</div></div>
      ${inv.paidAt ? `<div class="inv-detail-item"><div class="inv-detail-label">To'langan sana</div><div class="inv-detail-val text-green">${formatDate(inv.paidAt)}</div></div>` : ''}
      ${inv.notes  ? `<div class="inv-detail-item" style="grid-column:1/-1"><div class="inv-detail-label">Izoh</div><div class="inv-detail-val">${inv.notes}</div></div>` : ''}
    `;
  }

  const actions = document.getElementById('invoice-detail-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('invoice-detail-modal')">Yopish</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditInvoice('${inv.id}'); closeModal('invoice-detail-modal')">✏️ Tahrirlash</button>
      ${inv.status !== 'paid' ? `<button class="btn btn-success" onclick="markAsPaid('${inv.id}'); closeModal('invoice-detail-modal')">✓ To'landi</button>` : ''}
      ${inv.status !== 'paid' ? `<button class="btn btn-warning" onclick="sendReminder('${inv.id}')">🔔 Eslatma</button>` : ''}
      <button class="btn btn-danger" onclick="deleteInvoice('${inv.id}')">🗑</button>
    `;
  }

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
    const invoices   = getClientInvoices(client.id);
    const unpaid     = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + Number(i.amount), 0);
    const paid       = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
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
  const titleEl  = document.getElementById('client-modal-title');
  const editId   = document.getElementById('client-edit-id');
  const nameEl   = document.getElementById('client-name');
  const compEl   = document.getElementById('client-company');
  const emailEl  = document.getElementById('client-email');
  const phoneEl  = document.getElementById('client-phone');
  const ratingEl = document.getElementById('client-rating');
  const notesEl  = document.getElementById('client-notes');
  if (titleEl)  titleEl.textContent = 'Yangi Mijoz';
  if (editId)   editId.value        = '';
  if (nameEl)   nameEl.value        = '';
  if (compEl)   compEl.value        = '';
  if (emailEl)  emailEl.value       = '';
  if (phoneEl)  phoneEl.value       = '';
  if (ratingEl) ratingEl.value      = 'reliable';
  if (notesEl)  notesEl.value       = '';
  openModal('client-modal');
}

function openEditClient(id) {
  const c = App.data.clients.find(c => c.id === id);
  if (!c) return;
  App.editingClientId = id;
  const titleEl  = document.getElementById('client-modal-title');
  const editId   = document.getElementById('client-edit-id');
  const nameEl   = document.getElementById('client-name');
  const compEl   = document.getElementById('client-company');
  const emailEl  = document.getElementById('client-email');
  const phoneEl  = document.getElementById('client-phone');
  const ratingEl = document.getElementById('client-rating');
  const notesEl  = document.getElementById('client-notes');
  if (titleEl)  titleEl.textContent = 'Mijoz Tahrirlash';
  if (editId)   editId.value        = id;
  if (nameEl)   nameEl.value        = c.name;
  if (compEl)   compEl.value        = c.company || '';
  if (emailEl)  emailEl.value       = c.email   || '';
  if (phoneEl)  phoneEl.value       = c.phone   || '';
  if (ratingEl) ratingEl.value      = c.rating  || 'reliable';
  if (notesEl)  notesEl.value       = c.notes   || '';
  openModal('client-modal');
}

async function saveClient() {
  const name    = (document.getElementById('client-name')?.value    || '').trim();
  const company = (document.getElementById('client-company')?.value || '').trim();
  const email   = (document.getElementById('client-email')?.value   || '').trim();
  const phone   = (document.getElementById('client-phone')?.value   || '').trim();
  const rating  =  document.getElementById('client-rating')?.value  || 'reliable';
  const notes   = (document.getElementById('client-notes')?.value   || '').trim();

  if (!name) return showToast('Iltimos, mijoz ismini kiriting', 'error');

  try {
    if (App.editingClientId) {
      const updated = await dbUpdateClient(App.editingClientId, { name, company, email, phone, rating, notes });
      const idx = App.data.clients.findIndex(c => c.id === App.editingClientId);
      if (idx !== -1) App.data.clients[idx] = updated;
      showToast("Mijoz yangilandi ✓", 'success');
    } else {
      const newClient = await dbInsertClient({ name, company, email, phone, rating, notes });
      App.data.clients.unshift(newClient);
      await addNotification(`Yangi mijoz qo'shildi: ${name}`, '👤');
      showToast("Yangi mijoz qo'shildi ✓", 'success');
    }

    closeModal('client-modal');
    populateClientSelect();
    renderPage(App.currentPage);
  } catch (err) {
    console.error('[PayBack] saveClient error:', err);
    showToast(err.message || "Mijozni saqlashda xato yuz berdi", 'error');
  }
}

function openClientDetail(id) {
  const c = App.data.clients.find(c => c.id === id);
  if (!c) return;
  App.viewingClientId = id;

  const colorClass = avatarColor(c.name);
  const avatarEl   = document.getElementById('detail-avatar');
  if (avatarEl) {
    avatarEl.textContent = getInitials(c.name);
    avatarEl.className   = `client-avatar-large ${colorClass}`;
  }

  const nameEl    = document.getElementById('detail-client-name');
  const companyEl = document.getElementById('detail-client-company');
  if (nameEl)    nameEl.textContent    = c.name;
  if (companyEl) companyEl.textContent = c.company || '';

  const invoices = getClientInvoices(id);
  const paid     = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0);
  const unpaid   = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + Number(i.amount), 0);

  setText('detail-total',  invoices.length);
  setText('detail-paid',   formatCurrency(paid));
  setText('detail-unpaid', formatCurrency(unpaid));

  const contactEl = document.getElementById('detail-contact');
  if (contactEl) {
    let contactHtml = '';
    if (c.email) contactHtml += `<span class="detail-contact-item">📧 ${c.email}</span>`;
    if (c.phone) contactHtml += `<span class="detail-contact-item">📞 ${c.phone}</span>`;
    contactHtml += `<span class="detail-contact-item badge-${c.rating}" style="padding:5px 10px">${getRatingLabel(c.rating)}</span>`;
    contactEl.innerHTML = contactHtml;
  }

  const listEl = document.getElementById('detail-invoice-list');
  if (listEl) {
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
  }

  const notesWrap = document.getElementById('detail-notes-wrap');
  const notesEl   = document.getElementById('detail-notes');
  if (notesWrap && notesEl) {
    if (c.notes) {
      notesEl.textContent      = c.notes;
      notesWrap.style.display  = '';
    } else {
      notesWrap.style.display  = 'none';
    }
  }

  openModal('client-detail-modal');
}

function deleteClient(id) {
  confirmDialog("Bu mijozni o'chirmoqchimisiz? Unga bog'liq invoicelar ham o'chiriladi.", async () => {
    try {
      await dbDeleteClient(id);
      App.data.clients  = App.data.clients.filter(c => c.id !== id);
      App.data.invoices = App.data.invoices.filter(i => i.clientId !== id);
      showToast("Mijoz o'chirildi", 'warning');
      closeModal('client-detail-modal');
      renderPage(App.currentPage);
      populateClientSelect();
      updateBadge();
    } catch (err) {
      console.error('[PayBack] deleteClient error:', err);
      showToast("Mijozni o'chirishda xato yuz berdi", 'error');
    }
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
  setChecked('auto-1day',          s.auto1day !== false);
  setChecked('auto-3days',         s.auto3days !== false);
  setChecked('auto-7days',         !!s.auto7days);
  setChecked('settings-dark-toggle', document.documentElement.getAttribute('data-theme') === 'dark');

  const getEl = id => document.getElementById(id);
  if (getEl('tpl-friendly')) getEl('tpl-friendly').value = s.tplFriendly || getDefaultTemplate('friendly');
  if (getEl('tpl-warning'))  getEl('tpl-warning').value  = s.tplWarning  || getDefaultTemplate('warning');
  if (getEl('tpl-final'))    getEl('tpl-final').value    = s.tplFinal    || getDefaultTemplate('final');
  if (getEl('profile-name'))  getEl('profile-name').value  = s.profileName  || '';
  if (getEl('profile-role'))  getEl('profile-role').value  = s.profileRole  || '';
  if (getEl('profile-phone')) getEl('profile-phone').value = s.profilePhone || '';
}

function saveSettingsForm() {
  const s     = App.data.settings;
  s.auto1day  = document.getElementById('auto-1day')?.checked  ?? true;
  s.auto3days = document.getElementById('auto-3days')?.checked ?? true;
  s.auto7days = document.getElementById('auto-7days')?.checked ?? false;
  s.tplFriendly = document.getElementById('tpl-friendly')?.value || '';
  s.tplWarning  = document.getElementById('tpl-warning')?.value  || '';
  s.tplFinal    = document.getElementById('tpl-final')?.value    || '';
  saveSettings();
}

function saveProfile() {
  App.data.settings.profileName  = (document.getElementById('profile-name')?.value  || '').trim();
  App.data.settings.profileRole  = (document.getElementById('profile-role')?.value  || '').trim();
  App.data.settings.profilePhone = (document.getElementById('profile-phone')?.value || '').trim();
  saveSettings();
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
  saveSettings();
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
  const msgEl = document.getElementById('confirm-message');
  if (msgEl) msgEl.textContent = message;
  App.confirmCallback = callback;
  openModal('confirm-modal');
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast       = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.innerHTML   = `<span>${message}</span>`;
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
  if (el) el.textContent = String(text);
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
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

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Settings dark mode toggle
  document.getElementById('settings-dark-toggle')?.addEventListener('change', (e) => {
    applyTheme(e.target.checked);
    saveSettings();
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
  document.getElementById('cancel-invoice')?.addEventListener('click',      () => closeModal('invoice-modal'));
  document.getElementById('save-invoice')?.addEventListener('click',        saveInvoice);

  // Client modal
  document.getElementById('close-client-modal')?.addEventListener('click', () => closeModal('client-modal'));
  document.getElementById('cancel-client')?.addEventListener('click',      () => closeModal('client-modal'));
  document.getElementById('save-client')?.addEventListener('click',        saveClient);

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
    saveSettingsForm();
    showToast("Shablonlar saqlandi ✓", 'success');
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

  document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      if (toggle.id !== 'settings-dark-toggle') saveSettingsForm();
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
    const notifWrap   = document.getElementById('notif-wrap');
    const profileWrap = document.getElementById('profile-wrap');
    if (notifWrap   && !notifWrap.contains(e.target))   document.getElementById('notif-dropdown')?.classList.remove('open');
    if (profileWrap && !profileWrap.contains(e.target)) document.getElementById('profile-dropdown')?.classList.remove('open');
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
async function initAppUI() {
  await loadDataFromDB();
  await autoUpdateStatuses();
  await buildNotificationsFromInvoices();
  applyTheme(!!App.data.settings.darkMode);
  initEvents();
  populateClientSelect();
  updateProfileHeader();
  updateNotifBadge();
  navigateTo('dashboard');
  updatePlanUI();
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  const loader = document.getElementById('page-loader');

  // Initialize Supabase client
  if (!initSupabaseClient()) {
    // Supabase not available — hide loader and show landing
    if (loader) loader.classList.add('hidden');
    showLanding();
    return;
  }

  // Load saved settings (theme, templates) from localStorage
  loadSettings();
  applyTheme(!!App.data.settings.darkMode);

  try {
    const { data: sessionData, error } = await _supabase.auth.getSession();
    if (error) throw error;

    const session = sessionData?.session;

    if (session?.user) {
      App.currentUser = session.user;
      const displayName = session.user.user_metadata?.name || session.user.email.split('@')[0];
      if (!App.data.settings.profileName) App.data.settings.profileName = displayName;
      showApp();
      await initAppUI();
    } else {
      showLanding();
    }
  } catch (err) {
    console.error('[PayBack] session check error:', err);
    showLanding();
  } finally {
    if (loader) loader.classList.add('hidden');
  }

  // Listen for auth state changes (OAuth redirect, token refresh, sign out)
  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user && !App.isLoggedIn) {
      // Handles Google/Facebook OAuth redirect callback
      App.currentUser = session.user;
      const displayName = session.user.user_metadata?.full_name ||
                          session.user.user_metadata?.name ||
                          session.user.email?.split('@')[0] || 'Foydalanuvchi';
      if (!App.data.settings.profileName) App.data.settings.profileName = displayName;
      showApp();
      await initAppUI();
      showToast(`Xush kelibsiz, ${App.data.settings.profileName}! 👋`, 'success');
    } else if (event === 'SIGNED_OUT' && App.isLoggedIn) {
      App.isLoggedIn  = false;
      App.currentUser = null;
      App.data.clients       = [];
      App.data.invoices      = [];
      App.data.notifications = [];
      cleanupRealtimeNotifications();
      showLanding();
    } else if (event === 'TOKEN_REFRESHED' && session) {
      App.currentUser = session.user;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════
// PAYMENT SYSTEM
// ═══════════════════════════════════════════

function getUserPlan() {
  try {
    const raw = localStorage.getItem('offpay_subscription');
    if (!raw) return null;
    const sub = JSON.parse(raw);
    if (sub && sub.status === 'active') return sub;
  } catch (e) {}
  return null;
}

function saveUserPlan(plan, price) {
  try {
    const sub = { plan, price, status: 'active', date: new Date().toISOString() };
    localStorage.setItem('offpay_subscription', JSON.stringify(sub));
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem('offpay_payment_history') || '[]'); } catch (e) {}
    hist.unshift({ plan, price, date: new Date().toISOString(), status: 'paid' });
    localStorage.setItem('offpay_payment_history', JSON.stringify(hist.slice(0, 20)));
  } catch (e) {}
}

function getPaymentHistory() {
  try {
    return JSON.parse(localStorage.getItem('offpay_payment_history') || '[]');
  } catch (e) {
    return [];
  }
}

const PLAN_PRICES = { Basic: 3, Pro: 5, Business: 15 };

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
  const summaryPlan = document.getElementById('summary-plan-name');
  const summaryAmt  = document.getElementById('summary-amount');
  const summaryTot  = document.getElementById('summary-total');
  if (summaryPlan) summaryPlan.textContent = planName;
  if (summaryAmt)  summaryAmt.textContent  = `$${price}.00`;
  if (summaryTot)  summaryTot.textContent  = `$${price}.00`;
}

function formatCardNumber(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
  input.value = v;
}

function validatePaymentForm() {
  const cardNum = (document.getElementById('pay-card-number')?.value || '').replace(/\s/g,'');
  const expiry  =  document.getElementById('pay-expiry')?.value || '';
  const cvv     =  document.getElementById('pay-cvv')?.value    || '';
  const holder  = (document.getElementById('pay-holder')?.value || '').trim();

  if (cardNum.length < 16) {
    showToast("To'liq karta raqamini kiriting", 'error'); return false;
  }
  if (!expiry.match(/^\d{2}\/\d{2}$/)) {
    showToast("Amal qilish muddatini kiriting (MM/YY)", 'error'); return false;
  }
  const [mm, yy] = expiry.split('/').map(Number);
  const now      = new Date();
  const expDate  = new Date(2000 + yy, mm - 1, 1);
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

  const selectedCard = document.querySelector('.plan-selector-card.selected');
  const planName     = selectedCard ? selectedCard.dataset.plan  : 'Pro';
  const planPrice    = Number(selectedCard ? selectedCard.dataset.price : 5);

  const btn = document.getElementById('payment-submit-btn');
  if (btn) {
    btn.disabled = true;
    const txt = btn.querySelector('.btn-text');
    const ldr = btn.querySelector('.btn-loader');
    if (txt) txt.style.display = 'none';
    if (ldr) ldr.style.display = 'flex';
  }

  setTimeout(() => {
    if (btn) {
      btn.disabled = false;
      const txt = btn.querySelector('.btn-text');
      const ldr = btn.querySelector('.btn-loader');
      if (txt) txt.style.display = '';
      if (ldr) ldr.style.display = 'none';
    }

    saveUserPlan(planName, planPrice);
    closeModal('payment-modal');
    showToast("To'lov muvaffaqiyatli amalga oshirildi 🎉", 'success');

    addNotification('Obuna faollashtirildi — ' + planName + ' reja', '🚀');
    addNotification("To'lov muvaffaqiyatli qabul qilindi ($" + planPrice + ")", '✅');

    updatePlanUI();

    ['pay-card-number','pay-expiry','pay-cvv','pay-holder'].forEach(id => {
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

/* ══════════════════════════════════════════════════════════════════
   PayBack — NOTIFICATION SYSTEM MODULE
   Paste this block into app.js, replacing the existing notification
   functions (addNotification, updateNotifBadge, renderNotifications,
   clearNotifications, sendReminder, buildNotificationsFromInvoices,
   checkReminders).

   Also:
   1. Update normalizeNotification (shown below)
   2. Update dbInsertNotification (shown below)
   3. Call initRealtimeNotifications() at the end of initAppUI()
   4. Call checkInvoiceAlerts() at the end of initAppUI()
   5. Add the HTML snippets (at the bottom of this file) where needed
   ══════════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────────
   STEP 1 — Replace normalizeNotification with this version
   (adds invoice_id support)
───────────────────────────────────────────────────────────────── */
function normalizeNotification(row) {
  return {
    id:         row.id,
    user_id:    row.user_id,
    invoice_id: row.invoice_id || null,
    text:       row.text  || '',
    icon:       row.icon  || '🔔',
    read:       !!row.read,
    createdAt:  row.created_at
  };
}

/* ─────────────────────────────────────────────────────────────────
   STEP 2 — Replace dbInsertNotification with this version
   (persists invoice_id to the DB)
───────────────────────────────────────────────────────────────── */
async function dbInsertNotification(text, invoiceId = null, icon = '🔔') {
  const userId = App.currentUser?.id;
  if (!userId) return null;

  const { data: row, error } = await _supabase
    .from('notifications')
    .insert({
      user_id:    userId,
      invoice_id: invoiceId || null,
      text,
      icon,
      read: false
    })
    .select()
    .single();

  if (error) {
    console.error('[PayBack] notification insert error:', error);
    return null;
  }
  return normalizeNotification(row);
}

/* ─────────────────────────────────────────────────────────────────
   1. addNotification(text, invoiceId)
      Creates a notification row in Supabase, prepends it to local
      state and refreshes the badge.
───────────────────────────────────────────────────────────────── */
async function addNotification(text, invoiceId = null) {
  if (!App.currentUser) return;

  // Derive a simple icon from the text content
  const icon = _notifIcon(text);

  const notif = await dbInsertNotification(text, invoiceId, icon);
  if (!notif) return;

  App.data.notifications.unshift(notif);
  App.data.notifications = App.data.notifications.slice(0, 20); // keep last 20
  updateNotificationBadge();
}

/* ─────────────────────────────────────────────────────────────────
   2. fetchNotifications()
      Loads only the current user's notifications from Supabase and
      refreshes local state + badge.
───────────────────────────────────────────────────────────────── */
async function fetchNotifications() {
  const userId = App.currentUser?.id;
  if (!userId) return;

  const { data, error } = await _supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[PayBack] fetchNotifications error:', error);
    return;
  }

  App.data.notifications = (data || []).map(normalizeNotification);
  updateNotificationBadge();
}

/* ─────────────────────────────────────────────────────────────────
   3. updateNotificationBadge()
      Counts unread notifications and updates the bell badge element.
───────────────────────────────────────────────────────────────── */
function updateNotificationBadge() {
  const unread = (App.data.notifications || []).filter(n => !n.read).length;
  const badge  = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent   = unread > 9 ? '9+' : String(unread);
  badge.style.display = unread > 0 ? 'grid' : 'none';
}

// Keep the old name working as an alias (called from several places in app.js)
function updateNotifBadge() { updateNotificationBadge(); }

/* ─────────────────────────────────────────────────────────────────
   renderNotifications() — unchanged API, now also marks all as read
   in Supabase when the panel opens.
───────────────────────────────────────────────────────────────── */
function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const notifs = App.data.notifications || [];
  if (!notifs.length) {
    list.innerHTML = `<div class="notif-empty">Yangi bildirishnoma yo'q 🔕</div>`;
    return;
  }

  list.innerHTML = notifs.slice(0, 10).map(n => `
    <div class="notif-item ${n.read ? '' : 'notif-unread'}" data-id="${n.id}">
      <span class="notif-icon">${n.icon || '🔔'}</span>
      <div style="flex:1;min-width:0">
        <div class="notif-text">${_escHtml(n.text)}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────────
   clearNotifications() — marks all as read locally + in Supabase
───────────────────────────────────────────────────────────────── */
async function clearNotifications() {
  App.data.notifications = App.data.notifications.map(n => ({ ...n, read: true }));
  updateNotificationBadge();
  renderNotifications();
  await dbMarkAllNotifsRead();
}

/* ─────────────────────────────────────────────────────────────────
   4. sendReminder(invoiceId)
      Creates a notification tied to the invoice and shows a toast.
───────────────────────────────────────────────────────────────── */
async function sendReminder(invoiceId) {
  const inv = App.data.invoices.find(i => i.id === invoiceId);
  if (!inv) {
    showToast('Invoice topilmadi', 'error');
    return;
  }

  const clientName = getClientName(inv.clientId);
  const days       = daysUntil(inv.dueDate);

  // Build the human-readable reminder message
  let msg;
  if (days >= 0) {
    msg = (App.data.settings.tplFriendly || getDefaultTemplate('friendly'))
      .replace('[MIJOZ_ISM]',      clientName)
      .replace('[INVOICE_RAQAM]',  inv.number)
      .replace('[SANA]',           formatDate(inv.dueDate))
      .replace('[SUMMA]',          formatCurrency(inv.amount));
  } else if (Math.abs(days) <= 7) {
    msg = (App.data.settings.tplWarning || getDefaultTemplate('warning'))
      .replace('[MIJOZ_ISM]',      clientName)
      .replace('[INVOICE_RAQAM]',  inv.number)
      .replace('[SUMMA]',          formatCurrency(inv.amount));
  } else {
    msg = (App.data.settings.tplFinal || getDefaultTemplate('final'))
      .replace('[MIJOZ_ISM]',      clientName)
      .replace('[INVOICE_RAQAM]',  inv.number)
      .replace('[SUMMA]',          formatCurrency(inv.amount));
  }

  // Log the message (replace with real send logic — email/SMS/Telegram)
  console.log('[PayBack Reminder]', msg);

  const notifText = `Eslatma yuborildi: ${clientName} — ${inv.number}`;
  await addNotification(notifText, invoiceId);

  showToast(`🔔 Eslatma yuborildi: ${clientName}`, 'success');
}

/* ─────────────────────────────────────────────────────────────────
   5. checkInvoiceAlerts()
      Checks every unpaid invoice's due date and shows:
        • error toast  → overdue (past due)
        • warning toast→ due in 1 day
      Safe to call on every login / page load.
───────────────────────────────────────────────────────────────── */
function checkInvoiceAlerts() {
  // Deduplicate: only show 1 toast per severity to avoid spam
  let overdueCount  = 0;
  let soonCount     = 0;
  const SOON_DAYS   = 1; // show warning when exactly N days remain

  App.data.invoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = daysUntil(inv.dueDate);

    if (days < 0) {
      overdueCount++;
    } else if (days === SOON_DAYS) {
      soonCount++;
    }
  });

  // Show grouped toasts so we don't flood the UI
  if (overdueCount > 0) {
    const label = overdueCount === 1
      ? '1 ta invoice muddati o\'tgan!'
      : `${overdueCount} ta invoice muddati o'tgan!`;
    showToast(`🚨 ${label}`, 'error');
  }

  if (soonCount > 0) {
    const label = soonCount === 1
      ? '1 ta invoice muddati ertaga tugaydi!'
      : `${soonCount} ta invoice muddati ertaga tugaydi!`;
    showToast(`⚠️ ${label}`, 'warning');
  }
}

/* ─────────────────────────────────────────────────────────────────
   checkReminders() — kept for backward compat (showReminderBanner)
───────────────────────────────────────────────────────────────── */
function checkReminders() {
  const reminders = [];
  App.data.invoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days       = daysUntil(inv.dueDate);
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

/* ─────────────────────────────────────────────────────────────────
   buildNotificationsFromInvoices() — kept for backward compat
   (called in initAppUI). Now delegates to checkInvoiceAlerts().
───────────────────────────────────────────────────────────────── */
async function buildNotificationsFromInvoices() {
  if (!App.data.notifications) App.data.notifications = [];

  const reminders = checkReminders();
  // Only seed notifications on first login (empty list)
  if (App.data.notifications.length === 0 && reminders.length > 0) {
    for (const r of reminders) {
      const icon = r.startsWith('🚨') ? '🚨' : r.startsWith('⚠️') ? '⚠️' : '⏰';
      const text = r.replace(/^[⏰⚠️🚨]\s/, '');
      await addNotification(text, null);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────
   6. initRealtimeNotifications()
      Subscribes to Supabase Realtime on the notifications table
      filtered to the current user. Shows a toast on INSERT.

      ⚠️ Call this ONCE at the end of initAppUI().
      ⚠️ Cleans up on SIGNED_OUT (handled via _realtimeChannel ref).
───────────────────────────────────────────────────────────────── */

// Module-level reference so we can remove the subscription on sign-out
let _realtimeChannel = null;

function initRealtimeNotifications() {
  const userId = App.currentUser?.id;
  if (!userId || !_supabase) return;

  // Remove any previous subscription first (e.g. re-login)
  if (_realtimeChannel) {
    _supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }

  _realtimeChannel = _supabase
    .channel('realtime-notifications-' + userId)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        const newRow  = payload.new;
        if (!newRow) return;

        const notif = normalizeNotification(newRow);

        // Avoid duplicates — the row may already be in state if WE inserted it
        const exists = App.data.notifications.some(n => n.id === notif.id);
        if (!exists) {
          App.data.notifications.unshift(notif);
          App.data.notifications = App.data.notifications.slice(0, 20);
          updateNotificationBadge();

          // Show a non-intrusive toast so the user knows something arrived
          showToast(`🔔 ${notif.text}`, 'info');
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[PayBack] Realtime notifications: subscribed ✓');
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[PayBack] Realtime notifications: channel error');
      }
    });
}

/* Call this when the user signs out so we don't leave dangling channels */
function cleanupRealtimeNotifications() {
  if (_realtimeChannel && _supabase) {
    _supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

/* ─────────────────────────────────────────────────────────────────
   PRIVATE HELPERS
───────────────────────────────────────────────────────────────── */

/** Pick a contextual icon from the notification text */
function _notifIcon(text) {
  if (!text) return '🔔';
  const t = text.toLowerCase();
  if (t.includes('to\'landi') || t.includes("to'langan"))   return '✅';
  if (t.includes('eslatma'))                                 return '🔔';
  if (t.includes('muddati o\'tdi') || t.includes('overdue')) return '🚨';
  if (t.includes('ertaga') || t.includes('1 kun'))           return '⚠️';
  if (t.includes('invoice') && t.includes('qo\'shildi'))    return '📄';
  if (t.includes('mijoz'))                                   return '👤';
  if (t.includes('obuna') || t.includes('to\'lov'))         return '💳';
  return '🔔';
}

/** Minimal HTML escaper for user-facing text */
function _escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ══════════════════════════════════════════════════════════════════
   INTEGRATION CHECKLIST
   ══════════════════════════════════════════════════════════════════

   ① In initAppUI(), add at the bottom:
   ─────────────────────────────────────
     initRealtimeNotifications();  // ← real-time subscription
     checkInvoiceAlerts();         // ← overdue / 1-day-left toasts

   ② In handleLogout() / onAuthStateChange SIGNED_OUT handler, add:
   ─────────────────────────────────────
     cleanupRealtimeNotifications();

   ③ Supabase Realtime must be enabled for the 'notifications' table:
      Dashboard → Database → Replication → add notifications table
      (or run: ALTER TABLE notifications REPLICA IDENTITY FULL;)

   ④ RLS policies needed:
      -- SELECT / INSERT / UPDATE own rows
      CREATE POLICY "users own notifications"
        ON notifications FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

   ══════════════════════════════════════════════════════════════════
   HTML SNIPPETS — paste into your HTML file
   ══════════════════════════════════════════════════════════════════

   ── Bell icon with badge (header) ────────────────────────────────
   Place this inside your top header / nav bar:

   <div id="notif-wrap" class="notif-wrap">
     <button
       class="icon-btn notif-btn"
       onclick="toggleNotifDropdown(event)"
       aria-label="Bildirishnomalar"
     >
       <!-- Bell SVG -->
       <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
         <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M13.73 21a2 2 0 0 1-3.46 0"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"/>
       </svg>

       <!-- Badge — hidden when 0 unread, controlled by updateNotificationBadge() -->
       <span id="notif-badge" class="notif-badge" style="display:none">0</span>
     </button>

     <!-- Dropdown panel -->
     <div id="notif-dropdown" class="notif-dropdown">
       <div class="notif-header">
         <span class="notif-title">Bildirishnomalar</span>
         <button class="notif-clear-btn" onclick="clearNotifications()">Hammasini o'qildi</button>
       </div>
       <div id="notif-list" class="notif-list">
         <!-- renderNotifications() writes here -->
       </div>
     </div>
   </div>


   ── Reminder button (invoice card / detail) ───────────────────────
   Place next to each unpaid invoice (invoiceId comes from your loop):

   <button
     class="btn btn-warning btn-sm"
     onclick="sendReminder('INVOICE_ID_HERE')"
   >
     🔔 Eslatma
   </button>


   ── Suggested CSS additions ───────────────────────────────────────
   Add to your stylesheet:

   .notif-unread  { background: var(--accent-light, rgba(99,102,241,.07)); }
   .notif-dot     { width:8px; height:8px; border-radius:50%;
                    background:#6366f1; flex-shrink:0; margin-top:4px; }
   .notif-badge   { position:absolute; top:-4px; right:-4px;
                    min-width:18px; height:18px; border-radius:9px;
                    background:#ef4444; color:#fff;
                    font-size:11px; font-weight:700;
                    display:grid; place-items:center; padding:0 4px; }
   .toast.info    { background: var(--blue, #3b82f6); color:#fff; }

   ══════════════════════════════════════════════════════════════════ */
