# Pre-ship validation checklist (per locale, per batch)

Run this **on the final set of strings** for the **one** target language you are finishing. For **glossary-driven** work, the glossary is **part** of the validation.

## Glossary and register

- [ ] Every **recurrent** product term, **CTA pattern**, and **“Cancel/Save/Settings”-class** word is in the **glossary** and **used** consistently.
- [ ] **Formality and “you”** match the locked row in [formality-and-addressing.md](formality-and-addressing.md) and did **not** drift in *errors* or *success* messages.
- [ ] **Apple (or web) system terms** match the **live** or tabulated [apple-terminology-locales.md](apple-terminology-locales.md) source for that locale.

## Technical integrity

- [ ] **Placeholders** preserved: `%@`, `%d`, `%1$@`, `{name}`, `{{x}}`, ICU `select`/`#`, and **HTML/JSX** tags.
- [ ] **No** double **spaces** or **wrong** `…` vs `...` vs `…` per **house style.**
- [ ] **Plurals** tested (mentally or in preview) for **0,1,2,3,5,10,11,12,21,100** where the language’s rules are non-trivial (see [plural-forms-by-language.md](plural-forms-by-language.md)).
- [ ] **Gender and agreement** checked for **all** adjective+placeholder combinations that could **break** (see [gender-and-agreement.md](gender-and-agreement.md)).

## Layout and expansion

- [ ] **Text expansion** considered for **buttons, tabs, nav**; German/Polish/FI especially (see [text-expansion.md](text-expansion.md)); **shorter** alternatives** noted** where the UI is **fixed** width.
- [ ] **RTL** locales: **BIDI** and **punctuation** order; **LTR** **blocks** in **ar/he** (phone numbers, emails) **isolated** if the stack requires it.

## Quality and noise

- [ ] **Not** a word-for-word calque: **idioms** and **CTA** sound like **this** platform in **this** market.
- [ ] **Punctuation and quotation** follow **locale** norms (guillemets, «», “”, 、, etc.) per **glossary/brand.**
- [ ] **No** leftover **English** except **allowed** (brands, legal names, *OK* in some UIs) — **per glossary**.
- [ ] Scanned [common-mistakes-by-language.md](common-mistakes-by-language.md) for the **active** target.

## What we did *not* use (confirm)

- [ ] **No** Python, JS, or other **scripts** were used to **auto-translate** (see [SKILL.md](../SKILL.md#hard-rules-read-before-any-work)).
- [ ] **No** **parallel** multi-locale “agent” runs for other languages during this string pass; **one** locale in focus.

**Sign-off line for chat:** *Locale, build/OS verified for Apple terms (or N/A), self-checklist completed.*
