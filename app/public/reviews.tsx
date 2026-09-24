'use client';
import { useEffect, useId, useState } from 'react';
import ClampedText from './clamped-text';
type Review={id:string;public_name:string;review_text:string;rating:number;occasion:string;highlight:string|null};
function ReviewCard({review}:{review:Review}){
 const [open,setOpen]=useState(false),fullId=useId();
 const stars=<div aria-label={`${review.rating} out of 5 stars`} className="public-review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div>;
 const caption=<figcaption>{review.public_name}<span>{review.occasion}</span></figcaption>;
 if(!review.highlight)return <figure>{stars}<ClampedText text={review.review_text} lines={6}/>{caption}</figure>;
 return <figure className="has-highlight">{stars}<blockquote className="public-review-highlight">“{review.highlight}”</blockquote><div className="public-review-full" id={fullId} hidden={!open}>{review.review_text}</div><button type="button" className="public-review-toggle" aria-expanded={open} aria-controls={fullId} onClick={()=>setOpen(!open)}>{open?'Show less':'Read full review'}</button>{caption}</figure>;
}
export default function ClientReviews(){
 const [reviews,setReviews]=useState<Review[]>([]);const [status,setStatus]=useState('loading');const [shown,setShown]=useState(6);
 useEffect(()=>{const controller=new AbortController();fetch('/api/reviews',{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();setReviews(data.reviews);setStatus('ready');}).catch(()=>{if(!controller.signal.aborted)setStatus('error');});return()=>controller.abort();},[]);
 return <section className="public-reviews public-wrap" id="reviews"><p className="public-kicker">FROM OUR CLIENTS</p><h2>In their own words.</h2>{reviews.length?<><div className="public-review-grid">{reviews.slice(0,shown).map(review=><ReviewCard key={review.id} review={review}/>)}</div>{shown<reviews.length&&<button className="public-button" onClick={()=>setShown(shown+6)}>Read more reviews</button>}</>:<p className="public-copy">{status==='loading'?'Loading client reviews…':status==='error'?'Client reviews are temporarily unavailable.': 'A space for experiences shared by our clients. If we’ve created flowers for you, ask the studio for your personal review invitation.'}</p>}</section>;
}
