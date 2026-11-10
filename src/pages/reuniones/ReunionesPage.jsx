import React, { useEffect, useState } from 'react';
import { CalendarCheck2, CheckCircle2, Plus, X } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { getMeetings, loadMeetings } from '../../data/meetingStore';
import { makeId, meetingAttendanceSurvey, saveResponse } from '../../data/surveyStore';

const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha';
const uniqueTopics = (values) => [...new Map(values.map((value) => value.trim()).filter(Boolean).map((value) => [value.toLocaleLowerCase('es'), value])).values()];

export default function ReunionesPage() {
  const [meetings, setMeetings] = useState(() => getMeetings().sort((a, b) => String(a.meetingDate || '').localeCompare(String(b.meetingDate || ''))));
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingId, setMeetingId] = useState('');
  const [topics, setTopics] = useState([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [agreements, setAgreements] = useState(['']);
  const [sent, setSent] = useState(false);
  const [saving,setSaving]=useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadMeetings().then((items) => { if (active) setMeetings(items); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoadingMeetings(false); });
    return () => { active = false; };
  }, []);
  const selected = meetings.find((meeting) => meeting.id === meetingId);
  const addTopic = () => {
    setTopics((current) => uniqueTopics([...current, topicDraft]));
    setTopicDraft('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return setError('Selecciona una reunión.');
    const form = new FormData(event.currentTarget);
    const contact = Object.fromEntries(['contactName', 'contactPhone', 'institution', 'organization', 'position', 'contactEmail'].map((key) => [key, form.get(key)?.toString().trim() || '']));
    const enteredTopics = uniqueTopics([...topics, topicDraft]);
    const enteredAgreements = agreements.map((value) => value.trim()).filter(Boolean);
    const conclusions = form.get('conclusions')?.toString().trim() || '';
    if (!enteredTopics.length) return setError('Agrega al menos un tema.');
    if (!enteredAgreements.length) return setError('Agrega al menos un acuerdo.');
    if (!conclusions) return setError('Completa las conclusiones.');
    if (!contact.contactName || !contact.contactPhone) return setError('Completa el nombre y el número de celular.');
    try {
      if(saving)return; setSaving(true);
      await saveResponse({
        id: makeId('asistencia'),
        surveyId: meetingAttendanceSurvey.id,
        submittedAt: new Date().toISOString(),
        answers: {
          meetingId: selected.id,
          meetingName: selected.name,
          meetingDate: selected.meetingDate,
          objective: selected.objective,
          place: selected.place,
          topics: enteredTopics,
          agreements: enteredAgreements,
          conclusions,
          ...contact,
        },
      });
      setError('');
      setSent(true);
    } catch {
      setError('No se pudo guardar la asistencia. Inténtalo de nuevo.');
    } finally {setSaving(false);}
  };

  return <>
    <PageHero eyebrow="Participación comunitaria" title="Asistencia a reuniones" description="Selecciona la reunión y registra tus temas, acuerdos, conclusiones y datos de contacto." />
    <section className="section meeting-attendance-section">
      {sent ? <div className="success-box"><CheckCircle2 /><h2>Asistencia registrada</h2><p>Quedaste registrado en {selected?.name}.</p><button type="button" className="button outline" onClick={() => { setSent(false); setMeetingId(''); setTopics([]); setTopicDraft(''); setAgreements(['']); }}>Registrar otra asistencia</button></div> :
        loadingMeetings ? <div className="empty-panel"><CalendarCheck2 /><h2>Cargando reuniones</h2></div> :
        !meetings.length ? <div className="empty-panel"><CalendarCheck2 /><h2>Aún no hay reuniones disponibles</h2><p>{error || 'Cuando el Consejo cree una reunión, aparecerá aquí para registrar la asistencia.'}</p></div> :
        <form className="survey-form meeting-attendance-form" onSubmit={submit}>
          <header><CalendarCheck2 /><div><span className="status">Registro de asistencia</span><h2>Elige tu reunión</h2><p>La reunión ya tiene nombre, fecha, objetivo y lugar. Tú completas los demás datos.</p></div></header>
          <label><span>Nombre de la reunión <span className="required-mark">*</span></span><select value={meetingId} onChange={(event) => { setMeetingId(event.target.value); setTopics([]); setTopicDraft(''); setAgreements(['']); setError(''); }} required><option value="">Selecciona una reunión</option>{meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.name} · {formatDate(meeting.meetingDate)}</option>)}</select></label>
          {selected && <div className="meeting-selected-details">
            <span className="eyebrow">{formatDate(selected.meetingDate)} · {selected.place}</span>
            <h3>{selected.name}</h3>
            <p><b>Objetivo:</b> {selected.objective}</p>
          </div>}
          <div className="meeting-list-field"><label htmlFor="meeting-topic">Temas <span className="required-mark">*</span></label><p>Escribe un tema y pulsa Agregar o Enter.</p><div className="meeting-add-row"><input id="meeting-topic" value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTopic(); } }} placeholder="Ejemplo: agua potable" /><button type="button" className="button outline" onClick={addTopic}><Plus /> Agregar</button></div>{topics.length > 0 && <div className="meeting-tags">{topics.map((topic) => <span key={topic}>{topic}<button type="button" aria-label={`Quitar tema ${topic}`} onClick={() => setTopics((current) => current.filter((item) => item !== topic))}><X /></button></span>)}</div>}</div>
          <div className="meeting-list-field"><b>Acuerdos <span className="required-mark">*</span></b><p>Registra cada acuerdo en una línea de la lista.</p><ol className="meeting-agreement-list">{agreements.map((agreement, index) => <li key={index}><input value={agreement} onChange={(event) => setAgreements((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} aria-label={`Acuerdo ${index + 1}`} placeholder={`Acuerdo ${index + 1}`} /><button type="button" aria-label={`Quitar acuerdo ${index + 1}`} disabled={agreements.length === 1} onClick={() => setAgreements((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X /></button></li>)}</ol><button type="button" className="button outline" onClick={() => setAgreements((current) => [...current, ''])}><Plus /> Añadir acuerdo</button></div>
          <label><span>Conclusiones <span className="required-mark">*</span></span><textarea name="conclusions" rows="5" required /></label>
          <div className="meeting-form-subheading"><h3>Datos de contacto</h3><p>Completa tus datos para registrar tu asistencia.</p></div>
          <div className="meeting-contact-grid">
            <label><span>Nombre <span className="required-mark">*</span></span><input name="contactName" type="text" autoComplete="name" required /></label>
            <label><span>Número de celular <span className="required-mark">*</span></span><input name="contactPhone" type="tel" autoComplete="tel" required /></label>
            <label><span>Institución</span><input name="institution" type="text" /></label>
            <label><span>Organización</span><input name="organization" type="text" /></label>
            <label><span>Cargo</span><input name="position" type="text" /></label>
            <label><span>Correo</span><input name="contactEmail" type="email" autoComplete="email" /></label>
          </div>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={saving}>Registrar asistencia</button>
        </form>}
    </section>
  </>;
}
