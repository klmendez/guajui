import React, { useState } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { boardPerformanceSurvey, makeId, saveResponse } from '../../data/surveyStore';

export default function JuntaPage() {
  const [sent, setSent] = useState(false);
  const [saving,setSaving]=useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answers = Object.fromEntries(boardPerformanceSurvey.questions.map(({ id }) => [id, String(form.get(id) || '').trim()]));
    const missing = boardPerformanceSurvey.questions.find(({ id, required }) => required && !answers[id]);
    if (missing) return setError(`Completa el campo «${missing.label}».`);
    if (!['1', '2', '3', '4', '5'].includes(answers.rating)) return setError('Selecciona una calificación entre 1 y 5.');
    try {
      if(saving)return; setSaving(true);
      await saveResponse({ id: makeId('seguimiento-junta'), surveyId: boardPerformanceSurvey.id, submittedAt: new Date().toISOString(), answers });
      setError('');
      setSent(true);
    } catch { setError('No se pudo guardar la evaluación. Inténtalo de nuevo.'); } finally {setSaving(false);}
  };
  return <>
    <PageHero eyebrow="Participación comunitaria" title="Seguimiento del desempeño de la junta" description="Evalúa el trabajo de una persona de la junta de gobierno y comparte tus recomendaciones." />
    <section className="section board-performance-section">
      {sent ? <div className="success-box"><CheckCircle2 /><h2>Evaluación recibida</h2><p>Gracias por compartir tu valoración con el Consejo.</p><button type="button" className="button outline" onClick={() => setSent(false)}>Evaluar a otra persona</button></div> :
        <form className="survey-form board-performance-form" onSubmit={submit}>
          <header><Users /><div><span className="status">Consejo Comunitario del Río Guajuí</span><h2>Seguimiento del desempeño de la junta</h2><p>Registra una evaluación por cada persona de la junta de gobierno.</p></div></header>
          <div className="board-performance-grid">
            <label>Fecha *<input type="date" name="recordDate" required /></label>
            <label>Comunidad *<select name="community" defaultValue="" required><option value="">Selecciona tu comunidad</option>{boardPerformanceSurvey.questions[1].options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Cargo en la junta de gobierno *<select name="position" defaultValue="" required><option value="">Selecciona el cargo</option>{boardPerformanceSurvey.questions[2].options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Nombre de la persona de la junta *<input name="memberName" type="text" autoComplete="name" required /></label>
          </div>
          <fieldset className="board-rating"><legend>Desempeño *</legend><p>1 = muy deficiente · 2 = deficiente · 3 = aceptable · 4 = bueno · 5 = excelente</p><div>{[1, 2, 3, 4, 5].map((value) => <label key={value}><input type="radio" name="rating" value={value} required /> {value}</label>)}</div></fieldset>
          <label>Recomendaciones a la persona de la junta<textarea name="recommendations" rows="5" placeholder="Comparte propuestas concretas para mejorar su gestión" /></label>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={saving}>Enviar evaluación</button>
        </form>}
    </section>
  </>;
}
