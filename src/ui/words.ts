/** Quiet setting vocabulary, rendered without changing the replayed journal. */
export function gloss(text: string): string {
  return text.replace(/\bmaghrib\b(?! \(sunset prayer\))/gu, 'maghrib (sunset prayer)');
}
