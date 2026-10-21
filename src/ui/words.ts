/** Quiet setting vocabulary, rendered without changing the replayed journal. */
export const lira = (n: number) => `₺${n.toLocaleString('en-GB')}`;

export function gloss(text: string, currency = false): string {
  const words = text
    .replace(/₺(-?\d[\d,]*(?:\.\d+)?)/gu, (_match, amount: string) =>
      lira(Number(amount.replaceAll(',', ''))),
    )
    .replace(/Another minute for the crust/gu, 'Leave it in for the crust')
    .replace(/\bmaghrib\b(?! \(sunset prayer\))/gu, 'maghrib (sunset prayer)');
  return currency
    ? words.replace(/₺-?[\d,.]+(?: \(Turkish lira\))?/u, (amount) =>
        amount.endsWith('(Turkish lira)') ? amount : `${amount} (Turkish lira)`,
      )
    : words;
}
