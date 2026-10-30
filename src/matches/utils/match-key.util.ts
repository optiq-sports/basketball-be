import * as crypto from "crypto";

export const MATCH_KEY_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateMatchKey(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += MATCH_KEY_ALPHABET[bytes[i] % MATCH_KEY_ALPHABET.length];
  }
  return result;
}

