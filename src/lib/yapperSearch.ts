// Shared name and handle matcher for admin rosters and any other
// client-side yapper filter. Matches the public board search rule:
// trim, strip a leading @, then case insensitive substring.

export function matchesYapperSearch(
  rawTerm: string,
  person: { handle: string; displayName: string },
): boolean {
  const term = rawTerm.trim().replace(/^@/, "").toLowerCase();
  if (!term) return true;
  return (
    person.handle.toLowerCase().includes(term) ||
    person.displayName.toLowerCase().includes(term)
  );
}
