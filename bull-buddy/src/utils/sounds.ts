let Audio: any = { setAudioModeAsync: () => Promise.resolve(), Sound: { createAsync: () => Promise.resolve({ sound: null }) } };
try { Audio = require('expo-av').Audio; } catch {}

interface SoundEntry {
  name: string;
  sound: any | null;
  loaded: boolean;
}

export const sounds: Record<string, SoundEntry> = {};

const SOUND_FILES: Record<string, any> = {
  coin: require('../../assets/sounds/coin.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  trade: require('../../assets/sounds/trade.wav'),
  celebration: require('../../assets/sounds/celebration.wav'),
};

export async function loadSounds() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    for (const [key, file] of Object.entries(SOUND_FILES)) {
      const { sound } = await Audio.Sound.createAsync(file, { volume: 0.5 });
      sounds[key] = { name: key, sound, loaded: true };
    }
  } catch {}
}

export async function playSound(key: string) {
  try {
    const entry = sounds[key];
    if (entry && entry.sound && entry.loaded) {
      await entry.sound.replayAsync();
    }
  } catch {}
}

export async function unloadSounds() {
  for (const key of Object.keys(sounds)) {
    const entry = sounds[key];
    if (entry.sound) {
      try { await entry.sound.unloadAsync(); } catch {}
    }
  }
}
