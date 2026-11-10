import React,{useState} from 'react';
import PageHero from '../../components/ui/PageHero';
import {insertPublic} from '../../data/platformStore';
export default function ContactoPage(){
  const [sent,setSent]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const submit=async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);const id=crypto.randomUUID();setSaving(true);
    try{await insertPublic('contact_requests',{id,name:form.get('name').trim(),contact:form.get('contact').trim(),subject:form.get('subject'),message:form.get('message').trim()});setSent(id);setError('');}catch(e){setError(e.message);}finally{setSaving(false);}
  };
  return <><PageHero eyebrow="Canales de atención" title="Hablemos con el Consejo" description="Envía tus consultas sobre censos, certificados y procesos comunitarios."/><section className="section"><div className="contact-layout"><div className="contact-list"><p>Guapi, Cauca</p><a href="tel:+573102008311">+57 310 200 8311</a><a href="mailto:consejocomunitdelrioguajui@gmail.com">consejocomunitdelrioguajui@gmail.com</a></div>{sent?<div className="success-box"><h2>Consulta recibida</h2><p>Radicado: {sent}</p><button className="button outline" onClick={()=>setSent('')}>Enviar otra consulta</button></div>:<form className="form-card" onSubmit={submit}><h2>Enviar consulta</h2><label>Nombre<input name="name" required/></label><label>Teléfono o correo<input name="contact" required/></label><label>Motivo<select name="subject"><option>Censo comunitario</option><option>Certificado</option><option>Actividad o convocatoria</option><option>Otro</option></select></label><label>Mensaje<textarea name="message" rows="5" required/></label>{error&&<p role="alert">{error}</p>}<button className="button primary" disabled={saving}>Enviar consulta</button></form>}</div></section></>;
}
