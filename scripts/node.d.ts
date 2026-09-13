/*
 * The scripts folder writes its reports to disk, and the project deliberately
 * carries no @types/node. This is the whole of the Node surface the harnesses
 * and asset tests touch, declared locally rather than pulling in a dependency.
 */
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}

declare const process: { env: Record<string, string | undefined>; argv: string[]; cwd(): string };
