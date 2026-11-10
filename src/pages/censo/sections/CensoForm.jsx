import { sameCommunity } from '../../../data/communities';
import { getAdminSession } from '../../../data/adminUserStore';
import React, { useState, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { calculateAge, censusSurvey } from "../../../data/surveyStore";
import { createCensusRequest, submitCensusBatch, fullName } from "../../../data/censusStore";
import { createHouseholdCode, censusCodes } from '../../../data/censusCodes';

const fields = censusSurvey.questions.filter((question) => question.type !== "section");
const automaticCodeIds = new Set(['householdCode', 'familyCode', 'personCode']);
const sharedFieldIds = new Set([
  "community", "censusDate", "householdCode",
  "residence", "department", "municipality",
  "enumeratorName", "enumeratorDocument", "enumeratorPhone", "enumeratorEmail",
]);
const sharedFields = fields.filter((question) => sharedFieldIds.has(question.id));
const familyFields = fields.filter((question) => question.id === "familyCode");
const memberFields = fields.filter((question) => !sharedFieldIds.has(question.id) && question.id !== "familyCode");

const visibleQuestions = (allowedIds) => censusSurvey.questions.filter((question, index, questions) => {
  if (question.type !== "section") return allowedIds.has(question.id);
  const nextSection = questions.findIndex((item, nextIndex) => nextIndex > index && item.type === "section");
  const end = nextSection === -1 ? questions.length : nextSection;
  return questions.slice(index + 1, end).some((item) => allowedIds.has(item.id));
});

export default function CensoForm({ mode, onBack, community }) {
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const actor = getAdminSession();
  const record = mode.record;
  const initial = record?.answers || {};
  const [newHouseholdCode] = useState(createHouseholdCode);
  const [familyCounts, setFamilyCounts] = useState([1]);
  const [birthDates, setBirthDates] = useState({
    "0-0": initial.birthDate === "Falta actualizar" ? "" : initial.birthDate || "",
  });
  const [radicados, setRadicados] = useState([]);
  const [saving,setSaving]=useState(false);

  const changeFamilyCount = (value) => {
    const count = Math.max(1, Math.min(10, Number(value) || 1));
    setFamilyCounts((current) => Array.from({ length: count }, (_, index) => current[index] || 1));
  };

  const changeMemberCount = (familyIndex, value) => {
    const count = Math.max(1, Math.min(20, Number(value) || 1));
    setFamilyCounts((current) => current.map((size, index) => index === familyIndex ? count : size));
  };

  const readAnswers = (form, prefix, birthDate, questions = fields) => {
    const answers = {};
    const automaticCodes = mode.type === 'new' ? censusCodes(newHouseholdCode, prefix) : initial;
    for (const question of questions) {
      if (question.id === "age") continue;
      if (automaticCodeIds.has(question.id)) {
        answers[question.id] = automaticCodes[question.id] || '';
        continue;
      }
      const name = `${prefix}${question.id}`;
      answers[question.id] =
        question.type === "checkbox"
          ? form.getAll(name)
          : form.get(name)?.toString().trim() || "";
    }
    const missingChoice = questions.find(
      (question) =>
        question.type === "checkbox" &&
        question.required &&
        !answers[question.id]?.length,
    );
    if (missingChoice) {
      window.alert(`Selecciona al menos una opción en “${missingChoice.label}”.`);
      return null;
    }
    const missingRequired = questions.find((question) => {
      if (!question.required || question.id === "age" || question.type === "checkbox" || (mode.type !== 'new' && automaticCodeIds.has(question.id))) return false;
      const value = answers[question.id];
      return !String(value || "").trim();
    });
    if (missingRequired) {
      window.alert(`Completa el campo obligatorio “${missingRequired.label}”.`);
      return null;
    }
    if (questions.some((question) => question.id === "birthDate")) {
      answers.birthDate = birthDate;
      answers.age = calculateAge(birthDate);
    }
    if (
      Number(answers.age) > 18 &&
      !String(answers.documentType).startsWith("CC ·")
    ) {
      window.alert("Las personas mayores de 18 años deben registrar cédula de ciudadanía.");
      return null;
    }
    if (Number(answers.age) > 18 && !answers.documentNumber) {
      window.alert("Ingresa el número de cédula.");
      return null;
    }
    return answers;
  };

  const submit = async (event) => {
    event.preventDefault();
    if(saving)return;
    if (step < steps.length - 1) { nextStep(); return; }
    setSaving(true);
    try {
    const form = new FormData(event.currentTarget);
    if (community && record && !sameCommunity(record.answers.community, community)) return window.alert("Este registro no pertenece a tu comunidad.");
    if (!form.get("familyConsent")) {
      window.alert("Debes autorizar el tratamiento de los datos.");
      return;
    }

    if (mode.type === "new") {
      const sharedAnswers = readAnswers(form, "household-", "", sharedFields);
      if (!sharedAnswers) return;
      if (community && !sameCommunity(sharedAnswers.community, community)) return window.alert("Selecciona tu comunidad asignada.");
      const people = [];
      const familyCodes = new Set();
      const personCodes = new Set();
      for (let familyIndex = 0; familyIndex < familyCounts.length; familyIndex += 1) {
        const familyAnswers = readAnswers(form, `family-${familyIndex}-`, "", familyFields);
        if (!familyAnswers) return;
        const familyCode = familyAnswers.familyCode;
        if (familyCodes.has(familyCode)) return window.alert("Cada familia de la vivienda debe tener un código de familia diferente.");
        familyCodes.add(familyCode);
        for (let memberIndex = 0; memberIndex < familyCounts[familyIndex]; memberIndex += 1) {
          const memberAnswers = readAnswers(form, `member-${familyIndex}-${memberIndex}-`, birthDates[`${familyIndex}-${memberIndex}`] || "", memberFields);
          if (!memberAnswers) return;
          if (personCodes.has(memberAnswers.personCode)) return window.alert("Cada integrante debe tener un código de persona diferente.");
          personCodes.add(memberAnswers.personCode);
          people.push({ answers: { ...sharedAnswers, ...familyAnswers, ...memberAnswers }, familyIndex, memberIndex });
        }
      }
      const batchId = crypto.randomUUID();
      const requests = await submitCensusBatch(people.map(({ answers }, index) =>
        ({
          recordId: `censo-nuevo-${batchId}-${index + 1}`,
          changes: answers,
          isNew: true,
        }),
      ));
      setRadicados(requests.map((request, index) => ({ id: request.id, familyIndex: people[index].familyIndex, memberIndex: people[index].memberIndex })));
      return;
    }

    const answers = readAnswers(form, "", birthDates["0-0"]);
    if (!answers) return;
    if (community && !sameCommunity(answers.community, community)) return window.alert("Selecciona tu comunidad asignada.");
    const changes = Object.fromEntries(
      Object.entries(answers).filter(
        ([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key]),
      ),
    );
    if (!Object.keys(changes).length) {
      window.alert("No se detectaron cambios para enviar.");
      return;
    }
    const request = await createCensusRequest({
      recordId: record.id,
      changes,
      missingBirthDateAccess: mode.missingBirthDateAccess,
    });
    setRadicados([{ id: request.id }]);
    } catch (error) { window.alert(error.message); } finally {setSaving(false);}
  };

  if (radicados.length) {
    return (
      <section className="section census-editor">
        <div className="success-box left-success">
          <ShieldCheck />
          <h2>Registro guardado</h2>
          <p>
            {radicados.length} {radicados.length === 1 ? "persona fue guardada" : "personas fueron guardadas"} directamente en el censo.
          </p>
          <div className="family-receipts">
            {radicados.map(({ id, familyIndex, memberIndex }) => <span key={id}>{familyIndex === undefined ? "Registro" : `Familia ${familyIndex + 1}, integrante ${memberIndex + 1}`}: <b>{id}</b></span>)}
          </div>
          <button className="button outline" onClick={onBack}>Volver al censo</button>
        </div>
      </section>
    );
  }

  const renderQuestions = (familyIndex, memberIndex, memberInitial = {}, questions = censusSurvey.questions, prefixOverride = null) => {
    const prefix = prefixOverride ?? (mode.type === "new" ? `member-${familyIndex}-${memberIndex}-` : "");
    return questions.map((question) =>
      question.type === "section" ? (
        <div className="census-form-section" key={`${prefix}${question.id}`}>
          <h3>{question.label}</h3>
          {question.help && <p>{question.help}</p>}
        </div>
      ) : (
        <CensusField
          key={`${prefix}${question.id}`}
          question={question.id === "community" && community ? { ...question, options: question.options.filter(option => sameCommunity(option, community)) } : question}
          name={`${prefix}${question.id}`}
          initial={memberInitial[question.id] || (question.id === "enumeratorName" ? actor?.username : question.id === "community" && community ? question.options.find(option => sameCommunity(option, community)) : "")}
          birthDate={birthDates[`${familyIndex}-${memberIndex}`] || ""}
          setBirthDate={(value) =>
            setBirthDates((current) => ({ ...current, [`${familyIndex}-${memberIndex}`]: value }))
          }
        />
      ),
    );
  };

  const groupsFor = (questions) => {
    const groups = [];
    let title = 'Datos personales';
    for (const question of questions) {
      if (automaticCodeIds.has(question.id)) continue;
      if (question.type === 'section') { title = question.label; continue; }
      const last = groups[groups.length - 1];
      if (!last || last.title !== title || last.questions.length >= 5) groups.push({ title, questions: [question] });
      else last.questions.push(question);
    }
    return groups;
  };
  const steps = [];
  if (mode.type === 'new') {
    steps.push({ key: 'families', title: '¿Cuántas familias viven en esta vivienda?', content: <label className="family-size-field">Número de familias<input aria-label="Número de familias" type="number" min="1" max="10" required value={familyCounts.length} onChange={e => changeFamilyCount(e.target.value)} /></label> });
    groupsFor(visibleQuestions(sharedFieldIds)).forEach((group, index) => steps.push({ key: 'household-' + index, title: group.title, content: <div className="census-form census-full-form">{renderQuestions(0, 0, {}, group.questions, 'household-')}</div> }));
    familyCounts.forEach((count, familyIndex) => {
      steps.push({ key: 'family-' + familyIndex, title: 'Familia ' + (familyIndex + 1), content: <><label className="family-size-field">¿Cuántas personas integran esta familia?<input type="number" min="1" max="20" required value={count} onChange={e => changeMemberCount(familyIndex, e.target.value)} /></label></> });
      for (let memberIndex = 0; memberIndex < count; memberIndex++) {
        groupsFor(visibleQuestions(new Set(memberFields.map(field => field.id)))).forEach((group, index) => steps.push({ key: 'person-' + familyIndex + '-' + memberIndex + '-' + index, title: group.title, context: 'Familia ' + (familyIndex + 1) + ' / Persona ' + (memberIndex + 1), content: <div className="census-form census-full-form">{renderQuestions(familyIndex, memberIndex, {}, group.questions)}</div> }));
      }
    });
  } else {
    groupsFor(censusSurvey.questions).forEach((group, index) => steps.push({ key: 'update-' + index, title: group.title, context: fullName(record), content: <div className="census-form census-full-form">{renderQuestions(0, 0, initial, group.questions)}</div> }));
  }
  steps.push({ key: 'confirm', title: 'Revisar y enviar', content: <><p>{mode.type === 'new' ? familyCounts.length + ' familias / ' + familyCounts.reduce((sum, count) => sum + count, 0) + ' personas' : 'Actualización de ' + fullName(record)}</p><p>Puedes regresar con Anterior para revisar los datos.</p><label className="consent family-consent"><input name="familyConsent" type="checkbox" required /> Autorizo el tratamiento de estos datos para las finalidades del censo comunitario.</label></> });
  const moveTo = value => { setStep(value); setStepError(''); headingRef.current?.scrollIntoView({ block: 'start' }); headingRef.current?.focus({ preventScroll: true }); };
  const nextStep = () => {
    const panel = formRef.current?.querySelector('[data-census-step]:not([hidden])');
    for (const control of panel?.querySelectorAll('input, select, textarea') || []) {
      if (!control.checkValidity()) { control.reportValidity(); return; }
    }
    for (const field of panel?.querySelectorAll('fieldset.survey-choice') || []) {
      if (field.querySelector('legend')?.textContent.includes('*') && !field.querySelector('input:checked')) { setStepError('Selecciona una opción en ' + field.querySelector('legend').textContent); return; }
    }
    moveTo(Math.min(step + 1, steps.length - 1));
  };
  return <section className="section census-editor census-step-editor">
    <div className="census-step-top"><button type="button" className="back-button" onClick={onBack}>Volver al censo</button><span>{mode.type === 'new' ? 'Registro nuevo' : 'Actualizar persona'}</span></div>
    <div className="census-step-heading" ref={headingRef} tabIndex={-1}>
      <small>Paso {step + 1} de {steps.length}{steps[step].context && ' / ' + steps[step].context}</small>
      <progress value={step + 1} max={steps.length} aria-label="Avance del censo" />
      <h2>{steps[step].title}</h2>
    </div>
    <form ref={formRef} className="census-family-form" onSubmit={submit} noValidate>
      {steps.map((item, index) => <div key={item.key} data-census-step hidden={step !== index}>{item.content}</div>)}
      {stepError && <p role="alert" className="inline-message error">{stepError}</p>}
      <div className="census-step-actions">
        {step > 0 && <button type="button" className="button outline" disabled={saving} onClick={() => moveTo(step - 1)}>Anterior</button>}
        {step < steps.length - 1 ? <button key="next" type="button" className="button primary" onClick={nextStep}>Siguiente</button> : <button key="send" type="submit" className="button primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar en el censo'}</button>}
      </div>
    </form>
  </section>;
}

function CensusField({ question, name, initial, birthDate, setBirthDate }) {
  if (question.id === "age") {
    const age = calculateAge(birthDate);
    return <label>Edad calculada<input value={age === "Falta actualizar" ? "" : `${age} años`} placeholder="Se calcula con la fecha de nacimiento" readOnly /></label>;
  }
  const value = initial === "Falta actualizar" ? "" : initial;
  if (["checkbox", "radio", "yesno", "scale"].includes(question.type)) {
    const options = question.type === "yesno" ? ["Sí", "No"] : question.type === "scale" ? ["1", "2", "3", "4", "5"] : question.options;
    const selected = Array.isArray(value) ? value : [value];
    return <fieldset className="survey-choice full-field"><legend>{question.label}{question.required && " *"}</legend>{question.help && <p className="field-help">{question.help}</p>}<div>{options.map((option) => <label key={option}><input name={name} value={option} type={question.type === "checkbox" ? "checkbox" : "radio"} defaultChecked={selected.includes(option)} required={question.required && question.type !== "checkbox"} />{option}</label>)}</div></fieldset>;
  }
  const type = ["date", "email", "tel", "number"].includes(question.type) ? question.type : "text";
  const common = { name, required: question.required, defaultValue: value || "" };
  if (question.id === "birthDate") return <label>{question.label} *<input name={name} required type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>;
  return <label>{question.label}{question.required && " *"}{question.help && <small>{question.help}</small>}{question.type === "select" ? <select {...common}><option value="">Selecciona</option>{question.options.map((option) => <option key={option}>{option}</option>)}</select> : question.type === "textarea" ? <textarea {...common} /> : <input {...common} type={type} />}</label>;
}
