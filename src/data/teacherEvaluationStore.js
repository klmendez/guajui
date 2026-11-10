import { getAdminSession } from './adminUserStore';
import { sameCommunity } from './communities';
import { loadCloudRecords, submitCloudRecord, updateCloudRecord } from './communityCloudStore';

const KEY = 'guajui_teacher_evaluations_v1';
export const evaluationCriteria = [
  ['punctuality', 'Puntualidad y cumplimiento del horario'],
  ['clarity', 'Claridad en la enseñanza y explicación de los temas'],
  ['classes', 'Desarrollo de clases y actividades académicas'],
  ['students', 'Trato y acompañamiento a los estudiantes'],
  ['communication', 'Comunicación con familias y comunidad'],
  ['commitment', 'Compromiso con el proceso educativo'],
];
const normalized = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const dayNumber = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? NaN : date.toISOString().slice(0, 10) === value ? date.getTime() / 86400000 : NaN;
};

export const generateSchoolDays = (start, end) => {
  const first = dayNumber(start);
  const last = dayNumber(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) throw new Error('Selecciona un período válido.');
  if (last - first >= 62) throw new Error('El período puede tener hasta 62 fechas.');
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const date = new Date((first + index) * 86400000);
    return { date: date.toISOString().slice(0, 10), scheduled: date.getUTCDay() !== 0 && date.getUTCDay() !== 6, status: '' };
  });
};

export const attendanceSummary = (days = []) => {
  const scheduled = days.filter((day) => day.scheduled);
  const full = scheduled.filter((day) => day.status === 'full').length;
  const partial = scheduled.filter((day) => day.status === 'partial').length;
  const absent = scheduled.filter((day) => day.status === 'absent').length;
  return { scheduled: scheduled.length, full, partial, absent, pending: scheduled.length - full - partial - absent, percentage: scheduled.length ? Math.round(full / scheduled.length * 100) : 0 };
};

export const getTeacherEvaluations=()=>[];
export const loadTeacherEvaluations=()=>loadCloudRecords('teacher_evaluation');

export const findOverlappingEvaluation = (record, records = getTeacherEvaluations()) => records.find((item) =>
  item.id !== record.id && sameCommunity(item.community, record.community) && normalized(item.site) === normalized(record.site) &&
  (item.teacherId && record.teacherId ? item.teacherId === record.teacherId : normalized(item.teacherName) === normalized(record.teacherName)) &&
  item.periodStart <= record.periodEnd && record.periodStart <= item.periodEnd
);

export const saveTeacherEvaluation = (input) => {
  const current = getTeacherEvaluations();
  const existing = input.id ? (current.find((item) => item.id === input.id) || (input)) : null;
  if (existing && getAdminSession()?.role !== 'superadmin') throw new Error('Solo el superadministrador puede corregir un registro existente.');
  if (!input.community || !input.site?.trim() || !input.teacherName?.trim() || !input.teacherId) throw new Error('Completa la identificación del docente.');
  const dates = generateSchoolDays(input.periodStart, input.periodEnd).map((day) => day.date);
  if (!Array.isArray(input.attendance) || input.attendance.length !== dates.length || input.attendance.some((day, index) => day.date !== dates[index] || typeof day.scheduled !== 'boolean' || !['', 'full', 'partial', 'absent'].includes(day.status))) throw new Error('Genera y revisa las fechas del período.');
  if (!attendanceSummary(input.attendance).scheduled) throw new Error('Marca al menos una fecha programada.');
  if (evaluationCriteria.some(([key]) => !['1', '2', '3', '4', '5', 'NO'].includes(String(input.performance?.ratings?.[key] || '')))) throw new Error('Califica cada criterio o marca N/O.');
  if (findOverlappingEvaluation(input, current)) throw new Error('Ya existe un seguimiento de este docente, sede y comunidad que coincide con el período. Solicita al Consejo completarlo o corregirlo.');
  const now = new Date().toISOString();
  const status = existing ? input.status : 'Pendiente';
  if (!['Pendiente', 'Verificado'].includes(status)) throw new Error('Estado de revisión inválido.');
  if (status === 'Verificado' && attendanceSummary(input.attendance).pending) throw new Error('Completa todas las fechas programadas antes de verificar.');
  const record = {
    id: existing?.id || `seguimiento-${crypto.randomUUID()}`,
    submittedAt: existing?.submittedAt || now,
    updatedAt: now,
    status,
    reviewedAt: status === 'Verificado' ? now : null,
    reviewedBy: status === 'Verificado' ? getAdminSession()?.username || '' : '',
    teacherId: input.teacherId,
    teacherName: input.teacherName.trim(),
    community: input.community,
    site: input.site.trim(),
    grades: String(input.grades || '').trim(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    attendance: input.attendance.map((day) => ({ date: day.date, scheduled: day.scheduled, status: day.scheduled ? day.status : '' })),
    absenceJustification: input.absenceJustification || '',
    absenceNotes: String(input.absenceNotes || '').trim(),
    performance: {
      ratings: Object.fromEntries(evaluationCriteria.map(([key]) => [key, String(input.performance.ratings[key])])),
      strengths: String(input.performance.strengths || '').trim(),
      improvements: String(input.performance.improvements || '').trim(),
      observations: String(input.performance.observations || '').trim(),
    },
  };
  return existing ? updateCloudRecord('teacher_evaluation', record) : submitCloudRecord('teacher_evaluation', record);
};

export const teacherPeriodRanking = (records, { year, month = '', community = '' } = {}) => {
  const grouped = new Map();
  for (const record of records.filter((item) => item.status === 'Verificado')) {
    if (community && !sameCommunity(record.community, community)) continue;
    const days = record.attendance.filter((day) => day.scheduled && (!year || day.date.startsWith(String(year))) && (!month || day.date.slice(5, 7) === String(month).padStart(2, '0')));
    if (!days.length) continue;
    const key = `${normalized(record.teacherName)}|${normalized(record.community)}`;
    const item = grouped.get(key) || { teacherId: record.teacherId, teacherName: record.teacherName, community: record.community, sites: new Set(), scores: [], days: new Map(), count: 0 };
    item.sites.add(record.site);
    item.count += 1;
    for (const day of days) item.days.set(day.date, day.status);
    // A valuation applies to its full recorded period; count it in each month it covers.
    for (const [criterion] of evaluationCriteria) {
      const score = Number(record.performance?.ratings?.[criterion]);
      if (Number.isInteger(score) && score >= 1 && score <= 5) item.scores.push(score);
    }
    grouped.set(key, item);
  }
  return [...grouped.values()].filter((item) => item.scores.length).map((item) => ({
    teacherId: item.teacherId, teacherName: item.teacherName, community: item.community, sites: [...item.sites].join(', '), count: item.count,
    average: item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length,
    ...attendanceSummary([...item.days].map(([date, status]) => ({ date, status, scheduled: true }))),
    absenceDays: [...item.days.values()].filter((status) => status === 'absent').length,
  })).sort((a, b) => b.average - a.average || a.absenceDays - b.absenceDays || a.teacherName.localeCompare(b.teacherName, 'es'));
};
