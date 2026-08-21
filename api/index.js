const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool, types } = require('pg');
types.setTypeParser(types.builtins.DATE, value => value);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
const id = () => crypto.randomBytes(10).toString('base64url');
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
function user(req) { try { return jwt.verify((req.headers.cookie || '').match(/studio_token=([^;]+)/)?.[1] || '', process.env.AUTH_SECRET); } catch { return null; } }
function send(res, status, data) { res.status(status).json(data); }
module.exports = async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace('/api', '') || '/';
  if (path === '/auth/login' && req.method === 'POST') {
    const { email, password } = body(req);
    if (email !== process.env.STUDIO_EMAIL || password !== process.env.STUDIO_PASSWORD) return send(res, 401, { error: 'Incorrect email or password.' });
    res.setHeader('Set-Cookie', cookie('studio_token', jwt.sign({ email }, process.env.AUTH_SECRET, { expiresIn: '8h' }), 28800));
    return send(res, 200, { ok: true });
  }
  if (path === '/auth/logout') { res.setHeader('Set-Cookie', cookie('studio_token', '', 0)); return send(res, 200, { ok: true }); }
  if (!user(req)) return send(res, 401, { error: 'Please log in to access the Studio Hub.' });
  if (path === '/dashboard') {
    const { rows } = await pool.query(`select (select count(*) from clients where status = 'Confirmed')::int as confirmed_clients, (select count(*) from flowers where stems_remaining <= 0)::int as out_of_stock, (select coalesce(sum(total),0) from purchases where date_trunc('month',created_at)=date_trunc('month',now())) as month_sales`);
    return send(res, 200, rows[0]);
  }
  if (path === '/flowers' && req.method === 'GET') {
    const [flowers, settings] = await Promise.all([pool.query('select *, stems_remaining * cost_per_stem as value_ex_vat from flowers order by name'), pool.query("select value from settings where key='vat_pct' ")]);
    const total = flowers.rows.reduce((sum, flower) => sum + Number(flower.value_ex_vat), 0), vat = Number(settings.rows[0]?.value || 20);
    return send(res, 200, { flowers: flowers.rows.map(f => ({ ...f, cost_per_stem:Number(f.cost_per_stem), value_ex_vat:Number(f.value_ex_vat) })), summary:{total_ex_vat:money(total),vat_pct:vat,vat_amount:money(total*vat/100),total_inc_vat:money(total*(1+vat/100))} });
  }
  if (path === '/clients' && req.method === 'GET') { const q = await pool.query("select * from clients order by event_date asc nulls last, created_at desc"); return send(res,200,q.rows); }
  if (path === '/clients' && req.method === 'POST') { const b=body(req), q=await pool.query('insert into clients (id,name,event_type,event_date,contact,venue,budget,status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *',[id(),b.name,b.event_type||'Wedding',b.event_date||null,b.contact||null,b.venue||null,b.budget||null,b.status||'Enquiry']); return send(res,201,q.rows[0]); }
  if (path === '/materials' && req.method === 'GET') { const q=await pool.query('select * from materials order by name'); return send(res,200,q.rows.map(x=>({...x,cost:Number(x.cost)}))); }
  return send(res,404,{error:'Not found'});
};

