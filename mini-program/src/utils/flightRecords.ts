import { V2FlightRecordSummary } from '../types';

export type AggregatedFlightStats = {
  totalFlights: number;
  totalDurationSeconds: number;
  totalDistanceM: number;
  maxAltitudeM: number;
};

export const aggregateFlightRecords = (records: V2FlightRecordSummary[]): AggregatedFlightStats => {
  const uniqueRecords = new Map<number, V2FlightRecordSummary>();
  records.forEach((record) => {
    if (record?.id) {
      uniqueRecords.set(record.id, record);
    }
  });

  let totalDurationSeconds = 0;
  let totalDistanceM = 0;
  let maxAltitudeM = 0;

  uniqueRecords.forEach((record) => {
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

export const formatHoursFromSeconds = (seconds?: number | null) => {
  const totalHours = Number(seconds || 0) / 3600;
  if (totalHours < 1) {
    return `${Math.round((seconds || 0) / 60)}m`;
  }
  return `${totalHours.toFixed(1)}h`;
};
