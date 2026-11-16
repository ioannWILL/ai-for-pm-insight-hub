# Install & run

Insight Hub is a small Node.js app. No account, no cloud, no build step.

## Requirements

- **Node.js 20 or newer** — check with `node -v`.
- A way to reach Claude: an **Anthropic API key** *or* **Claude Code** installed and logged in. See [Connecting Claude](#docs/claude).

## Install

```bash
git clone https://github.com/ioannWILL/ai-for-pm-insight-hub.git
cd ai-for-pm-insight-hub
npm install
```

> **Before you run anything you cloned — scan it.** Running an unknown project executes its code on your machine. Review the source, and pay attention to install scripts, before `npm install`. That habit is part of this course.

## Run

```bash
npm start
```

Open **http://localhost:4317**. To stop the server, press `Ctrl+C`.

Developing? `npm run dev` restarts the server when you change files in `server/`.

## Ports

The app serves on port **4317** and listens on `127.0.0.1` only — it is not reachable from other machines. If the port is busy:

```bash
PORT=4318 npm start
```

## Next

The first time you open the app it walks you through [First-time setup](#docs/setup).
