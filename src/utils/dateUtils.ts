export function getTodayInLaPaz(): Date {
  const now = new Date();
  const serverUtcOffset = now.getTimezoneOffset();
  const laPazUtcOffset = 240;
  const diffMinutes = serverUtcOffset - laPazUtcOffset;
  return new Date(now.getTime() + diffMinutes * 60000);
}
