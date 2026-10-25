/** Private disclosures require an ordinary chosen conversation, never a biography import. */
export const PRIVATE_CLUES: Record<string, string> = {
  selim:
    'Nevin asked me to teach someone the whole grill station. I still have her list. Nobody’s initials are on it. I keep saying we are too busy during service. My grown son and I rarely phone each other. His mother and I are divorced.',
  dilek:
    'That rattle — could everyone stay still for ten seconds? I record kitchen sounds. I never record voices without permission. I have hundreds of little clips. Please don’t make a joke of every dropped spoon. My mother wants me to find steadier work. My younger brother mostly calls to ask for loans.',
  rafi: 'Someone paid me a deposit before I had checked the part. I spent some of it on the workshop trip. Now I avoid their street. That debt is separate from the tip jar. I haven’t put either of them right just by telling you. My cousin Can watches me, and my mother and sister are still at home.',
  zeynep:
    'Would you help me work out the costs of a daytime menu? The application is mine. I left the salary blank. My boys still need me at home, so this can’t become another unpaid shift.',
  hulya:
    'May I use that sunny ledge? I carried these seed envelopes with me through the hotel staff rooms. My adult stepdaughter calls them my portable garden. Her father and I are separated. I’m still looking for one particular tomato flavour.',
  murat:
    'If I leave for the depot job, give me an accurate reference. I told them I never get tired. You’ve seen my limits. Don’t write that I can manage people just because I worked a grill.',
  sam: 'Can you look at my testing notebook? Once I said I had reproduced an old bug, but I had only read someone else’s report. I hadn’t checked it myself. Here I want paid hours, and I want to say what I actually tried. I want my mother and sister to know the real terms.',
};

/** Named old customers become incidental accounts within this kitchen episode. */
export function episodeText(text: string): string {
  return text
    .replaceAll('Kemal the taxi driver', 'the taxi customer')
    .replaceAll('Ahmet the butcher', 'the butcher')
    .replaceAll('Ilyas the night watchman came', 'the night-shift customer came')
    .replaceAll('Aksoy sisters', 'sisters from the reading group')
    .replaceAll('Kemal’s taxi stand', 'the taxi stand')
    .replaceAll('Yıldız wedding', 'wedding')
    .replaceAll('Hasan Bey', 'the window-table customer')
    .replaceAll('Mr Hasan', 'the window-table customer')
    .replaceAll('Hasan', 'the window-table customer')
    .replaceAll('Mrs Arslan', 'the customer with a child')
    .replaceAll('Gül Arslan', 'the customer with a child')
    .replaceAll('the Aksoy sisters', 'the reading-group table')
    .replaceAll('Aksoy', 'reading group')
    .replaceAll('Kemal', 'the taxi customer')
    .replaceAll('Ilyas', 'the night-shift customer')
    .replaceAll('Ahmet', 'the butcher')
    .replaceAll('Demir', 'birthday')
    .replaceAll('Yıldız', 'wedding')
    .replace(/(^|[.!?]\s+|“)the /gu, '$1The ');
}
export const INVITATIONS: Record<string, string> = {
  selim: 'Selim offers to share Nevin’s notes on the grill station. Ask to read them with him.',
  dilek: 'Dilek asks for ten quiet seconds to record a rattling sound in the kitchen. Ask her why.',
  rafi: 'Rafi hesitates when he mentions a repair deposit. Offer to talk with him in private.',
  zeynep: 'Zeynep asks for help working out the costs of her daytime menu. Make time to listen.',
  hulya: 'Hülya asks to use a sunny ledge. Ask about her seed envelopes.',
  murat: 'Murat asks about a reference for a future job. Offer to talk about it honestly.',
  sam: 'Sam asks for feedback on his testing notebook. Read it with him.',
};
