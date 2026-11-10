import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ClipboardPenLine,Edit3,Plus,X,Trash2,Download,FileDown,Users,BarChart3,ClipboardList} from 'lucide-react';
import {communities,sameCommunity} from '../../data/communities';
import {getMeetings,loadMeetings,saveMeeting} from '../../data/meetingStore';
import {getSurveyResponses,loadServiceResponses,participationNotesSurvey,meetingAttendanceSurvey,makeId,calculateAge} from '../../data/surveyStore';
export function ParticipationNotesAdmin() {
  const [responses, setResponses] = useState(() => getSurveyResponses(participationNotesSurvey.id));
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    try { setResponses(await loadServiceResponses(participationNotesSurvey.id)); setLoadError(''); }
    catch (failure) { setLoadError(failure.message); }
  };
  useEffect(() => { refresh(); }, []);
  const [community, setCommunity] = useState('');
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('es');
  const visible = responses
    .filter((response) => !community || sameCommunity(response.answers.community, community))
    .filter((response) => !query || [response.answers.participantName, response.answers.facts, response.answers.possibleSolution].some((value) => String(value || '').toLocaleLowerCase('es').includes(query)))
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  const eventDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';

  return <div className="participation-notes-admin">
    {loadError && <p className="inline-message error" role="alert">{loadError}</p>}
    <div className="admin-toolbar"><div><h2>Apuntes de participación</h2><p>{responses.length} apuntes enviados por la comunidad.</p></div><button type="button" className="button outline" onClick={refresh}>Actualizar lista</button></div>
    <div className="participation-notes-filters">
      <label>Comunidad<select value={community} onChange={(event) => setCommunity(event.target.value)}><option value="">Todas las comunidades</option>{communities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Buscar por nombre o contenido<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar apuntes" /></label>
    </div>
    {!visible.length ? <div className="empty-panel"><ClipboardPenLine /><h3>{responses.length ? 'No hay apuntes con esos filtros' : 'Aún no hay apuntes'}</h3><p>{responses.length ? 'Cambia la comunidad o la búsqueda.' : 'Los apuntes enviados desde el formulario público aparecerán aquí.'}</p></div> :
      <div className="participation-notes-list">{visible.map((response) => <article key={response.id}>
        <div className="participation-note-meta"><b>{response.answers.participantName || 'Nombre no informado'}</b><span>{response.answers.community || 'Comunidad no informada'}</span><small>Fecha del hecho: {eventDate(response.answers.eventDate)} · Enviado: {new Date(response.submittedAt).toLocaleString('es-CO')}</small></div>
        <div><h3>Hechos</h3><p>{response.answers.facts || 'Sin descripción'}</p></div>
        <div><h3>Posible solución</h3><p>{response.answers.possibleSolution || 'No se propuso una solución.'}</p></div>
      </article>)}</div>}
  </div>;
}

export function MeetingAttendanceAdmin() {
  const [responses, setResponses] = useState(() => getSurveyResponses(meetingAttendanceSurvey.id));
  const [loadError, setLoadError] = useState('');
  const refresh = async () => {
    try { setResponses(await loadServiceResponses(meetingAttendanceSurvey.id)); setLoadError(''); }
    catch (failure) { setLoadError(failure.message); }
  };
  useEffect(() => { refresh(); }, []);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('es');
  const visible = responses
    .filter((response) => !query || [response.answers.meetingName, response.answers.objective, response.answers.place, response.answers.contactName, response.answers.institution, response.answers.organization, ...(Array.isArray(response.answers.topics) ? response.answers.topics : [])].some((value) => String(value || '').toLocaleLowerCase('es').includes(query)))
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
  const formatMeetingDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';

  return <div className="meeting-attendance-admin">
    {loadError && <p className="inline-message error" role="alert">{loadError}</p>}
    <MeetingCatalogAdmin responses={responses} />
    <div className="admin-toolbar"><div><h2>Asistencias recibidas</h2><p>{responses.length} personas registradas.</p></div><button type="button" className="button outline" onClick={refresh}>Actualizar lista</button></div>
    <div className="participation-notes-filters"><label>Buscar por nombre, lugar, tema o contacto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar asistencias" /></label></div>
    {!visible.length ? <div className="empty-panel"><CalendarDays /><h3>{responses.length ? 'No hay asistencias con esa búsqueda' : 'Aún no hay asistencias'}</h3><p>{responses.length ? 'Prueba con otro término.' : 'Las asistencias enviadas desde el formulario público aparecerán aquí.'}</p></div> :
      <div className="meeting-attendance-list">{visible.map((response) => {
        const answers = response.answers;
        const topics = Array.isArray(answers.topics) ? answers.topics : [];
        const agreements = Array.isArray(answers.agreements) ? answers.agreements : [];
        return <article key={response.id}>
          <div className="meeting-record-heading"><div><span className="eyebrow">{formatMeetingDate(answers.meetingDate)} · {answers.place || 'Lugar sin informar'}</span><h3>{answers.meetingName || answers.objective || 'Reunión sin nombre'}</h3><p>{answers.objective}</p></div><small>Enviado: {new Date(response.submittedAt).toLocaleString('es-CO')}</small></div>
          <div><h4>Temas</h4><div className="meeting-tags">{topics.length ? topics.map((topic, index) => <span key={`${topic}-${index}`}>{topic}</span>) : <p>Sin temas registrados.</p>}</div></div>
          <div><h4>Acuerdos</h4>{agreements.length ? <ol className="meeting-record-agreements">{agreements.map((agreement, index) => <li key={index}>{agreement}</li>)}</ol> : <p>Sin acuerdos registrados.</p>}</div>
          <div><h4>Conclusiones</h4><p>{answers.conclusions || 'Sin conclusiones registradas.'}</p></div>
          <div className="meeting-record-contact"><h4>Contacto</h4><p><b>{answers.contactName || 'Nombre no informado'}</b> · {answers.contactPhone || 'Sin celular'}</p><p>Institución: {answers.institution || 'No informada'} · Organización: {answers.organization || 'No informada'}</p><p>Cargo: {answers.position || 'No informado'} · Correo: {answers.contactEmail || 'No informado'}</p></div>
        </article>;
      })}</div>}
  </div>;
}

function MeetingCatalogAdmin({ responses }) {
  const [meetings, setMeetings] = useState(getMeetings);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  useEffect(() => { loadMeetings().then(setMeetings).catch((failure) => setMessage(failure.message)); }, []);
  const formatMeetingDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';
  const save = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await saveMeeting({
        ...(editing?.id ? { id: editing.id } : {}),
        name: form.get('name')?.toString().trim() || '',
        meetingDate: form.get('meetingDate')?.toString() || '',
        objective: form.get('objective')?.toString().trim() || '',
        place: form.get('place')?.toString().trim() || '',
      });
      setMeetings(await loadMeetings());
      setEditing(null);
      setMessage('La reunión quedó guardada y aparece en el formulario público de asistencia.');
    } catch {
      setMessage('No se pudo guardar la reunión. Inténtalo de nuevo.');
    }
  };

  return <div className="meeting-catalog-admin">
    <div className="admin-toolbar"><div><h2>Reuniones disponibles</h2><p>Crea cada reunión para que las personas puedan elegirla por nombre y fecha.</p></div><button type="button" className="button primary" onClick={() => { setEditing({}); setMessage(''); }}><Plus /> Nueva reunión</button></div>
    {message && <p className="inline-message" role="status">{message}</p>}
    {editing && <form className="survey-form meeting-editor" key={editing.id || 'new'} onSubmit={save}>
      <h3>{editing.id ? 'Editar reunión' : 'Crear reunión'}</h3>
      <div className="meeting-contact-grid"><label>Nombre de la reunión *<input name="name" defaultValue={editing.name || ''} required /></label><label>Fecha *<input name="meetingDate" type="date" defaultValue={editing.meetingDate || ''} required /></label></div>
      <label>Objetivo de la reunión *<textarea name="objective" rows="3" defaultValue={editing.objective || ''} required /></label>
      <label>Lugar *<input name="place" defaultValue={editing.place || ''} required /></label>
      <div className="meeting-editor-actions"><button type="button" className="button outline" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary">Guardar reunión</button></div>
    </form>}
    {!meetings.length ? <div className="empty-panel"><CalendarDays /><h3>Aún no has creado reuniones</h3><p>Crea la primera para habilitar el registro público de asistencia.</p></div> :
      <div className="meeting-catalog-list">{meetings.slice().sort((a, b) => String(a.meetingDate || '').localeCompare(String(b.meetingDate || ''))).map((meeting) => <article key={meeting.id}>
        <div><span className="eyebrow">{formatMeetingDate(meeting.meetingDate)} · {meeting.place}</span><h3>{meeting.name}</h3><p>{meeting.objective}</p><small>{responses.filter((response) => response.answers.meetingId === meeting.id).length} asistencias</small></div>
        <button type="button" className="button outline" onClick={() => { setEditing(meeting); setMessage(''); }}><Edit3 /> Editar</button>
      </article>)}</div>}
  </div>;
}

export function SurveyBuilder({ onCancel, onSave, initial }) {
  const [questions, setQuestions] = useState(
    initial
      ? initial.questions.map((question) => ({
          ...question,
          optionsText: (question.options || []).join("\n"),
        }))
      : [
          {
            id: makeId("pregunta"),
            label: "",
            type: "select",
            required: true,
            optionsText: "Sí\nNo",
          },
        ],
  );
  useEffect(() => {
    if (!initial) return;
    const form = document.querySelector(".survey-builder");
    if (!form) return;
    form.elements.title.value = initial.title;
    form.elements.description.value = initial.description;
    form.elements.closesAt.value = initial.closesAt;
    form.elements.publish.checked = initial.status === "published";
  }, [initial]);
  const update = (id, changes) =>
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    );
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      id: initial?.id || makeId("encuesta"),
      title: form.get("title").trim(),
      description: form.get("description").trim(),
      closesAt: form.get("closesAt"),
      status: form.get("publish") ? "published" : "draft",
      createdAt: initial?.createdAt || new Date().toISOString(),
      questions: questions.map(({ optionsText, ...question }) => ({
        ...question,
        label: question.label.trim(),
        options: ["select", "radio", "checkbox"].includes(question.type)
          ? optionsText
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
      })),
    });
  };
  return (
    <form className="survey-builder" onSubmit={submit}>
      <div className="builder-heading">
        <button type="button" className="icon-button" onClick={onCancel}>
          <X />
        </button>
        <div>
          <h2>Configurar encuesta</h2>
          <p>Define la información que verá la comunidad.</p>
        </div>
      </div>
      <div className="builder-card form-grid">
        <label>
          Título
          <input
            name="title"
            required
            placeholder="Ej. Prioridades para 2027"
          />
        </label>
        <label>
          Fecha de cierre
          <input name="closesAt" type="date" required />
        </label>
        <label className="full-field">
          Descripción
          <textarea
            name="description"
            rows="3"
            required
            placeholder="Explica brevemente el propósito de la encuesta"
          />
        </label>
      </div>
      <div className="question-list">
        <div className="question-list-title">
          <h3>Preguntas</h3>
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              setQuestions([
                ...questions,
                {
                  id: makeId("pregunta"),
                  label: "",
                  type: "text",
                  required: true,
                  optionsText: "",
                },
              ])
            }
          >
            <Plus /> Agregar pregunta
          </button>
        </div>
        {questions.map((question, index) => (
          <article key={question.id}>
            <b>{index + 1}</b>
            <div className="question-fields">
              <label>
                Pregunta
                <input
                  value={question.label}
                  required
                  onChange={(e) =>
                    update(question.id, { label: e.target.value })
                  }
                />
              </label>
              <label>
                Tipo
                <select
                  value={question.type}
                  onChange={(e) =>
                    update(question.id, { type: e.target.value })
                  }
                >
                  <option value="text">Respuesta corta</option>
                  <option value="textarea">Respuesta larga</option>
                  <option value="number">Número</option>
                  <option value="select">Lista desplegable</option>
                  <option value="radio">Opción única</option>
                  <option value="checkbox">Selección múltiple</option>
                  <option value="yesno">Sí o no</option>
                  <option value="scale">Escala de 1 a 5</option>
                  <option value="date">Fecha</option>
                  <option value="email">Correo electrónico</option>
                  <option value="tel">Teléfono</option>
                </select>
              </label>
              {["select", "radio", "checkbox"].includes(question.type) && (
                <label className="full-field">
                  Opciones (una por línea)
                  <textarea
                    rows="3"
                    required
                    value={question.optionsText}
                    onChange={(e) =>
                      update(question.id, { optionsText: e.target.value })
                    }
                  />
                </label>
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) =>
                    update(question.id, { required: e.target.checked })
                  }
                />{" "}
                Obligatoria
              </label>
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                className="icon-button danger-action"
                onClick={() =>
                  setQuestions(
                    questions.filter((item) => item.id !== question.id),
                  )
                }
              >
                <Trash2 />
              </button>
            )}
          </article>
        ))}
      </div>
      <div className="builder-footer">
        <label className="check-field">
          <input name="publish" type="checkbox" /> Publicar inmediatamente
        </label>
        <div>
          <button type="button" className="button outline" onClick={onCancel}>
            Cancelar
          </button>
          <button className="button primary">Guardar encuesta</button>
        </div>
      </div>
    </form>
  );
}

export function SurveyReport({ survey, onBack, responseData }) {
  const responses = useMemo(
    () => responseData || getSurveyResponses(survey.id),
    [survey.id, responseData],
  );
  const download = () => {
    const fields = survey.questions.filter((q) => q.type !== "section");
    const rows = [
      ["Fecha", ...fields.map((q) => q.label)],
      ...responses.map((r) => [
        new Date(r.submittedAt).toLocaleString("es-CO"),
        ...fields.map((q) =>
          Array.isArray(r.answers[q.id])
            ? r.answers[q.id].join("; ")
            : r.answers[q.id] || "",
        ),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    link.download = `${survey.title}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const fields = survey.questions.filter(
    (question) => question.type !== "section",
  );
  const censusIndicatorIds = [
    "community",
    "sex",
    "genderIdentity",
    "disability",
    "ethnicity",
    "sisben",
    "canWrite",
    "canRead",
    "currentlyStudying",
    "academicLevel",
    "productiveActivities",
    "traditionalRoles",
    "familiasAccion",
    "rentaCiudadana",
    "adultoMayor",
  ];
  const reportFields =
    survey.id === "censo-interno-guajui"
      ? fields.filter((field) => censusIndicatorIds.includes(field.id))
      : fields;
  const incomplete = responses
    .map((response) => ({
      response,
      missing: fields.filter(
        (field) =>
          field.id !== "age" &&
          (() => {
            const value = response.answers[field.id];
            return (
              value === "Falta actualizar" ||
              (Array.isArray(value) && value.includes("Falta actualizar"))
            );
          })(),
      ).length,
    }))
    .filter((item) => item.missing);
  return (
    <div className="survey-report">
      <div className="report-heading">
        <button className="button outline" onClick={onBack}>
          Volver
        </button>
        <div>
          <span className="eyebrow">Informe automático</span>
          <h2>{survey.title}</h2>
          <p>
            Resultados consolidados con la información recogida hasta este
            momento.
          </p>
        </div>
        <div>
          <button className="button outline" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
          <button
            className="button primary"
            onClick={download}
            disabled={!responses.length}
          >
            Descargar CSV
          </button>
        </div>
      </div>
      <div className="report-metrics">
        <article>
          <span>Registros recibidos</span>
          <b>{responses.length}</b>
        </article>
        <article>
          <span>Variables analizadas</span>
          <b>
            {reportFields.length +
              (survey.id === "censo-interno-guajui" ? 1 : 0)}
          </b>
        </article>
        {survey.id === "censo-interno-guajui" && (
          <article>
            <span>Personas por actualizar</span>
            <b>{incomplete.length}</b>
          </article>
        )}
        <article>
          <span>Estado</span>
          <b>{survey.status === "published" ? "Abierta" : "Cerrada"}</b>
        </article>
      </div>
      {survey.id === "censo-interno-guajui" && incomplete.length > 0 && (
        <div className="update-list">
          <h3>Personas con información obligatoria pendiente</h3>
          <p>
            Solo se marcan los datos indispensables o las preguntas que debían
            responderse. Los nombres adicionales, correo, hectáreas y demás
            campos opcionales pueden quedar vacíos.
          </p>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Documento</th>
                  <th>Estado</th>
                  <th>Campos pendientes</th>
                </tr>
              </thead>
              <tbody>
                {incomplete.map(({ response, missing }) => (
                  <tr key={response.id}>
                    <td>
                      <b>
                        {[
                          response.answers.firstName,
                          response.answers.middleName,
                          response.answers.lastName1,
                        ]
                          .filter(
                            (value) => value && value !== "Falta actualizar",
                          )
                          .join(" ") || "Falta actualizar"}
                      </b>
                    </td>
                    <td>{response.answers.documentNumber}</td>
                    <td>
                      <span className="missing-badge">Falta actualizar</span>
                    </td>
                    <td>{missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!responses.length ? (
        <div className="empty-panel">
          <BarChart3 />
          <h3>Aún no hay respuestas</h3>
          <p>
            El informe se actualizará automáticamente cuando la comunidad
            responda.
          </p>
        </div>
      ) : (
        <>
          <div className="report-section-title">
            <span className="eyebrow">Caracterización</span>
            <h3>Indicadores demográficos y comunitarios</h3>
            <p>
              Distribuciones calculadas a partir de los registros censales
              depurados.
            </p>
          </div>
          <div className="chart-grid">
            {survey.id === "censo-interno-guajui" && (
              <AgeDistribution responses={responses} />
            )}{" "}
            {reportFields.map((question) => (
              <QuestionResult
                key={question.id}
                question={question}
                responses={responses}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuestionResult({ question, responses }) {
  const rawValues = responses
    .map((response) => response.answers[question.id])
    .filter((value) => (Array.isArray(value) ? value.length : Boolean(value)));
  const chartTypes = ["select", "radio", "checkbox", "yesno", "scale"];
  if (!chartTypes.includes(question.type))
    return (
      <article className="chart-card text-results">
        <h3>{question.label}</h3>
        <span>{rawValues.length} respuestas</span>
        <div>
          {rawValues.slice(0, 8).map((value, index) => (
            <p key={index}>“{value}”</p>
          ))}
        </div>
        {rawValues.length > 8 && (
          <small>
            y {rawValues.length - 8} respuestas más en el archivo CSV
          </small>
        )}
      </article>
    );
  const values = rawValues.flat();
  const baseOptions =
    question.type === "yesno"
      ? ["Sí", "No"]
      : question.type === "scale"
        ? ["1", "2", "3", "4", "5"]
        : question.options;
  const extraOptions = [
    ...new Set(values.filter((value) => !baseOptions.includes(value))),
  ];
  const options = [...baseOptions, ...extraOptions];
  const counts = options.map((option) => ({
    option,
    count: values.filter((value) => value === option).length,
  }));
  const max = Math.max(...counts.map((item) => item.count), 1);
  if (
    [
      "sex",
      "genderIdentity",
      "ethnicity",
      "sisben",
      "currentlyStudying",
      "familiasAccion",
      "rentaCiudadana",
      "adultoMayor",
    ].includes(question.id)
  )
    return (
      <PieChart
        title={question.label}
        counts={counts}
        total={rawValues.length}
      />
    );
  return (
    <article className="chart-card">
      <h3>{question.label}</h3>
      <span>
        {rawValues.length} respuestas
        {question.type === "checkbox" ? " · se permitían varias opciones" : ""}
      </span>
      <div className="bar-chart">
        {counts.map((item) => (
          <div className="bar-row" key={item.option}>
            <label>{item.option}</label>
            <div>
              <i style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <b>
              {item.count}{" "}
              <small>
                (
                {rawValues.length
                  ? Math.round((item.count / rawValues.length) * 100)
                  : 0}
                %)
              </small>
            </b>
          </div>
        ))}
      </div>
    </article>
  );
}

const chartColors = [
  "#174b3c",
  "#d9ae3f",
  "#4f8c78",
  "#b96f43",
  "#78909c",
  "#7a5d8e",
  "#9cab67",
  "#a33e3e",
];
function PieChart({ title, counts, total }) {
  const visible = counts.filter((item) => item.count > 0);
  let cursor = 0;
  const stops = visible.map((item, index) => {
    const start = cursor;
    cursor += total ? (item.count / total) * 100 : 0;
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
  });
  return (
    <article className="chart-card pie-card">
      <h3>{title}</h3>
      <span>{total} personas</span>
      <div className="pie-layout">
        <div
          className="pie"
          style={{
            background: visible.length
              ? `conic-gradient(${stops.join(",")})`
              : "var(--soft)",
          }}
        >
          <b>{total}</b>
          <small>personas</small>
        </div>
        <div className="pie-legend">
          {visible.map((item, index) => (
            <div key={item.option}>
              <i
                style={{ background: chartColors[index % chartColors.length] }}
              />
              <span>{item.option}</span>
              <b>
                {item.count}{" "}
                <small>{Math.round((item.count / total) * 100)}%</small>
              </b>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function AgeDistribution({ responses }) {
  const ranges = [
    { option: "0–5 años", min: 0, max: 5 },
    { option: "6–11 años", min: 6, max: 11 },
    { option: "12–17 años", min: 12, max: 17 },
    { option: "18–28 años", min: 18, max: 28 },
    { option: "29–59 años", min: 29, max: 59 },
    { option: "60 años o más", min: 60, max: 120 },
  ];
  const ages = responses
    .map((response) => Number(response.answers.age))
    .filter((age) => Number.isFinite(age));
  const missing = responses.length - ages.length;
  const counts = ranges.map((range) => ({
    option: range.option,
    count: ages.filter((age) => age >= range.min && age <= range.max).length,
  }));
  if (missing) counts.push({ option: "Falta actualizar", count: missing });
  const max = Math.max(...counts.map((item) => item.count), 1);
  return (
    <article className="chart-card">
      <h3>Personas por grupo de edad</h3>
      <span>{ages.length} edades calculadas desde la fecha de nacimiento</span>
      <div className="bar-chart">
        {counts.map((item) => (
          <div className="bar-row" key={item.option}>
            <label>{item.option}</label>
            <div>
              <i style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
            <b>
              {item.count}{" "}
              <small>
                (
                {responses.length
                  ? Math.round((item.count / responses.length) * 100)
                  : 0}
                %)
              </small>
            </b>
          </div>
        ))}
      </div>
    </article>
  );
}

