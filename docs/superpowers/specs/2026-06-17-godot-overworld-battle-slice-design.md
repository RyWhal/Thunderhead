# Godot Overworld And Battle Slice Design

## Goal

Build the first native Godot engine slice for Thunderhead: a 2D top-down monster trainer game where the player can move through a wilderness area, encounter a wild monster, and resolve a simple turn-based monster battle with PP-style moves.

This slice should establish the core architecture for exploration, encounters, monster data, move data, and battle flow without building factory automation yet.

## Non-Goals

- No taming, capture, party management, inventory, saving, crafting, or factory jobs in this slice.
- No final art pipeline, production sprite sheets, or polished UI skin.
- No type chart, status effects, abilities, elemental interactions, or monster labor systems yet.
- No Switch-specific porting work yet, though code and input choices should avoid PC-only assumptions.

## Target Experience

The player launches the project into a simple overworld scene. They can move a character around a top-down wilderness test map. When they enter or move within an encounter zone, the game can start a wild monster battle. The battle uses a classic turn-based flow: the player picks one of their monster's moves, PP is spent, damage is applied, the wild monster chooses a move automatically, and the battle ends when either monster faints. After the battle, the game returns to the overworld.

## Godot Project Structure

The project should use Godot 4.x and GDScript.

Core scene files:

- `scenes/Game.tscn`: root scene and high-level state owner.
- `scenes/overworld/Overworld.tscn`: test wilderness map, player, camera, collision, and encounter zone.
- `scenes/overworld/Player.tscn`: reusable top-down character controller.
- `scenes/overworld/EncounterZone.tscn`: `Area2D` that can request a battle from an encounter table.
- `scenes/battle/Battle.tscn`: battle presentation, command UI, HP/PP display, and battle log.

Core script folders:

- `scripts/core/`: shared game state, scene transition, and lightweight event definitions.
- `scripts/overworld/`: movement and encounter trigger logic.
- `scripts/battle/`: battle state, turn resolution, damage, AI move choice, and UI binding.
- `scripts/data/`: custom `Resource` classes for monsters, moves, and encounters.

Data folders:

- `data/monsters/`: `MonsterSpecies` resources.
- `data/moves/`: `MoveData` resources.
- `data/encounters/`: `EncounterTable` resources.

## Data Model

The first slice should be data-driven enough that adding a new monster or move does not require editing battle code.

`MoveData`:

- Display name.
- Power.
- Accuracy.
- Max PP.
- Optional tags array for future effects.

`MonsterSpecies`:

- Display name.
- Base max HP.
- Attack.
- Defense.
- Speed.
- Default move list.
- Optional role or trait tags for future factory ability mapping.

`MonsterInstance`:

- Species reference.
- Level.
- Current HP.
- Current PP per move.
- Runtime methods for fainted state and move availability.

`EncounterTable`:

- List of possible wild monster species.
- Relative weights.
- Level range.

## Overworld Flow

`Game.tscn` owns the current mode: overworld or battle. The initial mode is overworld.

`Overworld.tscn` contains a simple test map and a `Player` node. Movement should be gridless top-down movement using Godot input actions instead of raw keyboard checks. This keeps keyboard, controller, and future console controls aligned.

`EncounterZone` detects when the player is inside the area. The first implementation can use a simple chance roll on movement ticks or a short cooldown timer while the player is inside the zone. When an encounter starts, the zone emits a battle request with a generated wild `MonsterInstance`.

`Game` receives the battle request, stores enough overworld context to resume, and switches to `Battle.tscn`.

## Battle Flow

The battle is one player monster versus one wild monster.

Turn sequence:

1. Battle starts with a player monster and wild monster instance.
2. UI shows monster names, HP, available moves, remaining PP, and a battle log.
3. Player selects a move that has PP remaining.
4. Battle controller spends PP and resolves the player move.
5. If the wild monster faints, battle ends with a player win.
6. If the wild monster survives, it chooses a move automatically from moves with PP remaining.
7. Wild move resolves.
8. If the player monster faints, battle ends with a player loss.
9. If neither faints, command selection resumes.

Damage can start with a simple deterministic formula:

`damage = max(1, move.power + attacker.attack - defender.defense)`

Accuracy can be included if straightforward, but it is acceptable for the first implementation to support the field while treating all starter moves as 100% accurate.

Battle logic should live outside UI-specific code. The battle scene can display state and forward button presses, but a battle controller/model should own turn resolution and produce battle events such as damage, miss, PP spent, faint, and battle end.

## Starter Content

The slice needs only enough content to prove the loop:

- One starter monster owned by the player.
- One or two wild monster species.
- Three or four moves total.
- One test encounter table.
- One simple wilderness test map.

Names and visuals can be placeholder as long as they are original and do not resemble existing monster-trainer IP.

## Testing And Verification

The implementation plan should include automated tests for battle logic where practical:

- PP decreases after using a move.
- A move cannot be selected with zero PP.
- Damage cannot be below 1 for a damaging move.
- A battle ends when either monster reaches zero HP.
- Wild monster AI chooses only moves with PP remaining.

Manual verification should cover:

- Player movement works with configured input actions.
- Encounter zone starts a battle.
- Battle UI updates HP, PP, and log text.
- Win or loss returns to the overworld without crashing.

## Future Hooks

This slice should leave clean extension points for:

- Taming and adding wild monsters to a party.
- Monster ability tags that later map to factory labor jobs.
- Type interactions and status effects.
- Multiple monsters per party.
- Save/load.
- Production pixel-art assets and animation.

These hooks should not be implemented unless needed to keep the first slice coherent.
