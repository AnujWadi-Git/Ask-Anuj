import knowledge from '../_generated/knowledge.js';

export const getKnowledge = () => knowledge;

export function knowledgeAsText(k = knowledge) {
  return k.sections.map((s) => `### ${s.title}\n${s.text}`).join('\n\n');
}

export function linkCatalog(k = knowledge) {
  return Object.entries(k.links).map(([id, l]) => `- ${id}: ${l.label} (${l.description})`).join('\n');
}

// The model only ever names link ids; unknown ids are dropped, URLs come from the verified registry.
export function resolveLinks(ids, k = knowledge, max = 3) {
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = String(raw).trim().toLowerCase();
    if (seen.has(id) || !Object.hasOwn(k.links, id)) continue;
    seen.add(id);
    const { label, url, kind, description } = k.links[id];
    out.push({ id, label, url, kind, description });
    if (out.length >= max) break;
  }
  return out;
}

// Splits "answer text\nLINKS: a, b" into plain speech text and link ids; strips markdown the TTS would read aloud.
export function parseModelOutput(raw, maxChars = 900, maxWords = Infinity) {
  let text = String(raw || '').replace(/\r/g, '');
  let ids = [];
  const m = text.match(/^\s*LINKS:\s*(.*)$/im);
  if (m) {
    ids = m[1].split(/[,\s]+/).filter(Boolean);
    text = text.replace(m[0], '');
  }
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    text = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! ')) + 1 || maxChars).trim();
  }
  text = limitWords(text, maxWords);
  return { text, ids };
}

// Keep whole sentences until the word budget is reached (always keeps the first sentence).
export function limitWords(text, maxWords) {
  if (text.split(/\s+/).length <= maxWords) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  let out = '', words = 0;
  for (const sent of sentences) {
    const n = sent.trim().split(/\s+/).length;
    if (out && words + n > maxWords) break;
    out += sent; words += n;
  }
  return out.trim();
}
