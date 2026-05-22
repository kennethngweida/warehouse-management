require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase client ──────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Middleware ───────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────

// GET all products
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sku', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product
app.get('/api/products/:sku', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('sku', req.params.sku)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Product not found' });
  }
});

// POST create product
app.post('/api/products', async (req, res) => {
  try {
    const { sku, name, category, price, stock, min_stock } = req.body;
    const { data, error } = await supabase
      .from('products')
      .insert([{
        sku,
        name,
        category,
        price: parseFloat(price),
        stock: parseInt(stock),
        min_stock: parseInt(min_stock) || 10
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update product
app.put('/api/products/:sku', async (req, res) => {
  try {
    const { name, category, price, stock, min_stock } = req.body;
    const { data, error } = await supabase
      .from('products')
      .update({
        name,
        category,
        price: parseFloat(price),
        stock: parseInt(stock),
        min_stock: parseInt(min_stock) || 10
      })
      .eq('sku', req.params.sku)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE product
app.delete('/api/products/:sku', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('sku', req.params.sku);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── User API Routes ──────────────────────────────────────

// GET all users
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single user by id
app.get('/api/users/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'User not found' });
  }
});

// POST create user
app.post('/api/users', async (req, res) => {
  try {
    const { id, name, username, email, password, role } = req.body;
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: id || 'u' + Date.now(),
        name,
        username,
        email,
        password,
        role: role || 'customer'
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const updateData = { name, email, role };
    if (password) updateData.password = password;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Order API Routes ─────────────────────────────────────

// GET all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Order not found' });
  }
});

// POST create order
app.post('/api/orders', async (req, res) => {
  try {
    const { id, customer_id, customer_name, items, total, status } = req.body;
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        id,
        customer_id,
        customer_name,
        items,
        total: parseFloat(total),
        status: status || 'pending'
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update order status
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Stock Movement API Routes ───────────────────────────

// GET all movements
app.get('/api/movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movements')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create movement
app.post('/api/movements', async (req, res) => {
  try {
    const { id, product_id, product_name, type, qty, reason } = req.body;
    const { data, error } = await supabase
      .from('movements')
      .insert([{
        id,
        product_id,
        product_name,
        type,
        qty: parseInt(qty),
        reason
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── SPA fallback ─────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Warehouse Management running at http://localhost:${PORT}`);
});
