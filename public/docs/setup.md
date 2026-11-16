# First-time setup

On first launch the app shows a short wizard. You can change any of it later under **Settings**.

## 1. Transcripts folder

Point the app at a folder of interview files — `.md`, `.txt`, `.vtt` or `.srt`, **one interview per file**. Any language works; non-English interviews are translated as they're tagged.

No transcripts of your own yet? Click **Use the sample interviews** to work with the bundled set (five fictional discovery interviews with Business Analysts and Product Managers).

## 2. Output folder

Pick or create an **empty** folder. Everything the app produces — taxonomy, tagged quotes, personas, your RICE edits — is written here as plain JSON you can read, diff and version. See [Files it writes](#docs/files).

## 3. Connect Claude

Choose how the app reaches Claude and test the connection:

- **Anthropic API key** — paste a key from [console.anthropic.com](https://console.anthropic.com). It's stored only on your machine.
- **Claude Code** — use your existing Claude subscription through the `claude` command.

Details and trade-offs: [Connecting Claude](#docs/claude).

## 4. Product (optional)

Name what the interviews are about and give a one-line description. It helps Claude pick sensible personas, but you can leave it blank.

## Just looking?

Want to explore the board before spending any credits? On the **Process** tab, click **Load demo results** to fill the board from the bundled sample interviews — no Claude calls needed.

## Next

With setup done, head to [The pipeline](#docs/pipeline) to process your transcripts.
