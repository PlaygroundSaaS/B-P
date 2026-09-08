import { calculateTotals, round2 } from './pricing';
import { clientNameKey, validateQuote } from './studio-operations';
import { emptyOperations } from './operations-types';
import type { StudioCommand, CommandResult, InventoryTransaction, EventQuote, ProductionStatus } from './operations-types';
import type { StudioData, Quote, Job } from './types';

export const productionStatuses: ProductionStatus[] = ['Not started', 'Prepped', 'In production', 'Completed', 'Packed', 'Delivered'];
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e9;
const positive = (n: unknown) => finite(n) && n > 0;
const integer = (n: unknown) => positive(n) && Number.isInteger(n);
function requireThat(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function recipeRequirements(recipe: Quote) {
  const needs = new Map<string, { inventoryId: string; name: string; quantity: number; unitCost: number }>();
  for (const line of recipe.lines) {
    if (!line.inventoryId) continue;
    const old = needs.get(line.inventoryId);
    needs.set(line.inventoryId, { inventoryId: line.inventoryId, name: line.name, quantity: round2((old?.quantity || 0) + line.quantity * (recipe.quantity ?? 1)), unitCost: line.unitCost });
  }
  return [...needs.values()];
}
export function recipeAvailability(data: StudioData, recipe: Quote) {
  return recipeRequirements(recipe).map(need => {
    const stock = data.inventory.find(row => row.id === need.inventoryId);
    const committed = (recipe.commitments || []).find(row => row.inventoryId === need.inventoryId)?.quantity || 0;
    const available = stock?.stemsRemaining || 0;
    return { ...need, available, committed, shortage: round2(Math.max(0, need.quantity - committed - available)), supplier: stock?.supplier || 'Unassigned supplier', missing: !stock };
  });
}
export function stockSummary(data: StudioData, inventoryId: string) {
  const available = data.inventory.find(row => row.id === inventoryId)?.stemsRemaining || 0;
  const reserved = data.jobs.filter(job => !job.stockReturned && !job.consumedAt).reduce((sum, job) => sum + (job.commitments || []).filter(row => row.inventoryId === inventoryId).reduce((n, row) => n + row.quantity, 0), 0);
  return { available, reserved, onHand: round2(available + reserved) };
}
export function recipeRevision(recipe: Quote) {
  return JSON.stringify([recipe.id, recipe.name, recipe.quantity || 1, recipe.lines, recipe.labourHours, recipe.labourRate, recipe.wastagePercent, recipe.markupPercent, recipe.deliveryFee, recipe.discount, recipe.vatApplies, recipe.vatRate, recipe.sellingPriceExVat, recipe.deliveryCost, recipe.setupCost, recipe.collectionCost, recipe.supplierCharges, recipe.additionalExpenses]);
}
export function eventQuoteTotals(recipes: Quote[], quote: Pick<EventQuote, 'setup' | 'delivery' | 'discount' | 'vatRate' | 'vatApplies' | 'hire'>) {
  const totals = recipes.map(calculateTotals);
  const extras = round2(quote.setup + quote.delivery + (quote.hire || 0));
  const baseNet = round2(totals.reduce((s, t) => s + t.netTotal, 0) + extras);
  const net = round2(baseNet - quote.discount);
  const baseVat = totals.reduce((s, t) => s + t.vat, 0) + (quote.vatApplies ? extras * quote.vatRate / 100 : 0);
  // A whole-event discount is apportioned across its taxable and untaxed lines.
  const vat = round2(baseNet > 0 ? baseVat * Math.max(0, net) / baseNet : 0);
  return { total: round2(net + vat), vat, net };
}
export function paidFor(data: StudioData, orderId: string) {
  return round2((data.operations?.payments || []).filter(p => p.orderId === orderId).reduce((s, p) => s + p.amount * (p.kind === 'Refund' ? -1 : 1), 0));
}

/** All recipe purchase, reservation and financial transitions run here on the server. */
export function applyStudioCommand(source: StudioData, command: StudioCommand, now = new Date().toISOString()): CommandResult {
  const data = structuredClone(source);
  data.operations = { ...emptyOperations(), ...data.operations };
  const ops = data.operations;
  const transactions: InventoryTransaction[] = [];
  let recordIds: string[] = [];
  let action: string = command.type;
  const jobFor = (id: string) => { const job = data.jobs.find(row => row.id === id); requireThat(job, 'This purchased recipe could not be found.'); return job; };
  const addClient = (recipe: Quote) => {
    if (!recipe.clientName.trim()) return;
    let customer = data.customers.find(row => row.id === recipe.customerId) || data.customers.find(row => clientNameKey(row.name) === clientNameKey(recipe.clientName));
    if (!customer) { customer = { id: `client-${recipe.id}`, name: recipe.clientName.trim(), contact: recipe.contact || '', notes: '', createdAt: now }; data.customers.unshift(customer); }
    recipe.customerId = customer.id;
  };
  const checkRecipe = (recipe: Quote, draft = false) => {
    requireThat(recipe && typeof recipe.id === 'string' && typeof recipe.clientName === 'string' && Array.isArray(recipe.lines), 'The recipe is incomplete.');
    requireThat(integer(recipe.quantity ?? 1), 'Recipe quantity must be a whole number above zero.');
    if (!draft) { const error = validateQuote(recipe); requireThat(!error, error || 'Check the recipe.'); }
    else requireThat(recipe.lines.every(line => typeof line.name === 'string' && finite(line.quantity) && finite(line.unitCost)), 'Check each draft line.');
    requireThat([recipe.labourHours, recipe.labourRate, recipe.wastagePercent, recipe.markupPercent, recipe.deliveryFee, recipe.discount, recipe.vatRate].every(finite), 'Pricing values must be valid positive amounts or zero.');
    requireThat([recipe.sellingPriceExVat, recipe.deliveryCost, recipe.setupCost, recipe.collectionCost, recipe.supplierCharges, recipe.additionalExpenses].every(v => v === undefined || finite(v)), 'Costs and selling price must be valid non-negative numbers.');
    requireThat(recipe.vatRate <= 100 && (recipe.corporationTaxRate === undefined || finite(recipe.corporationTaxRate) && recipe.corporationTaxRate <= 100), 'Tax rates must be between 0 and 100%.');
    if (recipe.planId) requireThat(data.plans.some(p => p.id === recipe.planId && clientNameKey(p.clientName) === clientNameKey(recipe.clientName)), 'Choose the matching client event.');
  };
  const commit = (recipe: Job, allowShortages: boolean) => {
    requireThat(recipe.lines.every(line => line.category !== 'stem' || line.inventoryId), 'Link each flower to an inventory item before purchase. Add a zero-stock item for flowers you still need to order.');
    for (const need of recipeRequirements(recipe)) {
      const stock = data.inventory.find(row => row.id === need.inventoryId);
      requireThat(stock, `${need.name} is no longer in inventory. Choose a replacement first.`);
      const previous = recipe.commitments?.find(c => c.inventoryId === need.inventoryId)?.quantity || 0;
      const outstanding = round2(Math.max(0, need.quantity - previous));
      requireThat(allowShortages || stock.stemsRemaining >= outstanding, `${need.name}: ${outstanding} required, ${stock.stemsRemaining} available. Review the shortage before purchase.`);
      const quantity = Math.min(stock.stemsRemaining, outstanding);
      if (quantity) {
        stock.stemsRemaining = round2(stock.stemsRemaining - quantity);
        transactions.push({ ...need, quantity: -quantity, kind: recipe.consumedAt ? 'Consume' : 'Commit', recordId: recipe.id });
      }
      recipe.commitments = [...(recipe.commitments || []).filter(c => c.inventoryId !== need.inventoryId), { inventoryId: need.inventoryId, quantity: previous + quantity }];
    }
  };
  const purchase = (id: string, allowShortages: boolean) => {
    const existing = data.jobs.find(row => row.id === id);
    if (existing) { requireThat(!existing.stockReturned, 'This order was returned or cancelled. Duplicate the recipe to create a new order.'); return existing; }
    const recipe = data.quotes.find(row => row.id === id);
    requireThat(recipe, 'Save this recipe before marking it as purchased.');
    requireThat(!recipe.isTemplate, 'Use this template to create a client recipe before purchase.');
    checkRecipe(recipe);
    const job: Job = { ...recipe, status: 'PURCHASED', wonAt: now, updatedAt: now, totals: calculateTotals(recipe), stockReturned: false, productionStatus: 'Not started', commitments: [] };
    commit(job, allowShortages); addClient(job);
    data.jobs.unshift(job); data.quotes = data.quotes.filter(q => q.id !== id);
    if (job.planId) { const plan = data.plans.find(p => p.id === job.planId); if (plan) plan.status = 'Booked'; }
    ops.leads.filter(l => l.planId && l.planId === job.planId).forEach(l => { l.status = 'Won'; });
    return job;
  };
  switch (command.type) {
    case 'saveRecipe': {
      const recipe = structuredClone(command.recipe);
      checkRecipe(recipe, command.status === 'DRAFT');
      requireThat(['DRAFT', 'QUOTE'].includes(command.status), 'Choose Draft or Quote.');
      requireThat(!data.jobs.some(j => j.id === recipe.id), 'Use Amend purchased recipe to change this order with an audit note.');
      recipe.status = command.status; recipe.updatedAt = now; recipe.clientName = recipe.clientName.trim();
      delete recipe.commitments; delete recipe.consumedAt; delete recipe.cancelledAt;
      addClient(recipe); data.quotes = [recipe, ...data.quotes.filter(q => q.id !== recipe.id)];
      if (recipe.planId) {
        const plan = data.plans.find(p => p.id === recipe.planId)!;
        plan.inspiration?.forEach(i => { if (i.id === recipe.inspirationId) i.recipeId = recipe.id; });
        plan.requirements?.forEach(i => { if (i.id === recipe.inspirationId) i.recipeId = recipe.id; });
      }
      recordIds = [recipe.id, recipe.customerId || '', recipe.planId || '']; action = `Recipe saved as ${command.status.toLowerCase()}`; break;
    }
    case 'purchaseRecipe': {
      requireThat(!ops.eventQuotes.some(q => q.recipeIds.includes(command.recipeId)), 'This recipe is on an event quotation. Confirm purchase from that quotation so the whole event stays together.');
      const job = purchase(command.recipeId, command.allowShortages === true);
      recordIds = [job.id, job.customerId || '', job.planId || '']; action = 'Recipe marked as Purchased'; break;
    }
    case 'amendRecipe': {
      const original = jobFor(command.recipe.id);
      requireThat(!original.stockReturned, 'Returned orders cannot be amended. Duplicate the recipe for new work.');
      requireThat(typeof command.reason === 'string' && command.reason.trim().length >= 3, 'Add a reason for this post-purchase change.');
      checkRecipe(command.recipe);
      requireThat(command.recipe.planId === original.planId && command.recipe.customerId === original.customerId, 'Keep the original client and event when amending purchased work.');
      const next = { ...original, ...command.recipe, status: 'PURCHASED' as const, wonAt: original.wonAt, stockReturned: false, productionStatus: original.productionStatus, assignedTo: original.assignedTo, productionDue: original.productionDue, consumedAt: original.consumedAt, commitments: original.commitments || recipeRequirements(original).map(n => ({ inventoryId: n.inventoryId, quantity: n.quantity })) };
      for (const old of next.commitments || []) {
        const wanted = recipeRequirements(next).find(n => n.inventoryId === old.inventoryId)?.quantity || 0;
        const release = round2(Math.max(0, old.quantity - wanted));
        if (release) {
          requireThat(!original.consumedAt && (!original.productionStatus || ['Not started', 'Prepped'].includes(original.productionStatus)), 'These stems may already be used. Record actual waste/returns separately before reducing a recipe in production.');
          const stock = data.inventory.find(i => i.id === old.inventoryId);
          requireThat(stock, 'Restore the missing stock item before releasing its commitment.');
          stock.stemsRemaining = round2(stock.stemsRemaining + release); old.quantity -= release;
          transactions.push({ inventoryId: stock.id, name: stock.name, unitCost: stock.costPerStem, quantity: release, kind: 'Release', recordId: next.id });
        }
      }
      commit(next, command.allowShortages === true); next.totals = calculateTotals(next); next.updatedAt = now;
      requireThat(ops.eventQuotes.some(q => q.status === 'PURCHASED' && q.recipeIds.includes(next.id)) || paidFor(data, next.id) <= next.totals.grossTotal + .001, 'Record the refund before reducing this order below payments already received.');
      data.jobs = data.jobs.map(j => j.id === next.id ? next : j);
      // Combined quotations retain the accepted customer price; amendments are recorded separately.
      recordIds = [next.id, next.planId || '', next.customerId || '']; action = `Purchased recipe amended: ${command.reason.trim()}`; break;
    }
    case 'returnRecipe': {
      const job = jobFor(command.recipeId);
      if (job.stockReturned) break;
      requireThat(!ops.eventQuotes.some(q => q.status === 'PURCHASED' && q.recipeIds.includes(job.id)), 'This recipe belongs to an accepted event quotation. Keep its financial history and use an amendment for changes.');
      requireThat(typeof command.reason === 'string' && command.reason.trim(), 'Add a reason for returning or cancelling the order.');
      requireThat(paidFor(data, job.id) === 0, 'Record any customer refund before cancelling this paid order.');
      requireThat(!job.consumedAt && (!job.productionStatus || ['Not started', 'Prepped'].includes(job.productionStatus)), 'This work has entered production. Record actual leftovers as a stock adjustment, rather than returning every stem.');
      for (const need of job.commitments || recipeRequirements(job)) {
        const stock = data.inventory.find(i => i.id === need.inventoryId);
        requireThat(stock, 'Restore the missing stock item before returning this order.');
        stock.stemsRemaining = round2(stock.stemsRemaining + need.quantity);
        transactions.push({ inventoryId: stock.id, name: stock.name, unitCost: stock.costPerStem, quantity: need.quantity, kind: 'Release', recordId: job.id });
      }
      job.stockReturned = true; job.cancelledAt = now; job.updatedAt = now;
      recordIds = [job.id, job.planId || '', job.customerId || '']; action = `Order cancelled / unused stock returned: ${command.reason}`; break;
    }
    case 'production': {
      const job = jobFor(command.recipeId);
      requireThat(!job.stockReturned && productionStatuses.includes(command.status), 'Choose a production status for active purchased work.');
      if (job.commitments === undefined) job.commitments = recipeRequirements(job).map(n => ({ inventoryId: n.inventoryId, quantity: n.quantity })); // Legacy purchases already deducted stock.
      if (['Completed', 'Packed', 'Delivered'].includes(command.status) && !job.consumedAt) {
        commit(job, false);
        for (const need of recipeRequirements(job)) transactions.push({ ...need, quantity: need.quantity, kind: 'Consume', recordId: job.id });
        job.consumedAt = now;
      }
      requireThat(!job.consumedAt || ['Completed', 'Packed', 'Delivered'].includes(command.status), 'Stock has already been consumed. Keep Completed, Packed or Delivered; use an amendment for corrections.');
      job.productionStatus = command.status; job.assignedTo = command.assignedTo; job.productionDue = command.due; job.updatedAt = now;
      recordIds = [job.id, job.planId || '']; action = `Production: ${command.status}`; break;
    }
    case 'saveEventQuote': {
      const quote = structuredClone(command.quote);
      requireThat(quote && typeof quote.id === 'string' && Array.isArray(quote.recipeIds) && quote.recipeIds.length > 0 && new Set(quote.recipeIds).size === quote.recipeIds.length, 'Choose at least one recipe, without duplicates.');
      requireThat(!ops.eventQuotes.some(q => q.id === quote.id && q.status === 'PURCHASED'), 'This accepted quotation is preserved. Amend its purchased recipes with a reason.');
      const plan = data.plans.find(p => p.id === quote.planId); requireThat(plan, 'Choose a saved event.');
      const recipes = quote.recipeIds.map(id => data.quotes.find(r => r.id === id));
      requireThat(recipes.every(r => r && r.planId === quote.planId && r.status !== 'DRAFT' && !r.isTemplate), 'Every item must be a quoted recipe for this event.');
      requireThat(!ops.eventQuotes.some(q => q.id !== quote.id && q.recipeIds.some(id => quote.recipeIds.includes(id))), 'A recipe is already on another event quotation. Edit that quotation instead.');
      requireThat([quote.setup, quote.delivery, quote.discount, quote.vatRate, quote.hire || 0, quote.setupCost || 0, quote.deliveryCost || 0, quote.otherCost || 0, quote.depositDue || 0].every(finite), 'Check the event prices and costs.');
      requireThat(quote.vatRate <= 100, 'VAT rate cannot exceed 100%.');
      const total = eventQuoteTotals(recipes as Quote[], quote); requireThat(total.net >= 0 && total.total >= 0, 'Discount cannot exceed the quote value.');
      requireThat((quote.depositDue || 0) <= total.total && paidFor(data, quote.id) <= total.total + .001, 'The quote total cannot be less than its deposit or recorded payments.');
      requireThat(!quote.stages || (quote.stages.every(s => positive(s.amount) && typeof s.due === 'string') && quote.stages.reduce((s, p) => s + p.amount, 0) <= total.total + .001), 'Payment stages must be positive and cannot exceed the quote total.');
      quote.recipes = (recipes as Quote[]).map(r => ({ id: r.id, name: r.name || r.occasion, quantity: r.quantity || 1, total: calculateTotals(r).grossTotal, vat: calculateTotals(r).vat, revision: recipeRevision(r) }));
      Object.assign(quote, total, { clientName: plan.clientName, status: 'QUOTE', updatedAt: now, approval: { status: 'Pending', comments: '', termsAccepted: false, recordedAt: now, recordedBy: 'Studio' } });
      ops.eventQuotes = [quote, ...ops.eventQuotes.filter(q => q.id !== quote.id)];
      recordIds = [quote.id, plan.id, plan.customerId || '']; action = 'Formal event quote saved'; break;
    }
    case 'purchaseEventQuote': {
      const quote = ops.eventQuotes.find(q => q.id === command.quoteId); requireThat(quote, 'Quotation not found.');
      if (quote.status === 'PURCHASED') break;
      for (const item of quote.recipes) {
        const recipe = data.quotes.find(r => r.id === item.id);
        requireThat(recipe && recipeRevision(recipe) === item.revision, 'A recipe changed after this quotation. Refresh and save the formal quote before purchase.');
      }
      quote.recipeIds.forEach(id => purchase(id, command.allowShortages === true));
      quote.status = 'PURCHASED'; quote.purchasedAt = now; quote.updatedAt = now;
      recordIds = [quote.id, quote.planId, ...quote.recipeIds]; action = 'Event quote marked as Purchased'; break;
    }
    case 'recordApproval': {
      const quote = ops.eventQuotes.find(q => q.id === command.quoteId); requireThat(quote && quote.status === 'QUOTE', 'Choose an open quotation.');
      requireThat(['Approved', 'Changes requested'].includes(command.status), 'Choose an approval response.');
      requireThat(command.status !== 'Approved' || command.termsAccepted === true, 'Confirm the client accepted the terms before recording approval.');
      quote.approval = { status: command.status, comments: command.comments, termsAccepted: command.termsAccepted, recordedAt: now, recordedBy: 'Studio' };
      recordIds = [quote.id, quote.planId]; action = `Client response recorded: ${command.status}`; break;
    }
    case 'issueInvoice': {
      const order = ops.eventQuotes.find(q => q.id === command.orderId) || data.jobs.find(j => j.id === command.orderId);
      requireThat(order, 'Choose a saved order or quotation.');
      requireThat(!ops.eventQuotes.some(q => q.recipeIds.includes(command.orderId)), 'Use the combined event quotation for this invoice.');
      order.invoicedAt ||= now; recordIds = [order.id, order.planId || '']; action = 'Invoice issued'; break;
    }
    case 'payment': {
      const p = command.payment;
      requireThat(p && typeof p.id === 'string' && positive(p.amount) && ['Deposit', 'Balance', 'Refund'].includes(p.kind) && ['Bank transfer', 'Cash', 'Card elsewhere', 'Other'].includes(p.method), 'Enter a valid payment amount and method.');
      requireThat(typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(Date.parse(p.date)), 'Choose the payment date.');
      if (ops.payments.some(row => row.id === p.id)) break;
      const order = ops.eventQuotes.find(q => q.id === p.orderId) || data.jobs.find(j => j.id === p.orderId);
      requireThat(order, 'Choose an existing quotation or purchased order.');
      requireThat(!ops.eventQuotes.some(q => q.recipeIds.includes(p.orderId)), 'Record payment against the combined event quote to avoid double counting.');
      requireThat(p.kind === 'Refund' || !('stockReturned' in order && order.stockReturned), 'Cancelled orders cannot receive new payments.');
      const total = 'total' in order ? order.total : order.totals.grossTotal;
      const paid = paidFor(data, p.orderId);
      requireThat(p.kind === 'Refund' ? p.amount <= paid + .001 : paid + p.amount <= total + .001, p.kind === 'Refund' ? 'Refund exceeds payments received.' : 'Payment exceeds the remaining balance.');
      ops.payments.unshift({ ...p, clientName: order.clientName });
      recordIds = [p.id, p.orderId, order.planId || '']; action = `${p.kind} payment recorded`; break;
    }
    case 'reserveHire': {
      const r = command.reservation; const item = ops.hireItems.find(i => i.id === r.itemId);
      requireThat(item && integer(r.quantity) && r.from && r.to && r.from <= r.to && data.plans.some(p => p.id === r.planId), 'Choose hire stock, an event, valid dates and quantity.');
      const bookings = ops.hireReservations.filter(b => b.id !== r.id && b.itemId === r.itemId && b.status !== 'Returned' && b.from <= r.to && b.to >= r.from);
      const points = [r.from, ...bookings.map(b => b.from).filter(date => date >= r.from && date <= r.to)];
      const overlaps = Math.max(0, ...points.map(date => bookings.filter(b => b.from <= date && b.to >= date).reduce((s, b) => s + b.quantity, 0)));
      requireThat(overlaps + r.quantity <= item.quantity, `Only ${Math.max(0, item.quantity - overlaps)} ${item.name} available over these dates.`);
      requireThat(!ops.hireReservations.some(b => b.id === r.id), 'This reservation is already saved.');
      ops.hireReservations.unshift({ ...r, status: 'Reserved', returned: 0, damaged: 0, lost: 0 });
      recordIds = [r.id, r.planId, r.itemId]; action = 'Hire reserved'; break;
    }
    case 'returnHire': {
      const r = ops.hireReservations.find(i => i.id === command.id); requireThat(r, 'Hire reservation not found.');
      if (r.status === 'Returned') break;
      requireThat([command.returned, command.damaged, command.lost].every(n => finite(n) && Number.isInteger(n)) && command.returned + command.damaged + command.lost === r.quantity, 'Account for every hired item as returned, damaged or lost.');
      const item = ops.hireItems.find(i => i.id === r.itemId); requireThat(item, 'Hire item not found.');
      item.quantity = Math.max(0, item.quantity - command.damaged - command.lost);
      Object.assign(r, { status: 'Returned', returned: command.returned, damaged: command.damaged, lost: command.lost, notes: command.notes });
      recordIds = [r.id, r.planId, r.itemId]; action = 'Hire returned'; break;
    }
    case 'receivePurchaseOrder': {
      const po = ops.purchaseOrders.find(p => p.id === command.id); requireThat(po, 'Purchase order not found.');
      if (po.status === 'Received') break;
      requireThat(po.lines.length > 0, 'Add items before receiving a delivery.');
      for (const line of po.lines) {
        requireThat(positive(line.quantity) && finite(line.unitCost), 'Check the received quantities and costs.');
        let stock = data.inventory.find(i => i.id === line.inventoryId);
        if (!stock) { stock = { id: line.inventoryId || `stock-${po.id}-${data.inventory.length}`, name: line.name, costPerStem: line.unitCost, stemsPurchased: 0, stemsRemaining: 0, supplier: po.supplierName, receivedAt: now, stockUnit: 'stem' }; data.inventory.push(stock); }
        stock.stemsPurchased += line.quantity; stock.stemsRemaining += line.quantity;
        stock.costPerStem = line.unitCost; stock.receivedAt = now;
        transactions.push({ inventoryId: stock.id, name: stock.name, quantity: line.quantity, kind: 'Receipt', recordId: po.id, unitCost: line.unitCost });
      }
      po.status = 'Received'; recordIds = [po.id, po.supplierId]; action = 'Supplier delivery received'; break;
    }
    case 'waste': {
      const stock = data.inventory.find(i => i.id === command.inventoryId); requireThat(stock, 'Choose an inventory item.');
      requireThat(positive(command.quantity) && command.quantity <= stock.stemsRemaining, 'Waste must be above zero and cannot exceed available stock.');
      requireThat(typeof command.reason === 'string' && command.reason.trim() && typeof command.date === 'string' && Number.isFinite(Date.parse(command.date)), 'Choose a reason and date.');
      stock.stemsRemaining = round2(stock.stemsRemaining - command.quantity);
      const id = `waste-${now}-${stock.id}`;
      data.wastage.unshift({ id, inventoryId: stock.id, name: stock.name, quantity: command.quantity, unitCost: stock.costPerStem, stockUnit: stock.stockUnit, reason: command.reason, recordedAt: command.date, notes: command.notes, image: command.image });
      transactions.push({ inventoryId: stock.id, name: stock.name, quantity: -command.quantity, unitCost: stock.costPerStem, kind: 'Waste', recordId: id });
      recordIds = [stock.id, id]; action = 'Waste recorded'; break;
    }
    default: throw new Error('This action is not supported. Refresh the Studio and try again.');
  }
  requireThat(data.inventory.every(i => finite(i.stemsRemaining)), 'This change would leave invalid stock. Nothing was saved.');
  return { data, transactions, action, recordIds: recordIds.filter(Boolean) };
}
