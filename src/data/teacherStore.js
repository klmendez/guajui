import {sameCommunity} from './communities';
import {rpc,communityId,communityNames} from './platformStore';
const normalizeName=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let teachers=[];
export const getTeachers=()=>[];
export async function searchTeachers(name,community){
 const data=await rpc('suggest_teachers',{search_name:name,target_community:communityId(community)});
 teachers=data.map(item=>({id:item.id,name:item.full_name,community:communityNames[item.registry_community_id]}));return teachers;
}
const editDistance = (a, b) => {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
};

export const findTeacherCandidates = (name, community, teachers = getTeachers()) => {
  const normalized = normalizeName(name);
  if (normalized.length < 3) return [];
  return teachers.map((teacher) => {
    const candidate = normalizeName(teacher.name);
    const exact = candidate === normalized;
    const similar = !exact && ((normalized.length >= 6 && candidate.includes(normalized)) || (candidate.length >= 6 && normalized.includes(candidate)) || editDistance(normalized, candidate) <= Math.max(1, Math.floor(Math.min(normalized.length, candidate.length) / 5)));
    return { ...teacher, exact, similar, sameCommunity: sameCommunity(teacher.community, community) };
  }).filter((teacher) => teacher.exact || teacher.similar).sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.sameCommunity) - Number(a.sameCommunity)).slice(0, 6);
};

export const registerTeacher=(name,community,selectedId='')=>{
 if(selectedId){const selected=teachers.find(item=>item.id===selectedId);if(!selected)throw new Error('Vuelve a seleccionar al docente.');return selected;}
 return {id:crypto.randomUUID(),name:name.trim(),community};
};
export const getTeacherFollowups=()=>[];
