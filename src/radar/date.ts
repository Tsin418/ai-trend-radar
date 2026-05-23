export function getRadarTimeZone(): string {
  return process.env.TZ || 'Asia/Shanghai';
}

export function getLocalDateLabel(date = new Date(), timeZone = getRadarTimeZone()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function getLocalIsoWeekLabel(date = new Date(), timeZone = getRadarTimeZone()): string {
  const localDate = getLocalDateLabel(date, timeZone);
  const [year, month, day] = localDate.split('-').map((value) => Number.parseInt(value, 10));
  const target = new Date(Date.UTC(year, month - 1, day));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}
