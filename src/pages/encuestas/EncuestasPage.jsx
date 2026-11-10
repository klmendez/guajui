import { getAdminSession } from '../../data/adminUserStore';
import {usePlatformSession} from '../../data/platformSession';
import { communities } from '../../data/communities';
import React, { useEffect, useState } from 'react';
import PageHero from '../../components/ui/PageHero';
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3 } from 'lucide-react';
import { boardPerformanceSurvey, formatDate, loadSurveys, isSurveyOpen, makeId, meetingAttendanceSurvey, participationNotesSurvey, saveResponse, teacherFollowupSurvey } from '../../data/surveyStore';

export default function EncuestasPage() {
  usePlatformSession();
  const [surveys,setSurveys]=useState([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{loadSurveys().then(items=>setSurveys(items.filter(isSurveyOpen))).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  const [selectedId, setSelectedId] = useState('');
  const [sent, setSent] = useState(false);
  const selected = surveys.find(survey => survey.id === selectedId);
  const submit = async event => {
    event.preventDefault();
    if(saving)return;
    const form = new FormData(event.currentTarget);
    const responseQuestions = selected.questions.filter(question => question.type !== 'section');
    const missingMultiple = responseQuestions.find(question => question.type === 'checkbox' && question.required && form.getAll(question.id).length === 0);
    if (missingMultiple) { window.alert(`Selecciona al menos una opción en “${missingMultiple.label}”.`); return; }
    const answers = Object.fromEntries(responseQuestions.map(question => [question.id, question.type === 'checkbox' ? form.getAll(question.id).map(item => item.toString().trim()) : form.get(question.id)?.toString().trim() || '']));
    answers.community = answers.community || form.get('responseCommunity');
    const actor = getAdminSession();
    setSaving(true);
    try { await saveResponse({ collectedBy: actor ? { id: actor.id, name: actor.username } : null, id: makeId('respuesta'), surveyId: selected.id, submittedAt: new Date().toISOString(), answers }); setSent(true);setError(''); }
    catch(e){setError(e.message);} finally{setSaving(false);}
  };
  return <><PageHero eyebrow="Participación comunitaria" title="Encuestas comunitarias" description="Tus respuestas ayudan a orientar actividades, proyectos y decisiones del Consejo."/><section className="section survey-public-section">
    {error && <p className="inline-message error" role="alert">{error}</p>}
    {loading && <p role="status">Cargando encuestas…</p>}
    {saving && <p role="status">Enviando respuesta…</p>}
    {!surveys.length ? <div className="empty-panel survey-empty"><ClipboardCheck/><h2>No hay encuestas abiertas</h2><p>Cuando el Consejo publique una nueva encuesta aparecerá aquí.</p></div> : sent ? <div className="success-box"><CheckCircle2/><h2>Respuesta registrada</h2><p>Gracias por participar. Tu información ya hace parte del informe consolidado.</p><button className="button outline" onClick={() => setSent(false)}>Responder nuevamente</button></div> : <>
      {!selected && <><div className="survey-list-heading"><span className="eyebrow">Participa</span><h2>Encuestas disponibles</h2><p>Selecciona una encuesta para conocer su propósito y responderla.</p></div><div className="available-surveys">{surveys.map(survey => <article key={survey.id}><ClipboardCheck/><div><span className="status">Abierta</span><h3>{survey.title}</h3><p>{survey.description}</p><small><Clock3/> {Math.max(2, Math.ceil(survey.questions.length * .45))} minutos</small><small><CalendarDays/> Cierra el {formatDate(survey.closesAt)}</small></div><button className="button primary" onClick={() => setSelectedId(survey.id)}>Responder encuesta</button></article>)}</div></>}
      {selected && <><button className="back-button" onClick={() => setSelectedId('')}>Ver todas las encuestas</button><form className="survey-form public-survey-form" onSubmit={submit}><header><ClipboardCheck/><div><span className="status">Encuesta abierta</span><h2>{selected.title}</h2><p>{selected.description}</p><small><Clock3/> {Math.max(2, Math.ceil(selected.questions.filter(q => q.type !== 'section').length * .45))} minutos <CalendarDays/> Cierra el {formatDate(selected.closesAt)}</small></div></header>{!selected.questions.some(question => question.id === "community") && <label>Comunidad<select name="responseCommunity" required><option value="">Selecciona</option>{communities.map(name => <option key={name}>{name}</option>)}</select></label>}{selected.questions.map(question => <SurveyField question={question} key={question.id}/>) }<button className="button primary" disabled={saving}>Enviar respuesta</button></form></>}
    </>}
  </section></>;
}

function SurveyField({ question }) {
  if (question.type === 'section') return <div className="survey-section"><h3>{question.label}</h3>{question.help && <p>{question.help}</p>}</div>;
  if (question.id === 'age') return <label>{question.label}<small className="field-help">Se actualiza automáticamente a partir de la fecha de nacimiento.</small><input name={question.id} readOnly placeholder="Cálculo automático"/></label>;
  const common = { name: question.id, required: question.required };
  if (['radio', 'checkbox', 'yesno', 'scale'].includes(question.type)) {
    const options = question.type === 'yesno' ? ['Sí', 'No'] : question.type === 'scale' ? ['1', '2', '3', '4', '5'] : question.options;
    return <fieldset className="survey-choice"><legend>{question.label}{question.required && <span className="required-mark"> *</span>}</legend>{question.help && <p className="field-help">{question.help}</p>}<div className={question.type === 'scale' ? 'scale-options' : ''}>{options.map(option => <label key={option}><input name={question.id} value={option} type={question.type === 'checkbox' ? 'checkbox' : 'radio'} required={question.required && question.type !== 'checkbox'}/><span>{option}</span></label>)}</div>{question.type === 'scale' && <small><span>Muy bajo</span><span>Muy alto</span></small>}</fieldset>;
  }
  const inputType = ['number', 'date', 'email', 'tel'].includes(question.type) ? question.type : 'text';
  return <label><span>{question.label}{question.required && <span className="required-mark"> *</span>}</span>{question.help && <small className="field-help">{question.help}</small>}{question.type === 'textarea' ? <textarea {...common} rows="5"/> : question.type === 'select' ? <select {...common}><option value="">Selecciona una opción</option>{question.options.map(option => <option key={option}>{option}</option>)}</select> : <input {...common} type={inputType}/>}</label>;
}
