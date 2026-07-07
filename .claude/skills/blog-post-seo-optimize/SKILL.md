---
name: blog-post-seo-optimize
description: Audit and rewrite a single DRMN blog post for SEO and GEO. Finds AI garbage, keyword stuffing, missing FAQ schema, cannibalization, and HTML errors; outputs an improved build/blog/posts/{slug}.json. Use when optimizing one blog post, fixing a post URL, improving SEO/GEO of an article, or after blog:audit reports issues.
---

# Blog Post SEO Optimize

Optimize **one** DRMN blog post at a time. Source of truth: `build/blog/posts/{slug}.json` (not generated `blog/{slug}/index.html`).

## When to use

- User passes a blog URL, slug, or path: `/blog/why-white-noise-sleep/`, `why-white-noise-sleep`, `https://drmn.xyz/blog/...`
- User asks to fix SEO, GEO, AI-sounding copy, or indexing issues on a single post
- After `npm run blog:audit <slug>` reports critical or quality issues

## Workflow (one post only)

Copy this checklist and complete every step:

```
- [ ] 1. Resolve slug from user input
- [ ] 2. Run automated audit
- [ ] 3. Read source JSON + 2–3 related posts
- [ ] 4. Write audit summary (critical vs quality)
- [ ] 5. Rewrite build/blog/posts/{slug}.json
- [ ] 6. Re-audit with --strict
- [ ] 7. npm run build && npm run validate
- [ ] 8. Present diff summary + improved JSON path
```

### Step 1 — Resolve slug

```bash
node -e "const {parsePostSlugFromUrl}=require('./build/validate/blogPostContentQuality'); console.log(parsePostSlugFromUrl(process.argv[1]))" "USER_INPUT"
```

### Step 2 — Automated audit

```bash
npm run blog:audit -- SLUG
# JSON output:
node build/validate/audit-blog-post.js SLUG --json
```

**Critical** (must fix — blocks CI): foreign script garbage, hallucinated tokens, broken HTML, disallowed tags, suspicious attributes, missing description/hero.alt.

**Quality** (fix for ranking): short content, missing FAQ, missing disclaimer, keyword stuffing, AI phrases, weak meta description, no key takeaways.

### Step 3 — Context before rewriting

Read:

- `build/blog/posts/{slug}.json`
- `tasks/blog-post-prompt.js` — generation rules (match this style)
- List other posts: `ls build/blog/posts/*.json` — avoid cannibalization
- For GEO patterns: read `.claude/skills/seo-audit/references/ai-writing-detection.md`

Pick a **unique angle** vs similar posts (e.g. science vs how-to vs comparison).

### Step 4 — Rewrite rules

Edit **only** `build/blog/posts/{slug}.json`:

| Field | Rules |
|-------|--------|
| `title` | ≤73 chars, clear intent, not clickbait |
| `description` | 150–160 chars, primary keyword, no hype |
| `excerpt` | 1–2 sentences, different from description |
| `dateModified` | Set to today when content changes |
| `faq` | 4–6 items; questions match AI-search prompts; answers quotable |
| `content` | 750–2200 words; valid HTML; see allowed tags below |
| `tags` | 4–6 lowercase tags |

**Content must include:**

1. First `<p>`: clear definition (GEO entity clarity)
2. `<h2>Key takeaways</h2>` + 4–5 bullets
3. Medical disclaimer `<blockquote>` (not a substitute for clinical care)
4. 2–4 internal links: `href="/blog/slug/"` with trailing slash
5. Short paragraphs; vary vocabulary; em dashes ≤5 per 1000 words
6. No invented stats — hedge or remove ("evidence is mixed", "some studies suggest")
7. No competing app names; no external links unless citing a study

**Allowed HTML tags:** `p`, `h2`, `h3`, `ul`, `ol`, `li`, `strong`, `em`, `blockquote`, `a`, `table`, `thead`, `tbody`, `tr`, `th`, `td`

**Never leave in content:** CJK/Arabic/Hebrew/Cyrillic fragments, custom attributes (`gru=`, `collegial=`), broken tags (`<channel|>`), words like `investimento`, `enfranchised`.

### Step 5 — Verify

```bash
node build/validate/audit-blog-post.js SLUG --strict
npm run build
npm run validate
```

`--strict` must pass (no critical **or** quality errors) before you finish.

### Step 6 — Deliverable

Tell the user:

1. **Audit summary** — what was wrong (grouped critical / quality / warnings)
2. **What changed** — title angle, FAQ added, cannibalization fix, etc.
3. **File updated** — `build/blog/posts/{slug}.json`
4. **Score** — before/after from audit script

Show the full updated JSON in a code block only if the user asks; otherwise summarize.

## Reference commands

```bash
# Audit one post
npm run blog:audit -- why-white-noise-sleep

# Strict check (generation-quality bar)
node build/validate/audit-blog-post.js why-white-noise-sleep --strict

# Regenerate HTML after JSON edit
npm run build
```

## Quality bar (strict mode)

Matches `build/validate/blogPostContentQuality.js` used by `npm run validate` and `tasks/generate-blog-post.js`.

Do **not** edit `blog/{slug}/index.html` directly — it is generated.

## Related skills

- `seo-audit` — site-wide SEO
- `geo-optimization` — AI search citation patterns
