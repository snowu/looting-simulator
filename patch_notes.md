# Art round four: a clearer Seraph, sharper tells, busier floors

*Save revision 29, unchanged: nothing about a save moves.*

**The Bog Seraph reads from across the room.** It used to be a frog lost in a spatter of red dots. Now a bone halo rings it, six fur wings fan out through the ring, and the frog's face is big: white bulging eyes, red pupils and a toothy grin. Only the top two wings still have eyes. When it attacks, the halo flares white and the grin opens into a maw.

**Delver moles and Spore hunters warn you.** A mole has a proper pink snout with buck teeth and three big claws on each hand, and its mouth opens under the snout when it lunges. A Spore hunter keeps its tongue tucked in until it strikes. Then its gills flare and glowing spores puff out on either side.

**Floors with something on them.** In the Ossuary, about one tile in eight is now a grave lid with a cross cut into it, or an iron drain grate. In the Deep Mines, you'll see spoil with copper in it about as often, and now and then a pick somebody dropped.

Validation: all tests pass, and the shipped PNGs are regenerated from the art code (`npm run art:check` is clean). The Seraph, the Spore hunter and the rat were checked in the 3D lab from three tiles away, and so were the new floors. The floors' first draft vanished into the dark there, so their contrast was raised.

---

# Art round three: rats, doors, the Big Toe

*Save revision 29, unchanged: nothing about a save moves.*

**Giant rats look like rats.** They used to be a wide face with nothing behind it. A rat now crouches with its back humped up behind a low head. It has round pink ears, big red eyes, whiskers, clawed paws and a bare tail curling out to one side. When it bites, its jaws open across the whole snout. The Hoarder carries its sack on that humped back.

**Iron doors look like doors.** They were six grey panels you could mistake for a wall. An iron door now has a frame, riveted straps that end in hinges, a barred spy-hole, a pull ring and some rust. This changes every iron door, including the locked ones and the Ashen Throne's fog gate.

**The Big Toe has a nail and a handle.** The toe was a lilac blob that floated above your fist. Now it is a squat, fat toe with a nail and knuckle creases, and its stump is wrapped in cloth that runs down into your hand. It still takes on the colour of what it's made from.

**Smaller things.** A smashed urn leaves its bottom half standing, with a jagged rim and shards on the floor. In the Sporegrove, the puddled floor is now broken up by patches of bare earth and, here and there, moss with small glowing sprouts.

Validation: all tests pass, and the shipped PNGs are regenerated from the art code (`npm run art:check` is clean). The Big Toe was checked in its troll-hide colouring, and the rat against the old sprite side by side. Not checked in the 3D view this round.

---

# More new art: traps, ghouls, bats, the throne floor, and busier walls

*Save revision 29, unchanged: nothing about a save moves.*

**Traps look like part of the floor.** A spotted trap used to be a flat square marker. A dart trap is now a pressure plate sitting slightly raised from the flagstones, a spike trap is an iron board with a spike tip in each hole, and an alarm is a rune scratched into the floor inside a broken ring. Once a trap goes off, the plate sinks under a snapped dart, the spikes lie broken, and the rune goes dark.

**Ghouls have faces.** The Ghoul, the Slagborn and the Frozen Wretch had a square box for a head. They now have a rounded skull, a heavy brow over the eyes, hollow cheeks and a jaw full of teeth.

**Bats have wings you can see.** Their wings were a single flat colour that blurred together at a distance. They now have finger bones and a lit front edge, on both the cave bat and the Hoarfrost bat.

**The throne room floor is worn.** The black-and-red checkerboard is scorched, cracked and chipped in places, and an ember crack runs across one row.

**Corridors in the Burrows and the Sporegrove repeat less.** Their walls now mix five kinds of wall instead of one. The Burrows add earth with stones half-buried in it and earth with claw marks. The Sporegrove adds moss hanging down with a few glowing spores, and, more rarely, shelf fungus growing out of the rock.

**Smaller things.** The robe icon is a hooded robe, hides are rolled and tied, a pile of bones looks like someone who didn't make it, and dropped gold is a heap of coins.

Validation: all tests pass, and the shipped PNGs are regenerated from the art code (`npm run art:check` is clean). Checked in the 3D view in the dev lab: in the Sporegrove, the new shelf-fungus and moss walls show with their spores lit, and a cave spider's legs stand out against the floor. In the Burrows, the stones wall shows alongside the old root pattern.

---

# New art for the weakest sprites

*Save revision 29, unchanged: nothing about a save moves.*

**The pasture herd looks like cattle now.** Calves, heifers and bulls used to be a box stacked on a box. They now have a proper head with ears and eyes, a pink muzzle, shoulders and legs, and patches that differ on each side. The bull has horns and a nose ring. When it charges, its head drops, its eyes turn red and it snorts steam.

**You can see spiders in the dark.** Cave spiders and ceiling crawlers had black legs on a black floor. They now have a round body, eight eyes, pale fangs, and jointed legs a shade lighter than the body. The Tunnel Stalker's crest and the Emberback's glowing shell sit on the new body.

**Each shrine shows what it does.** All five shrines used to be the same skull pedestal in different colours. Each one now has its own object and a matching symbol carved into the front: a basin of clean water for the font, a seated idol, a brass bowl of coins for the coffer, a bowl overflowing with blood, and an ember brazier behind crossed blades. A used shrine's candles go out and its glow fades.

**Stone and water.** The ceilings of the Ossuary, the Catacombs, the Sporegrove, the Throne and the Burrows, and the Ossuary's flagstones, are now worn, cracked and chipped stone instead of flat slabs. They are just as dark as before. The Catacombs water has ripples instead of a grid of dots.

**Smaller things.** Barrels are round instead of looking like crates. Glowing fungus is a cluster of three caps. Wall sconces are torches in iron brackets. The loot bag has a tied neck. The Hollow Knight (and your Shade) wears a great helm with a visor slit instead of a box, and the club icon looks like a club.

Validation: all tests pass, including the rule that every attack frame changes enough of the sprite to be read as a tell. The shipped PNGs are regenerated from the art code (`npm run art:check` is clean). Checked in the 3D view in the dev lab: the new herd reads clearly by torchlight.

---

# Report a bug from inside the game

*Save revision 29, unchanged: nothing about a save moves.*

**Settings now has a Report a bug button**, in town, on the title screen and mid-delve. It opens a short form: write what happened in any language. If you're signed in to cloud saves, **Send report** files it on GitHub for you, screenshot included, and tells you the issue number. Otherwise the game opens a GitHub issue in a new tab with everything already filled in, and nothing is posted until you press Submit there. Either way the report carries the build you are on, where you are standing and which way you face, what is right in front of you, any door close by, your gear, the day's market events, and your screen and brightness. Your email and your save are never included.

**It takes a screenshot too, wherever you are.** It captures the screen as it was when you opened the report: the dungeon view with the HUD over it, or the town page you were on. The report form itself is left out. Sent directly, it goes with the report. Through the GitHub link, it's copied to your clipboard, so you only need to paste it into the Screenshot box (Ctrl+V). If your browser won't let the game copy an image, which happens on some phones, "Save screenshot" downloads it for you to attach instead. The dungeon stays paused while you type, and typing never moves you.

For whoever fixes it: every delve report carries a repro code. On a dev build, `?repro=<code>` rebuilds the same floor from the same seed, road and seals, then stands you on the reported tile facing the same way. If the reporter's floor came from an older build (runs survive updates), it says so and names the build to check out, instead of quietly dropping you somewhere else.

Validation: all tests pass, including new tests that a repro code rebuilds the reported depth-4 Mine Road floor tile for tile, that a floor from another build is flagged, and that a very long description is trimmed so the link stays under GitHub's length limit while the game details stay whole. In the browser: opened the report mid-delve (the screenshot shows the 3D view with the HUD and without the form, keys typed into the box didn't move the player, details correct) and in town (the screenshot shows the market page, fonts included). A code taken on a depth-3 Emberworks floor rebuilt the same walls and doors and put the player on the same tile.

---

# Faster start

*Save revision 29, unchanged: nothing about a save moves.*

**All the art now arrives in one download.** Before the title screen could appear, the game fetched every sprite, texture and icon as its own file, more than three hundred of them. On a phone that was most of the wait. It now fetches them as a single file of about 110 kB, and because each update gets its own copy of that file, the browser can keep it until the next update.

Nothing looks different. Hand-painted art still overrides the built-in art exactly as before. If the combined file is ever missing, the game falls back to fetching the sprites one by one, so a problem with it can't stop the game starting.

Validation: all 794 tests pass, including new tests that the combined file carries every shipped image byte for byte and that the game falls back to the loose files when the combined file is missing, cut off mid-download, or answered by a server's HTML page. Served the production build locally: one art request instead of 322, and the title screen, the town's icons and the dungeon's textures all come from it. With the combined file removed, the same build fell back to the loose files and still reached the title screen.

---

# Gold reads the same everywhere

*Save revision 29, unchanged: nothing about a save moves.*

**Large sums of gold are grouped everywhere.** The town already wrote 12,345g. The dungeon HUD, the pack header and the floating +gold numbers over a pickup, chest, coffer or shrine prize wrote 12345g. They all write 12,345g now, and so do the appraiser's price hint, the inscribe button and an item's base value in the detailed tooltip.

**No more mismatched roof over a broken wall.** In the Emberworks, the only biome whose roof comes in several patterns, the roof above a cracked wall was always the plain pattern. Once the wall came down, that left one odd panel overhead. It now uses the same patterns as the rest of the roof.

Validation: all 788 tests pass. Checked the HUD in the browser with 12,345 gold carried.

---

# Cloud saves stop asking about a save you never touched

*Save revision 29, unchanged. The fix changes how a save is read on load; it writes nothing new into it.*

**Signing in after an update could put an untouched save in front of you as a conflict.** Say you last synced on your laptop, then played on your phone. After the next update that changed the save format, signing in on the laptop asked you to choose between the laptop's save and the phone's, as if you had played both. You hadn't. The update had reshaped the laptop's save on load, and sync mistook that reshaping for play.

**Now an update's reshaping doesn't count as play.** If the save on this device is exactly what the last sync agreed on, it is still that agreement after the update. When only the other device moved on, its progress is taken without a question, which is what already happened between updates. If both devices really did move on, you are still asked, as before.

Validation: two new tests in `sync.test.ts` load a save one revision older, exactly as the previous build left it on disk. In the first, another device has since written, and sign-in now takes the cloud instead of asking; with the fix turned off, the same test gets the chooser. The second checks that a save that had moved on from the agreement keeps its old agreement. All 782 tests pass.

---

# Smoother frames in the dungeon

*Save revision 29, unchanged: nothing about a save or a floor moves.*

**The dungeon does less work per frame, which matters most on a phone.** Nothing looks or plays differently. The game just stops redoing work it had already done:

- Damage numbers no longer make the browser re-measure the page once per number, every frame of a fight.
- The compass, health, prompt, target and oath lines are only redrawn when they actually change.
- The minimap draws only the patch around you, and only redraws it when you move, explore or a wall comes down.
- Torches, props and pickups at the edge of your sight are kept and hidden rather than rebuilt from scratch on every step.
- Lights and tints are parsed once rather than every frame.
- Monsters looking for a path around each other check where everyone is once per search, not once per tile.
- On lava floors, the drips and bursts only check what you can see when it's time to pick a new spot, every few seconds.

Validation: all 780 tests pass, including the golden floor hashes, and the build is clean. In the browser, in the dev lab's throwaway game: fought and killed skeletons with the minimap and damage numbers on screen, at a steady 16.7 ms per frame. The Silent Picture and the Forbidden Pasture both still dress the floor as before.

---

# The stairs do not always go where stairs go

**Every so often, a floor comes out wrong.** Below the first floor and above the throne, a delve can turn up somewhere it has no business turning up. There is no key, no rumour and no choice about it. You find out by walking down the stairs.

**The Forbidden Pasture.** The world is upside down. The sky is under your boots, turning left looks like turning right, and your own weapon is the only thing still the right way up. Every monster on the floor has been replaced by cattle of about its own size — a calf that has not decided whether you are frightening, heifers, bulls, and one animal in a rosette that has taken first prize several years running in a competition nobody down here remembers holding.

Being upside down is the whole price of the floor. Nothing here hits harder than its depth, the cattle are weak to the tools you would actually butcher one with, and every container on the floor is two tiers better than it has any right to be: every urn is a chest, every chest a vault.

**The Silent Picture.** The colour goes out of the walls and somewhere a piano starts. Everything runs at a quarter again as fast — you, the monsters, and the shafts in the air. Every creature on the floor is wearing a top hat and a monocle, and whatever you are actually swinging is drawn as a lacquered cane. It is still a greatsword. It still hits like one. It just looks like a cane, because on that floor everyone is dressed for the evening.

Nothing here hits harder either. The clock is the content: a flurry at five-quarters speed is a different problem, not a bigger one.

**Each floor keeps a relic nobody else can give you.** The Prize Bull's Horn gathers Attack for every blow you land without one landing on you, to a maximum of six, and any hit you take clears it — including one you blocked. It is a charge, and you stopped. The Impresario's Cane is worth almost nothing as a thing to hit people with and makes everything you do about a tenth sooner: swing, recovery, step, sip. Neither can come out of a chest, and neither can come off the King. Find the floor or do without.

**And a toe.** The Big Toe is a preserved toe roughly the size of your forearm, found anywhere from depth 2 and forged at the bench like anything else. It cleaves wider and staggers harder than anything else you can hold in one hand, and it has the worst recovery of any one-hander, so it wants a corridor and something to shove. Whose toe it is has never been established. The prevailing theory at the forge is that it is better not to ask.

---

# Monsters stop swinging the same way twice

**Every melee monster in the game had exactly one rhythm.** A skeleton leaned in, flashed red and struck, and so did everything below it — deeper floors were the same beat with bigger numbers on it. Learn the beat once and you had learned the dungeon.

**They now choose.** A monster picks an attack at the moment it commits, and the wind-up glows in the colour of the one it chose:

- **A pale flicker** is a jab — faster than a step. You cannot walk out of it; block it or wear it.
- **Pink** is a flurry: three blows on one commitment, each aimed at wherever you have got to. The opening afterwards is the longest in the game.
- **Blue** reaches **two tiles**. The step back that answers everything else walks you into this one.
- **Orange** comes round the sides as well as the front, and catches the sidestep.
- **Violet** holds steady instead of flickering, stalls once about where an ordinary blow would have landed, and then finishes. It is lying to you, and it hits harder than anything but a slam if you spent your guard on the stall.
- **A red flare that grows**, with the monster swelling as it gathers, is an overhead slam worth nearly two blows. Be somewhere else.

**Meeting the first blow still pays.** Open a monster up mid-flurry — a parry will do — and the rest of the flurry never lands.

**This is variety, not a difficulty increase, and it was measured rather than asserted.** The same seeded runs were played by seven different bot playstyles with the new attacks switched off and on. Total damage taken came out flat on every one of them; hits taken went up about a quarter. The same damage, arriving in more and smaller pieces. The one number that moved in a direction worth naming is that the bot parries slightly *worse* now, which is the entire point.

Twenty monsters have a set, chosen by what they are: vermin jab, ghouls and spiders flurry, shieldguards keep their reach, the Cutpurse feints, champions do everything. Archers and casters keep the beat their projectile gives them, and the Ashen King keeps the phases he was written with.

---

# Oaths stack, and there are more of them

*Additive save change (revision 29): a sworn oath, an oath on a delve in progress and a reward waiting in town all carry over.*

**Swear as many oaths as you dare.** Each one's rule applies, and each is kept or broken on its own. Kept oaths pay separately: a **medium** oath one inscription, a **hard** oath **two**. **Keep every oath you swore, having sworn at least two, and you learn one more.** A broken oath only loses its own reward.

**The stone changes with the days.** Each day it offers two hard oaths and three medium ones, from a pool of eight:

- **Blood Price** (hard): go down cursed with Frailty, which fonts won't lift. Bring home 250 gold found.
- **Dry Throat** (hard): your flask starts empty; fonts and dregs still refill it. Reach depth 4.
- **Duelist** (hard): blocking does nothing, only the parry. Kill 20 monsters.
- **Kingsbane** (hard): monsters hit harder. Kill the Ashen King.
- **Unbroken** (medium): your gear wears twice as fast. Reach depth 4 with nothing breaking.
- **Hunter** (medium): monsters see you further. Kill three marked elites.
- **Silence** (medium): monsters see you less, but every noise carries twice as far. Reach depth 3 without springing an alarm ward or shouting Wardcry.
- **Pilgrim** (medium): Hollow Idols curse far more often. Pray at three shrines.

All of them ask you to come home alive. The Descend panel shows the day's five and what keeping them all would pay; the HUD tracks each one. A reward paying several inscriptions is picked together in town and learned at once.

Validation: typecheck, production build, and the full test suite (730 tests), twice. New tests cover the daily offer (two hard, three medium, stable through the day, every oath appearing over a month), swearing several at once (only today's, only in town), migrating single oaths into lists, each oath's rule and objective, the per-oath pay with the keep-them-all bonus, a broken oath losing only its own share, and claiming a reward's picks together. Checked in the dev lab in Chrome: the Descend panel with the day's five oaths, swearing two, and the "keep them all" total. Not played through a real multi-oath delve yet.

---


# Fixed: cloud saves after the update

*No save change.*

The first sign-in on this update could refuse to upload your save and ask you to choose between it and an older cloud copy, even though nothing else had touched the cloud save. The update adds new fields to saves, which changed their fingerprint; the sync mistook that for another device having played. It now trusts the cloud save's own write counter to tell whether anything else wrote to it, so your progress uploads as it always did. A genuine save from another device still asks, as before.

Validation: typecheck, production build, and the full test suite (724 tests). New tests reproduce the bug (a sign-in after a save-format change asked instead of uploading), and check that a real write from another device still asks and that a cloud-only change is still taken silently.

---

# The Ashen Seals, and a panel on the way down

*Additive save change (revision 28): no Seals set. Every existing save loads as it was.*

**Oaths and Seals are chosen as you descend.** The Oath Stone no longer sits above the town tabs all day. Pressing Descend for a new delve opens a *Before you go down* panel with the oaths (and the Seals, once you've earned them), and a Descend button at the bottom. *Not yet* closes it. A kept oath's reward still waits in town until you choose it.

**The Ashen Seals.** Once you've killed the Ashen King, you can set Seals on your delves. Each is a stated complication, stacks with the others, stays set until you break it, and pays a quarter more renown and +15 loot find for the delve:

- **Teeth:** monsters hit 20% harder.
- **Multitudes:** 30% more monsters on every floor.
- **Champions:** elites far more often, even on the first floor.
- **The Dry Well:** the flask starts two charges short.
- **The Lightless:** your light reaches less far.

Killing the King under more Seals than ever before sets a record. If you've already killed him, the Seals are open to you now.

Validation: typecheck, production build, and the full test suite (721 tests), twice. New tests cover unlocking (only after a King kill, only in town, and Seals set before then doing nothing), each Seal's effect, the extra loot find and renown, the record, and the save migration. Checked in the dev lab in Chrome: the Descend panel with the Oath Stone and the Seals, swearing Hunter inside it without it closing, and its Descend starting the delve under the oath. The balance harness plays exactly as before, since its bot never kills the King. Not played through a real sealed delve yet.

---

# Lieutenants

*No save change. Floors you've already been to are untouched.*

From depth 2, a floor sometimes has a **lieutenant**, a named monster that changes the whole floor while it lives. A clue on arrival tells you something is wrong; whether to hunt it down is up to you.

- **The Goblin Quartermaster** carries a red war banner. While it stands, every goblin on its floor hits harder and never runs. Kill it and they break and flee, and its strongbox is yours.
- **The Hoarder** is a bloated rat with a sack of coin on its back. It wanders the floor carrying off any loot left lying around, and it keeps away from you. Kill it and everything it gathered spills back out, with its own hoard on top.

Validation: typecheck, production build, and the full test suite (712 tests), twice. New tests cover placement (from depth 2, at most one a floor, far from the stairs, a Quartermaster only with goblins to command), the Quartermaster's rally while it stands and the rout and strongbox when it falls, and the Hoarder carrying off a pile and giving it back, never taking a key, and keeping away from you. The first test run caught the Hoarder stopping one step short of every pile; that's fixed. Checked in the dev lab in Chrome: both sprites in the dungeon, and "The Hoarder" on the target bar. The balance harness moved within 9 points either way. Not played through a real delve yet.

---

# Your Shade keeps what you lost

*Additive save change (revision 27): no grave waiting. Every existing save loads as it was.*

Dying no longer throws your pack away. What you lose (the backpack and the coin you carried, beyond what a Soul Pouch keeps) waits on the depth where you fell, held by **your Shade**: a pale, cold version of you that fights with the kind of weapon you died holding. Reach it on a later delve and kill it, and everything drops back at your feet.

There's only ever one grave. Die again before you get back to it, and the old pack is gone for good; the new one takes its place. Coming home without reclaiming it leaves it waiting. The town news and the results screen tell you where it is. On Hardcore a death ends the save, so there's no Shade to go back for.

Validation: typecheck, production build, and the full test suite (707 tests), twice. New tests cover the grave (dug on the depth you fell with what you lost, replaced by a second death, left alone when you come home, never on Hardcore), the save migration, the Shade (on the grave's depth only, far from the stair, once per delve, on depth 1 from the start, striking with your weapon's damage type), and killing it giving the whole pack back. Checked in the dev lab in Chrome: the Shade reads as a pale, cold figure, and the target bar says "Your Shade". The balance harness plays exactly as before, since its bot starts every delve without a grave. While measuring, I found that the harness had stopped being reproducible when the route fork arrived (the day's roads were seeded from a random save id); that's fixed.

---

# Every floor its own law

*No save change.*

Three biomes now each have a rule of their own. The first time you arrive on one, it tells you.

- **The Ossuary: the dead do not stay down.** A skeleton you put down stirs a few seconds later and stands back up at half its health. Shatter the bones with a blunt killing blow, or sanctify them with holy damage, and they stay down. A corpse only rises once.
- **The Deep Mines: braced walls come down hard.** Bring down a cracked wall and its rotten timbers fall on whatever stands beside it: a crushing blow, and they reel. The noise of the blows draws monsters to you, so let them come, then bring it down.
- **The Vermin Burrows: noise carries.** Every sound reaches further here: a cracked wall, Wardcry, an alarm ward, a struck chest. A broken root cache is a lure: whatever hears it goes to the cache, not to you.

The Mine Road's description at the fork now mentions its walls.

Validation: typecheck, production build, and the full test suite (698 tests), twice. New tests cover the Ossuary (remains stirring and standing once at half health, shattered, sanctified, living and non-Ossuary corpses staying down, long-dead corpses not all rising at once), a Mines collapse crushing and staggering what stands beside the wall and only in the Mines, the Burrows carrying a wall's noise further, and a root cache drawing monsters to itself. One existing test was pinned to a floor that isn't the Burrows, since its whole point is the normal noise range. Checked in the dev lab in Chrome: a skeleton's bones stirring with the log line, and it standing back up at 15 of 30 health. The balance harness moved within noise against the previous build, with no rise in deaths on depths 1–2. Not played through a real delve yet.

---

# The stair splits

*No save change. A delve already under way keeps going the old way; the fork appears from your next delve.*

The first time you go down from depth 2, the stair splits into **two roads**. The one you take decides what depths 3 and 4 are, and the other is sealed for the rest of the delve.

- **The Mine Road** (Deep Mines): shieldbearers and the Barrow Champion. Pays in metal.
- **The Frozen Road** (Frost Vault): frost wisps and icebound guards; bring fire. Pays in frost shards and moonstone.
- **The Ember Road** (Emberworks): flame wraiths and molten floors; bring frost. Pays in flame shards and sunstone.
- **The Spore Road** (Sporegrove): spore hunters and the Bog Seraph. Pays in leather and crystal.

Which two roads are open changes each day, and what's happening in Bleakmere tilts it: an Iron Shortage opens the mines, a Harsh Winter the frozen road, a dragon sighting the ember one. The town news names the day's roads, so you can pack for the one you mean to take.

Validation: typecheck, production build, and the full test suite (692 tests), twice. New tests cover the day's roads (always two different ones, the same all day, leaning towards the road a market event favours, handed to a new delve), the fork stopping you at the stair instead of descending, the road setting depths 3 and 4 and nothing else, asking only once, delves from before the fork, and generation ignoring a road where its biome can't be. Checked in the dev lab in Chrome at 500px wide: the town news naming the roads, the fork panel, taking the Spore Road with the log line, and arriving at depth 3 in the Sporegrove. The headless bot takes the first road; its death rates moved a few points either way, as expected with different biomes on depths 3 and 4. Not played through a real delve yet.

---

# Oaths and inscriptions

*Additive save change (revisions 25 and 26): nothing learned, nothing sworn. Every existing save loads as it was.*

**The Oath Stone.** When you press Descend for a new delve, a panel asks whether to swear an oath for it, or none. Keep it and come home alive, and it pays an inscription you haven't learned yet. Break it and you lose only the reward.

- **Blood Price:** you go down cursed with Frailty, and no font will wash it off. Come home with 250 gold found in the dungeon.
- **Unbroken:** everything you wear wears twice as fast. Reach depth 4 with nothing breaking, then come home.
- **Hunter:** monsters see you from further away, and a marked elite, one of the toughest on its floor, waits on each of depths 2, 3 and 4. Kill all three, then come home.

The HUD shows how your oath stands.

**Inscriptions.** A kept oath lets you choose one of three to learn. At the forge, the new **Inscribe** bench cuts a learned inscription into a piece of your gear for 150 gold, one per item. Inscribing again replaces it, and relics can't take one.

- **Riposte** (weapon): after a parry, your next swing is free and hits harder.
- **Execution** (weapon): finishing a reeling monster feeds your sigil twice over.
- **Kindling** (weapon): your fire leaps from a badly wounded monster to one beside it.
- **Bulwark** (shield): taking a heavy blow on the shield charges your next strike.
- **Retrieval** (thrown belt): shafts you call back cut what they pass through.
- **Last Flask** (helm, body or gloves): with your flask empty, food and life leech heal more.

Validation: typecheck, production build, and the full test suite (684 tests), twice. New tests cover learning and inscribing (slot fit, no relics, cost, replacing, identified and worn gear only), one behaviour test per inscription, each oath's rule and objective (Frailty surviving a font, double wear and a break ending Unbroken, keeping it at depth 4, Hunter's sight and its three marks placed once each on tough monsters and counted), the reward drawing only unlearned inscriptions or paying renown, no new oath while a reward waits, and both save migrations. Checked in the dev lab in Chrome: the Inscribe bench, inscribing Riposte onto a sword, the Oath Stone and the reward picker at 500px wide with no overflow, learning from a reward, swearing Hunter, the HUD oath line, and marked elites on depths 2–4. Not played through a real delve with an oath to the end, and not checked on a real phone.

---

# The Gravecaller

*No save change. Floors you've already generated are untouched; Gravecallers appear on floors generated from now on.*

Something hooded walks the Ossuary and the Catacombs from depth 2. **The Gravecaller** barely fights. It keeps its distance and chants over the undead you've killed, and after two seconds of green light the corpse stands back up at half its health. It does this up to three times in a life.

You have three answers:
- **Break the chant.** Hit it with anything, even a thrown knife or an arrow sent back at its friends.
- **Shatter the bones.** Kill the undead with a blunt weapon, or hit hard enough to crush them, and nothing can call them back.
- **Sanctify them.** A killing blow with any holy damage, or from Threshold's consecrated ground, and they stay down.

The log tells you when remains are shattered or sanctified while a Gravecaller is near. A corpse it raises gives nothing when it falls again, so there's no farming it.

Validation: typecheck, production build, and the full test suite (656 tests), twice. New tests cover placement (Ossuary and Catacombs only, never depth 1), the chant raising a skeleton at half health and marked risen, a blow breaking the chant, goblins staying dead, the three-raise limit, shattered and sanctified remains staying down, how the killing blow marks remains, and a raised corpse paying nothing a second time. The Hard golden test still matches the hash pinned before elites once the Gravecaller is removed. The first run of that test caught the Gravecaller shifting where loose loot and keys land, which is fixed. Checked in the dev lab in Chrome on a Catacombs floor: the Gravecaller in the dark with its green-eyed staff, the corpse glowing and rising during the chant, and the skeleton standing at 25 of 50 health with the player unharmed. Balance harness, 24 runs per profile: death rates rose across the geared profiles against the previous build (the careful iron kit 50% → 67%). The extra deaths are spread over depths 2–4 among many killers, never the Gravecaller itself, so it is likely a mix of attrition from extra fights and noise. Worth watching in play. Not played through a real delve yet, and not checked on a phone.

---

# Walls that give

*No save change. Floors you've already generated have no cracked walls; they appear on floors generated from now on.*

Some walls are **cracked**, and three blows from anything will bring one down. It costs you: every blow wears your weapon like a hit, and the noise carries through the walls to anything within six tiles.

- **A plain crack** is a shortcut: a thin wall between two passages that are a long way apart on foot.
- **A thin crack with a dull glint in it** is an ore seam. Break it for a few pieces of metal ore for the depth. They're commonest in the Vermin Burrows and the Deep Mines.
- **A faint outline in the mortar**, where a niche was bricked up, is a cache someone sealed. It's easy to miss. Break it for a hoard like a chest's, and never less than a handful of coin.

A broken wall stays broken for the rest of the delve, and the one-button tap swings at a cracked wall in front of you.

Validation: typecheck, production build, and the full test suite (648 tests). New tests cover placement (on walls, clear of doors and stairs, shortcuts saving at least 12 steps, none on the throne floor), a texture for every wall, three blows with wear each time and the tile passable only after the third, the noise reaching six tiles and no further, ore and cache loot, and the tap swinging at a crack. The first test run caught caches that could open onto nothing, so they now roll like chests with a minimum of coin. Checked in the dev lab in Chrome: an ore seam and a sealed cache on Vermin Burrows walls, and three blows bringing the seam down into a finished alcove with copper ore inside. The balance harness is unchanged, since the bot never breaks walls. Not played through a real delve yet, and not checked on a phone.

---

# Look up. Watch the floor.

*No save change. Floors you have already generated are untouched; ambushers appear on floors generated from now on.*

Some monsters are no longer standing where you can see them.

- **Ceiling Crawlers** cling over corridors from depth 2, one or two a floor. You spot them the way you spot a trap, by looking down the corridor ahead: "Something clings to the ceiling ahead", and a dark shape with red eyes high in the gloom. Walk close and it drops, after a beat of falling dust and skittering. Spot it first and you can hit it off the ceiling, and it lands stunned and open to double damage.
- **Buried Tunnel Stalkers** lie under Vermin Burrows and Deep Mines floors as mounds of turned earth. Come close and the ground heaves, or strike the mound first to drag it out stunned.
- **The Delver Mole dives.** Badly hurt, it goes under instead of running, then comes up beside you, behind you if it can reach. You can watch the mound travel and turn to meet it.

An ambusher **never hits you as it arrives**. It lands or surfaces next to you and needs half a second before it can start a swing, with the usual red flash. What an ambush costs you is position, not health.

Validation: typecheck, production build, and the full test suite (642 tests). New tests cover where droppers and buried stalkers are placed (corridors only, depths 2–5, never near the arrival point or on the throne floor, earth biomes only), that lurkers are invisible to targeting, the threat check and the map, spotting, the drop timing with no blow during the landing beat, dropping onto you putting it beside you, striking a spotted dropper or a mound for the stun, a buried stalker rising, and the mole diving once and surfacing behind you. The Hard golden test still matches the hash pinned before elites once ambushers are removed. Checked in the dev lab in Chrome: a spotted crawler as red eyes on the ceiling, the mound in dark Burrows and lit crypt corridors (its colours were brightened after the first look, because it vanished into the Burrows' dirt floor), the crawler mid-fall, and its landing with health unchanged. Balance harness, 24 runs per profile: the two careful profiles die more often across elites and ambushers together (iron 29% → 50%, moonsilver 33% → 42% against master), and the rest are within noise. The bot doesn't look up or read mounds. Not played through a real delve yet, and not checked on a phone.

---

# Elites, and a Cutpurse that earns the name

*No save change. Floors you have already generated keep their monsters exactly as they were; elites appear on floors generated from now on.*

From depth 3 down, an ordinary monster is sometimes an **elite**: the same creature with one trait on top. It's 5% of spawns at depth 3, climbing to 11% at depth 6, about one or two a floor. Elites are never hidden. Each one glows and slowly pulses in its trait's colour, stands a little taller, and shows the trait in its name on the target bar.

- **Hasted** (yellow): winds up, recovers and walks much faster. The timing you learned is wrong.
- **Ironhide** (steel): much harder armour and a deeper health bar, but slow on its feet.
- **Frenzied** (red): below half health it swings and moves much faster. Finish it, or step back.
- **Vengeful** (violet): a moment after it dies, the corpse bursts, hitting its own tile and the four beside it. Step away, or face it and block or parry. Monsters caught in the blast get hurt too.
- **Thieving** (gold): steals from your pack, like the Cutpurse below.

Every elite has half again the health, and pays for it: two and a half times the gold, three times the chance of gear, and more materials.

The **Goblin Cutpurse** now steals. If its blow gets through your guard, it takes one thing from your backpack (a piece of gear, or half a stack) and runs, glowing gold so you can chase it in the dark. The target bar says what it's carrying. It runs in a panic, so it will bolt into a dead end, and now and then it fumbles the loot. A few coins spill from its purse as it goes. Once it loses you it runs a little further, then goes to ground and creeps. Kill it and you get your things back. Lose sight of it for 25 seconds and it's gone for good. Your equipped gear is never at risk, and a parry or a block stops the theft. Cutpurses are also a third as common as they were, about one a floor on the first two depths, so a theft is an event rather than the whole floor.

Validation: typecheck, production build, and the full test suite (631 tests), three times. New tests cover the elite chance by depth, the King and his guards never being promoted, each trait's effect, elite loot, theft (half a stack, blocked and parried blows steal nothing, the drop on death, the escape), and the Vengeful burst hitting you or missing you after you step away. The Hard golden test demotes every elite and matches the hash pinned before elites existed, so no wall, chest or other monster moved. The balance harness, 24 runs per profile against master: most profiles are within noise, and the careful iron-kit profile died more often (29% → 46%). Checked in the dev lab in Chrome (the spawn console now has an elite picker): the Hasted and Vengeful glows, the violet target-bar name, the Vengeful corpse flaring, then bursting on the player and on a Hasted Skeleton that walked into the blast, and a Cutpurse stealing a Star-Iron Long Sword, running lit gold with "carrying your Star-Iron Long Sword" on its target bar, and dropping it on death. Not played through a real delve yet, and not checked on a phone.

---

# The flask takes draughts

*Additive save change (revision 24). A flask holding Jade, Crystal, Moonstone, Emerald or Wardstone is emptied and the gem goes back to the stash (or its value in gold if the stash is full). Every other infusion carries over and now does its new thing.*

Flask infusions used to add a small stat for six seconds after each sip. You couldn't feel it, and two of them were broken outright: wood's Speed never reached swing timing, and Emerald's loot find went to a stat the loot rolls never read. Each family now changes what the sip itself does, scaled by the material's tier:

- **Thick** (hide): the sip heals 4–12 points more.
- **Breath** (cloth): refills stamina; costs 10 points of healing at tier 1, down to 2 at tier 5.
- **Quick** (wood): the sip takes 0.40s down to 0.20s instead of 0.5s, so your guard is down for less.
- **Iron** (metal): the next blow within 12s is reduced by up to 10–35% of your max health.
- **Marrow** (bone): the next strike you land within 6s deals x1.3 to x2 and staggers anything but the King.
- **Kindled** (fire, frost, holy and shadow gems): your weapon carries the gem's element, or leech, for 8s at twice the strength the forge would give it.
- **Fight Milk** is unchanged: always on from the moment you enter.

Every draught except Thick costs healing, as before. The forge bench now lists each material with its draught name and its exact effect, and shows the current infusion at the top. In a delve the flask icon takes the draught's colour, its tooltip says what it does, each sip names its effect in the log, and a bar across the top of the flask drains while an Iron, Marrow or Kindled effect is waiting to be used.

Validation: typecheck, production build, full test suite, and new tests for the Quick sip time, Thick and costed heals, the Iron ward absorbing one blow, Marrow doubling and staggering one strike, Kindled leech expiring after 8s without touching Attack, and the gem refund migration.

---

# Hardcore: Hard with one life

*Additive save change (revision 23). Existing saves migrate alive and keep their difficulty; nothing about Normal or Hard changes.*

A third difficulty on the new-save card: **Hardcore**. Every number is Hard's: monster health, damage and armour, traps, drops, gold, healing, stamina and the loot curve. It is built from Hard's own table, so the two can't drift apart. The only difference is that you get one life. Die once and the hero is dead for good. The results screen says **Fallen**, the way out leads back to the title, and the save stays on its slot as a headstone ("Fallen to Skeleton on day 3"). A headstone can be renamed or deleted, never continued.

Hardcore is chosen when a save begins and never changes. The town settings show it locked, and other saves can't switch onto it. The death is final even if the page closes during the death fade: the save already records the killing blow, and it's settled as a death the next time the slot is touched. Cloud saves respect it too: a hero who fell on one device is never offered back alive from another, so the grave always wins over a living copy.

Validation: typecheck, production build, the full test suite (a load-sensitive timeout in an existing 3-second test needed `--maxWorkers=4` on a busy machine), and new tests showing Hardcore and Hard match: identical floors, spawns, loot and player stats across seeds and depths, the same skeleton fight tick for tick, plus the one-life rules. Checked in a headless dev build: the new-save card and its warning, the locked settings, a death through the Fallen screen to the headstone, a reload during the death fade (still a headstone), a forced delve on a fallen save (refused), Hard's death still going to town, deleting a headstone, and phone width. Cloud sync rules are covered by the typecheck and a code read only; there is no sync test harness.

---

# Mimics bite like they mean it

*No save change. The new grab timer on a mimic is optional; mimics and chests on floors that already exist behave by the new rules.*

Open a mimic and it grabs you: the lid snaps shut and you are held for about a second, unable to move, guard, drink or parry. Then it bites once for two and a half times its normal blow before armour. Your guard and parry can't stop it; only armour softens it, and it can kill. Then it spits you out and the fight starts.

The way out is the old Dark Souls habit: **hit the chest first.** A mimic only wakes: it rises at full health and fights, but it cannot grab you. Testing is not free, though. An honest chest turns your blow aside and stays shut, but every blow breaks something inside, the most precious first: a gem, a chalice, a scroll, a blueprint. When those are gone it takes materials, then dents the gear, then spills the coin. Blunt and two-handed weapons often break two things at once. One blow costs about a quarter of a chest's worth. And the clang carries: anything within seven tiles comes to see what made it. The pale points in the lid seam are still there for sharp eyes, and a chest you trust and just open keeps everything. Once a chest is empty, a single blow smashes it to splinters and clears the way. On touch screens, tap the action button to open a chest and hold it to strike instead.

Validation: typecheck, full test suite with mimic tests for the grab (ignores guard and parry grace), the struck mimic (full health, no grab), the glance, fragile loot smashing and the clang's reach, plus live dev-build checks of each.

---

# Reorder the delve quick bar by dragging

*Working changes. Save revision 21 is additive; the new quick-bar order defaults to backpack order, so existing delves look exactly as before.*

The four usable-item slots in a delve can now be rearranged: drag a slot onto another with the mouse, or press and drag with a finger on touch screens. A plain tap or click still uses the item — only a drag past a small threshold reorders. New consumable types join at the end of the bar, and anything you no longer carry is skipped, so the order never points at something gone. It persists in the save for the rest of the run.

Validation: typecheck, full test suite (including the revision-20→21 migration expectation update), production build to follow.

---

# Mix your secondary crafting materials

*Working changes after Patch 49. Save revision 20 is additive; existing crafted gear keeps its original materials.*

Every equipment recipe now has two secondary material slots. The first keeps its required quantity; the second is optional and uses one extra unit. Both accept **metal, wood, hide, cloth and bone**, including every tier. Pick different families or double up on one material when you have enough: both slots contribute their family and elemental bonuses.

The main material remains specific to the item. A club still needs wood or bone for its body; a sword still needs metal for its blade. A wooden club can have metal reinforcement and a linen wrap. Rings and pendants gain a one-unit required support slot too, and the pendant still requires its gem separately.

The forge now groups materials into labeled family rows and shows their full tier ladders, including cloth. The extra slot has a None choice, and the picker accounts for material already selected in other slots. Both supports appear in the finished item's tooltip, survive saving, and have their own salvage chance. The narrow-screen forge also fits within the phone viewport.

Validation: 561 tests, production build, desktop/mobile browser checks, and a real UI craft of a wooden club with Iron and Linen supports.

---

# Clear material ladders, consistent crafting roles

*Patch 49. Existing items and recipes remain, but material bonuses update on existing gear too.*

Every structural family now follows **white → green → blue → purple → gold** from tier 1 to 5, and the market lists them in that order. Metal gives Defense, wood Speed, hide Health, cloth Stamina, and bone Attack. Higher tiers strengthen the same bonus; the market headings and tooltips explain each role.

Late tiers make larger jumps: bone grants +1/3/6/12/20 Attack, metal +1/2/4/7/12 Defense, wood +1/2/4/7/10 Speed, hide +3/6/12/24/40 Health, and cloth +3/6/10/18/30 Stamina. Titan Bone now adds +20 Attack instead of +5; legendary materials should feel worth hunting. Primary and secondary slots use the same family bonus once per slot. Special materials also retain their elemental bonuses: Silver +3 Holy, Moonsilver +6 Frost, Star Iron +10 Shadow, Dragon Scale +10 Fire, and Shadow Silk +7 Shadow. These stack with catalyst and affix effects.

Basic supplies remain accessible despite corrected colors: structural tier-1/2/3 merchant targets are 40/40/14, and structural drop weights follow tier. Depth gates, slow late shipments, recipe quantities, catalyst effects and mastery costs stay as before.

See [the balance review](docs/material-identities-review.md) for the latest two merged PRs, catalyst supply, recipe/mastery costs, before/after combat results and the remaining endgame balance limitations.

---

# Learn from broken blades, earn the better steel

*Unreleased, on `fix/hard-progression-gates`. No save break: existing recipes, gear, mastery and renown carry over (save revision 19 adds per-recipe salvage counts, nothing resets).*

Crafting mastery used to hinge on rare duplicate blueprints while wood, hide, cloth and bone ladders dead-ended before the deep tiers. This spreads single-copy plans through the dungeon, lets salvaging an unidentified weapon teach its recipe, completes the material ladders, and paces late merchant stock by game day and depth. On top of that, Hard closes two early power shortcuts — depth-1 gems pulling from the whole catalyst catalog, and guaranteed special-chest rarity making Uncommon the whole early game — and smooths the reward curve without slowing everything down.

## Blueprints, one at a time

- Every blueprint drop is a **single plan**; no bundles. Secret chests always hold one.
- Depth 1 → 6 chances: urns **2.5% → 5%**, chests **14% → 24%**, vaults **38% → 53%**, enemy bonus rolls **1.2% → 3.2%**. The boss keeps its guaranteed plan. Across 1,200 generated Hard floors, full clears average **1.98 / 2.31 / 2.62 / 2.94 / 3.44 / 4.29** plans on depths 1–6 — yields, not promised take-home loot.
- Plans never arrive before their base's minimum depth. Early plans retire three floors after debut (daggers: depths 1–3); depth-4+ plans stay in the endgame pool. Merchant blueprint wares follow the same pool using best depth.
- Relevant weapon plans get easier to find deeper down (softer gear-ladder scarcity, weapon weighting 1× → 2.5×). Unknown plans keep their preference; fully capped pools still yield sellable spares.

## Salvage teaches the recipe

Found unidentified melee and thrown weapons teach their matching recipe as well as giving materials: **4** salvages to unlock, then **5 / 6 / 7 / 8** for ranks 2–5. The forge shows progress and reports gains; blueprint upgrades keep earned salvage progress. Crafted, identified and armour pieces teach nothing; rank 5 stays capped. Blueprint costs stay 1/2/3/4/5.

## Materials and a slow merchant

Nine additions complete tiers 1–5 for every structural category: Deep Yew, Starwood, Troll Hide, Wool, Astral Silk, Dense Bone, Fossil Bone, Wyrm Bone and Titan Bone. Recipe quantities, material gates, mastery bonuses and catalyst power are unchanged.

Late structural merchant stock is deliberately small, including on Hard (both day *and* depth gates must be met; only a finished delve past depth 1 advances the day):

| Tier | Depth needed | First shipment | Refill | Shelf cap |
| --- | ---: | ---: | --- | --- |
| 4 | 5 | Day 6 | 1 every 3 days | 1, then 2 at day 12 |
| 5 | 6 | Day 18 | 1 every 6 days | 1, then 2 at day 30 |

Buying every Star Iron shipment on days 18/24/30 supplies three units over that span: exploration remains the primary source.

## Hard: catalysts stay deep, rarity ramps gradually

- Empty gem pools now yield **no gem** instead of widening to the entire catalog — no more tier-4 catalysts from a depth-1 chest. Found gear records its source floor so a lucky +0–2 item-level roll cannot unlock next-floor salvage gems.
- Authored monster catalysts obey the same gates in both difficulties: premature Frost Shards, Sunstones, Wardstones, Flame Shards and Shadow Essence become **Crystal Shards** at depths 2+, deferred entirely at depth 1. Early iron, leather and spider-silk drops remain as documented exceptions.
- Hard vaults/secrets still guarantee gear, but the first piece now rolls a minimum-rarity *chance* that grows with depth instead of a universal floor (second piece uses natural rarity; Normal keeps its previous guarantees; boss guarantees unchanged):

| Depth | Uncommon-or-better | of which Rare |
| --- | ---: | ---: |
| 1 | 20% | 0% |
| 2 | 35% | 0% |
| 3 | 50% | 15% |
| 4 | 65% | 30% |
| 5 | 80% | 45% |
| 6 | 95% | 60% |

At zero Find this takes depth-1/2 Uncommon from 82–83% to **26.5% / 40.0%**, and replaces the depth-3→4 Rare cliff (7.9% → 59.8%) with **14.0% → 21.0% → 26.8%** across depths 3–5. No premature gems remain in the 2,400-floor sample.
- **Appraiser II no longer costs you mastery**: auto-identified Uncommon/Rare weapons keep salvage eligibility (including after saving); manually identified weapons still spend it. Previously identified weapons in old saves lack provenance and cannot be retroactively classified.

Fewer enchanted early drops also means fewer salvage-eligible weapons (depth 1: 0.58 → 0.23 per clear). That is documented rather than offset with a mastery buff — multi-day playtesting is still needed to judge time to rank 5.

Validation: `npm test` passes **545/545** (48 files), `npm run build` passes, 2,400-floor progression benchmark passes, `git diff --check` clean. Historical golden fixtures retained; a separate progression hash pins the intentional distribution change.

---

# Weapon overhaul, continued: retrieval, hands, and redrawn gear

*Unreleased, on `feat/weapon-overhaul`, on top of the notes below. Still no save break: `SAVE_VERSION` and `SAVE_REVISION` do not move.*

## Retrieval is a hold, and it reaches the whole run

Calling shafts back used to be a tap that only swept the floor you stood on. It is now a channel: **hold R** (or hold Call on touch) and release to stop. Shafts already in the air still land when you let go — stopping a call never loses anything.

- The call reaches **every floor of the run**, not just this one. A shaft further than nine tiles away, or on another floor entirely, returns from a couple of tiles ahead of you instead of flying across the dungeon, so the animation stays honest and distant stock is never stranded.
- The raised receiving hand **holds its pose until the last shaft lands**, with a small beckoning pulse per return; the shield stays lowered while you call.
- The belt counters count floor stock **and** shafts already flying home, so the number beside the belt is the number you will get.
- Throws also recover much faster — knives 0.34s → 0.10s, axes 0.46s → 0.14s, javelins 0.58s → 0.18s — so hurling one no longer locks you out of the next action.

## Hands, shields, and icons redrawn

Every held sprite is redrawn at twice the density (48px wide canvases; the renderer normalises by canvas height, so blade length now survives it) with one shared hand language: broad knuckles, short brown creases, diagonal brass cuff, light from the upper left.

- **Dagger** and **Short Sword** get their own viewmodels instead of sharing the Long Sword's; blade length is the difference between them.
- Each shield gets its own model — round buckler, pointed kite, broad tower — mapped per base, and the renderer draws the equipped one rather than a single `vm_shield`.
- The retrieval hand is its own open receiving hand (`vm_hand`), and the casting stone is a round ring-carved sigil whose lit frame burns the carving.
- Held weapons are now **recoloured by the equipped material** in the renderer, skin and brass untouched; the art-sheet Viewmodels group stages tall models at native pixels and pins the deciding crafting material per base, with `npm run art:sheet -- viewmodels --material <id>` to match.
- Weapon icons follow one convention — thin silhouette on a diagonal, head top-right — and each sigil stone takes its own tint and shape, so the five stop being the same pebble with a scratch.
- `npm run art:sync -- --ids vm_blade,vm_axe` regenerates just the named art without touching hand-painted PNGs.

## Thrown weapons are no longer held

A fistful of javelins held up through the wind-up put a second pair of hands in the frame beside the ones already holding your weapon, so the three thrown viewmodels are deleted: a throw animates nothing, and the shaft in flight plus the shaft on the floor is the whole of a belt's art. The art-sheet Props group now lists both explicitly — **Thrown · in flight** and **Thrown · on the ground**, derived from the belt data — and the orphaned handoff PNGs are gone.

Validation: `npm test` passes **465/465**, `tsc --noEmit` clean.

---

# Weapon overhaul: two hands, thrown steel, and sigils

*Unreleased, on `feat/weapon-overhaul`. Nothing here invalidates a save: `SAVE_VERSION` does not move, every new field is additive, and an existing character keeps its gear, its stash and its renown.*

Six new weapon bases and a spell system, aimed at the one complaint the roster had — that every weapon was a stick of a different length, and the offhand was a shield in all cases because there was never a reason for it not to be.

## Two-handed weapons

**Halberd**, **Great Maul** and **Greatsword**. Wearing one empties your offhand: the shield goes back to the pack you drew the weapon from, and you are refused the swap outright if there is nowhere to put it. Nothing eats your gear.

That is a real loss — a silver Tower Shield is +12 Defense and 82% block, and a two-hander blocks 20% — so each buys something a shield cannot:

- **A cleave**, at 25% of the blow, into every tile touching the thing you hit. Beside it, diagonally, and *behind* it. A guard only ever covers the tile you face; this covers the rank behind that tile, and with a halberd's reach it lands three tiles deep into a corridor. It never spills back onto your own tile, and a cleaved blow is glancing: one guard chip, and it will not bash a shield open.
- **Stagger**, adding to a struck enemy's attack cooldown — half a second on the halberd. It buys you time. It does not cancel a wind-up; cancelling wind-ups is the parry's job and stays the parry's job.
- **Two guard chips** a swing, so a shieldbearer opens in two blows instead of three.

**They hit harder than anything one-handed**, and the cost is weight. A Great Maul lands the biggest blow in the game, about twice a Long Sword's; the Greatsword has the highest sustained damage of any weapon.

What you pay is Speed, three times over: the swing slows, every step slows, and past −12 total speed you are encumbered and your steps slow again. A Great Maul alone sits exactly on that line — put it over Plate Armour and you will feel every corridor. They drink the bar too, 27 to 31 stamina a swing, which is three swings from full on the maul.

One place they are not the answer: armour compresses flat damage, and the Ashen King has the most of it. Against him a Long Sword lands 44.8 and a Great Maul lands 53.9 — most of the maul's advantage is eaten, and the faster weapon wins the race. Against the Hollow Knight and the Barrow Champion, where blunt bites, the maul kills in 9.7s against a War Axe's 14.7s.

**Parrying is completely unchanged with a two-hander.** It never needed a shield and still does not.

## Thrown weapons

**Throwing Knives**, **Throwing Axes** and **Javelins** — and they are not weapons. A belt of shafts gets a slot of its own, worn alongside whatever is in your hands, and unlike a shield a two-hander does not displace it. A greatsword and a bandolier of javelins is a good loadout.

The belt gives you no stats at all: it is ammunition, not gear. And a throw is scored on the shafts alone — your sword never makes your javelins hit harder, and good javelins never make your sword hit harder. Your Crit, leech and elemental damage still ride along, because those are things about you.

**You throw with [T].** Never with the attack button, which used to throw by itself whenever nothing was adjacent — so the weapon decided for you, you could not choose to close and stab, and stepping back from a fight spent a javelin you were saving.

The stock is finite, filled once when you first carry a belt into a delve, and nothing refills it. Spent shafts land where they stop — in the thing you hit, not in front of it — and persist across a trip upstairs and back. Walk over one to collect it, or hold **R** to call them back from anywhere in the run: **one every three quarters of a second**, paying a point of belt wear for each as it arrives. Releasing stops the call, and anything already airborne still lands.

So a full belt of knives is five seconds of standing still, which a fight will not give you. The decision to throw the last one is a real decision.

A javelin thrown is about what a Long Sword swung is. But a belt is three of them, and then it is nothing until you have walked over to get them back.

## Sigils

Five of them, and you carry exactly one, chosen in Bleakmere before you go down. You can never hold both the escape and the control, so a fight is played with the tool you guessed at upstairs.

There is no mana bar — a mana bar is topped up in town and free in the moment it matters. Each sigil has its own long cooldown and is cast out of your stamina, with **G** or **C**.

- **Wardcry** — shoves what you face back a tile and leaves it reeling, or crushes it against the wall behind. It shouts: everything within 8 tiles learns where you are, through walls.
- **Snuff** — everything within 12 tiles loses your trail, and you are in the dark for eight seconds.
- **Sounding** — reads six tiles of stone: the map, the traps in it, and the bearing of anything hidden.
- **Threshold** — consecrates the tile you stand on for eight seconds. The parry window doubles. Step off it and it is gone.
- **Temper** — mends the most worn thing you are wearing by a quarter.

Wardcry grants no vulnerability window. A parry pays a second of doubled damage; the push pays nothing, which is what keeps it from replacing the guard.

**Kills shorten the cooldown**, so a sigil is a reward for fighting rather than a timer you wait out — and it is capped at a fifth of the base cooldown per kill, so no build resets one in fewer than five. The cooldown also runs at half speed while anything alerted is within 8 tiles, so it recovers between fights rather than during them. **Warden's Vigil** on the Warden's board and the new **Spell Focus** stat both feed the same refund; Spell Focus rolls as *Graven* and *of the Vigil* on head, rings and amulets, and the **Wardstone** forges it in.

Sigil stones drop from the Ashen King (always, while any are undiscovered), from vault and secret chests (22%), and rarely from ordinary chests. You can never be handed one you already have. A stone is **inscribed at the forge**, permanently, and attuned from the same bench.

## Fixed

- **Every save crashed on entering town.** Adding the Wardstone to the material table left existing saves without a price for it, and the market screen reads a price for every material the instant it draws. The repair now runs on every load rather than at one particular save revision, so adding a material can never do this again.
- The five sigils were drawn their own icons and then shipped pointing at a placeholder gem.
- The sigil bench did not exist. Stones dropped, the cast key worked, and there was no way to inscribe or attune one — a found stone sat in the stash for good.

---

# Balance pass: slower, harder, scarcer

*Unreleased. The worktree is uncommitted and nothing has been pushed.*

The earlier game gave roughly 40 items per floor against a 16-slot pack. By depth 3, strong gear killed most ordinary enemies in one hit while armour made their attacks negligible. This pass cuts routine loot, moves monsters onto the same depth curve as the player, and makes stamina and healing matter. It aims for a punishing dungeon where the player can read what went wrong.

## What changed

**Combat and monsters**

- Monster health now scales with absolute floor depth as well as levels past a monster's first floor: `(1 + 0.12 × overlevel) × (1 + 0.5 × (depth − 1))`. Attack and defence scale more gently, at 55% and 45% of that health increase. The new roster has higher base health, attack and armour; enemies spawn about a third less often so the longer fights do not simply multiply the crowd.
- Player damage against monster armour now uses `k=45` rather than 15. Elemental damage passes through half of monster armour instead of bypassing it. Incoming hits use `k=75` with at least 34% of damage getting through, so high-tier armour still helps without erasing attacks.
- The Cave Spider's attack cycle is slower and its wind-up easier to read. The light-enemy stagger threshold moved from 40 to 55 base HP to preserve which monsters can be interrupted after the roster's HP increase. The Ashen King's stats remain 470 HP and 32 attack.
- Stamina regenerates at 22/s after a 0.9s delay, down from 34/s after 0.5s. Fight Milk's text and calculations now reflect the new base rate.

**Loot and progression**

- Ordinary rooms have a 12% chest chance instead of 35% and usually at most one urn. Treasure rooms, shrines, the throne room and loose floor piles also contain less. Enemy gear and material drops, chest gear, potions and blueprint odds are lower. Chests and vaults pay more coin per find; vaults and secret rooms remain premium rewards.
- Natural Rare and Epic gear now start at depths 3 and 5, rather than 2 and 4. Material tiers enter later, and `materialForDepth` aims lower. Day-one market stock therefore no longer includes iron. The Ashen King's guaranteed drops remain guaranteed.
- Healing Draught restores 25% of maximum health instead of 35%; Greater Healing restores 55% instead of 75%. Shrines mend 60% of maximum health and refill stamina instead of fully healing. Their messages describe the partial mend.
- Renown payouts, durability and the global enemy damage multiplier are unchanged. The supply shop now honours Fight Milk's found-only rule instead of offering unlimited bottles.

**The Warden**

- The starting backpack is **12 slots, down from 16**. Sixteen was sized for the old loot volume; with routine loot cut by about sixty percent, no scripted profile at any depth ever filled a 16-slot pack, which removed the decision about what to carry home and left Pack Mule worth measurably nothing. A deep delve now peaks around nineteen slots, so the squeeze lands on deep runs and nowhere near the first floor. `addItem` refuses to overfill rather than dropping, and `startRun` returns anything that no longer fits to the unlimited stash, so an older save cannot lose items to the smaller pack; there is a test for it.
- Three upgrades repriced against measured value (`npm run upgrades`, each upgrade maxed and alone against no upgrades, same seeds): **Pack Mule** 4/8/14 → 3/6/11, which measured at exactly zero on depth, survival and haul before the pack shrank and is worth about +85g a run after. **Supply Crate** 3/6/10 → 5/11/18, the best buy in the tree by a distance, since healing supply is what binds a deep delve. **Treasure Sense** +12% → +20% per level, 5/10/16 → 6/13/22. It measured as close to nothing, and what it did add was almost entirely Common: find multiplied the good rarity bands but Common's flat weight of 100 anchored the roll, so "loot find" bought more junk rather than better loot. Find now divides that weight as well, and scales a chest's valuable and gem rolls, which it never touched. At +60 find that is +22% gear pieces and **+85% more Uncommons**, so it is priced as a real upgrade rather than a rounding error.
- Whole tree: **333 renown**, against 314. The total barely moved; this reshaped the tree rather than inflating it.
- **Five upgrades were deliberately not repriced.** Silver Tongue, Market Insider, Master Smith and Appraiser's Eye act entirely in town, where the bot never goes. Second Wind measures at zero as well, but only because a slow weapon's stamina regeneration roughly matches its cost per swing; it binds for fast weapons, which the bot does not carry. A number the harness cannot see is not evidence.

**Tooling and records**

- `scripts/playtest.ts` runs seeded delves through the real `World` and settles them through `endRun`. It reports deaths, depth, damage sources, parries, loot kept or lost and renown. The bot handles loot, stairs and full packs without editing floor contents. It distinguishes a depth-6 visit from an Ashen King kill. Damage from a player-triggered trap is attributed only to the following hurt in the same event batch; alarms and monster-triggered traps cannot relabel later monster damage.
- When nearby enemies repeatedly turn the bot away from a route, it can use the player's strafe or back-step controls to leave the tile. This removes a seeded playtest timeout without changing game combat.
- `npm run playtest` includes fresh, geared and prepared profiles; `npm run tables` produces faster static composition, loot and combat tables. The separate `scripts/prepared.bench.ts` compares reaching depth 6 with seeking the King under the same seeds. `scripts/` is now trackable apart from the personal helper. The ordinary test suite remains separate.
- Seven new tests cover balance gates and guaranteed boss loot. `docs/MECHANICS.md` is the numerical reference, including generated monster tables; `docs/NEXT.md` records the remaining playtest questions. No save format or migration changed. Floors already stored in a live run retain their generated contents.

## The Ashen King, in three phases

He was the biggest trash mob in the game: one telegraph, one volley, thirty swings of health, and nothing changed between the first swing and the last. The fight now asks a different question as it goes, and each one is something the six floors above already taught.

- **The Throne** (100–65%) — the fight exactly as it was. Read the telegraph, step off the tile.
- **The Dark** (65–30%) — he puts out every torch in the throne room, permanently, and the guards you killed get back up at a third of their health. Only his glow and your lantern are left; the Lantern Wick finally earns its renown.
- **The Last Stand** (30–0%) — the crown splits, he gets faster, and he raises a ward of shadow that turns blows the way a shieldbearer's guard does. Openings have to be made, and the parry is how.

**He stays one creature.** Phases change his sprite family, glow, wind-up, recovery and whether he carries a guard; his id, name, resistances, hoard and health are untouched, because the codex, the field notes and the one guaranteed relic in the game are all keyed off them. `enemyView()` folds the phase into a copy of the stat block, so the guard rhythm, the sprite picker and the volley read the fields they always read.

**Which phase he is in is derived from his health, not stored**, so it cannot drift out of step with the bar — and a King already mid-fight in an older save resolves on the next tick with no migration. `SAVE_VERSION` and `SAVE_REVISION` both stay where they are.

**The turn is an opening, not a free hit.** He reels for 1.2 s and cannot act while the room changes around you — the same grace beat the mimic gets when it unfolds. It is deliberately *not* a parry window; that belongs to the parry. Anything he had in the air is cleared when the lights go out, because losing the room and three unseen bolts in the same instant is the one genuinely unfair combination here.

**Health 470 → 330**, so racing him is about 23 swings at the gear depth 6 is meant to be reached with, and clearing the risen guards too is about 32. The old fight was a flat 30. The guards are optional — phase advance is driven by the King's health alone, so you can ignore them and carry two knights into the last phase.

**A risen guard pays nothing.** Killing one again costs it no second hoard, no second tally and no second contract credit; without that the throne room would be the best place in the game to farm a Hollow Knight's moonsilver.

Art is recomposed, not redrawn: two new palettes over the existing grids, a crown with its two inner points knocked out, and an emissive ward stamped across the chest for the guard pose. No new 48×48 sprites.

## What the checks show

The 24-seed headless report uses the same seeds for the fresh parry comparison. These are scripted policies, not human success rates.

| Profile | Before | After |
|---|---:|---:|
| Fresh character, 35% parry | 38% die; mean depth 2.46 | 58% die; mean depth 1.67 |
| Fresh character, no parry | 63% die; mean depth 2.00 | 54% die; mean depth 1.58 |
| Iron Rare kit, aggressive | 21% die; mean depth 5.58 | 54% die; mean depth 3.17 |
| Iron Rare kit, careful | — | 33% die; mean depth 3.21 |
| Moonsilver Epic kit, aggressive | 0% die; all reach depth 6 | 54% die; mean depth 4.50 |
| Moonsilver Epic kit, careful | — | 42% die; mean depth 4.58 |

At 64 seeds the fresh profile settles at mean depth 1.77 with 75% reaching depth 2, so the 24-seed figure above is a little pessimistic by sampling noise rather than by design.

With endgame gear, high renown upgrades, 20 Greater Healings and a route that skips routine urns, the prepared bot reached depth 6 in **24/24** runs. It extracted in 16/24, but killed the Ashen King in **0/24**: reaching the floor is not winning the final encounter. A separate boss-seeking check reached depth 6 in 24/24 runs with 12 Greater Healings and killed him in none. With an extreme 60-bottle supply, it killed him in 8/16 and extracted in 3/16. That last loadout has 4,200g of base item value and is a stress test, not a plausible repeatable budget.

The bot does not dodge telegraphs, plan town visits, price repairs or restocking, or earn its starting endgame gear and upgrades over connected runs. It therefore establishes that a well-stocked character **can enter depth 6** and that the King **can be beaten**, but does not establish whether normal play reaches that loadout by the twentieth run or whether the final fight feels fair. The two Hollow Knight guards and the supply cost across depth 6 deserve particular attention in a human session.

Validation on the final code: `npm test` passes **330/330**, `npm run build` passes, `npm run playtest` completes with no timeouts, and `git diff --check` is clean. The build reports Vite's existing large-chunk advisory.
