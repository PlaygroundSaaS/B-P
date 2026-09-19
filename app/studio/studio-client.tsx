'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import Dialog from '../dialog';
import StudioInsights from './studio-insights';
import SetupOptions from './setup-options';
import { emptyOperations, type StudioCommand, type InspirationSelection, type EventDetails } from '@/lib/operations-types';
import { newRecipe } from '@/lib/operations-model';
import { Fields } from './ops-ui';
import StudioHome, { EventDirectory } from './studio-home';
import StudioNavigation, { StudioGateway } from './studio-navigation';
import { CatalogueBrowse } from './inspiration-catalogue';
import { recipeProfitInput } from '@/lib/profitability';
import { clientNameKey, saveQuoteToData, winQuote, weddingTotals } from '@/lib/studio-operations';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { calculateTotals, DEFAULT_SETTINGS, money } from '@/lib/pricing';
import type { Customer, InventoryItem, Material, PlanMaterial, PlanReferenceImage, Quote, QuoteLine, StudioData, WeddingSetupOption, WeddingArrangement, WeddingBuild, WeddingInventoryFlower, WastageRecord, WeddingPlan } from '@/lib/types';

const CustomerTimeline = dynamic(() => import('./customer-timeline'));
const InventoryDetails = dynamic(() => import('./inventory-details'));
const RecipeBuilder = dynamic(() => import('./recipe-builder'));
const EventWorkspace = dynamic(() => import('./event-workspace'));
const InspirationCatalogue = dynamic(() => import('./inspiration-catalogue'));
const OperationsHub = dynamic(() => import('./operations-hub'));
const BusinessDashboard = dynamic(() => import('./business-dashboard'));
const ProfitabilityPanel = dynamic(() => import('./profitability-panel'));
const GlobalSearch = dynamic(() => import('./global-search'));
const SupplierInvoiceImport = dynamic(() => import('./supplier-invoice-import'));

const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const initialData = (): StudioData => ({ version: 1, inventory: [], wastage: [], materials: [], customers: [], quotes: [], jobs: [], plans: [], weddingBuilds: [], settings: DEFAULT_SETTINGS });
const normaliseData = (value: Partial<StudioData>): StudioData => ({ ...initialData(), ...value, operations: { ...emptyOperations(), ...value.operations }, inventory: value.inventory || [], wastage: value.wastage || [], materials: value.materials || [], customers: value.customers || [], quotes: value.quotes || [], jobs: value.jobs || [], plans: value.plans || [], weddingBuilds: value.weddingBuilds || [], settings: { ...DEFAULT_SETTINGS, ...value.settings } });
const hasStudioRecords = (value: StudioData) => value.inventory.length + value.wastage.length + value.materials.length + value.customers.length + value.quotes.length + value.jobs.length + value.plans.length + value.weddingBuilds.length > 0;
const blankQuote = (settings: StudioData['settings']): Quote => ({ id: id(), name: '', quantity: 1, status: 'DRAFT', clientName: '', contact: '', occasion: 'Bouquet', eventDate: '', lines: [], labourHours: 0, labourRate: settings.labourRate, wastagePercent: settings.defaultWastage, markupPercent: settings.defaultMarkup, deliveryFee: 0, discount: 0, vatApplies: true, vatRate: settings.vatRate, notes: '', createdAt: new Date().toISOString() });
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
  const workspaceNav = useRef<HTMLElement>(null);
  const [data, setData] = useState<StudioData>(initialData);
  const [quote, setQuote] = useState<Quote>(blankQuote(DEFAULT_SETTINGS));
  const [screen, setScreenValue] = useState<'choose' | 'business' | 'client'>('choose');
  const [newClientDraft, setNewClientDraft] = useState<Customer | null>(null);
  const [tab, setTabValue] = useState<'dashboard' | 'events' | 'funerals' | 'financial' | 'templates' | 'inventory' | 'calculator' | 'jobs' | 'clients' | 'settings' | 'insights' | 'catalogue' | 'production' | 'suppliers' | 'deliveries' | 'hire' | 'payments' | 'reports' | 'calendar' | 'leads' | 'tasks' | 'recurring' | 'assistant' | 'activity'>('dashboard');
  const [clientType, setClientTypeValue] = useState<'Wedding' | 'Funeral' | 'Corporate'>('Wedding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const invoiceInFlight = useRef(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [invoiceToolsOpen, setInvoiceToolsOpen] = useState(false);
  const [planSetupOptions, setPlanSetupOptions] = useState<WeddingSetupOption[]>([]);
  const [setupEditor, setSetupEditor] = useState<{ planId?: string; client: string; options: WeddingSetupOption[]; presentation: boolean } | null>(null);
  const [setupDirty, setSetupDirty] = useState(false);
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
  const [error, setErrorValue] = useState('');
  const setError = (value: string) => { setErrorValue(value); window.dispatchEvent(new CustomEvent('studio-save-error', { detail: value })); };
  const [inventorySearch, setInventorySearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [saveState, setSaveState] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready');
  const [databaseRevision, setDatabaseRevision] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const plannerDirty = useRef(false);
  const workspaceDirty = useRef(false);
  const [eventDraft, setEventDraft] = useState<WeddingPlan | null>(null);
  const [planInspiration, setPlanInspiration] = useState<InspirationSelection[]>([]);
  const [planDetails, setPlanDetails] = useState<EventDetails>({});
  const revisionRef = useRef(databaseRevision); revisionRef.current = databaseRevision;
  const invoiceDirty = useRef(false);
  const quoteDirty = !!(quote.clientName || quote.lines.length) && JSON.stringify(quote) !== JSON.stringify([...data.quotes, ...data.jobs].find(item => item.id === quote.id));
  const buildDirty = !!weddingBuildDraft && JSON.stringify(weddingBuildDraft) !== JSON.stringify(data.weddingBuilds.find(item => item.planId === weddingBuildDraft.planId));
  const canNavigate = () => {
    if (saveInFlight.current || invoiceInFlight.current) { setError('Please wait for the current save to finish.'); return false; }
    if ((plannerDirty.current || invoiceDirty.current || buildDirty || workspaceDirty.current || quoteDirty) && !globalThis.confirm('Leave unsaved changes? Cancel to stay here and save them first.')) return false;
    plannerDirty.current = false; invoiceDirty.current = false; workspaceDirty.current = false;
    return true;
  };
  const canNavigateRef = useRef(canNavigate); canNavigateRef.current = canNavigate;
  const navigationLocation = useRef('');
  const updateLocation = (space: typeof screen, section = tab, type = clientType) => {
    const url = new URL(window.location.href);
    if (space !== 'business' || section !== 'inventory') url.searchParams.delete('supplierInvoice');
    url.hash = space === 'choose' ? '' : `${space}/${space === 'business' ? section : type.toLowerCase()}`;
    window.history.pushState(window.history.state, '', url); navigationLocation.current = url.href;
  };
  const setScreen = (space: typeof screen) => { if (!canNavigate()) return; if (screen === 'client') { setPlanReferences([]); setPlanMaterials([]); setPlanSetupOptions([]); setPlanInspiration([]); setPlanDetails({}); } setScreenValue(space); setEventDraft(null); setSelectedWeddingPlanId(null); setWeddingBuildDraft(null); updateLocation(space); window.scrollTo(0, 0); };
  const setTab = (section: typeof tab) => { if ((section === tab && !eventDraft && !(section === 'clients' && selectedCustomerId)) || !canNavigate()) return; setSelectedCustomerId(null); setTabValue(section); setEventDraft(null); setSelectedWeddingPlanId(null); setWeddingBuildDraft(null); updateLocation(screen, section); window.scrollTo(0, 0); };
  const setClientType = (type: typeof clientType) => { if (type === clientType || !canNavigate()) return; setPlanReferences([]); setPlanMaterials([]); setPlanSetupOptions([]); setPlanInspiration([]); setPlanDetails({}); setClientTypeValue(type); updateLocation(screen, tab, type); };

  useEffect(() => {
    const restore = () => {
      const [space, section] = window.location.hash.slice(1).split('/');
      if (space === 'business') {
        setScreenValue('business');
        if (['dashboard', 'events', 'funerals', 'financial', 'templates', 'inventory', 'calculator', 'jobs', 'clients', 'settings', 'insights', 'catalogue', 'production', 'suppliers', 'deliveries', 'hire', 'payments', 'reports', 'calendar', 'leads', 'tasks', 'recurring', 'assistant', 'activity'].includes(section)) setTabValue(section as typeof tab);
      } else if (space === 'client') {
        setScreenValue('client');
        const type = ['Wedding', 'Funeral', 'Corporate'].find(item => item.toLowerCase() === section);
        if (type) setClientTypeValue(type as typeof clientType);
      } else setScreenValue('choose');
    };
    restore(); navigationLocation.current = window.location.href;
    const onBack = () => {
      if (!canNavigateRef.current()) { window.history.pushState(window.history.state, '', navigationLocation.current); return; }
      setSelectedWeddingPlanId(null); setWeddingBuildDraft(null); restore(); navigationLocation.current = window.location.href;
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (saving || quoteDirty || buildDirty || plannerDirty.current || setupDirty || workspaceDirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving, quoteDirty, buildDirty, setupDirty]);

  const refreshRecords = async () => {
    if (saveInFlight.current || invoiceInFlight.current) return;
    setRefreshing(true);
    try {
      const response = await fetch('/api/studio', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.data) throw new Error(payload.error || 'Saved records could not be loaded.');
      setData(normaliseData(payload.data)); setDatabaseRevision(payload.updatedAt ?? null);
      setDataLoaded(true); setNeedsRefresh(false); setSaveState('saved'); setError('');
      setMessage('Latest saved records loaded. Your open drafts are still here.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setRefreshing(false); }
  };

  useEffect(() => { workspaceNav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [screen, tab, clientType, loading]);

  const signOut = async () => {
    if (!canNavigate()) return;
    if (quoteDirty && !globalThis.confirm('Sign out with an unsaved quote? Cancel to save it first.')) return;
    try {
      const response = await fetch('/api/studio/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign out failed. Please try again.');
      globalThis.location.assign('/studio');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sign out failed.'); }
  };

  useEffect(() => {
    if (new URL(globalThis.location.href).searchParams.has('supplierInvoice')) {
      setScreenValue('business'); setTabValue('inventory'); setInvoiceToolsOpen(true);
    }
    let saved: string | null = null;
    try { saved = globalThis.localStorage.getItem('bramble-petal-studio-data'); } catch { /* Storage may be disabled; the database still works. */ }
    let localData: StudioData | null = null;
    if (saved) {
      try {
        localData = normaliseData(JSON.parse(saved) as Partial<StudioData>);
      } catch { /* Leave unreadable local backup intact. */ }
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
        if (!localData || !hasStudioRecords(localData) || !hasStudioRecords(databaseData)) {
          try { globalThis.localStorage.removeItem('bramble-petal-studio-data'); } catch { /* Optional legacy storage. */ }
        }
        setSaveState('saved'); setDataLoaded(true);
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
    if (!message) return;
    const timer = globalThis.setTimeout(() => setMessage(''), 6000);
    return () => globalThis.clearTimeout(timer);
  }, [message]);

  const persist = async (next: StudioData, success: string) => {
    if (saveInFlight.current || invoiceInFlight.current) { setError('Please wait for the current save to finish.'); return false; }
    if (!dataLoaded || needsRefresh) { setError('Load the latest saved records before saving again. Your draft is still here.'); return false; }
    saveInFlight.current = true;
    setSaving(true); setSaveState('saving'); setError('');
    try {
      const response = await fetch('/api/studio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: next, expectedUpdatedAt: revisionRef.current, operationId: id() }),
      });
      const payload = await response.json() as { data?: StudioData; error?: string; updatedAt?: string };
      if (!response.ok) throw new Error(payload.error || 'The database save failed.');
      setDatabaseRevision(payload.updatedAt ?? null);
      setData(payload.data ? normaliseData(payload.data) : next); revisionRef.current = payload.updatedAt ?? null; workspaceDirty.current = false;
      setMessage(success);
      setSaveState('saved');
      return true;
    } catch (caught) {
      setError(`${caught instanceof Error ? caught.message : 'The save could not be confirmed.'} Your draft is still here. Load the latest records before trying again.`);
      setSaveState('error'); setNeedsRefresh(true);
      return false;
    }
    finally { saveInFlight.current = false; setSaving(false); }
  };
  const runCommand = async (command: StudioCommand): Promise<StudioData | null> => {
    if (saveInFlight.current || needsRefresh) { setError('Load the latest records and wait for any current save before continuing.'); return null; }
    saveInFlight.current = true; setSaving(true); setSaveState('saving'); setError('');
    const operationId = id();
    try {
      const body = JSON.stringify({ command, operationId, expectedUpdatedAt: revisionRef.current });
      let response: Response;
      try { response = await fetch('/api/studio/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); }
      catch { response = await fetch('/api/studio/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); }
      const payload = await response.json();
      if (!response.ok) { if (response.status === 409 || response.status >= 500) setNeedsRefresh(true); throw new Error(payload.error || 'This action could not be saved.'); }
      const next = normaliseData(payload.data); revisionRef.current = payload.updatedAt;
      setDatabaseRevision(payload.updatedAt); setData(next); setSaveState('saved'); workspaceDirty.current = false;
      setMessage(payload.alreadyApplied ? 'This action was already saved. No duplicate change was made.' : 'Saved to the Studio.'); return next;
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save. Your draft is still here.'); setSaveState('error'); return null; }
    finally { saveInFlight.current = false; setSaving(false); }
  };
  const openRecord = (section: string, recordId?: string) => {
    if (!canNavigate()) return;
    setScreenValue('business'); setEventDraft(null); setTabValue(section as typeof tab); updateLocation('business', section as typeof tab);
    if (section === 'clients' && recordId) {
      const plan = data.plans.find(p => p.id === recordId);
      if (plan) setEventDraft(plan); else setSelectedCustomerId(recordId);
    }
    if (section === 'calculator' && recordId) { const found = [...data.quotes, ...data.jobs].find(r => r.id === recordId); if (found) setQuote(structuredClone(found)); }
    window.scrollTo(0, 0);
  };
  const openRecipe = (recipe: Quote) => { workspaceDirty.current = false; setEventDraft(null); setQuote(recipe); setScreenValue('business'); setTabValue('calculator'); updateLocation('business', 'calculator'); window.scrollTo(0, 0); };
  const startEvent = (type: WeddingPlan['type']) => { if (!canNavigate()) return; const plan: WeddingPlan = { id: id(), clientName: '', type, eventDate: '', notes: '', finishedEstimate: null, status: 'Enquiry', createdAt: new Date().toISOString() }; setScreenValue('business'); setTabValue(type === 'Funeral' ? 'funerals' : 'events'); setEventDraft(plan); updateLocation('business', type === 'Funeral' ? 'funerals' : 'events'); window.scrollTo(0, 0); };
  const startRecipe = () => { if (canNavigate()) openRecipe(newRecipe(data)); };
  const startClient = () => { if (canNavigate()) setNewClientDraft({ id: id(), name: '', contact: '', notes: '', createdAt: new Date().toISOString() }); };
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

  const addInventory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const item: InventoryItem = { id: id(), name: String(form.get('name') || ''), colour: String(form.get('colour') || ''), costPerStem: n(String(form.get('cost'))), stemsPurchased: n(String(form.get('stems'))), stemsRemaining: n(String(form.get('stems'))) };
    item.name = item.name.trim();
    if (!item.name || item.costPerStem < 0 || !Number.isInteger(item.stemsRemaining) || item.stemsRemaining <= 0) return setError('Add a flower name and the number of stems.');
    if (await persist({ ...data, inventory: [item, ...data.inventory] }, 'Flower stock added.')) { formElement.reset(); setShowInventoryForm(false); }
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
  const recordWastage = async () => {
    const item = data.inventory.find(stock => stock.id === wastageItemId);
    const quantity = Math.floor(wastageQuantity);
    if (!item || quantity < 1 || quantity > item.stemsRemaining) return setError(`Enter between 1 and ${item?.stemsRemaining || 0} stems.`);
    const record: WastageRecord = { id: id(), inventoryId: item.id, name: item.name, quantity, unitCost: item.costPerStem, reason: wastageReason.trim(), stockUnit: item.stockUnit || 'stem', recordedAt: new Date().toISOString() };
    const next: StudioData = { ...data, inventory: data.inventory.map(stock => stock.id === item.id ? { ...stock, stemsRemaining: stock.stemsRemaining - quantity } : stock), wastage: [record, ...data.wastage] };
    if (await persist(next, `${quantity} ${item.name} logged as wastage — ${money(quantity * item.costPerStem)} loss recorded.`)) { setWastageItemId(null); setWastageReason(''); }
  };
  const addMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const material: Material = { id: id(), name: String(form.get('name') || ''), category: String(form.get('category') || 'General'), unit: String(form.get('unit') || 'each'), unitCost: n(String(form.get('cost'))) };
    material.name = material.name.trim();
    if (!material.name || material.unitCost < 0) return setError('Add a material name.');
    if (await persist({ ...data, materials: [material, ...data.materials] }, 'Material added to the calculator list.')) formElement.reset();
  };
  const removeMaterial = (materialId: string) => void persist({ ...data, materials: data.materials.filter(material => material.id !== materialId) }, 'Material removed.');
  const saveDefaultMarkup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const settings = { defaultMarkup: n(String(form.get('defaultMarkup'))), defaultWastage: n(String(form.get('defaultWastage'))), labourRate: n(String(form.get('labourRate'))), vatRate: n(String(form.get('vatRate'))), corporationTaxRate: n(String(form.get('corporationTaxRate'))) };
    if (Object.values(settings).some(value => value < 0)) return setError('Pricing defaults must be zero or more.');
    if (await persist({ ...data, settings }, 'Pricing defaults saved. New quotes and wedding builds will use them.')) {
      if (!quote.clientName && !quote.lines.length) setQuote(blankQuote(settings));
    }
  };
  const addOrUpdateCustomer = (source: StudioData, name: string, contact = '', notes = ''): StudioData => {
    const cleanName = name.trim();
    if (!cleanName) return source;
    const existing = source.customers.find(customer => clientNameKey(customer.name) === clientNameKey(cleanName));
    const customers: Customer[] = existing ? source.customers.map(customer => customer.id === existing.id ? { ...customer, contact: contact || customer.contact, notes: notes || customer.notes } : customer) : [{ id: id(), name: cleanName, contact, notes, createdAt: new Date().toISOString() }, ...source.customers];
    return { ...source, customers };
  };
  const deleteCustomer = async (customer: Customer) => {
    const name = clientNameKey(customer.name);
    if (!globalThis.confirm(`Delete ${customer.name} and all of their saved quotes, completed jobs and planning briefs? This cannot be undone.`)) return;
    const next: StudioData = {
      ...data,
      customers: data.customers.filter(item => item.id !== customer.id),
      quotes: data.quotes.filter(item => clientNameKey(item.clientName) !== name),
      jobs: data.jobs.filter(item => clientNameKey(item.clientName) !== name),
      plans: data.plans.filter(item => clientNameKey(item.clientName) !== name),
      weddingBuilds: data.weddingBuilds.filter(item => clientNameKey(item.clientName) !== name),
    };
    if (await persist(next, `${customer.name} and their saved records have been deleted.`)) setSelectedCustomerId(null);
  };
  const addFlowerLine = () => {
    const flower = data.inventory.find(item => item.stemsRemaining > 0);
    if (!flower) return setError('Add flowers to inventory before building a quote.');
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: flower.id, name: flower.name, category: 'stem', stockUnit: flower.stockUnit || 'stem', quantity: 1, unitCost: flower.costPerStem }] }));
  };
  const addMaterialLine = () => {
    const material = data.materials[0];
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: null, name: material?.name || '', category: 'sundry', quantity: 1, unitCost: material?.unitCost || 0 }] }));
  };
  const updateQuoteLine = (lineId: string, changes: Partial<QuoteLine>) => setQuote(current => ({ ...current, lines: current.lines.map(line => line.id === lineId ? { ...line, ...changes } : line) }));
  const chooseFlower = (lineId: string, inventoryId: string) => {
    const flower = data.inventory.find(item => item.id === inventoryId);
    if (flower) updateQuoteLine(lineId, { inventoryId: flower.id, name: flower.name, stockUnit: flower.stockUnit || 'stem', unitCost: flower.costPerStem });
  };
  const chooseMaterial = (lineId: string, materialId: string) => {
    const material = data.materials.find(item => item.id === materialId);
    if (material) updateQuoteLine(lineId, { name: material.name, unitCost: material.unitCost });
  };
  const removeQuoteLine = (lineId: string) => setQuote(current => ({ ...current, lines: current.lines.filter(line => line.id !== lineId) }));
  const saveQuote = async () => {
    try {
      const next = saveQuoteToData(data, quote);
      if (await persist(addOrUpdateCustomer(next, quote.clientName, quote.contact, quote.notes), 'Quote saved. Stock is unchanged.')) setQuote(next.quotes[0]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Check the quote details.'); }
  };
  const winJob = async () => { openRecipe(quote); };
  const returnStock = async (jobId: string) => {
    const reason = globalThis.prompt('Reason for cancelling this order and returning unused stock:');
    if (reason) await runCommand({ type: 'returnRecipe', recipeId: jobId, reason });
  };
  const deleteWonJob = async (jobId: string) => { await returnStock(jobId); };
  const addPlanReferences = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - planReferences.length));
    event.target.value = '';
    if (selected.length === 0) return;
    try {
      const prepared = await Promise.all(selected.map(makePlanReference));
      setPlanReferences(current => [...current, ...prepared].slice(0, 8)); plannerDirty.current = true;
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
  const closeWeddingBuilder = () => { if (!canNavigate()) return; setSelectedWeddingPlanId(null); setWeddingBuildDraft(null); };
  const saveWeddingBuild = async () => {
    if (!weddingBuildDraft) return;
    const nextBuild = { ...weddingBuildDraft, updatedAt: new Date().toISOString() };
    const next = { ...data, weddingBuilds: data.weddingBuilds.some(build => build.planId === nextBuild.planId) ? data.weddingBuilds.map(build => build.planId === nextBuild.planId ? nextBuild : build) : [nextBuild, ...data.weddingBuilds] };
    if (await persist(next, 'Wedding build, flower inventory plan and pricing saved.')) setWeddingBuildDraft(nextBuild);
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
    if (data.operations?.eventQuotes.some(quote => quote.recipeIds.includes(job.id))) { setError('This recipe belongs to a combined event quotation. Open its event workspace to issue the complete invoice.'); return; }
    setInvoicePreview({ number: `BP-${job.id.slice(0, 8).toUpperCase()}`, clientName: job.clientName, contact: job.contact, occasion: job.occasion, date: job.eventDate || job.wonAt, lines: [{ description: job.occasion === 'Bouquet' ? 'Bespoke bouquet' : `${job.occasion} floral arrangement`, quantity: 1, total: job.totals.netTotal }], subtotal: job.totals.grossTotal - job.totals.vat, vat: job.totals.vat, total: job.totals.grossTotal });
  };
  const showPlanInvoice = (plan: WeddingPlan) => {
    const build = data.weddingBuilds.find(item => item.planId === plan.id);
    if (!build) { const total = plan.finishedEstimate || 0; return setInvoicePreview({ number: `BP-${plan.id.slice(0, 8).toUpperCase()}`, clientName: plan.clientName, contact: plan.contact, occasion: plan.type, date: plan.eventDate || plan.createdAt, lines: [{ description: `${plan.type} floral plan`, quantity: 1, total }], subtotal: total, vat: 0, total }); }
    const price = weddingTotals(build);
    const descriptions = build.arrangements.map(item => `${item.quantity} × ${item.name || 'floral arrangement'}`).join(', ');
    setInvoicePreview({ number: `BP-${plan.id.slice(0, 8).toUpperCase()}`, clientName: plan.clientName, contact: plan.contact, occasion: plan.type, date: plan.eventDate || plan.createdAt, lines: [{ description: descriptions || `${plan.type} floral design`, quantity: 1, total: price.net }], subtotal: price.net, vat: price.vat, total: price.total });
  };

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const plan: WeddingPlan = { id: id(), inspiration: planInspiration, details: planDetails, clientName: String(form.get('clientName') || ''), contact: String(form.get('contact') || ''), type: clientType, eventDate: String(form.get('eventDate') || ''), venue: String(form.get('venue') || ''), brideHeight: String(form.get('brideHeight') || ''), tableCount: form.get('tableCount') ? n(String(form.get('tableCount'))) : null, mainTableSize: String(form.get('mainTableSize') || ''), personRemembered: String(form.get('personRemembered') || ''), serviceTime: String(form.get('serviceTime') || ''), funeralDirector: String(form.get('funeralDirector') || ''), serviceWishes: String(form.get('serviceWishes') || ''), cardMessage: String(form.get('cardMessage') || ''), eventFormat: String(form.get('eventFormat') || ''), guestCount: form.get('guestCount') ? n(String(form.get('guestCount'))) : null, setupWindow: String(form.get('setupWindow') || ''), breakdownTime: String(form.get('breakdownTime') || ''), venueRestrictions: String(form.get('venueRestrictions') || ''), budget: form.get('budget') ? n(String(form.get('budget'))) : null, palette: String(form.get('palette') || ''), favouriteFlowers: String(form.get('favouriteFlowers') || ''), avoidFlowers: String(form.get('avoidFlowers') || ''), arrangements: String(form.get('arrangements') || ''), notes: String(form.get('notes') || ''), status: String(form.get('status') || 'Enquiry') as WeddingPlan['status'], finishedEstimate: form.get('estimate') ? n(String(form.get('estimate'))) : null, references: planReferences, materialsNeeded: planMaterials, setupOptions: clientType === 'Wedding' ? planSetupOptions : [], createdAt: new Date().toISOString() };
    plan.clientName = plan.clientName.trim(); plan.notes = plan.notes.trim();
    if (plan.setupOptions?.some(option => !option.title.trim())) return setError('Give every setup option a name before saving the plan.');
    if (!plan.clientName) return setError('Add a client name.');
    if (await persist(addOrUpdateCustomer({ ...data, plans: [plan, ...data.plans] }, plan.clientName, plan.contact, plan.notes), 'Client plan saved to their customer record.')) {
      formElement.reset(); setPlanInspiration([]); setPlanDetails({}); setPlanSetupOptions([]); setPlanReferences([]); setPlanMaterials([]); setPlanMaterialName(''); setPlanMaterialQuantity(1); plannerDirty.current = false;
    }
  };

  if (!loading && !dataLoaded) return <main className="login-screen"><section className="panel-form"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Let’s reconnect</h1><p role="alert">{error || 'Your saved records could not be loaded.'}</p><button className="button" disabled={refreshing} onClick={() => void refreshRecords()}>{refreshing ? 'Connecting…' : 'Try again'}</button><a className="studio-home-link" href="/">← Back to the website</a></section></main>;
  if (loading) return <main className="loading" role="status">Preparing your Studio…</main>;
  if (screen === 'choose') return <StudioGateway enter={setScreen} signOut={() => void signOut()} saveState={saveState} />;

  const selectedCustomer = selectedCustomerId ? data.customers.find(customer => customer.id === selectedCustomerId) || null : null;
  const selectedCustomerPlans = selectedCustomer ? data.plans.filter(plan => clientNameKey(plan.clientName) === clientNameKey(selectedCustomer.name)) : [];
  const selectedCustomerJobs = selectedCustomer ? data.jobs.filter(job => clientNameKey(job.clientName) === clientNameKey(selectedCustomer.name)) : [];
  const selectedCustomerQuotes = selectedCustomer ? data.quotes.filter(savedQuote => clientNameKey(savedQuote.clientName) === clientNameKey(selectedCustomer.name)) : [];
  return <main className={`studio-shell atelier-studio atelier-${screen}`}>{newClientDraft && <Dialog className="ops-confirm-dialog" label="New client" onClose={() => { if (!newClientDraft.name && !newClientDraft.contact || globalThis.confirm('Discard this new client?')) setNewClientDraft(null); }}><form className="ops-panel" onSubmit={async e => { e.preventDefault(); const customer = { ...newClientDraft, name: newClientDraft.name.trim() }; if (!customer.name) return; if (await persist({ ...data, customers: [customer, ...data.customers] }, 'Client saved.')) { setNewClientDraft(null); setSelectedCustomerId(customer.id); setTabValue('clients'); updateLocation('business','clients'); } }}><h2>A new conversation</h2><Fields value={newClientDraft} onChange={setNewClientDraft} fields={[{key:'name',label:'Client name',required:true},{key:'contact',label:'Phone or email'}]} /><button className="button" disabled={saving}>Save client</button></form></Dialog>}<StudioNavigation mode={screen} tab={tab} busy={saving || invoiceBusy} saveState={saveState} onMode={setScreen} navigate={section => setTab(section as typeof tab)} signOut={() => void signOut()} search={<GlobalSearch data={data} open={openRecord} />} clientNavigation={<nav ref={workspaceNav} aria-label="Planning type">{(['Wedding', 'Funeral', 'Corporate'] as const).map(type => <button type="button" aria-current={clientType === type ? 'page' : undefined} key={type} onClick={() => setClientType(type)}>{type}</button>)}</nav>} actions={[
      { label: 'New Wedding', icon: 'events', run: () => startEvent('Wedding') },
      { label: 'New Funeral', icon: 'flower', run: () => startEvent('Funeral') },
      { label: 'New Corporate Event', icon: 'studio', run: () => startEvent('Corporate') },
      { label: 'New Client', icon: 'clients', run: startClient },
      { label: 'Create Recipe', icon: 'flower', run: startRecipe },
      { label: 'Add Supplier Invoice', icon: 'orders', run: () => { if (canNavigate()) { setTabValue('inventory'); setInvoiceToolsOpen(true); updateLocation('business','inventory'); } } },
      { label: 'Record Wastage', icon: 'waste', run: () => setTab('inventory') },
      { label: 'Create Delivery', icon: 'delivery', run: () => setTab('deliveries') },
    ]} />
    {message && <p className="notice" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage('')}>×</button></p>}{error && <div className="studio-error" role="alert"><p>{error}</p>{needsRefresh && <button disabled={refreshing} onClick={() => void refreshRecords()}>{refreshing ? 'Loading…' : 'Load latest records'}</button>}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
    <fieldset className="studio-workspace-fields" disabled={saving || refreshing} aria-busy={saving || refreshing}>
    {screen === 'client' ? (
      <section className="studio-content planner" key={clientType}>
        <p className="eyebrow">CLIENT-SAFE PLANNING</p>
        <h1>{clientType} flower plan</h1>
        <p>{clientType === 'Funeral' ? 'Capture a thoughtful, practical tribute brief with every family and delivery detail in one place.' : clientType === 'Corporate' ? 'Define the brand direction, floral scope and setup requirements without showing internal costs.' : 'Build a complete brief together. Internal costs, VAT and markup are never shown here.'}</p>
        <form key={clientType} className="planner-form" onChange={() => { plannerDirty.current = true; }} onSubmit={savePlan}>
          <section><h2>1. Client &amp; occasion</h2><div className="form-columns"><label>{clientType === 'Corporate' ? 'Company / event organiser' : 'Client name'}<input name="clientName" required placeholder={clientType === 'Corporate' ? 'Company or organiser name' : 'Full name'} /></label><label>{clientType === 'Funeral' ? 'Family contact' : 'Contact'}<input name="contact" placeholder="Phone or email" /></label><label>{clientType === 'Funeral' ? 'Service date' : 'Event date'}<input name="eventDate" type="date" /></label><label>{clientType === 'Funeral' ? 'Service venue / location' : 'Venue / location'}<input name="venue" placeholder="Venue or address" /></label>{clientType === 'Wedding' ? <><label>Height of the bride<input name="brideHeight" placeholder="e.g. 5 ft 7 in" /></label><label>How many tables?<input name="tableCount" type="number" min="0" /></label><label>Size of the main table<input name="mainTableSize" placeholder="e.g. 6 ft rectangular" /></label></> : clientType === 'Funeral' ? <><label>Person being remembered<input name="personRemembered" placeholder="Name for the tribute" /></label><label>Service time<input name="serviceTime" type="time" /></label><label>Funeral director / delivery details<input name="funeralDirector" placeholder="Director, collection or delivery instructions" /></label><label>Faith, cultural or family wishes<input name="serviceWishes" placeholder="Any important traditions or requests" /></label><label>Card message &amp; from<input name="cardMessage" placeholder="Message and who it is from" /></label></> : <><label>Event format &amp; purpose<input name="eventFormat" placeholder="e.g. awards dinner, launch, conference" /></label><label>Expected attendees<input name="guestCount" type="number" min="0" /></label><label>How many tables?<input name="tableCount" type="number" min="0" /></label><label>Table size / layout<input name="mainTableSize" placeholder="e.g. 12 round tables, 1 stage table" /></label><label>Setup access window<input name="setupWindow" placeholder="e.g. 08:00–10:00" /></label><label>Breakdown / collection time<input name="breakdownTime" placeholder="e.g. 23:30 or next morning" /></label><label>Venue / technical restrictions<input name="venueRestrictions" placeholder="Access, flames, height, rigging, surfaces…" /></label></>}<label>Comfortable budget (£)<input name="budget" type="number" min="0" step="0.01" /></label></div></section>
          <section><h2>{clientType === 'Funeral' ? '2. Tribute direction' : clientType === 'Corporate' ? '2. Brand direction & floral scope' : '2. Floral direction'}</h2><div className="form-columns"><label>{clientType === 'Corporate' ? 'Brand colours / visual direction' : clientType === 'Funeral' ? 'Meaningful flowers / colours' : 'Colour palette'}<input name="palette" placeholder={clientType === 'Corporate' ? 'Brand colours, finish or campaign theme' : 'e.g. soft blush, cream and green'} /></label><label>{clientType === 'Corporate' ? 'Florals / foliage to include' : clientType === 'Funeral' ? 'Flowers wanted or with meaning' : 'Flowers wanted'}<input name="favouriteFlowers" placeholder="Specific flowers they would like" /></label><label>{clientType === 'Corporate' ? 'Brand or venue exclusions' : clientType === 'Funeral' ? 'Flowers or colours to avoid' : 'Flowers to avoid'}<input name="avoidFlowers" placeholder="Allergies, dislikes or exclusions" /></label><label>Plan status<select name="status" defaultValue="Enquiry"><option>Enquiry</option><option>Planning</option><option>Proposal sent</option><option>Booked</option></select></label></div><label>{clientType === 'Funeral' ? 'Tributes and quantities needed' : clientType === 'Corporate' ? 'Floral moments required' : 'What arrangements are needed?'}<textarea name="arrangements" placeholder={clientType === 'Funeral' ? 'Coffin spray, wreaths, letters, posies, service flowers, family tributes…' : clientType === 'Corporate' ? 'Entrance, registration desk, stage, tables, bar, sponsor areas, photo moment…' : 'Bouquet, buttonholes, ceremony flowers, tables, reception…'} /></label></section>
          <section className="plan-material-section"><div className="reference-heading"><div><h2>3. Materials to plan for</h2><p>Record urns, ribbons, baskets, table vases and any other non-floral requirements.</p></div></div><div className="plan-material-form"><input aria-label="Material needed" value={planMaterialName} onChange={event => setPlanMaterialName(event.target.value)} placeholder="e.g. 12 bud vases" /><input aria-label="Material quantity" value={planMaterialQuantity} onChange={event => setPlanMaterialQuantity(n(event.target.value))} type="number" min="1" /><button type="button" onClick={addPlanMaterial}>+ Add material</button></div>{planMaterials.length ? <div className="plan-material-list">{planMaterials.map(material => <span key={material.id}><b>{material.quantity} × {material.name}</b><em>{material.status}</em><button type="button" onClick={() => removePlanMaterial(material.id)} aria-label={`Remove ${material.name}`}>×</button></span>)}</div> : <p className="reference-empty">No materials added yet.</p>}</section>
          <section className="plan-reference-section">
            <div className="reference-heading"><div><h2>4. Inspiration &amp; reference images</h2><p>Save up to eight client-supplied ideas with a note on what they love about each one.</p></div><label className="reference-upload">+ Add reference images<input type="file" accept="image/*" multiple onChange={addPlanReferences} disabled={planReferences.length >= 8} /></label></div>
            {planReferences.length > 0 ? <div className="reference-grid">{planReferences.map(reference => <article key={reference.id}><Image src={reference.dataUrl} alt={reference.caption || reference.name} width={180} height={135} unoptimized /><label>What should we take from this?<input value={reference.caption || ''} placeholder="e.g. colour, shape, texture" onChange={event => updatePlanReference(reference.id, event.target.value)} /></label><button type="button" onClick={() => removePlanReference(reference.id)}>Remove</button></article>)}</div> : <p className="reference-empty">No images yet — upload flower, colour, table-setting or venue ideas from the client.</p>}
          </section>
          <section><h2>{clientType === 'Funeral' ? '5. Family notes & next steps' : clientType === 'Corporate' ? '5. Approval & next steps' : '5. Personal details & next steps'}</h2><label>{clientType === 'Funeral' ? 'Personal memories, display wishes and follow-up actions' : clientType === 'Corporate' ? 'Approvals, delivery contact and operational notes' : 'Story, inspiration and must-haves'}<textarea name="notes" placeholder={clientType === 'Funeral' ? 'Personal details, preferred tribute display, collection wishes and any follow-up…' : clientType === 'Corporate' ? 'Brand approvals, stakeholders, delivery contact and practical notes…' : 'Style, venue details, sentimental blooms, practical needs, priorities and follow-up actions…'} /></label><label>Finished estimate to show client (£)<input name="estimate" type="number" min="0" step="0.01" /></label></section>
          {clientType === 'Wedding' && <section className="plan-setup-section"><SetupOptions references={planReferences} options={planSetupOptions} onChange={options => { setPlanSetupOptions(options); plannerDirty.current = true; }} />{planSetupOptions.length > 0 && <button type="button" onClick={() => setSetupEditor({ client: 'Your wedding', options: planSetupOptions, presentation: true })}>Preview with client ↗</button>}</section>}
          <section><h2>Inspiration &amp; consultation estimate</h2><CatalogueBrowse items={data.operations?.catalogue || []} occasion={clientType} onSelect={(item, quantity) => { plannerDirty.current = true; setPlanInspiration(current => [...current, { id: id(), inspirationId: item.id, name: item.name, category: item.category, image: item.images[0]?.url || '', description: item.description, quantity, priceFrom: item.priceFrom, priceTo: item.priceTo, palette: item.palette, notes: '' }]); }} />{planInspiration.map(item => <p key={item.id}>{item.quantity} × {item.name} · {money(item.priceFrom * item.quantity)}–{money(item.priceTo * item.quantity)} <button type="button" onClick={() => setPlanInspiration(current => current.filter(i => i.id !== item.id))}>Remove</button></p>)}{planInspiration.length > 0 && <div className="ops-estimate-total"><span>Estimated floral budget</span><strong>{money(planInspiration.reduce((s, i) => s + i.priceFrom * i.quantity, 0))}–{money(planInspiration.reduce((s, i) => s + i.priceTo * i.quantity, 0))}</strong></div>}</section>
          <details><summary>Consultation, venue &amp; delivery details</summary><Fields value={planDetails} onChange={setPlanDetails} fields={[{key:'ceremonyTime', label:'Ceremony / service time', type:'time'}, {key:'ceremonyVenue',label:'Ceremony venue'}, {key:'receptionVenue',label:'Reception venue'}, {key:'weddingParty',label:'Wedding party'}, {key:'theme',label:'Style / theme'}, {key:'funeralDirectorContact',label:'Funeral director contact'}, {key:'deliveryDeadline',label:'Delivery deadline',type:'time'}, {key:'deliveryRequirements',label:'Delivery requirements',type:'textarea'}, {key:'collectionTime',label:'Collection time',type:'time'}]} /></details>
          <button type="submit" className="button" disabled={saving}>Save client plan</button>
        </form>
        <section className="records"><h2>Saved {clientType.toLowerCase()} plans</h2>{data.plans.filter(plan => plan.type === clientType).length ? data.plans.filter(plan => plan.type === clientType).map(plan => <article key={plan.id}><b>{plan.clientName} <em>· {plan.status || 'Enquiry'}</em></b><span>{plan.eventDate || 'Date to confirm'} {plan.venue ? `· ${plan.venue}` : ''}</span><p>{plan.arrangements || plan.notes}</p>{plan.references?.length ? <div className="saved-reference-strip">{plan.references.map(reference => <Image key={reference.id} src={reference.dataUrl} alt={reference.caption || reference.name} width={92} height={70} unoptimized />)}</div> : null}{plan.finishedEstimate !== null && <strong>{money(plan.finishedEstimate)}</strong>}{plan.type === 'Wedding' && <button type="button" onClick={() => { setSetupDirty(false); setSetupEditor({ planId: plan.id, client: plan.clientName, options: structuredClone(plan.setupOptions || []), presentation: false }); }}>Flower setups &amp; client proposal</button>}<button type="button" onClick={() => { if (!canNavigate()) return; setScreenValue('business'); setTabValue('clients'); setEventDraft(plan); updateLocation('business', 'clients'); }}>Open full event workspace</button><button type="button" onClick={() => showPlanInvoice(plan)}>Generate invoice</button></article>) : <p>No {clientType.toLowerCase()} plans saved yet.</p>}</section>
      </section>
    ) : <section className="studio-content">
      {eventDraft ? <><button type="button" className="back-button" onClick={() => { if (canNavigate()) setEventDraft(null); }}>← Back to Studio</button><EventWorkspace key={eventDraft.id} data={data} plan={data.plans.find(p => p.id === eventDraft.id) || eventDraft} save={persist} command={runCommand} onRecipe={openRecipe} onDirty={() => { workspaceDirty.current = true; }} /></> : <>
      {tab === 'catalogue' && <InspirationCatalogue data={data} save={persist} onDirty={() => { workspaceDirty.current = true; }} />}
      {['production','suppliers','deliveries','hire','payments','reports','calendar','leads','tasks','recurring','assistant','activity'].includes(tab) && <OperationsHub section={tab} data={data} save={persist} command={runCommand} open={openRecord} openEvent={plan => { setEventDraft(plan); setTabValue('clients'); }} onRecipe={openRecipe} onDirty={() => { workspaceDirty.current = true; }} />}

      {tab === 'dashboard' && <StudioHome data={data} open={openRecord} save={persist} newClient={startClient} newEvent={startEvent} newRecipe={startRecipe} addInvoice={() => { setTab('inventory'); setInvoiceToolsOpen(true); }} />}
      {tab === 'financial' && <BusinessDashboard data={data} save={persist} open={openRecord} />}
      {(tab === 'events' || tab === 'funerals') && <EventDirectory data={data} funeral={tab === 'funerals'} create={startEvent} open={p => { if (canNavigate()) setEventDraft(p); }} />}
      {tab === 'inventory' && <><div className="workspace-heading"><div><p className="eyebrow">FLOWERS, FOLIAGE &amp; MATERIALS</p><h1>Inventory hub</h1></div></div><details className="studio-invoice-tools" open={invoiceToolsOpen} onToggle={event => setInvoiceToolsOpen(event.currentTarget.open)}><summary>Supplier invoices <span>Upload a delivery or open your invoice library</span></summary><SupplierInvoiceImport onDraftChange={dirty => { invoiceDirty.current = dirty; }} disabled={saving || needsRefresh} onImporting={busy => { invoiceInFlight.current = busy; setInvoiceBusy(busy); }} onImported={(saved, revision) => { setData(normaliseData(saved)); revisionRef.current = revision; setDatabaseRevision(revision); setSaveState('saved'); setError(''); }} /></details><InventoryDetails data={data} save={persist} command={runCommand} /></>}
      {(tab === 'calculator' || tab === 'templates') && <RecipeBuilder key={tab} showTemplates={tab === 'templates'} onEvent={planId => openRecord('clients',planId)} data={data} recipe={quote} onChange={setQuote} command={runCommand} />}
      {tab === 'jobs' && (selectedJobId ? (() => { const job = data.jobs.find(item => item.id === selectedJobId); return job ? <section className="job-detail"><button className="back-button" onClick={() => setSelectedJobId(null)}>← Back to Purchased work</button><header className="job-detail-header"><div><p className="eyebrow">WON JOB · {job.occasion.toUpperCase()}</p><h1>{job.clientName}</h1><p>{job.contact || 'No customer contact details saved'} · Won {new Date(job.wonAt).toLocaleDateString('en-GB')}</p></div><strong>{money(job.totals.grossTotal)}</strong></header><section className="job-detail-panel"><h2>Flowers &amp; materials used</h2><div className="job-line-list">{job.lines.map(line => <article key={line.id}><div><b>{line.name}</b><span>{line.category === 'stem' ? 'Flower stem' : 'Material / extra'}</span></div><span>{line.quantity} × {money(line.unitCost)}</span><strong>{money(line.quantity * line.unitCost)}</strong></article>)}</div></section><details className="job-detail-panel"><summary>View original price breakdown</summary><div className="job-total-grid"><span>Flowers cost <b>{money(job.totals.stemCost)}</b></span><span>Materials cost <b>{money(job.totals.sundryCost)}</b></span><span>Built-in wastage <b>{money(job.totals.wastage)}</b></span><span>Labour <b>{money(job.totals.labour)}</b></span><span>Base cost <b>{money(job.totals.costSubtotal)}</b></span><span>Markup <b>{money(job.totals.markup)}</b></span><span>VAT <b>{money(job.totals.vat)}</b></span><span>Gross profit <b>{money(job.totals.profit)}</b></span><strong>Total charged <b>{money(job.totals.grossTotal)}</b></strong></div></details><ProfitabilityPanel input={recipeProfitInput(job, data.settings.corporationTaxRate)} /><div className="job-detail-actions"><button className="button" onClick={() => showJobInvoice(job)}>Generate invoice</button>{!job.stockReturned && <button type="button" onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}<button className="delete-job-button" type="button" onClick={() => deleteWonJob(job.id)}>Cancel unused order &amp; release stock</button></div></section> : <p className="empty-state">This job could not be found.</p>; })() : <><p className="eyebrow">JOBS WON</p><h1>Your completed work</h1><div className="workspace-toolbar"><label htmlFor="job-search"><span>Search completed work</span><input id="job-search" type="search" value={jobSearch} onChange={event => setJobSearch(event.target.value)} placeholder="Client, contact or job type" /></label><p>{filteredJobs.length} of {data.jobs.length} job{data.jobs.length === 1 ? '' : 's'}</p></div><section className="records wide">{filteredJobs.length ? filteredJobs.map(job => <article key={job.id}><b>{job.clientName} — {job.occasion}</b><span>{job.lines.length} line{job.lines.length === 1 ? '' : 's'} · won {new Date(job.wonAt).toLocaleDateString('en-GB')}</span><strong>{money(job.totals.grossTotal)}</strong><button onClick={() => setSelectedJobId(job.id)}>Open full job →</button><button onClick={() => showJobInvoice(job)}>Generate invoice</button>{!job.stockReturned && <button onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}{job.stockReturned && <em>Stock returned</em>}</article>) : <p className="empty-state">{data.jobs.length ? `No completed work matches “${jobSearch}”.` : 'No jobs won yet.'}</p>}</section></>)}
      {tab === 'clients' && (selectedWeddingPlanId && weddingBuildDraft ? (() => { const plan = data.plans.find(item => item.id === selectedWeddingPlanId); const stockPlan = weddingBuildDraft.inventory.map(flower => { const required = weddingBuildDraft.arrangements.reduce((sum, arrangement) => sum + arrangement.quantity * arrangement.flowers.filter(item => item.inventoryId === flower.id).reduce((lineSum, item) => lineSum + item.stemsPerArrangement, 0), 0); const capacity = flower.stemsPerPurchase * flower.purchases; return { ...flower, required, capacity, leftover: capacity - required, cost: capacity * flower.costPerStem }; }); const wastageCost = stockPlan.reduce((sum, flower) => sum + Math.max(0, flower.leftover) * flower.costPerStem, 0); const { flowerCost, materialCost, baseCost, markup, netProfit, vat, total } = weddingTotals(weddingBuildDraft); return <section className="wedding-builder">
        <button className="back-button" onClick={closeWeddingBuilder}>← Back to {plan?.clientName || 'client'}’s profile</button>
        <header className="wedding-builder-header"><div><p className="eyebrow">WEDDING BUILD · STAGE TWO</p><h1>{plan?.clientName}’s original costing plan</h1><p>Your original saved costing plan is preserved here. Use the full event workspace for linked recipes, formal quotations and stock commitments.</p></div><button className="button" type="button" onClick={saveWeddingBuild}>Save wedding build</button></header>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">1. WEDDING INVENTORY PLAN</p><h2>Flowers to purchase</h2><p>Enter the cost per stem and how many stems arrive in each purchase. The plan calculates demand, surplus and wastage.</p></div><button type="button" onClick={addWeddingInventory}>+ Add flower</button></div>{stockPlan.length ? <div className="wedding-inventory-list">{stockPlan.map(flower => <article key={flower.id}><div className="wedding-inputs"><label>Flower<input value={flower.name} placeholder="e.g. White rose" onChange={event => updateWeddingInventory(flower.id, { name: event.target.value })} /></label><label>Cost / stem (£)<input type="number" min="0" step="0.01" value={flower.costPerStem} onChange={event => updateWeddingInventory(flower.id, { costPerStem: n(event.target.value) })} /></label><label>Stems per purchase<input type="number" min="1" value={flower.stemsPerPurchase} onChange={event => updateWeddingInventory(flower.id, { stemsPerPurchase: n(event.target.value) })} /></label><label>Purchases<input type="number" min="1" value={flower.purchases} onChange={event => updateWeddingInventory(flower.id, { purchases: n(event.target.value) })} /></label><button type="button" aria-label={`Remove ${flower.name || 'flower'}`} onClick={() => removeWeddingInventory(flower.id)}>×</button></div><div className="wedding-stock-summary"><span>Required <b>{flower.required} stems</b></span><span>Purchased <b>{flower.capacity} stems</b></span><span className={flower.leftover < 0 ? 'shortfall' : ''}>{flower.leftover < 0 ? 'Shortfall' : 'Wastage / left'} <b>{Math.abs(flower.leftover)} stems</b></span><span className="wastage-cost">Wastage cost <b>{money(Math.max(0, flower.leftover) * flower.costPerStem)}</b></span><strong>{money(flower.cost)} cost</strong></div></article>)}</div> : <p className="empty-state">Add the flowers you will buy for this wedding first.</p>}</section>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">2. RECIPE BUILDER</p><h2>Build each floral piece</h2><p>Add every bouquet, buttonhole, table arrangement and installation, then specify stems per piece.</p></div><button type="button" onClick={addWeddingArrangement}>+ Add arrangement</button></div>{weddingBuildDraft.arrangements.length ? <div className="arrangement-list">{weddingBuildDraft.arrangements.map(arrangement => <article key={arrangement.id}><div className="arrangement-heading"><label>Arrangement name<input value={arrangement.name} placeholder="e.g. Bridal bouquet" onChange={event => updateWeddingArrangement(arrangement.id, { name: event.target.value })} /></label><label>How many?<input type="number" min="1" value={arrangement.quantity} onChange={event => updateWeddingArrangement(arrangement.id, { quantity: n(event.target.value) })} /></label><button type="button" onClick={() => removeWeddingArrangement(arrangement.id)}>Remove arrangement</button></div>{arrangement.flowers.map(line => <div className="arrangement-flower" key={line.id}><select aria-label="Flower" value={line.inventoryId || ''} onChange={event => { const flower = weddingBuildDraft.inventory.find(item => item.id === event.target.value); updateArrangementFlower(arrangement.id, line.id, { inventoryId: flower?.id || null, name: flower?.name || '' }); }}><option value="">Select a flower</option>{weddingBuildDraft.inventory.map(flower => <option key={flower.id} value={flower.id}>{flower.name || 'Unnamed flower'}</option>)}</select><label>Stems per arrangement<input type="number" min="0" value={line.stemsPerArrangement} onChange={event => updateArrangementFlower(arrangement.id, line.id, { stemsPerArrangement: n(event.target.value) })} /></label><button type="button" aria-label="Remove flower line" onClick={() => removeArrangementFlower(arrangement.id, line.id)}>×</button></div>)}<button className="add-flower-line" type="button" onClick={() => addArrangementFlower(arrangement.id)}>+ Add flower to this arrangement</button><label className="arrangement-notes">Notes<textarea value={arrangement.notes || ''} placeholder="Colour, shape, mechanics or special instructions" onChange={event => updateWeddingArrangement(arrangement.id, { notes: event.target.value })} /></label></article>)}</div> : <p className="empty-state">Add the arrangements you need to make for this wedding.</p>}</section>
        <section className="wedding-builder-panel"><div className="builder-heading"><div><p className="eyebrow">3. MATERIAL COSTS &amp; WEDDING PRICE</p><h2>Price the complete wedding</h2><p>Use the materials from the client brief and set costs, markup and VAT.</p></div></div>{weddingBuildDraft.materials.length ? <div className="wedding-material-costs">{weddingBuildDraft.materials.map(material => <div key={material.id}><b>{material.quantity} × {material.name}</b><label>Cost per unit (£)<input type="number" min="0" step="0.01" value={material.unitCost} onChange={event => updateWeddingMaterial(material.id, { unitCost: n(event.target.value) })} /></label><strong>{money(material.quantity * material.unitCost)}</strong></div>)}</div> : <p className="empty-state">No materials were added to the wedding brief. Add them in the planning stage if needed.</p>}<div className="wedding-price-grid"><label>Markup %<input type="number" min="0" value={weddingBuildDraft.markupPercent} onChange={event => setWeddingBuildDraft(current => current ? { ...current, markupPercent: n(event.target.value) } : current)} /></label><label>VAT %<input type="number" min="0" value={weddingBuildDraft.vatRate} onChange={event => setWeddingBuildDraft(current => current ? { ...current, vatRate: n(event.target.value) } : current)} /></label></div><div className="wedding-price-summary"><span>Flower purchases <b>{money(flowerCost)}</b></span><span>Expected flower wastage <b>{money(wastageCost)}</b></span><span>Materials <b>{money(materialCost)}</b></span><span>Base cost <b>{money(baseCost)}</b></span><span>Markup ({weddingBuildDraft.markupPercent}%) <b>{money(markup)}</b></span><span>VAT ({weddingBuildDraft.vatRate}%) <b>{money(vat)}</b></span><span className="wedding-profit">Net profit <b>{money(netProfit)}</b></span><strong>Wedding price <b>{money(total)}</b></strong></div></section>
      </section>; })() : selectedCustomer ? <section className="customer-profile">
        <button className="back-button" onClick={() => setSelectedCustomerId(null)}>← Back to client book</button>
        <header className="customer-profile-header"><div><p className="eyebrow">CUSTOMER PROFILE</p><h1>{selectedCustomer.name}</h1><p>{selectedCustomer.contact || 'No contact details yet'}</p></div><p>{selectedCustomer.notes || 'No customer notes saved yet.'}</p></header>
        <button className="delete-client-button" type="button" onClick={() => deleteCustomer(selectedCustomer)}>Delete client and records</button>
        <div className="customer-stat-grid"><article><small>PLANS</small><b>{selectedCustomerPlans.length}</b></article><article><small>JOBS PURCHASED</small><b>{selectedCustomerJobs.length}</b></article><article><small>SAVED QUOTES</small><b>{selectedCustomerQuotes.length}</b></article><article><small>TOTAL PURCHASED</small><b>{money(selectedCustomerJobs.reduce((sum, job) => sum + job.totals.grossTotal, 0))}</b></article></div>
        <CustomerTimeline key={selectedCustomer.id} data={data} customer={selectedCustomer} save={persist} /><section className="customer-profile-panel"><h2>Purchased work</h2>{selectedCustomerJobs.length ? selectedCustomerJobs.map(job => <article className="customer-purchase" key={job.id}><div><b>{job.occasion}</b><span>Won {new Date(job.wonAt).toLocaleDateString('en-GB')} {job.eventDate ? `· event ${new Date(job.eventDate).toLocaleDateString('en-GB')}` : ''}</span></div><strong>{money(job.totals.grossTotal)}</strong><ul>{job.lines.map(line => <li key={line.id}>{line.quantity} × {line.name} <span>{money(line.quantity * line.unitCost)}</span></li>)}</ul></article>) : <p className="empty-state">No completed purchases are saved for this customer yet.</p>}</section>
        <section className="customer-profile-panel"><h2>Saved quotes</h2>{selectedCustomerQuotes.length ? selectedCustomerQuotes.map(savedQuote => <article className="customer-purchase" key={savedQuote.id}><div><b>{savedQuote.occasion} quote</b><span>Created {new Date(savedQuote.createdAt).toLocaleDateString('en-GB')} · {savedQuote.lines.length} item{savedQuote.lines.length === 1 ? '' : 's'}</span></div><strong>{money(calculateTotals(savedQuote).grossTotal)}</strong>{savedQuote.notes && <p>{savedQuote.notes}</p>}<button type="button" className="back-button" onClick={() => { if (quoteDirty && !globalThis.confirm('Replace the unsaved quote with this saved quote?')) return; setQuote(structuredClone(savedQuote)); setTab('calculator'); }}>Open &amp; edit quote →</button></article>) : <p className="empty-state">No open or saved quotes for this customer.</p>}</section>
        <section className="customer-profile-panel"><h2>Plans &amp; inspiration</h2>{selectedCustomerPlans.length ? selectedCustomerPlans.map(plan => <article className="customer-plan-detail" key={plan.id}>
          <div className="plan-detail-heading"><div><p className="eyebrow">{plan.type} PLAN · {plan.status || 'Enquiry'}</p><h3>{plan.eventDate ? new Date(plan.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to confirm'}</h3></div>{plan.finishedEstimate !== null && plan.finishedEstimate !== undefined && <strong>{money(plan.finishedEstimate)}</strong>}</div>
          <dl><div><dt>{plan.type === 'Funeral' ? 'Service venue' : 'Venue'}</dt><dd>{plan.venue || 'To confirm'}</dd></div>{plan.type === 'Wedding' && <><div><dt>Height of the bride</dt><dd>{plan.brideHeight || 'To confirm'}</dd></div><div><dt>Tables</dt><dd>{plan.tableCount ?? 'To confirm'}</dd></div><div><dt>Size of main table</dt><dd>{plan.mainTableSize || 'To confirm'}</dd></div></>}{plan.type === 'Funeral' && <><div><dt>Person remembered</dt><dd>{plan.personRemembered || 'Not recorded'}</dd></div><div><dt>Service time</dt><dd>{plan.serviceTime || 'To confirm'}</dd></div><div><dt>Funeral director / delivery</dt><dd>{plan.funeralDirector || 'To confirm'}</dd></div><div><dt>Faith / family wishes</dt><dd>{plan.serviceWishes || 'None recorded'}</dd></div><div><dt>Card message</dt><dd>{plan.cardMessage || 'Not recorded'}</dd></div></>}{plan.type === 'Corporate' && <><div><dt>Event format</dt><dd>{plan.eventFormat || 'To confirm'}</dd></div><div><dt>Expected attendees</dt><dd>{plan.guestCount ?? 'To confirm'}</dd></div><div><dt>Tables</dt><dd>{plan.tableCount ?? 'To confirm'}</dd></div><div><dt>Table layout</dt><dd>{plan.mainTableSize || 'To confirm'}</dd></div><div><dt>Setup window</dt><dd>{plan.setupWindow || 'To confirm'}</dd></div><div><dt>Breakdown / collection</dt><dd>{plan.breakdownTime || 'To confirm'}</dd></div><div><dt>Venue restrictions</dt><dd>{plan.venueRestrictions || 'None recorded'}</dd></div></>}<div><dt>Comfortable budget</dt><dd>{plan.budget !== null && plan.budget !== undefined ? money(plan.budget) : 'To discuss'}</dd></div><div><dt>{plan.type === 'Corporate' ? 'Brand direction' : 'Palette'}</dt><dd>{plan.palette || 'To explore'}</dd></div><div><dt>{plan.type === 'Funeral' ? 'Meaningful flowers' : 'Flowers wanted'}</dt><dd>{plan.favouriteFlowers || 'Not recorded'}</dd></div><div><dt>Flowers to avoid</dt><dd>{plan.avoidFlowers || 'None noted'}</dd></div></dl>
          <div className="plan-detail-copy"><p><b>Arrangements needed</b>{plan.arrangements || 'Not recorded'}</p><p><b>Story, must-haves &amp; next steps</b>{plan.notes}</p></div>
          <div className="profile-materials"><h4>Materials needed</h4>{plan.materialsNeeded?.length ? plan.materialsNeeded.map(material => <div key={material.id}><span>{material.quantity} × {material.name}</span><select aria-label={`Status for ${material.name}`} value={material.status} onChange={event => updateSavedPlanMaterial(plan.id, material.id, event.target.value as PlanMaterial['status'])}><option>Needed</option><option>In stock</option><option>Ordered</option><option>Ready</option></select></div>) : <p>No materials added to this plan.</p>}</div>
          {plan.type === 'Wedding' && <button className="open-wedding-builder" type="button" onClick={() => { setSetupDirty(false); setSetupEditor({ planId: plan.id, client: plan.clientName, options: structuredClone(plan.setupOptions || []), presentation: false }); }}>Flower setups &amp; client proposal →</button>}<button className="generate-plan-invoice" type="button" onClick={() => showPlanInvoice(plan)}>Generate {plan.type.toLowerCase()} invoice</button>
          <button className="open-wedding-builder" type="button" onClick={() => setEventDraft(plan)}>Open full {plan.type.toLowerCase()} workspace →</button>{data.weddingBuilds.some(b => b.planId === plan.id) && <button type="button" onClick={() => openWeddingBuilder(plan)}>View saved original costing plan</button>}
          <div className="profile-reference-board"><h4>Client reference images</h4>{plan.references?.length ? <div>{plan.references.map(reference => <figure key={reference.id}><button className="reference-preview" type="button" onClick={() => setActiveReference(reference)} aria-label={`Enlarge ${reference.caption || reference.name}`}><Image src={reference.dataUrl} alt={reference.caption || reference.name} width={210} height={158} unoptimized /></button><figcaption>{reference.caption || reference.name}<span>Click to enlarge</span></figcaption></figure>)}</div> : <p>No reference images added to this plan.</p>}</div>
        </article>) : <p className="empty-state">No planning brief has been saved for this customer yet.</p>}</section>
      </section> : <><p className="eyebrow">CUSTOMER DATABASE</p><h1>Your client book</h1><button className="button" type="button" onClick={startClient}>+ New Client</button><div className="workspace-toolbar"><label htmlFor="client-search"><span>Search clients</span><input id="client-search" type="search" value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Name, contact or notes" /></label><p>{filteredCustomers.length} of {data.customers.length} client{data.customers.length === 1 ? '' : 's'}</p></div><section className="client-directory">{filteredCustomers.map(customer => { const clientPlans = data.plans.filter(plan => clientNameKey(plan.clientName) === clientNameKey(customer.name)); const clientJobs = data.jobs.filter(job => clientNameKey(job.clientName) === clientNameKey(customer.name)); return <button type="button" className="client-card" key={customer.id} onClick={() => setSelectedCustomerId(customer.id)}><p className="eyebrow">{clientPlans.length} plan{clientPlans.length === 1 ? '' : 's'} · {clientJobs.length} job{clientJobs.length === 1 ? '' : 's'}</p><h2>{customer.name}</h2><span>{customer.contact || 'No contact details yet'}</span><p>{customer.notes || 'No notes saved yet.'}</p>{clientPlans.slice(0, 2).map(plan => <small key={plan.id}>{plan.type}: {plan.eventDate || 'date to confirm'} {plan.status ? `· ${plan.status}` : ''}</small>)}<em>Open full profile →</em></button>})}</section>{data.customers.length === 0 ? <p className="empty-state">Clients are added automatically when you save a quote, job or planning brief.</p> : filteredCustomers.length === 0 && <p className="empty-state">No client matches “{clientSearch}”.</p>}</>) }
      {tab === 'insights' && <StudioInsights data={data} />}
      {tab === 'settings' && <><p className="eyebrow">STUDIO SETTINGS</p><h1>Materials &amp; pricing</h1><a className="button secondary" href="/studio/reviews">Client reviews · invitations &amp; website reviews →</a><form className="panel-form settings-pricing" onSubmit={saveDefaultMarkup}><h2>Pricing defaults</h2><p>Set the starting values for new quotes and wedding builds. Saved prices stay as they were.</p><label>Default markup (%)<input name="defaultMarkup" type="number" min="0" step="1" defaultValue={data.settings.defaultMarkup} /></label><label>Default wastage allowance (%)<input name="defaultWastage" type="number" min="0" step="0.1" defaultValue={data.settings.defaultWastage} /></label><label>Labour rate (£ / hour)<input name="labourRate" type="number" min="0" step="0.01" defaultValue={data.settings.labourRate} /></label><label>VAT rate (%)<input name="vatRate" type="number" min="0" step="0.1" defaultValue={data.settings.vatRate} /></label><label>Estimated corporation tax rate (%)<input name="corporationTaxRate" type="number" min="0" max="100" defaultValue={data.settings.corporationTaxRate ?? 25} /></label><button className="button" disabled={saving}>Save pricing defaults</button></form><div className="settings-grid"><form className="panel-form" onSubmit={addMaterial}><h2>Add a material or extra</h2><label>Name<input name="name" required placeholder="e.g. Ivory satin ribbon" /></label><label>Category<input name="category" placeholder="e.g. Packaging" /></label><label>Unit<select name="unit" defaultValue="each"><option>each</option><option>metre</option><option>pack</option><option>vase</option></select></label><label>Cost per unit (£)<input name="cost" required type="number" min="0" step="0.01" /></label><button className="button" disabled={saving}>Add material</button></form><section className="records"><h2>Material price list</h2>{data.materials.length ? data.materials.map(material => <article key={material.id}><b>{material.name}</b><span>{material.category} · {money(material.unitCost)} / {material.unit}</span><button onClick={() => removeMaterial(material.id)}>Remove</button></article>) : <p>No materials yet. Add ribbon, containers, packaging and delivery extras here.</p>}</section></div></>}
    </>} </section>}
    </fieldset>
    {setupEditor && <Dialog className="setup-dialog" label="Wedding setup proposal" onClose={() => { if (saving) return; if (setupDirty && !globalThis.confirm('Close without saving these setup options?')) return; setSetupEditor(null); setSetupDirty(false); }}>
      <div className="setup-dialog-inner"><header className="setup-dialog-heading"><div><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>{setupEditor.client}</h1></div><div>{!setupEditor.presentation && setupEditor.planId && data.weddingBuilds.some(build => build.planId === setupEditor.planId) && <button type="button" disabled={saving} onClick={() => { const build = data.weddingBuilds.find(item => item.planId === setupEditor.planId)!; setSetupEditor({ ...setupEditor, options: [...setupEditor.options, { id: id(), title: 'Complete wedding flowers', description: build.arrangements.map(item => `${item.quantity} × ${item.name || 'floral arrangement'}`).join(', '), quantity: 1, unitPrice: weddingTotals(build).total, photoSrc: '', selected: true }] }); setSetupDirty(true); }}>Add saved wedding price</button>}<button type="button" disabled={saving} onClick={() => { if (setupDirty && !globalThis.confirm('Close without saving these setup options?')) return; setSetupEditor(null); setSetupDirty(false); }}>Close</button>{setupEditor.planId && <button type="button" disabled={saving} onClick={() => setSetupEditor({ ...setupEditor, presentation: !setupEditor.presentation })}>{setupEditor.presentation ? 'Edit options' : 'Present to client ↗'}</button>}{!setupEditor.presentation && setupEditor.planId && <button className="button" type="button" disabled={saving || !setupDirty} onClick={async () => { const options = setupEditor.options; if (options.some(option => !option.title.trim())) { setError('Give every setup option a name.'); return; } if (await persist({ ...data, plans: data.plans.map(plan => plan.id === setupEditor.planId ? { ...plan, setupOptions: options } : plan) }, 'Wedding setup options saved.')) setSetupDirty(false); }}>{saving ? 'Saving…' : setupDirty ? 'Save options' : 'Options saved'}</button>}</div></header>
      {error && <p className="setup-save-error" role="alert">{error}{needsRefresh && <button disabled={refreshing} onClick={() => void refreshRecords()}>Load latest records</button>}</p>}
      <fieldset className="studio-workspace-fields" disabled={saving}><SetupOptions references={setupEditor.planId ? data.plans.find(plan => plan.id === setupEditor.planId)?.references : planReferences} options={setupEditor.options} presentation={setupEditor.presentation} onChange={options => { setSetupEditor({ ...setupEditor, options }); setSetupDirty(true); }} /></fieldset>
      </div></Dialog>}
    {invoicePreview && <Dialog className="invoice-overlay" label="Invoice preview" onClose={() => setInvoicePreview(null)}><section className="invoice-sheet" onClick={event => event.stopPropagation()}><div className="invoice-actions"><button type="button" onClick={() => setInvoicePreview(null)}>Close</button><button className="button" type="button" onClick={() => globalThis.print()}>Print / save PDF</button></div><header><div><p>BRAMBLE &amp; PETAL</p><h1>Florist Studio</h1><span>Thoughtful flowers for every occasion</span></div><div><p className="eyebrow">INVOICE</p><b>{invoicePreview.number}</b><span>{new Date(invoicePreview.date).toLocaleDateString('en-GB')}</span></div></header><div className="invoice-client"><div><small>BILLED TO</small><b>{invoicePreview.clientName}</b><span>{invoicePreview.contact || 'Contact details to follow'}</span></div><div><small>FOR</small><b>{invoicePreview.occasion}</b><span>Bespoke floral design</span></div></div><table><thead><tr><th>Description</th><th>Quantity</th><th>Amount (ex VAT)</th></tr></thead><tbody>{invoicePreview.lines.map((line, index) => <tr key={`${line.description}-${index}`}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.total)}</td></tr>)}</tbody></table><div className="invoice-totals"><span>Subtotal <b>{money(invoicePreview.subtotal)}</b></span><span>VAT <b>{money(invoicePreview.vat)}</b></span><strong>Total due <b>{money(invoicePreview.total)}</b></strong></div><footer>Thank you for choosing Bramble &amp; Petal Florist Studio.</footer></section></Dialog>}
    {activeReference && <Dialog className="reference-lightbox" label="Reference image preview" onClose={() => setActiveReference(null)}><section onClick={event => event.stopPropagation()}><button className="lightbox-close" type="button" onClick={() => setActiveReference(null)} aria-label="Close image preview">×</button><Image src={activeReference.dataUrl} alt={activeReference.caption || activeReference.name} width={900} height={675} unoptimized /><p>{activeReference.caption || activeReference.name}</p></section></Dialog>}
  </main>;
}

