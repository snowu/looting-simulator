/*
 * The scripts folder writes its reports to disk, and the project deliberately
 * carries no @types/node. This is the whole of the Node surface the harness
 * touches, declared locally rather than pulling in a dependency for two calls.
 */
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}
declare const process: { env: Record<string, string | undefined>; argv: string[] };
