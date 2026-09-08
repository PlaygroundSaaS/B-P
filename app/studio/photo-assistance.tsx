'use client';
import { useState } from 'react';
import type { PhotoSuggestion } from '@/app/api/studio/photo-analysis/route';
import { newId } from '@/lib/operations-model';

export default function PhotoAssistance({ assetId, onUse }: { assetId?: string; onUse: (suggestion: PhotoSuggestion) => void }) {
  const [result, setResult] = useState<PhotoSuggestion | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [recordId,setRecordId]=useState('');
  return <div className="ops-photo-assistance"><button type="button" disabled={!assetId || busy} onClick={async () => {setBusy(true);setError('');try{const r=await fetch('/api/studio/photo-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId,generationId:newId()})});const body=await r.json();if(!r.ok)throw new Error(body.error);setResult(body.suggestion);setRecordId(body.id);}catch(e){setError(e instanceof Error?e.message:'Photo assistance is unavailable.');}finally{setBusy(false);}}}>{busy?'Reviewing photograph…':'Suggest details from photograph'}</button>{error&&<p role="alert">{error}</p>}{result&&<section className="ops-inline-notice"><h3>Review the suggestion</h3><p>{result.name} · {result.colour}</p><p>Approximate quantity: {result.quantity ?? 'Cannot reliably count'} · Confidence: {result.confidence}</p><p>{result.notes}</p><button type="button" onClick={()=>onUse(result)}>Use in editable draft</button><a href={`/api/studio/photo-analysis?id=${recordId}`} target="_blank" rel="noreferrer">Saved photo review</a><p>Check the identity and count before confirming. No inventory changes until you save stock or confirm waste.</p></section>}</div>;
}
