# Connecting Claude

Insight Hub needs Claude to read your transcripts. There are two ways to connect, chosen in setup and changeable under **Settings**.

## Option 1 — Anthropic API key

Paste a key from [console.anthropic.com](https://console.anthropic.com). You pay per use, directly to Anthropic.

- The key is stored **only on your machine**, in `.insight-hub/config.json` in the repo folder — which is git-ignored and readable by your user only.
- If an `ANTHROPIC_API_KEY` environment variable is set, the app uses it when the key field is left empty.
- Pick a model: Opus (best quality), Sonnet (faster, cheaper) or Haiku (cheapest).

## Option 2 — Claude Code

Use your existing Claude subscription through the `claude` command on your computer.

- Install Claude Code and run `claude` once to log in **before** testing the connection.
- The app shells out to `claude` with every tool turned off, so it can only read and answer.
- Pick the model alias: Opus or Sonnet.

## Test it

On the Settings tab (or in the wizard), click **Save & test connection**. The app makes one tiny round-trip and reports success or the exact error, so you know it works before you process a whole folder.

## What gets sent

Only the text needed for the task: transcript text during processing, and, for the Ask panel, the quotes relevant to your question. Nothing else — see [Data & privacy](#docs/privacy).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "API key was rejected" | Wrong or expired key — check it in Settings. |
| "Claude Code isn't installed or isn't on your PATH" | Install Claude Code, or switch to an API key. |
| "Claude Code … log in" | Run `claude` in a terminal and sign in, then test again. |
| "Rate limited" | Wait a minute and run again. |
