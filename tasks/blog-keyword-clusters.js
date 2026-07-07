'use strict';

const fs = require('fs');
const path = require('path');

const CLUSTERS_PATH = path.join(__dirname, '..', 'build', 'blog', 'keyword-clusters.json');

/**
 * @typedef {object} ClusterTopic
 * @property {string} id
 * @property {'new_post'|'update_post'|'covered'|'landing_page'} action
 * @property {'pending'|'partial'|'covered'} status
 * @property {boolean} recommendedNext
 * @property {number} priority
 * @property {string|null} plannedSlug
 * @property {string} primaryKeyword
 * @property {string[]} secondaryKeywords
 * @property {string|null} titleHint
 * @property {string|null} topicPrompt
 * @property {string|null} coveredBy
 * @property {string[]} relatedPosts
 * @property {string|null} avoidCannibalization
 */

function loadKeywordClusters(filePath = CLUSTERS_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Keyword clusters file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveKeywordClusters(data, filePath = CLUSTERS_PATH) {
  data.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function flattenTopics(clustersData) {
  return (clustersData.clusters || []).flatMap((cluster) =>
    (cluster.topics || []).map((topic) => ({
      ...topic,
      clusterId: cluster.id,
      clusterName: cluster.name,
    })),
  );
}

function postSlugExists(slug, existingPosts) {
  if (!slug) {
    return false;
  }
  const normalized = String(slug).replace(/^\/blog\//, '').replace(/\/$/, '');
  return existingPosts.some((post) => post.slug === normalized);
}

/**
 * Sync topic status from published posts on disk.
 * @param {object} clustersData
 * @param {Array<{ slug: string }>} existingPosts
 */
function syncClusterStatus(clustersData, existingPosts) {
  for (const cluster of clustersData.clusters || []) {
    for (const topic of cluster.topics || []) {
      if (topic.action === 'new_post' && topic.plannedSlug && postSlugExists(topic.plannedSlug, existingPosts)) {
        topic.status = 'covered';
        topic.coveredBy = topic.plannedSlug;
        topic.recommendedNext = false;
      } else if (topic.action === 'covered' && topic.coveredBy) {
        topic.status = 'covered';
        topic.recommendedNext = false;
      } else if (topic.action === 'update_post' && topic.coveredBy) {
        if (postSlugExists(topic.coveredBy, existingPosts)) {
          topic.status = topic.status === 'covered' ? 'covered' : 'partial';
        }
        topic.recommendedNext = false;
      } else if (topic.action === 'landing_page') {
        topic.recommendedNext = false;
      } else if (topic.action === 'new_post' && topic.status === 'pending') {
        /* keep pending until post exists */
      }
    }
  }

  assignRecommendedNext(clustersData);
  return clustersData;
}

function assignRecommendedNext(clustersData) {
  for (const cluster of clustersData.clusters || []) {
    for (const topic of cluster.topics || []) {
      topic.recommendedNext = false;
    }
  }

  const candidates = flattenTopics(clustersData)
    .filter((topic) => topic.action === 'new_post' && topic.status === 'pending')
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  if (candidates.length > 0) {
    const next = clustersData.clusters
      .flatMap((c) => c.topics)
      .find((t) => t.id === candidates[0].id);
    if (next) {
      next.recommendedNext = true;
    }
  }

  return clustersData;
}

/**
 * @param {object} clustersData
 * @param {string} [topicId]
 */
function getNextTopic(clustersData, topicId) {
  const topics = flattenTopics(clustersData);

  if (topicId) {
    const found = topics.find((t) => t.id === topicId);
    if (!found) {
      throw new Error(`Unknown cluster topic id "${topicId}"`);
    }
    if (found.action !== 'new_post') {
      throw new Error(`Topic "${topicId}" is action=${found.action}, not new_post`);
    }
    if (found.status === 'covered') {
      throw new Error(`Topic "${topicId}" is already covered by ${found.coveredBy}`);
    }
    return found;
  }

  const next = topics.find((t) => t.recommendedNext);
  if (!next) {
    return null;
  }
  return next;
}

/**
 * @param {object} clustersData
 * @param {string} topicId
 * @param {string} slug
 */
function markTopicCovered(clustersData, topicId, slug) {
  for (const cluster of clustersData.clusters || []) {
    for (const topic of cluster.topics || []) {
      if (topic.id === topicId) {
        topic.status = 'covered';
        topic.coveredBy = slug;
        topic.recommendedNext = false;
        if (topic.plannedSlug && topic.plannedSlug !== slug) {
          topic.notes = `${topic.notes || ''} Published as ${slug} (planned: ${topic.plannedSlug}).`.trim();
        }
      }
    }
  }
  assignRecommendedNext(clustersData);
  return clustersData;
}

function formatTopicForPrompt(topic) {
  if (!topic) {
    return '';
  }

  const lines = [
    'Keyword plan (from editorial cluster — follow closely):',
    `- Cluster: ${topic.clusterName} (${topic.clusterId})`,
    `- Primary keyword: ${topic.primaryKeyword}`,
    `- Secondary keywords: ${(topic.secondaryKeywords || []).join(', ') || '(none)'}`,
  ];

  if (topic.titleHint) {
    lines.push(`- Suggested title direction: ${topic.titleHint}`);
  }
  if (topic.plannedSlug) {
    lines.push(`- Planned slug: ${topic.plannedSlug} (use unless a better non-conflicting slug fits)`);
  }
  if (topic.avoidCannibalization) {
    lines.push(`- Cannibalization guard: ${topic.avoidCannibalization}`);
  }
  if (topic.relatedPosts?.length) {
    lines.push(`- Link to related posts: ${topic.relatedPosts.map((s) => `/blog/${s}/`).join(', ')}`);
  }

  const queries = (topic.relatedQueries || [])
    .map((q) => q.query + (q.trending ? ' (trending)' : ''))
    .join('; ');
  if (queries) {
    lines.push(`- Related search queries: ${queries}`);
  }

  return lines.join('\n');
}

function buildTopicInstruction(topic) {
  if (!topic) {
    return null;
  }
  const base = topic.topicPrompt || `Write about: ${topic.primaryKeyword}`;
  return `${base}\n\n${formatTopicForPrompt(topic)}`;
}

function printClusterStatus(clustersData) {
  const topics = flattenTopics(clustersData);
  const next = topics.find((t) => t.recommendedNext);

  console.log('\n=== Blog keyword clusters ===');
  console.log(`Source: ${clustersData.source} (${clustersData.sourceFile})`);
  console.log(`Updated: ${clustersData.updatedAt}`);
  if (next) {
    console.log(`\n→ Next recommended post: [${next.id}] ${next.primaryKeyword}`);
    console.log(`  Slug: ${next.plannedSlug || '(auto)'}`);
    console.log(`  Prompt: ${next.topicPrompt?.slice(0, 100)}…`);
  } else {
    console.log('\n→ No pending new_post topics in cluster.');
  }

  for (const cluster of clustersData.clusters || []) {
    console.log(`\n## ${cluster.name} (${cluster.id})`);
    for (const topic of cluster.topics || []) {
      const flag = topic.recommendedNext ? ' ★ NEXT' : '';
      const slug = topic.coveredBy ? ` → ${topic.coveredBy}` : '';
      console.log(
        `  [${topic.status.padEnd(7)}] ${topic.action.padEnd(12)} P${topic.priority} ${topic.primaryKeyword}${slug}${flag}`,
      );
    }
  }
  console.log('');
}

module.exports = {
  CLUSTERS_PATH,
  loadKeywordClusters,
  saveKeywordClusters,
  syncClusterStatus,
  getNextTopic,
  markTopicCovered,
  formatTopicForPrompt,
  buildTopicInstruction,
  printClusterStatus,
  flattenTopics,
};
