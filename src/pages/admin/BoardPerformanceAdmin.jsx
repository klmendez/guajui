import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { communities, sameCommunity } from '../../data/communities';
import { boardPerformanceSurvey, getSurveyResponses, loadServiceResponses } from '../../data/surveyStore';

const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';

export default function BoardPerformanceAdmin() {
  const [responses, setResponses] = useState(() => getSurveyResponses(boardPerformanceSurvey.id));
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    try { setResponses(await loadServiceResponses(boardPerformanceSurvey.id)); setLoadError(''); }
    catch (failure) { setLoadError(failure.message); }
  };
  useEffect(() => { refresh(); }, []);
  const [community, setCommunity] = useState('');
  const [position, setPosition] = useState('');
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('es');
  const visible = responses.filter(({ answers }) =>
    (!community || sameCommunity(answers.community, community)) &&
    (!position || answers.position === position) &&
    (!query || [answers.memberName, answers.recommendations].some((value) => String(value || '').toLocaleLowerCase('es').includes(query)))
  ).sort((a, b) => String(b.answers.recordDate || b.submittedAt).localeCompare(String(a.answers.recordDate || a.submittedAt)));
  return <div className="board-performance-admin">
    {loadError && <p className="inline-message error" role="alert">{loadError}</p>}
    <div className="admin-toolbar"><div><h2>Desempeño de la junta de gobierno</h2><p>{responses.length} evaluaciones recibidas.</p></div><button type="button" className="button outline" onClick={refresh}>Actualizar lista</button></div>
    <div className="board-admin-filters">
      <label>Comunidad<select value={community} onChange={(event) => setCommunity(event.target.value)}><option value="">Todas las comunidades</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Cargo<select value={position} onChange={(event) => setPosition(event.target.value)}><option value="">Todos los cargos</option>{boardPerformanceSurvey.questions[2].options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Nombre o recomendación<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evaluación" /></label>
    </div>
    {!visible.length ? <div className="empty-panel"><Users /><h3>{responses.length ? 'No hay evaluaciones con esos filtros' : 'Aún no hay evaluaciones'}</h3></div> :
      <div className="board-performance-list">{visible.map(({ id, answers, submittedAt }) => <article key={id}><div className="board-record-heading"><div><span className="eyebrow">{answers.community} · {answers.position}</span><h3>{answers.memberName}</h3></div><strong aria-label={`Desempeño: ${answers.rating} de 5`}>{answers.rating} / 5</strong></div><p><b>Fecha evaluada:</b> {formatDate(answers.recordDate)} · <b>Enviada:</b> {new Date(submittedAt).toLocaleString('es-CO')}</p><div><h4>Recomendaciones</h4><p>{answers.recommendations || 'No se registraron recomendaciones.'}</p></div></article>)}</div>}
  </div>;
}
