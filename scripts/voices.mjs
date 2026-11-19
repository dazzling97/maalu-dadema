// Voice line assets.
//
//   npm run voices   creates public/voice/<speaker>/<event>/ for every line in
//                    src/config/voices.json, writes the recording script
//                    public/voice/SCRIPT.md, and refreshes public/voice/index.json.
//
// The Vite config also imports scanVoices(): the dev server serves a fresh
// index.json on every request, and every build writes one, so dropping a
// recording into its folder is all it takes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VOICE_DIR = path.join(root, 'public', 'voice');
const EXT = new Set(['.mp3', '.ogg', '.m4a', '.wav']);

/** { "podipasiya/catch/01": ["podipasiya/catch/01.mp3", ...] } for every recording that exists. */
export function scanVoices(dir = VOICE_DIR) {
  const out = {};
  const walk = (d, rel) => {
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (EXT.has(path.extname(e.name).toLowerCase()) && r.split('/').length === 3) {
        const key = r.slice(0, -path.extname(r).length);
        (out[key] ??= []).push(r);
      }
    }
  };
  walk(dir, '');
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
export function writeIndex(dir = VOICE_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const index = scanVoices(dir);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  return index;
}

function main() {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'src', 'config', 'voices.json'), 'utf8'));
  const players = Object.entries(m.speakers).filter(([, s]) => s.player).map(([id]) => id);
  const index = scanVoices();
  const pri = { 1: 'casual', 2: 'important', 3: 'warning' };
  let md = `# Malu Dadayama — voice recording script\n\n`;
  md += `Record each line in Sinhala and save it at the path shown (MP3 is the safest choice: it plays on every phone, tablet and browser; OGG, M4A and WAV also work). Keep clips short, about 0.5–2 seconds, trimmed tight, mono, with no music or effects. Lines without a recording are skipped silently, so you can add them a few at a time.\n\n`;
  md += `After adding files, reload the game (in development) or commit and push (the live site picks them up on its next deploy).\n\n`;
  md += `This file is generated from \`src/config/voices.json\` by \`npm run voices\`: edit the lines there, not here. Please have a native speaker check the Sinhala before recording.\n\n`;
  let have = 0, total = 0;
  for (const [ev, d] of Object.entries(m.events)) {
    const who = d.speaker === 'player' ? players : [d.speaker];
    md += `## ${ev} — ${d.when}\n\n${pri[d.priority]} · speaks at most every ${d.cooldown}s${d.chance < 1 ? ` · about ${Math.round(d.chance * 100)}% of the time` : ''}\n\n| File | Sinhala | Meaning | Recorded |\n| --- | --- | --- | --- |\n`;
    d.lines.forEach((l, i) => {
      for (const s of who) {
        const key = `${s}/${ev}/${String(i + 1).padStart(2, '0')}`;
        const got = !!index[key];
        total++; if (got) have++;
        md += `| \`${key}.mp3\` | ${l.si} | ${l.en} | ${got ? 'yes' : '—'} |\n`;
        fs.mkdirSync(path.join(VOICE_DIR, s, ev), { recursive: true });
        const keep = path.join(VOICE_DIR, s, ev, '.gitkeep');
        if (!fs.existsSync(keep)) fs.writeFileSync(keep, '');
      }
    });
    md += '\n';
  }
  md = md.replace('# Malu Dadayama — voice recording script\n\n', `# Malu Dadayama — voice recording script\n\n**${have} of ${total} lines recorded.**\n\n`);
  fs.writeFileSync(path.join(VOICE_DIR, 'SCRIPT.md'), md);
  writeIndex();
  console.log(`voice: ${have}/${total} lines recorded; folders, SCRIPT.md and index.json are up to date`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
