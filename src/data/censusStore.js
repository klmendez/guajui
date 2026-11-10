import { rows, rpc, update } from './platformStore';
import { calculateAge } from './surveyStore';
let census = [];
let cacheOwner = '';
import { getAdminSession } from './adminUserStore';
const current = () => {
  const owner=getAdminSession()?.id || '';
  if (owner!==cacheOwner) { census=[]; cacheOwner=owner; }
  return census;
};
export const getCensusRecords = current;
export const loadCensusRecords = async () => {
  const owner=getAdminSession()?.id;
  if (!owner) { census=[]; return []; }
  const data=await rows('census_records',query=>query.is('archived_at',null).order('id'));
  if (getAdminSession()?.id!==owner) return [];
  cacheOwner=owner;
  census=data.map(record=>({...record,submittedAt:record.submitted_at,answers:{...record.answers,age:calculateAge(record.answers.birthDate)}}));
  return census;
};
export const findByDocument = value => current().find(record=>String(record.answers.documentNumber || '').trim()===value.trim());
export const getLinkedFamilyMembers = record => current().filter(item=>item.family_id && item.family_id===record?.family_id);
export const hasUsedMissingBirthDateUpdate = () => false;
export const fullName = record => ['firstName','middleName','lastName1','lastName2','lastName3','lastName4'].map(key=>record?.answers?.[key]).filter(value=>value && value!=='Falta actualizar').join(' ');
export const maskDocument = value => String(value || '').length>4 ? String(value).slice(0,2)+'•'.repeat(String(value).length-4)+String(value).slice(-2) : '••••';
export const needsAdultIdUpdate = record => Number(calculateAge(record.answers.birthDate))>18 && !record.answers.documentType?.startsWith('CC');
export const submitCensusBatch = async items => {
  const requests=items.map(item=>({...item,id:'GUA-'+crypto.randomUUID(),recordId:item.recordId || 'persona-'+crypto.randomUUID()}));
  await rpc('submit_census_batch',{items:requests});
  return requests;
};
export const createCensusRequest = async item => (await submitCensusBatch([item]))[0];
export const loadCensusRequests = () => rows('census_requests',query=>query.order('created_at',{ascending:false}));
export const decideCensusRequest = (id,decision) => rpc('decide_census_request',{request_id:id,decision});
export const updateCensusRecord = async (id,changes) => {
  const record=current().find(item=>item.id===id);
  if (!record) throw new Error('Actualiza la lista y vuelve a seleccionar la persona.');
  await update('census_records',id,{answers:{...record.answers,...changes}});
  return loadCensusRecords();
};
export const deleteCensusRecord = async id => { await update('census_records',id,{archived_at:new Date().toISOString()}); return loadCensusRecords(); };
