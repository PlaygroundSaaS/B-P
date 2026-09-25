import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { hasStudioSession } from '@/lib/studio-auth';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { isMissingHighlightColumn, validateHighlight } from '@/lib/review-validation';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!await hasStudioSession())return json({error:'Please sign in.'},401);
 const db=createStudioDatabaseClient();if(!db)return json({error:'Reviews are unavailable.'},503);
 const reviews=(columns:string)=>db.from('studio_reviews').select(columns).eq('workspace_key',STUDIO_WORKSPACE).order('created_at',{ascending:false}).limit(500);
 let {data,error}=await reviews('id,client_label,created_at,expires_at,revoked_at,public_name,review_text,rating,occasion,highlight,submitted_at,published');
 if(isMissingHighlightColumn(error))({data,error}=await reviews('id,client_label,created_at,expires_at,revoked_at,public_name,review_text,rating,occasion,submitted_at,published'));
 return error?json({error:'Reviews could not be loaded.'},503):json({reviews:data});
}
export async function POST(request:Request){
 if(!await hasStudioSession())return json({error:'Please sign in.'},401);
 try{
 requireSameOrigin(request);const body=await readJsonObject(request,4096);const db=createStudioDatabaseClient();if(!db)return json({error:'Reviews are unavailable.'},503);
 if(body.action==='invite'){
  const label=typeof body.label==='string'?body.label.trim():'';if(!label||label.length>120)return json({error:'Enter a client reference up to 120 characters.'},400);
  const id=randomUUID(),secret=randomBytes(32).toString('base64url');
  const {error}=await db.from('studio_reviews').insert({id,workspace_key:STUDIO_WORKSPACE,client_label:label,token_hash:createHash('sha256').update(secret).digest('hex')});
  if(error)throw error;return json({invite:`${id}.${secret}`});
 }
 if(body.action==='highlight'){
  if(typeof body.id!=='string')return json({error:'Choose a review to highlight.'},400);
  const {data:review,error:readError}=await db.from('studio_reviews').select('review_text').eq('id',body.id).eq('workspace_key',STUDIO_WORKSPACE).not('submitted_at','is',null).maybeSingle();
  if(readError)throw readError;if(!review?.review_text)return json({error:'This review could not be updated.'},404);
  let highlight;try{highlight=validateHighlight(body.highlight,review.review_text);}catch(error){return json({error:(error as Error).message},400);}
  const {data,error}=await db.from('studio_reviews').update({highlight}).eq('id',body.id).eq('workspace_key',STUDIO_WORKSPACE).not('submitted_at','is',null).select('id');
  if(isMissingHighlightColumn(error))return json({error:'Highlights are not switched on in the database yet. Please ask for the review highlights update to be applied.'},503);
  if(error)throw error;if(!data?.length)return json({error:'This review could not be updated.'},404);return json({saved:true,highlight});
 }
 if(typeof body.id!=='string'||!['visibility','revoke'].includes(String(body.action)))return json({error:'Choose a valid review action.'},400);
 if(body.action==='visibility'&&typeof body.published!=='boolean')return json({error:'Choose whether to publish the review.'},400);
 let query=db.from('studio_reviews').update(body.action==='revoke'?{revoked_at:new Date().toISOString()}:{published:body.published}).eq('id',body.id).eq('workspace_key',STUDIO_WORKSPACE);
 query=body.action==='visibility'?query.not('submitted_at','is',null):query.is('submitted_at',null);
 const {data,error}=await query.select('id');if(error)throw error;if(!data?.length)return json({error:'This review or invitation could not be updated.'},404);return json({saved:true});
 }catch(error){return json({error:error instanceof RequestError?error.message:'The review action could not be completed.'},error instanceof RequestError?error.status:503);}
}
