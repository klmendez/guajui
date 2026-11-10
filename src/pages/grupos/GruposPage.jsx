import React,{useState,useEffect} from 'react';
import PageHero from '../../components/ui/PageHero';
import {rows,communityNames} from '../../data/platformStore';
export function GroupDirectory({kind}){
  const [items,setItems]=useState([]);const [error,setError]=useState('');
  useEffect(()=>{let active=true;rows('community_groups',q=>q.eq('kind',kind).eq('published',true).order('name')).then(data=>{if(active)setItems(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[kind]);
  return <section className="section">{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>Los grupos publicados por el Consejo aparecerán aquí.</p>}<div className="profile-grid">{items.map(item=><article key={item.id}><small>{communityNames[item.community_id] || 'Río Guajuí'}</small><h2>{item.name}</h2><p>{item.description}</p>{item.contact_public&&<p>Contacto: {item.contact_public}</p>}</article>)}</div></section>;
}
export default function GruposPage(){return <><PageHero eyebrow="Participación comunitaria" title="Grupos poblacionales" description="Procesos y organizaciones que participan en el Consejo."/><GroupDirectory kind="population"/></>;}
