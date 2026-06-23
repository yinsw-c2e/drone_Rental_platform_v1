export type ServerCountdownSource = {
  remaining_seconds?: number | null;
  received_at_ms?: number | null;
};

export function remainingSecondsFromServer(
  source?: ServerCountdownSource | null,
  nowMs = Date.now(),
): number | null {
  const remaining = Number(source?.remaining_seconds);
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  const receivedAt = Number(source?.received_at_ms || nowMs);
  const elapsed = Math.max(0, Math.floor((nowMs - receivedAt) / 1000));
  return Math.max(0, Math.ceil(remaining - elapsed));
}

export function remainingSecondsFromDeadline(
  deadline?: string | null,
  nowMs = Date.now(),
): number {
  const deadlineMs = deadline ? Date.parse(deadline) : NaN;
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function remainingSeconds(
  deadline?: string | null,
  source?: ServerCountdownSource | null,
  nowMs = Date.now(),
): number {
  const serverRemaining = remainingSecondsFromServer(source, nowMs);
  if (serverRemaining !== null) return serverRemaining;
  return remainingSecondsFromDeadline(deadline, nowMs);
}
