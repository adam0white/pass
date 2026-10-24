/** Quiet setting vocabulary, rendered without changing the replayed journal. */
export const lira = (n: number) => `₺${n.toLocaleString('en-GB')}`;

export function gloss(text: string, currency = false): string {
  const words = plainEnglish(text)
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

/** Display-only edits keep journals and replay hashes unchanged. */
export function plainEnglish(text: string): string {
  return text
    .replace(/I’m holding (.+?) until (\d{2}:\d{2})\./gu, 'I’m working at $1 until $2.')
    .replace(
      /Then twenty minutes for a plate; back on (.+?) until close\./gu,
      'Then I take a 20-minute meal break. After that, I return to $1 until closing.',
    )
    .replace(
      /(The grill|The cold side|The plates|The oven) until (\d{2}:\d{2})\./gu,
      (_match, station: string, until: string) => `I will work on ${station.toLowerCase()} until ${until}.`,
    )
    .replaceAll('A full house, nobody walked', 'The restaurant was full. No customers left without eating.')
    .replaceAll('A week with no walkouts', 'No customers left without eating this week.')
    .replaceAll('The wedding trays on time', 'The wedding trays arrived on time.')
    .replaceAll('Fed them through the dark', 'We fed the customers while the gas was off.')
    .replaceAll(
      'Eighteen. A testing notebook beside his lunch.',
      'He is eighteen. His testing notebook sits beside his lunch.',
    )
    .replaceAll(
      'Twenty-seven, quick hands, a phone in his back pocket.',
      'He is twenty-seven. He works quickly and keeps a phone in his back pocket.',
    )
    .replaceAll(
      'Forty-five, steady, reading the menu on the wall while she talks.',
      'She is forty-five. She reads the menu on the wall while she talks calmly.',
    )
    .replaceAll(
      'Seventeen, too thin, already rolling his sleeves up.',
      'He is seventeen and very thin. He is already rolling up his sleeves.',
    )
    .replaceAll(
      'Twenty years in a school canteen. I’m home by ten. My boys.',
      'I worked in a school canteen for twenty years. I must be home by ten for my boys.',
    )
    .replaceAll('Your promise, Chef. Not mine.', 'You made that promise, Chef. I did not.')
    .replaceAll(
      'Twenty trays across the road, on time.',
      'We delivered twenty trays across the road on time.',
    )
    .replaceAll(
      'A little colder after waiting at the pass.',
      'The food was a little colder after waiting at the pass.',
    )
    .replaceAll('Then the price of supper.', 'Then they paid for supper.')
    .replaceAll('Quiet night from you. I liked it, mostly.', 'You were quiet tonight. I mostly liked it.')
    .replaceAll('Quiet. I kind of liked it.', 'You were quiet. I liked it.')
    .replaceAll('Better tonight. I mean it.', 'Tonight was better. I mean it.')
    .replaceAll('You’re learning the kitchen. Slowly.', 'You are slowly learning how to run the kitchen.')
    .replaceAll('My knees, Chef. My knees.', 'My knees hurt, Chef.')
    .replaceAll(
      'Twenty years on that grill. It still surprises me.',
      'I have worked at that grill for twenty years. It still surprises me.',
    )
    .replaceAll('I didn’t break anything. Well. One.', 'I broke only one thing.')
    .replaceAll('I counted the plates. All there.', 'I counted the plates. They were all there.')
    .replaceAll('Long night. Good kitchen, though.', 'It was a long night, but this is a good kitchen.')
    .replaceAll(
      'I washed plates in the rush. Twenty years I didn’t.',
      'I washed plates during the rush. I had refused to do that for twenty years.',
    )
    .replaceAll(
      'My sister’s going on the trip. Because of you.',
      'My sister is going on the trip because of you.',
    )
    .replaceAll(
      'Hold to insist; it can cost trust.',
      'Hold a job button to insist. Insisting can cost trust.',
    )
    .replaceAll(
      'A broken promise is a strike.',
      'A broken promise counts as a strike against the restaurant.',
    )
    .replaceAll(
      'Promises, a day off, hiring and prices take effect next week.',
      'Your choices about promises, days off, hiring and prices take effect next week.',
    )
    .replaceAll('Twenty years on Nevin’s grill.', 'I have worked on Nevin’s grill for twenty years.')
    .replace(
      /Leave my plate for (.+?)\? Let me eat first\./gu,
      'Stop eating to work at $1? Let me finish my meal first.',
    )
    .replace(
      /Off my cigarette for (.+?)\? Let me finish it\./gu,
      'Stop smoking to work at $1? Let me finish my cigarette first.',
    )
    .replace(/Off the phone for (.+?)\? One minute\./gu, 'End my call to work at $1? Give me one minute.')
    .replace(
      /Off my ten for (.+?)\? Let me have my ten\./gu,
      'End my break to work at $1? Let me finish my ten-minute break.',
    )
    .replaceAll(
      'That job would leave me spent for the rest of the service, Chef.',
      'That job would leave me too tired for the rest of the service, Chef.',
    )
    .replaceAll(
      'Two tables booked for a birthday, and the derby again.',
      'Two tables are booked for a birthday. The derby is on again.',
    )
    .replaceAll(
      'The Yıldız wedding: twenty trays for the hall across the road, by eight. Then the usual Saturday.',
      'The Yıldız wedding needs twenty trays at the hall across the road by eight. We also have our usual Saturday customers.',
    )
    .replaceAll('A year on Thursday since Nevin died.', 'Nevin died a year ago this Thursday.')
    .replaceAll('let me have my ten', 'let me finish my ten-minute break')
    .replaceAll('rather the lighter job', 'I prefer the lighter job')
    .replaceAll('rather paid work', 'I prefer paid work')
    .replaceAll('rather keep at this', 'I prefer my current job')
    .replaceAll('I’d be spent later', 'I would be too tired later');
}
