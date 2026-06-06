# Plural forms by language (ICU / CLDR)

Use the **ICU** `plural` / `pluralize` **categories** your stack expects (often: `zero`, `one`, `two`, `few`, `many`, `other`). Always match **one message per category the UI needs**; do not collapse categories in Russian or Polish if the string shows a count.

## Quick reference: category usage

| Family | `zero` | `one` | `two` | `few` | `many` | `other` |
|--------|--------|-------|-------|-------|--------|--------|
| English | — | 1 (optional in ICU) | — | — | — | 0, 2+ |
| German, French, Spanish, Italian, Portuguese (default) | — | 1 | — | — | — | 0, 2+ |
| **Arabic** | 0 | 1 | 2 | 3–10, … | 11+99, … | 100+ |
| **Czech, Slovak, Lithuanian, Latvian, Irish** | — | 1 | 2 (some langs) | small sets | some sets | `other` |
| **Polish** | — | 1 (ends in 1, not 11) | — | 2–4, not 12–14 | 0, 5–9, 11–20, etc. | — |
| **Russian, Ukrainian, Croatian, Serbian, Bulgarian** | — | 1, 21, 31, … (not 11–14) | — | 2–4, 22–24, … (not 12–14) | 0, 5–9, 11–20, decimals | — |
| **Japanese, Korean, Thai, Vietnamese, Chinese** | colloquial zero is rare in UI | often same form for all numbers | — | — | — | all counts (often one form) |

*Exact* numeric splits depend on CLDR version: when in doubt, use your framework’s `Stringsdict` / `Intl.PluralRules` or Xcode preview with sample counts **0,1,2,3,4,5,10,11,12,21,100**.

## Per-language notes

### Slavic (RU, UK, PL, CS, …)

- **Polish** `few` vs `many` is the usual trap: *1 zdjęcie, 2–4 zdjęcia, 5+ zdjęć*, *22 zdjęcia* but *12 zdjęć*.
- **Russian/Ukrainian** “11–14” and “12–14” go to `many` even if the last digit is 2–4.

### Arabic

- Full **six-form** MSA; product copy often **simplifies** for mobile—if your English only has one/other, align with the **minimum** the platform supports and what reviewers expect.

### French (fr)

- The **singular** is used with 0 in formal grammar (*0 message*) but product UIs may show **plural** for 0; **pick one** with UX and use consistently in the glossary.

### English

- In UI, **"1 item" vs "0 items" / "2 items"** — ensure **one** and **other**; **zero** optional: *"No items"* vs *"0 items"*

### East Asian (ja, ko, zh)

- Plural is often **absent** on nouns, but **counters** or classifiers can matter (Japanese). Match **source intent** (one label that works for 1 and N) vs a **pattern with number + counter**.

## Operational rule

When translating a plural key, **list test integers** the reviewers must use in QA: e.g. DE `0,1,2,5,10,12,22` for a Slavic string that needs many branches.

See also: [text-expansion.md](text-expansion.md) for longer plural branches.
