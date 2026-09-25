const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 3 horas", "há 2 dias". Cai para "agora" abaixo de 1 minuto. */
export function formatRelativeTime(value: string, now: Date = new Date()) {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) return rtf.format(Math.round(seconds / secondsInUnit), unit);
  }
  return "agora";
}
