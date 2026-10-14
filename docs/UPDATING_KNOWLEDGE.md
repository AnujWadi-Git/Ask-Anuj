# Updating what Ask Anuj knows

Answers come **only** from two files:

* `knowledge/profile.md` — approved text. Each `## Heading` is a section; an optional `links: id1, id2` line under it names related links.
* `knowledge/links.json` — the registry of verified links. The model can only refer to these ids; it can never produce a URL itself.

Workflow
```bash
# edit the files, then
npm run build:knowledge   # validates ids / https, regenerates functions/_generated/knowledge.json
npm test
git add -A && git commit -m "knowledge: ..." && git push
npm run deploy
```

Rules of thumb: keep facts identical to the website/resume; do not add private details; if two sources disagree, fix the source first
(see "Content conflicts" in the brief). Keep total content under ~25k characters; beyond that, consider retrieval instead of whole-prompt.
