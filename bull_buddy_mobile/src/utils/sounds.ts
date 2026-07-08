let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export async function playSound(_name: string) {
  if (!enabled) return;
}

export async function cleanupSounds() {
}
