import { loadCloudRecords, submitCloudRecord } from './communityCloudStore';

export const educationLevels = ['Bachillerato', 'Técnico', 'Pregrado', 'Posgrado', 'Doctorado'];

export const workDurationMonths = (startMonth, endMonth) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth || '') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(endMonth || '')) return 0;
  const [startYear, start] = startMonth.split('-').map(Number);
  const [endYear, end] = endMonth.split('-').map(Number);
  return Math.max(0, (endYear - startYear) * 12 + end - start + 1);
};

export const formatWorkDuration = (months) => {
  if (!months) return 'Duración sin informar';
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return [years && `${years} ${years === 1 ? 'año' : 'años'}`, remaining && `${remaining} ${remaining === 1 ? 'mes' : 'meses'}`].filter(Boolean).join(' y ');
};

export const getResumes = () => [];
export const loadResumes = () => loadCloudRecords('resume');

export const saveResume = (resume) => {
  const required = ['fullName', 'community', 'residence', 'documentNumber', 'phone', 'email'];
  if (required.some((key) => !String(resume[key] || '').trim())) throw new Error('Completa los datos personales y de contacto.');
  if (!Array.isArray(resume.education) || !resume.education.length) throw new Error('Selecciona al menos un nivel de estudios.');
  const entry = {
    ...resume,
    id: `hoja-vida-${crypto.randomUUID()}`,
    submittedAt: new Date().toISOString(),
  };
  return submitCloudRecord('resume', entry);
};
