const fs = require('fs');
const path = require('path');

const { LANGUAGES, DEFAULT_LANGUAGE } = require('../constants');
const { extractMetaTags } = require('./opengraphValidator');

/**
 * SEO meta: `<title>` и `<meta name="description">`.
 *
 * **Title length (символы)** — см. [Rank Math: Ideal meta title length](https://rankmath.com/kb/ideal-meta-title-length/):
 * идеал **50–60** символов; Google часто обрезает заголовок после этой зоны, при этом фактический предел
 * ещё и **по ширине в пикселях** (~580px), поэтому длина в символах — ориентир, не абсолют.
 * В плагине Rank Math лимит подсказки — **60** символов. Дополнительно в проекте: `title-formulas.md` (мобильный SERP **50–55**).
 *
 * **Meta description** — внутренний чеклист `seo-writing-checklist.md`: **150–160** символов
 * (ценностное предложение + ключ + CTA).
 *
 * Политика проверки:
 * - **error** — отсутствие / пустое значение, явно некорректная длина (см. константы ниже).
 * - **warning** — для локалей с **основным латинским/кириллическим** SERP-текстом: вне 50–60 (title) и 150–160
 *   (description), с **одним** сообщением на description (без дубля «&lt;110» + «вне 150–160»).
 * - Локали **ja, ko, zh, th, hi, bn, ta, te, ml, he** не получают предупреждений по 50–60/150–160
 *   (другая типичная длина в символах и ширина глифов); для них — одно мягкое предупреждение,
 *   если description &lt; 110 символов (одна строка вместо латинского чеклиста 150–160).
 */

/** Локали, для которых не применяем эвристику «50–60 / 150–160 в символах» (как для латинского копирайта). */
const NON_LATIN_SERP_LENGTH_HEURISTIC = new Set([
  'ja',
  'ko',
  'zh',
  'th',
  'hi',
  'bn',
  'ta',
  'te',
  'ml',
  'he'
]);

function useLatinSerpLengthHeuristic(lang) {
  return !NON_LATIN_SERP_LENGTH_HEURISTIC.has(lang);
}

/** Оптимум: Rank Math / Google SERP — 50–60 символов. */
const TITLE_OPTIMAL_MIN = 50;
const TITLE_OPTIMAL_MAX = 60;

/** Нижняя граница «осмысленного» заголовка; ниже — error. */
const TITLE_HARD_MIN = 25;

/**
 * Выше этого значения заголовок с высокой вероятностью уйдёт под многоточие в выдаче
 * (Rank Math ориентируется на 50–60; верхняя «мягкая» планка для CI — 70 символов).
 */
const TITLE_HARD_MAX = 70;

/** Оптимум по seo-writing-checklist (meta description). */
const DESC_OPTIMAL_MIN = 150;
const DESC_OPTIMAL_MAX = 160;

/** Ниже этого значения описание почти наверняка слишком бедное для любой локали — error. */
const DESC_HARD_MIN = 50;

/** Запас сверх типичного лимита отображения — error. */
const DESC_HARD_MAX = 165;

/** Мягкий ориентир для «развёрнутого» сниппета (латиница); ниже — только warning. */
const DESC_WARN_MIN = 110;

/** Для non-Latin локалей: одно предупреждение, если описание короче типичного развёрнутого сниппета. */
const DESC_SHORT_NON_LATIN = 110;

function extractDocumentTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim();
}

function validateSeoMetaForPage(html, { file, lang }) {
  const errors = [];
  const warnings = [];

  const title = extractDocumentTitle(html);
  if (title === null) {
    errors.push('missing <title> element');
  } else if (!title.length) {
    errors.push('<title> is empty');
  } else {
    const len = title.length;
    if (len < TITLE_HARD_MIN) {
      errors.push(
        `<title> too short: ${len} characters (minimum sensible length: ${TITLE_HARD_MIN})`
      );
    } else if (len > TITLE_HARD_MAX) {
      errors.push(
        `<title> too long: ${len} characters (max before heavy truncation risk: ${TITLE_HARD_MAX}; see title-formulas.md)`
      );
    } else if (
      useLatinSerpLengthHeuristic(lang) &&
      (len < TITLE_OPTIMAL_MIN || len > TITLE_OPTIMAL_MAX)
    ) {
      warnings.push(
        `<title> length ${len} is outside optimal SERP range ${TITLE_OPTIMAL_MIN}–${TITLE_OPTIMAL_MAX} (Rank Math / Google; see https://rankmath.com/kb/ideal-meta-title-length/)`
      );
    }
  }

  const metaTags = extractMetaTags(html);
  const description = metaTags['description'];

  if (description === undefined) {
    errors.push('missing <meta name="description">');
  } else if (!String(description).trim().length) {
    errors.push('<meta name="description"> has empty content');
  } else {
    const len = String(description).trim().length;
    if (len < DESC_HARD_MIN) {
      errors.push(
        `meta description too short: ${len} characters (minimum: ${DESC_HARD_MIN}; target ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX} per seo-writing-checklist.md)`
      );
    } else if (len > DESC_HARD_MAX) {
      errors.push(
        `meta description too long: ${len} characters (maximum: ${DESC_HARD_MAX}; target ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX})`
      );
    } else if (useLatinSerpLengthHeuristic(lang)) {
      const thin = len < DESC_WARN_MIN;
      const outsideOptimal = len < DESC_OPTIMAL_MIN || len > DESC_OPTIMAL_MAX;
      if (thin && outsideOptimal) {
        warnings.push(
          `meta description length ${len}: under ${DESC_WARN_MIN} chars (thin snippet) and outside ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX} (seo-writing-checklist.md)`
        );
      } else if (thin) {
        warnings.push(
          `meta description length ${len} is below ${DESC_WARN_MIN} characters (thin for many SERPs; target ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX} per checklist)`
        );
      } else if (outsideOptimal) {
        warnings.push(
          `meta description length ${len} is outside optimal range ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX} (seo-writing-checklist.md)`
        );
      }
    } else if (len < DESC_SHORT_NON_LATIN) {
      warnings.push(
        `meta description length ${len} is short for SERP (locale ${lang}: non-Latin primary script; no fixed ${DESC_OPTIMAL_MIN}–${DESC_OPTIMAL_MAX} char rule—expand if preview looks thin)`
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: { file, lang, titleLength: title ? title.length : null, descriptionLength: description ? String(description).trim().length : null }
  };
}

async function validateSeoMeta() {
  const projectRoot = path.join(__dirname, '..', '..');
  const results = [];
  let allOk = true;

  console.log('Validating <title> and meta description (length + presence)...');

  for (const lang of LANGUAGES) {
    const htmlPath = path.join(
      projectRoot,
      lang === DEFAULT_LANGUAGE ? 'index.html' : `${lang}/index.html`
    );

    if (!fs.existsSync(htmlPath)) {
      allOk = false;
      results.push({
        ok: false,
        errors: [`Missing built HTML file: ${htmlPath}`],
        warnings: [],
        meta: { file: htmlPath, lang }
      });
      continue;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    const r = validateSeoMetaForPage(html, { file: htmlPath, lang });
    results.push(r);
    if (!r.ok) {
      allOk = false;
    } else {
      const bits = [];
      if (r.meta.titleLength != null) bits.push(`title ${r.meta.titleLength} chars`);
      if (r.meta.descriptionLength != null) bits.push(`description ${r.meta.descriptionLength} chars`);
      console.log(`  ${lang}: OK (${bits.join(', ')})`);
      r.warnings.forEach((w) => console.log(`    ⚠️  ${w}`));
    }
  }

  if (!allOk) {
    console.error('\n❌ SEO meta validation failed:');
    for (const r of results) {
      if (r.ok) continue;
      const file = r.meta?.file || '(unknown)';
      const lang = r.meta?.lang || '(unknown)';
      console.error(`\n- ${lang}: ${file}`);
      (r.errors || []).forEach((e) => console.error(`  ❌ ${e}`));
    }
  } else {
    const anyWarnings = results.some((r) => r.warnings && r.warnings.length);
    if (anyWarnings) {
      console.log('\n✅ SEO meta validation OK (with warnings above)');
    } else {
      console.log('\n✅ SEO meta validation OK: titles and descriptions within recommended ranges');
    }
  }

  return { ok: allOk, results };
}

module.exports = {
  validateSeoMeta,
  validateSeoMetaForPage,
  extractDocumentTitle,
  useLatinSerpLengthHeuristic,
  NON_LATIN_SERP_LENGTH_HEURISTIC,
  TITLE_OPTIMAL_MIN,
  TITLE_OPTIMAL_MAX,
  TITLE_HARD_MIN,
  TITLE_HARD_MAX,
  DESC_OPTIMAL_MIN,
  DESC_OPTIMAL_MAX,
  DESC_HARD_MIN,
  DESC_HARD_MAX,
  DESC_WARN_MIN,
  DESC_SHORT_NON_LATIN
};
