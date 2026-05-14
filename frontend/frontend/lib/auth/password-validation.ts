export const PASSWORD_MIN_LENGTH = 8;

export type PasswordValidationIssue =
  | "min_length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special_character";

const PASSWORD_PATTERNS: Record<PasswordValidationIssue, RegExp> = {
  min_length: new RegExp(`.{${PASSWORD_MIN_LENGTH},}`),
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /\d/,
  special_character: /[^A-Za-z0-9]/,
};

export function getPasswordValidationIssues(
  password: string
): PasswordValidationIssue[] {
  return (Object.entries(PASSWORD_PATTERNS) as Array<
    [PasswordValidationIssue, RegExp]
  >)
    .filter(([, pattern]) => !pattern.test(password))
    .map(([issue]) => issue);
}

export function isStrongPassword(password: string) {
  return getPasswordValidationIssues(password).length === 0;
}
