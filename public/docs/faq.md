# FAQ

## Do I need an internet connection?

Only to reach Claude for processing and the Ask panel. The board itself, once built, renders from local files.

## How much does it cost to run?

You pay Anthropic per use if you connect with an API key; with Claude Code it comes out of your subscription. Processing a folder is a handful of calls per interview. The **Load demo results** button shows the full board with no Claude calls at all.

## Can I edit what Claude produced?

Yes — that's the point. Edit the taxonomy before tagging, edit RICE scores and the backlog any time, add features by hand, and open any JSON file in the output folder. Your edits in `state.json` survive rebuilds.

## Will adding one interview wipe my scores?

No. New interviews update the evidence and the personas; your RICE scores, backlog order, owners and hand-added features in `state.json` are layered back on top. See [Files it writes](#docs/files).

## What languages are supported?

Any. Non-English transcripts are translated as they're tagged, and each quote records whether it was verbatim or translated.

## Why JSON files instead of a database?

So you can read, diff and version-control everything. Nothing on the board is hidden; it's all in `kb.json` and the files behind it. See [Files it writes](#docs/files).

## The Ask panel says it can't answer — why?

Because the interviews didn't cover your question, and it won't guess. Ask something the quotes actually speak to, or explicitly tell it to *"look beyond the interviews"* for an outside view. See [Ask the interviews](#docs/ask).

## Is my data sent anywhere besides Claude?

No. No analytics, no telemetry, no account. See [Data & privacy](#docs/privacy).

## Something's broken — where do I look?

The server prints errors to the terminal, and the browser console shows client errors. For connection problems, re-run **Save & test connection** on the Settings tab.
