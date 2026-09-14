export type SigilId = 'wardcry' | 'snuff' | 'sounding' | 'threshold' | 'temper';

export interface SigilDef {
  id: SigilId;
  name: string;
  icon: string;
  cooldown: number;
  cast: number;
  stamina: number;
  description: string;
}

export const SIGILS: readonly SigilDef[] = [
  { id: 'wardcry', name: 'Sigil of Wardcry', icon: 'ic_gem', cooldown: 70, cast: 0.35, stamina: 30, description: 'Shouts a foe backward and stuns it.' },
  { id: 'snuff', name: 'Sigil of Snuff', icon: 'ic_gem', cooldown: 90, cast: 0.5, stamina: 25, description: 'Breaks pursuit, then leaves you in darkness.' },
  { id: 'sounding', name: 'Sigil of Sounding', icon: 'ic_gem', cooldown: 45, cast: 0.8, stamina: 20, description: 'Reads nearby stone and hidden mechanisms.' },
  { id: 'threshold', name: 'Sigil of Threshold', icon: 'ic_gem', cooldown: 80, cast: 0.5, stamina: 25, description: 'Consecrates one tile for easier parries.' },
  { id: 'temper', name: 'Sigil of Temper', icon: 'ic_gem', cooldown: 90, cast: 1.2, stamina: 15, description: 'Mends the most worn equipped item.' },
];

const BY_ID = new Map(SIGILS.map((s) => [s.id, s]));

export function findSigil(id: string | null | undefined): SigilDef | undefined {
  return id ? BY_ID.get(id as SigilId) : undefined;
}

export function sigil(id: string): SigilDef {
  const def = findSigil(id);
  if (!def) throw new Error(`unknown sigil ${id}`);
  return def;
}
