import { sameCommunity } from './communities';

const validRating = (value) => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
};
const utcDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ? null : Math.floor(time / 86400000);
};

const absenceDays = (records, { year, month }) => {
  const current = new Date();
  const today = Math.floor(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()) / 86400000);
  const periodStart = year ? Math.floor(Date.UTC(Number(year), month ? Number(month) - 1 : 0, 1) / 86400000) : -Infinity;
  const periodEnd = year ? Math.floor(Date.UTC(Number(year), month ? Number(month) : 12, 1) / 86400000) : today + 1;
  const intervals = records.map(({ answers }) => {
    const start = utcDay(answers.departureDate);
    const returnDay = utcDay(answers.returnDate);
    if (start === null) return null;
    const end = Math.min(returnDay ?? today + 1, today + 1, periodEnd);
    const clippedStart = Math.max(start, periodStart);
    return end > clippedStart ? [clippedStart, end] : null;
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  let days = 0;
  let lastEnd = -Infinity;
  for (const [start, end] of intervals) {
    days += Math.max(0, end - Math.max(start, lastEnd));
    lastEnd = Math.max(lastEnd, end);
  }
  return days;
};

export const getTeacherRankings = (followups, { year, month = '', community = '' } = {}) => {
  const grouped = new Map();
  for (const response of followups) {
    const answers = response.answers || {};
    const date = String(answers.recordDate || '');
    const rating = validRating(answers.rating);
    if (!rating || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (year && !date.startsWith(String(year))) || (month && date.slice(5, 7) !== String(month).padStart(2, '0')) || (community && !sameCommunity(answers.community, community))) continue;
    const teacherId = response.teacherId || answers.teacherId || response.id;
    const key = community ? `${teacherId}|${answers.community}` : teacherId;
    const item = grouped.get(key) || { teacherId, teacherName: response.teacherName || answers.teacherName, community: answers.community, ratings: [], records: [] };
    item.ratings.push(rating);
    item.records.push(response);
    grouped.set(key, item);
  }
  return [...grouped.values()].map((item) => ({
    ...item,
    count: item.ratings.length,
    average: item.ratings.reduce((sum, rating) => sum + rating, 0) / item.ratings.length,
    absenceDays: absenceDays(followups.filter((response) => {
      const sameTeacher = (response.teacherId || response.answers.teacherId || response.id) === item.teacherId;
      return sameTeacher && (!community || sameCommunity(response.answers.community, community));
    }), { year, month }),
  })).sort((a, b) => b.average - a.average || a.absenceDays - b.absenceDays || a.teacherName.localeCompare(b.teacherName, 'es'));
};

export const topTeachers = (rankings) => rankings.filter((item) => item.average === rankings[0]?.average && item.absenceDays === rankings[0]?.absenceDays);
