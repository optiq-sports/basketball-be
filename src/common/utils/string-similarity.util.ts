/**
 * String Similarity Utilities
 * Implements multiple algorithms for fuzzy matching
 */

export class StringSimilarity {
  /**
   * Calculate Levenshtein distance between two strings
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost, // substitution
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity percentage (0-100)
   */
  static similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;

    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;

    const distance = this.levenshteinDistance(
      str1.toLowerCase().trim(),
      str2.toLowerCase().trim(),
    );
    return ((maxLen - distance) / maxLen) * 100;
  }

  /**
   * Jaro-Winkler similarity (better for names)
   */
  static jaroWinkler(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Jaro distance
    const jaro = this.jaro(s1, s2);

    // Winkler modification
    let prefix = 0;
    const minLen = Math.min(s1.length, s2.length);
    for (let i = 0; i < minLen && i < 4; i++) {
      if (s1[i] === s2[i]) {
        prefix++;
      } else {
        break;
      }
    }

    return (jaro + (0.1 * prefix * (1 - jaro))) * 100;
  }

  private static jaro(str1: string, str2: string): number {
    const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Find transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    return (
      (matches / str1.length +
        matches / str2.length +
        (matches - transpositions / 2) / matches) /
      3
    );
  }

  /**
   * Normalize string for comparison
   */
  static normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  /**
   * Compare two strings with multiple algorithms and return best match
   */
  static compare(str1: string, str2: string): number {
    const normalized1 = this.normalize(str1);
    const normalized2 = this.normalize(str2);

    const levenshtein = this.similarity(normalized1, normalized2);
    const jaroWinkler = this.jaroWinkler(normalized1, normalized2);

    // Return the higher of the two scores
    return Math.max(levenshtein, jaroWinkler);
  }
}

