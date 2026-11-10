import React,{useState} from 'react';
import PageHero from '../../components/ui/PageHero';
import {usePublishedContent} from '../../data/contentStore';
import {insertPublic} from '../../data/platformStore';
import DataMessage from '../../components/ui/DataMessage';
export default function AgendaPage(){
  const {items,error}=usePublishedContent('Evento');
  const [selected,setSelected]=useState(null);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const submit=async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);setSaving(true);
    try{await insertPublic('event_registrations',{event_id:selected.id,name:form.get('name').trim(),phone:form.get('phone').trim(),document_number:form.get('document').trim()});setMessage('Inscripción recibida.');setSelected(null);}
    catch(e){setMessage(e.message);}finally{setSaving(false);}
  };
  return <><PageHero eyebrow="Agenda comunitaria" title="Actividades y reuniones" description="Consulta las jornadas del Consejo e inscríbete en las actividades."/><section className="section"><DataMessage error={error} empty={!items.length}/>{message&&<p role="status">{message}</p>}<div className="agenda-list">{items.map(item=><article key={item.id}><time>{new Date(item.startsAt).toLocaleString('es-CO')}</time><div><h2>{item.title}</h2><p>{item.place}</p><p>{item.description}</p></div><button onClick={()=>{setSelected(item);setMessage('');}}>Inscribirse</button></article>)}</div>{selected&&<form className="form-card" onSubmit={submit}><h2>{selected.title}</h2><label>Nombre completo<input name="name" required/></label><label>Documento<input name="document" required/></label><label>Teléfono<input name="phone" type="tel" required/></label><div><button type="button" className="button outline" onClick={()=>setSelected(null)}>Cancelar</button><button className="button primary" disabled={saving}>Confirmar participación</button></div></form>}</section></>;
}
