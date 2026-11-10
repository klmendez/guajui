import React, { useState } from 'react';
import { CheckCircle2, FileUser, Plus, X } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { communities } from '../../data/communities';
import { educationLevels, formatWorkDuration, saveResume, workDurationMonths } from '../../data/resumeStore';

const emptyJob = () => ({ role: '', organization: '', place: '', startMonth: '', endMonth: '', current: false });
const thisMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };

export default function HojasDeVidaPage() {
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [educationDetails, setEducationDetails] = useState({});
  const [jobs, setJobs] = useState([emptyJob()]);
  const [noExperience, setNoExperience] = useState(false);
  const [sent, setSent] = useState(false);
  const [saving,setSaving]=useState(false);
  const [error, setError] = useState('');

  const toggleLevel = (level) => setSelectedLevels((current) => current.includes(level) ? current.filter((item) => item !== level) : [...current, level]);
  const updateEducation = (level, key, value) => setEducationDetails((current) => ({ ...current, [level]: { ...(current[level] || {}), [key]: value } }));
  const updateJob = (index, key, value) => setJobs((current) => current.map((job, itemIndex) => itemIndex === index ? { ...job, [key]: value } : job));
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedLevels.length) return setError('Selecciona al menos un nivel de estudios.');
    const education = educationLevels.filter((level) => selectedLevels.includes(level)).map((level) => ({ level, institution: educationDetails[level]?.institution?.trim() || '', place: educationDetails[level]?.place?.trim() || '', completionMonth: educationDetails[level]?.inProgress ? '' : educationDetails[level]?.completionMonth || '', inProgress: Boolean(educationDetails[level]?.inProgress) }));
    if (education.some((item) => !item.institution || (!item.inProgress && !item.completionMonth))) return setError('Completa la institución y la fecha de finalización de cada estudio, o marca «En curso».');
    const workExperience = noExperience ? [] : jobs.map((job) => ({ ...job, role: job.role.trim(), organization: job.organization.trim(), place: job.place.trim(), durationMonths: workDurationMonths(job.startMonth, job.current ? thisMonth() : job.endMonth) }));
    if (!noExperience && workExperience.some((job) => !job.role || !job.organization || !job.place || !job.startMonth || (!job.current && !job.endMonth))) return setError('Completa cada experiencia laboral o marca que no tienes experiencia.');
    if (workExperience.some((job) => !job.durationMonths)) return setError('La fecha de finalización del trabajo debe ser igual o posterior a la de inicio.');
    if (!form.get('consent')) return setError('Autoriza el tratamiento de los datos para enviar la hoja de vida.');
    try {
      if(saving)return; setSaving(true);
      await saveResume({
        fullName: form.get('fullName')?.toString().trim() || '',
        community: form.get('community')?.toString() || '',
        residence: form.get('residence')?.toString().trim() || '',
        documentNumber: form.get('documentNumber')?.toString().trim() || '',
        phone: form.get('phone')?.toString().trim() || '',
        email: form.get('email')?.toString().trim() || '',
        education,
        workExperience,
      });
      setError('');
      setSent(true);
    } catch (caught) {
      setError(caught.message || 'No se pudo guardar la hoja de vida.');
    } finally {setSaving(false);}
  };
  const restart = () => {
    setSelectedLevels([]);
    setEducationDetails({});
    setJobs([emptyJob()]);
    setNoExperience(false);
    setSent(false);
  };

  return <>
    <PageHero eyebrow="Oportunidades comunitarias" title="Banco de hojas de vida" description="Registra tus estudios, experiencia laboral y datos de contacto para el banco comunitario." />
    <section className="section resume-bank-section">
      {sent ? <div className="success-box"><CheckCircle2 /><h2>Hoja de vida recibida</h2><p>Tu información quedó registrada en el banco comunitario.</p><button type="button" className="button outline" onClick={restart}>Registrar otra hoja de vida</button></div> :
        <form className="survey-form resume-bank-form" onSubmit={submit}>
          <header><FileUser /><div><span className="status">Banco comunitario</span><h2>Tus datos</h2><p>Los campos marcados con asterisco son obligatorios.</p></div></header>
          <div className="resume-form-grid">
            <label>Nombres y apellidos *<input name="fullName" autoComplete="name" required /></label>
            <label>Comunidad *<select name="community" required defaultValue=""><option value="">Selecciona tu comunidad</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Lugar de vivienda actual *<input name="residence" required placeholder="Comunidad, municipio o dirección" /></label>
            <label>Número de cédula *<input name="documentNumber" inputMode="numeric" required /></label>
          </div>

          <div className="resume-section-heading"><h3>Nivel de estudios *</h3><p>Selecciona todos los niveles que correspondan y completa sus datos.</p></div>
          <div className="resume-education-list">{educationLevels.map((level) => {
            const checked = selectedLevels.includes(level);
            const details = educationDetails[level] || {};
            return <div className="resume-education-item" key={level}>
              <label className="resume-level-toggle"><input type="checkbox" checked={checked} onChange={() => toggleLevel(level)} /> {level}</label>
              {checked && <div className="resume-form-grid">
                <label>Institución o universidad *<input value={details.institution || ''} onChange={(event) => updateEducation(level, 'institution', event.target.value)} required /></label>
                <label>Ciudad o lugar<input value={details.place || ''} onChange={(event) => updateEducation(level, 'place', event.target.value)} /></label>
                <label>Cuándo terminó *<input type="month" max={thisMonth()} value={details.completionMonth || ''} onChange={(event) => updateEducation(level, 'completionMonth', event.target.value)} disabled={Boolean(details.inProgress)} required={!details.inProgress} /></label>
                <label className="resume-inline-choice"><input type="checkbox" checked={Boolean(details.inProgress)} onChange={(event) => updateEducation(level, 'inProgress', event.target.checked)} /> En curso</label>
              </div>}
            </div>;
          })}</div>

          <div className="resume-section-heading"><h3>Experiencia laboral</h3><p>Indica cuándo trabajaste, dónde y si continúas allí.</p></div>
          <label className="resume-inline-choice"><input type="checkbox" checked={noExperience} onChange={(event) => setNoExperience(event.target.checked)} /> No tengo experiencia laboral</label>
          {!noExperience && <div className="resume-jobs-list">{jobs.map((job, index) => <div className="resume-job" key={index}>
            <div className="resume-job-heading"><h4>Experiencia {index + 1}</h4>{jobs.length > 1 && <button type="button" aria-label={`Quitar experiencia ${index + 1}`} onClick={() => setJobs((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button>}</div>
            <div className="resume-form-grid">
              <label>Cargo o actividad *<input value={job.role} onChange={(event) => updateJob(index, 'role', event.target.value)} required /></label>
              <label>Empresa u organización *<input value={job.organization} onChange={(event) => updateJob(index, 'organization', event.target.value)} required /></label>
              <label>Lugar de trabajo *<input value={job.place} onChange={(event) => updateJob(index, 'place', event.target.value)} required /></label>
              <label>Desde *<input type="month" max={thisMonth()} value={job.startMonth} onChange={(event) => updateJob(index, 'startMonth', event.target.value)} required /></label>
              <label>Hasta *<input type="month" min={job.startMonth || undefined} max={thisMonth()} value={job.endMonth} onChange={(event) => updateJob(index, 'endMonth', event.target.value)} disabled={job.current} required={!job.current} /></label>
              <label className="resume-inline-choice"><input type="checkbox" checked={job.current} onChange={(event) => updateJob(index, 'current', event.target.checked)} /> Trabajo actualmente aquí</label>
            </div>
            {job.startMonth && (job.endMonth || job.current) && <small>Duración: {formatWorkDuration(workDurationMonths(job.startMonth, job.current ? thisMonth() : job.endMonth))}</small>}
          </div>)}<button type="button" className="button outline" onClick={() => setJobs((current) => [...current, emptyJob()])}><Plus /> Añadir experiencia</button></div>}

          <div className="resume-section-heading"><h3>Contacto</h3></div>
          <div className="resume-form-grid"><label>Teléfono *<input name="phone" type="tel" autoComplete="tel" required /></label><label>Correo electrónico *<input name="email" type="email" autoComplete="email" required /></label></div>
          <label className="resume-inline-choice resume-consent"><input name="consent" type="checkbox" required /> Autorizo el tratamiento de mis datos para el banco comunitario de hojas de vida.</label>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={saving}>Enviar hoja de vida</button>
        </form>}
    </section>
  </>;
}
