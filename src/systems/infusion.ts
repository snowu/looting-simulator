import { findMaterial, catalystAffixBonus } from '../data/materials';
import { affix } from '../data/affixes';
import { medianAffix } from './crafting';
import { SIP_SECONDS } from './healing';
import type { Stats } from '../types';
import type { Ramp } from '../art/raster';

/**
 * Flask infusions. One stash material goes into the flask at the forge and
 * changes what a sip *does*, not a stat line for six seconds: the old version
 * handed out +1 Defense you could not feel, and wood and emerald did nothing
 * at all. Each family is one verb, scaled by the material's tier.
 */
export type DraughtKind = 'thick' | 'breath' | 'quick' | 'iron' | 'marrow' | 'kindled' | 'fight_milk';

export interface Draught {
  kind: DraughtKind;
  /** "Iron Draught", shown in the forge, the HUD tooltip and the sip message. */
  name: string;
  /** One line, with this material's numbers in it. */
  effect: string;
  /** Change to the sip's heal in percentage points (negative is the cost). */
  heal: number;
  /** Seconds the sip holds your guard down. */
  sipSeconds: number;
  /** Tint for the flask on the HUD and the effect bar. */
  color: string;
  ramp: Ramp;
  /** Iron: the next blow is reduced by this fraction of max health. */
  wardFrac?: number;
  /** Marrow: the next landed strike is multiplied by this and staggers. */
  marrowMult?: number;
  /** Kindled: the catalyst stat the weapon carries, and how much. */
  kindle?: Partial<Stats>;
  kindleLabel?: string;
}

/** How long each on-sip effect waits for you to use it. */
export const WARD_SECONDS = 12;
export const MARROW_SECONDS = 6;
export const KINDLE_SECONDS = 8;

const tierIdx = (tier: number): number => Math.max(0, Math.min(4, tier - 1));
const pick = (tier: number, ladder: readonly number[]): number => ladder[tierIdx(tier)]!;

const THICK_HEAL = [4, 6, 8, 10, 12] as const;
const BREATH_COST = [10, 8, 6, 4, 2] as const;
const QUICK_SIP = [0.4, 0.35, 0.3, 0.25, 0.2] as const;
const WARD_FRAC = [0.1, 0.15, 0.2, 0.27, 0.35] as const;
const MARROW_MULT = [1.3, 1.45, 1.6, 1.8, 2] as const;
const INFUSION_COST = 10;

/** Only gems whose catalyst rides on the blade: the rest have no sip to give. */
const KINDLING_AFFIXES = new Set(['blazing', 'rimed', 'blessed', 'umbral', 'leeching']);

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/**
 * What a flask infused with `ref` does, or null when the ref cannot be put in
 * the flask at all (valuables, the stat gems, anything unknown).
 */
export function draught(ref: string | null | undefined): Draught | null {
  if (!ref) return null;
  if (ref === 'fight_milk') {
    return {
      kind: 'fight_milk', name: 'Fight Milk', heal: -INFUSION_COST, sipSeconds: SIP_SECONDS,
      effect: `Always on from delve entry: stamina regenerates x1.7, max stamina -20. Sips heal ${INFUSION_COST} points less.`,
      color: '#e8dca0', ramp: ['#2a2410', '#6a6030', '#c8c088', '#f8f4d8'],
    };
  }
  const m = findMaterial(ref);
  if (!m) return null;
  const t = m.tier;
  switch (m.category) {
    case 'hide': {
      const heal = pick(t, THICK_HEAL);
      return {
        kind: 'thick', name: 'Thick Draught', heal, sipSeconds: SIP_SECONDS,
        effect: `Each sip heals ${heal} points more.`,
        color: '#d0885a', ramp: ['#2e160c', '#6a3418', '#b0643a', '#f0b890'],
      };
    }
    case 'cloth': {
      const cost = pick(t, BREATH_COST);
      return {
        kind: 'breath', name: 'Breath Draught', heal: -cost, sipSeconds: SIP_SECONDS,
        effect: `Each sip refills your stamina. Heals ${cost} points less.`,
        color: '#a8e070', ramp: ['#1c2e10', '#3c6a20', '#78b048', '#d8f8b0'],
      };
    }
    case 'wood': {
      const s = pick(t, QUICK_SIP);
      return {
        kind: 'quick', name: 'Quick Draught', heal: -INFUSION_COST, sipSeconds: s,
        effect: `A sip takes ${s.toFixed(2)}s instead of ${SIP_SECONDS.toFixed(2)}s: your guard is down for less. Heals ${INFUSION_COST} points less.`,
        color: '#f0d060', ramp: ['#3a2a08', '#7a5a14', '#c89a30', '#fff0a0'],
      };
    }
    case 'metal': {
      const f = pick(t, WARD_FRAC);
      return {
        kind: 'iron', name: 'Iron Draught', heal: -INFUSION_COST, sipSeconds: SIP_SECONDS, wardFrac: f,
        effect: `Each sip wards you: the next blow within ${WARD_SECONDS}s is reduced by up to ${pct(f)} of your max health. Heals ${INFUSION_COST} points less.`,
        color: '#a8c0e0', ramp: ['#1a2230', '#3a4c68', '#7890b8', '#dce8ff'],
      };
    }
    case 'bone': {
      const x = pick(t, MARROW_MULT);
      return {
        kind: 'marrow', name: 'Marrow Draught', heal: -INFUSION_COST, sipSeconds: SIP_SECONDS, marrowMult: x,
        effect: `Each sip readies a blow: your next strike within ${MARROW_SECONDS}s deals x${x} and staggers anything but a king. Heals ${INFUSION_COST} points less.`,
        color: '#f0e8d0', ramp: ['#3a3020', '#7a6a50', '#c8b890', '#fffaf0'],
      };
    }
    case 'gem': {
      if (!m.catalystAffix || !KINDLING_AFFIXES.has(m.catalystAffix)) return null;
      const a = affix(m.catalystAffix);
      // Twice what the forge would roll the same gem into a weapon for: it only
      // lasts eight seconds and it cost a sip's worth of healing.
      const value = 2 * (medianAffix(m.catalystAffix, m.tier * 2) + catalystAffixBonus(m));
      const label = a.stat === 'leech' ? `${value}% Life Leech` : `+${value} ${a.stat[0]!.toUpperCase()}${a.stat.slice(1)} damage`;
      return {
        kind: 'kindled', name: 'Kindled Draught', heal: -INFUSION_COST, sipSeconds: SIP_SECONDS,
        kindle: { [a.stat]: value }, kindleLabel: label,
        effect: `Each sip kindles your weapon: ${label} for ${KINDLE_SECONDS}s. Heals ${INFUSION_COST} points less.`,
        color: '#ff9a50', ramp: ['#3a1004', '#8a3008', '#e07020', '#ffe090'],
      };
    }
    default:
      return null;
  }
}

export const PLAIN_FLASK_RAMP: Ramp = ['#173536', '#27706d', '#63b9a9', '#d2fff0'];
