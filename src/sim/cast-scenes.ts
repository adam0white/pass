/** Private disclosures require an ordinary chosen conversation, never a biography import. */
export const PRIVATE_CLUES: Record<string, string> = {
  selim:
    'Nevin asked me to teach someone the whole grill station. I still have her list. Nobody’s initials are on it. I keep saying service is too busy. My grown son and I rarely phone; his mother and I are divorced.',
  dilek:
    'That rattle — could everyone hold still ten seconds? I record kitchen sounds. No voices without permission. I have hundreds of little clips. Please don’t make every dropped spoon a joke. My mother wants steadier work for me. My younger brother mostly calls for loans.',
  rafi: 'Someone paid me a deposit before I checked the part. I used some for the workshop trip. I’m avoiding their street. That debt is separate from the jar. I haven’t put either right by telling you. My cousin Can watches me, and my mother and sister are still at home.',
  zeynep:
    'Would you help cost a daytime menu? The application is mine. I left the salary blank. My boys still need me home; this can’t become another unpaid shift.',
  hulya:
    'May I use that sunny ledge? These seed envelopes came through the hotel staff rooms with me. My adult stepdaughter calls them my portable garden. Her father and I are separated. I’m still looking for one particular tomato flavour.',
  murat:
    'If I leave for the depot, give me an accurate reference. I told them I never tire. You’ve seen the limits. Don’t write that I can manage people just because I worked a grill.',
  sam: 'Can you look at my testing notebook? I called an old bug reproduced after reading someone else’s report. I hadn’t checked it. Here I want paid hours, and to say what I actually tried. I want my mother and sister to know the actual terms.',
};

/** Named old customers become incidental accounts within this kitchen episode. */
export function episodeText(text: string): string {
  return text
    .replaceAll('Hasan Bey', 'the window-table customer')
    .replaceAll('Hasan', 'the window-table customer')
    .replaceAll('Mrs Arslan', 'the customer with a child')
    .replaceAll('Gül Arslan', 'the customer with a child')
    .replaceAll('the Aksoy sisters', 'the reading-group table')
    .replaceAll('Aksoy', 'reading group')
    .replaceAll('Kemal', 'the taxi customer')
    .replaceAll('Ilyas', 'the night-shift customer')
    .replaceAll('Ahmet', 'the butcher')
    .replaceAll('Demir', 'birthday')
    .replaceAll('Yıldız', 'wedding');
}
export const INVITATIONS: Record<string, string> = {
  selim: 'Selim offers Nevin’s station notes. Ask to read them with him',
  dilek: 'Dilek asks for ten quiet seconds to catch a rattle. Ask why',
  rafi: 'Rafi hesitates over a repair deposit. Offer a private conversation',
  zeynep: 'Zeynep invites help costing her daytime menu. Make time to listen',
  hulya: 'Hülya asks for a sunny ledge. Ask about her seed envelopes',
  murat: 'Murat asks about a future job reference. Offer to discuss it honestly',
  sam: 'Sam offers his testing notebook for feedback. Read it with him',
};
