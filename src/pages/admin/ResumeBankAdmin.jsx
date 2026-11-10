import React, { useEffect, useState } from 'react';
import { FileUser } from 'lucide-react';
import { communities, sameCommunity } from '../../data/communities';
import { formatWorkDuration, getResumes, loadResumes, workDurationMonths } from '../../data/resumeStore';

const formatMonth = (value) => value ? new Date(`${value}-01T12:00:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : 'Sin fecha';
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };

export default function ResumeBankAdmin() {
  const [resumes, setResumes] = useState(getResumes);
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    try { setResumes(await loadResumes()); setLoadError(''); }
    catch (failure) { setLoadError(failure.message); }
  };
  useEffect(() => { refresh(); }, []);
  const [community, setCommunity] = useState('');
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('es');
  const visible = resumes
    .filter((resume) => !community || sameCommunity(resume.community, community))
    .filter((resume) => !query || [resume.fullName, resume.documentNumber, resume.residence, resume.phone, resume.email].some((value) => String(value || '').toLocaleLowerCase('es').includes(query)))
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));

  return <div className="resume-bank-admin">
    {loadError && <p className="inline-message error" role="alert">{loadError}</p>}
    <div className="admin-toolbar"><div><h2>Banco de hojas de vida</h2><p>{resumes.length} hojas de vida recibidas.</p></div><button type="button" className="button outline" onClick={refresh}>Actualizar lista</button></div>
    <div className="participation-notes-filters"><label>Comunidad<select value={community} onChange={(event) => setCommunity(event.target.value)}><option value="">Todas las comunidades</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label>Buscar por nombre, cédula o contacto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar hojas de vida" /></label></div>
    {!visible.length ? <div className="empty-panel"><FileUser /><h3>{resumes.length ? 'No hay hojas de vida con esos filtros' : 'Aún no hay hojas de vida'}</h3><p>{resumes.length ? 'Cambia los filtros para ver más registros.' : 'Los formularios enviados aparecerán aquí.'}</p></div> :
      <div className="resume-admin-list">{visible.map((resume) => <article key={resume.id}>
        <div className="resume-admin-heading"><div><span className="eyebrow">{resume.community} · {resume.residence}</span><h3>{resume.fullName}</h3><p>Cédula: {resume.documentNumber} · Teléfono: {resume.phone} · Correo: {resume.email}</p></div><small>Recibida: {new Date(resume.submittedAt).toLocaleString('es-CO')}</small></div>
        <div><h4>Estudios</h4><div className="resume-admin-education">{(resume.education || []).map((item, index) => <div key={`${item.level}-${index}`}><b>{item.level}</b><span>{item.institution}{item.place ? ` · ${item.place}` : ''}</span><small>{item.inProgress ? 'En curso' : `Terminó: ${formatMonth(item.completionMonth)}`}</small></div>)}</div></div>
        <div><h4>Experiencia laboral</h4>{resume.workExperience?.length ? <ol className="resume-admin-work">{resume.workExperience.map((job, index) => <li key={index}><b>{job.role}</b> · {job.organization} · {job.place}<small>{formatMonth(job.startMonth)} — {job.current ? 'Actualmente' : formatMonth(job.endMonth)} · {formatWorkDuration(workDurationMonths(job.startMonth, job.current ? currentMonth() : job.endMonth))}</small></li>)}</ol> : <p>Sin experiencia laboral registrada.</p>}</div>
      </article>)}</div>}
  </div>;
}
