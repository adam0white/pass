/** Only narration text and explicitly admitted presentation metadata are excluded.
 * usedLines, action/commitment labels, RNG and all mechanical fields remain exact.
 */
export function hfMechanics(value: unknown, key = '', parent = ''): unknown {
  if (key === 'engine' || key === 'plainNarration') return undefined;
  if (key === 'lexicon' && value && typeof value === 'object') {
    const { plainEnglish: _plainEnglish, ...rest } = value as Record<string, unknown>;
    return Object.keys(rest).length ? rest : undefined;
  }
  if (
    (['text', 'words', 'line', 'summary', 'narration', 'says', 'answer'].includes(key) ||
      (key === 'intention' && value !== 'missed') ||
      (parent === 'counterOffer' && key === 'label')) &&
    typeof value === 'string'
  )
    return '<prose>';
  if (Array.isArray(value)) return value.map((child) => hfMechanics(child, '', key));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([name, child]) => [name, hfMechanics(child, name, key)])
      .filter(([, child]) => child !== undefined),
  );
}
