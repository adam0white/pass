/** Money formatting, plus the one display gloss left: HF activity labels stay as recorded in person state. */
export const lira = (n: number) => `₺${n.toLocaleString('en-GB')}`;

export function gloss(text: string, currency = false): string {
  const words = text
    .replace(/₺(-?\d[\d,]*(?:\.\d+)?)/gu, (_match, amount: string) =>
      lira(Number(amount.replaceAll(',', ''))),
    )
    .replace(/\bpray maghrib\b/gu, 'say the sunset prayer')
    .replace(
      /\b(the |my |his )?maghrib\b(?: \(sunset prayer\))?/gu,
      (_m, owner?: string) => `${owner ?? 'the '}sunset prayer`,
    );
  return currency
    ? words.replace(/₺-?[\d,.]+(?: \(Turkish lira\))?/u, (amount) =>
        amount.endsWith('(Turkish lira)') ? amount : `${amount} (Turkish lira)`,
      )
    : words;
}
