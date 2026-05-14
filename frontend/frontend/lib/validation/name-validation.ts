export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 60;

type NameValidationOptions = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

export function getNameValidationIssue(
  value: string | null | undefined,
  options: NameValidationOptions = {}
) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const minLength = options.minLength ?? NAME_MIN_LENGTH;
  const maxLength = options.maxLength ?? NAME_MAX_LENGTH;

  if (!normalized) {
    return options.required ? "required" : null;
  }

  if (normalized.length < minLength) {
    return "too_short";
  }

  if (normalized.length > maxLength) {
    return "too_long";
  }

  return null;
}

export function isNameValid(
  value: string | null | undefined,
  options: NameValidationOptions = {}
) {
  return getNameValidationIssue(value, options) === null;
}
