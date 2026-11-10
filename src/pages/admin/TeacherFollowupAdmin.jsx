import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { communities, sameCommunity } from '../../data/communities';
import { attendanceSummary, evaluationCriteria, getTeacherEvaluations, loadTeacherEvaluations, saveTeacherEvaluation, teacherPeriodRanking } from '../../data/teacherEvaluationStore';

const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : 'No informada';
const statusLabels = { full: 'Asistió y cumplió', partial: 'Asistió parcialmente', absent: 'No asistió' };
const justificationLabels = { official: 'Informada oficialmente', none: 'No se informó', unknown: 'No tengo conocimiento' };

function RecordEditor({ record, onSaved, onCancel }) {
  const [draft, setDraft] = useState(record);
  const [error, setError] = useState('');
  const summary = attendanceSummary(draft.attendance);
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateDay = (index, patch) => update({ attendance: draft.attendance.map((day, position) => position === index ? { ...day, ...patch } : day) });
  const save = async (status) => {
    try { await saveTeacherEvaluation({ ...draft, status }); onSaved(); }
    catch (failure) { setError(failure.message); }
  };
  return <div className="teacher-admin-editor">
    <h4>Corregir y verificar</h4>
    <div className="teacher-followup-grid"><label>Comunidad<select value={draft.community} onChange={(event) => update({ community: event.target.value })}>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label>Institución o sede<input value={draft.site} onChange={(event) => update({ site: event.target.value })} /></label><label>Docente<input value={draft.teacherName} onChange={(event) => update({ teacherName: event.target.value })} /></label><label>Grados<input value={draft.grades} onChange={(event) => update({ grades: event.target.value })} /></label></div>
    <div className="teacher-admin-days">{draft.attendance.map((day, index) => <div key={day.date}><b>{formatDate(day.date)}</b><label><input type="checkbox" checked={day.scheduled} onChange={(event) => updateDay(index, { scheduled: event.target.checked, status: event.target.checked ? day.status : '' })} /> Programada</label><select aria-label={`Asistencia ${day.date}`} value={day.scheduled ? day.status : ''} disabled={!day.scheduled} onChange={(event) => updateDay(index, { status: event.target.value })}><option value="">Pendiente</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div>
    <p>{summary.scheduled} programados · {summary.full} completos · {summary.partial} parciales · {summary.absent} ausencias · {summary.pending} pendientes · {summary.percentage}% asistencia completa</p>
    <div className="teacher-followup-grid"><label>Justificación<select value={draft.absenceJustification} onChange={(event) => update({ absenceJustification: event.target.value })}><option value="">Sin respuesta</option>{Object.entries(justificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Información sobre ausencias<textarea value={draft.absenceNotes} onChange={(event) => update({ absenceNotes: event.target.value })} /></label></div>
    <div className="teacher-admin-ratings">{evaluationCriteria.map(([key, label]) => <label key={key}>{label}<select value={draft.performance.ratings[key]} onChange={(event) => update({ performance: { ...draft.performance, ratings: { ...draft.performance.ratings, [key]: event.target.value } } })}>{['1', '2', '3', '4', '5', 'NO'].map((value) => <option key={value} value={value}>{value === 'NO' ? 'N/O' : value}</option>)}</select></label>)}</div>
    {['strengths', 'improvements', 'observations'].map((key) => <label key={key} className="teacher-admin-text">{ { strengths: 'Aspectos destacados', improvements: 'Aspectos por mejorar', observations: 'Observaciones generales' }[key] }<textarea rows="3" value={draft.performance[key]} onChange={(event) => update({ performance: { ...draft.performance, [key]: event.target.value } })} /></label>)}
    {error && <p className="inline-message error" role="alert">{error}</p>}
    <div className="teacher-admin-actions"><button type="button" className="button outline" onClick={onCancel}>Cancelar</button><button type="button" className="button outline" onClick={() => save('Pendiente')}>Guardar pendiente</button><button type="button" className="button primary" onClick={() => save('Verificado')}>Guardar y verificar</button></div>
  </div>;
}

export default function TeacherFollowupAdmin() {
  const [records, setRecords] = useState(getTeacherEvaluations);
  const [period, setPeriod] = useState('monthly');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [community, setCommunity] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    try { setRecords(await loadTeacherEvaluations()); setEditingId(''); setLoadError(''); }
    catch (failure) { setLoadError(failure.message); }
  };
  useEffect(() => { refresh(); }, []);
  const years = [...new Set([year, ...records.flatMap((item) => [item.periodStart.slice(0, 4), item.periodEnd.slice(0, 4)])])].sort((a, b) => b.localeCompare(a));
  const filter = { year, month: period === 'monthly' ? month : '' };
  const ranking = teacherPeriodRanking(records, { ...filter, community });
  const council = teacherPeriodRanking(records, filter);
  const winners = (items) => items.filter((item) => item.average === items[0]?.average && item.absenceDays === items[0]?.absenceDays);
  const communityWinners = communities.map((name) => ({ name, entries: winners(teacherPeriodRanking(records, { ...filter, community: name })) })).filter((item) => item.entries.length);
  const query = search.trim().toLocaleLowerCase('es');
  const visible = records.filter((item) => (!selectedTeacherId || item.teacherId === selectedTeacherId) && (!community || selectedTeacherId || sameCommunity(item.community, community)) && (!query || [item.teacherName, item.site, item.community, item.performance?.observations].some((value) => String(value || '').toLocaleLowerCase('es').includes(query)))).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const label = period === 'monthly' ? `${months[Number(month) - 1]} de ${year}` : `año ${year}`;
  return <div className="teacher-followup-admin">
    {loadError && <p className="inline-message error" role="alert">{loadError}</p>}
    <div className="admin-toolbar"><div><h2>Asistencia y desempeño docente</h2><p>{records.length} registros · {records.filter((item) => item.status === 'Pendiente').length} pendientes de verificación. La clasificación usa únicamente registros verificados.</p></div><button type="button" className="button outline" onClick={refresh}>Actualizar lista</button></div>
    <div className="teacher-ranking-filters"><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label><label>Año<select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{period === 'monthly' && <label>Mes<select value={month} onChange={(event) => setMonth(event.target.value)}>{months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}</select></label>}<label>Comunidad<select value={community} onChange={(event) => setCommunity(event.target.value)}><option value="">Todas</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label></div>
    <div className="teacher-ranking-summary"><h3>Mejor desempeño · {label}</h3><p>Promedio de los criterios observados (1 a 5). En empate, se priorizan menos días de ausencia registrados. N/O no influye en el promedio.</p><div className="teacher-ranking-cards"><article><span>Todo el Consejo</span>{council.length ? <><b>{winners(council).map((item) => item.teacherName).join(' · ')}</b><small>{council[0].average.toFixed(2)} / 5 · {council[0].absenceDays} ausencias</small></> : <p>Sin evaluaciones verificadas.</p>}</article>{community && <article><span>{community}</span>{ranking.length ? <><b>{winners(ranking).map((item) => item.teacherName).join(' · ')}</b><small>{ranking[0].average.toFixed(2)} / 5 · {ranking[0].absenceDays} ausencias</small></> : <p>Sin evaluaciones verificadas.</p>}</article>}</div>{!community && !!communityWinners.length && <div className="teacher-community-winners"><h4>Por comunidad</h4><div>{communityWinners.map(({ name, entries }) => <article key={name}><span>{name}</span><b>{entries.map((item) => item.teacherName).join(' · ')}</b><small>{entries[0].average.toFixed(2)} / 5 · {entries[0].absenceDays} ausencias</small></article>)}</div></div>}</div>
    <div className="teacher-ranking-table"><h3>Clasificación {community ? `en ${community}` : 'del Consejo'}</h3>{ranking.length ? <div className="admin-table"><table><thead><tr><th>Puesto</th><th>Docente</th><th>Comunidad y sede</th><th>Promedio</th><th>Asistencia</th><th>Ausencias</th><th>Historial</th></tr></thead><tbody>{ranking.map((item) => <tr key={`${item.teacherId}-${item.community}`}><td>{ranking.findIndex((other) => other.average === item.average && other.absenceDays === item.absenceDays) + 1}</td><td>{item.teacherName}</td><td>{item.community}<br /><small>{item.sites}</small></td><td>{item.average.toFixed(2)} / 5</td><td>{item.percentage}% ({item.full}/{item.scheduled})</td><td>{item.absenceDays} días</td><td><button type="button" className="button outline" onClick={() => setSelectedTeacherId(item.teacherId)}>Ver historial</button></td></tr>)}</tbody></table></div> : <p>Sin evaluaciones verificadas en este período.</p>}</div>
    <div className="admin-toolbar"><div><h2>Historial y verificación</h2><p>{selectedTeacherId ? 'Registros de este docente, incluidos otros períodos.' : 'Revisa los datos antes de verificarlos.'}</p></div>{selectedTeacherId && <button type="button" className="button outline" onClick={() => setSelectedTeacherId('')}>Ver todos</button>}</div>
    <div className="participation-notes-filters"><label>Buscar docente o sede<input value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    {!visible.length ? <div className="empty-panel"><GraduationCap /><h3>Aún no hay registros con esos filtros</h3></div> : <div className="teacher-followup-list">{visible.map((item) => {
      const summary = attendanceSummary(item.attendance);
      return <article key={item.id}><div className="teacher-followup-heading"><div><span className="eyebrow">{item.community} · {item.site} · {item.status}</span><h3>{item.teacherName}</h3></div><small>Enviado: {new Date(item.submittedAt).toLocaleString('es-CO')}</small></div><div className="teacher-followup-dates"><span>Período: <b>{formatDate(item.periodStart)} – {formatDate(item.periodEnd)}</b></span><span>Grados: <b>{item.grades || 'No informado'}</b></span></div><p>{summary.scheduled} jornadas · {summary.full} completas · {summary.partial} parciales · {summary.absent} ausencias · {summary.pending} pendientes · {summary.percentage}% asistencia completa</p><details><summary>Ver fechas y valoración</summary><ul>{item.attendance.filter((day) => day.scheduled).map((day) => <li key={day.date}>{formatDate(day.date)}: {statusLabels[day.status] || 'Pendiente'}</li>)}</ul><p>Justificación: {justificationLabels[item.absenceJustification] || 'No informada'}. {item.absenceNotes}</p>{evaluationCriteria.map(([key, label]) => <p key={key}>{label}: <b>{item.performance.ratings[key] === 'NO' ? 'N/O' : item.performance.ratings[key]}</b></p>)}<p><b>Aspectos destacados:</b> {item.performance.strengths || 'No informados'}</p><p><b>Por mejorar:</b> {item.performance.improvements || 'No informado'}</p><p><b>Observaciones:</b> {item.performance.observations || 'No informadas'}</p></details>{editingId === item.id ? <RecordEditor record={item} onSaved={refresh} onCancel={() => setEditingId('')} /> : <button type="button" className="button outline" onClick={() => setEditingId(item.id)}>Corregir o verificar</button>}</article>;
    })}</div>}
  </div>;
}
