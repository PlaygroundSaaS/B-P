import { createHash, randomUUID } from 'node:crypto';
import { createStudioDatabaseClient, STUDIO_WORKSPACE } from '@/lib/studio-database';
import { readJsonObject, readMultipartForm, requireSameOrigin, RequestError } from '@/lib/request-body';
import { parseReviewToken, REVIEW_PHOTO_LIMIT, REVIEW_PHOTO_MAX_BYTES, reviewPhotoType, validateReview } from '@/lib/review-validation';
import { REVIEW_PHOTO_BUCKET, reviewPhotoPath, selectWithReviewPhotos } from '@/lib/public-reviews';
export const dynamic = 'force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const unusable='This invitation has expired, been withdrawn or already been used. Please contact the studio if you need help.';
export async function GET(){
 const db=createStudioDatabaseClient(); if(!db)return json({error:'Reviews are temporarily unavailable.'},503);
 const {data,error}=await selectWithReviewPhotos(columns=>db.from('studio_reviews').select(columns).eq('workspace_key',STUDIO_WORKSPACE).eq('published',true).not('submitted_at','is',null).order('submitted_at',{ascending:false}).limit(100),'id,public_name,review_text,rating,occasion,highlight,submitted_at');
 return error?json({error:'Reviews are temporarily unavailable.'},503):json({reviews:data});
}
// The review form sends multipart form data so photos can travel with the review.
async function readSubmission(request:Request){
 if(!(request.headers.get('content-type')??'').toLowerCase().startsWith('multipart/form-data'))return {body:await readJsonObject(request,12288),files:[] as unknown[]};
 const form=await readMultipartForm(request,REVIEW_PHOTO_LIMIT*REVIEW_PHOTO_MAX_BYTES+32768);
 return {body:{token:form.get('token'),name:form.get('name'),message:form.get('message'),occasion:form.get('occasion'),rating:Number(form.get('rating')),consent:form.get('consent')==='true'} as Record<string,unknown>,files:form.getAll('photo') as unknown[]};
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);const {body,files}=await readSubmission(request);
  const token=parseReviewToken(body.token);if(!token)return json({error:'Please use the review invitation sent by the studio.'},400);
  let review;try{review=validateReview(body);}catch(error){return json({error:(error as Error).message},400);}
  if(files.length>REVIEW_PHOTO_LIMIT)return json({error:`Please choose up to ${REVIEW_PHOTO_LIMIT} photos.`},400);
  const photos:{id:string;bytes:Uint8Array;type:string}[]=[];
  for(const file of files){
   const bytes=file instanceof Blob&&file.size<=REVIEW_PHOTO_MAX_BYTES?new Uint8Array(await file.arrayBuffer()):null,type=bytes&&reviewPhotoType(bytes);
   if(!bytes||!type)return json({error:'Each photo must be a JPEG, PNG or WebP image under 1.4 MB.'},400);
   photos.push({id:randomUUID(),bytes,type});
  }
  const db=createStudioDatabaseClient();if(!db)return json({error:'Please try again shortly.'},503);
  const tokenHash=createHash('sha256').update(token.secret).digest('hex'),now=new Date().toISOString(),stored:string[]=[];
  if(photos.length){
   // Only store photos for an invitation that can still be used.
   const {data:open,error}=await db.from('studio_reviews').select('id').eq('id',token.id).eq('workspace_key',STUDIO_WORKSPACE).eq('token_hash',tokenHash).is('submitted_at',null).is('revoked_at',null).gt('expires_at',now).maybeSingle();
   if(error)return json({error:'Your review could not be saved. Please try again.'},503);
   if(!open)return json({error:unusable},409);
   const uploads=await Promise.all(photos.map(photo=>db.storage.from(REVIEW_PHOTO_BUCKET).upload(reviewPhotoPath(token.id,photo.id),photo.bytes,{contentType:photo.type,upsert:false}).then(({error})=>!error,()=>false)));
   stored.push(...photos.filter((_,index)=>uploads[index]).map(photo=>photo.id));
  }
  let saved=false;
  try{
   if(stored.length<photos.length)return json({error:'Your photos could not be uploaded. Please try again, or send your review without photos.'},503);
   const {data,error}=await db.from('studio_reviews').update({...review,...(photos.length?{photos:photos.map(photo=>photo.id)}:{}),published:false,submitted_at:now}).eq('id',token.id).eq('workspace_key',STUDIO_WORKSPACE).eq('token_hash',tokenHash).is('submitted_at',null).is('revoked_at',null).gt('expires_at',now).select('id');
   if(error)return json({error:'Your review could not be saved. Please try again.'},503);
   if(!data?.length)return json({error:unusable},409);
   saved=true;return json({message:'Thank you. Your review has been sent to the studio and will appear on our website once it has been checked.'});
  }finally{if(!saved&&stored.length)await db.storage.from(REVIEW_PHOTO_BUCKET).remove(stored.map(photo=>reviewPhotoPath(token.id,photo))).catch(()=>undefined);}
 }catch(error){return json({error:error instanceof RequestError?error.message:'Your review could not be saved.'},error instanceof RequestError?error.status:503);}
}
