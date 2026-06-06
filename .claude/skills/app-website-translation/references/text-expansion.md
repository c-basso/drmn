# Text expansion and layout (avoid clipping)

**Plan for longer** text than English in most languages; **a few** (Chinese, often Japanese) are shorter. Expansion is a **per-string** and **per-platform** problem: fixed-width **buttons** and **tabs** are the worst; **toasts** and **paragraphs** flex.

## Baseline: typical UI expansion vs U.S. English (planning, not a guarantee)

| Target | Rough vs English | Risk areas |
|--------|------------------|------------|
| **German, Dutch, Russian** | +~15–35% | **Buttons, nav**, compound nouns |
| **Finnish, Hungarian, Polish** | +~15–30% | Agglutination, cases |
| **Scandinavian (no compounding issue)** | +~10–25% | Phrasing, not as bad as DE |
| **Romance (fr, it, es, pt)** | +~15–25% | Articles, *vous* / polite forms |
| **Czech, Slovak, Greek, Turkish** | +~20–30% | Cases and suffixes |
| **Korean, Hindi** | variable | Often **longer**; script width differs |
| **Thai, Vietnamese** | can be **wider in glyph count**; **one line** height matters | Line breaks, diacritics (Viet.) |
| **Chinese (Simplified/Traditional)**, **Japanese (often)** | –10% to +10% of **line length** | **Fixed-width** Latin mixed with CJK |
| **Arabic, Hebrew** | logical length varies | **RTL** — mirror layout; do not only translate |

## Rules for translators (not only for engineers)

- **Shorter** beats literal when a **DE** or **PL** string must fit: **noun** + verb infinitive or **noun** alone if unambiguous in context.
- **Avoid** repeating long product names in every string; use **glossary** short form where legal allows.
- **WATCH** for **%s** in the middle: word order in DE/RU/PL can move the placeholder; test **3–4** placeholder positions mentally.
- **Punctuation** length: m‑dashes, guillemets, « », full-width **:**

## QA

- If design gives **max characters**, treat as **hard**; document exceptions in the glossary.
- Screenshot **smallest** device and **largest** dynamic type the product supports; **German** in **Call to Action** row (one line) is the classic failure.

## Cross-references

- [plural-forms-by-language.md](plural-forms-by-language.md) (longer plural = longer layout)
- [common-mistakes-by-language.md](common-mistakes-by-language.md) (DE compound-length habits)
