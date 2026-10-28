// Ein Seed für den Nutzer ist eine einfache Zahl; der Kern braucht 4×64 Bit.
// splitmix64 macht daraus deterministisch vier gut verteilte Werte.

const MASK = (1n << 64n) - 1n;

export function expandSeed(seed: number): [bigint, bigint, bigint, bigint] {
  let x = BigInt.asUintN(64, BigInt(Math.trunc(seed)));
  const next = () => {
    x = (x + 0x9e3779b97f4a7c15n) & MASK;
    let z = x;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  };
  return [next(), next(), next(), next()];
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Deterministischer Zufallsgenerator (xorshift128+) aus einem Seed. */
export function createRng(seed: number): () => number {
  let [s0, s1] = expandSeed(seed);
  return () => {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= (x << 23n) & MASK;
    x ^= x >> 17n;
    x ^= y ^ (y >> 26n);
    s1 = x;
    return Number(((s0 + s1) & MASK) >> 11n) / 2 ** 53;
  };
}

/** Fisher-Yates-Mischen mit gegebenem Zufallsgenerator (neues Array). */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
