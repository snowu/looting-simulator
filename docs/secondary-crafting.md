# Two secondary crafting slots

Every equipment recipe uses `[primary, secondary 1, secondary 2, catalyst]`.

- Primary categories and quantities are unchanged. A club accepts wood/bone for its body, never metal; a sword accepts metal for its blade.
- Both secondary slots accept all structural families: metal, wood, hide, cloth, bone.
- The first secondary retains its recipe quantity. Rings and pendants, which previously had none, gain a required one-unit support.
- The second secondary is optional, costs one unit, and defaults to None.
- The catalyst stays separate. It remains optional except for the pendant’s required stone.
- Repeated materials are allowed, including matching the primary. Costs are totaled across all slots before any inventory is consumed.

Both secondary slots apply the full material modifiers exactly once, including elemental bonuses. They do not change the primary tier, rarity calculation, affix budget or mastery scaling. For example, two Titan Bone supports grant a total +40 Attack. This deliberately raises crafted gear's ceiling; the old combat bot uses fixed gear and does not measure an optimized dual-support build.

The forge groups all tiers into labeled family rows. Unowned materials stay visible, insufficient choices are dimmed, and the final craft is blocked when the combined materials are missing. Previews, final item tooltips and saved items retain both supports. Each selected support independently has the existing 50% chance to return one unit on salvage.

`secondary2Id` is additive. Save revision 20 leaves old gear untouched; an absent field means no second support. The revision also lets older clients recognize a newer save before attempting cloud upload.

Validation covers all recipes' pools, primary restrictions, mix-and-match order, repeated-material costs, optional omission, required pendant gems, element/catalyst stacking, save round-trips, revision-19 migration and salvage. 561 tests pass, production build succeeds, and the actual forge successfully crafts a wooden club with metal reinforcement and linen wrapping at desktop and 430px phone width, with no town overflow.
