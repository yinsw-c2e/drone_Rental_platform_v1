import {V2FlightRecordSummary} from '../types';

export type AggregatedFlightStats = {
  totalFlights: number;
  totalDurationSeconds: number;
  totalDistanceM: number;
  maxAltitudeM: number;
};

export const sortFlightRecords = (records: V2FlightRecordSummary[]) =>
  [...records].sort((a, b) => {
    const aTime = new Date(
      String(a.takeoff_at || a.landing_at || a.created_at || '1970-01-01T00:00:00Z'),
    ).getTime();
    const bTime = new Date(
      String(b.takeoff_at || b.landing_at || b.created_at || '1970-01-01T00:00:00Z'),
    ).getTime();
    return bTime - aTime;
  });

export const aggregateFlightRecords = (records: V2FlightRecordSummary[]): AggregatedFlightStats => {
  const uniqueRecords = new Map<number, V2FlightRecordSummary>();
  records.forEach(record => {
    if (record?.id) {
      uniqueRecords.set(record.id, record);
    }
  });

  let totalDurationSeconds = 0;
  let totalDistanceM = 0;
  let maxAltitudeM = 0;

  uniqueRecords.forEach(record => {
    totalDurationSeconds += Number(record.total_duration_seconds || 0);
    totalDistanceM += Number(record.total_distance_m || 0);
    maxAltitudeM = Math.max(maxAltitudeM, Number(record.max_altitude_m || 0));
  });

  return {
    totalFlights: uniqueRecords.size,
    totalDurationSeconds,
    totalDistanceM,
    maxAltitudeM,
  };
};

export const formatDurationSeconds = (seconds?: number | null) => {
  const safeSeconds = Number(seconds || 0);
  if (safeSeconds <= 0) {
    return '0分钟';
  }
  const totalMinutes = Math.round(safeSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}分钟`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
};

export const formatHoursFromSeconds = (seconds?: number | null) => {
  const totalHours = Number(seconds || 0) / 3600;
  if (totalHours < 1) {
    return `${Math.round((seconds || 0) / 60)}m`;
  }
  return `${totalHours.toFixed(1)}h`;
};

export const formatDistanceMeters = (meters?: number | null) => {
  const safeMeters = Number(meters || 0);
  if (safeMeters < 1000) {
    return `${safeMeters.toFixed(0)}米`;
  }
  return `${(safeMeters / 1000).toFixed(2)}公里`;
};

export const formatDistanceKilometersShort = (meters?: number | null) =>
  `${(Number(meters || 0) / 1000).toFixed(1)}km`;

export const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

