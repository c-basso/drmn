---
name: app-website-translation
description: High-quality, human-in-the-loop UI and marketing copy translation for mobile apps, web apps, and marketing sites. Builds and enforces a project glossary, follows Apple (and web) platform terminology per locale, handles plurals, gender, expansion, and formality. Use when translating in-app strings, website copy, or App Store/Play metadata so it reads at native level and does not break layouts. Triggers for locales, l10n, localization, i18n, strings, xcstrings, po/mo, JSON i18n, and “translate our app/website.”
---

# App & website translation (native quality)

## Hard rules (read before any work)

**1. No machine-translation code.** Do not write, run, or ask the user to run **Python, JavaScript, or any other scripts** whose purpose is to translate, batch-translate, or call external translation APIs. All translating is **manual reasoning in this session** (plus dictionary search and checking Apple / platform UI in references or on device screenshots the user provides).

**2. No multi-language agents.** Do **one target language at a time**, sequentially. Do not spawn sub-agents to translate other locales in parallel with this one.

**3. One target language per session** unless the user explicitly authorizes 2–3 (e.g. when context or token limit requires splitting). Do not start locale B before locale A is audited and done.

**4. Audit, then write.** For the chosen locale, **inventory and audit existing strings and glossary** before producing new text. If there is no prior copy, build glossary from English sources + platform terms first, then translate.

**5. Glossary is mandatory.** Maintain a **single glossary** for the project (or extend `assets/glossary-template.tsv`). Every non-trivial term (product name style, CTA, error patterns, “Settings”, “Account”) gets one approved row per locale. Reuse glossary strings everywhere.

At the start of a translation task, **restate these five rules in one line** so the user sees them.

## Outcome and pace

- Aim: **copy that tests well with native speakers**—clear **typos, agreement, register, and truncation** (German, Polish, etc.) by design, not by accident.
- **Rough time**: on the order of **~20 minutes per locale** for a typical app string set (varies with string count and review depth).

## Workflow

### Step 0 — Pre-flight

- Confirm **source language** (default English) and **exactly one** target **locale** (e.g. `de-DE`, not “German”).
- Confirm where strings live: **xcstrings**, **JSON**, **PO**, **stringsdict**, **LocalizedStrings**, CMS, or mixed.
- Open [references/validation-checklist.md](references/validation-checklist.md) and keep it in mind for the final pass.

### Step 1 — Build or refresh glossary (before translating body copy)

- Copy `assets/glossary-template.tsv` to the project or chat and fill: **key**, **en**, **target locale**, **notes** (context, not for UI).
- Add **platform must-match terms** for that locale. Use [references/apple-terminology-locales.md](references/apple-terminology-locales.md): prefer Apple’s system UI wording for the same concept; for locales not listed, **verify** in **Settings, Photos, App Store** (or web Help) and record the **exact** string in the glossary.
- Lock **formality and “you” form** for the product for this locale. See [references/formality-and-addressing.md](references/formality-and-addressing.md) — **one consistent choice** (e.g. `du` vs `Sie`, `tú` vs `usted`); document in glossary notes.

### Step 2 — Audit existing target strings (if any)

- List all strings (or file grep) for the **target locale** only.
- Mark: **correct**, **needs fix**, **wrong register**, **truncation risk**, **terminology drift** vs English or vs Apple.
- Only after this, **add or replace** lines. **Do not** overwrite good legacy translations without a reason; prefer glossary alignment.

### Step 3 — Translate the batch for this locale

- **One string at a time** in logical order: global chrome → main flows → edge cases.
- For each: respect **placeholders** (`%@`, `%(name)s`, `{0}`, `{{var}}`, ICU `select`/`plural`); do not break HTML/MDX/JSX tags.
- Apply: [references/plural-forms-by-language.md](references/plural-forms-by-language.md), [references/gender-and-agreement.md](references/gender-and-agreement.md), [references/text-expansion.md](references/text-expansion.md).
- Re-read [references/common-mistakes-by-language.md](references/common-mistakes-by-language.md) for the **active** target language.

### Step 4 — Self-validation

- Run through [references/validation-checklist.md](references/validation-checklist.md) on the full set of changed strings.
- If the UI is known to be **fixed-width**, compare effective length to English and to expansion guide; **shorten** for risk locales before shipping.

## Relationship to other project skills

- For **.xcstrings** or **i18n.ts** file mechanics**, use `xcstrings-localization` or `i18n-localization` for structure and **this skill** for **quality, glossary, and process**.
- This skill does **not** add translation automation scripts; it forbids them.

## Bundled resources

| Path | When to use |
|------|-------------|
| [references/plural-forms-by-language.md](references/plural-forms-by-language.md) | ICU/CLDR categories and rules per language family |
| [references/gender-and-agreement.md](references/gender-and-agreement.md) | Adjective/noun/gender and UI patterns |
| [references/text-expansion.md](references/text-expansion.md) | Avoid clipping and overflow |
| [references/formality-and-addressing.md](references/formality-and-addressing.md) | Consistent *you* and tone |
| [references/apple-terminology-locales.md](references/apple-terminology-locales.md) | Platform terms; gap-fill via system apps |
| [references/common-mistakes-by-language.md](references/common-mistakes-by-language.md) | Per-locale gotchas |
| [references/validation-checklist.md](references/validation-checklist.md) | Pre-ship check |
| `assets/glossary-template.tsv` | Start project glossary (TSV) |

**No `scripts/` for translation** — the `scripts` directory is intentionally not used. Reporting or file-format tools **must not** perform string translation.
