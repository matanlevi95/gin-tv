// Generate a 4-char human-readable room code avoiding confusing chars.
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateRoomCode(rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ROOM_ALPHABET[Math.floor(rng() * ROOM_ALPHABET.length)];
  }
  return out;
}

export function isValidRoomCode(s: string): boolean {
  if (s.length !== 4) return false;
  for (const c of s) if (!ROOM_ALPHABET.includes(c)) return false;
  return true;
}
