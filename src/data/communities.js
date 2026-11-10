export const communities = ['Concepción', 'Santa Rosa', 'San Antonio', 'San José', 'El Carmelo', 'Limones', 'Quiroga', 'Juanico'];
export function communityKey(value) {
  const name = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^\d+\s*·\s*/, '').split('/')[0].trim().replace(/\s+[12]$/, '');
  return ['joanico', 'junico', 'juanico'].includes(name) ? 'juanico' : name;
}
export const sameCommunity = (a, b) => Boolean(a && b) && communityKey(a) === communityKey(b);
