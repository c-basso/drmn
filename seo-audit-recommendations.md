# SEO Audit Recommendations — Status Tracker

> Temporary file. Generated 2026-07-02. Delete after review.

## Legend

- ✅ Done
- ⏭️ Already OK / N/A
- ⏳ Deferred (larger change)

---

## Critical

| # | Recommendation | Status | Notes |
|---|----------------|--------|-------|
| 1 | Google Search Console verification | ⏭️ N/A | Verified via DNS (per owner) |
| 2 | Remove fictional testimonials | ✅ Done | Removed testimonials section from `build/template.html`; `app_store_proof` section remains |
| 3 | Resolve orphan `brown-noise-sleep-benefits` page | ✅ Done | Deleted `blog/brown-noise-sleep-benefits/` (no source JSON; duplicate of concentration topic) |

## High Impact

| # | Recommendation | Status | Notes |
|---|----------------|--------|-------|
| 4 | Remove invalid `SearchAction` schema | ⏭️ Already OK | `build/build.js` strips `potentialAction` at build time; not in generated HTML |
| 5 | Trim blog post titles (≤58 chars + ` \| DRMN Blog`) | ✅ Done | 17 posts retitled in `build/blog/posts/*.json` |
| 6 | Expand thin blog meta descriptions | ✅ Done | Fixed `sleep-sound-guide`, `the-science-of-sound-for-focus`, blog index, and borderline posts |
| 7 | Extract inline CSS from homepage | ⏳ Deferred | ~900 lines in `build/template.html`; separate performance PR |

## Quick Wins

| # | Recommendation | Status | Notes |
|---|----------------|--------|-------|
| 8 | Add `twitter:site` / `twitter:creator` to template | ✅ Done | Added to `build/template.html`; renders on all locale pages |
| 9 | Add `rel="next"` / `rel="prev"` on blog pagination | ✅ Done | `build/blog/build-blog.js` + `build/blog/template-index.html` |
| 10 | Add `llms.txt` to sitemap | ✅ Done | Via `ADDITIONAL_URLS` in `build/sitemap.js` → `sitemaps/legal.xml` |
| 11 | Norwegian hreflang `no` → `nb` | ✅ Done | `HREFLANG_BY_SLUG.no = 'nb'` in `build/locales.js` |
| 12 | Filipino `og:locale` `fil_PH` → `tl_PH` | ✅ Done | `build/locales.js` + `build/fil.json` |
| 13 | Expand blog index meta description | ✅ Done | `build/blog/blog.json` → 154 chars |

## Validation (2026-07-02)

| Check | Status | Notes |
|-------|--------|-------|
| `npm run build` | ✅ Pass | 36 locales + 25 blog posts |
| `npm run validate` | ✅ Pass | 4/4 validators, zero blog title warnings |
| `npm run sitemap` | ✅ Pass | pages: 36, legal: 4 (incl. llms.txt), blog: 29 |

## Files changed

- `build/template.html` — twitter tags, removed testimonials section
- `build/locales.js` — `nb` hreflang, `tl_PH` og locale
- `build/fil.json` — `og_locale: tl_PH`
- `build/sitemap.js` — `llms.txt` in legal sitemap
- `build/blog/blog.json` — blog index description
- `build/blog/build-blog.js` — pagination rel prev/next
- `build/blog/template-index.html` — rel prev/next in head
- `build/blog/posts/*.json` — 17 title trims + description fixes
- `blog/brown-noise-sleep-benefits/` — deleted

## Remaining (not in scope)

- Extract homepage inline CSS to external file (performance)
- Remove unused testimonials CSS from `build/template.html` (cosmetic)
- Remove `testimonials` keys from locale JSON files (optional cleanup)
- Remove `potentialAction` from locale JSON source files (cosmetic; build already strips)
