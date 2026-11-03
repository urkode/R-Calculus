/* Admin unlock and database activity log. The code itself is only checked in the Worker. */
(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Kunne ikke hente adminloggen.');
    return payload;
  };
  const formatTime = value => {
    const date = new Date(`${String(value).replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? String(value || '') : new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };
  const actionLabel = action => ({ created: 'Opprettet', updated: 'Oppdatert', deleted: 'Slettet' }[action] || action);
  const entryName = entry => {
    try {
      const data = JSON.parse(entry.newValue || '{}');
      return data.name || (entry.entityType === 'rates' ? 'Satser' : entry.entityId);
    } catch (_) { return entry.entityType === 'rates' ? 'Satser' : entry.entityId; }
  };

  function element() {
    let dialog = document.getElementById('adminLogDialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'adminLogDialog';
    dialog.className = 'admin-log-dialog hidden';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    return dialog;
  }

  function close() {
    const dialog = document.getElementById('adminLogDialog');
    if (!dialog || dialog.classList.contains('hidden') || dialog.classList.contains('is-closing')) return;
    dialog.classList.add('is-closing');
    setTimeout(() => {
      dialog.classList.add('hidden');
      dialog.classList.remove('is-closing');
    }, 280);
  }

  function unlockView(message = '') {
    const dialog = element();
    dialog.innerHTML = `<section class="admin-log-card admin-unlock-card">
      <header><div><span>R KALKYLE</span><h2>Logg</h2></div><button type="button" data-admin-close aria-label="Lukk">&times;</button></header>
      <p>Oppgi adminkode for å åpne aktivitetsloggen.</p>
      <label>Adminkode<input id="adminLogPassword" type="password" autocomplete="current-password" enterkeyhint="done"></label>
      <p id="adminLogError" class="admin-log-error">${escapeHtml(message)}</p>
      <button id="adminLogUnlock" type="button" class="admin-primary">Åpne logg</button>
    </section>`;
    dialog.classList.remove('hidden', 'is-closing');
    dialog.querySelector('[data-admin-close]').onclick = close;
    const submit = async () => {
      const password = dialog.querySelector('#adminLogPassword').value;
      if (!password) return;
      const button = dialog.querySelector('#adminLogUnlock');
      button.disabled = true;
      try {
        await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) });
        await panelView();
      } catch (error) {
        button.disabled = false;
        dialog.querySelector('#adminLogError').textContent = error.message;
      }
    };
    dialog.querySelector('#adminLogUnlock').onclick = submit;
    dialog.querySelector('#adminLogPassword').addEventListener('keydown', event => {
      if (event.key === 'Enter') submit();
    });
  }

  async function activityContent() {
    const { entries = [] } = await api('/api/admin/audit?limit=150');
    if (!entries.length) return '<p class="admin-empty">Ingen registrerte endringer ennå.</p>';
    return `<div class="admin-audit-list">${entries.map(entry => `<article class="admin-audit-entry">
      <div><b>${escapeHtml(actionLabel(entry.action))}</b><strong>${escapeHtml(entryName(entry))}</strong></div>
      <small>${escapeHtml(entry.changedBy || 'Innlogget bruker')} · ${escapeHtml(formatTime(entry.createdAt))}</small>
    </article>`).join('')}</div>`;
  }

  async function panelView() {
    const dialog = element();
    dialog.innerHTML = `<section class="admin-log-card">
      <header><div><span>R KALKYLE</span><h2>Logg</h2></div><button type="button" data-admin-close aria-label="Lukk">&times;</button></header>
      <div id="adminLogContent" class="admin-log-content"><p class="admin-loading">Henter data …</p></div>
      <button id="adminLogLock" type="button" class="admin-secondary">Lås adminpanel</button>
    </section>`;
    dialog.classList.remove('hidden', 'is-closing');
    dialog.querySelector('[data-admin-close]').onclick = close;
    dialog.querySelector('#adminLogLock').onclick = async () => {
      await api('/api/admin/session', { method: 'DELETE' }).catch(() => {});
      unlockView();
    };
    const showLog = async () => {
      const content = dialog.querySelector('#adminLogContent');
      content.innerHTML = '<p class="admin-loading">Henter data …</p>';
      try {
        content.innerHTML = await activityContent();
      } catch (error) {
        content.innerHTML = `<p class="admin-log-error">${escapeHtml(error.message)}</p>`;
      }
    };
    await showLog();
  }

  async function open() {
    try {
      const status = await api('/api/admin/session');
      if (status.admin) return panelView();
    } catch (_) {}
    unlockView();
  }

  globalThis.AdminLog = { open };
  globalThis.Rates = { ...(globalThis.Rates || {}), open };
})();
