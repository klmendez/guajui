import { supabase } from './supabaseClient';

export const roles = {
  superadmin: { label: 'Superadministrador', description: 'Autoriza usuarios, aprueba cambios censales, emite certificados y administra formularios, publicaciones, archivos y consultas de todas las comunidades.' },
  enumerator: { label: 'Encuestador', description: 'Registra y actualiza directamente viviendas, familias y personas de su comunidad asignada, y diligencia encuestas.' },
  community_leader: { label: 'Responsable comunitario', description: 'Una persona activa por comunidad. Consulta su censo y estadísticas, propone correcciones y publicaciones, y registra novedades para revisión.' },
};
export const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.code === '23505' ? 'Ya existe un registro con esos datos o un responsable activo para esa comunidad.' : error.code === '42501' ? 'Tu perfil no tiene permiso para esta operación.' : error.message);
  return data;
};
export async function rows(table, configure = query => query) {
  if (!supabase) throw new Error('Falta configurar la conexión.');
  // Paginación para evitar truncar el censo o los informes a 1000 registros.
  const result = [];
  for (let from = 0; ; from += 500) {
    const page = unwrap(await configure(supabase.from(table).select('*')).range(from, from + 499));
    result.push(...page);
    if (page.length < 500) return result;
  }
}
export const rpc = async (name, args) => unwrap(await supabase.rpc(name, args));
export const insert = async (table, value) => unwrap(await supabase.from(table).insert(value).select().single());
export const insertPublic = async (table, value) => unwrap(await supabase.from(table).insert(value));
export const update = async (table, id, value) => unwrap(await supabase.from(table).update(value).eq('id', id).select().single());
export const communityId = (name) => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^\d+\s*·\s*/, '').split('/')[0].trim().replace(/\s+[12]$/, '').replace(/^(joanico|junico)$/,'juanico').replace(/\s+/g, '-');
export const communityNames = { concepcion:'Concepción', 'santa-rosa':'Santa Rosa', 'san-antonio':'San Antonio', 'san-jose':'San José', 'el-carmelo':'El Carmelo', limones:'Limones', quiroga:'Quiroga', juanico:'Juanico' };
export const communityOptions = Object.entries(communityNames);
