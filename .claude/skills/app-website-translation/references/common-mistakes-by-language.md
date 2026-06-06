# Common translation mistakes (targeted, not exhaustive)

Use the section for the **one locale** you are translating. Pair with the glossary; **re-read** after a break.

## German (de-DE, de-AT, de-CH)

- **Sie/du** mix in one flow; **falsche Anrede** in *errors* vs *onboarding.*
- **Komposita** you invent that native apps **do not** use; prefer **Shorter** + system term.
- **False friends**: *become* ≠ *bekommen* (receive); *eventuell* vs *currently*; **aktuelle** meaning “current” vs *actual*.
- **GENDER**: *der/die/das* with **placeholder**-inserted nouns; **Denglish** in marketing (*downloaden* where *herunterladen* is standard UI).
- **Punctuation** : space before units, **%** placement, **1.1** decimal comma.

## French (fr)

- **Capitalization**: not English Title Case; **lowercase** after *:* in body; product names are exceptions.
- **vous** vs **tu** drift between **onboarding** and **paywall.**
- **Abréviations**: *p.-éj.* etc.; don’t break **typographic** rules the brand uses.
- **Anglicisms** when a **French** UI term is standard in App Store lingo; **cédille** and **accents** in **search keywords** and UI.

## Spanish (es-ES, es-419, …)

- **Regional** *ordenador* / *equipo* / *computadora*; **pick per locale** id, not "generic Spanish."
- **Tú/usted** and *vos* — **inconsistent** second person.
- **GENDER** in *“el/la *usuario*”* debate — many apps use *masculine* default; **inclusive** copy may need **separate** strings; **align** with product policy.

## Italian (it)

- **Maiuscolo TUTTE LE PAROLE** (English habit) in UI; Italian uses **sentence** case in many UIs.
- **tu** (informal) vs **Lei** in **B2B**.

## Brazilian Portuguese (pt-BR) vs European (pt-PT)

- **Você/tu** on BR; **você** vs **o Senhor** in PT; don’t **merge** in one `pt` if you have two IDs.

## Russian (ru)

- **12–14** **plural** *exception*; **Punctuation** in **много пробелов** around **₽** and **%**.
- **Formal Вы** in **errors** and **ty** in **onboarding** — a classic bug.

## Polish (pl)

- **Plural** three-way *… zdjęcie* / *zdjęcia* / *zdjęć*; also **1, 2, 5, 12, 22** for QA.
- **Case** in short strings with **o / w / do**.

## Japanese (ja)

- **Katakana** vs **S-JIS** *loan* vs *native* where **iOS** uses a fixed set; don’t over-*カタカナ* system actions if **漢字**+**する** is normal.
- **keigo** slip in one **alert**; **半角/全角** in numbers and **Latin** in **CJK** rows.

## Korean (ko)

- **해요/합니다** mix; **띄어쓰기** errors; **subject** omission inconsistent.

## Chinese Simplified (zh-Hans) vs Traditional (zh-HK, zh-TW)

- **Wrong** script for audience; **词汇** 差异 (*计算机* / *电脑*; *影片* / *视频* in region-specific choices).
- **MIX** **half-width** English in **CJK** line: **inconsistent** spaces.

## Arabic (ar) / Hebrew (he) — with RTL

- **Broken** RTL: numbers and **( )** in **wrong** order; **BIDI** in mixed **+371** and **$**.
- **Gender** agreement with **%s** names.

## Turkish (tr)

- **i/ı/İ/I** confusion in **keywords**; **Vowel harmony** in **-da/-de** locatives; **2-word** *infinitive* in button **too** long.

## General (all)

- **%1$s** **order** wrong after “natural” **translation.**
- **The same** English string **reused** for **header** and **body** in target where **one** is **noun** and one **verb**.
- **Trailing/leading** space in **.strings**; **duplicated** punctuation with **”**.

See also: [plural-forms-by-language.md](plural-forms-by-language.md), [gender-and-agreement.md](gender-and-agreement.md), [text-expansion.md](text-expansion.md).
