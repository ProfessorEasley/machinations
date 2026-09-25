# Artificial Player

The Artificial Player node is not a model and it does not learn. Each turn it reads a short script and fires nodes for you, the same as a person clicking them.

A shop with a Money pool and an interactive Buy node:

```
if (Money > 3) fire(Buy)
```

While Money is above 3, the player fires Buy. When Money drops to 3 or below, it stops.

## Add a player

1. Place an **Artificial Player** node.
2. Set **Activation** to `automatic` so it acts every turn.
3. Set the nodes it should click to `interactive`. Those nodes stay idle until the script fires them.
4. Paste a script into **Script**. Names in the script are node labels.

Load a finished diagram from `public/examples/`:

- `artificial-player-shop.xml` — one rule, buy while Money is above 3.
- `artificial-player-choices.xml` — two rules, the first match wins.

Import either file from the File tab, or drag it onto the canvas, then press Run.

## Scripts

One line is one rule. The player reads from the top and runs the first rule whose condition is true. Later lines are skipped for that action.

### One condition

`public/examples/artificial-player-shop.xml`

```
if (Money > 3) fire(Buy)
```

Money starts at 10. Buy is an interactive drain that spends 4. The player buys on the turns where Money is 10 and 6, then stops at 2.

### Several conditions

`public/examples/artificial-player-choices.xml`

```
if (Money >= 8) fire(BuySword)
if (Money > 3) fire(BuyBread)
```

Money starts at 12. BuySword spends 8 and BuyBread spends 4. The first turn matches the sword rule (12 to 4). The next turn misses the sword rule and matches the bread rule (4 to 0). After that neither rule matches.

There is no `else`. Write the next case as another `if` line.

A line with no `if` always matches, so put it last if you want a fallback:

```
if (Money >= 8) fire(BuySword)
if (Money > 3) fire(BuyBread)
fire(Wait)
```

### Combine checks on one line

```
if (Money > 10 && Wood >= 5) fire(BuyArmy)
if (Money > 3 || Food < 2) fire(BuyBread)
```

Comparisons are `>`, `<`, `>=`, `<=`, `==`, and `!=`. `&&` and `||` combine them. `+`, `-`, `*`, `/`, `%`, and parentheses are allowed.

```
if (Money > Wood * 2) fire(BuyArmy)
```

A name in a condition has to be one word (`Money`, `Wood`). The label inside `fire(...)` can contain spaces:

```
if (Money > 10) fire(Buy army)
```

### Pick at random

`fireRandom` chooses one of the listed labels. Repeat a name to make it more likely.

```
fireRandom(Buy, Buy, Sell)
```

Two of the three entries are Buy, so Buy is chosen about twice as often as Sell. `random()` inside an `if` is not supported. A condition that calls it does not match, and the rule never fires.

## What the script does not do

- No `else`, loops, variables, or assignments.
- No function calls. `random()` is not available.
- Only two commands: `fire(Name)` and `fireRandom(A, B, C)`.
- `fire(A, B)` fires every listed node. `fireRandom` fires one.
- **Actions/Turn** re-reads the script that many times, but each node still activates only once in the turn. The diagram updates after the script has finished choosing.
