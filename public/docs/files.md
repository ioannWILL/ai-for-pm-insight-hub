# Files it writes

Everything lives in the **output folder** you chose, as plain JSON. Read it, diff it, commit it.

| File | What |
|---|---|
| `taxonomy.json` | Personas, journey stages, products and hypotheses. Editable on the Process tab. |
| `extracts/<source>.json` | The tagged quotes from one transcript. |
| `manifest.json` | Which transcript (and which version of it) produced which extract. |
| `nuggets.json` | All quotes merged into one file. |
| `synth/<persona>.json` | Persona, journey, opportunities and features for one persona. |
| `kb.json` | Everything the board shows, assembled from the above. |
| `state.json` | **Your** edits to scores and the backlog. |

## Why JSON

Two reasons:

1. **Auditability.** Nothing on the board is magic. Open `kb.json` and you'll find the same personas, quotes and scores, with IDs that cross-reference each other.
2. **Version control.** Commit the output folder to git and you get a full history of how your understanding changed as interviews came in.

## state.json is sacred

Your manual work — adjusted RICE scores, backlog order, owners, release targets, features you added by hand — lives in `state.json`. A **rebuild never overwrites it.** New interviews change `kb.json`; your decisions in `state.json` are layered back on top.

## Incremental by design

`manifest.json` stores a content hash per transcript. When you process, the app compares hashes and re-reads only what's new or changed. Delete a transcript from the folder and its quotes drop out on the next run.
