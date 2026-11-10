export const createHouseholdCode = () => `V-${crypto.randomUUID()}`;

export function censusCodes(householdCode, prefix) {
  const indexes = prefix.match(/^(?:family|member)-(\d+)(?:-(\d+))?-/);
  const familyNumber = Number(indexes?.[1] || 0) + 1;
  const personNumber = Number(indexes?.[2] || 0) + 1;
  return {
    householdCode,
    familyCode: `${householdCode}.${familyNumber}`,
    personCode: `${householdCode}.${familyNumber}.${personNumber}`,
  };
}
