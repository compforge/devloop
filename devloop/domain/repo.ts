export function fuzzyScore(query: string, name: string): number | undefined {
  const q = query.toLowerCase(); const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 10 + n.length - q.length;
  const at = n.indexOf(q); if (at >= 0) return 100 + at + n.length - q.length;
  let index = 0; for (const char of n) if (char === q[index]) index += 1;
  return index === q.length ? 1_000 + n.length - q.length : undefined;
}
