import { loadCloudMeetings, saveCloudMeeting } from './communityCloudStore';

export const getMeetings = () => [];
export const loadMeetings = () => loadCloudMeetings();

export const saveMeeting = (meeting) => {
  if (!meeting.name?.trim() || !meeting.meetingDate || !meeting.objective?.trim() || !meeting.place?.trim()) {
    throw new Error('Nombre, fecha, objetivo y lugar son obligatorios.');
  }
  const meetings = getMeetings();
  const entry = {
    id: meeting.id || `reunion-${crypto.randomUUID()}`,
    name: meeting.name.trim(),
    meetingDate: meeting.meetingDate,
    objective: meeting.objective.trim(),
    place: meeting.place.trim(),
    updatedAt: new Date().toISOString(),
  };
  return saveCloudMeeting(entry);
};
