import { createHash, randomUUID } from 'node:crypto';
import { createStudioDatabaseClient } from './studio-database';
import { readWorkspace, commitWorkspace, commandHash } from './studio-command-server';
import { emptyOperations, type Lead } from './operations-types';
import { RequestError } from './request-body';
/** Persist a website enquiry before any optional email notification without duplicating a visitor's immediate retries. */
export async function captureWebsiteEnquiry(input: { name: string; email: string; phone: string; occasion: string; eventDate: string; location: string; message: string }) {
  const db = createStudioDatabaseClient(); if (!db) return false;
  const date = new Date().toISOString().slice(0, 10); const id = `website-${createHash('sha256').update(JSON.stringify({ ...input, date })).digest('hex').slice(0, 24)}`;
  const lead: Lead = { id, clientName: input.name, contact: [input.email,input.phone].filter(Boolean).join(' · '), occasion: input.occasion === 'Wedding' ? 'Wedding' : input.occasion === 'Funeral flowers' ? 'Funeral' : input.occasion === 'Corporate event' ? 'Corporate' : input.occasion === 'Everyday flowers' ? 'Retail' : 'Other', status: 'New enquiry', eventDate: /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? input.eventDate : '', followUpDate: date, consultationDate: '', consultationTime: '', notes: [input.location && `Venue / area: ${input.location}`,input.message].filter(Boolean).join('\n'), createdAt: new Date().toISOString() };
  for (let attempt=0;attempt<3;attempt++) {
    try { const current=await readWorkspace(db); const ops={...emptyOperations(),...current.data.operations}; if(ops.leads.some(l=>l.id===id))return true; ops.leads.unshift(lead); await commitWorkspace(db,{id:randomUUID(),hash:commandHash(lead),revision:current.updatedAt,data:{...current.data,operations:ops},action:'Website enquiry received',recordIds:[id],transactions:[],actor:'Website enquiry'});return true; }
    catch(e){ if(!(e instanceof RequestError) || e.status!==409)return false; }
  }
  return false;
}
