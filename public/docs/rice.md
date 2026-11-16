# RICE prioritization

Every feature scored on one formula:

```
Score = Reach × Impact × Confidence ÷ Effort
```

## Where the numbers start

| Input | Starting value |
|---|---|
| **Reach** | The number of **distinct interviewees** whose quotes support the feature. |
| **Impact** | 0.25 minimal · 0.5 low · 1 medium · 2 high · 3 massive. |
| **Confidence** | 100% if people pay for it today · 80% if they already work around it · 50% if they only said it. |
| **Effort** | A rough estimate in person-weeks — adjust it to your team. |

These are **starting points grounded in the evidence**, not verdicts. Edit any of them inline; the score and the ranking update live.

## What you can do

- **Edit scores** inline — reach, impact, confidence, effort, Kano, product, personas, journey step.
- **Open a feature** to edit its title, description, status, owner, release and link, and to read its evidence.
- **Filter** by status, search by text, and sort by any column.
- **Send to backlog** to move a feature onto the delivery board.
- **Add a feature** by hand for something the interviews didn't surface.

## Your edits are saved

Every change is written to `state.json` in your output folder and **kept across rebuilds**. New interviews refresh the evidence; your scores and decisions stay. See [Files it writes](#docs/files).

## Evidence, always one click away

The **Evidence** column shows the ▲ for / ▼ against tally. Click it to read the quotes — the same quotes that set the starting reach and confidence.
