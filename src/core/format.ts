/** A sum of gold as the player reads it everywhere: whole coins, grouped, with a g. */
export function gold(n: number): string {
  return `${Math.floor(n).toLocaleString()}g`;
}
