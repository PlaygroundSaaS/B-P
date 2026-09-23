import { createHash } from 'node:crypto';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readJsonObject, requireSameOrigin, RequestError } from '@/lib/request-body';
import { parseReviewToken, validateReview } from '@/lib/review-validation';
export const dynamic = 'force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 const db=createStudioDatabaseClient(); if(!db)return json({error:'Reviews are temporarily unavailable.'},503);
 const {data,error}=await db.from('studio_reviews').select('id,public_name,review_text,rating,occasion,submitted_at').eq('workspace_key',STUDIO_WORKSPACE).eq('published',true).not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(100);
 return error?json({error:'Reviews are temporarily unavailable.'},503):json({reviews:data});
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);const body=await readJsonObject(request,12288);
  const token=parseReviewToken(body.token);if(!token)return json({error:'Please use the review invitation sent by the studio.'},400);
  let review;try{review=validateReview(body);}catch(error){return json({error:(error as Error).message},400);}
  const db=createStudioDatabaseClient();if(!db)return json({error:'Please try again shortly.'},503);
  const {data,error}=await db.from('studio_reviews').update({...review,published:false,submitted_at:new Date().toISOString()}).eq('id',token.id).eq('workspace_key',STUDIO_WORKSPACE).eq('token_hash',createHash('sha256').update(token.secret).digest('hex')).is('submitted_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).select('id');
  if(error)return json({error:'Your review could not be saved. Please try again.'},503);
  if(!data?.length)return json({error:'This invitation has expired, been withdrawn or already been used. Please contact the studio if you need help.'},409);
  return json({message:'Thank you. Your review has been sent to the studio and will appear on our website once it has been checked.'});
 }catch(error){return json({error:error instanceof RequestError?error.message:'Your review could not be saved.'},error instanceof RequestError?error.status:503);}
}
