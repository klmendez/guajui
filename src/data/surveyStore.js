import { communities as leaderCommunities } from './communities';
import { cloudKinds, loadCloudRecords, submitCloudRecord } from './communityCloudStore';
import { rows, communityId, insertPublic, unwrap } from './platformStore';
import { supabase } from './supabaseClient';
import { getAdminSession } from './adminUserStore';
const q = (id, label, type = 'text', required = false, options = [], help = '') => ({ id, label, type, required, options, help });
const section = (id, label, help = '') => q(id, label, 'section', false, [], help);
const communities = ['100 · Concepción', '200 · Santa Rosa', '300 · San Antonio', '400 · San José', '4001 · San José / Las Brisas', '500 · El Carmelo', '600 · Limones', '601 · Limones / El Carmen', '700 · Quiroga 1', '7001 · Quiroga 2', '703 · Quiroga / La Isla', '800 · Joanico', '802 · Juanico'];
export const participationNotesSurvey = {
  id: 'apuntes-participacion-guajui',
  title: 'Apuntes de participación',
  description: 'Hechos que suceden a diario en las comunidades del Consejo Guajuí.',
  status: 'published',
  questions: [
    q('community', 'Comunidad', 'select', true, [...leaderCommunities]),
    q('participantName', 'Nombre completo', 'text', true),
    q('eventDate', 'Fecha', 'date', true),
    q('facts', 'Hechos', 'textarea', true),
    q('possibleSolution', 'Posible solución', 'textarea'),
  ],
};
export const meetingAttendanceSurvey = {
  id: 'asistencia-reuniones-guajui',
  title: 'Asistencia a reuniones',
  description: 'Asistencias vinculadas a reuniones creadas por el Consejo.',
  status: 'published',
  questions: [
    q('meetingName', 'Nombre de la reunión', 'text', true),
    q('meetingDate', 'Fecha', 'date', true),
    q('objective', 'Objetivo de la reunión', 'textarea', true),
    q('place', 'Lugar', 'text', true),
    q('topics', 'Temas', 'checkbox', true),
    q('agreements', 'Acuerdos', 'checkbox', true),
    q('conclusions', 'Conclusiones', 'textarea', true),
    q('contactName', 'Nombre del contacto', 'text', true),
    q('contactPhone', 'Número de celular', 'tel', true),
    q('institution', 'Institución'),
    q('organization', 'Organización'),
    q('position', 'Cargo'),
    q('contactEmail', 'Correo electrónico', 'email'),
  ],
};
export const teacherFollowupSurvey = {
  id: 'seguimiento-maestros-guajui',
  title: 'Seguimiento del desempeño de maestros',
  description: 'Registro comunitario de asistencia, participación y reconocimientos.',
  status: 'published',
  questions: [
    q('recordDate', 'Fecha del seguimiento', 'date', true),
    q('community', 'Comunidad', 'select', true, [...leaderCommunities]),
    q('teacherName', 'Maestro o maestra', 'text', true),
    q('rating', 'Calificación del desempeño', 'scale', true, ['1', '2', '3', '4', '5']),
    q('departureDate', 'Fecha de salida', 'date'),
    q('returnDate', 'Fecha de ingreso', 'date'),
    q('absenceReason', 'Posible causa de ausencia', 'textarea'),
    q('recognition', 'Reconocimiento', 'textarea'),
    q('communityParticipation', 'Participación en actividades comunitarias', 'textarea'),
    q('communityPerformance', 'Mejor desempeño comunitario', 'textarea'),
  ],
};
export const boardPerformanceSurvey = {
  id: 'seguimiento-junta-guajui',
  title: 'Seguimiento del desempeño de la junta del Consejo',
  description: 'Valoración comunitaria del trabajo de cada integrante de la junta de gobierno.',
  status: 'published',
  questions: [
    q('recordDate', 'Fecha', 'date', true),
    q('community', 'Comunidad', 'select', true, [...leaderCommunities]),
    q('position', 'Cargo en la junta de gobierno', 'select', true, ['Representante legal', 'Presidente', 'Vicepresidente', 'Secretaria', 'Tesorero', 'Fiscal 1', 'Fiscal 2', 'Asesor']),
    q('memberName', 'Nombre de la persona de la junta', 'text', true),
    q('rating', 'Desempeño', 'scale', true, ['1', '2', '3', '4', '5']),
    q('recommendations', 'Recomendaciones a la persona de la junta', 'textarea'),
  ],
};
export const censusSurvey = {
  id: 'censo-interno-guajui', title: 'Actualización del censo interno Guajuí',
  description: 'Formulario basado en el Censo Interno Guajuí y su guía de diligenciamiento. Debe completarse una vez por cada persona del hogar.',
  closesAt: '2027-12-31', status: 'published', createdAt: '2026-09-05T12:00:00.000Z',
  questions: [
    section('s-territorio', '1. Identificación territorial y del hogar', 'Los códigos permiten relacionar correctamente a las personas de un mismo hogar y familia.'),
    q('community', 'Comunidad o vereda', 'select', true, communities), q('censusDate', 'Fecha del censo', 'date', true),
    q('householdCode', 'Código único de la vivienda', 'number', true, [], 'Use el mismo código para todas las familias de esta vivienda. Si ya está censada, reutilice su código.'),
    q('familyCode', 'Código de familia', 'text', true, [], 'Ejemplo: vivienda 1, primera familia = 1.1; segunda familia = 1.2; tercera = 1.3.'),
    q('personCode', 'Código de persona', 'text', true, [], 'Ejemplo: hogar 1, familia 1, primera persona = 1.1.1.'),
    q('relationship', 'Parentesco con el jefe o jefa del hogar', 'select', true, ['1 · Jefe(a)', '2 · Cónyuge o compañero(a)', '3 · Hijo(a) o hijastro(a)', '4 · Padre, madre, padrastro o madrastra', '5 · Hermano(a) o hermanastro(a)', '6 · Otro pariente del jefe']),
    section('s-persona', '2. Identificación de la persona'),
    q('firstName', 'Primer nombre', 'text', true), q('middleName', 'Segundo nombre'), q('lastName1', 'Primer apellido', 'text', true), q('lastName2', 'Segundo apellido'), q('lastName3', 'Tercer apellido'), q('lastName4', 'Cuarto apellido'),
    q('documentType', 'Tipo de documento', 'select', true, ['CC · Cédula de ciudadanía o contraseña', 'CE · Cédula de extranjería', 'NUIP · Número de identificación personal', 'NUI · Número único de identificación', 'TI · Tarjeta de identidad', 'RC · Registro civil', 'PEP · Permiso especial de permanencia', 'PAS · Pasaporte', 'SI · Sin información', 'Otro']),
    q('documentNumber', 'Número de documento', 'text'), q('birthDate', 'Fecha de nacimiento', 'date', true), q('age', 'Edad', 'number'),
    section('s-identidad', '3. Caracterización e identidad', 'Las respuestas de orientación e identidad incluyen la opción “No sabe / No informa”.'),
    q('sex', 'Sexo', 'select', true, ['H · Hombre', 'M · Mujer', 'I · Intersexual']),
    q('sexualOrientation', 'Orientación sexual', 'select', false, ['1 · Heterosexual', '2 · Homosexual', '3 · Bisexual', '4 · Asexual', '5 · No sabe / No informa']),
    q('genderIdentity', 'Identidad de género', 'select', false, ['1 · Masculino', '2 · Femenino', '3 · Transgénero', '4 · No sabe / No informa']),
    q('disability', 'Discapacidad', 'checkbox', true, ['1 · Física', '2 · Visual', '3 · Auditiva', '4 · Intelectual', '5 · Mental', '6 · Sordoceguera', '7 · Múltiple', '8 · Ninguna']),
    q('ethnicity', 'Pertenencia étnica (¿cómo se autorreconoce?)', 'select', true, ['Negro(a)', 'Afrocolombiano(a)', 'Raizal', 'Palenquero(a)', 'Mestizo(a)', 'Blanco(a)', 'Indígena', 'Otra']),
    section('s-contacto', '4. Residencia, contacto y salud'),
    q('residence', 'Lugar de residencia y/o dirección actual', 'text', true), q('phone', 'Número celular', 'tel'), q('email', 'Correo electrónico', 'email'), q('department', 'Departamento', 'text', true), q('municipality', 'Municipio', 'text', true),
    q('sisben', '¿Está registrado(a) en el Sisbén?', 'yesno', true), q('eps', 'Nombre de la EPS en la que está afiliado(a)', 'text', true), q('sisbenLevel', 'Nivel del Sisbén'),
    section('s-educacion', '5. Alfabetización y educación'),
    q('canWrite', '¿Sabe escribir?', 'yesno', true), q('canRead', '¿Sabe leer?', 'yesno', true), q('currentlyStudying', '¿Actualmente se encuentra estudiando?', 'yesno', true), q('lastGrade', 'Educación básica: último grado cursado'),
    q('academicLevel', 'Modalidad académica', 'select', true, ['1 · Bachiller', '2 · Técnica', '3 · Tecnológica', '4 · Universitaria', '5 · Posgrado', '6 · Ninguna']),
    section('s-economia', '6. Actividad productiva, territorio y saberes'),
    q('productiveActivities', 'Actividades productivas', 'checkbox', true, ['1 · Minería tradicional', '2 · Agricultura', '3 · Corte de madera', '4 · Silvicultura', '5 · Pesca artesanal', '6 · Comercio', '7 · Artesanía', '8 · Otra', '9 · Ninguna'], 'Seleccione todas las que correspondan.'),
    q('familyHectares', 'Total de hectáreas de la familia', 'number', false, [], 'Se diligencia únicamente para el jefe o jefa de familia.'),
    q('traditionalRoles', 'Roles tradicionales o ancestrales', 'checkbox', false, ['1 · Curandero(a) de mordeduras', '2 · Curandero(a) de ojo', '3 · Curandero(a) de espanto', '4 · Cantor(a) de alabaos', '5 · Sobandero(a)', '6 · Partero(a)', '7 · Decimero(a)', '8 · Cuentero(a)', '9 · Cazador(a)', '10 · Mayor sabedor(a)', '11 · Maestro(a) etnoeducador(a)', '12 · Músico tradicional', '13 · Poeta']),
    section('s-programas', '7. Programas sociales'), q('familiasAccion', '¿Pertenece a Familias en Acción?', 'yesno', true), q('rentaCiudadana', '¿Pertenece a Renta Ciudadana?', 'yesno', true), q('adultoMayor', '¿Pertenece al programa Adulto Mayor?', 'yesno', true),
    section('s-encuestador', '8. Persona que realiza el censo'), q('enumeratorName', 'Nombres y apellidos de quien realiza el censo', 'text', true), q('enumeratorDocument', 'Número de documento de quien realiza el censo', 'text', true), q('enumeratorPhone', 'Celular de quien realiza el censo', 'tel'), q('enumeratorEmail', 'Correo de quien realiza el censo', 'email'),
  ],
};

export const getSurveys = () => [];
export const loadSurveys = async () => (await rows('surveys',query=>query.order('created_at',{ascending:false}))).map(item=>({...item,closesAt:item.closes_at,createdAt:item.created_at}));
export const saveSurvey = async survey => unwrap(await supabase.from('surveys').upsert({id:survey.id,title:survey.title,description:survey.description,closes_at:survey.closesAt || null,status:survey.status,questions:survey.questions,updated_at:new Date().toISOString()}).select().single());
export const calculateAge = birthDate => {
  if (!birthDate || birthDate === 'Falta actualizar') return 'Falta actualizar';
  const birth = new Date(`${birthDate}T12:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return 'Falta actualizar';
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age <= 120 ? String(age) : 'Falta actualizar';
};
const multiValueFields = new Set(['disability', 'productiveActivities', 'traditionalRoles', 'topics', 'agreements']);
const normalizeAnswers = answers => Object.fromEntries(Object.entries(answers || {}).map(([key, value]) => {
  if (multiValueFields.has(key) || Array.isArray(value)) {
    if (Array.isArray(value)) return [key, value.map(String).filter(Boolean)];
    if (value && typeof value === 'object') return [key, []];
    return [key, value ? [String(value)] : []];
  }
  if (value && typeof value === 'object') return [key, ''];
  return [key, value ?? ''];
}));
const refreshAge = response => {
  const answers = normalizeAnswers(response.answers);
  return response.surveyId === 'censo-interno-guajui' ? { ...response, answers: { ...answers, age: calculateAge(answers.birthDate) } } : { ...response, answers };
};
export const getResponses = () => [];
export const getSurveyResponses = () => [];
export const saveResponse = async response => {
  const entry=refreshAge(response);
  if (cloudKinds[entry.surveyId]) return submitCloudRecord(cloudKinds[entry.surveyId],entry);
  await insertPublic('survey_responses',{id:entry.id,survey_id:entry.surveyId,answers:entry.answers,community_id:communityId(entry.answers.community),submitted_by:getAdminSession()?.id || null});
  return entry;
};
export const loadServiceResponses = async id => cloudKinds[id] ? loadCloudRecords(cloudKinds[id]) : (await rows('survey_responses',query=>query.eq('survey_id',id).order('submitted_at',{ascending:false}))).map(item=>({...item,submittedAt:item.submitted_at,surveyId:item.survey_id}));
export const isSurveyOpen = survey => survey.status === 'published' && (!survey.closesAt || new Date(`${survey.closesAt}T23:59:59`) >= new Date());
export const formatDate = value => value ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'sin fecha de cierre';
export const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
