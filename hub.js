const $ = selector => document.querySelector(selector);
const key = 'bp-studio';
const blank = () => ({ flowers: [], clients: [], jobs: [] });
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return { flowers: Array.isArray(saved?.flowers) ? saved.flowers : [], clients: Array.isArray(saved?.clients) ? saved.clients : [], jobs: Array.isArray(saved?.jobs) ? saved.jobs : [] };
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return blank();
  }
}
const data = load();
const money = value => `£${Number(value || 0).toFixed(2)}`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function notice(message, bad = false) {
  let el = $('#studio-notice');
  if (!el) { el = document.createElement('div'); el.id = 'studio-notice'; el.className = 'studio-notice'; document.body.appendChild(el); }
  el.textContent = message; el.classList.toggle('bad', bad); el.classList.add('show');
  clearTimeout(notice.timer); notice.timer = setTimeout(() => el.classList.remove('show'), 3500);
}
function save() {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch { notice('Your browser could not save this change. Please allow site storage and try again.', true); return false; }
}
function metrics() {
  const stock = data.flowers.reduce((total, flower) => total + Number(flower.qty || 0) * Number(flower.cost || 0), 0);
  const jobsTotal = data.jobs.reduce((total, job) => total + Number(job.total || 0), 0);
  $('.metric-grid').innerHTML = `<article><span class="icon">✾</span><small>INVENTORY VALUE<br>(EX VAT)</small><b>${money(stock)}</b><i>⌁</i></article><article><span class="icon">✾</span><small>INVENTORY VALUE<br>(INC VAT)</small><b>${money(stock * 1.2)}</b><i>⌁</i></article><article><span class="icon">♧</span><small>JOBS WON</small><b>${data.jobs.length}</b><i>⌁</i></article><article><span class="icon">❋</span><small>TOTAL REVENUE</small><b>${money(jobsTotal)}</b><i>⌁</i></article>`;
  $('.dashboard-grid').innerHTML = `<article><h2>Low &amp; out of stock</h2><div class="empty-row">${data.flowers.filter(f => Number(f.qty) < 10).map(f => `${esc(f.name)} — ${Number(f.qty)} left`).join('<br>') || 'Nothing low at the moment.'}</div></article><article><h2>Upcoming events</h2><div class="empty-row">${data.clients.slice(0, 3).map(c => `${esc(c.name)} — ${esc(c.type)}${c.date ? ` · ${esc(c.date)}` : ''}`).join('<br>') || 'No events added yet.'}</div></article>`;
}
function inventory() {
  $('#inventory').innerHTML = `<p class="eyebrow">FLOWER INVENTORY</p><h1>What’s in the studio</h1><div class="tool-grid"><form data-form="flower" class="tool-card"><h2>Add flowers</h2><label>Flower name<input name="name" required placeholder="e.g. White rose"></label><label>Stems purchased<input name="qty" type="number" min="1" required></label><label>Cost per stem (£)<input name="cost" type="number" min="0" step="0.01" required></label><button class="primary">Add to inventory</button></form><div class="tool-card"><h2>Current stock</h2><div class="records">${data.flowers.map((flower, index) => `<div><b>${esc(flower.name)}</b><span>${Number(flower.qty)} stems · ${money(flower.cost)}/stem</span><button class="small" type="button" data-remove-flower="${index}">Remove</button></div>`).join('') || '<p>No flowers added yet.</p>'}</div></div></div>`;
}
function pricing() {
  const options = data.flowers.map((flower, index) => `<option value="${index}">${esc(flower.name)} — ${Number(flower.qty)} stems available</option>`).join('');
  $('#pricing').innerHTML = `<p class="eyebrow">PRICING CALCULATOR</p><h1>Build a bouquet or job</h1><div class="tool-grid"><form data-form="pricing" class="tool-card"><label>Customer name<input name="customer" required></label><label>Job type<select name="type"><option>Bouquet</option><option>Wedding</option><option>Funeral</option><option>Corporate</option></select></label><label>Flower<select name="flower" required><option value="">Choose flower</option>${options}</select></label><label>Stems used<input name="stems" type="number" min="1" required></label><label>Markup %<input name="markup" type="number" value="100" min="0"></label><button class="primary">Save job &amp; deduct stock</button></form><div class="tool-card"><h2>How it works</h2><p>Choose stock, set your markup and save. The finished total is stored in Jobs Won, and stems are deducted automatically.</p></div></div>`;
}
function jobs() {
  $('#jobs').innerHTML = `<p class="eyebrow">JOBS WON</p><h1>Your completed work</h1><div class="records wide">${data.jobs.map(job => `<div><b>${esc(job.customer)} — ${esc(job.type)}</b><span>${esc(job.flower)} × ${Number(job.stems)} · ${esc(job.date)}</span><strong>${money(job.total)}</strong></div>`).join('') || '<p>No completed jobs yet.</p>'}</div>`;
}
function clients() {
  $('#customers').innerHTML = `<p class="eyebrow">CUSTOMER DATABASE</p><h1>Wedding &amp; event planner</h1><div class="tool-grid"><form data-form="client" class="tool-card"><label>Client name<input name="name" required></label><label>Planning type<select name="type"><option>Wedding</option><option>Funeral</option><option>Corporate</option></select></label><label>Event date<input name="date" type="date"></label><label>Notes<textarea name="notes" placeholder="Flowers, colours, venue, personal details…"></textarea></label><button class="primary">Save client plan</button></form><div class="tool-card"><h2>Saved clients</h2><div class="records">${data.clients.map(c => `<div><b>${esc(c.name)}</b><span>${esc(c.type)}${c.date ? ` · ${esc(c.date)}` : ''}</span><em>${esc(c.notes)}</em></div>`).join('') || '<p>No clients added yet.</p>'}</div></div></div>`;
}
function clientPlan(kind) {
  const panel = $('#' + kind); const label = kind[0].toUpperCase() + kind.slice(1);
  panel.innerHTML = `<p class="eyebrow">${label.toUpperCase()} PLANNING</p><h1>${label} flower plan</h1><div class="tool-grid"><form data-form="client-safe" data-kind="${kind}" class="tool-card"><label>Client name<input name="name" required></label><label>What matters most?<textarea name="notes" placeholder="Favourite flowers, colours, style, venue, any must-haves…" required></textarea></label><label>Finished estimate (£)<input name="estimate" type="number" step="0.01" min="0" placeholder="Only a finished price is shown"></label><button class="primary">Save our ideas</button></form><div class="tool-card"><h2>A client-safe space</h2><p>No cost per stem, stock value, VAT or markup is visible in this planning area.</p></div></div>`;
}
function showBusinessPanel(name) {
  $('#business .panel').forEach(panel => panel.hidden = true); $('#' + name).hidden = false;
  $('#business [data-panel]').forEach(button => button.classList.toggle('active', button.dataset.panel === name));
  ({ overview: metrics, inventory, pricing, jobs, customers: clients }[name] || (() => {}))();
}
function showClientPanel(name) {
  $('#client .client-panel').forEach(panel => panel.hidden = true); $('#' + name).hidden = false;
  $('#client [data-client-panel]').forEach(button => button.classList.toggle('active', button.dataset.clientPanel === name));
  if (['wedding', 'funeral', 'corporate'].includes(name)) clientPlan(name);
  if (name === 'ideas') { $('#ideas').innerHTML = `<p class="eyebrow">SAVED IDEAS</p><h1>Your floral ideas</h1><div class="records wide">${data.clients.map(c => `<div><b>${esc(c.name)} — ${esc(c.type)}</b><span>${esc(c.notes)}</span>${c.estimate ? `<strong>${money(c.estimate)}</strong>` : ''}</div>`).join('') || '<p>No ideas saved yet.</p>'}</div>`; }
}
function showArea(name) {
  $('#welcome').hidden = true; $('#business').hidden = name !== 'business'; $('#client').hidden = name !== 'client';
  if (name === 'business') showBusinessPanel('overview'); else showClientPanel('start');
}
document.addEventListener('click', event => {
  const area = event.target.closest('[data-area]'); if (area) return showArea(area.dataset.area);
  if (event.target.closest('[data-home]')) { $('#welcome').hidden = false; $('#business').hidden = true; $('#client').hidden = true; return; }
  const businessPanel = event.target.closest('[data-panel]'); if (businessPanel) return showBusinessPanel(businessPanel.dataset.panel);
  const clientPanel = event.target.closest('[data-client-panel]'); if (clientPanel) return showClientPanel(clientPanel.dataset.clientPanel);
  const remove = event.target.closest('[data-remove-flower]'); if (remove) { data.flowers.splice(Number(remove.dataset.removeFlower), 1); if (save()) { inventory(); pricing(); metrics(); notice('Flower removed from inventory.'); } }
});
document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]'); if (!form) return; event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'flower') { data.flowers.push({ name: values.name, qty: Number(values.qty), cost: Number(values.cost) }); if (save()) { inventory(); pricing(); metrics(); notice('Flower added to inventory.'); } }
  if (form.dataset.form === 'pricing') {
    const flower = data.flowers[Number(values.flower)], stems = Number(values.stems);
    if (!flower || stems < 1 || stems > Number(flower.qty)) return notice('Choose a flower with enough stems available.', true);
    const total = Math.round(Number(flower.cost) * stems * (1 + Number(values.markup || 0) / 100) * 1.2 * 100) / 100;
    flower.qty = Number(flower.qty) - stems; data.jobs.unshift({ customer: values.customer, type: values.type, total, flower: flower.name, stems, date: new Date().toLocaleDateString('en-GB') });
    if (save()) { pricing(); jobs(); metrics(); notice(`Job saved — ${money(total)}.`); }
  }
  if (form.dataset.form === 'client') { data.clients.unshift({ name: values.name, type: values.type, date: values.date, notes: values.notes }); if (save()) { clients(); metrics(); notice('Client plan saved.'); } }
  if (form.dataset.form === 'client-safe') { data.clients.unshift({ name: values.name, type: form.dataset.kind[0].toUpperCase() + form.dataset.kind.slice(1), notes: values.notes, estimate: values.estimate }); if (save()) notice('Ideas saved for the studio team.'); }
});

