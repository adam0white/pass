/** Current self knowledge. Other people's hidden feelings and learning stay private. */
import type { AffectReading } from '@adam0white/human-framework';
import { communityRun, isHF4, type Person } from '../sim/hf4-person.ts';

const feelingNames: Record<AffectReading['emotions'][number]['id'], string> = {
  joy: 'glad',
  distress: 'distressed',
  hope: 'hopeful',
  fear: 'afraid',
  relief: 'relieved',
  disappointment: 'disappointed',
  pride: 'proud',
  shame: 'ashamed',
  gratitude: 'grateful',
  anger: 'angry',
  guilt: 'guilty',
  love: 'loving',
  grief: 'grief',
  awe: 'awe',
  boredom: 'bored',
  loneliness: 'lonely',
};

export function liveReadingWords(observer: Person, target: Person): string[] {
  if (!isHF4(observer)) return [];
  const view = communityRun(observer).inspect({
    perspective: { kind: 'person', observer: observer.id },
    people: [target.id],
    select: ['affect', 'expectations'],
  }).people[0];
  if (view?.kind !== 'self') return [];
  const words: string[] = [];
  for (const part of view.parts) {
    if (part.select === 'affect') {
      const affect: AffectReading = part.value;
      const mood = affect.mood.valence > 0.2 ? 'content' : affect.mood.valence < -0.2 ? 'low' : 'steady';
      words.push(
        `I feel ${mood}${affect.mood.arousal > 0.65 ? ' and stirred up' : affect.mood.arousal < 0.25 ? ' and quiet' : ''}.`,
      );
      for (const emotion of affect.emotions) {
        const name = feelingNames[emotion.id];
        if (name && emotion.intensity > 0.1)
          words.push(
            emotion.id === 'grief' || emotion.id === 'awe'
              ? `I feel ${emotion.intensity > 0.65 ? 'deep ' : ''}${name}.`
              : `I feel ${emotion.intensity > 0.65 ? 'very ' : ''}${name}.`,
          );
      }
    }
    if (part.select === 'expectations') {
      const learned = part.value.filter((entry) => entry.samples > 0);
      if (learned.some((entry) => entry.valence > 0.2)) words.push('I remember things I did that felt good.');
      if (learned.some((entry) => entry.valence < -0.2)) words.push('I remember things I did that felt bad.');
      if (learned.some((entry) => entry.successRate > 0.65))
        words.push('I have learned that some things I try usually work.');
      if (learned.some((entry) => entry.successRate < 0.35))
        words.push('I have learned that some things I try often fail.');
    }
  }
  return words;
}
