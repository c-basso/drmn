# Formality and “you” — lock one voice per product + locale

Inconsistent *you* reads like a **bug** (German **Sie/du**, French **vous/tu**, Spanish **usted/tú/vosotros**, Portuguese **o senhor** vs *você*, Japanese **keigo** level). **Decide once** per (product, **locale**), document in the **glossary**, and apply to:

- In-app **buttons**, **errors**, **onboarding**
- **Transactional email** in that locale (if in scope)
- **Help/FAQ** tone
- **Push notification** first word (imperative vs polite request)

## Pick and document (example template)

| Field | Your choice |
|--------|------------|
| Locale (BCP-47) | e.g. `es-MX` |
| Audience | Consumer / pro / child |
| Default **you** | e.g. FR *tu* (B2C app) |
| Exceptions | Support-only *vous*; legal screen uses third person, etc. |
| Empathy in errors | Short imperative vs “We couldn’t…” |
| Pronoun for “your” (possessive) | e.g. DE *dein* (du) / *Ihr* (Sie) |

**Do not** switch mid-flow without a **reason** (e.g. switching to *Sie* on payment is sometimes intentional; then document).

## Hints by language (not prescriptive; product decides)

| Language | Common product split |
|----------|----------------------|
| **German** | B2B / finance **Sie**; B2C / young audience often **du**; mixed **is** visible—pick one. |
| **French** | EU consumer apps increasingly **tu**; banking / enterprise **vous**. |
| **Spanish** | *tú* vs *usted* varies by **region** (e.g. LATAM vs Spain); one app often picks **one** for a locale id (e.g. *es-419*). |
| **Italian** | *tu* is common in consumer tech; *Lei* in formal verticals. |
| **Polish, Czech, Russian** | *ty/vy* / *ty/pan(í)*; Russian *ты/Вы*; align with app category. |
| **Japanese** | *desu/masu* default in UI; **suru**-style for buttons; avoid mixing **sudden casual** in errors. |
| **Korean** | **해요** vs **합니다**; games vs banking differ—lock per product. |
| **Brazilian PT** | *você* vs *tu* — usually **one**; avoid mixing *o senhor* with *você*. |

## Apple-style UI

System apps often use **very consistent** register; **align** CTA and settings tone with the **same locale** on iOS. See [apple-terminology-locales.md](apple-terminology-locales.md) for the **imperative** and **noun** patterns Apple uses in **Settings** for that language.

## Voice-over copy

- **Pronounless** or **imperative-only** (common in CTA) reduces formality **bugs**; use when the language allows and meaning stays clear.
