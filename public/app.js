// ── Device Detection ─────────────────────────────────────────
const isMobileDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android|webos|blackberry|windows phone/.test(userAgent);
};
const IS_MOBILE = isMobileDevice();

// ── Mobile Header Auto-Hide on Scroll ───────────────────────
let lastScrollPos = 0;
let headerHidden = false;

function initMobileHeaderScroll(headerId) {
  const header = el(headerId);
  if (!header) return;

  const contentId = headerId.includes('admin') ? 'mobile-admin-content' : 'mobile-customer-content';
  const content = el(contentId);
  if (!content) return;

  lastScrollPos = 0;
  headerHidden = false;
  header.classList.remove('hide');

  // Remove any existing scroll listener (to avoid duplicates)
  content.onscroll = null;

  content.addEventListener('scroll', () => {
    const currentScroll = content.scrollTop;

    if (currentScroll > lastScrollPos && currentScroll > 50) {
      if (!headerHidden) {
        header.classList.add('hide');
        headerHidden = true;
      }
    } else {
      if (headerHidden) {
        header.classList.remove('hide');
        headerHidden = false;
      }
    }

    lastScrollPos = currentScroll;
  });
}

// ── State ─────────────────────────────────────────────────────
let currentUser = null;
let cart = [];
let currentView = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await seedIfEmpty();
  const session = Session.get();
  if (session) { const u = Users.find(session.id); if (u) currentUser = u; }
  route();
});

// ── Router ────────────────────────────────────────────────────
function route(view) {
  if (view) currentView = view;
  else currentView = currentView || localStorage.getItem('wm_view') || (currentUser
    ? (currentUser.role === 'admin' ? 'admin-dashboard' : 'catalog')
    : 'landing');
  localStorage.setItem('wm_view', currentView);

  if (IS_MOBILE) {
    routeMobile();
  } else {
    routeDesktop();
  }
}

function routeDesktop() {
  ['landing','login','register','admin','customer'].forEach(p => hide('page-' + p));

  if (!currentUser) {
    if (currentView === 'login') { show('page-login'); return; }
    currentView = 'landing'; show('page-landing'); return;
  }

  if (currentUser.role === 'admin') {
    show('page-admin');
    renderAdminNav();
    renderSidebar('admin');
    const views = {
      'admin-dashboard': renderAdminDashboard,
      'inventory':       renderInventory,
      'bulk-stock':      renderBulkStock,
      'admin-orders':    renderAdminOrders,
      'stock-history':   renderStockHistory,
      'admin-users':     renderAdminUsers,
      'admin-profile':   renderAdminProfile,
    };
    (views[currentView] || (() => { currentView = 'admin-dashboard'; renderAdminDashboard(); }))();
  } else {
    show('page-customer');
    renderCustomerNav();
    renderSidebar('customer');
    const views = {
      'cust-dashboard': renderCustDashboard,
      'catalog':        renderCatalog,
      'cart':           renderCart,
      'my-orders':      renderMyOrders,
      'cust-profile':   renderCustProfile,
    };
    (views[currentView] || (() => { currentView = 'catalog'; renderCatalog(); }))();
  }
}

function routeMobile() {
  ['mobile-landing', 'mobile-login', 'mobile-admin', 'mobile-customer'].forEach(p => hide('page-' + p));

  if (!currentUser) {
    if (currentView === 'login') { show('page-mobile-login'); return; }
    currentView = 'landing'; show('page-mobile-landing'); return;
  }

  if (currentUser.role === 'admin') {
    show('page-mobile-admin');
    initMobileHeaderScroll('mobile-admin-header');
    const views = {
      'admin-dashboard': renderMobileAdminDashboard,
      'inventory':       renderMobileInventory,
      'bulk-stock':      renderMobileBulkStock,
      'admin-orders':    renderMobileAdminOrders,
      'stock-history':   renderMobileStockHistory,
      'admin-users':     renderMobileAdminUsers,
      'admin-profile':   renderMobileAdminProfile,
    };
    (views[currentView] || (() => { currentView = 'admin-dashboard'; renderMobileAdminDashboard(); }))();
  } else {
    show('page-mobile-customer');
    initMobileHeaderScroll('mobile-cust-header');
    const views = {
      'cust-dashboard': renderMobileCustDashboard,
      'catalog':        renderMobileCatalog,
      'cart':           renderMobileCart,
      'my-orders':      renderMobileMyOrders,
      'cust-profile':   renderMobileCustProfile,
    };
    (views[currentView] || (() => { currentView = 'catalog'; renderMobileCatalog(); }))();
  }
}

function navigate(view) { currentView = view; route(); }

// ── DOM helpers ───────────────────────────────────────────────
function show(id) { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
function hide(id) { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
function el(id)   { return document.getElementById(id); }
function set(id, html) { const e = el(id); if (e) e.innerHTML = html; }

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  el('toast-container').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 2800);
  setTimeout(() => t.remove(), 3100);
}

// ── Modal ─────────────────────────────────────────────────────
function showModal(html) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() { const m = el('modal-overlay'); if (m) m.remove(); }

// ── Barcode Scanner ───────────────────────────────────────────
let scanner = null;

async function openBarcodeScanner(mode = 'search') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showModal(`
      <div class="modal-header"><div class="modal-title">Camera Not Available</div><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <p>Your device doesn't support camera scanning.</p>
        <p style="margin-top:.75rem;color:var(--text-muted);font-size:.9rem">Use manual entry instead:</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary w-full" onclick="closeModal();openManualBarcodeEntry('${mode}')">Enter Barcode Manually</button>
      </div>
    `);
    return;
  }

  // Request camera permission first
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    // Close the stream immediately - we just needed to request permission
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      showModal(`
        <div class="modal-header"><div class="modal-title">Camera Permission Needed</div><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="modal-body">
          <p>Camera permission was denied.</p>
          <p style="margin-top:.75rem;color:var(--text-muted);font-size:.9rem">Please enable camera access in your device settings, or use manual entry:</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary w-full" onclick="closeModal();openManualBarcodeEntry('${mode}')">Enter Manually</button>
        </div>
      `);
    } else if (err.name === 'NotFoundError') {
      toast('❌ No camera found on this device', 'error');
    } else {
      toast('❌ Unable to access camera', 'error');
    }
    return;
  }

  // Check if library is loaded
  let retries = 0;
  const waitForLibrary = setInterval(() => {
    retries++;
    if (typeof Html5Qrcode !== 'undefined') {
      clearInterval(waitForLibrary);
      initializeBarcodeScanner(mode);
    } else if (retries > 50) {
      clearInterval(waitForLibrary);
      showModal(`
        <div class="modal-header"><div class="modal-title">Scanner Unavailable</div><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="modal-body">
          <p>Scanner library failed to load.</p>
          <p style="margin-top:.75rem;color:var(--text-muted);font-size:.9rem">Please try manual entry or refresh the page:</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary w-full" onclick="closeModal();openManualBarcodeEntry('${mode}')">Enter Manually</button>
        </div>
      `);
    }
  }, 100);
}

function initializeBarcodeScanner(mode) {
  showModal(`
    <div class="modal-header"><div class="modal-title">Scan Barcode</div><button class="modal-close" onclick="closeBarcodeScanner()">×</button></div>
    <div class="modal-body">
      <div id="qr-reader" style="width:100%;height:300px;border:2px solid var(--border);border-radius:8px;overflow:hidden;background:#000"></div>
      <div id="scan-result" style="margin-top:1rem;text-align:center;font-size:.9rem;color:var(--text-muted)">📸 Point camera at barcode...</div>
    </div>
  `);

  setTimeout(() => {
    try {
      scanner = new Html5Qrcode('qr-reader');
      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleBarcodeScanned(decodedText, mode);
        },
        (errorMessage) => {
          // Silent error handling for continuous scanning
        }
      ).catch(err => {
        set('scan-result', '❌ Scanner failed: ' + err.message);
      });
    } catch (err) {
      set('scan-result', '❌ Error initializing scanner');
      console.error('Scanner error:', err);
    }
  }, 200);
}

function closeBarcodeScanner() {
  if (scanner) {
    try {
      scanner.stop();
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
    scanner = null;
  }
  closeModal();
}

function handleBarcodeScanned(barcode, mode) {
  closeBarcodeScanner();

  // Clean up barcode (remove whitespace)
  barcode = barcode.trim();

  if (mode === 'search') {
    const product = Products.find(barcode);
    if (product) {
      toast(`Found: ${product.name}`, 'success');
      openEditProduct(barcode);
    } else {
      showModal(`
        <div class="modal-header"><div class="modal-title">Product Not Found</div><button class="modal-close" onclick="closeModal()">×</button></div>
        <div class="modal-body">
          <p>No product found with SKU: <strong>${barcode}</strong></p>
          <p style="margin-top:.75rem;color:var(--text-muted);font-size:.9rem">Would you like to create a new product with this SKU?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="closeModal();openAddProductWithSku('${barcode}')">Create Product</button>
        </div>
      `);
    }
  } else if (mode === 'create') {
    openAddProductWithSku(barcode);
  }
}

function openManualBarcodeEntry(mode = 'search') {
  showModal(`
    <div class="modal-header"><div class="modal-title">Enter Barcode</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Barcode / SKU</label>
        <input class="form-control" id="manual-barcode" type="text" placeholder="Enter barcode or SKU" autofocus>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="handleManualBarcode('${mode}')">Search</button>
    </div>
  `);
  setTimeout(() => el('manual-barcode').focus(), 100);
}

function handleManualBarcode(mode) {
  const barcode = el('manual-barcode').value.trim();
  if (!barcode) {
    toast('Please enter a barcode', 'warning');
    return;
  }
  closeModal();
  handleBarcodeScanned(barcode, mode);
}

function openAddProductWithSku(sku) {
  showModal(`
    <div class="modal-header"><div class="modal-title">Add New Product</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div id="prod-error"></div>
      <div class="form-group">
        <label>Product Name *</label>
        <input class="form-control" id="pf-name" value="" placeholder="e.g. Safety Gloves">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label>SKU *</label>
          <input class="form-control" id="pf-sku" value="${sku}" placeholder="e.g. GLV-001" readonly style="background:var(--bg);cursor:not-allowed">
        </div>
        <div class="form-group">
          <label>Category *</label>
          <select class="form-control" id="pf-cat">
            <option value="">Select category</option>
            <option value="Beverages">Beverages</option>
            <option value="Beers">Beers</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group">
          <label>Cost Price ($) *</label>
          <input class="form-control" id="pf-price" type="number" step="0.01" min="0" value="" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Stock Qty *</label>
          <input class="form-control" id="pf-stock" type="number" min="0" value="" placeholder="0">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct(null)">Add Product</button>
    </div>
  `);
}

// ── Auth ──────────────────────────────────────────────────────
function logout() {
  Session.clear(); currentUser = null; cart = []; currentView = 'landing';
  localStorage.removeItem('wm_view');
  route(); toast('Signed out successfully.', 'info');
}

function handleLogin(e) {
  e.preventDefault();
  const username = el('login-username').value.trim();
  const pass  = el('login-pass').value;
  const res   = Users.login(username, pass);
  if (res.error) { set('login-error', `<div class="alert alert-error">⚠️ ${res.error}</div>`); return; }
  currentUser = res.user;
  Session.set(res.user);
  currentView = res.user.role === 'admin' ? 'admin-dashboard' : 'catalog';
  toast(`Welcome back, ${res.user.name}!`, 'success');
  route();
}

function handleLoginMobile(e) {
  e.preventDefault();
  const username = el('mobile-login-username').value.trim();
  const pass  = el('mobile-login-pass').value;
  const res   = Users.login(username, pass);
  if (res.error) { set('mobile-login-error', `<div class="alert alert-error">⚠️ ${res.error}</div>`); return; }
  currentUser = res.user;
  Session.set(res.user);
  currentView = res.user.role === 'admin' ? 'admin-dashboard' : 'catalog';
  toast(`Welcome back, ${res.user.name}!`, 'success');
  route();
}

function handleRegister(e) {
  e.preventDefault();
  const name  = el('reg-name').value.trim();
  const username = el('reg-username').value.trim();
  const email = el('reg-email').value.trim();
  const pass  = el('reg-pass').value;
  const pass2 = el('reg-pass2').value;
  const role  = el('reg-role').value;
  if (!name || !username || !email || !pass) { set('reg-error', `<div class="alert alert-error">⚠️ Please fill in all fields.</div>`); return; }
  if (pass !== pass2)           { set('reg-error', `<div class="alert alert-error">⚠️ Passwords do not match.</div>`); return; }
  if (pass.length < 6)          { set('reg-error', `<div class="alert alert-error">⚠️ Password must be at least 6 characters.</div>`); return; }
  const res = Users.create(name, username, email, pass, role);
  if (res.error) { set('reg-error', `<div class="alert alert-error">⚠️ ${res.error}</div>`); return; }
  currentUser = res.user;
  Session.set(res.user);
  currentView = role === 'admin' ? 'admin-dashboard' : 'catalog';
  toast(`Account created! Welcome, ${name}!`, 'success');
  route();
}

function setRole(role) {
  el('reg-role').value = role;
  document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
  document.querySelector(`.role-option[data-role="${role}"]`).classList.add('selected');
}

// ── Navbars ───────────────────────────────────────────────────
function renderAdminNav() {
  set('admin-nav-user', `
    <div class="navbar-user">
      <div class="avatar">${initials(currentUser.name)}</div>
      <span class="hide-mobile" style="font-weight:600;font-size:.875rem">${currentUser.name}</span>
      <span class="badge badge-info hide-mobile">Admin</span>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="navigate('admin-profile')">⚙️ Profile</button>
    <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
  `);
}

function renderCustomerNav() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  set('cust-nav-user', `
    <div class="navbar-user">
      <div class="avatar">${initials(currentUser.name)}</div>
      <span class="hide-mobile" style="font-weight:600;font-size:.875rem">${currentUser.name}</span>
    </div>
    <button class="btn btn-outline btn-sm" onclick="navigate('cart')">
      🛒 Cart${count > 0 ? ` <span class="badge badge-danger" style="margin-left:.2rem">${count}</span>` : ''}
    </button>
    <button class="btn btn-ghost btn-sm" onclick="navigate('cust-profile')">⚙️ Profile</button>
    <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
  `);
}

// ── Sidebar ───────────────────────────────────────────────────
function renderSidebar(role) {
  const links = role === 'admin'
    ? [
        { view: 'admin-dashboard', icon: '📊', label: 'Dashboard' },
        { view: 'inventory',       icon: '📦', label: 'Inventory' },
        { view: 'bulk-stock',      icon: '📥', label: 'Bulk Stock' },
        { view: 'admin-orders',    icon: '🧾', label: 'Orders' },
        { view: 'stock-history',   icon: '📈', label: 'Stock History' },
        { view: 'admin-users',     icon: '👥', label: 'Users' },
        { view: 'admin-profile',   icon: '⚙️', label: 'Settings' },
      ]
    : [
        { view: 'cust-dashboard', icon: '🏠', label: 'Dashboard' },
        { view: 'catalog',        icon: '🛍️', label: 'Browse Products' },
        { view: 'cart',           icon: '🛒', label: 'My Cart' },
        { view: 'my-orders',      icon: '📋', label: 'My Orders' },
        { view: 'cust-profile',   icon: '⚙️', label: 'Settings' },
      ];

  const sid = role === 'admin' ? 'admin-sidebar' : 'cust-sidebar';
  set(sid, `
    <div style="padding:.5rem 0">
      <div class="sidebar-label">Menu</div>
      ${links.map(l => `
        <button class="sidebar-link ${currentView === l.view ? 'active' : ''}" onclick="navigate('${l.view}');closeSidebar('${role}')">
          <span class="sidebar-icon">${l.icon}</span>${l.label}
        </button>`).join('')}
    </div>
    <div style="padding:1.5rem 1.25rem;border-top:1px solid var(--border);margin-top:auto">
      <div style="font-size:.75rem;font-weight:600;color:var(--text-muted);margin-bottom:.25rem">${currentUser.name}</div>
      <div style="font-size:.7rem;color:var(--text-light)">${currentUser.email}</div>
    </div>
  `);
}

function sidebarId(role) { return role === 'customer' ? 'cust-sidebar' : 'admin-sidebar'; }
function toggleSidebar(role) { el(sidebarId(role)).classList.toggle('open'); el(role+'-overlay').classList.toggle('open'); }
function closeSidebar(role) { el(sidebarId(role)).classList.remove('open'); el(role+'-overlay').classList.remove('open'); }

// ════════════════════════════════════════════════════════
// ADMIN VIEWS
// ════════════════════════════════════════════════════════

function renderAdminDashboard() {
  const orders   = Orders.all();
  const lowStock = Products.lowStock();
  const pending  = orders.filter(o => o.status === 'pending').length;
  const products = Products.all();

  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Dashboard</div>
          <div class="page-sub">Welcome back, ${currentUser.name} — here's your warehouse overview.</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon yellow">⚠️</div>
          <div>
            <div class="stat-label">Low Stock Alerts</div>
            <div class="stat-value">${lowStock.length}</div>
            <div class="stat-sub">${lowStock.length === 0 ? 'Nothing critical' : 'Action required'}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">🧾</div>
          <div>
            <div class="stat-label">Pending Orders</div>
            <div class="stat-value">${pending}</div>
            <div class="stat-sub">${orders.length} orders total</div>
          </div>
        </div>
      </div>

      <div class="dashboard-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem">
        <div class="card">
          <div class="card-header">
            <div class="card-title">⚠️ Low Stock Items</div>
            <button class="btn btn-primary btn-sm" onclick="navigate('inventory')">Manage →</button>
          </div>
          ${lowStock.length === 0
            ? `<div class="empty-state"><div class="empty-icon">✅</div><p>All products are well stocked!</p></div>`
            : `<div class="table-wrap"><table>
                <thead><tr><th>Product</th><th>Stock</th><th>Min</th><th>Status</th></tr></thead>
                <tbody>${lowStock.slice(0,6).map(p => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:.5rem"><span>${p.emoji || categoryEmoji(p.category)}</span><span style="font-weight:600">${p.name}</span></div></td>
                    <td><strong style="color:${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.stock}</strong></td>
                    <td style="color:var(--text-muted)">${p.min_stock}</td>
                    <td>${stockBadge(p)}</td>
                  </tr>`).join('')}
                </tbody></table></div>`}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🧾 Recent Orders</div>
            <button class="btn btn-primary btn-sm" onclick="navigate('admin-orders')">View All →</button>
          </div>
          ${orders.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📋</div><p>No orders yet.</p></div>`
            : `<div class="table-wrap"><table>
                <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>${orders.slice(0,6).map(o => `
                  <tr>
                    <td><code style="font-size:.75rem;background:var(--border-light);padding:.1rem .35rem;border-radius:4px">${o.id.replace('ORD-','')}</code></td>
                    <td style="font-weight:600">${o.customerName}</td>
                    <td style="font-weight:700">${fmt(o.total)}</td>
                    <td>${statusBadge(o.status)}</td>
                  </tr>`).join('')}
                </tbody></table></div>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">📊 Stock Level Overview</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('inventory')">View All</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:.9rem">
          ${products.slice(0,8).map(p => {
            const max = Math.max(p.stock, p.min_stock * 3, 1);
            const pct = Math.min(100, Math.round(p.stock / max * 100));
            const cls = p.stock === 0 ? 'low' : p.stock <= p.min_stock ? 'warn' : '';
            return `<div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem">
                <span style="font-size:.85rem;font-weight:600;display:flex;align-items:center;gap:.4rem">
                  <span>${p.emoji || '📦'}</span><span>${p.name}</span>
                </span>
                <span style="font-size:.78rem;color:var(--text-muted)">${p.stock} / ${max}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `);
}

// ── Inventory ─────────────────────────────────────────────────
let invSearch = '', invCategory = '';

function renderInventory() {
  const all = Products.all();
  const cats = [...new Set(all.map(p => p.category))];
  const prods = all.filter(p =>
    (!invSearch || p.name.toLowerCase().includes(invSearch.toLowerCase()) || p.sku.toLowerCase().includes(invSearch.toLowerCase())) &&
    (!invCategory || p.category === invCategory)
  );

  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Inventory</div>
          <div class="page-sub">${all.length} products · ${Products.lowStock().length} low stock</div>
        </div>
        <button class="btn btn-primary" onclick="openAddProduct()">+ Add Product</button>
      </div>

      <div class="filter-bar">
        <div class="search-bar" style="flex:1;min-width:200px">
          <span class="search-icon">🔍</span>
          <input class="form-control" placeholder="Search name or SKU…" value="${invSearch}" oninput="invSearch=this.value;renderInventory()">
        </div>
        <select class="form-control" style="width:auto;min-width:150px" onchange="invCategory=this.value;renderInventory()">
          <option value="">All Categories</option>
          ${cats.map(c => `<option value="${c}" ${invCategory===c?'selected':''}>${c}</option>`).join('')}
        </select>
        ${invSearch||invCategory ? `<button class="btn btn-ghost btn-sm" onclick="invSearch='';invCategory='';renderInventory()">✕ Clear</button>` : ''}
      </div>

      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${prods.length === 0
                ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔍</div><p>No products match your search.</p></div></td></tr>`
                : prods.map(p => `
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:.65rem">
                        <div style="font-size:1.5rem;width:36px;height:36px;background:linear-gradient(135deg,#f5f5f5,#eeeeee);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;flex-shrink:0">${p.emoji||categoryEmoji(p.category)}</div>
                        <div style="font-weight:600;font-size:.875rem">${p.name}</div>
                      </div>
                    </td>
                    <td><code style="font-size:.75rem;background:var(--border-light);padding:.15rem .4rem;border-radius:4px;color:var(--text-muted)">${p.sku}</code></td>
                    <td><span style="font-size:.8rem;color:var(--text-muted)">${p.category}</span></td>
                    <td style="font-weight:700;color:var(--primary)">${fmt(p.price)}</td>
                    <td>
                      <div style="font-weight:700;font-size:.95rem">${p.stock}</div>
                      <div style="font-size:.7rem;color:var(--text-light)">min ${p.min_stock || 10}</div>
                    </td>
                    <td>${stockBadge(p)}</td>
                    <td>
                      <div style="display:flex;gap:.35rem;flex-wrap:wrap">
                        <button class="btn btn-outline btn-sm" onclick="openEditProduct('${p.sku}')">Edit</button>
                        <button class="btn btn-ghost btn-sm"   onclick="openAdjust('${p.sku}')">Adjust</button>
                        <button class="btn btn-danger btn-sm"  onclick="deleteProduct('${p.sku}')">🗑</button>
                      </div>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

function productForm(p = {}) {
  const CATS = ['Beverages','Beers'];
  return `
    <div class="form-group">
      <label>Product Name *</label>
      <input class="form-control" id="pf-name" value="${p.name||''}" placeholder="e.g. Safety Gloves">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="form-group">
        <label>SKU *</label>
        <input class="form-control" id="pf-sku" value="${p.sku||''}" placeholder="e.g. GLV-001">
      </div>
      <div class="form-group">
        <label>Category *</label>
        <select class="form-control" id="pf-cat">
          <option value="">Select category</option>
          ${CATS.map(c=>`<option value="${c}" ${p.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="form-group">
        <label>Cost Price ($) *</label>
        <input class="form-control" id="pf-price" type="number" step="0.01" min="0" value="${p.price||''}" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>Stock Qty *</label>
        <input class="form-control" id="pf-stock" type="number" min="0" value="${p.stock||''}" placeholder="0">
      </div>
    </div>
  `;
}

function openAddProduct() {
  showModal(`
    <div class="modal-header"><div class="modal-title">Add New Product</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div id="prod-error"></div>${productForm()}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct(null)">Add Product</button>
    </div>
  `);
}

function openEditProduct(sku) {
  const p = Products.find(sku); if (!p) return;
  showModal(`
    <div class="modal-header"><div class="modal-title">Edit Product</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body"><div id="prod-error"></div>${productForm(p)}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct('${sku}')">Save Changes</button>
    </div>
  `);
}

async function saveProduct(sku) {
  const name    = el('pf-name').value.trim();
  const newSku  = el('pf-sku').value.trim();
  const category= el('pf-cat').value;
  const price   = parseFloat(el('pf-price').value);
  const stock   = parseInt(el('pf-stock').value);

  if (!name||!newSku||!category||isNaN(price)||isNaN(stock)) {
    set('prod-error','<div class="alert alert-error">⚠️ Please fill in all required fields.</div>'); return;
  }

  try {
    const data = {
      name, sku: newSku, category, price, stock,
      description: '',
      min_stock: 10,
      unit: 'units',
      emoji: categoryEmoji(category)
    };
    if (sku) { await Products.update(sku, data); toast('Product updated!','success'); }
    else    { await Products.create(data);     toast('Product added!','success'); }
    closeModal(); renderInventory();
  } catch (err) {
    set('prod-error',`<div class="alert alert-error">⚠️ ${err.message}</div>`);
  }
}

function deleteProduct(sku) {
  const p = Products.find(sku); if (!p) return;
  showModal(`
    <div class="modal-header"><div class="modal-title">Delete Product</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <p>Are you sure you want to delete <strong>${p.name}</strong>?</p>
      <p style="margin-top:.5rem;font-size:.875rem;color:var(--text-muted)">This action cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmDeleteProduct('${sku}')">Delete Product</button>
    </div>
  `);
}
async function confirmDeleteProduct(sku) {
  const p = Products.find(sku);
  try {
    await Products.delete(sku);
    toast(`"${p.name}" deleted.`, 'warning'); closeModal(); renderInventory();
  } catch (err) {
    toast(`Error deleting product: ${err.message}`, 'error');
  }
}

function openAdjust(sku) {
  const p = Products.find(sku); if (!p) return;
  showModal(`
    <div class="modal-header"><div class="modal-title">Adjust Stock — ${p.name}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div style="background:var(--bg);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem">
        <span style="font-size:1.75rem">${p.emoji||categoryEmoji(p.category)}</span>
        <div>
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:.8rem;color:var(--text-muted)">Current stock: <strong style="color:var(--text)">${p.stock}</strong></div>
        </div>
      </div>
      <div class="form-group">
        <label>Adjustment quantity <span style="color:var(--text-muted);font-weight:400">(+ to add, − to remove)</span></label>
        <input class="form-control" id="adj-qty" type="number" placeholder="e.g. 50 or -10">
      </div>
      <div class="form-group">
        <label>Reason</label>
        <input class="form-control" id="adj-reason" value="Manual adjustment" placeholder="e.g. Restock from supplier">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmAdjust('${sku}')">Apply Adjustment</button>
    </div>
  `);
}
async function confirmAdjust(sku) {
  const qty    = parseInt(el('adj-qty').value);
  const reason = el('adj-reason').value.trim() || 'Manual adjustment';
  if (isNaN(qty)||qty===0) { toast('Enter a non-zero quantity.','error'); return; }
  try {
    const updated = await Products.adjustStock(sku, qty, reason);
    toast(`Stock updated → ${updated.stock} units`, 'success'); closeModal(); renderInventory();
  } catch (err) {
    toast(`Error adjusting stock: ${err.message}`, 'error');
  }
}

// ── Bulk Stock Management ─────────────────────────────────────
let bulkChecked = [];
let bulkQuantities = {};
let bulkSearch = '';
let bulkSearchTimeout;

function renderBulkStock() {
  const products = Products.all();
  const cats = [...new Set(products.map(p => p.category))];

  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Bulk Stock Management</div>
          <div class="page-sub">Adjust stock for multiple products at once</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;padding:1.5rem">
        <div style="margin-bottom:1rem">
          <div style="font-weight:600;margin-bottom:.5rem">Select Products</div>
          <input type="text" id="bulk-search" class="form-control" placeholder="Search by name or SKU..." value="${bulkSearch}" onkeyup="bulkSearch = el('bulk-search').value; clearTimeout(bulkSearchTimeout); bulkSearchTimeout = setTimeout(() => renderBulkStock(), 200)" style="margin-bottom:.75rem">
          <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="btn btn-sm btn-outline" onclick="bulkSelectAll()">Select All</button>
            <button class="btn btn-sm btn-outline" onclick="bulkClearAll()">Clear All</button>
            <span style="color:var(--text-muted);display:flex;align-items:center">${bulkChecked.length} selected</span>
          </div>
        </div>

        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:.75rem">
          ${(() => {
            const filtered = products.filter(p =>
              bulkSearch === '' ||
              p.name.toLowerCase().includes(bulkSearch.toLowerCase()) ||
              p.sku.toLowerCase().includes(bulkSearch.toLowerCase())
            );
            return filtered.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:1rem">No products found</div>'
            : filtered.map(p => `
              <div style="display:flex;align-items:center;padding:.5rem;border-bottom:1px solid var(--border-light)">
                <input type="checkbox" id="bulk-${p.sku}" ${bulkChecked.includes(p.sku) ? 'checked' : ''} onchange="toggleBulkSelect('${p.sku}')" style="margin-right:.75rem;cursor:pointer;width:18px;height:18px">
                <label for="bulk-${p.sku}" style="flex:1;cursor:pointer">
                  <div style="font-weight:500">${p.name}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">${p.sku} • ${p.stock} units</div>
                </label>
              </div>`).join('');
          })()}
        </div>
      </div>

      ${bulkChecked.length === 0 ? '' : `
      <div class="card">
        <div style="margin-bottom:1.5rem">
          <div style="font-weight:600;margin-bottom:1rem">Quantities</div>
          ${Products.all().filter(p => bulkChecked.includes(p.sku)).map(p => `
            <div style="display:grid;grid-template-columns:1fr auto;gap:.75rem;align-items:center;margin-bottom:1rem;padding:.75rem;background:var(--bg-light);border-radius:8px">
              <div>
                <div style="font-weight:500;font-size:.9rem">${p.name}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${p.sku}</div>
              </div>
              <input type="number" id="bulk-qty-${p.sku}" class="form-control" style="width:80px" min="1" value="${bulkQuantities[p.sku] || 10}">
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom:1.5rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.3rem">Operation</label>
          <select id="bulk-operation" class="form-control">
            <option value="in">📥 Stock In (Add)</option>
            <option value="out">📤 Stock Out (Remove)</option>
          </select>
        </div>

        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.3rem">Reason</label>
          <input id="bulk-reason" class="form-control" type="text" placeholder="e.g. Restock, Damage, Inventory correction" value="">
        </div>

        <button class="btn btn-primary btn-lg w-full" onclick="applyBulkStock()">Apply to ${bulkChecked.length} Product${bulkChecked.length!==1?'s':''}</button>
      </div>
      `}
    </div>
  `);
}

function toggleBulkSelect(sku) {
  if (bulkChecked.includes(sku)) {
    bulkChecked = bulkChecked.filter(s => s !== sku);
    delete bulkQuantities[sku];
  } else {
    bulkChecked.push(sku);
    bulkQuantities[sku] = 10;
  }
  renderBulkStock();
}

function bulkSelectAll() {
  bulkChecked = Products.all().map(p => p.sku);
  bulkQuantities = {};
  bulkChecked.forEach(sku => bulkQuantities[sku] = 10);
  renderBulkStock();
}

function bulkClearAll() {
  bulkChecked = [];
  bulkQuantities = {};
  bulkSearch = '';
  renderBulkStock();
}

async function applyBulkStock() {
  if (bulkChecked.length === 0) {
    toast('Please select at least one product', 'warning');
    return;
  }

  const operation = el('bulk-operation').value;
  const reason = el('bulk-reason').value.trim() || `Bulk ${operation === 'in' ? 'stock in' : 'stock out'}`;

  let updated = 0;
  let errors = 0;
  let validationErrors = [];

  for (const sku of bulkChecked) {
    const qtyInput = el(`bulk-qty-${sku}`);
    if (!qtyInput) {
      errors++;
      continue;
    }

    const qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty <= 0) {
      validationErrors.push(sku);
      errors++;
      continue;
    }

    try {
      const adjustQty = operation === 'in' ? qty : -qty;
      await Products.adjustStock(sku, adjustQty, reason);
      updated++;
    } catch (err) {
      errors++;
      console.error(`Error adjusting ${sku}:`, err);
    }
  }

  bulkChecked = [];
  bulkQuantities = {};
  if (validationErrors.length > 0) {
    toast(`❌ Invalid quantities for: ${validationErrors.join(', ')}`, 'warning');
  } else if (errors === 0) {
    toast(`✅ Updated ${updated} product${updated!==1?'s':''}`, 'success');
  } else {
    toast(`✅ Updated ${updated} products, ${errors} failed`, 'warning');
  }
  renderBulkStock();
}

// ── Admin Orders ──────────────────────────────────────────────
let ordSearch = '', ordStatus = '';
const STATUSES = ['pending','processing','shipped','delivered','cancelled'];

function renderAdminOrders() {
  const all = Orders.all();
  const orders = all.filter(o =>
    (!ordSearch || o.id.toLowerCase().includes(ordSearch.toLowerCase()) || o.customerName.toLowerCase().includes(ordSearch.toLowerCase())) &&
    (!ordStatus || o.status === ordStatus)
  );
  const counts = STATUSES.reduce((m,s) => { m[s] = all.filter(o=>o.status===s).length; return m; }, {});

  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Orders</div>
          <div class="page-sub">${all.length} total orders</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateOrder()">+ Create Order</button>
      </div>

      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.25rem">
        ${[['All',''], ...STATUSES.map(s=>[s.charAt(0).toUpperCase()+s.slice(1),s])].map(([label,val])=>`
          <button class="btn btn-sm ${ordStatus===val ? 'btn-primary' : 'btn-ghost'}" onclick="ordStatus='${val}';renderAdminOrders()">
            ${label}${val && counts[val] > 0 ? ` <span class="badge badge-${val==='pending'?'warning':val==='delivered'?'success':'muted'}">${counts[val]}</span>` : ''}
          </button>`).join('')}
      </div>

      <div class="filter-bar">
        <div class="search-bar" style="flex:1;min-width:200px">
          <span class="search-icon">🔍</span>
          <input class="form-control" placeholder="Search order ID or customer…" value="${ordSearch}" oninput="ordSearch=this.value;renderAdminOrders()">
        </div>
        ${ordSearch ? `<button class="btn btn-ghost btn-sm" onclick="ordSearch='';renderAdminOrders()">✕ Clear</button>` : ''}
      </div>

      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${orders.length === 0
                ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No orders found.</p></div></td></tr>`
                : orders.map(o=>`
                  <tr>
                    <td><code style="font-size:.78rem;background:var(--border-light);padding:.15rem .4rem;border-radius:4px;color:var(--text-muted)">${o.id}</code></td>
                    <td style="font-weight:600">${o.customerName}</td>
                    <td style="color:var(--text-muted)">${o.items.length} item${o.items.length!==1?'s':''}</td>
                    <td style="font-weight:700">${fmt(o.total)}</td>
                    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${fmtDate(o.createdAt)}</td>
                    <td>${statusBadge(o.status)}</td>
                    <td>
                      <div style="display:flex;gap:.35rem;align-items:center;flex-wrap:wrap">
                        <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')">View</button>
                        <select class="form-control" style="font-size:.78rem;padding:.3rem .5rem;width:auto;min-width:110px" onchange="updateOrderStatus('${o.id}',this.value)">
                          ${STATUSES.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                        </select>
                      </div>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

async function updateOrderStatus(id, status) {
  try {
    await Orders.updateStatus(id, status);
    toast(`Order updated to "${status}".`, 'success');
    renderAdminOrders();
  } catch (err) {
    toast(`Error updating order: ${err.message}`, 'error');
  }
}

function viewOrder(id) {
  const o = Orders.find(id); if (!o) return;
  showModal(`
    <div class="modal-header"><div class="modal-title">Order ${o.id}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.1rem">
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:.2rem">Customer</div><div style="font-weight:600">${o.customerName}</div></div>
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:.2rem">Date</div><div style="font-weight:600">${fmtDateTime(o.createdAt)}</div></div>
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:.2rem">Status</div><div>${statusBadge(o.status)}</div></div>
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-light);margin-bottom:.2rem">Total</div><div style="font-weight:800;font-size:1.1rem;color:var(--primary)">${fmt(o.total)}</div></div>
      </div>
      <hr class="divider">
      <div style="font-weight:700;margin-bottom:.65rem;font-size:.875rem">Order Items</div>
      ${o.items.map(i=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border-light)">
          <div style="display:flex;align-items:center;gap:.6rem">
            <span>${i.emoji||'📦'}</span>
            <div>
              <div style="font-weight:600;font-size:.875rem">${i.name}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">× ${i.qty} @ ${fmt(i.price)}</div>
            </div>
          </div>
          <span style="font-weight:700">${fmt(i.price*i.qty)}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:.9rem;font-size:1rem;font-weight:800">Total: ${fmt(o.total)}</div>
    </div>
    <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>
  `);
}

let adminOrderCart = [];

function openCreateOrder() {
  adminOrderCart = [];
  const customers = Users.all();
  const products = Products.all();
  showModal(`
    <div class="modal-header"><div class="modal-title">Create Order</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body" style="max-height:600px;overflow-y:auto">
      <div id="order-error"></div>
      <div class="form-group">
        <label>Customer *</label>
        <select class="form-control" id="order-customer">
          <option value="">Select a customer</option>
          ${customers.filter(u=>u.role==='customer').map(u=>`<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <div style="font-weight:700;margin-bottom:.75rem">Add Products</div>
        <div style="display:grid;gap:.5rem">
          ${products.map(p=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light)">
              <div style="flex:1">
                <div style="font-weight:600;font-size:.85rem">${p.name}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${fmt(p.price)} · Stock: ${p.stock}</div>
              </div>
              <div style="display:flex;align-items:center;gap:.3rem">
                <input type="number" min="0" max="${p.stock}" value="0" class="form-control" style="width:60px;padding:.25rem .35rem;font-size:.8rem" id="qty-${p.sku}">
                <button class="btn btn-primary btn-sm" onclick="addProductToAdminOrder('${p.sku}')">Add</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="font-weight:700;margin-bottom:.75rem">Order Summary</div>
      <div id="admin-order-items" style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1rem">
        ${adminOrderCart.length === 0 ? '<div style="color:var(--text-muted);font-size:.85rem">No items added yet</div>' : ''}
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;padding-top:.75rem;border-top:1px solid var(--border)">
        <span>Total:</span>
        <span style="color:var(--primary)">${fmt(adminOrderCart.reduce((s,i)=>s+i.price*i.qty,0))}</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAdminOrder()">Place Order</button>
    </div>
  `);
}

function addProductToAdminOrder(sku) {
  const qty = parseInt(el('qty-' + sku).value) || 0;
  if (qty <= 0) { toast('Enter a valid quantity', 'error'); return; }

  const p = Products.find(sku);
  if (!p) return;

  if (qty > p.stock) { toast(`Only ${p.stock} in stock available`, 'error'); return; }

  const existing = adminOrderCart.find(i => i.sku === sku);
  if (existing) {
    const newQty = existing.qty + qty;
    if (newQty > p.stock) { toast(`Total quantity cannot exceed ${p.stock} in stock`, 'error'); return; }
    existing.qty = newQty;
  } else {
    adminOrderCart.push({ sku, name: p.name, price: p.price, qty, emoji: categoryEmoji(p.category) });
  }

  el('qty-' + sku).value = '0';
  updateAdminOrderSummary();
  toast(`${p.name} added to order`, 'success');
}

function updateAdminOrderSummary() {
  const html = adminOrderCart.map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem;background:var(--bg);border-radius:var(--radius-sm)">
      <div style="display:flex;align-items:center;gap:.5rem;flex:1">
        <span>${item.emoji}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:.85rem">${item.name}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">× ${item.qty} @ ${fmt(item.price)}</div>
        </div>
      </div>
      <div style="font-weight:700;margin-right:.5rem">${fmt(item.price * item.qty)}</div>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="removeAdminOrderItem('${item.sku}')" title="Remove">🗑</button>
    </div>
  `).join('');

  set('admin-order-items', html || '<div style="color:var(--text-muted);font-size:.85rem">No items added yet</div>');
}

function removeAdminOrderItem(sku) {
  adminOrderCart = adminOrderCart.filter(i => i.sku !== sku);
  updateAdminOrderSummary();
}

async function submitAdminOrder() {
  const customerId = el('order-customer').value;
  if (!customerId) { set('order-error', '<div class="alert alert-error">⚠️ Please select a customer.</div>'); return; }
  if (adminOrderCart.length === 0) { set('order-error', '<div class="alert alert-error">⚠️ Please add at least one product.</div>'); return; }

  const customer = Users.find(customerId);
  try {
    const order = await Orders.create(customerId, customer.name, adminOrderCart);
    adminOrderCart = [];
    toast(`Order ${order.id} created successfully!`, 'success');
    closeModal();
    renderAdminOrders();
  } catch (err) {
    set('order-error', `<div class="alert alert-error">⚠️ ${err.message}</div>`);
  }
}

// ── Stock History ─────────────────────────────────────────────
function renderStockHistory() {
  const movements = Movements.all();
  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Stock History</div>
          <div class="page-sub">${movements.length} movements recorded</div>
        </div>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date & Time</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Reason</th></tr></thead>
            <tbody>
              ${movements.length === 0
                ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📈</div><p>No stock movements yet.<br>They'll appear here as stock changes.</p></div></td></tr>`
                : movements.map(m=>`
                  <tr>
                    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${fmtDateTime(m.date)}</td>
                    <td style="font-weight:600">${m.productName}</td>
                    <td>${m.type==='in'
                      ? '<span class="badge badge-success">↑ IN</span>'
                      : '<span class="badge badge-danger">↓ OUT</span>'}</td>
                    <td style="font-weight:700;color:${m.type==='in'?'var(--accent-dark)':'var(--danger)'}">
                      ${m.type==='in'?'+':'−'}${m.qty}
                    </td>
                    <td style="font-size:.85rem;color:var(--text-muted)">${m.reason}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

// ════════════════════════════════════════════════════════
// CUSTOMER VIEWS
// ════════════════════════════════════════════════════════

function renderCustDashboard() {
  const orders  = Orders.byCustomer(currentUser.id);
  const spent   = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.total,0);
  const pending = orders.filter(o=>o.status==='pending').length;

  set('cust-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">My Dashboard</div>
          <div class="page-sub">Hello, ${currentUser.name}! Here's your account at a glance.</div>
        </div>
        <button class="btn btn-accent" onclick="navigate('catalog')">🛍️ Shop Now</button>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
        <div class="stat-card"><div class="stat-icon blue">🧾</div><div><div class="stat-label">Total Orders</div><div class="stat-value">${orders.length}</div><div class="stat-sub">All time</div></div></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><div><div class="stat-label">Pending</div><div class="stat-value">${pending}</div><div class="stat-sub">Awaiting fulfilment</div></div></div>
        <div class="stat-card"><div class="stat-icon green">💳</div><div><div class="stat-label">Total Spent</div><div class="stat-value">${fmt(spent)}</div><div class="stat-sub">All time</div></div></div>
      </div>

      <div class="dashboard-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
        <div class="card">
          <div class="card-header">
            <div class="card-title">🧾 Recent Orders</div>
            <button class="btn btn-outline btn-sm" onclick="navigate('my-orders')">View All</button>
          </div>
          ${orders.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📦</div><p>No orders yet.<br><a onclick="navigate('catalog')">Start shopping →</a></p></div>`
            : `<div style="display:flex;flex-direction:column">
                ${orders.slice(0,5).map(o=>`
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:.65rem 0;border-bottom:1px solid var(--border-light)">
                    <div>
                      <div style="font-weight:600;font-size:.82rem">${o.id}</div>
                      <div style="font-size:.75rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</div>
                    </div>
                    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:.2rem">
                      ${statusBadge(o.status)}
                      <div style="font-weight:700;font-size:.875rem">${fmt(o.total)}</div>
                    </div>
                  </div>`).join('')}
              </div>`}
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">🛍️ Featured Products</div>
            <button class="btn btn-accent btn-sm" onclick="navigate('catalog')">Browse All</button>
          </div>
          <div style="display:flex;flex-direction:column">
            ${Products.all().slice(0,5).map(p=>`
              <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--border-light)">
                <div style="font-size:1.4rem;width:36px;height:36px;background:linear-gradient(135deg,#f5f5f5,#eeeeee);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;flex-shrink:0">${p.emoji||categoryEmoji(p.category)}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
                  <div style="font-size:.75rem;color:var(--primary);font-weight:700">${fmt(p.price)}</div>
                </div>
                <button class="btn btn-accent btn-sm" onclick="addToCart('${p.sku}')" ${p.stock===0?'disabled':''}>
                  ${p.stock===0?'Out':'Add'}
                </button>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `);
}

// ── Catalog ───────────────────────────────────────────────────
let catSearch = '', catCategory = '';

function renderCatalog() {
  const all  = Products.all();
  const cats = [...new Set(all.map(p=>p.category))];
  const prods = all.filter(p =>
    (!catSearch  || p.name.toLowerCase().includes(catSearch.toLowerCase())) &&
    (!catCategory || p.category === catCategory)
  );

  set('cust-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Browse Products</div>
          <div class="page-sub">${all.length} products available</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-bar" style="flex:1;min-width:200px">
          <span class="search-icon">🔍</span>
          <input class="form-control" placeholder="Search products…" value="${catSearch}" oninput="catSearch=this.value;renderCatalog()">
        </div>
        <select class="form-control" style="width:auto;min-width:150px" onchange="catCategory=this.value;renderCatalog()">
          <option value="">All Categories</option>
          ${cats.map(c=>`<option value="${c}" ${catCategory===c?'selected':''}>${c}</option>`).join('')}
        </select>
        ${catSearch||catCategory ? `<button class="btn btn-ghost btn-sm" onclick="catSearch='';catCategory='';renderCatalog()">✕ Clear</button>` : ''}
      </div>

      ${prods.length === 0
        ? `<div class="card"><div class="empty-state"><div class="empty-icon">🔍</div><p>No products match your search.</p></div></div>`
        : `<div class="products-grid">
            ${prods.map(p=>`
              <div class="product-card">
                <div class="product-img">${p.emoji||categoryEmoji(p.category)}</div>
                <div class="product-body">
                  <div class="product-name">${p.name}</div>
                  <div class="product-sku">SKU: ${p.sku}</div>
                  <div class="product-stock">${stockBadge(p)} · ${p.stock} in stock</div>
                  <div class="product-price">${fmt(p.price)}<span style="font-size:.72rem;font-weight:400;color:var(--text-muted)"></span></div>
                  <button class="btn btn-accent w-full" onclick="addToCart('${p.sku}')" ${p.stock===0?'disabled':''}>
                    ${p.stock===0 ? 'Out of Stock' : '🛒 Add to Cart'}
                  </button>
                </div>
              </div>`).join('')}
          </div>`}
    </div>
  `);
}

// ── Cart ──────────────────────────────────────────────────────
function addToCart(sku) {
  const p = Products.find(sku);
  if (!p||p.stock===0) { toast('Product is out of stock.','error'); return; }
  const existing = cart.find(i=>i.sku===sku);
  if (existing) {
    if (existing.qty + 1 > p.stock) { toast(`Only ${p.stock} in stock available.`,'warning'); return; }
    existing.qty++;
  } else {
    cart.push({ sku, name: p.name, price: p.price, qty: 1, emoji: p.emoji||categoryEmoji(p.category), unit: p.unit });
  }
  toast(`${p.name} added to cart!`, 'success');
  renderCustomerNav();
  if (currentView === 'cart') renderCart();
}

function updateCartQty(sku, delta) {
  const item = cart.find(i=>i.sku===sku); if (!item) return;
  const p = Products.find(sku);
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    cart = cart.filter(i=>i.sku!==sku);
  } else if (p && newQty > p.stock) {
    toast(`Only ${p.stock} in stock available.`,'warning');
    return;
  } else {
    item.qty = newQty;
  }
  renderCart(); renderCustomerNav();
}

function removeFromCart(sku) {
  cart = cart.filter(i=>i.sku!==sku); renderCart(); renderCustomerNav();
}

function renderCart() {
  const total = cart.reduce((s,i)=>s+i.price*i.qty, 0);
  set('cust-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">My Cart</div>
          <div class="page-sub">${cart.length === 0 ? 'Your cart is empty' : `${cart.reduce((s,i)=>s+i.qty,0)} item${cart.reduce((s,i)=>s+i.qty,0)!==1?'s':''}`}</div>
        </div>
        ${cart.length>0 ? `<button class="btn btn-ghost btn-sm" onclick="cart=[];renderCart();renderCustomerNav()">Clear Cart</button>` : ''}
      </div>

      ${cart.length === 0
        ? `<div class="card"><div class="empty-state"><div class="empty-icon">🛒</div><p>Your cart is empty.<br><a onclick="navigate('catalog')">Browse products →</a></p></div></div>`
        : `<div id="cart-layout" style="display:grid;grid-template-columns:1fr 320px;gap:1.25rem;align-items:start">
            <div class="card">
              <div style="font-weight:700;margin-bottom:1rem;font-size:.875rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Cart Items</div>
              ${cart.map(item=>`
                <div class="cart-item">
                  <div class="cart-item-thumb">${item.emoji}</div>
                  <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${fmt(item.price)} / ${item.unit}</div>
                  </div>
                  <div class="qty-control">
                    <button class="qty-btn" onclick="updateCartQty('${item.sku}',-1)">−</button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="updateCartQty('${item.sku}',1)">+</button>
                  </div>
                  <div style="font-weight:700;min-width:64px;text-align:right">${fmt(item.price*item.qty)}</div>
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="removeFromCart('${item.sku}')" title="Remove">🗑</button>
                </div>`).join('')}
            </div>

            <div style="position:sticky;top:78px">
              <div class="card">
                <div style="font-weight:700;margin-bottom:1rem">Order Summary</div>
                <div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:1rem">
                  ${cart.map(i=>`
                    <div style="display:flex;justify-content:space-between;font-size:.85rem">
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;color:var(--text-muted)">${i.name} × ${i.qty}</span>
                      <span style="font-weight:600;flex-shrink:0">${fmt(i.price*i.qty)}</span>
                    </div>`).join('')}
                </div>
                <hr class="divider">
                <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:800;margin-bottom:1.25rem">
                  <span>Total</span><span style="color:var(--primary)">${fmt(total)}</span>
                </div>
                <button class="btn btn-accent w-full btn-lg" onclick="checkout()">Place Order →</button>
                <button class="btn btn-ghost w-full mt-2" onclick="navigate('catalog')">← Continue Shopping</button>
              </div>
            </div>
          </div>`}
    </div>
  `);

  const layout = el('cart-layout');
  if (layout && window.innerWidth < 768) layout.style.gridTemplateColumns = '1fr';
}

async function checkout() {
  if (cart.length === 0) { toast('Your cart is empty.','warning'); return; }
  for (const item of cart) {
    const p = Products.find(item.sku);
    if (!p||p.stock<item.qty) { toast(`Not enough stock for "${item.name}".`,'error'); return; }
  }
  try {
    const order = await Orders.create(currentUser.id, currentUser.name, cart);
    cart = []; renderCustomerNav();
    toast(`Order ${order.id} placed successfully!`, 'success');
    navigate('my-orders');
  } catch (err) {
    toast(`Error placing order: ${err.message}`, 'error');
  }
}

// ── My Orders ─────────────────────────────────────────────────
function renderMyOrders() {
  const orders = Orders.byCustomer(currentUser.id);
  set('cust-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">My Orders</div>
          <div class="page-sub">${orders.length} order${orders.length!==1?'s':''} placed</div>
        </div>
      </div>

      ${orders.length === 0
        ? `<div class="card"><div class="empty-state"><div class="empty-icon">📋</div><p>You haven't placed any orders yet.<br><a onclick="navigate('catalog')">Start shopping →</a></p></div></div>`
        : orders.map(o=>`
          <div class="card" style="margin-bottom:.9rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-bottom:.9rem">
              <div>
                <div style="font-weight:700;margin-bottom:.2rem">
                  Order <code style="background:var(--border-light);padding:.1rem .4rem;border-radius:4px;font-size:.82rem">${o.id}</code>
                </div>
                <div style="font-size:.8rem;color:var(--text-muted)">${fmtDateTime(o.createdAt)}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.25rem">
                ${statusBadge(o.status)}
                <div style="font-weight:800;font-size:1rem;color:var(--primary)">${fmt(o.total)}</div>
              </div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:.5rem">
              ${o.items.map(i=>`
                <div style="display:flex;align-items:center;gap:.4rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.35rem .7rem;font-size:.8rem">
                  <span>${i.emoji||'📦'}</span>
                  <span style="font-weight:500">${i.name}</span>
                  <span style="color:var(--text-muted)">× ${i.qty}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}
    </div>
  `);
}

// ── User Management ──────────────────────────────────────────
function renderAdminUsers() {
  const users = Users.all();
  const customers = users.filter(u => u.role === 'customer');
  const admins = users.filter(u => u.role === 'admin');

  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">User Accounts</div>
          <div class="page-sub">${users.length} total users · ${admins.length} admin${admins.length!==1?'s':''}</div>
        </div>
        <button class="btn btn-primary" onclick="openCreateUserModal()">+ Create User</button>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div style="font-weight:700;margin-bottom:1rem;font-size:.875rem;color:var(--text-muted);text-transform:uppercase">Admin Accounts (${admins.length})</div>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${admins.length === 0
            ? '<div style="color:var(--text-muted);font-size:.85rem">No admins yet</div>'
            : admins.map(u=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light)">
                <div>
                  <div style="font-weight:600;font-size:.9rem">${u.name}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">${u.username} · ${u.email}</div>
                </div>
                <div style="display:flex;gap:.35rem">
                  <button class="btn btn-outline btn-sm" onclick="openEditUserModal('${u.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button>
                </div>
              </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;margin-bottom:1rem;font-size:.875rem;color:var(--text-muted);text-transform:uppercase">Customer Accounts (${customers.length})</div>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${customers.length === 0
            ? '<div style="color:var(--text-muted);font-size:.85rem">No customers yet</div>'
            : customers.map(u=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light)">
                <div>
                  <div style="font-weight:600;font-size:.9rem">${u.name}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">${u.username} · ${u.email}</div>
                </div>
                <div style="display:flex;gap:.35rem">
                  <button class="btn btn-outline btn-sm" onclick="openEditUserModal('${u.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>
  `);
}

function openCreateUserModal() {
  showModal(`
    <div class="modal-header"><div class="modal-title">Create New User</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div id="user-error"></div>
      <div class="form-group">
        <label>Full Name *</label>
        <input class="form-control" id="user-name" placeholder="Jane Smith">
      </div>
      <div class="form-group">
        <label>Username *</label>
        <input class="form-control" id="user-username" placeholder="jane_smith">
      </div>
      <div class="form-group">
        <label>Email *</label>
        <input class="form-control" id="user-email" type="email" placeholder="jane@example.com">
      </div>
      <div class="form-group">
        <label>Password *</label>
        <input class="form-control" id="user-password" type="password" placeholder="Minimum 6 characters">
      </div>
      <div class="form-group">
        <label>Role *</label>
        <select class="form-control" id="user-role">
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewUser()">Create User</button>
    </div>
  `);
}

function openEditUserModal(userId) {
  const user = Users.find(userId);
  if (!user) return;
  showModal(`
    <div class="modal-header"><div class="modal-title">Edit User</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div id="user-error"></div>
      <div class="form-group">
        <label>Full Name *</label>
        <input class="form-control" id="user-name" value="${user.name}">
      </div>
      <div class="form-group">
        <label>Username</label>
        <input class="form-control" value="${user.username}" disabled style="background:var(--bg);cursor:not-allowed">
      </div>
      <div class="form-group">
        <label>Email *</label>
        <input class="form-control" id="user-email" type="email" value="${user.email}">
      </div>
      <div class="form-group">
        <label>Role *</label>
        <select class="form-control" id="user-role">
          <option value="customer" ${user.role==='customer'?'selected':''}>Customer</option>
          <option value="admin" ${user.role==='admin'?'selected':''}>Admin</option>
        </select>
      </div>
      <div class="form-group">
        <label>Reset Password (leave blank to keep current)</label>
        <input class="form-control" id="user-password" type="password" placeholder="New password">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditUser('${userId}')">Save Changes</button>
    </div>
  `);
}

async function saveNewUser() {
  const name = el('user-name').value.trim();
  const username = el('user-username').value.trim();
  const email = el('user-email').value.trim();
  const password = el('user-password').value;
  const role = el('user-role').value;

  if (!name || !username || !email || !password) {
    set('user-error', '<div class="alert alert-error">⚠️ Please fill in all required fields.</div>');
    return;
  }

  if (password.length < 6) {
    set('user-error', '<div class="alert alert-error">⚠️ Password must be at least 6 characters.</div>');
    return;
  }

  const res = await Users.create(name, username, email, password, role);
  if (res.error) {
    set('user-error', `<div class="alert alert-error">⚠️ ${res.error}</div>`);
    return;
  }

  toast(`User "${name}" created successfully!`, 'success');
  closeModal();
  renderAdminUsers();
}

async function saveEditUser(userId) {
  const name = el('user-name').value.trim();
  const email = el('user-email').value.trim();
  const password = el('user-password').value;
  const role = el('user-role').value;

  if (!name || !email) {
    set('user-error', '<div class="alert alert-error">⚠️ Please fill in all required fields.</div>');
    return;
  }

  if (password && password.length < 6) {
    set('user-error', '<div class="alert alert-error">⚠️ Password must be at least 6 characters.</div>');
    return;
  }

  try {
    const updateData = { name, email, role };
    if (password) updateData.password = password;
    await Users.update(userId, updateData);
    toast('User updated successfully!', 'success');
    closeModal();
    renderAdminUsers();
  } catch (err) {
    set('user-error', `<div class="alert alert-error">⚠️ ${err.message}</div>`);
  }
}

function deleteUser(userId) {
  if (userId === currentUser.id) {
    toast('You cannot delete your own account', 'error');
    return;
  }

  const user = Users.find(userId);
  if (!user) return;

  showModal(`
    <div class="modal-header"><div class="modal-title">Delete User</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <p>Are you sure you want to delete <strong>${user.name}</strong>?</p>
      <p style="margin-top:.5rem;font-size:.875rem;color:var(--text-muted)">This action cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="confirmDeleteUser('${userId}')">Delete User</button>
    </div>
  `);
}

async function confirmDeleteUser(userId) {
  const user = Users.find(userId);
  try {
    await Users.delete(userId);
    toast(`User "${user.name}" deleted.`, 'warning');
    closeModal();
    renderAdminUsers();
  } catch (err) {
    toast(`Error deleting user: ${err.message}`, 'error');
  }
}

// ── Admin Profile ─────────────────────────────────────────────
function renderAdminProfile() {
  set('admin-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Account Settings</div>
          <div class="page-sub">Manage your admin account</div>
        </div>
      </div>

      <div class="card" style="max-width:500px">
        <div style="font-weight:700;margin-bottom:1.5rem">Profile Information</div>
        <div id="profile-error"></div>
        <div class="form-group">
          <label>Full Name</label>
          <input class="form-control" id="prof-name" value="${currentUser.name}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" id="prof-email" value="${currentUser.email}" type="email">
        </div>
        <div class="form-group">
          <label>Role</label>
          <input class="form-control" value="Admin" disabled style="background:var(--bg);cursor:not-allowed">
        </div>
        <button class="btn btn-primary" onclick="saveProfileChanges()">Save Changes</button>
      </div>

      <div class="card" style="max-width:500px;margin-top:1.5rem">
        <div style="font-weight:700;margin-bottom:1.5rem">Change Password</div>
        <div id="password-error"></div>
        <div class="form-group">
          <label>Current Password</label>
          <input class="form-control" id="pass-current" type="password" placeholder="Enter current password">
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input class="form-control" id="pass-new" type="password" placeholder="Enter new password">
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input class="form-control" id="pass-confirm" type="password" placeholder="Confirm new password">
        </div>
        <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
      </div>
    </div>
  `);
}

// ── Customer Profile ──────────────────────────────────────────
function renderCustProfile() {
  set('cust-content', `
    <div class="page">
      <div class="page-header">
        <div class="page-header-text">
          <div class="page-title">Account Settings</div>
          <div class="page-sub">Manage your account</div>
        </div>
      </div>

      <div class="card" style="max-width:500px">
        <div style="font-weight:700;margin-bottom:1.5rem">Profile Information</div>
        <div id="profile-error"></div>
        <div class="form-group">
          <label>Full Name</label>
          <input class="form-control" id="prof-name" value="${currentUser.name}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" id="prof-email" value="${currentUser.email}" type="email">
        </div>
        <button class="btn btn-primary" onclick="saveProfileChanges()">Save Changes</button>
      </div>

      <div class="card" style="max-width:500px;margin-top:1.5rem">
        <div style="font-weight:700;margin-bottom:1.5rem">Change Password</div>
        <div id="password-error"></div>
        <div class="form-group">
          <label>Current Password</label>
          <input class="form-control" id="pass-current" type="password" placeholder="Enter current password">
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input class="form-control" id="pass-new" type="password" placeholder="Enter new password">
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input class="form-control" id="pass-confirm" type="password" placeholder="Confirm new password">
        </div>
        <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
      </div>
    </div>
  `);
}

async function saveProfileChanges() {
  const name = el('prof-name').value.trim();
  const email = el('prof-email').value.trim();

  if (!name || !email) {
    set('profile-error', '<div class="alert alert-error">⚠️ Please fill in all fields.</div>');
    return;
  }

  try {
    await Users.update(currentUser.id, { name, email, role: currentUser.role });
    currentUser = { ...currentUser, name, email };
    Session.set(currentUser);
    set('profile-error', '<div class="alert alert-success">✅ Profile updated successfully!</div>');
    renderAdminNav();
    renderCustomerNav();
  } catch (err) {
    set('profile-error', `<div class="alert alert-error">⚠️ ${err.message}</div>`);
  }
}

async function changePassword() {
  const current = el('pass-current').value;
  const newPass = el('pass-new').value;
  const confirm = el('pass-confirm').value;

  if (!current || !newPass || !confirm) {
    set('password-error', '<div class="alert alert-error">⚠️ Please fill in all fields.</div>');
    return;
  }

  if (current !== currentUser.password) {
    set('password-error', '<div class="alert alert-error">⚠️ Current password is incorrect.</div>');
    return;
  }

  if (newPass !== confirm) {
    set('password-error', '<div class="alert alert-error">⚠️ New passwords do not match.</div>');
    return;
  }

  if (newPass.length < 6) {
    set('password-error', '<div class="alert alert-error">⚠️ Password must be at least 6 characters.</div>');
    return;
  }

  try {
    await Users.update(currentUser.id, { name: currentUser.name, email: currentUser.email, role: currentUser.role, password: newPass });
    currentUser = { ...currentUser, password: newPass };
    Session.set(currentUser);

    el('pass-current').value = '';
    el('pass-new').value = '';
    el('pass-confirm').value = '';

    set('password-error', '<div class="alert alert-success">✅ Password changed successfully!</div>');
  } catch (err) {
    set('password-error', `<div class="alert alert-error">⚠️ ${err.message}</div>`);
  }
}

// ════════════════════════════════════════════════════════
// MOBILE VIEWS
// ════════════════════════════════════════════════════════

function renderMobileAdminDashboard() {
  const orders   = Orders.all();
  const lowStock = Products.lowStock();
  const pending  = orders.filter(o => o.status === 'pending').length;

  set('mobile-admin-content', `
    <div class="mobile-content" style="padding:.75rem">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
        <div style="background:linear-gradient(135deg,#1a1a1a,#333333);color:white;border-radius:12px;padding:1rem;text-align:center">
          <div style="font-size:2rem;font-weight:700;margin-bottom:.25rem">${pending}</div>
          <div style="font-size:.75rem;opacity:.9">Pending Orders</div>
        </div>
        <div style="background:linear-gradient(135deg,var(--warning),#ff9800);color:white;border-radius:12px;padding:1rem;text-align:center">
          <div style="font-size:2rem;font-weight:700;margin-bottom:.25rem">${lowStock.length}</div>
          <div style="font-size:.75rem;opacity:.9">Low Stock</div>
        </div>
      </div>

      ${lowStock.length > 0 ? `
        <div style="background:white;border-radius:12px;border:1px solid var(--border-light);padding:.75rem;margin-bottom:.75rem">
          <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem">⚠️ Low Stock</div>
          ${lowStock.slice(0,1).map(p=>`
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:.85rem;font-weight:500">${p.name}</div>
                <div style="font-size:.7rem;color:var(--text-muted)">${p.stock}/${p.min_stock} units</div>
              </div>
              <button class="btn btn-sm btn-outline" onclick="openAdjust('${p.sku}')" style="padding:.25rem .5rem;font-size:.7rem">+</button>
            </div>`).join('')}
        </div>
      ` : ''}

      ${pending > 0 ? `
        <div style="background:white;border-radius:12px;border:1px solid var(--border-light);padding:.75rem">
          <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem">🧾 Pending</div>
          ${orders.filter(o=>o.status==='pending').slice(0,1).map(o=>`
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:.85rem;font-weight:500">#${o.id.replace('ORD-','')}</div>
                <div style="font-size:.7rem;color:var(--text-muted)">${o.customerName}</div>
              </div>
              <span style="font-weight:700;color:var(--primary);font-size:.9rem">${fmt(o.total)}</span>
            </div>`).join('')}
        </div>
      ` : ''}
    </div>
  `);
}

function renderMobileInventory() {
  const products = Products.all();

  set('mobile-admin-content', `
    <div class="mobile-content">
      <div style="display:flex;gap:.25rem;margin-bottom:1rem">
        <button class="btn btn-primary" style="flex:1" onclick="openAddProduct()">+ Add</button>
        <button class="btn btn-outline" style="flex:1" onclick="openBarcodeScanner('create')">📸 Scan</button>
        <button class="btn btn-outline" style="flex:0.5;padding:0" onclick="openManualBarcodeEntry('create')" title="Manual entry">✎</button>
      </div>

      ${products.length === 0
        ? '<div class="empty-state"><p>No products</p></div>'
        : products.map(p => `
          <div class="card" style="margin-bottom:.75rem">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.5rem">
              <div>
                <div style="font-weight:600;font-size:.95rem">${p.name}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${p.sku}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--primary)">${p.stock}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">units</div>
              </div>
            </div>
            <div style="display:flex;gap:.5rem">
              <button class="btn btn-sm btn-outline" style="flex:1" onclick="openEditProduct('${p.sku}')">Edit</button>
              <button class="btn btn-sm btn-outline" style="flex:1" onclick="openAdjust('${p.sku}')">Stock</button>
              <button class="btn btn-sm btn-danger" style="flex:1;padding:0" onclick="deleteProduct('${p.sku}')">🗑</button>
            </div>
          </div>`).join('')}
    </div>
  `);
}

function renderMobileBulkStock() {
  const products = Products.all();

  set('mobile-admin-content', `
    <div class="mobile-content">
      <div style="margin-bottom:1rem">
        <div style="font-weight:600;font-size:.9rem;margin-bottom:.5rem">Select Products</div>
        <input type="text" id="bulk-search" class="form-control" placeholder="Search by name or SKU..." value="${bulkSearch}" onkeyup="bulkSearch = el('bulk-search').value; clearTimeout(bulkSearchTimeout); bulkSearchTimeout = setTimeout(() => renderMobileBulkStock(), 200)" style="margin-bottom:.75rem">
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
          <button class="btn btn-sm btn-outline" style="flex:1" onclick="bulkSelectAll()">All</button>
          <button class="btn btn-sm btn-outline" style="flex:1" onclick="bulkClearAll()">Clear</button>
          <div style="flex:1;text-align:center;padding:.5rem;background:var(--bg-light);border-radius:6px;font-size:.8rem;font-weight:600">${bulkChecked.length} selected</div>
        </div>
        <div style="max-height:250px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
          ${(() => {
            const filtered = products.filter(p =>
              bulkSearch === '' ||
              p.name.toLowerCase().includes(bulkSearch.toLowerCase()) ||
              p.sku.toLowerCase().includes(bulkSearch.toLowerCase())
            );
            return filtered.length === 0
            ? '<div style="text-align:center;color:var(--text-muted);padding:1rem">No products found</div>'
            : filtered.map(p => `
              <div style="display:flex;align-items:center;padding:.75rem;border-bottom:1px solid var(--border-light)">
                <input type="checkbox" id="bulk-mobile-${p.sku}" ${bulkChecked.includes(p.sku) ? 'checked' : ''} onchange="toggleBulkSelect('${p.sku}')" style="margin-right:.5rem;cursor:pointer;width:18px;height:18px">
                <label for="bulk-mobile-${p.sku}" style="flex:1;cursor:pointer">
                  <div style="font-weight:500;font-size:.9rem">${p.name}</div>
                  <div style="font-size:.75rem;color:var(--text-muted)">${p.sku} • ${p.stock} units</div>
                </label>
              </div>`).join('');
          })()}
        </div>
      </div>

      ${bulkChecked.length === 0 ? '' : `
      <div class="card">
        <div style="margin-bottom:1rem">
          <div style="font-weight:600;font-size:.9rem;margin-bottom:.75rem">Quantities</div>
          ${Products.all().filter(p => bulkChecked.includes(p.sku)).map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;padding:.5rem;background:var(--bg-light);border-radius:6px">
              <div>
                <div style="font-weight:500;font-size:.85rem">${p.name}</div>
                <div style="font-size:.7rem;color:var(--text-muted)">${p.sku}</div>
              </div>
              <input type="number" id="bulk-qty-${p.sku}" class="form-control" style="width:70px" min="1" value="${bulkQuantities[p.sku] || 10}">
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.3rem">Operation</label>
          <select id="bulk-operation" class="form-control">
            <option value="in">📥 Stock In (Add)</option>
            <option value="out">📤 Stock Out (Remove)</option>
          </select>
        </div>

        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.3rem">Reason</label>
          <input id="bulk-reason" class="form-control" type="text" placeholder="e.g. Restock, Damage">
        </div>

        <button class="btn btn-primary btn-lg w-full" onclick="applyBulkStock()">Apply to ${bulkChecked.length} Product${bulkChecked.length!==1?'s':''}</button>
      </div>
      `}
    </div>
  `);
}

function renderMobileAdminOrders() {

  const orders = Orders.all();

  set('mobile-admin-content', `
    <div class="mobile-content">
      ${orders.length === 0
        ? '<div class="empty-state"><p>No orders</p></div>'
        : orders.map(o => `
          <div class="card" style="margin-bottom:.75rem">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.75rem">
              <div>
                <div style="font-weight:600">#${o.id.replace('ORD-','')}</div>
                <div style="font-size:.8rem;color:var(--text-muted)">${o.customerName}</div>
              </div>
              ${statusBadge(o.status)}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;padding:.5rem;background:var(--bg);border-radius:8px">
              <div>
                <div style="font-size:.75rem;color:var(--text-muted)">Total</div>
                <div style="font-weight:700;font-size:1.1rem">${fmt(o.total)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:.75rem;color:var(--text-muted)">Items</div>
                <div style="font-weight:700;font-size:1.1rem">${o.items.length}</div>
              </div>
            </div>
            <div style="display:flex;gap:.5rem">
              <button class="btn btn-sm btn-outline" style="flex:1" onclick="viewMobileOrderDetails('${o.id}')">View</button>
              <select class="form-control" style="font-size:.85rem;flex:1" onchange="updateOrderStatus('${o.id}',this.value)">
                ${['pending','processing','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>`).join('')}
    </div>
  `);
}

function renderMobileStockHistory() {

  const movements = Movements.all().slice(0, 20);

  set('mobile-admin-content', `
    <div class="mobile-content">
      ${movements.length === 0
        ? '<div class="empty-state"><p>No history</p></div>'
        : movements.map(m => `
          <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;margin-bottom:.5rem">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.95rem;margin-bottom:.25rem">${m.product_name}</div>
              <div style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.reason}</div>
            </div>
            <div style="margin-left:.75rem;text-align:right;font-weight:700;color:${m.type==='in'?'var(--success)':'var(--danger)'}">
              ${m.type==='in'?'+':'-'}${m.qty}
            </div>
          </div>`).join('')}
    </div>
  `);
}

function renderMobileAdminUsers() {

  const users = Users.all();

  set('mobile-admin-content', `
    <div class="mobile-content">
      <button class="btn btn-primary w-full" onclick="openAddUser()" style="margin-bottom:1rem">+ Add User</button>

      ${users.map(u => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <div style="flex:1">
            <div style="font-weight:600;margin-bottom:.25rem">${u.name}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${u.email}</div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="openEditUser('${u.id}')">Edit</button>
        </div>`).join('')}
    </div>
  `);
}

function renderMobileAdminProfile() {

  set('mobile-admin-content', `
    <div class="mobile-content">
      <div class="card">
        <div class="card-title">👤 Profile</div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Name</label>
          <input class="form-control" id="admin-prof-name" value="${currentUser.name}">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Email</label>
          <input class="form-control" id="admin-prof-email" value="${currentUser.email}" type="email">
        </div>
        <button class="btn btn-primary w-full" onclick="updateAdminMobileProfile()">Save Changes</button>
      </div>

      <div class="card">
        <div class="card-title">🔐 Change Password</div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Current</label>
          <input class="form-control" id="admin-prof-pass-current" type="password">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">New</label>
          <input class="form-control" id="admin-prof-pass-new" type="password">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Confirm</label>
          <input class="form-control" id="admin-prof-pass-confirm" type="password">
        </div>
        <button class="btn btn-primary w-full" onclick="changeAdminMobilePassword()">Update Password</button>
      </div>

      <button class="btn btn-ghost w-full" onclick="logout()" style="margin-top:1rem">Sign Out</button>
    </div>
  `);
}

async function updateAdminMobileProfile() {
  const name = el('admin-prof-name').value.trim();
  const email = el('admin-prof-email').value.trim();
  if (!name || !email) { toast('Please fill in all fields', 'warning'); return; }
  try {
    await Users.update(currentUser.id, { name, email, role: currentUser.role, password: currentUser.password });
    currentUser = { ...currentUser, name, email };
    Session.set(currentUser);
    toast('Profile updated!', 'success');
    renderMobileAdminProfile();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function changeAdminMobilePassword() {
  const current = el('admin-prof-pass-current').value;
  const newPass = el('admin-prof-pass-new').value;
  const confirm = el('admin-prof-pass-confirm').value;
  if (!current || !newPass || !confirm) { toast('Fill in all fields', 'warning'); return; }
  if (current !== currentUser.password) { toast('Current password incorrect', 'error'); return; }
  if (newPass !== confirm) { toast('Passwords do not match', 'error'); return; }
  if (newPass.length < 6) { toast('Password must be 6+ chars', 'warning'); return; }
  try {
    await Users.update(currentUser.id, { name: currentUser.name, email: currentUser.email, role: currentUser.role, password: newPass });
    currentUser = { ...currentUser, password: newPass };
    Session.set(currentUser);
    toast('Password updated!', 'success');
    el('admin-prof-pass-current').value = '';
    el('admin-prof-pass-new').value = '';
    el('admin-prof-pass-confirm').value = '';
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

function renderMobileCustDashboard() {
  const myOrders = Orders.byCustomer(currentUser.id);

  set('mobile-customer-content', `
    <div class="mobile-content" style="padding:.75rem;display:flex;flex-direction:column;gap:.75rem;height:100%">
      <div style="background:linear-gradient(135deg,#1a1a1a,#333333);color:white;border-radius:12px;padding:1rem;text-align:center">
        <div style="font-size:.85rem;opacity:.9">Welcome back</div>
        <div style="font-size:1.1rem;font-weight:700">${currentUser.name}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <button class="btn" onclick="navigate('catalog')" style="background:linear-gradient(135deg,#1a1a1a,#404040);color:white;border:none;border-radius:12px;padding:1rem;text-align:center;cursor:pointer">
          <div style="font-size:1.5rem;margin-bottom:.25rem">🛍️</div>
          <div style="font-size:.75rem;font-weight:600">${Products.all().length} Products</div>
        </button>
        <button class="btn" onclick="navigate('my-orders')" style="background:linear-gradient(135deg,#333333,#1a1a1a);color:white;border:none;border-radius:12px;padding:1rem;text-align:center;cursor:pointer">
          <div style="font-size:1.5rem;margin-bottom:.25rem">📋</div>
          <div style="font-size:.75rem;font-weight:600">${myOrders.length} Orders</div>
        </button>
      </div>

      <button class="btn btn-primary w-full" onclick="navigate('catalog')" style="margin-top:auto">Continue Shopping</button>
    </div>
  `);
}

function renderMobileCatalog() {
  const products = Products.all();

  set('mobile-customer-content', `
    <div class="mobile-content">
      <div style="display:flex;gap:.25rem;margin-bottom:1rem">
        <button class="btn btn-outline" style="flex:1" onclick="openBarcodeScanner('search')">📸 Scan</button>
        <button class="btn btn-outline" style="flex:0.5;padding:0" onclick="openManualBarcodeEntry('search')" title="Manual entry">✎</button>
      </div>

      ${products.length === 0
        ? '<div class="empty-state"><p>No products available</p></div>'
        : products.map(p => `
          <div class="card" style="display:flex;gap:1rem;margin-bottom:.75rem">
            <div style="font-size:2rem;flex-shrink:0">${categoryEmoji(p.category)}</div>
            <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <div style="font-weight:600;margin-bottom:.25rem">${p.name}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-weight:700;color:var(--primary);font-size:1.1rem">${fmt(p.price)}</div>
                <button class="btn btn-sm btn-primary" onclick="addToCartMobile('${p.sku}')" ${p.stock===0?'disabled':''}>+</button>
              </div>
            </div>
          </div>`).join('')}
    </div>
  `);
}

function renderMobileCart() {

  if (cart.length === 0) {
    set('mobile-customer-content', `
      <div class="mobile-content">
        <div class="empty-state" style="padding:2rem 1rem">
          <div class="empty-icon">🛒</div>
          <p>Cart is empty</p>
          <button class="btn btn-primary" onclick="navigate('catalog')" style="margin-top:1rem">Shop Now</button>
        </div>
      </div>
    `);
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  set('mobile-customer-content', `
    <div class="mobile-content">
      ${cart.map(item => `
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;margin-bottom:.5rem">
          <div style="flex:1">
            <div style="font-weight:600;margin-bottom:.25rem">${item.name}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${fmt(item.price)} × ${item.qty}</div>
          </div>
          <div style="text-align:right;margin-right:.75rem">
            <div style="font-weight:700">${fmt(item.price * item.qty)}</div>
          </div>
          <button class="btn btn-sm btn-ghost" onclick="removeFromCart('${item.sku}')" style="padding:.25rem">×</button>
        </div>`).join('')}

      <div class="card" style="margin-top:1rem;padding:1rem;background:var(--bg);border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;font-size:1.1rem">
          <span style="font-weight:600">Total:</span>
          <span style="font-weight:700;color:var(--primary)">${fmt(total)}</span>
        </div>
        <button class="btn btn-primary w-full btn-lg" onclick="checkoutMobile()">Place Order</button>
      </div>
    </div>
  `);
}

function renderMobileMyOrders() {
  const orders = Orders.byCustomer(currentUser.id);

  set('mobile-customer-content', `
    <div class="mobile-content">
      ${orders.length === 0
        ? '<div class="empty-state"><p>No orders yet</p></div>'
        : orders.map(o => `
          <div class="card" style="margin-bottom:.75rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
              <div style="font-weight:600">#${o.id.replace('ORD-','')}</div>
              ${statusBadge(o.status)}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem">
              <span>${fmtDate(o.createdAt)}</span>
              <span>${o.items.length} item${o.items.length!==1?'s':''}</span>
            </div>
            <div style="font-weight:700;color:var(--primary);font-size:1.1rem">${fmt(o.total)}</div>
          </div>`).join('')}
    </div>
  `);
}

function renderMobileCustProfile() {
  set('mobile-customer-content', `
    <div class="mobile-content">
      <div class="card">
        <div class="card-title">👤 Profile</div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Name</label>
          <input class="form-control" id="prof-name" value="${currentUser.name}">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Email</label>
          <input class="form-control" id="prof-email" value="${currentUser.email}" type="email">
        </div>
        <button class="btn btn-primary w-full" onclick="updateMobileProfile()">Save Changes</button>
      </div>

      <div class="card">
        <div class="card-title">🔐 Change Password</div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Current</label>
          <input class="form-control" id="prof-pass-current" type="password">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">New</label>
          <input class="form-control" id="prof-pass-new" type="password">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.25rem">Confirm</label>
          <input class="form-control" id="prof-pass-confirm" type="password">
        </div>
        <button class="btn btn-primary w-full" onclick="changeMobilePassword()">Update Password</button>
      </div>

      <button class="btn btn-ghost w-full" onclick="logout()" style="margin-top:1rem">Sign Out</button>
    </div>
  `);
}

function addToCartMobile(sku) {
  const p = Products.find(sku); if (!p) return;
  const existing = cart.find(i => i.sku === sku);
  if (existing) {
    if (existing.qty < p.stock) existing.qty++;
    else { toast('Cannot exceed available stock', 'warning'); return; }
  } else {
    if (p.stock > 0) cart.push({ ...p, qty: 1 });
    else { toast('Out of stock', 'error'); return; }
  }
  toast(`Added ${p.name} to cart`, 'success');
  renderMobileCatalog();
}

function removeFromCart(sku) {
  cart = cart.filter(i => i.sku !== sku);
  renderMobileCart();
}

async function checkoutMobile() {
  if (cart.length === 0) { toast('Cart is empty', 'warning'); return; }
  const items = cart.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price }));
  try {
    await Orders.create(currentUser.id, currentUser.name, items);
    cart = [];
    toast('Order placed successfully!', 'success');
    navigate('my-orders');
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function updateMobileProfile() {
  const name = el('prof-name').value.trim();
  const email = el('prof-email').value.trim();
  if (!name || !email) { toast('Please fill in all fields', 'warning'); return; }
  try {
    await Users.update(currentUser.id, { name, email, role: currentUser.role, password: currentUser.password });
    currentUser = { ...currentUser, name, email };
    Session.set(currentUser);
    toast('Profile updated!', 'success');
    renderMobileCustProfile();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

async function changeMobilePassword() {
  const current = el('prof-pass-current').value;
  const newPass = el('prof-pass-new').value;
  const confirm = el('prof-pass-confirm').value;
  if (!current || !newPass || !confirm) { toast('Fill in all fields', 'warning'); return; }
  if (current !== currentUser.password) { toast('Current password incorrect', 'error'); return; }
  if (newPass !== confirm) { toast('Passwords do not match', 'error'); return; }
  if (newPass.length < 6) { toast('Password must be 6+ chars', 'warning'); return; }
  try {
    await Users.update(currentUser.id, { name: currentUser.name, email: currentUser.email, role: currentUser.role, password: newPass });
    currentUser = { ...currentUser, password: newPass };
    Session.set(currentUser);
    toast('Password updated!', 'success');
    el('prof-pass-current').value = '';
    el('prof-pass-new').value = '';
    el('prof-pass-confirm').value = '';
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

function viewMobileOrderDetails(orderId) {
  const order = Orders.find(orderId);
  if (!order) return;

  const contentId = currentUser.role === 'admin' ? 'mobile-admin-content' : 'mobile-customer-content';
  set(contentId, `
    <div class="mobile-content">
      <div style="margin-bottom:1rem">
        <button class="btn btn-ghost" onclick="navigate('${currentUser.role === 'admin' ? 'admin-orders' : 'my-orders'}')" style="padding:.5rem;font-size:.9rem">← Back</button>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <div>
            <div style="font-weight:600;font-size:1rem">Order #${order.id.replace('ORD-','')}</div>
            <div style="font-size:.8rem;color:var(--text-muted)">${fmtDate(order.createdAt)}</div>
          </div>
          ${statusBadge(order.status)}
        </div>
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:.75rem">📋 Items</div>
        ${order.items.map(item => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem;border-bottom:1px solid var(--border-light)">
            <div>
              <div style="font-weight:500;font-size:.95rem">${item.name}</div>
              <div style="font-size:.8rem;color:var(--text-muted)">${item.sku}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:600">${item.qty}x</div>
              <div style="font-size:.8rem;color:var(--text-muted)">${fmt(item.price)}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;background:var(--bg);border-radius:8px">
          <span style="font-weight:600">Total:</span>
          <span style="font-size:1.2rem;font-weight:700;color:var(--primary)">${fmt(order.total)}</span>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:600;margin-bottom:.75rem">Customer</div>
        <div style="font-weight:500;margin-bottom:.25rem">${order.customerName}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${order.customer_id}</div>
      </div>

      ${currentUser.role === 'admin' ? `
        <div class="card">
          <div style="font-weight:600;margin-bottom:.75rem">Update Status</div>
          <select class="form-control" onchange="updateOrderStatus('${order.id}',this.value);navigate('admin-orders')">
            ${['pending','processing','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${order.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      ` : ''}
    </div>
  `);
}
