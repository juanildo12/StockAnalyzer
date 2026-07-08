let Audio: any = { setAudioModeAsync: () => Promise.resolve(), Sound: { createAsync: () => Promise.resolve({ sound: null }) } };
try { Audio = require('expo-av').Audio; } catch {}

const cache = new Map<string, { sound: any; loaded: boolean }>();

const FILES: Record<string, any> = {
  coin: require('../../assets/sounds/coin.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  trade: require('../../assets/sounds/trade.wav'),
  celebration: require('../../assets/sounds/celebration.wav'),
  moo: require('../../assets/sounds/toro_moo_long.mp3'),
  mooShort: require('../../assets/sounds/toro_moo_short.mp3'),
};

async function tryPlayReal(key: string, volume = 0.5): Promise<boolean> {
  const entry = cache.get(key);
  if (!entry?.loaded || !entry.sound) return false;
  try {
    await entry.sound.setVolumeAsync(volume);
    await entry.sound.replayAsync();
    return true;
  } catch {
    entry.loaded = false;
    return false;
  }
}

function generateWav(freq: number, durMs: number, sampleRate = 44100): Uint8Array {
  const numSamples = Math.floor(sampleRate * durMs / 1000);
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data');
  dv.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.max(0, 1 - i / numSamples);
    const val = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    dv.setInt16(44 + i * 2, val * 32767, true);
  }
  return new Uint8Array(buf);
}

let synthInitialized = false;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playWebTone(freq: number, durMs: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durMs / 1000);
}

function playWebCascade() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playWebTone(f, 150, 'sine', 0.25), i * 80);
  });
}

function playWebSweep(up = true) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(up ? 300 : 800, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(up ? 800 : 300, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function playWebBeep(volume = 0.3) {
  playWebTone(880, 100, 'square', volume);
}

function playWebWrong() {
  playWebTone(200, 300, 'sawtooth', 0.2);
  setTimeout(() => playWebTone(150, 300, 'sawtooth', 0.2), 150);
}

function playFallbackSound(type: string) {
  if (typeof window !== 'undefined' && (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')) {
    switch (type) {
      case 'tone': playWebTone(660, 150, 'sine', 0.25); break;
      case 'cascade': playWebCascade(); break;
      case 'beep': playWebBeep(); break;
      case 'sweepUp': playWebSweep(true); break;
      case 'sweepDown': playWebSweep(false); break;
      case 'wrong': playWebWrong(); break;
      case 'click': playWebBeep(0.1); break;
      case 'coin': playWebTone(988, 80, 'sine', 0.2); setTimeout(() => playWebTone(1319, 120, 'sine', 0.2), 80); break;
      case 'levelup': playWebCascade(); break;
    }
  }
}

export async function initSoundManager() {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
  } catch {}
  for (const [key, file] of Object.entries(FILES)) {
    try {
      const { sound } = await Audio.Sound.createAsync(file, { volume: 0.5 });
      cache.set(key, { sound, loaded: true });
    } catch {
      cache.set(key, { sound: null, loaded: false });
    }
  }
  synthInitialized = true;
}

export async function playCoin(amount?: number) {
  if (!await tryPlayReal('coin', 0.5)) playFallbackSound('coin');
}

export async function playCorrect() {
  if (!await tryPlayReal('correct', 0.5)) playFallbackSound('cascade');
}

export async function playWrong() {
  if (!await tryPlayReal('wrong', 0.5)) playFallbackSound('wrong');
}

export async function playBuy() {
  if (Math.random() < 0.35) {
    if (!await tryPlayReal('mooShort', 0.85)) {
      if (!await tryPlayReal('coin', 0.5)) playFallbackSound('tone');
    }
  } else {
    if (!await tryPlayReal('coin', 0.5)) playFallbackSound('coin');
  }
}

export async function playSell() {
  if (!await tryPlayReal('coin', 0.5)) playFallbackSound('coin');
}

export async function playLevelUp() {
  if (!await tryPlayReal('moo', 0.9)) {
    if (!await tryPlayReal('levelup', 0.5)) playFallbackSound('levelup');
  }
}

export async function playAchievement() {
  await playMoo();
  if (!await tryPlayReal('celebration', 0.5)) playFallbackSound('cascade');
}

export async function playStreakClaim(day: number) {
  if (day > 0 && day % 3 === 0) {
    await playMoo();
  } else {
    if (!await tryPlayReal('coin', 0.5)) playFallbackSound('coin');
  }
}

export async function playMoo() {
  if (!await tryPlayReal('moo', 0.9)) {
    if (!await tryPlayReal('celebration', 0.5)) playFallbackSound('levelup');
  }
}

export async function playMooShort() {
  if (!await tryPlayReal('mooShort', 0.85)) playFallbackSound('tone');
}

export async function playComboBig(streak: number) {
  if (!await tryPlayReal('celebration', 0.5)) playFallbackSound('cascade');
}

export async function playClick() {
  playFallbackSound('click');
}

export async function playSound(key: string) {
  switch (key) {
    case 'coin': return playCoin();
    case 'correct': return playCorrect();
    case 'wrong': return playWrong();
    case 'levelup': return playLevelUp();
    case 'celebration': return playAchievement();
    case 'trade': return playBuy();
    default: await tryPlayReal(key, 0.5);
  }
}

export async function unloadSounds() {
  for (const [, entry] of cache) {
    if (entry.sound) {
      try { await entry.sound.unloadAsync(); } catch {}
    }
  }
  cache.clear();
  if (audioCtx) {
    try { await audioCtx.close(); } catch {}
    audioCtx = null;
  }
}
