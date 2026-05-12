const UI_DISPLAY_TIME_ZONE = "UTC";

export function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: UI_DISPLAY_TIME_ZONE,
  }).format(new Date(value));
}
