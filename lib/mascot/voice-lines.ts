export type VoiceCategory = 'thrown' | 'bounced' | 'dizzy' | 'nagging' | 'factoid' | 'offscreenReturn' | 'greeting';

export const VOICE_LINES: Record<VoiceCategory, string[]> = {
  thrown: [
    'Weee!',
    'Zoom zoom!',
    'Do it again!',
    'Wheeeee!',
    "I'm flying!",
    '10/10 launch.',
    'Catch me if you can!',
  ],
  bounced: [
    'Boop.',
    'Is that all you got?',
    'Ok ok, easy!',
    'That tickled.',
    'Bouncy bouncy!',
    'Wall says hi.',
    'Boing!',
  ],
  dizzy: [
    'Wooooahhh.',
    'Which way is up…',
    'Room is spinning.',
    'Give me a sec…',
    'Ok that was a lot.',
  ],
  nagging: [
    "Don't forget to stretch!",
    'Practicing today?',
    'One more question won\'t hurt.',
    'Your streak misses you.',
    'Small steps still count.',
    "I'll be here when you need help.",
  ],
  factoid: [
    'Fun fact: the SAT has no penalty for wrong answers — always guess.',
    'Reading 20 min a day adds up to over a million words a year.',
    'Fibonacci: 1, 1, 2, 3, 5, 8… my patience, in reverse.',
    'The average SAT test-taker skips at least one easy question by rushing.',
    'Elimination beats guessing blind — cross off what you know is wrong first.',
    'Light travels 299,792 km/s. Faster than most study excuses.',
  ],
  offscreenReturn: [
    "I'm back. That was a WILD ride.",
    'You launched me into orbit. Rude.',
    'Cool cool cool, very cool.',
    "Guess who's back.",
    'Met a satellite up there. Nice guy.',
  ],
  greeting: [
    'Hey! What\'s up?',
    'Yeah? What\'s on your mind?',
    "I'm listening.",
    'Ready to chat.',
    'Hit me with it.',
  ],
};

export function pickLine(category: VoiceCategory): string {
  const arr = VOICE_LINES[category];
  return arr[Math.floor(Math.random() * arr.length)] ?? '';
}
