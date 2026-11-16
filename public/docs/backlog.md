# Backlog

Features you've sent from the [RICE](#docs/rice) list, moving through delivery.

## Columns

The board has four columns:

1. **In backlog** — committed, not started.
2. **In progress** — being built.
3. **Shipped** — released.
4. **Validated after launch** — you went back to users and confirmed the pain is gone.

That last column matters: shipping isn't the finish line, evidence that the problem is solved is.

## Per card

Each card shows its rank, live RICE score, product and personas, and lets you set an **owner**, a **target release**, and a **link** to a ticket, PR or doc. Reorder within a column with the up/down controls; move between columns with the dropdown.

## Recent changes

The feed at the bottom logs edits to scores and the backlog — what changed, on which feature, and when. It's a lightweight audit trail of how priorities moved.

## It's all one dataset

The backlog, the RICE list and the journey feature cards are the same features seen three ways. Change a status here and it updates everywhere, because it's all `state.json` layered over `kb.json`.
