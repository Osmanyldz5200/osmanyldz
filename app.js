// =====================================================
//  OsmanYLDZ İş Asistanı — Firebase + Full App JS
// =====================================================

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCAYX4QxSt2bb5qydKC_kJ2mf_0USkJ09M",
  authDomain: "osman-yldz.firebaseapp.com",
  projectId: "osman-yldz",
  storageBucket: "osman-yldz.firebasestorage.app",
  messagingSenderId: "38554991284",
  appId: "1:38554991284:web:e18f624e6329d00ae5b5e1"
};

// --- GLOBAL STATE ---
let db = null;
let state = {
  workData: [],
  contacts: [],
  barcodeHistory: [],
  activeView: 'dashboard',
  dataFilter: 'Tümü',
  contactFilter: 'Tümü',
  scannerRunning: false,
  ocrStream: null,
  currentBarcodeText: '',
  editingDataId: null,
  editingContactId: null,
};

let confirmCallback = null;

// =====================================================
// FIREBASE INIT & REALTIME LISTENERS
// =====================================================
function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    setFirebaseStatus('connected');

    // Realtime listeners
    db.collection('workData').orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        state.workData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderDataView();
        updateDashboard();
      }, err => {
        console.error('workData listener error:', err);
        setFirebaseStatus('error');
      });

    db.collection('contacts').orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        state.contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderContactsView();
        updateDashboard();
      }, err => {
        console.error('contacts listener error:', err);
      });

    db.collection('barcodeHistory').orderBy('createdAt', 'desc').limit(50)
      .onSnapshot(snap => {
        state.barcodeHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderBarcodeHistory();
      });

  } catch (e) {
    console.error('Firebase init error:', e);
    setFirebaseStatus('error');
  }
}

function setFirebaseStatus(status) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const badge = document.getElementById('settings-status-badge');
  if (status === 'connected') {
    dot?.classList.add('connected');
    dot?.classList.remove('error');
    if (text) text.textContent = 'Bağlı';
    if (badge) { badge.textContent = 'Bağlı'; badge.className = 'status-badge'; }
  } else if (status === 'error') {
    dot?.classList.add('error');
    dot?.classList.remove('connected');
    if (text) text.textContent = 'Bağlantı Hatası';
    if (badge) { badge.textContent = 'Bağlantı Hatası'; badge.className = 'status-badge error'; }
  }
}

// =====================================================
// NAVIGATION
// =====================================================
const viewTitles = {
  dashboard: 'Panel',
  data: 'İş Verileri',
  barcode: 'Barkod Üretici',
  scanner: 'Kamera Tarayıcı',
  contacts: 'Rehber',
  settings: 'Ayarlar'
};

function navigateTo(view) {
  // Deactivate all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));

  // Activate target view
  document.getElementById('view-' + view)?.classList.add('active');
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav-item[data-view="${view}"]`)?.classList.add('active');

  // Update title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = viewTitles[view] || view;

  state.activeView = view;
  closeSidebar();

  // Stop scanner if leaving scanner view
  if (view !== 'scanner' && state.scannerRunning) {
    stopScanner();
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// =====================================================
// DASHBOARD
// =====================================================
function updateDashboard() {
  // Stats
  document.getElementById('stat-data').textContent = state.workData.length;
  document.getElementById('stat-contacts').textContent = state.contacts.length;
  document.getElementById('stat-barcode').textContent = state.barcodeHistory.length;

  // Nav badges
  document.getElementById('nav-badge-data').textContent = state.workData.length;
  document.getElementById('nav-badge-contacts').textContent = state.contacts.length;

  // Recent work
  const recentWork = document.getElementById('recent-work-list');
  if (recentWork) {
    const items = state.workData.slice(0, 4);
    if (items.length === 0) {
      recentWork.innerHTML = '<div class="empty-state-sm"><p>Henüz kayıt yok</p></div>';
    } else {
      recentWork.innerHTML = items.map(item => `
        <div class="recent-item" onclick="navigateTo('data')">
          <div class="recent-item-icon" style="background:var(--accent-blue-dim); color:var(--accent-blue);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="recent-item-text">
            <div class="recent-item-title">${escHtml(item.title)}</div>
            <div class="recent-item-sub">${escHtml(item.category)}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Recent contacts
  const recentContacts = document.getElementById('recent-contacts-list');
  if (recentContacts) {
    const items = state.contacts.slice(0, 4);
    if (items.length === 0) {
      recentContacts.innerHTML = '<div class="empty-state-sm"><p>Henüz kişi yok</p></div>';
    } else {
      recentContacts.innerHTML = items.map(item => `
        <div class="recent-item" onclick="navigateTo('contacts')">
          <div class="recent-item-icon" style="background:var(--accent-purple-dim); color:var(--accent-purple);">
            ${avatarLetter(item.name)}
          </div>
          <div class="recent-item-text">
            <div class="recent-item-title">${escHtml(item.name)}</div>
            <div class="recent-item-sub">${escHtml(item.role || item.category || '')}</div>
          </div>
        </div>
      `).join('');
    }
  }
}

function avatarLetter(name) {
  const letter = (name || '?')[0].toUpperCase();
  return `<span style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:700;">${letter}</span>`;
}

// =====================================================
// CLOCK
// =====================================================
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();

  // Saat
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const clockEl = document.getElementById('time-clock');
  if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;

  // Tarih
  const dateStr = now.toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const dateEl = document.getElementById('time-date');
  if (dateEl) dateEl.textContent = dateStr;

  // Yılın kaçıncı günü
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const dayNumEl = document.getElementById('time-day-num');
  if (dayNumEl) dayNumEl.textContent = dayOfYear;
}

// =====================================================
// DATA VIEW
// =====================================================
const DATA_CATEGORIES = ['Tümü', 'Banka IP Listesi', 'Genel Notlar', 'Teknik', 'Finans', 'Diğer'];

function renderDataView() {
  renderDataFilters();
  filterData();
}

function renderDataFilters() {
  const container = document.getElementById('data-category-filters');
  if (!container) return;

  const categories = ['Tümü', ...new Set(state.workData.map(d => d.category).filter(Boolean)), ...DATA_CATEGORIES.slice(1)];
  const unique = [...new Set(categories)];

  container.innerHTML = unique.map(cat => `
    <button class="filter-chip ${state.dataFilter === cat ? 'active' : ''}" onclick="setDataFilter('${escHtml(cat)}')">${escHtml(cat)}</button>
  `).join('');
}

function setDataFilter(cat) {
  state.dataFilter = cat;
  renderDataFilters();
  filterData();
}

function filterData() {
  const search = (document.getElementById('data-search')?.value || '').toLowerCase();
  const filtered = state.workData.filter(item => {
    const matchCat = state.dataFilter === 'Tümü' || item.category === state.dataFilter;
    const matchSearch = !search ||
      item.title?.toLowerCase().includes(search) ||
      item.body?.toLowerCase().includes(search) ||
      item.adslIp?.toLowerCase().includes(search) ||
      item.mobilIp?.toLowerCase().includes(search) ||
      (item.tags || []).some(t => t.toLowerCase().includes(search));
    return matchCat && matchSearch;
  });
  renderDataList(filtered);
}

function getCatClass(cat) {
  if (!cat) return 'cat-diger';
  const lower = cat.toLowerCase();
  if (lower.includes('banka') || lower.includes('ip')) return 'cat-banka';
  if (lower.includes('genel') || lower.includes('not')) return 'cat-genel';
  return 'cat-diger';
}

function renderDataList(items) {
  const container = document.getElementById('data-list');
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <h3>Kayıt Bulunamadı</h3>
        <p>Yeni kayıt eklemek için "Yeni Kayıt" butonuna basın.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const hasIp = item.adslIp || item.mobilIp;
    return `
      <div class="data-card">
        <div class="data-card-top">
          <div class="data-card-title">${escHtml(item.title)}</div>
          <span class="data-card-category ${getCatClass(item.category)}">${escHtml(item.category || 'Diğer')}</span>
        </div>
        ${hasIp ? `
        <div class="ip-grid">
          ${item.adslIp ? `<div class="ip-item">
            <div class="ip-label">ADSL IP</div>
            <div class="ip-value">${escHtml(item.adslIp)}</div>
            ${item.adslPort ? `<div class="ip-port">Port: ${escHtml(item.adslPort)}</div>` : ''}
          </div>` : ''}
          ${item.mobilIp ? `<div class="ip-item">
            <div class="ip-label">Mobil IP</div>
            <div class="ip-value">${escHtml(item.mobilIp)}</div>
            ${item.mobilPort ? `<div class="ip-port">Port: ${escHtml(item.mobilPort)}</div>` : ''}
          </div>` : ''}
        </div>` : ''}
        ${item.body ? `<div class="data-card-body">${escHtml(item.body)}</div>` : ''}
        <div class="data-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditDataModal('${item.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Düzenle
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteData('${item.id}', '${escHtml(item.title).replace(/'/g,"\\'")}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
            </svg>
            Sil
          </button>
        </div>
      </div>`;
  }).join('');
}

// --- ADD / EDIT DATA MODAL ---
function openAddDataModal() {
  state.editingDataId = null;
  document.getElementById('modal-title').textContent = 'Yeni İş Kaydı';
  document.getElementById('modal-body').innerHTML = dataFormHTML({});
  openModal();
}

function openEditDataModal(id) {
  const item = state.workData.find(d => d.id === id);
  if (!item) return;
  state.editingDataId = id;
  document.getElementById('modal-title').textContent = 'Kaydı Düzenle';
  document.getElementById('modal-body').innerHTML = dataFormHTML(item);
  openModal();
}

function dataFormHTML(item) {
  return `
    <div class="form-group">
      <label class="form-label">Başlık *</label>
      <input type="text" id="f-title" class="form-control" placeholder="Kayıt başlığı..." value="${escHtml(item.title||'')}">
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <select id="f-category" class="form-control">
        ${['Banka IP Listesi','Genel Notlar','Teknik','Finans','Diğer'].map(c =>
          `<option value="${c}" ${item.category===c?'selected':''}>${c}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">ADSL IP</label>
        <input type="text" id="f-adsl-ip" class="form-control" placeholder="192.168.x.x" value="${escHtml(item.adslIp||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">ADSL Port</label>
        <input type="text" id="f-adsl-port" class="form-control" placeholder="8080" value="${escHtml(item.adslPort||'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Mobil IP</label>
        <input type="text" id="f-mobil-ip" class="form-control" placeholder="10.x.x.x" value="${escHtml(item.mobilIp||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Mobil Port</label>
        <input type="text" id="f-mobil-port" class="form-control" placeholder="9090" value="${escHtml(item.mobilPort||'')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notlar / Açıklama</label>
      <textarea id="f-body" class="form-control" placeholder="Açıklama, talimatlar...">${escHtml(item.body||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Etiketler (virgülle ayırın)</label>
      <input type="text" id="f-tags" class="form-control" placeholder="örn: banka, ip, kritik" value="${(item.tags||[]).join(', ')}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
      <button class="btn btn-primary" onclick="saveData()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Kaydet
      </button>
    </div>`;
}

async function saveData() {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { showToast('Başlık boş olamaz!', 'error'); return; }

  const data = {
    title,
    category: document.getElementById('f-category')?.value || 'Diğer',
    adslIp: document.getElementById('f-adsl-ip')?.value.trim() || '',
    adslPort: document.getElementById('f-adsl-port')?.value.trim() || '',
    mobilIp: document.getElementById('f-mobil-ip')?.value.trim() || '',
    mobilPort: document.getElementById('f-mobil-port')?.value.trim() || '',
    body: document.getElementById('f-body')?.value.trim() || '',
    tags: document.getElementById('f-tags')?.value.split(',').map(t => t.trim()).filter(Boolean) || [],
  };

  try {
    if (state.editingDataId) {
      await db.collection('workData').doc(state.editingDataId).update(data);
      showToast('Kayıt güncellendi!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('workData').add(data);
      showToast('Kayıt eklendi!', 'success');
    }
    closeModal();
  } catch (e) {
    console.error(e);
    showToast('Hata: ' + e.message, 'error');
  }
}

async function deleteData(id) {
  try {
    await db.collection('workData').doc(id).delete();
    showToast('Kayıt silindi.', 'info');
  } catch (e) {
    showToast('Silme hatası: ' + e.message, 'error');
  }
}

function confirmDeleteData(id, title) {
  showConfirm(`"${title}" kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`, () => deleteData(id));
}

// =====================================================
// CONTACTS VIEW
// =====================================================
function renderContactsView() {
  renderContactFilters();
  filterContacts();
}

function renderContactFilters() {
  const container = document.getElementById('contact-category-filters');
  if (!container) return;
  const categories = ['Tümü', ...new Set(state.contacts.map(c => c.category).filter(Boolean))];
  container.innerHTML = categories.map(cat => `
    <button class="filter-chip ${state.contactFilter === cat ? 'active' : ''}" onclick="setContactFilter('${escHtml(cat)}')">${escHtml(cat)}</button>
  `).join('');
}

function setContactFilter(cat) {
  state.contactFilter = cat;
  renderContactFilters();
  filterContacts();
}

function filterContacts() {
  const search = (document.getElementById('contact-search')?.value || '').toLowerCase();
  const filtered = state.contacts.filter(c => {
    const matchCat = state.contactFilter === 'Tümü' || c.category === state.contactFilter;
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search) ||
      c.role?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });
  renderContactsList(filtered);
}

function renderContactsList(items) {
  const container = document.getElementById('contacts-list');
  if (!container) return;
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        </svg>
        <h3>Kişi Bulunamadı</h3>
        <p>Yeni kişi eklemek için "Kişi Ekle" butonuna basın.</p>
      </div>`;
    return;
  }
  container.innerHTML = items.map(c => `
    <div class="contact-card">
      <div class="contact-header">
        <div class="contact-avatar">${(c.name||'?')[0].toUpperCase()}</div>
        <div>
          <div class="contact-name">${escHtml(c.name)}</div>
          ${c.role ? `<div class="contact-role">${escHtml(c.role)}</div>` : ''}
        </div>
      </div>
      ${c.category ? `<span class="contact-category">${escHtml(c.category)}</span>` : ''}
      <div class="contact-info">
        ${c.phone ? `<div class="contact-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          <a href="tel:${escHtml(c.phone)}">${escHtml(c.phone)}</a>
        </div>` : ''}
        ${c.email ? `<div class="contact-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a>
        </div>` : ''}
        ${c.notes ? `<div class="contact-info-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          </svg>
          <span>${escHtml(c.notes)}</span>
        </div>` : ''}
      </div>
      <div class="contact-card-actions">
        <button class="btn btn-ghost btn-sm" onclick="openEditContactModal('${c.id}')">Düzenle</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteContact('${c.id}', '${escHtml(c.name).replace(/'/g,"\\'")}')">Sil</button>
      </div>
    </div>`).join('');
}

function openAddContactModal() {
  state.editingContactId = null;
  document.getElementById('modal-title').textContent = 'Yeni Kişi Ekle';
  document.getElementById('modal-body').innerHTML = contactFormHTML({});
  openModal();
}

function openEditContactModal(id) {
  const item = state.contacts.find(c => c.id === id);
  if (!item) return;
  state.editingContactId = id;
  document.getElementById('modal-title').textContent = 'Kişiyi Düzenle';
  document.getElementById('modal-body').innerHTML = contactFormHTML(item);
  openModal();
}

function contactFormHTML(c) {
  return `
    <div class="form-group">
      <label class="form-label">Ad Soyad *</label>
      <input type="text" id="c-name" class="form-control" placeholder="Ad Soyad" value="${escHtml(c.name||'')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Unvan / Görev</label>
        <input type="text" id="c-role" class="form-control" placeholder="IT Uzmanı..." value="${escHtml(c.role||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select id="c-category" class="form-control">
          ${['Şirket İçi','Tedarikçi','Müşteri','Banka','Diğer'].map(cat =>
            `<option value="${cat}" ${c.category===cat?'selected':''}>${cat}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Telefon</label>
        <input type="tel" id="c-phone" class="form-control" placeholder="0555 123 4567" value="${escHtml(c.phone||'')}">
      </div>
      <div class="form-group">
        <label class="form-label">E-posta</label>
        <input type="email" id="c-email" class="form-control" placeholder="ornek@sirket.com" value="${escHtml(c.email||'')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notlar</label>
      <textarea id="c-notes" class="form-control" placeholder="Kişi hakkında notlar...">${escHtml(c.notes||'')}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">İptal</button>
      <button class="btn btn-primary" onclick="saveContact()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Kaydet
      </button>
    </div>`;
}

async function saveContact() {
  const name = document.getElementById('c-name')?.value.trim();
  if (!name) { showToast('Ad boş olamaz!', 'error'); return; }

  const data = {
    name,
    role: document.getElementById('c-role')?.value.trim() || '',
    category: document.getElementById('c-category')?.value || 'Diğer',
    phone: document.getElementById('c-phone')?.value.trim() || '',
    email: document.getElementById('c-email')?.value.trim() || '',
    notes: document.getElementById('c-notes')?.value.trim() || '',
  };

  try {
    if (state.editingContactId) {
      await db.collection('contacts').doc(state.editingContactId).update(data);
      showToast('Kişi güncellendi!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('contacts').add(data);
      showToast('Kişi eklendi!', 'success');
    }
    closeModal();
  } catch (e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function deleteContact(id) {
  try {
    await db.collection('contacts').doc(id).delete();
    showToast('Kişi silindi.', 'info');
  } catch (e) {
    showToast('Silme hatası: ' + e.message, 'error');
  }
}

function confirmDeleteContact(id, name) {
  showConfirm(`"${name}" kişisini silmek istediğinize emin misiniz?`, () => deleteContact(id));
}

// =====================================================
// BARCODE GENERATOR (Code128)
// =====================================================
const CODE128_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112"
];

function generateCode128(text) {
  let clean = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 32 && c <= 126) clean += text[i];
  }
  if (!clean) return null;

  let symbols = [104]; // Start B
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    symbols.push(val);
    checksum += val * (i + 1);
  }
  symbols.push(checksum % 103);
  symbols.push(106); // Stop

  let x = 0;
  let path = '';
  const h = 80;
  for (const sym of symbols) {
    const pat = CODE128_PATTERNS[sym];
    for (let p = 0; p < pat.length; p++) {
      const w = parseInt(pat[p]);
      if (p % 2 === 0) path += `M${x} 0h${w}v${h}h-${w}Z `;
      x += w;
    }
  }
  return { path, width: x };
}

function previewBarcode() {
  const text = document.getElementById('barcode-input')?.value.trim() || '';
  const label = document.getElementById('barcode-label')?.value.trim() || '';
  const preview = document.getElementById('barcode-preview');
  const btnSvg = document.getElementById('btn-download-svg');
  const btnPng = document.getElementById('btn-download-png');
  const btnSave = document.getElementById('btn-save-barcode');

  if (!text) {
    preview.innerHTML = `<div class="barcode-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <line x1="3" y1="5" x2="3" y2="19"/><line x1="8" y1="5" x2="8" y2="19"/>
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="17" y1="5" x2="17" y2="19"/>
        <line x1="21" y1="5" x2="21" y2="19"/>
      </svg>
      <p>Yukarıya metin girin</p>
    </div>`;
    [btnSvg, btnPng, btnSave].forEach(b => b && (b.disabled = true));
    return;
  }

  const bc = generateCode128(text);
  if (!bc) {
    preview.innerHTML = '<div class="barcode-placeholder"><p>Geçersiz metin</p></div>';
    return;
  }

  state.currentBarcodeText = text;
  const svgContent = `<svg id="barcode-svg-el" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bc.width} ${label ? 96 : 80}" width="${Math.min(bc.width * 2, 400)}">
    <rect width="${bc.width}" height="${label ? 96 : 80}" fill="white"/>
    <path d="${bc.path}" fill="black"/>
    ${label ? `<text x="${bc.width/2}" y="92" text-anchor="middle" font-family="monospace" font-size="10" fill="black">${escHtml(label||text)}</text>` : ''}
  </svg>`;

  preview.innerHTML = `<div class="barcode-svg-wrapper">${svgContent}</div>`;
  [btnSvg, btnPng, btnSave].forEach(b => b && (b.disabled = false));
}

function downloadBarcodeSVG() {
  const svg = document.getElementById('barcode-svg-el');
  if (!svg) return;
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `barkod_${state.currentBarcodeText}.svg`;
  a.click(); URL.revokeObjectURL(url);
}

function downloadBarcodePNG() {
  const svg = document.getElementById('barcode-svg-el');
  if (!svg) return;
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = svg.viewBox.baseVal.width * scale;
  canvas.height = svg.viewBox.baseVal.height * scale;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgBlob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `barkod_${state.currentBarcodeText}.png`;
    a.click();
  };
  img.src = url;
}

async function saveBarcodeToHistory() {
  const text = state.currentBarcodeText;
  if (!text) return;
  try {
    await db.collection('barcodeHistory').add({
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Barkod geçmişe kaydedildi!', 'success');
  } catch (e) {
    showToast('Kaydetme hatası: ' + e.message, 'error');
  }
}

function renderBarcodeHistory() {
  const container = document.getElementById('barcode-history-list');
  if (!container) return;
  if (state.barcodeHistory.length === 0) {
    container.innerHTML = '<div class="empty-state-sm"><p>Henüz barkod geçmişi yok</p></div>';
    return;
  }
  document.getElementById('stat-barcode').textContent = state.barcodeHistory.length;
  container.innerHTML = state.barcodeHistory.map(item => `
    <div class="barcode-history-item" onclick="loadBarcodeFromHistory('${escHtml(item.text).replace(/'/g,"\\'")}')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-blue);flex-shrink:0;">
        <line x1="3" y1="5" x2="3" y2="19"/><line x1="8" y1="5" x2="8" y2="19"/>
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="17" y1="5" x2="17" y2="19"/>
        <line x1="21" y1="5" x2="21" y2="19"/>
      </svg>
      <span class="barcode-history-text">${escHtml(item.text)}</span>
      <span class="barcode-history-date">${formatDate(item.createdAt)}</span>
    </div>
  `).join('');
}

function loadBarcodeFromHistory(text) {
  const input = document.getElementById('barcode-input');
  if (input) { input.value = text; previewBarcode(); }
  navigateTo('barcode');
}

// =====================================================
// SCANNER (OCR)
// =====================================================
function startScanner() {
  const placeholder = document.getElementById('scanner-placeholder');
  const videoWrapper = document.getElementById('ocr-video-wrapper');
  const video = document.getElementById('ocr-video');
  const btnStart = document.getElementById('btn-start-scanner');
  const btnCapture = document.getElementById('btn-capture-ocr');
  const btnStop = document.getElementById('btn-stop-scanner');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Tarayıcınız kamerayı desteklemiyor!', 'error');
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      state.ocrStream = stream;
      state.scannerRunning = true;
      if (video) video.srcObject = stream;
      if (placeholder) placeholder.style.display = 'none';
      if (videoWrapper) videoWrapper.style.display = 'block';
      if (btnStart) btnStart.style.display = 'none';
      if (btnCapture) btnCapture.style.display = 'flex';
      if (btnStop) btnStop.style.display = 'flex';
      showToast('Kamera başlatıldı!', 'success');
    })
    .catch(err => {
      showToast('Kamera açılamadı: ' + err.message, 'error');
    });
}

function stopScanner() {
  if (state.ocrStream) {
    state.ocrStream.getTracks().forEach(t => t.stop());
    state.ocrStream = null;
  }
  state.scannerRunning = false;
  resetScanner();
}

function resetScanner() {
  state.scannerRunning = false;
  const placeholder = document.getElementById('scanner-placeholder');
  const videoWrapper = document.getElementById('ocr-video-wrapper');
  const video = document.getElementById('ocr-video');
  const btnStart = document.getElementById('btn-start-scanner');
  const btnCapture = document.getElementById('btn-capture-ocr');
  const btnStop = document.getElementById('btn-stop-scanner');
  const progress = document.getElementById('ocr-progress');
  if (placeholder) placeholder.style.display = 'block';
  if (videoWrapper) videoWrapper.style.display = 'none';
  if (video) video.srcObject = null;
  if (btnStart) btnStart.style.display = 'flex';
  if (btnCapture) btnCapture.style.display = 'none';
  if (btnStop) btnStop.style.display = 'none';
  if (progress) progress.style.display = 'none';
}

async function captureOCR() {
  const video = document.getElementById('ocr-video');
  if (!video || !state.scannerRunning) return;

  const btnCapture = document.getElementById('btn-capture-ocr');
  const progress = document.getElementById('ocr-progress');
  const progressFill = document.getElementById('ocr-progress-fill');
  const progressText = document.getElementById('ocr-progress-text');

  // Kareyi canvas'a çiz
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  // UI: işleniyor
  if (btnCapture) { btnCapture.disabled = true; btnCapture.textContent = 'Okunuyor...'; }
  if (progress) progress.style.display = 'flex';
  if (progressFill) progressFill.style.width = '0%';

  try {
    const result = await Tesseract.recognize(canvas, 'tur+eng', {
      logger: msg => {
        if (msg.status === 'recognizing text' && progressFill && progressText) {
          const pct = Math.round(msg.progress * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = `Okunuyor... %${pct}`;
        }
      }
    });

    const text = result.data.text.trim();
    if (progress) progress.style.display = 'none';

    if (text && text.length > 1) {
      addScanResult(text);
      showToast('Metin başarıyla okundu!', 'success');
    } else {
      showToast('Metin bulunamadı. Kamerayı yazıya yakın tutun.', 'info');
    }
  } catch (e) {
    if (progress) progress.style.display = 'none';
    showToast('OCR hatası: ' + e.message, 'error');
  }

  if (btnCapture) {
    btnCapture.disabled = false;
    btnCapture.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Metni Oku`;
  }
}

function addScanResult(text) {
  const container = document.getElementById('scan-results');
  if (!container) return;
  const emptyState = container.querySelector('.empty-state-sm');
  if (emptyState) emptyState.remove();

  const time = new Date().toLocaleTimeString('tr-TR');
  const item = document.createElement('div');
  item.className = 'scan-result-item';
  item.innerHTML = `
    <div class="scan-result-header">
      <span class="scan-result-time">${time}</span>
      <button class="btn btn-ghost btn-sm" onclick="copyText(this)" data-text="${escHtml(text)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Kopyala
      </button>
    </div>
    <div class="scan-result-text">${escHtml(text)}</div>`;
  container.insertBefore(item, container.firstChild);
}

function copyText(btn) {
  const text = btn.getAttribute('data-text');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Metin kopyalandı!', 'success');
  }).catch(() => {
    showToast('Kopyalama başarısız.', 'error');
  });
}

function clearScanResults() {
  const container = document.getElementById('scan-results');
  if (container) {
    container.innerHTML = '<div class="empty-state-sm"><p>Henüz tarama yok</p></div>';
  }
}

// =====================================================
// SETTINGS
// =====================================================
function exportData() {
  const data = {
    exportDate: new Date().toISOString(),
    workData: state.workData,
    contacts: state.contacts,
    barcodeHistory: state.barcodeHistory
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `osmanylz_yedek_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Yedek başarıyla indirildi!', 'success');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    let imported = 0;

    if (data.workData && Array.isArray(data.workData)) {
      for (const item of data.workData) {
        const { id, ...rest } = item;
        rest.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('workData').add(rest);
        imported++;
      }
    }
    if (data.contacts && Array.isArray(data.contacts)) {
      for (const item of data.contacts) {
        const { id, ...rest } = item;
        rest.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('contacts').add(rest);
        imported++;
      }
    }
    showToast(`${imported} kayıt içe aktarıldı!`, 'success');
  } catch (e) {
    showToast('Geçersiz yedek dosyası!', 'error');
  }
  event.target.value = '';
}

function confirmClearAllData() {
  showConfirm('TÜM verileri (iş kayıtları, kişiler, barkodlar) silmek istediğinize emin misiniz? Bu işlem GERİ ALINAMAZ!', clearAllData, 'Evet, Hepsini Sil');
}

async function clearAllData() {
  try {
    const batch = db.batch();
    const collections = ['workData', 'contacts', 'barcodeHistory'];
    for (const col of collections) {
      const snap = await db.collection(col).get();
      snap.forEach(doc => batch.delete(doc.ref));
    }
    await batch.commit();
    showToast('Tüm veriler silindi.', 'info');
  } catch (e) {
    showToast('Silme hatası: ' + e.message, 'error');
  }
}

// =====================================================
// MODAL SYSTEM
// =====================================================
function openModal() {
  document.getElementById('modal-overlay')?.classList.add('active');
  document.getElementById('modal')?.classList.add('active');
}
function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
  document.getElementById('modal')?.classList.remove('active');
}

function showConfirm(message, callback, okText = 'Sil') {
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok-btn').textContent = okText;
  document.getElementById('confirm-overlay')?.classList.add('active');
  document.getElementById('confirm-modal')?.classList.add('active');
  confirmCallback = callback;
}
function okConfirm() {
  document.getElementById('confirm-overlay')?.classList.remove('active');
  document.getElementById('confirm-modal')?.classList.remove('active');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
}
function cancelConfirm() {
  document.getElementById('confirm-overlay')?.classList.remove('active');
  document.getElementById('confirm-modal')?.classList.remove('active');
  confirmCallback = null;
}

// =====================================================
// TOAST SYSTEM
// =====================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<div class="toast-icon"></div><span class="toast-msg">${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================================================
// UTILITIES
// =====================================================
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

// =====================================================
// APP INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Init Firebase
  initFirebase();

  // Start Clock
  startClock();

  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loading-screen')?.classList.add('hidden');
  }, 1800);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      cancelConfirm();
    }
  });
});

// PWA: Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
