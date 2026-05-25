// ── Storage helpers ──────────────────────────────────────────
const DB = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ── Supabase Client (Client-side) ────────────────────────────
const supabaseUrl = 'https://ejslflftjtirkgnxxirb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqc2xmbGZ0anRpcmtnbnh4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjUyMTEsImV4cCI6MjA5NDk0MTIxMX0.6OinQqQHY9Iqlvfw3I2BlSvFEqntJm6O7Gx2qu9d0Uk';
const sbClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseAnonKey) : null;

async function uploadProductImage(file) {
  try {
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `product-${timestamp}.${ext}`;

    const { data, error } = await sbClient.storage
      .from('product-images')
      .upload(filename, file);

    if (error) throw error;

    const { data: urlData } = sbClient.storage
      .from('product-images')
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Image upload error:', err);
    throw new Error('Failed to upload image: ' + err.message);
  }
}

// ── In-memory caches ──────────────────────────────────────────
let productsCache = [];
let usersCache = [];
let ordersCache = [];
let movementsCache = [];
let suppliersCache = [];

// ── Seed data ────────────────────────────────────────────────
const SEED_PRODUCTS = [
  { sku: 'BEV-001', name: 'Orange Juice', category: 'Beverages', cost_price: 3.99, stock: 150 },
  { sku: 'BEV-002', name: 'Lemonade', category: 'Beverages', cost_price: 2.99, stock: 120 },
  { sku: 'BEV-003', name: 'Iced Tea', category: 'Beverages', cost_price: 2.49, stock: 200 },
  { sku: 'BEV-004', name: 'Coconut Water', category: 'Beverages', cost_price: 4.99, stock: 80 },
  { sku: 'BEER-001', name: 'IPA Craft Beer', category: 'Beers', cost_price: 5.99, stock: 75 },
  { sku: 'BEER-002', name: 'Lager Premium', category: 'Beers', cost_price: 4.99, stock: 120 },
  { sku: 'BEER-003', name: 'Stout Dark', category: 'Beers', cost_price: 6.99, stock: 45 },
  { sku: 'BEER-004', name: 'Pilsner Gold', category: 'Beers', cost_price: 5.49, stock: 200 },
];

const SEED_USERS = [
  { id: 'u0', name: 'Admin User', username: 'admin', email: 'admin@warehouse.com', password: 'admin123', role: 'admin', createdAt: '2025-01-01' },
  { id: 'u1', name: 'Sarah Johnson', username: 'sarah', email: 'sarah@acme.com', password: 'pass123', role: 'customer', createdAt: '2025-02-10' },
];

async function seedIfEmpty() {
  try {
    const existing = await fetch('/api/products').then(r => r.json());
    if (Array.isArray(existing) && existing.length > 0) { productsCache = existing; }
  } catch (e) { console.warn('Could not fetch products:', e.message); }

  // Seed Supabase with initial products if empty
  if (productsCache.length === 0) {
    for (const p of SEED_PRODUCTS) {
      try {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
      } catch (e) { console.warn('Could not seed product:', p.name); }
    }
    try { productsCache = await fetch('/api/products').then(r => r.json()); }
    catch (e) { console.warn('Could not load products'); }
  }

  // Load users from API
  try {
    const users = await fetch('/api/users').then(r => r.json());
    if (Array.isArray(users) && users.length > 0) { usersCache = users; }
  } catch (e) { console.warn('Could not fetch users:', e.message); }

  // Seed Supabase with initial users if empty
  if (usersCache.length === 0) {
    for (const u of SEED_USERS) {
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u)
        });
      } catch (e) { console.warn('Could not seed user:', u.name); }
    }
    try { usersCache = await fetch('/api/users').then(r => r.json()); }
    catch (e) { console.warn('Could not load users'); }
  }

  // Load orders from API
  try {
    const orders = await fetch('/api/orders').then(r => r.json());
    if (Array.isArray(orders)) { ordersCache = orders; }
  } catch (e) { console.warn('Could not fetch orders:', e.message); }

  // Load movements from API
  try {
    const movements = await fetch('/api/movements').then(r => r.json());
    if (Array.isArray(movements)) { movementsCache = movements; }
  } catch (e) { console.warn('Could not fetch movements:', e.message); }

  // Load suppliers from API
  try {
    const suppliers = await fetch('/api/suppliers').then(r => r.json());
    if (Array.isArray(suppliers)) { suppliersCache = suppliers; }
  } catch (e) { console.warn('Could not fetch suppliers:', e.message); }

  // Mark as seeded
  if (!DB.get('wm_seeded')) {
    DB.set('wm_seeded', true);
  }
}

// ── Supplier API ─────────────────────────────────────────────
const Suppliers = {
  all: () => suppliersCache,
  find: (id) => suppliersCache.find(s => s.id === id),

  create: async (name, contact, notes) => {
    if (suppliersCache.find(s => s.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Supplier name already exists.' };
    }
    const supplier = { id: 's' + Date.now(), name, contact, notes };
    try {
      const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supplier) });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      suppliersCache.push(created);
      return { supplier: created };
    } catch (err) {
      return { error: err.message };
    }
  },

  update: async (id, data) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      const idx = suppliersCache.findIndex(s => s.id === id);
      if (idx >= 0) suppliersCache[idx] = updated;
      return updated;
    } catch (err) {
      throw err;
    }
  },

  delete: async (id) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      suppliersCache = suppliersCache.filter(s => s.id !== id);
    } catch (err) {
      throw err;
    }
  },
};

// ── User API ─────────────────────────────────────────────────
const Users = {
  all: () => usersCache,
  find: (id) => usersCache.find(u => u.id === id),
  findByEmail: (email) => usersCache.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findByUsername: (username) => usersCache.find(u => u.username.toLowerCase() === username.toLowerCase()),

  create: async (name, username, email, password, role) => {
    const users = Users.all();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return { error: 'Username already taken.' };
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return { error: 'Email already registered.' };

    const user = { id: 'u' + Date.now(), name, username, email, password, role };
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      usersCache.push(created);
      return { user: created };
    } catch (err) {
      return { error: err.message };
    }
  },

  update: async (id, data) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      const idx = usersCache.findIndex(u => u.id === id);
      if (idx >= 0) usersCache[idx] = updated;
      return updated;
    } catch (err) {
      throw err;
    }
  },

  delete: async (id) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      usersCache = usersCache.filter(u => u.id !== id);
    } catch (err) {
      throw err;
    }
  },

  login: (username, password) => {
    const user = Users.findByUsername(username);
    if (!user) return { error: 'Username not found.' };
    if (user.password !== password) return { error: 'Incorrect password.' };
    return { user };
  },
};

// ── Product API (Supabase via Express) ───────────────────────
const Products = {
  all: () => productsCache,
  find: (sku) => productsCache.find(p => p.sku === sku),

  create: async (data) => {
    const prod = { ...data, stock: Number(data.stock), cost_price: Number(data.cost_price), min_stock: 10 };
    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prod) });
    if (!res.ok) throw new Error(await res.text());
    const created = await res.json();
    productsCache.push(created);
    addMovement(created.sku, created.name, 'in', created.stock, 'Initial stock');
    return created;
  },

  update: async (sku, data) => {
    const updateData = { ...data, min_stock: 10 };
    const res = await fetch(`/api/products/${sku}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
    if (!res.ok) throw new Error(await res.text());
    const updated = await res.json();
    const idx = productsCache.findIndex(p => p.sku === sku);
    if (idx >= 0) productsCache[idx] = updated;
    return updated;
  },

  delete: async (sku) => {
    const res = await fetch(`/api/products/${sku}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    productsCache = productsCache.filter(p => p.sku !== sku);
  },

  adjustStock: async (sku, qty, reason, costPrice = null) => {
    const p = productsCache.find(x => x.sku === sku);
    if (!p) return;
    const newStock = Math.max(0, p.stock + qty);
    const updateData = { ...p, stock: newStock };
    if (costPrice !== null && costPrice !== '') {
      updateData.cost_price = Number(costPrice);
    }
    const res = await fetch(`/api/products/${sku}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) });
    if (!res.ok) throw new Error(await res.text());
    const updated = await res.json();
    const idx = productsCache.findIndex(x => x.sku === sku);
    if (idx >= 0) productsCache[idx] = updated;
    addMovement(sku, p.name, qty > 0 ? 'in' : 'out', Math.abs(qty), reason);
    return updated;
  },

  lowStock: () => productsCache.filter(p => p.stock <= 10),
};

// ── Stock Movement API ────────────────────────────────────────
async function addMovement(productId, productName, type, qty, reason) {
  const movement = { id: 'm' + Date.now(), product_id: productId, product_name: productName, type, qty, reason };
  try {
    const res = await fetch('/api/movements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movement) });
    if (!res.ok) throw new Error(await res.text());
    const created = await res.json();
    movementsCache.unshift(created);
  } catch (e) { console.warn('Could not add movement:', e.message); }
}

const Movements = {
  all: () => movementsCache,
};

// ── Order API ─────────────────────────────────────────────────
const Orders = {
  all: () => ordersCache,
  byCustomer: (customerId) => ordersCache.filter(o => o.customer_id === customerId),
  find: (id) => ordersCache.find(o => o.id === id),

  create: async (customerId, customerName, items) => {
    const total = items.reduce((s, i) => s + (i.price || i.cost_price || 0) * i.qty, 0);
    const order = {
      id: 'ORD-' + Date.now(),
      customer_id: customerId,
      customer_name: customerName,
      items,
      total,
      status: 'pending'
    };

    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order) });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      ordersCache.unshift(created);
      // Stock is NOT deducted until order is delivered
      return created;
    } catch (err) {
      throw err;
    }
  },

  updateStatus: async (id, status) => {
    try {
      const order = ordersCache.find(o => o.id === id);
      const oldStatus = order?.status;

      const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      const idx = ordersCache.findIndex(o => o.id === id);
      if (idx >= 0) ordersCache[idx] = updated;

      // Deduct stock only when order is delivered
      if (status === 'delivered' && oldStatus !== 'delivered') {
        for (const item of order.items) {
          await Products.adjustStock(item.sku, -item.qty, `Order ${order.id} delivered`);
        }
      }

      // Restore stock if order is cancelled
      if (status === 'cancelled' && oldStatus === 'delivered') {
        for (const item of order.items) {
          await Products.adjustStock(item.sku, item.qty, `Order ${order.id} cancelled`);
        }
      }

      return updated;
    } catch (err) {
      throw err;
    }
  },
};

// ── Session ───────────────────────────────────────────────────
const Session = {
  get: () => DB.get('wm_session'),
  set: (user) => DB.set('wm_session', { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, password: user.password }),
  clear: () => localStorage.removeItem('wm_session'),
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) { return '$' + Number(n).toFixed(2); }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtDateTime(iso) { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function statusBadge(s) {
  const map = { pending: 'badge-warning', processing: 'badge-info', shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger' };
  return `<span class="badge ${map[s] || 'badge-muted'}">${s}</span>`;
}
function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
function stockBadge(p) {
  if (p.stock === 0) return `<span class="badge badge-danger">Out of Stock</span>`;
  if (p.stock <= p.minStock) return `<span class="badge badge-warning">Low Stock</span>`;
  return `<span class="badge badge-success">In Stock</span>`;
}
function categoryEmoji(cat) {
  const map = { Beverages: '🥤', Beers: '🍺' };
  return map[cat] || '🍹';
}
