import { supabase } from './supabaseClient';
import {rows} from './platformStore';

export const cloudKinds = {
  'apuntes-participacion-guajui': 'participation_note',
  'asistencia-reuniones-guajui': 'meeting_attendance',
  'seguimiento-junta-guajui': 'board_performance',
};

const explain = (error) => {
  if (error?.code === '42P01' || error?.code === 'PGRST205') return new Error('La base de datos aún no tiene las tablas del sitio. Comunícate con el Consejo.');
  if (error?.code === '42501') return new Error('No tienes permiso para consultar o modificar estos datos.');
  return new Error(error?.message || 'No se pudo conectar con la base de datos.');
};

export const submitCloudRecord = async (kind, record) => {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { error } = await supabase.from('community_forms').insert({ id: record.id, kind, payload: record });
  if (error) throw explain(error);
  return record;
};

export const updateCloudRecord = async (kind, record) => {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { data, error } = await supabase.from('community_forms').update({ payload: record }).eq('id', record.id).eq('kind', kind).select('id').single();
  if (error) throw explain(error);
  if (!data) throw new Error('No se encontró el registro para actualizar.');
  return record;
};

export const loadCloudRecords = async (kind) => {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const data = await rows('community_forms',q=>q.eq('kind',kind).order('submitted_at',{ascending:false}));
  return (data || []).map(({ id, payload, submitted_at: submittedAt }) => ({ ...payload, id, submittedAt: payload.submittedAt || submittedAt }));
};

export const loadCloudMeetings = async () => {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { data, error } = await supabase.from('community_meetings').select('id,name,meeting_date,objective,place,updated_at').order('meeting_date', { ascending: true });
  if (error) throw explain(error);
  return (data || []).map((item) => ({ id: item.id, name: item.name, meetingDate: item.meeting_date, objective: item.objective, place: item.place, updatedAt: item.updated_at }));
};

export const saveCloudMeeting = async (meeting) => {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { data, error } = await supabase.from('community_meetings').upsert({ id: meeting.id, name: meeting.name, meeting_date: meeting.meetingDate, objective: meeting.objective, place: meeting.place, updated_at: meeting.updatedAt }).select('id').single();
  if (error) throw explain(error);
  if (!data) throw new Error('No se pudo confirmar la reunión guardada.');
  return meeting;
};

export const hasCloudAdminSession = async () => {
  if (!supabase) return false;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return false;
  const { data: authorized, error: roleError } = await supabase.rpc('is_guajui_owner');
  if (roleError) throw explain(roleError);
  return authorized === true;
};
