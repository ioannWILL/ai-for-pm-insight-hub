import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, SAMPLE_TRANSCRIPTS } from "./paths.js";

// Local settings live in .insight-hub/config.json inside the repo folder.
// The folder is git-ignored, and the file is readable by your user only, because it can hold an API key.
const DIR = path.join(ROOT, ".insight-hub");
const FILE = path.join(DIR, "config.json");

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best quality)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (cheapest, rough results)" },
];
export const CLI_MODELS = [
  { id: "opus", label: "Opus (latest)" },
  { id: "sonnet", label: "Sonnet (latest)" },
];

const DEFAULTS = {
  setupDone: false,
  transcriptsDir: "",
  outputDir: path.join(ROOT, "demo-output"),
  engine: "api", // "api" = Anthropic API key, "cli" = the Claude Code CLI on this computer
  apiKey: "",
  model: "claude-opus-5-5",
  cliModel: "opus",
  product: { name: "", description: "" },
};

export function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

const ALLOWED = ["setupDone", "transcriptsDir", "outputDir", "engine", "model", "cliModel", "product"];

export function saveConfig(patch = {}) {
  const cur = loadConfig();
  const next = { ...cur };
  for (const k of ALLOWED) if (patch[k] !== undefined) next[k] = patch[k];
  if (typeof patch.apiKey === "string" && patch.apiKey.trim()) next.apiKey = patch.apiKey.trim();
  if (patch.clearApiKey) next.apiKey = "";
  if (!["api", "cli"].includes(next.engine)) next.engine = "api";
  if (!MODELS.some((m) => m.id === next.model)) next.model = DEFAULTS.model;
  if (!CLI_MODELS.some((m) => m.id === next.cliModel)) next.cliModel = DEFAULTS.cliModel;
  for (const k of ["transcriptsDir", "outputDir"]) if (next[k]) next[k] = path.resolve(expandHome(next[k]));
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

// What the browser may see: never the key itself.
export function publicConfig(c = loadConfig()) {
  const { apiKey, ...rest } = c;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    envApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    sampleTranscriptsDir: SAMPLE_TRANSCRIPTS,
    home: os.homedir(),
    models: MODELS,
    cliModels: CLI_MODELS,
  };
}

export function expandHome(p) {
  if (!p) return p;
  return p === "~" ? os.homedir() : p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}
