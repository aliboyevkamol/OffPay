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
