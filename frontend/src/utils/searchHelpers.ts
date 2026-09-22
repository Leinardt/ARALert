/**
 * Advanced multi-word prefix search helper for ARALert tables.
 * 
 * Rules:
 * 1. Case-insensitive.
 * 2. Query is split by whitespace into individual tokens (e.g., "Nyan Jean" -> ["nyan", "jean"]).
 * 3. Every query token must match the beginning (prefix) of at least one word in the searchable fields.
 * 4. Order-independent: "Jean Nyan" matches "Nyan Jean".
 * 5. Prefix-matching: "jea" matches "Jean", but "ean" does NOT match "Jean".
 * 6. Handles LRNs and numbers: "1234" matches "123456789012".
 */
export const matchesSearch = (
  query: string | null | undefined,
  ...targetTexts: (string | number | null | undefined)[]
): boolean => {
  if (!query) return true;
  const qTokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (qTokens.length === 0) return true;

  const targetWords: string[] = [];
  for (const text of targetTexts) {
    if (text !== null && text !== undefined && text !== '') {
      const words = String(text)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(Boolean);
      targetWords.push(...words);
    }
  }

  if (targetWords.length === 0) return false;

  return qTokens.every((qToken) => {
    const cleanedQToken = qToken.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!cleanedQToken) return true;
    return targetWords.some((tWord) => tWord.startsWith(cleanedQToken));
  });
};
