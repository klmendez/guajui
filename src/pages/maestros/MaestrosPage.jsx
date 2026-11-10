import React, { useEffect, useState } from 'react';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { communities } from '../../data/communities';
import { findTeacherCandidates, getTeachers, registerTeacher, searchTeachers } from '../../data/teacherStore';
import { attendanceSummary, evaluationCriteria, findOverlappingEvaluation, generateSchoolDays, saveTeacherEvaluation } from '../../data/teacherEvaluationStore';

const empty = { community: '', site: '', teacherName: '', grades: '', periodStart: '', periodEnd: '', absenceJustification: '', absenceNotes: '', strengths: '', improvements: '', observations: '' };
const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
const choices = [['full', 'Asistió y cumplió la jornada'], ['partial', 'Asistió parcialmente'], ['absent', 'No asistió']];

export default function MaestrosPage() {
  const [form, setForm] = useState(empty);
  const [teacherChoice, setTeacherChoice] = useState('');
  const [teachers, setTeachers] = useState(getTeachers);
  const [days, setDays] = useState([]);
  const [ratings, setRatings] = useState({});
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    let active=true;
    if(form.teacherName.trim().length<3 || !form.community){setTeachers([]);return;}
    const timer=setTimeout(()=>searchTeachers(form.teacherName,form.community).then(items=>{if(active)setTeachers(items);}).catch(()=>{if(active)setTeachers([]);}),350);
    return()=>{active=false;clearTimeout(timer);};
  },[form.teacherName,form.community]);
  const candidates = findTeacherCandidates(form.teacherName, form.community, teachers);
  const summary = attendanceSummary(days);
  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (['teacherName', 'community'].includes(key)) setTeacherChoice('');
    if (['periodStart', 'periodEnd'].includes(key)) setDays([]);
    setError('');
  };
  const updateDay = (index, patch) => setDays((current) => current.map((day, position) => position === index ? { ...day, ...patch } : day));
  const generate = () => {
    try { setDays(generateSchoolDays(form.periodStart, form.periodEnd)); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  const duplicate = days.length > 0 && findOverlappingEvaluation({ teacherId: teacherChoice && teacherChoice !== '__new__' ? teacherChoice : '', teacherName: form.teacherName, community: form.community, site: form.site, periodStart: form.periodStart, periodEnd: form.periodEnd });
  const submit = async (event) => {
    event.preventDefault();
    if (candidates.length && !teacherChoice) return setError('Confirma si se trata de un docente registrado.');
    if (teacherChoice === '__new__' && candidates.some((item) => item.exact && item.sameCommunity)) return setError('Selecciona al docente registrado para conservar su historial.');
    if (!days.length) return setError('Genera los días del período.');
    if (duplicate) return setError('Ya existe un registro de este docente, sede y período. Solicita al Consejo completarlo o corregirlo.');
    if (evaluationCriteria.some(([key]) => !ratings[key])) return setError('Califica cada criterio o marca N/O.');
    try {
      if(saving)return; setSaving(true);
      const teacher = registerTeacher(form.teacherName, form.community, teacherChoice === '__new__' ? '' : teacherChoice);
      await saveTeacherEvaluation({ ...form, teacherId: teacher.id, teacherName: teacher.name, attendance: days, performance: { ratings, strengths: form.strengths, improvements: form.improvements, observations: form.observations } });
      setTeachers(getTeachers()); setSent(true); setError('');
    } catch (failure) { setError(failure.message || 'No se pudo guardar el registro.'); } finally {setSaving(false);}
  };
  return <>
    <PageHero eyebrow="Participación comunitaria" title="Registro de asistencia y desempeño docente" description="Verifica las jornadas escolares y comparte tu valoración del trabajo docente en la comunidad." />
    <section className="section teacher-followup-section">
      {sent ? <div className="success-box"><CheckCircle2 /><h2>Registro recibido</h2><p>Quedó pendiente de verificación por el Consejo Comunitario.</p><button type="button" className="button outline" onClick={() => { setSent(false); setForm(empty); setDays([]); setRatings({}); setTeacherChoice(''); }}>Registrar otro período</button></div> :
        <form className="survey-form teacher-followup-form" onSubmit={submit}>
          <header><GraduationCap /><div><span className="status">Consejo Comunitario del Río Guajuí</span><h2>Completa el seguimiento</h2><p>Completa los datos que conozcas. Los registros serán verificados antes de considerarse definitivos.</p></div></header>
          <div className="teacher-form-heading"><h3>1. Identificación del docente</h3></div>
          <div className="teacher-followup-grid">
            <label>Comunidad *<select value={form.community} onChange={(event) => update('community', event.target.value)} required><option value="">Selecciona la comunidad</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Institución o sede educativa *<input value={form.site} onChange={(event) => update('site', event.target.value)} required /></label>
            <label>Nombre del docente *<input value={form.teacherName} onChange={(event) => update('teacherName', event.target.value)} autoComplete="off" required /></label>
            <label>Grado o grados a cargo<input value={form.grades} onChange={(event) => update('grades', event.target.value)} /></label>
          </div>
          {!!candidates.length && <fieldset className="teacher-match-box"><legend>¿Te refieres a alguno de estos docentes?</legend><p>Selecciona el nombre correcto para mantener su historial.</p>{candidates.map((teacher) => <label key={teacher.id}><input type="radio" name="teacherMatch" checked={teacherChoice === teacher.id} onChange={() => setTeacherChoice(teacher.id)} /> {teacher.name} · {teacher.community}{teacher.exact ? ' (coincidencia exacta)' : ''}</label>)}{!candidates.some((teacher) => teacher.exact && teacher.sameCommunity) && <label><input type="radio" name="teacherMatch" checked={teacherChoice === '__new__'} onChange={() => setTeacherChoice('__new__')} /> Es otra persona</label>}</fieldset>}
          <div className="teacher-form-heading"><h3>2. Control de asistencia</h3><p>Indica el período que debía cumplir. Se proponen lunes a viernes; ajusta las fechas programadas según el calendario de la sede.</p></div>
          <div className="teacher-followup-grid"><label>Fecha inicial *<input type="date" value={form.periodStart} onChange={(event) => update('periodStart', event.target.value)} required /></label><label>Fecha final *<input type="date" value={form.periodEnd} onChange={(event) => update('periodEnd', event.target.value)} required /></label></div>
          <button type="button" className="button outline" onClick={generate}>Generar días del período</button>
          {!!days.length && <div className="teacher-days"><h4>Registro por fecha <small>{summary.scheduled} días programados</small></h4>{days.map((day, index) => <div className="teacher-day" key={day.date}><div><strong>{dateLabel(day.date)}</strong><label className="teacher-scheduled"><input type="checkbox" checked={day.scheduled} onChange={(event) => updateDay(index, { scheduled: event.target.checked, status: event.target.checked ? day.status : '' })} /> Jornada programada</label></div>{day.scheduled && <div className="teacher-day-options">{choices.map(([value, label]) => <label key={value}><input type="radio" name={`attendance-${day.date}`} checked={day.status === value} onChange={() => updateDay(index, { status: value })} /> {label}</label>)}<button type="button" onClick={() => updateDay(index, { status: '' })} disabled={!day.status}>Dejar pendiente</button></div>}</div>)}</div>}
          {!!days.length && <div className="teacher-summary"><h4>Resumen del período</h4><div>{[['Días programados', summary.scheduled], ['Asistencia completa', summary.full], ['Inasistencias', summary.absent], ['Asistencia parcial', summary.partial], ['Pendientes', summary.pending]].map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div><p>Porcentaje de asistencia completa: <strong>{summary.percentage}%</strong></p></div>}
          {duplicate && <p className="inline-message error" role="alert">Ya existe un registro para este docente, sede y período. El Consejo puede completarlo o corregirlo.</p>}
          <label>¿Se conoce la justificación de las ausencias?<select value={form.absenceJustification} onChange={(event) => update('absenceJustification', event.target.value)}><option value="">Selecciona una opción</option><option value="official">Sí, fue informada oficialmente</option><option value="none">No se informó justificación</option><option value="unknown">No tengo conocimiento</option></select></label>
          <label>Información adicional sobre las ausencias<textarea rows="3" value={form.absenceNotes} onChange={(event) => update('absenceNotes', event.target.value)} /></label>
          <div className="teacher-form-heading"><h3>3. Evaluación del desempeño docente</h3><p>Califica solo lo que pudiste observar: 1 muy deficiente · 2 deficiente · 3 aceptable · 4 bueno · 5 excelente · N/O no observado.</p></div>
          <div className="teacher-criteria">{evaluationCriteria.map(([key, label]) => <fieldset key={key}><legend>{label} *</legend><div>{['1', '2', '3', '4', '5', 'NO'].map((value) => <label key={value}><input type="radio" name={`rating-${key}`} checked={ratings[key] === value} onChange={() => setRatings((current) => ({ ...current, [key]: value }))} /> {value === 'NO' ? 'N/O' : value}</label>)}</div></fieldset>)}</div>
          <div className="teacher-form-heading"><h3>4. Observaciones y aspectos positivos</h3></div>
          <label>¿Qué aspectos destaca del trabajo del docente?<textarea rows="3" value={form.strengths} onChange={(event) => update('strengths', event.target.value)} /></label>
          <label>¿Qué considera que debería mejorar?<textarea rows="3" value={form.improvements} onChange={(event) => update('improvements', event.target.value)} /></label>
          <label>Observaciones generales<textarea rows="3" value={form.observations} onChange={(event) => update('observations', event.target.value)} /></label>
          <p className="teacher-privacy"><strong>Confidencialidad y verificación.</strong> La información se usará para el seguimiento educativo comunitario. Los registros serán revisados por el Consejo y estarán bajo acceso autorizado.</p>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={saving || !!duplicate}>Enviar registro</button>
        </form>}
    </section>
  </>;
}
