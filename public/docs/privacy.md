# Data & privacy

Insight Hub is a local-first app. Here's exactly what that means.

## Where your data lives

- **Transcripts** stay in the folder you chose. The app reads them; it never moves or uploads them anywhere except to Claude for processing.
- **Results** are written to your output folder as JSON. They never leave your machine.
- **Your settings** — including an API key, if you use one — are stored in `.insight-hub/config.json` in the repo folder, which is git-ignored and written readable by your user only.

## What leaves your computer

Only what Claude needs to do the task:

- During **processing**, the transcript text (and the taxonomy) is sent to Claude.
- In the **Ask** panel, your question plus the quotes relevant to it are sent.

That's it. No analytics, no telemetry, no account.

## The server is local-only

The app binds to `127.0.0.1` and **refuses any request not addressed to `localhost`**, so other machines and other websites can't reach it. Write actions additionally require a request from the app's own page.

## Your responsibility

The interviews are real people's words. Keep the output folder somewhere appropriate, and mind your Anthropic account's data-retention settings for the processing step. When in doubt, anonymize transcripts before importing them.
