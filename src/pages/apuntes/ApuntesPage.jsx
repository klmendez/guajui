import React, { useState } from 'react';
import { CheckCircle2, ClipboardPenLine } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { participationNotesSurvey, makeId, saveResponse } from '../../data/surveyStore';

export default function ApuntesPage() {
  const [sent, setSent] = useState(false);
  const [saving,setSaving]=useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const answers = Object.fromEntries(participationNotesSurvey.questions.map((question) => [question.id, form.get(question.id)?.toString().trim() || '']));
    const missing = participationNotesSurvey.questions.find((question) => question.required && !answers[question.id]);
    if (missing) {
      setError(`Completa el campo «${missing.label}».`);
      return;
    }
    try {
      if(saving)return; setSaving(true);
      await saveResponse({
        id: makeId('apunte'),
        surveyId: participationNotesSurvey.id,
        submittedAt: new Date().toISOString(),
        answers,
      });
      setError('');
      setSent(true);
    } catch {
      setError('No se pudo guardar el apunte. Inténtalo de nuevo.');
    } finally {setSaving(false);}
  };

  return <>
    <PageHero eyebrow="Participación comunitaria" title="Apuntes de participación" description="Comparte hechos de tu comunidad y propón posibles soluciones para que el Consejo los conozca." />
    <section className="section participation-notes-section">
      {sent ? <div className="success-box"><CheckCircle2 /><h2>Apunte recibido</h2><p>Gracias por compartir lo que ocurre en tu comunidad.</p><button type="button" className="button outline" onClick={() => setSent(false)}>Escribir otro apunte</button></div> :
        <form className="survey-form participation-notes-form" onSubmit={submit}>
          <header><ClipboardPenLine /><div><span className="status">Diario Consejo Guajuí</span><h2>Cuéntanos qué está pasando</h2><p>{participationNotesSurvey.description}</p></div></header>
          <fieldset className="service-fieldset"><legend>1. Tu comunidad y tus datos</legend><div className="service-fields">
          <label><span>Comunidad <span className="required-mark">*</span></span><select name="community" required defaultValue=""><option value="">Selecciona tu comunidad</option>{participationNotesSurvey.questions[0].options.map((community) => <option key={community} value={community}>{community}</option>)}</select></label>
          <label><span>Nombre completo <span className="required-mark">*</span></span><input name="participantName" type="text" autoComplete="name" required /></label>
          <label><span>Fecha <span className="required-mark">*</span></span><input name="eventDate" type="date" required /></label>
          </div></fieldset>
          <fieldset className="service-fieldset"><legend>2. Lo que sucede en tu comunidad</legend>
          <label><span>Hechos <span className="required-mark">*</span></span><textarea name="facts" rows="6" required placeholder="Describe lo que sucedió en tu comunidad" /></label>
          <label><span>Posible solución</span><textarea name="possibleSolution" rows="5" placeholder="Escribe tu propuesta, si tienes una" /></label>
          </fieldset>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={saving}>Enviar apunte</button>
        </form>}
    </section>
  </>;
}
