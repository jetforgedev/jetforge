/** Truncate a Date to the start of its UTC minute. */
export function getMinuteBucketStart(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}
