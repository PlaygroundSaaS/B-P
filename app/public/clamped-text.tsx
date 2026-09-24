'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
// Shows the first few lines of long text with a toggle; short text shows no toggle.
export default function ClampedText({text,lines,className,buttonClassName='public-review-toggle',moreLabel='Read full review',lessLabel='Show less'}:{text:string;lines:number;className?:string;buttonClassName?:string;moreLabel?:string;lessLabel?:string}){
 const ref=useRef<HTMLQuoteElement>(null),[expanded,setExpanded]=useState(false),[overflows,setOverflows]=useState(false);
 useEffect(()=>{const element=ref.current;if(!element||expanded)return;const measure=()=>setOverflows(element.scrollHeight>element.clientHeight+1);measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[text,lines,expanded]);
 return <><blockquote ref={ref} className={`${className??''} clamped-text${expanded?'':' is-clamped'}${overflows&&!expanded?' is-faded':''}`} style={{'--clamp-lines':lines} as CSSProperties}>{text}</blockquote>{(overflows||expanded)&&<button type="button" className={buttonClassName} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?lessLabel:moreLabel}</button>}</>;
}
