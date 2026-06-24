# Godot Overworld And Battle Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Godot 4.6 slice where the player explores a top-down wilderness, triggers a wild encounter while moving, and completes a one-on-one turn-based monster battle using PP-limited moves.

**Architecture:** Keep game rules in data-driven `Resource` and `RefCounted` classes that do not depend on scene nodes, then bind those rules to small overworld, battle, and game-flow scenes. Use a lightweight headless GDScript test runner so battle behavior can be developed test-first without adding a third-party addon. The first turn order is intentionally player-first, so `speed` is stored for future use but does not affect this slice.

**Tech Stack:** Godot 4.6.2, typed GDScript, Godot scenes/resources, headless Godot test scripts

---

## Scope Decisions

- Encounters are checked at a fixed interval only while the player is moving inside an encounter area.
- Starter moves use 100% accuracy, while the data model retains an `accuracy` field.
- If a monster has no PP remaining, battle resolution uses an automatic 1-damage fallback action named `Struggle` so the battle cannot deadlock.
- Placeholder visuals use low-resolution geometric pixel-style shapes. Production pixel art is a later asset pass.
- Taming, party management, saving, factory jobs, types, status effects, and platform export presets remain out of scope.

## File Map

### Project And Tests

- `project.godot`: Project settings, main scene, display configuration, and keyboard/controller input actions.
- `tests/test_suite.gd`: Tiny assertion helper that counts failures without relying on debugger behavior.
- `tests/test_runner.gd`: Discovers and runs test methods, reports failures, and exits with a useful status code.
- `tests/test_smoke.gd`: Proves the headless test harness works.
- `tests/test_monster_instance.gd`: Covers runtime HP and PP behavior.
- `tests/test_battle_model.gd`: Covers damage, move validation, AI move selection, fallback behavior, and battle completion.

### Data And Rules

- `scripts/data/move_data.gd`: Immutable-style move definition resource.
- `scripts/data/monster_species.gd`: Reusable species definition resource.
- `scripts/data/monster_instance.gd`: Runtime HP and PP state for one monster.
- `scripts/data/encounter_table.gd`: Weighted wild-species selection and level generation.
- `scripts/battle/battle_model.gd`: UI-independent turn state machine and battle event generation.

### Runtime Scenes

- `scripts/core/game.gd`: Owns the starter monster, switches between overworld and battle, and resumes exploration.
- `scripts/overworld/player.gd`: Gridless top-down `CharacterBody2D` movement.
- `scripts/overworld/encounter_zone.gd`: Rolls encounters while a moving player remains inside the zone.
- `scripts/overworld/overworld.gd`: Relays wild encounter requests to the game root.
- `scripts/battle/battle_view.gd`: Renders model state and forwards move-button input.
- `scenes/Game.tscn`: Main scene and mode container.
- `scenes/overworld/Player.tscn`: Reusable player controller with placeholder pixel-style visual and collision.
- `scenes/overworld/EncounterZone.tscn`: Reusable encounter area.
- `scenes/overworld/Overworld.tscn`: Test wilderness with bounds, player, camera, and encounter region.
- `scenes/battle/Battle.tscn`: Battle backdrop, status panels, move list, and log.

### Starter Content

- `data/moves/bash.tres`: Reliable basic attack.
- `data/moves/ember_spit.tres`: Stronger low-PP attack.
- `data/moves/peck.tres`: Wild-monster attack.
- `data/monsters/cindercub.tres`: Player starter species.
- `data/monsters/scrapfinch.tres`: Wild species.
- `data/encounters/meadow.tres`: First weighted encounter table.

## Commands Used Throughout

Run all commands from the repository root.

```bash
GODOT=/Applications/Godot.app/Contents/MacOS/Godot
$GODOT --headless --path . --script res://tests/test_runner.gd
$GODOT --headless --path . --editor --quit
$GODOT --path .
```

The test runner command must exit `0` and print `ALL TESTS PASSED`. The import command must exit `0` without parser or resource errors.

### Task 1: Bootstrap The Godot Project And Test Harness

**Files:**
- Create: `project.godot`
- Create: `tests/test_suite.gd`
- Create: `tests/test_runner.gd`
- Create: `tests/test_smoke.gd`
- Modify: `.gitignore`

- [ ] **Step 1: Add the failing smoke test**

Create `tests/test_smoke.gd`:

```gdscript
extends "res://tests/test_suite.gd"


func test_arithmetic_smoke() -> void:
	check(1 + 1 == 3, "The smoke test must fail before the harness is proven.")
```

- [ ] **Step 2: Add the minimal project and test runner**

Create `project.godot` with the project identity, 640x360 viewport, integer scaling, nearest-neighbor texture filtering, and input actions:

```ini
[application]

config/name="Thunderhead"
run/main_scene="res://scenes/Game.tscn"

[display]

window/size/viewport_width=640
window/size/viewport_height=360
window/size/window_width_override=1280
window/size/window_height_override=720
window/stretch/mode="canvas_items"
window/stretch/aspect="keep"

[rendering]

textures/default_filters/use_nearest_mipmap_filter=false
textures/canvas_textures/default_texture_filter=0
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"

[input]

move_left={
"deadzone": 0.2,
"events": [Object(InputEventKey,"physical_keycode":65), Object(InputEventKey,"physical_keycode":4194311), Object(InputEventJoypadMotion,"axis":0,"axis_value":-1.0)]
}
move_right={
"deadzone": 0.2,
"events": [Object(InputEventKey,"physical_keycode":68), Object(InputEventKey,"physical_keycode":4194313), Object(InputEventJoypadMotion,"axis":0,"axis_value":1.0)]
}
move_up={
"deadzone": 0.2,
"events": [Object(InputEventKey,"physical_keycode":87), Object(InputEventKey,"physical_keycode":4194320), Object(InputEventJoypadMotion,"axis":1,"axis_value":-1.0)]
}
move_down={
"deadzone": 0.2,
"events": [Object(InputEventKey,"physical_keycode":83), Object(InputEventKey,"physical_keycode":4194322), Object(InputEventJoypadMotion,"axis":1,"axis_value":1.0)]
}
```

Create `tests/test_suite.gd`:

```gdscript
class_name TestSuite
extends RefCounted

var failures := 0


func check(condition: bool, message := "Expectation failed") -> void:
	if condition:
		return
	failures += 1
	push_error(message)
```

Create `tests/test_runner.gd`:

```gdscript
extends SceneTree

const TEST_SCRIPTS: Array[String] = [
	"res://tests/test_smoke.gd",
	"res://tests/test_monster_instance.gd",
	"res://tests/test_battle_model.gd",
]

var failures := 0


func _initialize() -> void:
	for script_path in TEST_SCRIPTS:
		if not ResourceLoader.exists(script_path):
			continue
		var suite = load(script_path).new()
		for method in suite.get_method_list():
			var method_name: String = method.name
			if not method_name.begins_with("test_"):
				continue
			print("RUN %s::%s" % [script_path, method_name])
			suite.call(method_name)
		failures += suite.failures
		suite.failures = 0

	if failures == 0:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		push_error("%d TEST(S) FAILED" % failures)
		quit(1)
```

Do not add an external test dependency in this slice.

- [ ] **Step 3: Run the smoke test and verify it fails**

Run:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --script res://tests/test_runner.gd
```

Expected: non-zero exit with the smoke-test assertion message.

- [ ] **Step 4: Correct the smoke assertion**

Change the assertion to:

```gdscript
check(1 + 1 == 2)
```

- [ ] **Step 5: Run the smoke test and verify it passes**

Expected: exit `0` and `ALL TESTS PASSED`.

- [ ] **Step 6: Ignore generated Godot state**

Add to `.gitignore`:

```gitignore
.godot/
```

- [ ] **Step 7: Commit**

```bash
git add project.godot .gitignore tests/test_suite.gd tests/test_runner.gd tests/test_smoke.gd
git commit -m "build: bootstrap godot project and tests"
```

### Task 2: Build The Monster Data Model

**Files:**
- Create: `scripts/data/move_data.gd`
- Create: `scripts/data/monster_species.gd`
- Create: `scripts/data/monster_instance.gd`
- Create: `tests/test_monster_instance.gd`

- [ ] **Step 1: Write failing runtime-state tests**

Create `tests/test_monster_instance.gd` with tests for initialization, HP clamping, PP spending, and zero-PP rejection:

```gdscript
extends "res://tests/test_suite.gd"

const MoveData = preload("res://scripts/data/move_data.gd")
const MonsterSpecies = preload("res://scripts/data/monster_species.gd")
const MonsterInstance = preload("res://scripts/data/monster_instance.gd")


func make_monster() -> MonsterInstance:
	var move := MoveData.new()
	move.display_name = "Bash"
	move.power = 4
	move.max_pp = 2
	var species := MonsterSpecies.new()
	species.display_name = "Cindercub"
	species.base_max_hp = 12
	species.base_attack = 5
	species.base_defense = 3
	species.default_moves = [move]
	return MonsterInstance.new(species, 1)


func test_initializes_hp_and_pp_from_species() -> void:
	var monster := make_monster()
	check(monster.current_hp == 12)
	check(monster.current_pp == [2])


func test_damage_clamps_hp_and_reports_fainted() -> void:
	var monster := make_monster()
	monster.take_damage(99)
	check(monster.current_hp == 0)
	check(monster.is_fainted())


func test_spend_pp_decrements_available_move() -> void:
	var monster := make_monster()
	check(monster.spend_pp(0))
	check(monster.current_pp[0] == 1)


func test_spend_pp_rejects_empty_move() -> void:
	var monster := make_monster()
	monster.current_pp[0] = 0
	check(not monster.spend_pp(0))
	check(monster.available_move_indices().is_empty())
```

- [ ] **Step 2: Run the tests and verify missing-class failures**

Run the headless test command.

Expected: parser or preload failures because the three data scripts do not exist.

- [ ] **Step 3: Implement move and species resources**

Create `scripts/data/move_data.gd`:

```gdscript
class_name MoveData
extends Resource

@export var display_name := ""
@export_range(0, 999, 1) var power := 1
@export_range(1, 100, 1) var accuracy := 100
@export_range(1, 99, 1) var max_pp := 10
@export var tags: Array[StringName] = []
```

Create `scripts/data/monster_species.gd`:

```gdscript
class_name MonsterSpecies
extends Resource

@export var display_name := ""
@export_range(1, 999, 1) var base_max_hp := 10
@export_range(1, 999, 1) var base_attack := 5
@export_range(0, 999, 1) var base_defense := 5
@export_range(1, 999, 1) var base_speed := 5
@export var default_moves: Array[MoveData] = []
@export var role_tags: Array[StringName] = []
```

- [ ] **Step 4: Implement runtime monster state**

Create `scripts/data/monster_instance.gd`:

```gdscript
class_name MonsterInstance
extends RefCounted

var species: MonsterSpecies
var level: int
var current_hp: int
var current_pp: Array[int] = []

var max_hp: int:
	get:
		return species.base_max_hp + level - 1
var attack: int:
	get:
		return species.base_attack + level - 1
var defense: int:
	get:
		return species.base_defense + level - 1
var speed: int:
	get:
		return species.base_speed + level - 1


func _init(monster_species: MonsterSpecies, monster_level := 1) -> void:
	assert(monster_species != null)
	species = monster_species
	level = maxi(1, monster_level)
	current_hp = max_hp
	for move in species.default_moves:
		current_pp.append(move.max_pp)


func take_damage(amount: int) -> int:
	var applied := clampi(amount, 0, current_hp)
	current_hp -= applied
	return applied


func is_fainted() -> bool:
	return current_hp <= 0


func can_use_move(move_index: int) -> bool:
	return move_index >= 0 and move_index < current_pp.size() and current_pp[move_index] > 0


func spend_pp(move_index: int) -> bool:
	if not can_use_move(move_index):
		return false
	current_pp[move_index] -= 1
	return true


func available_move_indices() -> Array[int]:
	var result: Array[int] = []
	for index in current_pp.size():
		if current_pp[index] > 0:
			result.append(index)
	return result
```

- [ ] **Step 5: Run tests and verify they pass**

Expected: all smoke and monster-instance tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/data tests/test_monster_instance.gd
git commit -m "feat: add monster and move data model"
```

### Task 3: Implement The Turn-Based Battle Model

**Files:**
- Create: `scripts/battle/battle_model.gd`
- Create: `tests/test_battle_model.gd`

- [ ] **Step 1: Write failing battle-rule tests**

Create `tests/test_battle_model.gd`. Include fixture helpers and these tests:

```gdscript
extends "res://tests/test_suite.gd"

const MoveData = preload("res://scripts/data/move_data.gd")
const MonsterSpecies = preload("res://scripts/data/monster_species.gd")
const MonsterInstance = preload("res://scripts/data/monster_instance.gd")
const BattleModel = preload("res://scripts/battle/battle_model.gd")


func make_move(name: String, power: int, pp: int) -> MoveData:
	var move := MoveData.new()
	move.display_name = name
	move.power = power
	move.max_pp = pp
	return move


func make_monster(name: String, hp: int, attack: int, defense: int, moves: Array[MoveData]) -> MonsterInstance:
	var species := MonsterSpecies.new()
	species.display_name = name
	species.base_max_hp = hp
	species.base_attack = attack
	species.base_defense = defense
	species.default_moves = moves
	return MonsterInstance.new(species, 1)


func test_damage_never_drops_below_one() -> void:
	var move := make_move("Tap", 0, 3)
	var attacker := make_monster("A", 10, 1, 1, [move])
	var defender := make_monster("B", 10, 1, 999, [move])
	check(BattleModel.calculate_damage(attacker, defender, move) == 1)


func test_player_move_spends_pp_and_damages_wild_monster() -> void:
	var move := make_move("Bash", 4, 2)
	var player := make_monster("A", 20, 5, 2, [move])
	var wild := make_monster("B", 20, 2, 2, [move])
	var battle := BattleModel.new(player, wild, RandomNumberGenerator.new())
	battle.submit_player_move(0)
	check(player.current_pp[0] == 1)
	check(wild.current_hp < wild.max_hp)


func test_zero_pp_player_move_is_rejected() -> void:
	var move := make_move("Bash", 4, 1)
	var battle := BattleModel.new(
		make_monster("A", 20, 5, 2, [move]),
		make_monster("B", 20, 2, 2, [move]),
		RandomNumberGenerator.new()
	)
	battle.player.current_pp[0] = 0
	var events := battle.submit_player_move(0)
	check(events[0].type == BattleModel.EventType.INVALID_MOVE)


func test_ai_only_chooses_moves_with_pp() -> void:
	var dry := make_move("Dry", 3, 1)
	var ready := make_move("Ready", 3, 1)
	var wild := make_monster("B", 20, 2, 2, [dry, ready])
	wild.current_pp[0] = 0
	var battle := BattleModel.new(make_monster("A", 20, 2, 2, [ready]), wild, RandomNumberGenerator.new())
	check(battle.choose_wild_move() == 1)


func test_no_pp_uses_struggle_fallback() -> void:
	var dry := make_move("Dry", 3, 1)
	var player := make_monster("A", 20, 2, 2, [dry])
	var wild := make_monster("B", 20, 2, 2, [dry])
	wild.current_pp[0] = 0
	var battle := BattleModel.new(player, wild, RandomNumberGenerator.new())
	var events := battle.submit_player_move(0)
	check(events.any(func(event): return event.type == BattleModel.EventType.STRUGGLE))


func test_player_with_no_pp_can_use_struggle() -> void:
	var dry := make_move("Dry", 3, 1)
	var player := make_monster("A", 20, 2, 2, [dry])
	var wild := make_monster("B", 20, 2, 2, [dry])
	player.current_pp[0] = 0
	var battle := BattleModel.new(player, wild, RandomNumberGenerator.new())
	var events := battle.submit_player_move(-1)
	check(events.any(func(event): return event.type == BattleModel.EventType.STRUGGLE and event.actor == player))
	check(wild.current_hp == wild.max_hp - BattleModel.STRUGGLE_DAMAGE)


func test_faint_ends_battle_before_counterattack() -> void:
	var knockout := make_move("Knockout", 50, 1)
	var reply := make_move("Reply", 50, 1)
	var battle := BattleModel.new(
		make_monster("A", 10, 10, 1, [knockout]),
		make_monster("B", 2, 1, 1, [reply]),
		RandomNumberGenerator.new()
	)
	battle.submit_player_move(0)
	check(battle.result == BattleModel.Result.PLAYER_WIN)
	check(battle.player.current_hp == battle.player.max_hp)
```

- [ ] **Step 2: Run the tests and verify the model is missing**

Expected: preload failure for `battle_model.gd`.

- [ ] **Step 3: Implement the battle state machine**

Create `scripts/battle/battle_model.gd`:

```gdscript
class_name BattleModel
extends RefCounted

enum Result { IN_PROGRESS, PLAYER_WIN, PLAYER_LOSS }
enum EventType { MOVE_USED, DAMAGE, INVALID_MOVE, STRUGGLE, FAINTED, BATTLE_ENDED }

const STRUGGLE_DAMAGE := 1

var player: MonsterInstance
var wild: MonsterInstance
var result := Result.IN_PROGRESS
var rng: RandomNumberGenerator


func _init(player_monster: MonsterInstance, wild_monster: MonsterInstance, random: RandomNumberGenerator) -> void:
	player = player_monster
	wild = wild_monster
	rng = random


static func calculate_damage(attacker: MonsterInstance, defender: MonsterInstance, move: MoveData) -> int:
	return maxi(1, move.power + attacker.attack - defender.defense)


func submit_player_move(move_index: int) -> Array[Dictionary]:
	if result != Result.IN_PROGRESS:
		return [{"type": EventType.INVALID_MOVE}]

	var events: Array[Dictionary] = []
	if player.available_move_indices().is_empty() and move_index == -1:
		events.append_array(_resolve_struggle(player, wild))
	elif player.can_use_move(move_index):
		events.append_array(_resolve_move(player, wild, move_index))
	else:
		return [{"type": EventType.INVALID_MOVE}]
	if wild.is_fainted():
		_finish(Result.PLAYER_WIN, wild, events)
		return events

	var wild_move := choose_wild_move()
	if wild_move >= 0:
		events.append_array(_resolve_move(wild, player, wild_move))
	else:
		events.append_array(_resolve_struggle(wild, player))

	if player.is_fainted():
		_finish(Result.PLAYER_LOSS, player, events)
	return events


func choose_wild_move() -> int:
	var available := wild.available_move_indices()
	if available.is_empty():
		return -1
	return available[rng.randi_range(0, available.size() - 1)]


func _resolve_move(attacker: MonsterInstance, defender: MonsterInstance, move_index: int) -> Array[Dictionary]:
	var move := attacker.species.default_moves[move_index]
	attacker.spend_pp(move_index)
	var damage := defender.take_damage(calculate_damage(attacker, defender, move))
	return [
		{"type": EventType.MOVE_USED, "actor": attacker, "move": move},
		{"type": EventType.DAMAGE, "target": defender, "amount": damage},
	]


func _resolve_struggle(attacker: MonsterInstance, defender: MonsterInstance) -> Array[Dictionary]:
	var damage := defender.take_damage(STRUGGLE_DAMAGE)
	return [
		{"type": EventType.STRUGGLE, "actor": attacker},
		{"type": EventType.DAMAGE, "target": defender, "amount": damage},
	]


func _finish(outcome: Result, fainted: MonsterInstance, events: Array[Dictionary]) -> void:
	result = outcome
	events.append({"type": EventType.FAINTED, "target": fainted})
	events.append({"type": EventType.BATTLE_ENDED, "result": result})
```

- [ ] **Step 4: Run tests and fix only rule-level failures**

Expected: all battle tests pass. Keep UI timing, animations, and scene changes out of this model.

- [ ] **Step 5: Commit**

```bash
git add scripts/battle/battle_model.gd tests/test_battle_model.gd
git commit -m "feat: add turn based battle model"
```

### Task 4: Add Encounter Data And Starter Content

**Files:**
- Create: `scripts/data/encounter_table.gd`
- Create: `data/moves/bash.tres`
- Create: `data/moves/ember_spit.tres`
- Create: `data/moves/peck.tres`
- Create: `data/monsters/cindercub.tres`
- Create: `data/monsters/scrapfinch.tres`
- Create: `data/encounters/meadow.tres`
- Modify: `tests/test_monster_instance.gd`

- [ ] **Step 1: Add failing weighted-encounter tests**

Add tests proving that a one-entry table always returns that species and generated levels stay within the configured range:

```gdscript
const EncounterTable = preload("res://scripts/data/encounter_table.gd")


func test_encounter_table_builds_monster_in_level_range() -> void:
	var source := make_monster()
	var table := EncounterTable.new()
	table.species = [source.species]
	table.weights = [1]
	table.min_level = 2
	table.max_level = 4
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var generated := table.generate(rng)
	check(generated.species == source.species)
	check(generated.level >= 2 and generated.level <= 4)
```

- [ ] **Step 2: Run tests and verify the encounter class is missing**

Expected: preload failure for `encounter_table.gd`.

- [ ] **Step 3: Implement weighted encounter generation**

Create `scripts/data/encounter_table.gd`:

```gdscript
class_name EncounterTable
extends Resource

@export var species: Array[MonsterSpecies] = []
@export var weights: Array[int] = []
@export_range(1, 99, 1) var min_level := 1
@export_range(1, 99, 1) var max_level := 1


func generate(rng: RandomNumberGenerator) -> MonsterInstance:
	assert(not species.is_empty())
	assert(species.size() == weights.size())
	var total_weight := 0
	for weight in weights:
		total_weight += maxi(0, weight)
	assert(total_weight > 0)

	var roll := rng.randi_range(1, total_weight)
	var running := 0
	for index in species.size():
		running += maxi(0, weights[index])
		if roll <= running:
			return MonsterInstance.new(species[index], rng.randi_range(min_level, max_level))
	return MonsterInstance.new(species.back(), min_level)
```

- [ ] **Step 4: Run tests and verify they pass**

Expected: all headless tests pass.

- [ ] **Step 5: Create starter `.tres` resources**

Use text resources with script ext-resources and monster sub-resource references. Set:

| Resource | Values |
|---|---|
| Bash | power 4, accuracy 100, PP 20 |
| Ember Spit | power 7, accuracy 100, PP 8, tag `heat` |
| Peck | power 3, accuracy 100, PP 25, tag `carry` |
| Cindercub | HP 24, attack 6, defense 4, speed 5, Bash + Ember Spit, role tag `smelt` |
| Scrapfinch | HP 18, attack 5, defense 3, speed 7, Peck, role tag `carry` |
| Meadow table | Scrapfinch weight 1, levels 1-2 |

Follow this exact pattern for each move:

```ini
[gd_resource type="Resource" script_class="MoveData" load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/data/move_data.gd" id="1"]

[resource]
script = ExtResource("1")
display_name = "Bash"
power = 4
accuracy = 100
max_pp = 20
tags = Array[StringName]([])
```

Follow this pattern for species, adding the move resources as ext-resources:

```ini
[gd_resource type="Resource" script_class="MonsterSpecies" load_steps=4 format=3]

[ext_resource type="Script" path="res://scripts/data/monster_species.gd" id="1"]
[ext_resource type="Resource" path="res://data/moves/bash.tres" id="2"]
[ext_resource type="Resource" path="res://data/moves/ember_spit.tres" id="3"]

[resource]
script = ExtResource("1")
display_name = "Cindercub"
base_max_hp = 24
base_attack = 6
base_defense = 4
base_speed = 5
default_moves = Array[ExtResource("1")]([ExtResource("2"), ExtResource("3")])
role_tags = Array[StringName]([&"smelt"])
```

- [ ] **Step 6: Import and validate resources**

Run:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --editor --quit
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --script res://tests/test_runner.gd
```

Expected: no resource parse errors and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/data/encounter_table.gd data tests/test_monster_instance.gd
git commit -m "feat: add starter monsters moves and encounters"
```

### Task 5: Build Player Movement And Wilderness Encounters

**Files:**
- Create: `scripts/overworld/player.gd`
- Create: `scripts/overworld/encounter_zone.gd`
- Create: `scripts/overworld/overworld.gd`
- Create: `scenes/overworld/Player.tscn`
- Create: `scenes/overworld/EncounterZone.tscn`
- Create: `scenes/overworld/Overworld.tscn`

- [ ] **Step 1: Implement the reusable player controller**

Create `scripts/overworld/player.gd`:

```gdscript
class_name PlayerController
extends CharacterBody2D

@export var move_speed := 90.0


func _physics_process(_delta: float) -> void:
	var direction := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	velocity = direction * move_speed
	move_and_slide()
```

- [ ] **Step 2: Build `Player.tscn`**

Create this node tree:

```text
Player (CharacterBody2D, player.gd)
├── Body (Polygon2D, 12x16 blocky teal silhouette)
├── FacingMark (Polygon2D, small pale triangle pointing down)
└── CollisionShape2D (RectangleShape2D size 10x12)
```

Use a 16x20 overall visual footprint and whole-number coordinates so nearest-neighbor rendering remains crisp.

- [ ] **Step 3: Implement movement-gated encounter rolls**

Create `scripts/overworld/encounter_zone.gd`:

```gdscript
class_name EncounterZone
extends Area2D

signal encounter_requested(wild_monster: MonsterInstance)

@export var encounter_table: EncounterTable
@export_range(0.0, 1.0, 0.01) var chance_per_check := 0.2
@export_range(0.1, 5.0, 0.05) var check_interval := 0.4

var player: PlayerController
var elapsed := 0.0
var rng := RandomNumberGenerator.new()
var enabled := true


func _ready() -> void:
	rng.randomize()
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _physics_process(delta: float) -> void:
	if not enabled or player == null or player.velocity.is_zero_approx():
		elapsed = 0.0
		return
	elapsed += delta
	if elapsed < check_interval:
		return
	elapsed = 0.0
	if encounter_table != null and rng.randf() <= chance_per_check:
		enabled = false
		encounter_requested.emit(encounter_table.generate(rng))


func rearm() -> void:
	enabled = true
	elapsed = 0.0


func _on_body_entered(body: Node2D) -> void:
	if body is PlayerController:
		player = body


func _on_body_exited(body: Node2D) -> void:
	if body == player:
		player = null
		elapsed = 0.0
```

- [ ] **Step 4: Build `EncounterZone.tscn`**

Use an `Area2D` root with the encounter script, a semi-transparent green `Polygon2D` for debug readability, and a rectangular `CollisionShape2D`. The overworld instance will assign the meadow encounter table.

- [ ] **Step 5: Implement the overworld relay**

Create `scripts/overworld/overworld.gd`:

```gdscript
class_name Overworld
extends Node2D

signal encounter_requested(wild_monster: MonsterInstance)

@onready var player: PlayerController = %Player
@onready var encounter_zone: EncounterZone = %EncounterZone


func _ready() -> void:
	encounter_zone.encounter_requested.connect(encounter_requested.emit)


func set_active(active: bool) -> void:
	visible = active
	process_mode = Node.PROCESS_MODE_INHERIT if active else Node.PROCESS_MODE_DISABLED
	if active:
		encounter_zone.rearm()
```

- [ ] **Step 6: Build the test wilderness**

Create `Overworld.tscn` with:

```text
Overworld (Node2D, overworld.gd)
├── Ground (ColorRect or Polygon2D, muted grass green, 640x360)
├── PathsAndRocks (several low-resolution Polygon2D placeholders)
├── WorldBounds (StaticBody2D with four rectangular collision children)
├── EncounterZone (instance, unique name, meadow table assigned, roughly right half of map)
└── Player (instance, unique name, position 160,180)
    └── Camera2D (enabled, position smoothing disabled)
```

Keep the whole test map inside 640x360 so the first slice does not need camera limits or map streaming.

- [ ] **Step 7: Import and smoke-check scene parsing**

Run the Godot import command.

Expected: exit `0` without parser, missing-node, or missing-resource errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/overworld scenes/overworld
git commit -m "feat: add overworld movement and encounters"
```

### Task 6: Build The Battle Presentation

**Files:**
- Create: `scripts/battle/battle_view.gd`
- Create: `scenes/battle/Battle.tscn`

- [ ] **Step 1: Implement the model-bound battle view**

Create `scripts/battle/battle_view.gd`:

```gdscript
class_name BattleView
extends Control

signal battle_finished(result: BattleModel.Result)

var model: BattleModel

@onready var player_name: Label = %PlayerName
@onready var player_hp: ProgressBar = %PlayerHP
@onready var wild_name: Label = %WildName
@onready var wild_hp: ProgressBar = %WildHP
@onready var move_list: VBoxContainer = %MoveList
@onready var battle_log: Label = %BattleLog
@onready var continue_button: Button = %ContinueButton


func start_battle(player_monster: MonsterInstance, wild_monster: MonsterInstance) -> void:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	model = BattleModel.new(player_monster, wild_monster, rng)
	continue_button.hide()
	battle_log.text = "A wild %s appeared!" % wild_monster.species.display_name
	_rebuild_move_buttons()
	_refresh_status()


func _rebuild_move_buttons() -> void:
	for child in move_list.get_children():
		child.queue_free()
	if model.player.available_move_indices().is_empty():
		var struggle_button := Button.new()
		struggle_button.text = "Struggle"
		struggle_button.set_meta("move_index", -1)
		struggle_button.pressed.connect(_on_move_pressed.bind(-1))
		move_list.add_child(struggle_button)
		return
	for index in model.player.species.default_moves.size():
		var move := model.player.species.default_moves[index]
		var button := Button.new()
		button.text = "%s  %d/%d PP" % [move.display_name, model.player.current_pp[index], move.max_pp]
		button.set_meta("move_index", index)
		button.disabled = not model.player.can_use_move(index)
		button.pressed.connect(_on_move_pressed.bind(index))
		move_list.add_child(button)


func _on_move_pressed(move_index: int) -> void:
	_set_commands_enabled(false)
	var events := model.submit_player_move(move_index)
	battle_log.text = _format_events(events)
	_refresh_status()
	_rebuild_move_buttons()
	if model.result == BattleModel.Result.IN_PROGRESS:
		_set_commands_enabled(true)
	else:
		continue_button.show()


func _refresh_status() -> void:
	player_name.text = "Lv.%d %s" % [model.player.level, model.player.species.display_name]
	player_hp.max_value = model.player.max_hp
	player_hp.value = model.player.current_hp
	wild_name.text = "Lv.%d %s" % [model.wild.level, model.wild.species.display_name]
	wild_hp.max_value = model.wild.max_hp
	wild_hp.value = model.wild.current_hp


func _set_commands_enabled(enabled: bool) -> void:
	for child in move_list.get_children():
		if child is Button:
			var move_index: int = child.get_meta("move_index")
			child.disabled = not enabled or (move_index >= 0 and not model.player.can_use_move(move_index))


func _format_events(events: Array[Dictionary]) -> String:
	var lines: Array[String] = []
	for event in events:
		match event.type:
			BattleModel.EventType.MOVE_USED:
				lines.append("%s used %s." % [event.actor.species.display_name, event.move.display_name])
			BattleModel.EventType.DAMAGE:
				lines.append("%s took %d damage." % [event.target.species.display_name, event.amount])
			BattleModel.EventType.STRUGGLE:
				lines.append("%s struggled." % event.actor.species.display_name)
			BattleModel.EventType.FAINTED:
				lines.append("%s fainted." % event.target.species.display_name)
			BattleModel.EventType.INVALID_MOVE:
				lines.append("That move cannot be used.")
	return "\n".join(lines)


func _on_continue_pressed() -> void:
	battle_finished.emit(model.result)
```

- [ ] **Step 2: Build `Battle.tscn`**

Create a full-rect `Control` scene with this layout:

```text
Battle (Control, battle_view.gd)
├── Background (ColorRect, forest clearing color)
├── WildMonsterVisual (Polygon2D, blocky rust bird silhouette, upper right)
├── PlayerMonsterVisual (Polygon2D, blocky ember-cat silhouette, lower left)
├── WildStatus (PanelContainer)
│   └── VBoxContainer
│       ├── WildName (Label, unique)
│       └── WildHP (ProgressBar, unique, no percentage)
├── PlayerStatus (PanelContainer)
│   └── VBoxContainer
│       ├── PlayerName (Label, unique)
│       └── PlayerHP (ProgressBar, unique, no percentage)
└── CommandArea (PanelContainer, anchored across bottom)
    └── HBoxContainer
        ├── BattleLog (Label, unique, minimum width 330, autowrap)
        └── VBoxContainer
            ├── MoveList (VBoxContainer, unique)
            └── ContinueButton (Button, unique, text "Return", pressed -> _on_continue_pressed)
```

Use 4-8 pixel spacing, square or lightly rounded panels, and Godot's default font for now. Ensure the move area can fit four buttons without changing the overall 640x360 layout.

- [ ] **Step 3: Import and validate the battle scene**

Run the Godot import command.

Expected: exit `0` without missing unique-node or signal-method errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/battle/battle_view.gd scenes/battle/Battle.tscn
git commit -m "feat: add battle presentation"
```

### Task 7: Wire The Complete Exploration-To-Battle Loop

**Files:**
- Create: `scripts/core/game.gd`
- Create: `scenes/Game.tscn`
- Modify: `README.md`

- [ ] **Step 1: Implement the game-mode coordinator**

Create `scripts/core/game.gd`:

```gdscript
class_name Game
extends Node

const STARTER_SPECIES: MonsterSpecies = preload("res://data/monsters/cindercub.tres")
const BATTLE_SCENE := preload("res://scenes/battle/Battle.tscn")

var starter: MonsterInstance
var battle_view: BattleView

@onready var overworld: Overworld = %Overworld
@onready var mode_root: Node = %ModeRoot


func _ready() -> void:
	starter = MonsterInstance.new(STARTER_SPECIES, 1)
	overworld.encounter_requested.connect(_on_encounter_requested)


func _on_encounter_requested(wild_monster: MonsterInstance) -> void:
	overworld.set_active(false)
	battle_view = BATTLE_SCENE.instantiate()
	mode_root.add_child(battle_view)
	battle_view.battle_finished.connect(_on_battle_finished)
	battle_view.start_battle(starter, wild_monster)


func _on_battle_finished(_result: BattleModel.Result) -> void:
	battle_view.queue_free()
	battle_view = null
	if starter.is_fainted():
		starter.current_hp = starter.max_hp
		for index in starter.current_pp.size():
			starter.current_pp[index] = starter.species.default_moves[index].max_pp
	overworld.set_active(true)
```

The player starter persists between wins. On a loss, this first slice restores HP and PP before returning to the same map because healing locations and game-over flow are outside scope.

- [ ] **Step 2: Build the root scene**

Create `scenes/Game.tscn`:

```text
Game (Node, game.gd)
└── ModeRoot (Node, unique)
    └── Overworld (instanced, unique)
```

- [ ] **Step 3: Document controls and verification**

Update `README.md` with:

```markdown
# Thunderhead

Early Godot prototype for a top-down monster-training and automation game.

## Run

Open the project in Godot 4.6 or run:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --path .
```

Move with WASD, arrow keys, or a controller left stick. Walk through the green wilderness area to trigger encounters, then choose PP-limited moves in battle.

## Test

```bash
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --script res://tests/test_runner.gd
```
```

- [ ] **Step 4: Run automated verification**

Run:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --editor --quit
/Applications/Godot.app/Contents/MacOS/Godot --headless --path . --script res://tests/test_runner.gd
```

Expected: import exits `0`; tests exit `0` with `ALL TESTS PASSED`.

- [ ] **Step 5: Run the playable slice**

Run:

```bash
/Applications/Godot.app/Contents/MacOS/Godot --path .
```

Manually verify:

1. WASD, arrow keys, and controller movement are accepted.
2. Collision keeps the player inside the test map.
3. Standing still in the encounter area does not trigger a battle.
4. Moving inside the encounter area eventually starts a Scrapfinch battle.
5. The UI shows both names and HP bars plus move names and PP.
6. Selecting a move spends PP and updates HP and the battle log.
7. Zero-PP moves are disabled.
8. Winning returns to the same overworld position.
9. Losing restores the starter and returns without errors.
10. A second encounter can start after returning.

- [ ] **Step 6: Check the debugger**

Close the running game and confirm the Godot output contains no parser errors, invalid node-path errors, resource errors, or repeated signal-connection errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/core/game.gd scenes/Game.tscn README.md
git commit -m "feat: complete overworld battle gameplay loop"
```

## Final Verification

- [ ] Run the full headless test suite once more.
- [ ] Run the project and complete one win and one loss manually.
- [ ] Inspect `git status --short` and confirm only intentional files remain.
- [ ] Request code review with `superpowers:requesting-code-review`.
- [ ] Apply valid review findings with `superpowers:receiving-code-review`.
- [ ] Re-run verification with `superpowers:verification-before-completion`.
