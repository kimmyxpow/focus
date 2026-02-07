export type SoundId = 'rain' | 'forest' | 'night' | 'stream' | 'desert' | 'wind' | 'cafe';

export interface Sound {
  id: SoundId;
  name: string;
  description: string;
  icon: string;
  src: string;
}

export interface SoundCredit {
  sound: string;
  credit: string;
}

const SOUNDS: Sound[] = [
  {
    id: 'rain',
    name: 'Rain',
    description: 'Gentle rainfall for peaceful focus',
    icon: '🌧️',
    src: new URL('../assets/sounds/rain.mp3', import.meta.url).href,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Birds and nature ambience',
    icon: '🌲',
    src: new URL('../assets/sounds/forest.mp3', import.meta.url).href,
  },
  {
    id: 'night',
    name: 'Night',
    description: 'Calm evening atmosphere',
    icon: '🌙',
    src: new URL('../assets/sounds/night.mp3', import.meta.url).href,
  },
  {
    id: 'stream',
    name: 'Stream',
    description: 'Flowing water sounds',
    icon: '💧',
    src: new URL('../assets/sounds/stream.mp3', import.meta.url).href,
  },
  {
    id: 'desert',
    name: 'Desert',
    description: 'Wind across open landscapes',
    icon: '🏜️',
    src: new URL('../assets/sounds/desert.mp3', import.meta.url).href,
  },
  {
    id: 'wind',
    name: 'Wind',
    description: 'Soft breeze through trees',
    icon: '💨',
    src: new URL('../assets/sounds/wind.mp3', import.meta.url).href,
  },
  {
    id: 'cafe',
    name: 'Café',
    description: 'Cozy coffee shop ambience',
    icon: '☕',
    src: new URL('../assets/sounds/cafe.mp3', import.meta.url).href,
  },
];

export function getSounds(): Sound[] {
  return SOUNDS;
}

export function getSoundById(id: SoundId): Sound | undefined {
  return SOUNDS.find(sound => sound.id === id);
}

export function getCredits(): SoundCredit[] {
  return [
    {
      sound: 'Rain',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/liecio-3298866/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=257596" target="_blank" rel="noopener noreferrer">LIECIO</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=257596" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Forest',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/audiopapkin-14728698/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=296528" target="_blank" rel="noopener noreferrer">Paweł Spychała</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=296528" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Night',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=17064" target="_blank" rel="noopener noreferrer">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=17064" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Stream',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/sspsurvival-22364443/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=109237" target="_blank" rel="noopener noreferrer">Semen Surin</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=109237" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Desert',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/tanweraman-29554143/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=350417" target="_blank" rel="noopener noreferrer">Aman Kumar</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=350417" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Wind',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/soundreality-31074404/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=457957" target="_blank" rel="noopener noreferrer">Jurij</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=457957" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
    {
      sound: 'Cafe',
      credit: 'Sound Effect by <a href="https://pixabay.com/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=32940" target="_blank" rel="noopener noreferrer">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=32940" target="_blank" rel="noopener noreferrer">Pixabay</a>'
    },
  ];
}
