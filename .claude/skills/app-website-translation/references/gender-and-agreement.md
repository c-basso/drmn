# Gender, case, and agreement in UI

Short labels often **hide** nouns that still need correct **gender** in inflected languages. Resolve **in context**; record stable patterns in the glossary when the product repeats the same construction.

## German (de)

- **Compound nouns**: gender follows the **head noun** (*Fotoalbum* neuter, *E-Mail-Adresse* feminine, *Benutzer* masculine common in tech).
- **Attributive adjectives** in full sentences or marketing lines must **match** case/gender/number. Buttons are often **nominal** (*Speichern*, *Weiter*), avoiding adjective declension; **bad**: mixing *ein neues* vs *eine neue* in the same flow.
- **Sie/du** and **noun address**: once you pick a register (see [formality-and-addressing.md](formality-and-addressing.md)), keep **imperative** and **possessives** consistent.
- Truncation: **Dative / article** choices change length; prefer the **shortest correct** set for space-critical strings.

## French (fr), Spanish (es), Italian (it), Portuguese (pt)

- **Definite article + noun** in CTA: *l’* vs *le/la* elision, *de + le* → *du*.
- **Adjective** after gender (*nouveau / nouvelle*, *nuevo / nueva*, *nuovo / nuova*).
- **Colons and capitalization**: French uses **lowercase** after a colon in body copy; titles differ—match **platform and glossary**.
- Spanish/Portuguese: **gender harmony** in lists (*amigos y amigas* vs short product choice).

## Russian, Ukrainian, Polish, Czech, …

- **Noun** must agree in **case** for prepositions (*в альбоме*, *o zdjęciu*), prepositions in Slavic are **high-clipping** in UI: prefer **nominative** labels where English used nouns, or rephrase to **case-safe** phrasing.
- Polish: **noun + genitive of quantity** is common; avoid *half-translated* English calques.

## Arabic, Hebrew (RTL)

- **Gender** on adjectives, participles, and 2nd-person **verb** agreement; **dual** in Arabic is rare in modern app UI but appears in *two items* in some content apps.
- **Pro tip**: for mixed placeholder content (user names), a **verbless** label (noun + colon + value) reduces agreement bugs.

## Turkish

- **Agglutination**—suffixes for possession and plural; **vowel harmony**; ensure placeholder falls where grammar allows or rephrase to **O(1)-length** patterns.

## Operational rule

If a string contains a **noun of variable gender** in the target (e.g. the thing being deleted: “photo” vs “video”):

- **Split keys** in product (*delete_photo* / *delete_video*), or
- Use a **neuter construction** in the target language, or
- **Avoid** a full relative clause; use **noun** + action verb only.

Log the chosen pattern in the glossary for **reusable** strings (Delete, Remove, Add to X).
