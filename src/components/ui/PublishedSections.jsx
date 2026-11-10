import React,{useState,useEffect} from 'react';
import {rows} from '../../data/platformStore';
export default function PublishedSections({slug}){
  const [page,setPage]=useState(null);
  useEffect(()=>{let active=true;rows('site_pages',q=>q.eq('slug',slug).eq('published',true)).then(items=>{if(active)setPage(items[0] || null);}).catch(()=>{});return()=>{active=false;};},[slug]);
  return page?<section className="section"><h2>{page.title}</h2>{page.sections.map((section,index)=><article key={index}><h3>{section.heading}</h3><p style={{whiteSpace:'pre-wrap'}}>{section.body}</p></article>)}</section>:null;
}
