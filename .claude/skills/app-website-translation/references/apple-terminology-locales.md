# Apple (system) terminology by locale

**Principle:** For **iOS, macOS,** and **iPadOS** apps, the **user’s mental model** matches **Settings, Photos, App Store, and system alerts**. Reuse the **same words** Apple uses for the **same action or place** in **that** locale. Web-only products should still be **compatible** (Users expect “iCloud” to stay “iCloud”, etc.).

**Gap locales:** If a term is not in the tables here, open **the real device (or simulator) UI** in the **target locale** and read **Settings** → first-level items, then **Photos**, **App Store** tab bar (or equivalent) for the concept. For **iPad** vs **iPhone** layout strings may differ; prefer **iPhone** if your product is iPhone-primary.

> Tables below are **reference** — when Apple **updates** system strings in a major OS, **re-verify** critical entries before a major release.

## How to use this file

1. Glossary your **concepts** (e.g. “Settings (place)”, “Cancel (action)”, “Photo(s) (media)”).
2. For each **locale** you support, add the **Apple-consistent** term from the right column **or** from a live device check, and **never** invent a second synonym.
3. **Trademark and brand** strings (*Apple, iPhone, iCloud* …) **do not translate** unless local marketing rules say otherwise; follow [Apple’s trademark guidelines](https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html) in English source; in body copy, capitalisation rules follow **locale** norms.

## Core UI terms (reference — **verify** on `Settings` in target locale if unsure)

| Concept (EN) | de-DE (example) | fr-FR | es-ES | it | pt-BR | ja | ko | zh-Hans | zh-Hant | ru |
|-------------|----------------|-------|-------|-----|-------|----|----|---------|--------|-----|
| **Settings** | *Einstellungen* | *Réglages* (iOS) / *Paramètres* (context) | *Ajustes* | *Impostazioni* | *Ajustes* | 設定 | 설정 | 设置 | 設定 | *Настройки* |
| **Cancel** | *Abbrechen* | *Annuler* | *Cancelar* | *Annulla* | *Cancelar* | キャンセル | 취소 | 取消 | 取消 | *Отменить* (context) / *Отмена* |
| **Done** | *Fertig* | *OK* / *Terminé* (context) | *Hecho* / *Aceptar* (context) | *Fine* / *OK* (context) | *OK* (context) | 完了 / OK | 완료 | 完成 / 好 | 完成 / 好 | *Готово* / *OK* |
| **Back** | *Zurück* | *Retour* | *Atrás* | *Indietro* | *Voltar* | 戻る | 뒤로 | 返回 | 返回 | *Назад* |
| **Search** | *Suchen* (verb/field) | *Rechercher* | *Buscar* | *Cerca* | *Busca* (PT-BR) | 検索 | 검색 | 搜索 | 搜尋 | *Поиск* |
| **Edit** | *Bearbeiten* | *Modifier* (context) | *Editar* | *Modifica* | *Editar* | 編集 | 편집 | 编辑 | 編輯 | *Изменить* (context) |
| **Add** | *Hinzufügen* | *Ajouter* | *Añadir* | *Aggiungi* / *Inserisci* | *Adicionar* | 追加 / 新規 (context) | 추가 | 添加 / 新增 | 加入 / 新增 | *Добавить* |
| **Delete** | *Löschen* (verb) / *Entfernen* (remove) | *Supprimer* | *Eliminar* (context) | *Elimina* (context) | *Apagar* / *Excluir* (context) | 削除 | 삭제 | 删除 / 移去 | 刪除 / 移除 | *Удалить* |
| **Photos (app / library)** | *Fotos* (OS may vary) | *Photos* | *Fotos* | *Foto* (context) | *Fotos* | 写真 (context) / Photos | 사진(앱) | 照片/ “照片”App | 照片/「照片」| *Фото* |

*Apple sometimes uses* **English in-app** *for a tab name in a given locale* — **the device is truth** for the **version** you ship.

## “Each locale, own table” workflow

- Maintain a **glossary TSV** row: `concept_id`, `en`, `de-DE`, `fr-FR`, …, `source: Apple Settings 18.x`.
- For **a locale not in your sheet**, spend **2–3 minutes** in:
  1. **Einstellungen** / full settings first screen,
  2. **Fotos** (or your nearest vertical),
  3. **App Store** bottom bar,
  4. A **system alert** (e.g. delete confirmation) to see **Löschen** / **Löschen**-style phrasing.
- For **new OS strings**, a **one-line** note in the glossary: “Verified iOS 18.2, de-DE”.

## What not to copy blindly

- **legal / subscription** text may differ from **your** product; match **tone** to Apple but **compliance** to your lawyer.
- **Android** and **iOS** sometimes differ: if you ship **both**, **two columns** in glossary: `ios_de` vs `gms_de` when they diverge (e.g. **Google Play** naming).

## Related

- [formality-and-addressing.md](formality-and-addressing.md) (imperatives in alerts)
- [text-expansion.md](text-expansion.md) (German and compound buttons)
