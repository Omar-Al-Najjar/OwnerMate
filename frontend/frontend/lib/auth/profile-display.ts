export function getDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  fallback = "OwnerMate User"
) {
  const normalizedFullName = fullName?.trim();
  if (normalizedFullName) {
    return normalizedFullName;
  }

  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return fallback;
  }

  const localPart = normalizedEmail.split("@", 1)[0]?.trim();
  if (!localPart) {
    return fallback;
  }

  const words = localPart
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  if (words.length === 0) {
    return fallback;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
