import type { Locale } from "./messages";

/** BCP 47 tag for Intl formatters — never rely on browser default when UI locale is set. */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-EG" : "en-GB";
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(
  value: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleString(intlLocale(locale), options);
}

export function formatDate(
  value: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleDateString(intlLocale(locale), options);
}
