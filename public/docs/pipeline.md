# The pipeline

Processing runs in three steps. Each writes JSON to your output folder, so you can inspect — and edit — every stage.

```
transcripts/*.md ─▶ 1. taxonomy ─▶ 2. tag quotes ─▶ 3. synthesize ─▶ kb.json ─▶ the board
                     (personas,       (one file          (one file per
                      stages)          per interview)     persona)
```

Run it from the **Process** tab. A live log shows each step and how many Claude calls it makes.

## Step 1 — Taxonomy

Claude skims the transcripts and proposes the **frame**: the personas, the journey stages for each, the products, and a few hypotheses to test. This is written to `taxonomy.json`.

You can **edit the taxonomy** before tagging — rename personas, add or reorder stages, add hypotheses. Open it on the Process tab. If you change IDs after tagging, use **Rebuild from scratch**.

## Step 2 — Tag quotes

Claude reads each transcript and extracts **nuggets** — tagged quotes. Every nugget records the persona, journey stage, type (pain, job, need, workaround, tool, feature request, willingness-to-pay, praise, objection), evidence strength, and the verbatim quote.

Only **new or changed** transcripts are read, so adding one interview costs one interview's worth of calls, not the whole set.

## Step 3 — Synthesize

One pass per persona turns the quotes into a **persona profile**, a **journey map**, **opportunities**, and **RICE-scored features**. Every statement cites the nugget IDs for and against it.

A new interview **updates** the existing personas in place: evidence is attached to existing statements and features first, and your score edits are kept.

## Running it

| Button | What it does |
|---|---|
| **Run everything** | All three steps from scratch. |
| **Process new transcripts** | Tags only new/changed files, then updates the synthesis. |
| **Rebuild from scratch** | Re-reads every transcript (use after a taxonomy change). Your score edits are kept. |

## Confidence & reach

- **Reach** on a feature starts as the number of **distinct interviewees** whose quotes support it.
- **Confidence** starts from evidence strength: 100% if people pay for it today, 80% if they already work around it, 50% if they only said it.

These are starting points — tune them on the [RICE](#docs/rice) tab.
