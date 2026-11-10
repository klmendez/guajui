import { useEffect, useState } from 'react';
import { rows, rpc } from './platformStore';
export const loadContent = async () => (await rows('content_items',query=>query.order('created_at',{ascending:false}))).map(item=>({
  ...item.data,...item,id:item.id,communityId:item.community_id,authorId:item.author_id,
  tag:item.section,date:item.data.publicationDate,image:item.data.image || '/assets/paisaje-juanico.webp',
}));
export const saveContent = item => rpc('save_publication',{item});
export function usePublishedContent(kind) {
  const [items,setItems]=useState([]);
  const [error,setError]=useState('');
  useEffect(()=>{ let active=true; loadContent().then(data=>{if(active)setItems(data.filter(item=>item.status==='Aprobada' && (!kind || item.kind===kind)));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;}; },[kind]);
  return {items,error};
}
