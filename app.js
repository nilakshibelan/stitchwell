const STORAGE_KEY = 'lj-boutique-data';
const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbylJi0sVGSAbxxD_WuvuquyYNcqb9P0hgw1l1sZfrjwg0qsTDS2IgGrRs9zc3pB7y1YOg/exec';

const state = {
  members: [],
  vouchers: [],
  lastDraw: null,
  drawHistory: [],
};

const elements = {
  totalMembers: document.getElementById('totalMembers'),
  paidCount: document.getElementById('paidCount'),
  activeVouchers: document.getElementById('activeVouchers'),
  nextDrawLabel: document.getElementById('nextDrawLabel'),
  memberList: document.getElementById('memberList'),
  voucherList: document.getElementById('voucherList'),
  memberForm: document.getElementById('memberForm'),
  showAddMember: document.getElementById('showAddMember'),
  sendBulkReminders: document.getElementById('sendBulkReminders'),
  cancelMember: document.getElementById('cancelMember'),
  memberName: document.getElementById('memberName'),
  memberPhone: document.getElementById('memberPhone'),
  paymentMonth: document.getElementById('paymentMonth'),
  drawMonth: document.getElementById('drawMonth'),
  voucherAmount: document.getElementById('voucherAmount'),
  runDraw: document.getElementById('runDraw'),
  drawResult: document.getElementById('drawResult'),
  winnerName: document.getElementById('winnerName'),
  winnerDetails: document.getElementById('winnerDetails'),
  reportMonth: document.getElementById('reportMonth'),
  reportCards: document.getElementById('reportCards'),
  reportDetails: document.getElementById('reportDetails'),
  themeToggle: document.getElementById('themeToggle'),
  syncStatus: document.getElementById('syncStatus'),
  syncButton: document.getElementById('syncButton'),
};

const REMOTE_SYNC_ENABLED = Boolean(SHEETS_ENDPOINT);

let editingMemberId = null;

const views = document.querySelectorAll('.view');
const tabButtons = document.querySelectorAll('.tab-button');

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function saveRemoteState() {
  if (!REMOTE_SYNC_ENABLED) {
    throw new Error('Remote sync endpoint not configured.');
  }

  const response = await fetch(SHEETS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(state),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets sync failed: ${response.statusText}`);
  }
}

function saveState() {
  saveLocalState();
  if (REMOTE_SYNC_ENABLED) {
    saveRemoteState()
      .then(() => updateSyncStatus('Synced with Google Sheets'))
      .catch((err) => updateSyncStatus(`Sync failed: ${err.message}`, true));
  }
}

function loadLocalState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.members = parsed.members || [];
    state.vouchers = parsed.vouchers || [];
    state.lastDraw = parsed.lastDraw || null;
    state.drawHistory = parsed.drawHistory || [];
  } catch (err) {
    console.warn('Error loading saved data', err);
  }
}

async function loadRemoteState() {
  if (!REMOTE_SYNC_ENABLED) {
    return null;
  }

  const response = await fetch(SHEETS_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Google Sheets load failed: ${response.statusText}`);
  }

  const remoteData = await response.json();
  return remoteData;
}

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function buildReminderMessage(member) {
  return encodeURIComponent(`Hi ${member.name},\n\nThis is Stitchwell. Your ₹200 monthly payment is due for this month. Please pay before the next lucky draw to keep your entry active.\n\nThank you!`);
}

function sendWhatsAppMessage(phone, message) {
  if (!phone) {
    return false;
  }

  const url = `https://wa.me/${phone}?text=${message}`;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }

  return true;
}

function updateSyncStatus(message, isError = false) {
  if (!elements.syncStatus) return;
  elements.syncStatus.textContent = message;
  elements.syncStatus.style.color = isError ? '#b91c1c' : 'inherit';
}

async function syncRemoteData() {
  if (!REMOTE_SYNC_ENABLED) {
    updateSyncStatus('Set SHEETS_ENDPOINT in app.js to enable Google Sheets sync.', true);
    return;
  }

  updateSyncStatus('Syncing with Google Sheets...');
  try {
    await saveRemoteState();
    updateSyncStatus('Synced with Google Sheets');
  } catch (err) {
    updateSyncStatus(`Sync failed: ${err.message}`, true);
  }
}

async function initializeData() {
  loadLocalState();
  if (REMOTE_SYNC_ENABLED) {
    try {
      const remote = await loadRemoteState();
      if (remote) {
        state.members = remote.members || state.members;
        state.vouchers = remote.vouchers || state.vouchers;
        state.lastDraw = remote.lastDraw || state.lastDraw;
        state.drawHistory = remote.drawHistory || state.drawHistory;
        saveLocalState();
        updateSyncStatus('Loaded data from Google Sheets');
      }
    } catch (err) {
      updateSyncStatus(`Remote load failed: ${err.message}`, true);
    }
  } else {
    updateSyncStatus('Offline mode: using local browser storage.');
  }
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getPaymentMonth() {
  if (elements.paymentMonth && elements.paymentMonth.value) {
    return elements.paymentMonth.value;
  }
  return new Date().toISOString().slice(0, 7);
}

function isMemberPaidForMonth(member, month) {
  if (!member.paymentHistory || !month) return false;
  return member.paymentHistory.some(entry => entry.month === month && entry.paid);
}

function setMemberPaymentForMonth(member, month, paid) {
  if (!member.paymentHistory) member.paymentHistory = [];
  const existing = member.paymentHistory.find(entry => entry.month === month);
  if (existing) {
    existing.paid = paid;
  } else {
    member.paymentHistory.push({ month, paid });
  }
}

function getPreviousMonth(month) {
  const date = new Date(`${month}-01`);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function updateDashboard() {
  const monthValue = getPaymentMonth();
  const paid = state.members.filter(member => isMemberPaidForMonth(member, monthValue)).length;
  const active = state.vouchers.filter(v => v.status === 'active').length;

  elements.totalMembers.textContent = state.members.length;
  elements.paidCount.textContent = paid;
  elements.activeVouchers.textContent = active;

  if (elements.drawMonth.value) {
    const date = new Date(elements.drawMonth.value + '-01');
    elements.nextDrawLabel.textContent = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } else {
    elements.nextDrawLabel.textContent = 'Pick a month';
  }
}

function createMemberRow(member) {
  const row = document.createElement('div');
  row.className = 'member-row';

  const info = document.createElement('div');
  info.className = 'member-info';
  const name = document.createElement('p');
  name.className = 'member-name';
  name.textContent = member.name;
  const meta = document.createElement('p');
  meta.className = 'member-meta';
  const payments = member.paymentHistory || [];
  const lastPayment = payments.length ? payments[payments.length - 1].month : 'No month';
  const paymentMonth = getPaymentMonth();
  const paidThisMonth = isMemberPaidForMonth(member, paymentMonth);
  meta.textContent = `${member.phone ? member.phone : 'No phone added'} • Last payment ${lastPayment}`;
  info.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'member-meta';
  const status = document.createElement('span');
  status.className = `badge ${paidThisMonth ? 'paid' : 'due'}`;
  status.textContent = paidThisMonth ? 'Paid' : 'Not paid';
  const toggle = document.createElement('button');
  toggle.textContent = paidThisMonth ? 'Mark due' : 'Mark paid';
  toggle.className = 'secondary-button';
  toggle.onclick = () => {
    setMemberPaymentForMonth(member, paymentMonth, !paidThisMonth);
    saveState();
    renderMembers();
    updateDashboard();
  };
  actions.append(status, toggle);

  if (!paidThisMonth && member.phone) {
    const remind = document.createElement('button');
    remind.textContent = 'Send reminder';
    remind.className = 'secondary-button';
    remind.onclick = () => {
      const normalized = normalizePhone(member.phone);
      if (!normalized) {
        alert('Please enter a valid phone number for this member.');
        return;
      }
      sendWhatsAppMessage(normalized, buildReminderMessage(member));
    };
    actions.append(remind);
  }

  const edit = document.createElement('button');
  edit.textContent = 'Edit';
  edit.className = 'secondary-button';
  edit.onclick = () => openMemberForm(member);
  actions.append(edit);

  const remove = document.createElement('button');
  remove.textContent = 'Delete';
  remove.className = 'secondary-button';
  remove.onclick = () => {
    const confirmed = confirm(`Delete ${member.name}? This will remove their payment history and membership data.`);
    if (!confirmed) return;
    state.members = state.members.filter(m => m.id !== member.id);
    saveState();
    renderMembers();
    updateDashboard();
  };
  actions.append(remove);

  row.append(info, actions);
  return row;
}

function renderMembers() {
  elements.memberList.innerHTML = '';
  if (state.members.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No members added yet.';
    empty.style.color = 'var(--muted)';
    elements.memberList.appendChild(empty);
    return;
  }
  state.members.forEach(member => elements.memberList.appendChild(createMemberRow(member)));
}

function createVoucherRow(voucher) {
  const row = document.createElement('div');
  row.className = 'voucher-row';

  const info = document.createElement('div');
  info.className = 'voucher-info';
  const name = document.createElement('p');
  name.className = 'voucher-name';
  name.textContent = voucher.memberName;
  const meta = document.createElement('p');
  meta.className = 'voucher-meta';
  meta.textContent = `₹${voucher.amount} • Expires ${formatDate(voucher.expiryDate)}`;
  info.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'voucher-meta';
  const badge = document.createElement('span');
  badge.className = `badge ${voucher.status}`;
  badge.textContent = voucher.status === 'active' ? 'Active' : voucher.status === 'used' ? 'Used' : 'Expired';
  actions.appendChild(badge);

  if (voucher.status === 'active') {
    const button = document.createElement('button');
    button.textContent = 'Mark used';
    button.className = 'secondary-button';
    button.onclick = () => {
      voucher.status = 'used';
      saveState();
      renderVouchers();
      updateDashboard();
    };
    actions.appendChild(button);
  }
  row.append(info, actions);
  return row;
}

function renderVouchers() {
  elements.voucherList.innerHTML = '';
  const now = new Date();
  state.vouchers.forEach(v => {
    if (v.status === 'active' && new Date(v.expiryDate) < now) {
      v.status = 'expired';
    }
  });
  saveState();

  if (state.vouchers.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No vouchers issued yet.';
    empty.style.color = 'var(--muted)';
    elements.voucherList.appendChild(empty);
    return;
  }
  state.vouchers.forEach(v => elements.voucherList.appendChild(createVoucherRow(v)));
}

function buildReportData(month) {
  const paidThisMonth = state.members.filter(member => isMemberPaidForMonth(member, month)).length;
  const unpaidThisMonth = state.members.length - paidThisMonth;
  const vouchersIssued = state.vouchers.filter(v => v.drawMonth === month).length;
  const activeVouchers = state.vouchers.filter(v => v.status === 'active').length;
  const usedVouchers = state.vouchers.filter(v => v.status === 'used').length;
  const expiredVouchers = state.vouchers.filter(v => v.status === 'expired').length;
  const drawThisMonth = state.drawHistory.filter(draw => draw.month === month);

  return {
    month,
    totalMembers: state.members.length,
    paidThisMonth,
    unpaidThisMonth,
    vouchersIssued,
    activeVouchers,
    usedVouchers,
    expiredVouchers,
    drawWinner: drawThisMonth.length ? drawThisMonth[drawThisMonth.length - 1].winnerName : 'N/A',
    drawAmount: drawThisMonth.length ? drawThisMonth[drawThisMonth.length - 1].amount : 0,
  };
}

function renderReports() {
  const month = elements.reportMonth.value || new Date().toISOString().slice(0, 7);
  const report = buildReportData(month);

  elements.reportCards.innerHTML = '';
  const cards = [
    { title: 'Members', value: report.totalMembers, subtitle: 'Total registered' },
    { title: 'Paid', value: report.paidThisMonth, subtitle: `Paid in ${month}` },
    { title: 'Unpaid', value: report.unpaidThisMonth, subtitle: `Not paid in ${month}` },
    { title: 'Vouchers', value: report.vouchersIssued, subtitle: 'Issued this month' },
  ];

  cards.forEach(card => {
    const article = document.createElement('article');
    article.className = 'card';
    article.innerHTML = `<h2>${card.title}</h2><p>${card.value}</p><p class="card-meta">${card.subtitle}</p>`;
    elements.reportCards.appendChild(article);
  });

  elements.reportDetails.innerHTML = `
    <h3>Month summary for ${new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
    <div class="report-grid">
      <div class="report-item"><strong>Active vouchers</strong><span>${report.activeVouchers}</span></div>
      <div class="report-item"><strong>Used vouchers</strong><span>${report.usedVouchers}</span></div>
      <div class="report-item"><strong>Expired vouchers</strong><span>${report.expiredVouchers}</span></div>
      <div class="report-item"><strong>Draw winner</strong><span>${report.drawWinner}</span></div>
      <div class="report-item"><strong>Winner amount</strong><span>₹${report.drawAmount}</span></div>
    </div>
  `;
}

function updateMemberPaymentPreview() {
  renderMembers();
  updateDashboard();
}

function showView(viewId) {
  views.forEach(view => view.classList.toggle('active-view', view.id === viewId));
  tabButtons.forEach(button => button.classList.toggle('active', button.dataset.view === viewId));
}

function setMemberFormMode(isEditing) {
  const submitButton = elements.memberForm.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.textContent = isEditing ? 'Update Member' : 'Save Member';
  }
}

function resetForm() {
  editingMemberId = null;
  elements.memberName.value = '';
  elements.memberPhone.value = '';
  elements.memberForm.classList.add('hidden');
  setMemberFormMode(false);
}

function showAddMemberForm() {
  resetForm();
  elements.memberForm.classList.remove('hidden');
  elements.memberName.focus();
}

function openMemberForm(member) {
  editingMemberId = member.id;
  elements.memberName.value = member.name;
  elements.memberPhone.value = member.phone || '';
  elements.memberForm.classList.remove('hidden');
  setMemberFormMode(true);
  elements.memberName.focus();
}

function sendBulkWhatsAppReminders() {
  const monthValue = getPaymentMonth();
  const unpaidMembers = state.members.filter(member => !isMemberPaidForMonth(member, monthValue) && member.phone);

  if (unpaidMembers.length === 0) {
    alert('There are no unpaid members with phone numbers to remind.');
    return;
  }

  const confirmation = confirm(`Send reminders to ${unpaidMembers.length} unpaid member(s)? This will open WhatsApp chats for each phone number.`);
  if (!confirmation) return;

  unpaidMembers.forEach((member, index) => {
    const normalized = normalizePhone(member.phone);
    if (!normalized) return;
    setTimeout(() => {
      sendWhatsAppMessage(normalized, buildReminderMessage(member));
    }, index * 500);
  });
}

function addMember(event) {
  event.preventDefault();
  const name = elements.memberName.value.trim();
  const phone = elements.memberPhone.value.trim();
  if (!name) return;

  if (editingMemberId) {
    const member = state.members.find(m => m.id === editingMemberId);
    if (member) {
      member.name = name;
      member.phone = phone;
    }
  } else {
    state.members.push({
      id: Date.now().toString(),
      name,
      phone,
      paidThisMonth: false,
      paymentHistory: [],
    });
  }

  saveState();
  renderMembers();
  updateDashboard();
  resetForm();
}

function runLuckyDraw() {
  const monthValue = elements.drawMonth.value;
  const amount = Number(elements.voucherAmount.value) || 2400;
  if (!monthValue || state.members.length === 0) {
    alert('Add members and select a draw month first.');
    return;
  }

  const entries = state.members.filter(member => isMemberPaidForMonth(member, getPaymentMonth()));
  if (entries.length === 0) {
    alert('No paid members available for the draw.');
    return;
  }

  const winner = entries[Math.floor(Math.random() * entries.length)];
  const expiry = new Date(monthValue + '-01');
  expiry.setMonth(expiry.getMonth() + 2);

  const voucher = {
    id: Date.now().toString(),
    memberId: winner.id,
    memberName: winner.name,
    amount,
    issuedDate: new Date().toISOString(),
    expiryDate: expiry.toISOString(),
    status: 'active',
    drawMonth: monthValue,
  };
  state.vouchers.push(voucher);
  state.lastDraw = {
    month: monthValue,
    winnerName: winner.name,
    amount,
    issuedDate: new Date().toISOString(),
  };
  state.drawHistory.push(state.lastDraw);
  saveState();
  renderVouchers();
  updateDashboard();
  showDrawResult();
}

function showDrawResult() {
  if (!state.lastDraw) return;
  elements.drawResult.hidden = false;
  elements.winnerName.textContent = `${state.lastDraw.winnerName}`;
  elements.winnerDetails.textContent = `₹${state.lastDraw.amount} voucher issued for draw ${new Date(state.lastDraw.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = current === 'dark' ? 'light' : 'dark';
  elements.themeToggle.textContent = current === 'dark' ? '☀️' : '🌙';
}

function init() {
  initializeData().then(() => {
    renderMembers();
    renderVouchers();
    updateDashboard();
    showDrawResult();
  });

  tabButtons.forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });

  document.querySelectorAll('[data-view="dashboard"]').forEach(el => el.addEventListener('click', () => showView('dashboard')));
  document.querySelectorAll('[data-view="members"]').forEach(el => el.addEventListener('click', () => showView('members')));

  elements.showAddMember.addEventListener('click', showAddMemberForm);
  elements.sendBulkReminders.addEventListener('click', sendBulkWhatsAppReminders);
  elements.cancelMember.addEventListener('click', resetForm);
  elements.memberForm.addEventListener('submit', addMember);
  elements.runDraw.addEventListener('click', runLuckyDraw);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.syncButton.addEventListener('click', syncRemoteData);
  elements.reportMonth.addEventListener('change', renderReports);
  elements.paymentMonth.addEventListener('change', () => {
    const paymentValue = elements.paymentMonth.value;
    if (elements.reportMonth) {
      elements.reportMonth.value = paymentValue;
    }
    if (elements.drawMonth) {
      elements.drawMonth.value = paymentValue;
    }
    updateMemberPaymentPreview();
    renderReports();
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  if (elements.paymentMonth && !elements.paymentMonth.value) elements.paymentMonth.value = currentMonth;
  if (elements.reportMonth && !elements.reportMonth.value) elements.reportMonth.value = elements.paymentMonth.value || currentMonth;
  if (elements.drawMonth && !elements.drawMonth.value) elements.drawMonth.value = elements.paymentMonth.value || currentMonth;
  renderReports();
}

init();
