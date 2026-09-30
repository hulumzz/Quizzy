const pad = (value) => String(value).padStart(2, '0');

export function toLocalDateTimeInput(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
}

export function defaultLocalDateTime(hours = 168, now = Date.now()) {
  const date = new Date(now + hours * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return toLocalDateTimeInput(date);
}
