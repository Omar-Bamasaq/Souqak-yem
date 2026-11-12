import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { isPublicAdIndexable } from '../src/lib/publicAdIndexing.js';
import { resolveSiteBaseUrl } from '../src/lib/siteUrl.js';
import { slugify } from './prerenderRoutes.mjs';
import { validatePrerenderSnapshot, loadPrerenderSnapshot, PRERENDER_SNAPSHOT_SCHEMA_VERSION } from './validatePrerenderSnapshot.mjs';

export const DEFAULT_MAX_AGE_MS = 86_400_000;
const idPattern = /^[a-f\d]{24}$/i;
const pick = (value, fields) => Object.fromEntries(fields.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]]));
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function id(value) {
  requireValue(typeof value === 'string' && idPattern.test(value), 'Missing or invalid source _id');
  return value.toLowerCase();
}
function segment(value) {
  requireValue(typeof value === 'string' && value.length > 0 && !/[\\/%?#\s]/u.test(value) && !['.', '..', '__proto__', 'constructor', 'prototype'].includes(value), 'Unsafe or missing slug');
  return value;
}
function category(value, requireChildren = false) {
  requireValue(value && typeof value === 'object' && (!requireChildren || Array.isArray(value.children)), 'Incomplete category page children');
  requireValue(typeof value.description === 'string', 'Missing category description');
  requireValue(value.children == null || Array.isArray(value.children), 'Invalid category children');
  return { ...pick(value, ['name', 'description']), _id: id(value._id), slug: segment(value.slug),
    image: value.image ?? null, children: (value.children ?? []).map(child => category(child)) };
}
function array(payload) {
  requireValue(Array.isArray(payload), 'Expected complete API array');
  return payload;
}

// Only approved media origins and /uploads image files are accepted. Decode before
// examining paths so encoded separators and private paths cannot bypass inspection.
function inspectPublicData(value, mediaOrigins, key = '') {
  if (typeof value === 'string') {
    if (key === '_id') { id(value); return; }
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { throw new Error('Invalid encoded public text'); }
    requireValue(!/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?967[\s-]*)?7[01378](?:[\s-]*\d){7}\b|(?:bearer\s|(?:password|token|secret|api[_-]?key)\s*[:=])|(?:private(?:[_-]?uploads)?|identity|passport|verification|documents|attachments|wallet|admin|account|auth)(?:[\\/]|%2f))/i.test(decoded), 'Sensitive public text or link');
    if (key === 'image' || key === 'images') {
      requireValue(!decoded.includes('%') && !decoded.includes('\\') && !decoded.startsWith('//'), 'Unsafe image link');
      const url = new URL(decoded, 'https://relative.invalid/uploads/');
      requireValue(!url.username && !url.password && !url.search && !url.hash &&
        (url.origin === 'https://relative.invalid' || mediaOrigins.has(url.origin)) &&
        /^\/uploads\/(?:[a-z\d_-]+\/)*[a-z\d_.-]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(url.pathname) &&
        !decoded.split('/').some(part => part === '..' || part === '.'), 'Unsafe image link');
    } else {
      requireValue(!/(?:https?:|\/\/|javascript:|data:|mailto:|tel:|www\.)/i.test(decoded), 'Links are not permitted in exported public text');
    }
  } else if (Array.isArray(value)) value.forEach(child => inspectPublicData(child, mediaOrigins, key));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, child]) => inspectPublicData(child, mediaOrigins, k));
}

export async function createPrerenderSnapshot({
  apiBase = 'https://api.souqak-yem.com/api', siteBaseUrl = 'https://souqak-yem.com',
  fetchImpl = fetch, now = Date.now, maxAgeMs = DEFAULT_MAX_AGE_MS,
  expectedCategoryCount = 22, pageSize = 50, delayMs = 2500,
  allowLoopback = false
} = {}) {
  const base = new URL(apiBase);
  requireValue(!base.username && !base.password && !base.search && !base.hash &&
    (base.protocol === 'https:' || (allowLoopback && base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))), 'API must use credential-free HTTPS');
  requireValue(base.pathname.replace(/\/$/, '') === '/api', 'API base must end in /api');
  requireValue(Number.isSafeInteger(maxAgeMs) && maxAgeMs > 0 && Number.isSafeInteger(expectedCategoryCount) && expectedCategoryCount > 0 && Number.isSafeInteger(pageSize) && pageSize > 0 && pageSize <= 100, 'Invalid export limits');
  const site = resolveSiteBaseUrl(siteBaseUrl);
  const started = now();
  const root = base.href.replace(/\/$/, '');
  let lastRequest = 0;
  const get = async route => {
    requireValue(/^\/(?:categories\/(?:main|breadcrumbs\/[a-f\d]{24}|[^/?]+)|ads(?:\/[a-f\d]{24}|\?[^#]+))$/i.test(route), 'Non-public API route');
    const wait = lastRequest + delayMs - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const response = await fetchImpl(root + route, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    requireValue(response.ok, `Public API request failed (${response.status})`);
    return response.json();
  };
  // Validate every page, including a final first-page count check; no page cap
  // or coercion of missing pagination metadata into a successful empty result.
  const paginate = async categoryId => {
    const result = [], ids = new Set();
    let total, pages;
    const route = page => '/ads?' + new URLSearchParams({ limit: String(pageSize), page: String(page), sort: 'new', ...(categoryId ? { categoryId } : {}) });
    for (let page = 1; page <= (pages ?? 1); page++) {
      const data = await get(route(page));
      requireValue(Array.isArray(data.items) && Number.isSafeInteger(data.total) && data.total >= 0 && data.page === page && data.limit === pageSize && data.pages === Math.ceil(data.total / pageSize), 'Incomplete pagination metadata');
      if (total === undefined) { total = data.total; pages = data.pages; }
      requireValue(total === data.total && pages === data.pages && data.items.length === Math.min(pageSize, total - (page - 1) * pageSize), 'Inconsistent ad totals or truncated page');
      for (const ad of data.items) {
        const key = id(ad._id);
        requireValue(!ids.has(key), 'Duplicate ad across pages'); ids.add(key); result.push(ad);
      }
    }
    const check = await get(route(1));
    requireValue(check.total === total && check.pages === pages && check.page === 1 && check.limit === pageSize && Array.isArray(check.items) && JSON.stringify(check.items.map(a => id(a._id))) === JSON.stringify(result.slice(0, pageSize).map(a => id(a._id))), 'Ad totals or first page changed during export');
    requireValue(result.length === total, 'Ad count mismatch');
    return result;
  };
  const summaries = array(await get('/categories/main'));
  requireValue(summaries.length === expectedCategoryCount, `Expected ${expectedCategoryCount} public categories`);
  const seenTreeIds = new Set(), seenTreeSlugs = new Set();
  const loadCategory = async (summary) => {
    const key = id(summary._id), slug = segment(summary.slug);
    requireValue(!seenTreeIds.has(key) && !seenTreeSlugs.has(slug), 'Duplicate or cyclic category tree');
    seenTreeSlugs.add(slug);
    seenTreeIds.add(key);
    const detail = category(await get('/categories/' + encodeURIComponent(slug)), true);
    requireValue(detail._id === key && detail.slug === slug, 'Category detail mismatch');
    const children = [];
    for (const child of detail.children) children.push(await loadCategory(child));
    detail.children = children;
    return detail;
  };
  const categories = [], categorySsgDataBySlug = Object.create(null), categoryLists = new Map();
  for (const summary of summaries) {
    const slug = segment(summary.slug), key = id(summary._id);
    requireValue(!Object.hasOwn(categorySsgDataBySlug, slug) && !categories.some(c => c._id === key), 'Duplicate category');
    const detail = await loadCategory(summary);
    const breadcrumbs = array(await get('/categories/breadcrumbs/' + key)).map(c => pick(c, ['name', 'slug']));
    requireValue(breadcrumbs.length > 0 && breadcrumbs.at(-1).slug === slug, 'Incomplete category breadcrumbs');
    const list = await paginate(key);
    categoryLists.set(key, list.map(a => id(a._id)));
    categories.push(detail);
    categorySsgDataBySlug[slug] = { category: detail, breadcrumbs, subcategories: detail.children, ads: [] };
  }
  const listing = await paginate();
  const ads = [], adSlugs = new Set();
  for (const entry of listing) {
    const key = id(entry._id);
    const raw = await get('/ads/' + key);
    requireValue(id(raw._id) === key && isPublicAdIndexable(raw, now()), 'Ad is not eligible for indexing or detail mismatched');
    requireValue(!(raw.inventoryEnabled === true && !(typeof raw.stockQuantity === 'number' && raw.stockQuantity > 0)), 'Ad inventory is not eligible for indexing');
    const ad = pick(raw, ['title', 'description', 'status', 'isDeleted', 'isVisible', 'isArchived', 'sold', 'isSold', 'expiresAt', 'adType', 'price', 'currency', 'priceOnContact', 'images', 'isAvailable', 'inventoryEnabled', 'stockQuantity']);
    requireValue(typeof raw.description === 'string', 'Missing ad description');
    ad._id = key; ad.slug = segment(raw.slug || slugify(raw.title));
    requireValue(!adSlugs.has(ad.slug), 'Duplicate public ad slug'); adSlugs.add(ad.slug);
    // Resolve a leaf category through the authoritative category tree; never
    // fabricate the root id from a populated parent that only contains a name.
    const leafId = id(raw.categoryId?._id);
    const contains = c => c._id === leafId || c.children.some(contains);
    const matches = categories.filter(contains);
    requireValue(matches.length === 1, 'Ad category is not in the exported public tree');
    const main = matches[0];
    ad.categoryId = pick(main, ['_id', 'slug', 'name']);
    for (const location of ['governorateId', 'cityId']) ad[location] = raw[location] == null ? null : pick(raw[location], ['name']);
    ads.push(ad);
  }
  for (const main of categories) {
    const selected = ads.filter(ad => ad.categoryId._id === main._id);
    const actual = categoryLists.get(main._id).slice().sort();
    requireValue(JSON.stringify(actual) === JSON.stringify(selected.map(ad => ad._id).sort()), 'Category and global ad counts/IDs disagree');
    categorySsgDataBySlug[main.slug].ads = selected;
  }
  const finished = now();
  requireValue(finished - started < maxAgeMs, 'Export exceeded snapshot lifetime');
  const snapshot = { metadata: { source: 'public-api', sourceDatabase: 'not-accessed-public-api', exportedAt: new Date(started).toISOString(), schemaVersion: PRERENDER_SNAPSHOT_SCHEMA_VERSION, siteBaseUrl: site, maxAgeMs, expiresAt: new Date(started + maxAgeMs).toISOString() }, categories, ads, categorySsgDataBySlug };
  // Metadata contains intentional site URL; inspect all content independently.
  inspectPublicData({ categories, ads, categorySsgDataBySlug }, new Set([base.origin, new URL(site).origin]));
  validatePrerenderSnapshot(snapshot, { now: finished, maxAgeMs, expectedSiteBaseUrl: site });
  return snapshot;
}

export async function exportPrerenderSnapshot(outputPath, options = {}) {
  requireValue(typeof outputPath === 'string' && outputPath.length > 0, 'An explicit output path is required');
  const snapshot = await createPrerenderSnapshot(options);
  const target = path.resolve(outputPath), temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await loadPrerenderSnapshot(temporary, { now: (options.now ?? Date.now)(), maxAgeMs: snapshot.metadata.maxAgeMs, expectedSiteBaseUrl: snapshot.metadata.siteBaseUrl });
    // Exclusive publication protects a previously valid snapshot from replacement.
    await fs.link(temporary, target);
  } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return snapshot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, outputPath] = process.argv.slice(2);
  try {
    if (command === '--validate') {
      const maxAgeMs = Number(process.env.SEO_PRERENDER_MAX_AGE_MS || DEFAULT_MAX_AGE_MS);
      await loadPrerenderSnapshot(outputPath, { maxAgeMs, expectedSiteBaseUrl: process.env.PUBLIC_SITE_URL || 'https://souqak-yem.com' });
    } else {
      requireValue(command === '--output' && process.argv.length === 4, 'Usage: node scripts/exportPrerenderSnapshot.mjs --output /absolute/new-snapshot.json | --validate /absolute/snapshot.json');
      await exportPrerenderSnapshot(outputPath, { apiBase: process.env.SEO_EXPORT_API_BASE || 'https://api.souqak-yem.com/api', siteBaseUrl: process.env.PUBLIC_SITE_URL || 'https://souqak-yem.com', maxAgeMs: Number(process.env.SEO_PRERENDER_MAX_AGE_MS || DEFAULT_MAX_AGE_MS) });
    }
    console.log('SEO snapshot validated.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
