import { generateMatchKey, MATCH_KEY_ALPHABET } from "./match-key.util";

describe("generateMatchKey", () => {
  it("should generate a key of exactly 8 characters", () => {
    const key = generateMatchKey();
    expect(key).toHaveLength(8);
  });

  it("should only contain characters from MATCH_KEY_ALPHABET (no 0/O, 1/I)", () => {
    for (let i = 0; i < 50; i++) {
      const key = generateMatchKey();
      expect(key).toHaveLength(8);
      for (const char of key) {
        expect(MATCH_KEY_ALPHABET.includes(char)).toBe(true);
        expect(["0", "O", "1", "I"].includes(char)).toBe(false);
      }
    }
  });
});

