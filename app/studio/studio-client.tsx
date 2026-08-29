'use client';

import Image from 'next/image';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { calculateTotals, DEFAULT_SETTINGS, money } from '@/lib/pricing';
import type { Customer, InventoryItem, Material, PlanMaterial, PlanReferenceImage, Quote, QuoteLine, StudioData, WeddingArrangement, WeddingBuild, WeddingInventoryFlower, WastageRecord, WeddingPlan } from '@/lib/types';

const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const initialData = (): StudioData => ({ version: 1, inventory: [], wastage: [], materials: [], customers: [], quotes: [], jobs: [], plans: [], weddingBuilds: [], settings: DEFAULT_SETTINGS });
const normaliseData = (value: Partial<StudioData>): StudioData => ({ ...initialData(), ...value, inventory: value.inventory || [], wastage: value.wastage || [], materials: value.materials || [], customers: value.customers || [], quotes: value.quotes || [], jobs: value.jobs || [], plans: value.plans || [], weddingBuilds: value.weddingBuilds || [], settings: { ...DEFAULT_SETTINGS, ...value.settings } });
const hasStudioRecords = (value: StudioData) => value.inventory.length + value.wastage.length + value.materials.length + value.customers.length + value.quotes.length + value.jobs.length + value.plans.length + value.weddingBuilds.length > 0;
const blankQuote = (settings: StudioData['settings']): Quote => ({ id: id(), clientName: '', contact: '', occasion: 'Bouquet', eventDate: '', lines: [], labourHours: 0, labourRate: settings.labourRate, wastagePercent: settings.defaultWastage, markupPercent: settings.defaultMarkup, deliveryFee: 0, discount: 0, vatApplies: true, vatRate: settings.vatRate, notes: '', createdAt: new Date().toISOString() });
const n = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
type InvoicePreview = { number: string; clientName: string; contact?: string; occasion: string; date: string; lines: { description: string; quantity: number; total: number }[]; subtotal: number; vat: number; total: number };
const blankWeddingBuild = (plan: WeddingPlan, settings: StudioData['settings']): WeddingBuild => ({ id: id(), planId: plan.id, clientName: plan.clientName, arrangements: [], inventory: [], materials: (plan.materialsNeeded || []).map(material => ({ id: id(), name: material.name, quantity: material.quantity, unitCost: 0 })), markupPercent: settings.defaultMarkup, vatRate: settings.vatRate, updatedAt: new Date().toISOString() });
const makePlanReference = (file: File): Promise<PlanReferenceImage> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('The image could not be read.'));
  reader.onload = () => {
    const photo = new globalThis.Image();
    photo.onerror = () => reject(new Error('The image could not be prepared.'));
    photo.onload = () => {
      const scale = Math.min(1, 900 / Math.max(photo.width, photo.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(photo.width * scale); canvas.height = Math.round(photo.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('The image could not be prepared.'));
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      resolve({ id: id(), name: file.name, dataUrl: canvas.toDataURL('image/jpeg', .78) });
    };
    photo.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

export default function StudioClient() {
  const [data, setData] = useState<StudioData>(initialData);
  const [quote, setQuote] = useState<Quote>(blankQuote(DEFAULT_SETTINGS));
  const [screen, setScreen] = useState<'choose' | 'business' | 'client'>('choose');
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'calculator' | 'jobs' | 'clients' | 'settings'>('dashboard');
  const [clientType, setClientType] = useState<'Wedding' | 'Funeral' | 'Corporate'>('Wedding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [planReferences, setPlanReferences] = useState<PlanReferenceImage[]>([]);
  const [planMaterials, setPlanMaterials] = useState<PlanMaterial[]>([]);
  const [planMaterialName, setPlanMaterialName] = useState('');
  const [planMaterialQuantity, setPlanMaterialQuantity] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedWeddingPlanId, setSelectedWeddingPlanId] = useState<string | null>(null);
  const [weddingBuildDraft, setWeddingBuildDraft] = useState<WeddingBuild | null>(null);
  const [wastageItemId, setWastageItemId] = useState<string | null>(null);
  const [wastageQuantity, setWastageQuantity] = useState(1);
  const [wastageReason, setWastageReason] = useState('');
  const [activeReference, setActiveReference] = useState<PlanReferenceImage | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [saveState, setSaveState] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready');
  const [databaseRevision, setDatabaseRevision] = useState<string | null>(null);
  const saveInFlight = useRef(false);

  const signOut = async () => {
    await fetch('/api/studio/logout', { method: 'POST' });
    globalThis.location.assign('/studio');
  };

  useEffect(() => {
    const saved = globalThis.localStorage.getItem('bramble-petal-studio-data');
    let localData: StudioData | null = null;
    if (saved) {
      try {
        localData = normaliseData(JSON.parse(saved) as Partial<StudioData>);
      } catch { globalThis.localStorage.removeItem('bramble-petal-studio-data'); }
    }

    const loadDatabase = async () => {
      try {
        const response = await fetch('/api/studio', { cache: 'no-store' });
        const payload = await response.json() as { data?: Partial<StudioData>; error?: string; updatedAt?: string | null };
        if (!response.ok || !payload.data) throw new Error(payload.error || 'The Studio database could not be loaded.');
        const databaseData = normaliseData(payload.data);

        if (localData && hasStudioRecords(localData) && !hasStudioRecords(databaseData)) {
          const importResponse = await fetch('/api/studio', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: localData, expectedUpdatedAt: payload.updatedAt ?? null }),
          });
          if (!importResponse.ok) throw new Error('Existing device records could not be imported to Supabase.');
          const imported = await importResponse.json() as { updatedAt?: string };
          setDatabaseRevision(imported.updatedAt ?? payload.updatedAt ?? null);
          setData(localData);
          setQuote(blankQuote(localData.settings));
          setMessage('Existing Studio records imported to Supabase.');
        } else {
          setData(databaseData);
          setQuote(blankQuote(databaseData.settings));
          setDatabaseRevision(payload.updatedAt ?? null);
        }
        globalThis.localStorage.removeItem('bramble-petal-studio-data');
        setSaveState('saved');
      } catch (caught) {
        setSaveState('error');
        setError(caught instanceof Error ? caught.message : 'The Studio database could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    void loadDatabase();
  }, []);

  useEffect(() => {
    if (!message && !error) return;
    const timer = globalThis.setTimeout(() => { setMessage(''); setError(''); }, 5000);
    return () => globalThis.clearTimeout(timer);
  }, [message, error]);

  useEffect(() => {
    if (!invoicePreview && !activeReference) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setInvoicePreview(null); setActiveReference(null); }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [invoicePreview, activeReference]);

  useEffect(() => {
    let picker = document.getElementById('studio-material-picker') as HTMLDataListElement | null;
    if (!picker) { picker = document.createElement('datalist'); picker.id = 'studio-material-picker'; document.body.appendChild(picker); }
    picker.replaceChildren(...data.materials.map(material => { const option = document.createElement('option'); option.value = material.name; option.label = `${money(material.unitCost)} / ${material.unit}`; return option; }));
    const materialLines = quote.lines.filter(line => line.category === 'sundry');
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.material-line > input'));
    const listeners = inputs.map((input, index) => {
      input.setAttribute('list', 'studio-material-picker');
      const line = materialLines[index];
      const syncMaterial = () => {
        const material = data.materials.find(item => item.name.toLocaleLowerCase() === input.value.toLocaleLowerCase());
        if (line && material) updateQuoteLine(line.id, { name: material.name, unitCost: material.unitCost });
      };
      input.addEventListener('change', syncMaterial);
      return () => input.removeEventListener('change', syncMaterial);
    });
    return () => listeners.forEach(remove => remove());
  }, [data.materials, quote.lines]);

  const persist = async (next: StudioData, success: string) => {
    if (saveInFlight.current) {
      setError('Please wait for the current Supabase save to finish.');
      return;
    }
    const previous = data;
    saveInFlight.current = true;
    setData(next); setSaving(true); setSaveState('saving'); setError('');
    try {
      const response = await fetch('/api/studio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: next, expectedUpdatedAt: databaseRevision }),
      });
      const payload = await response.json() as { error?: string; updatedAt?: string };
      if (!response.ok) throw new Error(payload.error || 'The database save failed.');
      setDatabaseRevision(payload.updatedAt ?? null);
      setMessage(`${success} Saved to Supabase.`);
      setSaveState('saved');
    } catch (caught) {
      setData(previous);
      setError(`${caught instanceof Error ? caught.message : 'The database save failed.'} No records were changed.`);
      setSaveState('error');
    }
    finally { saveInFlight.current = false; setSaving(false); }
  };
  const totals = useMemo(() => calculateTotals(quote), [quote]);
  const stockValue = data.inventory.reduce((sum, item) => sum + item.stemsRemaining * item.costPerStem, 0);
  const wastageLoss = data.wastage.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const wastageStems = data.wastage.reduce((sum, item) => sum + item.quantity, 0);
  const jobProfit = data.jobs.reduce((sum, job) => sum + job.totals.profit, 0);
  const businessProfit = jobProfit - wastageLoss;
  const filteredInventory = useMemo(() => {
    const query = inventorySearch.trim().toLocaleLowerCase();
    return query ? data.inventory.filter(item => `${item.name} ${item.colour}`.toLocaleLowerCase().includes(query)) : data.inventory;
  }, [data.inventory, inventorySearch]);
  const filteredJobs = useMemo(() => {
    const query = jobSearch.trim().toLocaleLowerCase();
    return query ? data.jobs.filter(job => `${job.clientName} ${job.contact || ''} ${job.occasion}`.toLocaleLowerCase().includes(query)) : data.jobs;
  }, [data.jobs, jobSearch]);
  const filteredCustomers = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase();
    return query ? data.customers.filter(customer => `${customer.name} ${customer.contact || ''} ${customer.notes || ''}`.toLocaleLowerCase().includes(query)) : data.customers;
  }, [data.customers, clientSearch]);

  const addInventory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const item: InventoryItem = { id: id(), name: String(form.get('name') || ''), colour: String(form.get('colour') || ''), costPerStem: n(String(form.get('cost'))), stemsPurchased: n(String(form.get('stems'))), stemsRemaining: n(String(form.get('stems'))) };
    if (!item.name || item.stemsRemaining <= 0) return setError('Add a flower name and the number of stems.');
    void persist({ ...data, inventory: [item, ...data.inventory] }, 'Flower stock added.');
    event.currentTarget.reset(); setShowInventoryForm(false);
  };
  const restock = (itemId: string, stems: number) => {
    if (stems <= 0) return;
    const next = { ...data, inventory: data.inventory.map(item => item.id === itemId ? { ...item, stemsPurchased: item.stemsPurchased + stems, stemsRemaining: item.stemsRemaining + stems } : item) };
    void persist(next, 'Stock replenished.');
  };
  const deleteInventory = (item: InventoryItem) => {
    if (!globalThis.confirm(`Delete ${item.name} from inventory? This will not remove it from completed jobs.`)) return;
    if (wastageItemId === item.id) setWastageItemId(null);
    void persist({ ...data, inventory: data.inventory.filter(stock => stock.id !== item.id) }, `${item.name} removed from inventory.`);
  };
  const openWastage = (item: InventoryItem) => {
    setWastageItemId(item.id); setWastageQuantity(Math.min(1, item.stemsRemaining)); setWastageReason(''); setError('');
  };
  const recordWastage = () => {
    const item = data.inventory.find(stock => stock.id === wastageItemId);
    const quantity = Math.floor(wastageQuantity);
    if (!item || quantity < 1 || quantity > item.stemsRemaining) return setError(`Enter between 1 and ${item?.stemsRemaining || 0} stems.`);
    const record: WastageRecord = { id: id(), inventoryId: item.id, name: item.name, quantity, unitCost: item.costPerStem, reason: wastageReason.trim(), recordedAt: new Date().toISOString() };
    const next: StudioData = { ...data, inventory: data.inventory.map(stock => stock.id === item.id ? { ...stock, stemsRemaining: stock.stemsRemaining - quantity } : stock), wastage: [record, ...data.wastage] };
    setWastageItemId(null); setWastageReason('');
    void persist(next, `${quantity} ${item.name} stem${quantity === 1 ? '' : 's'} logged as wastage — ${money(quantity * item.costPerStem)} loss recorded.`);
  };
  const addMaterial = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const material: Material = { id: id(), name: String(form.get('name') || ''), category: String(form.get('category') || 'General'), unit: String(form.get('unit') || 'each'), unitCost: n(String(form.get('cost'))) };
    if (!material.name) return setError('Add a material name.');
    void persist({ ...data, materials: [material, ...data.materials] }, 'Material added to the calculator list.');
    event.currentTarget.reset();
  };
  const removeMaterial = (materialId: string) => void persist({ ...data, materials: data.materials.filter(material => material.id !== materialId) }, 'Material removed.');
  const saveDefaultMarkup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const defaultMarkup = Math.max(0, n(String(new FormData(event.currentTarget).get('defaultMarkup'))));
    void persist({ ...data, settings: { ...data.settings, defaultMarkup } }, `Default markup set to ${defaultMarkup}%. New quotes and wedding builds will use it.`);
  };
  const addOrUpdateCustomer = (source: StudioData, name: string, contact = '', notes = ''): StudioData => {
    const cleanName = name.trim();
    if (!cleanName) return source;
    const existing = source.customers.find(customer => customer.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    const customers: Customer[] = existing ? source.customers.map(customer => customer.id === existing.id ? { ...customer, contact: contact || customer.contact, notes: notes || customer.notes } : customer) : [{ id: id(), name: cleanName, contact, notes, createdAt: new Date().toISOString() }, ...source.customers];
    return { ...source, customers };
  };
  const deleteCustomer = (customer: Customer) => {
    const name = customer.name.toLocaleLowerCase();
    if (!globalThis.confirm(`Delete ${customer.name} and all of their saved quotes, completed jobs and planning briefs? This cannot be undone.`)) return;
    const next: StudioData = {
      ...data,
      customers: data.customers.filter(item => item.id !== customer.id),
      quotes: data.quotes.filter(item => item.clientName.toLocaleLowerCase() !== name),
      jobs: data.jobs.filter(item => item.clientName.toLocaleLowerCase() !== name),
      plans: data.plans.filter(item => item.clientName.toLocaleLowerCase() !== name),
    };
    setSelectedCustomerId(null);
    void persist(next, `${customer.name} and their saved records have been deleted.`);
  };
  const addFlowerLine = () => {
    const flower = data.inventory[0];
    if (!flower) return setError('Add flowers to inventory before building a quote.');
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: flower.id, name: flower.name, category: 'stem', quantity: 1, unitCost: flower.costPerStem }] }));
  };
  const addMaterialLine = () => {
    const material = data.materials[0];
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: null, name: material?.name || '', category: 'sundry', quantity: 1, unitCost: material?.unitCost || 0 }] }));
  };
  const updateQuoteLine = (lineId: string, changes: Partial<QuoteLine>) => setQuote(current => ({ ...current, lines: current.lines.map(line => line.id === lineId ? { ...line, ...changes } : line) }));
  const chooseFlower = (lineId: string, inventoryId: string) => {
    const flower = data.inventory.find(item => item.id === inventoryId);
    if (flower) updateQuoteLine(lineId, { inventoryId: flower.id, name: flower.name, unitCost: flower.costPerStem });
  };
  const chooseMaterial = (lineId: string, materialId: string) => {
    const material = data.materials.find(item => item.id === materialId);
    if (material) updateQuoteLine(lineId, { name: material.name, unitCost: material.unitCost });
  };
  const removeQuoteLine = (lineId: string) => setQuote(current => ({ ...current, lines: current.lines.filter(line => line.id !== lineId) }));
  const saveQuote = () => {
    if (!quote.clientName) return setError('Add the client name before saving a quote.');
    void persist(addOrUpdateCustomer({ ...data, quotes: [quote, ...data.quotes] }, quote.clientName, quote.contact, quote.notes), 'Quote saved to the client record. No stock has moved.');
  };
  const winJob = () => {
    if (!quote.clientName || quote.lines.length === 0) return setError('Add a client and at least one line before winning a job.');
    const frozen = { ...quote, lines: quote.lines.map(line => ({ ...line })), wonAt: new Date().toISOString(), stockReturned: false, totals };
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: Math.max(0, item.stemsRemaining - quote.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0)) })), quotes: data.quotes.filter(saved => saved.id !== quote.id), jobs: [frozen, ...data.jobs] };
    void persist(addOrUpdateCustomer(next, quote.clientName, quote.contact, quote.notes), `Job won — ${money(totals.grossTotal)} saved and stock deducted.`);
    setQuote(blankQuote(data.settings)); setTab('jobs');
  };
  const returnStock = (jobId: string) => {
    const job = data.jobs.find(item => item.id === jobId); if (!job || job.stockReturned) return;
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: item.stemsRemaining + job.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0) })), jobs: data.jobs.map(item => item.id === jobId ? { ...item, stockReturned: true } : item) };
    void persist(next, 'Unused stems returned to stock.');
  };
  const deleteWonJob = (jobId: string) => {
    const job = data.jobs.find(item => item.id === jobId);
    if (!job) return;
    if (!globalThis.confirm(`Delete ${job.clientName}’s ${job.occasion} job? Any flower stems deducted for it will be returned to inventory.`)) return;
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: item.stemsRemaining + (job.stockReturned ? 0 : job.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0)) })), jobs: data.jobs.filter(item => item.id !== job.id) };
    setSelectedJobId(null);
    void persist(next, 'Job deleted and its flower stems returned to stock.');
  };
  const addPlanReferences = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - planReferences.length));
    event.target.value = '';
    if (selected.length === 0) return;
    try {
      const prepared = await Promise.all(selected.map(makePlanReference));
      setPlanReferences(current => [...current, ...prepared]);
      setError('');
    } catch { setError('One of the reference images could not be prepared.'); }
  };
  const updatePlanReference = (referenceId: string, caption: string) => setPlanReferences(current => current.map(reference => reference.id === referenceId ? { ...reference, caption } : reference));
  const removePlanReference = (referenceId: string) => setPlanReferences(current => current.filter(reference => reference.id !== referenceId));
  const addPlanMaterial = () => {
    const name = planMaterialName.trim(); const quantity = Math.max(1, planMaterialQuantity);
    if (!name) return setError('Add the material needed for this plan.');
    setPlanMaterials(current => [...current, { id: id(), name, quantity, status: 'Needed' }]);
    setPlanMaterialName(''); setPlanMaterialQuantity(1); setError('');
  };
  const removePlanMaterial = (materialId: string) => setPlanMaterials(current => current.filter(material => material.id !== materialId));
  const updateSavedPlanMaterial = (planId: string, materialId: string, status: PlanMaterial['status']) => {
    const next = { ...data, plans: data.plans.map(plan => plan.id === planId ? { ...plan, materialsNeeded: (plan.materialsNeeded || []).map(material => material.id === materialId ? { ...material, status } : material) } : plan) };
    void persist(next, 'Material status updated.');
  };
  const openWeddingBuilder = (plan: WeddingPlan) => {
    const saved = data.weddingBuilds.find(build => build.planId === plan.id);
    setWeddingBuildDraft(saved ? JSON.parse(JSON.stringify(saved)) as WeddingBuild : blankWeddingBuild(plan, data.settings));
    setSelectedWeddingPlanId(plan.id);
  };
  const closeWeddingBuilder = () => { setSelectedWeddingPlanId(null); setWeddingBuildDraft(null); };
  const saveWeddingBuild = () => {
    if (!weddingBuildDraft) return;
    const nextBuild = { ...weddingBuildDraft, updatedAt: new Date().toISOString() };
    const next = { ...data, weddingBuilds: data.weddingBuilds.some(build => build.planId === nextBuild.planId) ? data.weddingBuilds.map(build => build.planId === nextBuild.planId ? nextBuild : build) : [nextBuild, ...data.weddingBuilds] };
    setWeddingBuildDraft(nextBuild);
    void persist(next, 'Wedding build, flower inventory plan and pricing saved.');
  };
  const addWeddingInventory = () => setWeddingBuildDraft(current => current ? { ...current, inventory: [...current.inventory, { id: id(), name: '', costPerStem: 0, stemsPerPurchase: 10, purchases: 1 }] } : current);
  const updateWeddingInventory = (inventoryId: string, changes: Partial<WeddingInventoryFlower>) => setWeddingBuildDraft(current => current ? { ...current, inventory: current.inventory.map(flower => flower.id === inventoryId ? { ...flower, ...changes } : flower) } : current);
  const removeWeddingInventory = (inventoryId: string) => setWeddingBuildDraft(current => current ? { ...current, inventory: current.inventory.filter(flower => flower.id !== inventoryId), arrangements: current.arrangements.map(arrangement => ({ ...arrangement, flowers: arrangement.flowers.map(flower => flower.inventoryId === inventoryId ? { ...flower, inventoryId: null } : flower) })) } : current);
  const addWeddingArrangement = () => setWeddingBuildDraft(current => current ? { ...current, arrangements: [...current.arrangements, { id: id(), name: '', quantity: 1, flowers: [], notes: '' }] } : current);
  const updateWeddingArrangement = (arrangementId: string, changes: Partial<WeddingArrangement>) => setWeddingBuildDraft(current => current ? { ...current, arrangements: current.arrangements.map(arrangement => arrangement.id === arrangementId ? { ...arrangement, ...changes } : arrangement) } : current);
  const removeWeddingArrangement = (arrangementId: string) => setWeddingBuildDraft(current => current ? { ...current, arrangements: current.arrangements.filter(arrangement => arrangement.id !== arrangementId) } : current);
  const addArrangementFlower = (arrangementId: string) => setWeddingBuildDraft(current => current ? { ...current, arrangements: current.arrangements.map(arrangement => arrangement.id === arrangementId ? { ...arrangement, flowers: [...arrangement.flowers, { id: id(), inventoryId: current.inventory[0]?.id || null, name: current.inventory[0]?.name || '', stemsPerArrangement: 1 }] } : arrangement) } : current);
  const updateArrangementFlower = (arrangementId: string, flowerId: string, changes: Partial<WeddingArrangement['flowers'][number]>) => setWeddingBuildDraft(current => current ? { ...current, arrangements: current.arrangements.map(arrangement => arrangement.id === arrangementId ? { ...arrangement, flowers: arrangement.flowers.map(flower => flower.id === flowerId ? { ...flower, ...changes } : flower) } : arrangement) } : current);
  const removeArrangementFlower = (arrangementId: string, flowerId: string) => setWeddingBuildDraft(current => current ? { ...current, arrangements: current.arrangements.map(arrangement => arrangement.id === arrangementId ? { ...arrangement, flowers: arrangement.flowers.filter(flower => flower.id !== flowerId) } : arrangement) } : current);
  const updateWeddingMaterial = (materialId: string, changes: Partial<WeddingBuild['materials'][number]>) => setWeddingBuildDraft(current => current ? { ...current, materials: current.materials.map(material => material.id === materialId ? { ...material, ...changes } : material) } : current);
  const showJobInvoice = (job: StudioData['jobs'][number]) => {
    setInvoicePreview({ number: `BP-${job.id.slice(0, 8).toUpperCase()}`, clientName: job.clientName, contact: job.contact, occasion: job.occasion, date: job.eventDate || job.wonAt, lines: [{ description: job.occasion === 'Bouquet' ? 'Bespoke bouquet' : `${job.occasion} floral arrangement`, quantity: 1, total: job.totals.grossTotal }], subtotal: job.totals.grossTotal - job.totals.vat, vat: job.totals.vat, total: job.totals.grossTotal });
  };
  const showPlanInvoice = (plan: WeddingPlan) => {
    const build = data.weddingBuilds.find(item => item.planId === plan.id);
    if (!build) { const total = plan.finishedEstimate || 0; return setInvoicePreview({ number: `BP-${plan.id.slice(0, 8).toUpperCase()}`, clientName: plan.clientName, contact: plan.contact, occasion: plan.type, date: plan.eventDate || plan.createdAt, lines: [{ description: `${plan.type} floral plan`, quantity: 1, total }], subtotal: total, vat: 0, total }); }
    const inventoryById = new Map(build.inventory.map(item => [item.id, item]));
    const arrangementBase = build.arrangements.map(arrangement => ({ description: arrangement.name || 'Wedding floral arrangement', quantity: arrangement.quantity, total: arrangement.quantity * arrangement.flowers.reduce((sum, flower) => sum + flower.stemsPerArrangement * (inventoryById.get(flower.inventoryId || '')?.costPerStem || 0), 0) }));
    const materialsTotal = build.materials.reduce((sum, material) => sum + material.quantity * material.unitCost, 0);
    const materialShare = arrangementBase.length ? materialsTotal / arrangementBase.length : materialsTotal;
    const clientLines = arrangementBase.length ? arrangementBase.map(line => ({ ...line, total: line.total + materialShare })) : [{ description: `${plan.type} floral arrangement`, quantity: 1, total: materialsTotal }];
    const base = clientLines.reduce((sum, line) => sum + line.total, 0);
    const net = base * (1 + build.markupPercent / 100); const vat = net * build.vatRate / 100; const total = net + vat;
    const multiplier = base ? total / base : 1;
    setInvoicePreview({ number: `BP-${plan.id.slice(0, 8).toUpperCase()}`, clientName: plan.clientName, contact: plan.contact, occasion: plan.type, date: plan.eventDate || plan.createdAt, lines: clientLines.map(line => ({ ...line, total: line.total * multiplier })), subtotal: net, vat, total });
  };
  const savePlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const plan: WeddingPlan = { id: id(), clientName: String(form.get('clientName') || ''), contact: String(form.get('contact') || ''), type: clientType, eventDate: String(form.get('eventDate') || ''), venue: String(form.get('venue') || ''), brideHeight: String(form.get('brideHeight') || ''), tableCount: form.get('tableCount') ? n(String(form.get('tableCount'))) : null, mainTableSize: String(form.get('mainTableSize') || ''), personRemembered: String(form.get('personRemembered') || ''), serviceTime: String(form.get('serviceTime') || ''), funeralDirector: String(form.get('funeralDirector') || ''), serviceWishes: String(form.get('serviceWishes') || ''), cardMessage: String(form.get('cardMessage') || ''), eventFormat: String(form.get('eventFormat') || ''), guestCount: form.get('guestCount') ? n(String(form.get('guestCount'))) : null, setupWindow: String(form.get('setupWindow') || ''), breakdownTime: String(form.get('breakdownTime') || ''), venueRestrictions: String(form.get('venueRestrictions') || ''), budget: form.get('budget') ? n(String(form.get('budget'))) : null, palette: String(form.get('palette') || ''), favouriteFlowers: String(form.get('favouriteFlowers') || ''), avoidFlowers: String(form.get('avoidFlowers') || ''), arrangements: String(form.get('arrangements') || ''), notes: String(form.get('notes') || ''), status: String(form.get('status') || 'Enquiry') as WeddingPlan['status'], finishedEstimate: form.get('estimate') ? n(String(form.get('estimate'))) : null, references: planReferences, materialsNeeded: planMaterials, createdAt: new Date().toISOString() };
    if (!plan.clientName || !plan.notes) return setError('Add a client name and their floral brief.');
    void persist(addOrUpdateCustomer({ ...data, plans: [plan, ...data.plans] }, plan.clientName, plan.contact, plan.notes), 'Client plan saved to their customer record.');
    event.currentTarget.reset(); setPlanReferences([]); setPlanMaterials([]); setPlanMaterialName(''); setPlanMaterialQuantity(1);
  };

  if (loading) return <main className="loading">Preparing your Studio Hub…</main>;
  if (screen === 'choose') return <main className="choose-screen"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Hub</h1><p className="welcome-copy">Choose the space that suits this moment.</p><div className="choice-grid"><button type="button" className="choice-card" onClick={() => setScreen('business')}><span>FOR JADE &amp; THE TEAM</span><strong>Enter Business Side</strong><small>Inventory, quoting, jobs and client plans.</small></button><button type="button" className="choice-card" onClick={() => setScreen('client')}><span>FOR CONSULTATIONS</span><strong>Enter Client Planning Studio</strong><small>A customer-safe space for wedding, funeral and corporate planning.</small></button></div><p className={`studio-storage-note ${saveState}`}><span aria-hidden="true">●</span>{saveState === 'saved' ? 'Studio database connected' : saveState === 'error' ? 'Database connection needs attention — device backup active' : 'Connecting to the Studio database…'}</p></main>;

  const nav = (name: typeof tab, label: string) => <button type="button" aria-current={tab === name ? 'page' : undefined} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{label}</button>;
  const selectedCustomer = selectedCustomerId ? data.customers.find(customer => customer.id === selectedCustomerId) || null : null;
  const selectedCustomerPlans = selectedCustomer ? data.plans.filter(plan => plan.clientName.toLocaleLowerCase() === selectedCustomer.name.toLocaleLowerCase()) : [];
  const selectedCustomerJobs = selectedCustomer ? data.jobs.filter(job => job.clientName.toLocaleLowerCase() === selectedCustomer.name.toLocaleLowerCase()) : [];
  const selectedCustomerQuotes = selectedCustomer ? data.quotes.filter(savedQuote => savedQuote.clientName.toLocaleLowerCase() === selectedCustomer.name.toLocaleLowerCase()) : [];
  return <main className="studio-shell"><header className="studio-nav"><button type="button" className="brand-button" onClick={() => setScreen('choose')}><b>✾</b><span>Bramble &amp; Petal<small>{screen === 'business' ? 'FLORIST STUDIO APP' : 'CLIENT PLANNING STUDIO'}</small></span></button>{screen === 'business' ? <nav aria-label="Business workspace">{nav('dashboard', 'Dashboard')}{nav('inventory', 'Inventory')}{nav('calculator', 'Calculator')}{nav('jobs', 'Jobs Won')}{nav('clients', 'Clients')}{nav('settings', 'Settings')}</nav> : <nav aria-label="Planning type">{(['Wedding', 'Funeral', 'Corporate'] as const).map(type => <button type="button" aria-current={clientType === type ? 'page' : undefined} className={clientType === type ? 'active' : ''} key={type} onClick={() => setClientType(type)}>{type}</button>)}</nav>}<div className="studio-session-actions"><span className={`studio-save-state ${saveState}`} aria-live="polite">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Database save issue' : saveState === 'saved' ? 'Supabase saved' : 'Connecting…'}</span><button type="button" className="exit-button" onClick={() => setScreen('choose')}>Change space</button><button type="button" className="signout-button" onClick={() => void signOut()}>Sign out</button></div></header>
    {message && <p className="notice">{message}</p>}{error && <p className="notice error">{error}</p>}
    {screen === 'client' ? (
      <section className="studio-content planner">
        <p className="eyebrow">CLIENT-SAFE PLANNING</p>
        <h1>{clientType} flower plan</h1>
        <p>{clientType === 'Funeral' ? 'Capture a thoughtful, practical tribute brief with every family and delivery detail in one place.' : clientType === 'Corporate' ? 'Define the brand direction, floral scope and setup requirements without showing internal costs.' : 'Build a complete brief together. Internal costs, VAT and markup are never shown here.'}</p>
        <form className="planner-form" onSubmit={savePlan}>
          <section><h2>1. Client &amp; occasion</h2><div className="form-columns"><label>{clientType === 'Corporate' ? 'Company / event organiser' : 'Client name'}<input name="clientName" required placeholder={clientType === 'Corporate' ? 'Company or organiser name' : 'Full name'} /></label><label>{clientType === 'Funeral' ? 'Family contact' : 'Contact'}<input name="contact" placeholder="Phone or email" /></label><label>{clientType === 'Funeral' ? 'Service date' : 'Event date'}<input name="eventDate" type="date" /></label><label>{clientType === 'Funeral' ? 'Service venue / location' : 'Venue / location'}<input name="venue" placeholder="Venue or address" /></label>{clientType === 'Wedding' ? <><label>Height of the bride<input name="brideHeight" placeholder="e.g. 5 ft 7 in" /></label><label>How many tables?<input name="tableCount" type="number" min="0" /></label><label>Size of the main table<input name="mainTableSize" placeholder="e.g. 6 ft rectangular" /></label></> : clientType === 'Funeral' ? <><label>Person being remembered<input name="personRemembered" placeholder="Name for the tribute" /></label><label>Service time<input name="serviceTime" type="time" /></label><label>Funeral director / delivery details<input name="funeralDirector" placeholder="Director, collection or delivery instructions" /></label><label>Faith, cultural or family wishes<input name="serviceWishes" placeholder="Any important traditions or requests" /></label><label>Card message &amp; from<input name="cardMessage" placeholder="Message and who it is from" /></label></> : <><label>Event format &amp; purpose<input name="eventFormat" placeholder="e.g. awards dinner, launch, conference" /></label><label>Expected attendees<input name="guestCount" type="number" min="0" /></label><label>How many tables?<input name="tableCount" type="number" min="0" /></label><label>Table size / layout<input name="mainTableSize" placeholder="e.g. 12 round tables, 1 stage table" /></label><label>Setup access window<input name="setupWindow" placeholder="e.g. 08:00–10:00" /></label><label>Breakdown / collection time<input name="breakdownTime" placeholder="e.g. 23:30 or next morning" /></label><label>Venue / technical restrictions<input name="venueRestrictions" placeholder="Access, flames, height, rigging, surfaces…" /></label></>}<label>Comfortable budget (£)<input name="budget" type="number" min="0" step="0.01" /></label></div></section>
          <section><h2>{clientType === 'Funeral' ? '2. Tribute direction' : clientType === 'Corporate' ? '2. Brand direction & floral scope' : '2. Floral direction'}</h2><div className="form-columns"><label>{clientType === 'Corporate' ? 'Brand colours / visual direction' : clientType === 'Funeral' ? 'Meaningful flowers / colours' : 'Colour palette'}<input name="palette" placeholder={clientType === 'Corporate' ? 'Brand colours, finish or campaign theme' : 'e.g. soft blush, cream and green'} /></label><label>{clientType === 'Corporate' ? 'Florals / foliage to include' : clientType === 'Funeral' ? 'Flowers wanted or with meaning' : 'Flowers wanted'}<input name="favouriteFlowers" placeholder="Specific flowers they would like" /></label><label>{clientType === 'Corporate' ? 'Brand or venue exclusions' : clientType === 'Funeral' ? 'Flowers or colours to avoid' : 'Flowers to avoid'}<input name="avoidFlowers" placeholder="Allergies, dislikes or exclusions" /></label><label>Plan status<select name="status" defaultValue="Enquiry"><option>Enquiry</option><option>Planning</option><option>Proposal sent</option><option>Booked</option></select></label></div><label>{clientType === 'Funeral' ? 'Tributes and quantities needed' : clientType === 'Corporate' ? 'Floral moments required' : 'What arrangements are needed?'}<textarea name="arrangements" placeholder={clientType === 'Funeral' ? 'Coffin spray, wreaths, letters, posies, service flowers, family tributes…' : clientType === 'Corporate' ? 'Entrance, registration desk, stage, tables, bar, sponsor areas, photo moment…' : 'Bouquet, buttonholes, ceremony flowers, tables, reception…'} /></label></section>
          <section className="plan-material-section"><div className="reference-heading"><div><h2>3. Materials to plan for</h2><p>Record urns, ribbons, baskets, table vases and any other non-floral requirements.</p></div></div><div className="plan-material-form"><input value={planMaterialName} onChange={event => setPlanMaterialName(event.target.value)} placeholder="e.g. 12 bud vases" /><input value={planMaterialQuantity} onChange={event => setPlanMaterialQuantity(n(event.target.value))} type="number" min="1" /><button type="button" onClick={addPlanMaterial}>+ Add material</button></div>{planMaterials.length ? <div className="plan-material-list">{planMaterials.map(material => <span key={material.id}><b>{material.quantity} × {material.name}</b><em>{material.status}</em><button type="button" onClick={() => removePlanMaterial(material.id)} aria-label={`Remove ${material.name}`}>×</button></span>)}</div> : <p className="reference-empty">No materials added yet.</p>}</section>
          <section className="plan-reference-section">
            <div className="reference-heading"><div><h2>4. Inspiration &amp; reference images</h2><p>Save up to eight client-supplied ideas with a note on what they love about each one.</p></div><label className="reference-upload">+ Add reference images<input type="file" accept="image/*" multiple onChange={addPlanReferences} disabled={planReferences.length >= 8} /></label></div>
            {planReferences.length > 0 ? <div className="reference-grid">{planReferences.map(reference => <article key={reference.id}><Image src={reference.dataUrl} alt={reference.caption || reference.name} width={180} height={135} unoptimized /><label>What should we take from this?<input value={reference.caption || ''} placeholder="e.g. colour, shape, texture" onChange={event => updatePlanReference(reference.id, event.target.value)} /></label><button type="button" onClick={() => removePlanReference(reference.id)}>Remove</button></article>)}</div> : <p className="reference-empty">No images yet — upload flower, colour, table-setting or venue ideas from the client.</p>}
          </section>
          <section><h2>{clientType === 'Funeral' ? '5. Family notes & next steps' : clientType === 'Corporate' ? '5. Approval & next steps' : '5. Personal details & next steps'}</h2><label>{clientType === 'Funeral' ? 'Personal memories, display wishes and follow-up actions' : clientType === 'Corporate' ? 'Approvals, delivery contact and operational notes' : 'Story, inspiration and must-haves'}<textarea name="notes" required placeholder={clientType === 'Funeral' ? 'Personal details, preferred tribute display, collection wishes and any follow-up…' : clientType === 'Corporate' ? 'Brand approvals, stakeholders, delivery contact and practical notes…' : 'Style, venue details, sentimental blooms, practical needs, priorities and follow-up actions…'} /></label><label>Finished estimate to show client (£)<input name="estimate" type="number" min="0" step="0.01" /></label></section>
          <button type="submit" className="button" disabled={saving}>Save client plan</button>
        </form>
        <section className="records"><h2>Saved {clientType.toLowerCase()} plans</h2>{data.plans.filter(plan => plan.type === clientType).map(plan => <article key={plan.id}><b>{plan.clientName} <em>· {plan.status || 'Enquiry'}</em></b><span>{plan.eventDate || 'Date to confirm'} {plan.venue ? `· ${plan.venue}` : ''}</span><p>{plan.arrangements || plan.notes}</p>{plan.references?.length ? <div className="saved-reference-strip">{plan.references.map(reference => <Image key={reference.id} src={reference.dataUrl} alt={reference.caption || reference.name} width={92} height={70} unoptimized />)}</div> : null}{plan.finishedEstimate !== null && <strong>{money(plan.finishedEstimate)}</strong>}<button type="button" onClick={() => showPlanInvoice(plan)}>Generate invoice</button></article>) || <p>No {clientType.toLowerCase()} plans saved yet.</p>}</section>
      </section>
    ) : <section className="studio-content">
      {tab === 'dashboard' && <>
        <div className="hero-title"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Overview</h1><span>— ✾ —</span></div>
        <div className="metric-grid">
          <article><small>INVENTORY VALUE<br />(EX VAT)</small><b>{money(stockValue)}</b></article>
          <article><small>INVENTORY VALUE<br />(INC VAT)</small><b>{money(stockValue * 1.2)}</b></article>
          <article><small>JOBS WON</small><b>{data.jobs.length}</b></article>
          <article><small>TOTAL REVENUE</small><b>{money(data.jobs.reduce((sum, job) => sum + job.totals.grossTotal, 0))}</b></article>
          <article className="profit-metric"><small>PROFIT<br />(AFTER LOGGED WASTAGE)</small><b>{money(businessProfit)}</b><span>{money(jobProfit)} before wastage</span></article>
          <article className="loss-metric"><small>WASTAGE LOSS<br />(AT COST)</small><b>{money(wastageLoss)}</b><span>{wastageStems} stem{wastageStems === 1 ? '' : 's'} logged</span></article>
        </div>
        <div className="dashboard-grid">
          <article><h2>Low &amp; out of stock</h2>{data.inventory.filter(item => item.stemsRemaining < 10).length ? data.inventory.filter(item => item.stemsRemaining < 10).map(item => <p key={item.id}>{item.name} — {item.stemsRemaining} left</p>) : <p>Nothing low at the moment.</p>}</article>
          <article><h2>Upcoming events</h2>{data.plans.length ? data.plans.slice(0, 3).map(plan => <p key={plan.id}>{plan.clientName} — {plan.type}</p>) : <p>No plans added yet.</p>}</article>
          <article className="loss-log"><h2>Wastage &amp; loss log</h2>{data.wastage.length ? data.wastage.slice(0, 5).map(record => <p key={record.id}><b>{record.quantity} × {record.name}</b> — {money(record.quantity * record.unitCost)} loss <small>{record.reason ? `· ${record.reason}` : ''} · {new Date(record.recordedAt).toLocaleDateString('en-GB')}</small></p>) : <p>No wastage has been logged.</p>}</article>
        </div>
      </>}
      {tab === 'inventory' && <>
        <div className="workspace-heading"><div><p className="eyebrow">FLOWER INVENTORY</p><h1>Inventory hub</h1></div><button type="button" className="button" onClick={() => setShowInventoryForm(show => !show)}>{showInventoryForm ? 'Close' : '+ Add flower'}</button></div>
        <section className="inventory-summary"><div><small>Total value (ex VAT)</small><strong>{money(stockValue)}</strong></div><div><small>VAT (20%)</small><strong>{money(stockValue * .2)}</strong></div><div><small>Total value (inc VAT)</small><strong>{money(stockValue * 1.2)}</strong></div></section>
        {showInventoryForm && <form className="panel-form inventory-form" onSubmit={addInventory}><label>Flower name<input name="name" required placeholder="e.g. White rose" /></label><label>Colour<input name="colour" placeholder="e.g. ivory" /></label><label>Cost per stem (£)<input name="cost" type="number" min="0" step="0.01" required /></label><label>Stems purchased<input name="stems" type="number" min="1" required /></label><button type="submit" className="button" disabled={saving}>Save flower</button></form>}
        <div className="workspace-toolbar"><label htmlFor="inventory-search"><span>Search inventory</span><input id="inventory-search" type="search" value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} placeholder="Flower or colour" /></label><p>{filteredInventory.length} of {data.inventory.length} flower{data.inventory.length === 1 ? '' : 's'}</p></div>
        <section className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Flower</th><th>Colour</th><th>Cost / stem</th><th>Purchased</th><th>Available</th><th>Actions</th></tr></thead><tbody>{filteredInventory.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.colour || '—'}</td><td>{money(item.costPerStem)}</td><td>{item.stemsPurchased}</td><td><b>{item.stemsRemaining}</b></td><td><div className="inventory-actions"><button type="button" onClick={() => restock(item.id, 10)}>+10</button><button className="wastage-button" type="button" onClick={() => openWastage(item)}>Log wastage</button><button className="delete-button" type="button" onClick={() => deleteInventory(item)}>Delete</button></div></td></tr>)}</tbody></table>{data.inventory.length === 0 ? <p className="empty-state">No flowers yet. Use “Add flower” to start your stock list.</p> : filteredInventory.length === 0 && <p className="empty-state">No stock matches “{inventorySearch}”.</p>}</section>
        {wastageItemId && (() => { const item = data.inventory.find(stock => stock.id === wastageItemId); return item ? <section className="wastage-panel"><div><p className="eyebrow">INVENTORY ADJUSTMENT</p><h2>Log {item.name} as wastage</h2><p>This removes the stems from available stock and records the cost as a business loss.</p></div><label>Stems wasted<input aria-label="Stems wasted" type="number" min="1" max={item.stemsRemaining} value={wastageQuantity} onChange={event => setWastageQuantity(n(event.target.value))} /></label><label>Reason (optional)<input value={wastageReason} placeholder="e.g. damaged, expired, quality issue" onChange={event => setWastageReason(event.target.value)} /></label><div className="wastage-actions"><b>Loss: {money(Math.max(0, Math.min(item.stemsRemaining, Math.floor(wastageQuantity) || 0)) * item.costPerStem)}</b><button type="button" onClick={() => setWastageItemId(null)}>Cancel</button><button className="button" type="button" onClick={recordWastage}>Record wastage</button></div></section> : null; })()}
      </>}
      {tab === 'calculator' && <><p className="eyebrow">PRICING CALCULATOR</p><h1>Build a bouquet or job</h1><div className="quote-workspace"><section className="quote-builder"><div className="quote-step"><h2>1. Customer &amp; job</h2><div className="form-columns"><label>Customer name<input value={quote.clientName} placeholder="e.g. Jane Smith" onChange={event => setQuote({ ...quote, clientName: event.target.value })} /></label><label>Contact<input value={quote.contact || ''} placeholder="phone / email" onChange={event => setQuote({ ...quote, contact: event.target.value })} /></label><label>Job type<select value={quote.occasion} onChange={event => setQuote({ ...quote, occasion: event.target.value as Quote['occasion'] })}><option>Bouquet</option><option>Wedding</option><option>Funeral</option><option>Corporate</option></select></label><label>Event / delivery date<input type="date" value={quote.eventDate} onChange={event => setQuote({ ...quote, eventDate: event.target.value })} /></label></div></div><div className="quote-step"><div className="step-title"><h2>2. Flowers used</h2><button onClick={addFlowerLine}>+ Add flower</button></div>{quote.lines.filter(line => line.category === 'stem').map(line => <div className="quote-line-editor" key={line.id}><select value={line.inventoryId || ''} onChange={event => chooseFlower(line.id, event.target.value)}>{data.inventory.map(item => <option key={item.id} value={item.id}>{item.name} — {item.stemsRemaining} stems</option>)}</select><label>Stems used<input aria-label="Stems used" type="number" min="1" value={line.quantity} onChange={event => updateQuoteLine(line.id, { quantity: n(event.target.value) })} /></label><b>{money(line.quantity * line.unitCost)}</b><button aria-label="Remove flower" onClick={() => removeQuoteLine(line.id)}>×</button></div>)}{quote.lines.filter(line => line.category === 'stem').length === 0 && <p className="quote-help">Add flowers from your current inventory.</p>}</div><div className="quote-step"><div className="step-title"><h2>3. Materials &amp; extras</h2><button onClick={addMaterialLine}>+ Add material</button></div>{quote.lines.filter(line => line.category === 'sundry').map(line => <div className="quote-line-editor material-line" key={line.id}><input value={line.name} placeholder="e.g. ribbon, vase or packaging" onChange={event => updateQuoteLine(line.id, { name: event.target.value })} /><label>Quantity<input aria-label="Material quantity" type="number" min="1" value={line.quantity} onChange={event => updateQuoteLine(line.id, { quantity: n(event.target.value) })} /></label><label>Unit cost (£)<input aria-label="Material unit cost" type="number" min="0" step="0.01" value={line.unitCost} onChange={event => updateQuoteLine(line.id, { unitCost: n(event.target.value) })} /></label><button aria-label="Remove material" onClick={() => removeQuoteLine(line.id)}>×</button></div>)}{quote.lines.filter(line => line.category === 'sundry').length === 0 && <p className="quote-help">Add packaging, vases, ribbon or other extras.</p>}</div><div className="quote-step"><h2>4. Pricing</h2><div className="form-columns"><label>Markup %<input type="number" min="0" value={quote.markupPercent} onChange={event => setQuote({ ...quote, markupPercent: n(event.target.value) })} /></label><label>VAT / Tax %<input type="number" min="0" value={quote.vatRate} onChange={event => setQuote({ ...quote, vatRate: n(event.target.value) })} /></label><label>Labour hours<input type="number" min="0" step="0.5" value={quote.labourHours} onChange={event => setQuote({ ...quote, labourHours: n(event.target.value) })} /></label><label>Delivery (£)<input type="number" min="0" value={quote.deliveryFee} onChange={event => setQuote({ ...quote, deliveryFee: n(event.target.value) })} /></label></div><label>Notes<textarea value={quote.notes || ''} placeholder="Any notes about this order…" onChange={event => setQuote({ ...quote, notes: event.target.value })} /></label></div></section><aside className="quote-summary"><h2>Order summary</h2><span>Flowers cost <b>{money(totals.stemCost)}</b></span><span>Materials cost <b>{money(totals.sundryCost)}</b></span><span>Base cost <b>{money(totals.costSubtotal)}</b></span><span>Markup ({quote.markupPercent}%) <b>{money(totals.markup)}</b></span><span>VAT ({quote.vatRate}%) <b>{money(totals.vat)}</b></span><strong>Total price <b>{money(totals.grossTotal)}</b></strong><button className="button job-won" onClick={winJob} disabled={saving}>Job won — save &amp; deduct stock</button><button className="secondary-action" onClick={saveQuote}>Save quote without stock change</button></aside></div></>}
      {tab === 'jobs' && (selectedJobId ? (() => { const job = data.jobs.find(item => item.id === selectedJobId); return job ? <section className="job-detail"><button className="back-button" onClick={() => setSelectedJobId(null)}>← Back to Jobs Won</button><header className="job-detail-header"><div><p className="eyebrow">WON JOB · {job.occasion.toUpperCase()}</p><h1>{job.clientName}</h1><p>{job.contact || 'No customer contact details saved'} · Won {new Date(job.wonAt).toLocaleDateString('en-GB')}</p></div><strong>{money(job.totals.grossTotal)}</strong></header><section className="job-detail-panel"><h2>Flowers &amp; materials used</h2><div className="job-line-list">{job.lines.map(line => <article key={line.id}><div><b>{line.name}</b><span>{line.category === 'stem' ? 'Flower stem' : 'Material / extra'}</span></div><span>{line.quantity} × {money(line.unitCost)}</span><strong>{money(line.quantity * line.unitCost)}</strong></article>)}</div></section><section className="job-detail-panel"><h2>Price breakdown</h2><div className="job-total-grid"><span>Flowers cost <b>{money(job.totals.stemCost)}</b></span><span>Materials cost <b>{money(job.totals.sundryCost)}</b></span><span>Built-in wastage <b>{money(job.totals.wastage)}</b></span><span>Labour <b>{money(job.totals.labour)}</b></span><span>Base cost <b>{money(job.totals.costSubtotal)}</b></span><span>Markup <b>{money(job.totals.markup)}</b></span><span>VAT <b>{money(job.totals.vat)}</b></span><span>Net profit <b>{money(job.totals.profit)}</b></span><strong>Total charged <b>{money(job.totals.grossTotal)}</b></strong></div></section><div className="job-detail-actions"><button className="button" onClick={() => showJobInvoice(job)}>Generate invoice</button>{!job.stockReturned && <button type="button" onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}<button className="delete-job-button" type="button" onClick={() => deleteWonJob(job.id)}>Delete job &amp; restore stock</button></div></section> : <p className="empty-state">This job could not be found.</p>; })() : <><p className="eyebrow">JOBS WON</p><h1>Your completed work</h1><div className="workspace-toolbar"><label htmlFor="job-search"><span>Search completed work</span><input id="job-search" type="search" value={jobSearch} onChange={event => setJobSearch(event.target.value)} placeholder="Client, contact or job type" /></label><p>{filteredJobs.length} of {data.jobs.length} job{data.jobs.length === 1 ? '' : 's'}</p></div><section className="records wide">{filteredJobs.length ? filteredJobs.map(job => <article key={job.id}><b>{job.clientName} — {job.occasion}</b><span>{job.lines.length} line{job.lines.length === 1 ? '' : 's'} · won {new Date(job.wonAt).toLocaleDateString('en-GB')}</span><strong>{money(job.totals.grossTotal)}</strong><button onClick={() => setSelectedJobId(job.id)}>Open full job →</button><button onClick={() => showJobInvoice(job)}>Generate invoice</button>{!job.stockReturned && <button onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}{job.stockReturned && <em>Stock returned</em>}</article>) : <p className="empty-state">{data.jobs.length ? `No completed work matches “${jobSearch}”.` : 'No jobs won yet.'}</p>}</section></>)}
      {tab === 'clients' && (selectedWeddingPlanId && weddingBuildDraft ? (() => { const plan = data.plans.find(item => item.id === selectedWeddingPlanId); const stockPlan = weddingBuildDraft.inventory.map(flower => { const required = weddingBuildDraft.arrangements.reduce((sum, arrangement) => sum + arrangement.quantity * arrangement.flowers.filter(item => item.inventoryId === flower.id).reduce((lineSum, item) => lineSum + item.stemsPerArrangement, 0), 0); const capacity = flower.stemsPerPurchase * flower.purchases; return { ...flower, required, capacity, leftover: capacity - required, cost: capacity * flower.costPerStem }; }); const flowerCost = stockPlan.reduce((sum, flower) => sum + flower.cost, 0); const wastageCost = stockPlan.reduce((sum, flower) => sum + Math.max(0, flower.leftover) * flower.costPerStem, 0); const materialCost = weddingBuildDraft.materials.reduce((sum, material) => sum + material.quantity * material.unitCost, 0); const baseCost = flowerCost + materialCost; const markup = baseCost * weddingBuildDraft.markupPercent / 100; const net = baseCost + markup; const netProfit = net - baseCost; const vat = net * weddingBuildDraft.vatRate / 100; const total = net + vat; return <section className="wedding-builder">
        <button className="back-button" onClick={closeWeddingBuilder}>← Back to {plan?.clientName || 'client'}’s profile</button>
        <header className="wedding-builder-header"><div><p className="eyebrow">WEDDING BUILD · STAGE TWO</p><h1>{plan?.clientName}’s flower builder</h1><p>Plan every arrangement, purchase enough stems, then set the wedding price.</p></div><button className="button" type="button" onClick={saveWeddingBuild}>Save wedding build</button></header>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">1. WEDDING INVENTORY PLAN</p><h2>Flowers to purchase</h2><p>Enter the cost per stem and how many stems arrive in each purchase. The plan calculates demand, surplus and wastage.</p></div><button type="button" onClick={addWeddingInventory}>+ Add flower</button></div>{stockPlan.length ? <div className="wedding-inventory-list">{stockPlan.map(flower => <article key={flower.id}><div className="wedding-inputs"><label>Flower<input value={flower.name} placeholder="e.g. White rose" onChange={event => updateWeddingInventory(flower.id, { name: event.target.value })} /></label><label>Cost / stem (£)<input type="number" min="0" step="0.01" value={flower.costPerStem} onChange={event => updateWeddingInventory(flower.id, { costPerStem: n(event.target.value) })} /></label><label>Stems per purchase<input type="number" min="1" value={flower.stemsPerPurchase} onChange={event => updateWeddingInventory(flower.id, { stemsPerPurchase: n(event.target.value) })} /></label><label>Purchases<input type="number" min="1" value={flower.purchases} onChange={event => updateWeddingInventory(flower.id, { purchases: n(event.target.value) })} /></label><button type="button" aria-label={`Remove ${flower.name || 'flower'}`} onClick={() => removeWeddingInventory(flower.id)}>×</button></div><div className="wedding-stock-summary"><span>Required <b>{flower.required} stems</b></span><span>Purchased <b>{flower.capacity} stems</b></span><span className={flower.leftover < 0 ? 'shortfall' : ''}>{flower.leftover < 0 ? 'Shortfall' : 'Wastage / left'} <b>{Math.abs(flower.leftover)} stems</b></span><span className="wastage-cost">Wastage cost <b>{money(Math.max(0, flower.leftover) * flower.costPerStem)}</b></span><strong>{money(flower.cost)} cost</strong></div></article>)}</div> : <p className="empty-state">Add the flowers you will buy for this wedding first.</p>}</section>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">2. ARRANGEMENT BUILDER</p><h2>Build each floral piece</h2><p>Add every bouquet, buttonhole, table arrangement and installation, then specify stems per piece.</p></div><button type="button" onClick={addWeddingArrangement}>+ Add arrangement</button></div>{weddingBuildDraft.arrangements.length ? <div className="arrangement-list">{weddingBuildDraft.arrangements.map(arrangement => <article key={arrangement.id}><div className="arrangement-heading"><label>Arrangement name<input value={arrangement.name} placeholder="e.g. Bridal bouquet" onChange={event => updateWeddingArrangement(arrangement.id, { name: event.target.value })} /></label><label>How many?<input type="number" min="1" value={arrangement.quantity} onChange={event => updateWeddingArrangement(arrangement.id, { quantity: n(event.target.value) })} /></label><button type="button" onClick={() => removeWeddingArrangement(arrangement.id)}>Remove arrangement</button></div>{arrangement.flowers.map(line => <div className="arrangement-flower" key={line.id}><select value={line.inventoryId || ''} onChange={event => { const flower = weddingBuildDraft.inventory.find(item => item.id === event.target.value); updateArrangementFlower(arrangement.id, line.id, { inventoryId: flower?.id || null, name: flower?.name || '' }); }}><option value="">Select a flower</option>{weddingBuildDraft.inventory.map(flower => <option key={flower.id} value={flower.id}>{flower.name || 'Unnamed flower'}</option>)}</select><label>Stems per arrangement<input type="number" min="0" value={line.stemsPerArrangement} onChange={event => updateArrangementFlower(arrangement.id, line.id, { stemsPerArrangement: n(event.target.value) })} /></label><button type="button" aria-label="Remove flower line" onClick={() => removeArrangementFlower(arrangement.id, line.id)}>×</button></div>)}<button className="add-flower-line" type="button" onClick={() => addArrangementFlower(arrangement.id)}>+ Add flower to this arrangement</button><label className="arrangement-notes">Notes<textarea value={arrangement.notes || ''} placeholder="Colour, shape, mechanics or special instructions" onChange={event => updateWeddingArrangement(arrangement.id, { notes: event.target.value })} /></label></article>)}</div> : <p className="empty-state">Add the arrangements you need to make for this wedding.</p>}</section>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">3. MATERIAL COSTS &amp; WEDDING PRICE</p><h2>Price the complete wedding</h2><p>Use the materials from the client brief and set costs, markup and VAT.</p></div></div>{weddingBuildDraft.materials.length ? <div className="wedding-material-costs">{weddingBuildDraft.materials.map(material => <div key={material.id}><b>{material.quantity} × {material.name}</b><label>Cost per unit (£)<input type="number" min="0" step="0.01" value={material.unitCost} onChange={event => updateWeddingMaterial(material.id, { unitCost: n(event.target.value) })} /></label><strong>{money(material.quantity * material.unitCost)}</strong></div>)}</div> : <p className="empty-state">No materials were added to the wedding brief. Add them in the planning stage if needed.</p>}<div className="wedding-price-grid"><label>Markup %<input type="number" min="0" value={weddingBuildDraft.markupPercent} onChange={event => setWeddingBuildDraft(current => current ? { ...current, markupPercent: n(event.target.value) } : current)} /></label><label>VAT %<input type="number" min="0" value={weddingBuildDraft.vatRate} onChange={event => setWeddingBuildDraft(current => current ? { ...current, vatRate: n(event.target.value) } : current)} /></label></div><div className="wedding-price-summary"><span>Flower purchases <b>{money(flowerCost)}</b></span><span>Expected flower wastage <b>{money(wastageCost)}</b></span><span>Materials <b>{money(materialCost)}</b></span><span>Base cost <b>{money(baseCost)}</b></span><span>Markup ({weddingBuildDraft.markupPercent}%) <b>{money(markup)}</b></span><span>VAT ({weddingBuildDraft.vatRate}%) <b>{money(vat)}</b></span><span className="wedding-profit">Net profit <b>{money(netProfit)}</b></span><strong>Wedding price <b>{money(total)}</b></strong></div></section>
      </section>; })() : selectedCustomer ? <section className="customer-profile">
        <button className="back-button" onClick={() => setSelectedCustomerId(null)}>← Back to client book</button>
        <header className="customer-profile-header"><div><p className="eyebrow">CUSTOMER PROFILE</p><h1>{selectedCustomer.name}</h1><p>{selectedCustomer.contact || 'No contact details yet'}</p></div><p>{selectedCustomer.notes || 'No customer notes saved yet.'}</p></header>
        <button className="delete-client-button" type="button" onClick={() => deleteCustomer(selectedCustomer)}>Delete client and records</button>
        <div className="customer-stat-grid"><article><small>PLANS</small><b>{selectedCustomerPlans.length}</b></article><article><small>JOBS PURCHASED</small><b>{selectedCustomerJobs.length}</b></article><article><small>SAVED QUOTES</small><b>{selectedCustomerQuotes.length}</b></article><article><small>TOTAL PURCHASED</small><b>{money(selectedCustomerJobs.reduce((sum, job) => sum + job.totals.grossTotal, 0))}</b></article></div>
        <section className="customer-profile-panel"><h2>Purchased work</h2>{selectedCustomerJobs.length ? selectedCustomerJobs.map(job => <article className="customer-purchase" key={job.id}><div><b>{job.occasion}</b><span>Won {new Date(job.wonAt).toLocaleDateString('en-GB')} {job.eventDate ? `· event ${new Date(job.eventDate).toLocaleDateString('en-GB')}` : ''}</span></div><strong>{money(job.totals.grossTotal)}</strong><ul>{job.lines.map(line => <li key={line.id}>{line.quantity} × {line.name} <span>{money(line.quantity * line.unitCost)}</span></li>)}</ul></article>) : <p className="empty-state">No completed purchases are saved for this customer yet.</p>}</section>
        <section className="customer-profile-panel"><h2>Saved quotes</h2>{selectedCustomerQuotes.length ? selectedCustomerQuotes.map(savedQuote => <article className="customer-purchase" key={savedQuote.id}><div><b>{savedQuote.occasion} quote</b><span>Created {new Date(savedQuote.createdAt).toLocaleDateString('en-GB')} · {savedQuote.lines.length} item{savedQuote.lines.length === 1 ? '' : 's'}</span></div><strong>{money(calculateTotals(savedQuote).grossTotal)}</strong>{savedQuote.notes && <p>{savedQuote.notes}</p>}</article>) : <p className="empty-state">No open or saved quotes for this customer.</p>}</section>
        <section className="customer-profile-panel"><h2>Plans &amp; inspiration</h2>{selectedCustomerPlans.length ? selectedCustomerPlans.map(plan => <article className="customer-plan-detail" key={plan.id}>
          <div className="plan-detail-heading"><div><p className="eyebrow">{plan.type} PLAN · {plan.status || 'Enquiry'}</p><h3>{plan.eventDate ? new Date(plan.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to confirm'}</h3></div>{plan.finishedEstimate !== null && plan.finishedEstimate !== undefined && <strong>{money(plan.finishedEstimate)}</strong>}</div>
          <dl><div><dt>{plan.type === 'Funeral' ? 'Service venue' : 'Venue'}</dt><dd>{plan.venue || 'To confirm'}</dd></div>{plan.type === 'Wedding' && <><div><dt>Height of the bride</dt><dd>{plan.brideHeight || 'To confirm'}</dd></div><div><dt>Tables</dt><dd>{plan.tableCount ?? 'To confirm'}</dd></div><div><dt>Size of main table</dt><dd>{plan.mainTableSize || 'To confirm'}</dd></div></>}{plan.type === 'Funeral' && <><div><dt>Person remembered</dt><dd>{plan.personRemembered || 'Not recorded'}</dd></div><div><dt>Service time</dt><dd>{plan.serviceTime || 'To confirm'}</dd></div><div><dt>Funeral director / delivery</dt><dd>{plan.funeralDirector || 'To confirm'}</dd></div><div><dt>Faith / family wishes</dt><dd>{plan.serviceWishes || 'None recorded'}</dd></div><div><dt>Card message</dt><dd>{plan.cardMessage || 'Not recorded'}</dd></div></>}{plan.type === 'Corporate' && <><div><dt>Event format</dt><dd>{plan.eventFormat || 'To confirm'}</dd></div><div><dt>Expected attendees</dt><dd>{plan.guestCount ?? 'To confirm'}</dd></div><div><dt>Tables</dt><dd>{plan.tableCount ?? 'To confirm'}</dd></div><div><dt>Table layout</dt><dd>{plan.mainTableSize || 'To confirm'}</dd></div><div><dt>Setup window</dt><dd>{plan.setupWindow || 'To confirm'}</dd></div><div><dt>Breakdown / collection</dt><dd>{plan.breakdownTime || 'To confirm'}</dd></div><div><dt>Venue restrictions</dt><dd>{plan.venueRestrictions || 'None recorded'}</dd></div></>}<div><dt>Comfortable budget</dt><dd>{plan.budget !== null && plan.budget !== undefined ? money(plan.budget) : 'To discuss'}</dd></div><div><dt>{plan.type === 'Corporate' ? 'Brand direction' : 'Palette'}</dt><dd>{plan.palette || 'To explore'}</dd></div><div><dt>{plan.type === 'Funeral' ? 'Meaningful flowers' : 'Flowers wanted'}</dt><dd>{plan.favouriteFlowers || 'Not recorded'}</dd></div><div><dt>Flowers to avoid</dt><dd>{plan.avoidFlowers || 'None noted'}</dd></div></dl>
          <div className="plan-detail-copy"><p><b>Arrangements needed</b>{plan.arrangements || 'Not recorded'}</p><p><b>Story, must-haves &amp; next steps</b>{plan.notes}</p></div>
          <div className="profile-materials"><h4>Materials needed</h4>{plan.materialsNeeded?.length ? plan.materialsNeeded.map(material => <div key={material.id}><span>{material.quantity} × {material.name}</span><select value={material.status} onChange={event => updateSavedPlanMaterial(plan.id, material.id, event.target.value as PlanMaterial['status'])}><option>Needed</option><option>In stock</option><option>Ordered</option><option>Ready</option></select></div>) : <p>No materials added to this plan.</p>}</div>
          <button className="generate-plan-invoice" type="button" onClick={() => showPlanInvoice(plan)}>Generate {plan.type.toLowerCase()} invoice</button>
          {plan.type === 'Wedding' && <button className="open-wedding-builder" type="button" onClick={() => openWeddingBuilder(plan)}>Open wedding flower builder &amp; pricing →</button>}
          <div className="profile-reference-board"><h4>Client reference images</h4>{plan.references?.length ? <div>{plan.references.map(reference => <figure key={reference.id}><button className="reference-preview" type="button" onClick={() => setActiveReference(reference)} aria-label={`Enlarge ${reference.caption || reference.name}`}><Image src={reference.dataUrl} alt={reference.caption || reference.name} width={210} height={158} unoptimized /></button><figcaption>{reference.caption || reference.name}<span>Click to enlarge</span></figcaption></figure>)}</div> : <p>No reference images added to this plan.</p>}</div>
        </article>) : <p className="empty-state">No planning brief has been saved for this customer yet.</p>}</section>
      </section> : <><p className="eyebrow">CUSTOMER DATABASE</p><h1>Your client book</h1><div className="workspace-toolbar"><label htmlFor="client-search"><span>Search clients</span><input id="client-search" type="search" value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Name, contact or notes" /></label><p>{filteredCustomers.length} of {data.customers.length} client{data.customers.length === 1 ? '' : 's'}</p></div><section className="client-directory">{filteredCustomers.map(customer => { const clientPlans = data.plans.filter(plan => plan.clientName.toLocaleLowerCase() === customer.name.toLocaleLowerCase()); const clientJobs = data.jobs.filter(job => job.clientName.toLocaleLowerCase() === customer.name.toLocaleLowerCase()); return <button type="button" className="client-card" key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}><p className="eyebrow">{clientPlans.length} plan{clientPlans.length === 1 ? '' : 's'} · {clientJobs.length} job{clientJobs.length === 1 ? '' : 's'}</p><h2>{customer.name}</h2><span>{customer.contact || 'No contact details yet'}</span><p>{customer.notes || 'No notes saved yet.'}</p>{clientPlans.slice(0, 2).map(plan => <small key={plan.id}>{plan.type}: {plan.eventDate || 'date to confirm'} {plan.status ? `· ${plan.status}` : ''}</small>)}<em>Open full profile →</em></button>})}</section>{data.customers.length === 0 ? <p className="empty-state">Clients are added automatically when you save a quote, job or planning brief.</p> : filteredCustomers.length === 0 && <p className="empty-state">No client matches “{clientSearch}”.</p>}</>) }
      {tab === 'settings' && <><p className="eyebrow">STUDIO SETTINGS</p><h1>Materials &amp; pricing</h1><form className="panel-form settings-pricing" onSubmit={saveDefaultMarkup}><h2>Pricing defaults</h2><p>Set the starting markup for new bouquet quotes and wedding builds. Each individual job can still be adjusted.</p><label>Default markup (%)<input name="defaultMarkup" type="number" min="0" step="1" defaultValue={data.settings.defaultMarkup} /></label><button className="button" disabled={saving}>Save default markup</button></form><div className="settings-grid"><form className="panel-form" onSubmit={addMaterial}><h2>Add a material or extra</h2><label>Name<input name="name" required placeholder="e.g. Ivory satin ribbon" /></label><label>Category<input name="category" placeholder="e.g. Packaging" /></label><label>Unit<select name="unit" defaultValue="each"><option>each</option><option>metre</option><option>pack</option><option>vase</option></select></label><label>Cost per unit (£)<input name="cost" required type="number" min="0" step="0.01" /></label><button className="button" disabled={saving}>Add material</button></form><section className="records"><h2>Material price list</h2>{data.materials.map(material => <article key={material.id}><b>{material.name}</b><span>{material.category} · {money(material.unitCost)} / {material.unit}</span><button onClick={() => removeMaterial(material.id)}>Remove</button></article>) || <p>No materials yet. Add ribbon, containers, packaging and delivery extras here.</p>}</section></div></>}
    </section>}
    {invoicePreview && <div className="invoice-overlay" role="dialog" aria-modal="true" aria-label="Invoice preview" onClick={() => setInvoicePreview(null)}><section className="invoice-sheet" onClick={event => event.stopPropagation()}><div className="invoice-actions"><button type="button" onClick={() => setInvoicePreview(null)}>Close</button><button className="button" type="button" onClick={() => globalThis.print()}>Print / save PDF</button></div><header><div><p>BRAMBLE &amp; PETAL</p><h1>Florist Studio</h1><span>Thoughtful flowers for every occasion</span></div><div><p className="eyebrow">INVOICE</p><b>{invoicePreview.number}</b><span>{new Date(invoicePreview.date).toLocaleDateString('en-GB')}</span></div></header><div className="invoice-client"><div><small>BILLED TO</small><b>{invoicePreview.clientName}</b><span>{invoicePreview.contact || 'Contact details to follow'}</span></div><div><small>FOR</small><b>{invoicePreview.occasion}</b><span>Bespoke floral design</span></div></div><table><thead><tr><th>Description</th><th>Quantity</th><th>Total</th></tr></thead><tbody>{invoicePreview.lines.map((line, index) => <tr key={`${line.description}-${index}`}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.total)}</td></tr>)}</tbody></table><div className="invoice-totals"><span>Subtotal <b>{money(invoicePreview.subtotal)}</b></span><span>VAT <b>{money(invoicePreview.vat)}</b></span><strong>Total due <b>{money(invoicePreview.total)}</b></strong></div><footer>Thank you for choosing Bramble &amp; Petal Florist Studio.</footer></section></div>}
    {activeReference && <div className="reference-lightbox" role="dialog" aria-modal="true" aria-label="Reference image preview" onClick={() => setActiveReference(null)}><section onClick={event => event.stopPropagation()}><button className="lightbox-close" type="button" onClick={() => setActiveReference(null)} aria-label="Close image preview">×</button><Image src={activeReference.dataUrl} alt={activeReference.caption || activeReference.name} width={900} height={675} unoptimized /><p>{activeReference.caption || activeReference.name}</p></section></div>}
  </main>;
}
