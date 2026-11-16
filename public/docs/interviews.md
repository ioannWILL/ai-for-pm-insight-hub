# Adding interviews

Insight Hub is built to grow one interview at a time.

## Add a file

Drop a new transcript into your transcripts folder — `.md`, `.txt`, `.vtt` or `.srt`, one interview per file. Then, on the **Process** tab, click **Process new transcripts**.

Only the new (or changed) file is read. Claude tags its quotes, then updates the existing personas — attaching the new evidence to existing statements and features first, and keeping your RICE edits. You don't rebuild the world to add one conversation.

## What makes a good transcript

- **One interview per file.** Keep separate conversations in separate files.
- **Speaker labels help** but aren't required. The interviewee's words are what get tagged; the interviewer's opinions are ignored.
- **Any language.** Non-English transcripts are translated as they're tagged, and the quote is marked as translated so you know.
- **Raw is fine.** You don't need to clean up a transcript. Fillers, tangents and all, the tagging copes.

## Changing or removing

- **Edit** a transcript and reprocess: its content hash changes, so it's re-tagged and its old quotes are replaced.
- **Delete** a transcript from the folder: its quotes drop out of the board on the next run.

## When to rebuild from scratch

If you change the **taxonomy** (rename personas, change stage IDs), the existing tags may no longer line up. Use **Rebuild from scratch** on the Process tab — it re-reads every transcript against the new frame. Your `state.json` edits survive.
