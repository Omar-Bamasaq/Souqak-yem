import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicSsgContent } from '../src/ssg/PublicSsgContent.mjs';
import { createAdStructuredData, createBreadcrumbList } from '../src/lib/structuredData.js';
import { resolveCanonicalUrl, resolveSiteUrl } from '../src/lib/siteUrl.js';
import { runAtomicPrerender } from './prerenderBuild.mjs';
import { generateFromPrerenderData } from './prerenderData.mjs';
import {
  createPublicPrerenderPlan,
  resolveSiteBaseUrl,
  slugify
} from './prerenderRoutes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
let distDir = path.resolve(process.env.PRERENDER_DIST_DIR || path.join(rootDir, 'dist'));
const siteBase = resolveSiteBaseUrl(process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL);
const apiBase = process.env.VITE_API_URL || 'https://api.souqak-yem.com/api';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');

const htmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

let viteAssets = {
  body: '',
  head: '',
  moduleScripts: ''
};

const readViteAssets = () => {
  const indexFile = path.join(distDir, 'index.html');
  const source = fs.readFileSync(indexFile, 'utf8');
  const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const headMatch = source.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);

  if (!bodyMatch || !headMatch) {
    throw new Error(`Unable to extract Vite app shell from ${indexFile}`);
  }

  const moduleScriptPattern = /<script\b(?=[^>]*\btype\s*=\s*["']module["'])[^>]*>[\s\S]*?<\/script>/gi;
  const moduleScripts = source.match(moduleScriptPattern) || [];
  const headAssets = headMatch[1].match(/<link\b(?=[^>]*\brel\s*=\s*["'](?:stylesheet|modulepreload)["'])[^>]*\/?>/gi) || [];

  viteAssets = {
    body: bodyMatch[1].replace(moduleScriptPattern, '').trim(),
    head: headAssets.join('\n    '),
    moduleScripts: moduleScripts.join('\n    ')
  };
};

const makePageHtml = ({
  title,
  description,
  url,
  canonical,
  image,
  type = 'website',
  jsonLd,
  noIndex = false,
  ssgKind,
  ssgData
}) => {
  const safeTitle = htmlEscape(title || 'سوقك - سوق اليمن للإعلانات والبيع والشراء');
  const safeDescription = htmlEscape(description || 'سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة.');
  const safeCanonical = htmlEscape(resolveCanonicalUrl(canonical || url || siteBase, siteBase));
  const safeUrl = htmlEscape(resolveSiteUrl(url || canonical || siteBase, siteBase));
  const safeImage = htmlEscape(image || `${siteBase}/logo-full.svg`);
  const robots = noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const structured = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : '';
  const serializedSsgData = ssgKind && ssgData
    ? JSON.stringify({ kind: ssgKind, data: ssgData }).replace(/</g, '\\u003c')
    : '';
  const bodyContent = ssgKind && ssgData
    ? renderToStaticMarkup(React.createElement(PublicSsgContent, {
      kind: ssgKind,
      data: ssgData,
      siteBaseUrl: siteBase,
      apiOrigin
    }))
    : viteAssets.body;
  const bodyMarkup = ssgKind && ssgData
    ? `<div id="root" data-ssg="true">${bodyContent}</div>${serializedSsgData ? `<script>window.__SOUQAK_SSG_DATA__=${serializedSsgData};</script>` : ''}`
    : bodyContent;

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta http-equiv="content-language" content="ar" />
    <meta name="theme-color" content="#0b89ed" />
    <meta name="application-name" content="سوقك" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="سوقك" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${safeCanonical}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:site_name" content="سوقك" />
    <meta property="og:locale" content="ar_YE" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:url" content="${safeUrl}" />
    ${structured ? `<script type="application/ld+json">${structured}</script>` : ''}
    ${viteAssets.head}
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" crossorigin="use-credentials" />
  </head>
  <body>
    ${bodyMarkup}
    ${viteAssets.moduleScripts}
  </body>
</html>`;
};

const privateRoutePages = [
  {
    path: '/login',
    title: 'تسجيل الدخول | سوقك',
    description: 'تسجيل الدخول إلى حسابك في سوقك.',
    canonical: '/login',
    noIndex: true
  },
  {
    path: '/register',
    title: 'إنشاء حساب | سوقك',
    description: 'إنشاء حساب جديد في سوقك.',
    canonical: '/register',
    noIndex: true
  },
  {
    path: '/forgot-password',
    title: 'استعادة كلمة المرور | سوقك',
    description: 'استعادة كلمة المرور لحسابك في سوقك.',
    canonical: '/forgot-password',
    noIndex: true
  },
  {
    path: '/verify-email',
    title: 'تأكيد البريد الإلكتروني | سوقك',
    description: 'تأكيد البريد الإلكتروني الخاص بك في سوقك.',
    canonical: '/verify-email',
    noIndex: true
  },
  {
    path: '/admin',
    title: 'لوحة الإدارة | سوقك',
    description: 'لوحة الإدارة الداخلية لسوقك.',
    canonical: '/admin',
    noIndex: true
  },
  {
    path: '/seller',
    title: 'لوحة البائع | سوقك',
    description: 'لوحة البائع الخاصة بك في سوقك.',
    canonical: '/seller',
    noIndex: true
  },
  {
    path: '/messages',
    title: 'الرسائل | سوقك',
    description: 'رسائلك داخل سوقك.',
    canonical: '/messages',
    noIndex: true
  },
  {
    path: '/notifications',
    title: 'الإشعارات | سوقك',
    description: 'الإشعارات الخاصة بك في سوقك.',
    canonical: '/notifications',
    noIndex: true
  },
  {
    path: '/favorites',
    title: 'المفضلة | سوقك',
    description: 'عناصرك المفضلة في سوقك.',
    canonical: '/favorites',
    noIndex: true
  },
  {
    path: '/following',
    title: 'المتابعة | سوقك',
    description: 'المتابعات الخاصة بك في سوقك.',
    canonical: '/following',
    noIndex: true
  },
  {
    path: '/wallet',
    title: 'المحفظة | سوقك',
    description: 'محفظتك الإلكترونية في سوقك.',
    canonical: '/wallet',
    noIndex: true
  },
  {
    path: '/account-settings',
    title: 'إعدادات الحساب | سوقك',
    description: 'إعدادات حسابك الشخصية في سوقك.',
    canonical: '/account-settings',
    noIndex: true
  },
  {
    path: '/my-ads',
    title: 'إعلاناتي | سوقك',
    description: 'قائمة إعلاناتك في سوقك.',
    canonical: '/my-ads',
    noIndex: true
  },
  {
    path: '/orders',
    title: 'الطلبات | سوقك',
    description: 'الطلبات الحالية والسابقة في سوقك.',
    canonical: '/orders',
    noIndex: true
  },
  {
    path: '/chat',
    title: 'الدردشة | سوقك',
    description: 'صفحة الدردشة الخاصة بك في سوقك.',
    canonical: '/chat',
    noIndex: true
  },
  {
    path: '/add-product',
    title: 'إضافة إعلان | سوقك',
    description: 'إضافة إعلان جديد في سوقك.',
    canonical: '/add-product',
    noIndex: true
  },
  {
    path: '/choose-add-type',
    title: 'اختيار نوع الإعلان | سوقك',
    description: 'اختيار نوع الإعلان الذي تريد إضافته في سوقك.',
    canonical: '/choose-add-type',
    noIndex: true
  },
  {
    path: '/commission/pay',
    title: 'دفع العمولة | سوقك',
    description: 'صفحة دفع العمولة داخل سوقك.',
    canonical: '/commission/pay',
    noIndex: true
  }
];

const privateRoutes = privateRoutePages.map((route) => ({
  ...route,
  url: `${siteBase}${route.canonical}`,
  image: `${siteBase}/logo-full.svg`
}));

const MIN_API_REQUEST_INTERVAL_MS = 500;
const ADS_API_REQUEST_INTERVAL_MS = 2500;
const MAX_API_REQUEST_ATTEMPTS = 3;
let lastApiRequestAt = 0;
let lastAdsRequestAt = 0;
let apiRequestQueue = Promise.resolve();

const isAdsApiRequest = (url) => new URL(url, apiBase).pathname.split('/').includes('ads');

const scheduleApiRequest = (url, notBefore = 0) => {
  const scheduledRequest = apiRequestQueue.then(async () => {
    const isAdsRequest = isAdsApiRequest(url);
    const minimumInterval = isAdsRequest ? ADS_API_REQUEST_INTERVAL_MS : MIN_API_REQUEST_INTERVAL_MS;
    const earliestStart = () => Math.max(
      lastApiRequestAt + MIN_API_REQUEST_INTERVAL_MS,
      isAdsRequest ? lastAdsRequestAt + minimumInterval : 0,
      notBefore
    );

    while (earliestStart() > Date.now()) {
      await new Promise((resolve) => setTimeout(resolve, earliestStart() - Date.now()));
    }

    const requestStartedAt = Date.now();
    lastApiRequestAt = requestStartedAt;
    if (isAdsRequest) lastAdsRequestAt = requestStartedAt;
  });
  apiRequestQueue = scheduledRequest.catch(() => {});
  return scheduledRequest;
};

const parseRetryAfter = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
};

const fetchJson = async (url) => {
  let retryNotBefore = 0;

  for (let attempt = 1; attempt <= MAX_API_REQUEST_ATTEMPTS; attempt += 1) {
    await scheduleApiRequest(url, retryNotBefore);
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (response.ok) return response.json();

    if (response.status === 429 && attempt < MAX_API_REQUEST_ATTEMPTS) {
      const errorPayload = await response.clone().json().catch(() => null);
      const retryAfter = response.headers.get('retry-after');
      const retryDelay = parseRetryAfter(retryAfter) ?? parseRetryAfter(errorPayload?.retryAfter);
      retryNotBefore = retryDelay === null ? 0 : Date.now() + retryDelay;
      continue;
    }

    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  throw new Error(`Request failed for ${url} after ${MAX_API_REQUEST_ATTEMPTS} attempts`);
};

const getItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.categories)) return payload.categories;
  return [];
};

const publicImage = (value) => value ? String(value) : null;

const sanitizeCategory = (category) => category && ({
  id: category.id || category._id || null,
  name: category.name || '',
  slug: category.slug || '',
  description: category.description || '',
  image: publicImage(category.image),
  children: Array.isArray(category.children) ? category.children.map(sanitizeCategory) : []
});

const sanitizeAd = (ad) => {
  if (!ad?._id) return null;
  const category = ad.categoryId?.parentId && typeof ad.categoryId.parentId === 'object'
    ? ad.categoryId.parentId
    : ad.categoryId;
  return {
    _id: String(ad._id),
    title: ad.title || '',
    slug: slugify(ad.slug || ad.title) || 'ad',
    description: ad.description || '',
    images: Array.isArray(ad.images) ? ad.images.slice(0, 3).map(publicImage).filter(Boolean) : [],
    price: ad.price,
    priceOnContact: Boolean(ad.priceOnContact),
    currency: ad.currency || 'YER',
    condition: ad.condition || null,
    status: ad.status,
    isVisible: ad.isVisible,
    isDeleted: ad.isDeleted,
    isArchived: ad.isArchived,
    sold: ad.sold,
    isSold: ad.isSold,
    isAvailable: ad.isAvailable,
    adType: ad.adType,
    inventoryEnabled: ad.inventoryEnabled,
    stockQuantity: ad.stockQuantity,
    expiresAt: ad.expiresAt || null,
    categoryId: category ? { name: category.name || '', slug: category.slug || '' } : null,
    governorateId: ad.governorateId?.name ? { name: ad.governorateId.name } : null,
    cityId: ad.cityId?.name ? { name: ad.cityId.name } : null
  };
};

const sanitizeBreadcrumbs = (items) => getItems(items).map((item) => ({
  id: item.id || item._id || null,
  name: item.name || '',
  slug: item.slug || '',
  url: `${siteBase}/category/${encodeURIComponent(item.slug || '')}`
}));

const sanitizeCategorySsgData = (categorySsgData) => ({
  category: sanitizeCategory(categorySsgData.category),
  breadcrumbs: (categorySsgData.breadcrumbs || []).map((item) => ({
    id: item.id || item._id || null,
    name: item.name || '',
    slug: item.slug || '',
    url: item.slug ? `${siteBase}/category/${encodeURIComponent(item.slug)}` : siteBase
  })),
  subcategories: (categorySsgData.subcategories || []).map(sanitizeCategory).filter(Boolean),
  ads: (categorySsgData.ads || []).map(sanitizeAd).filter(Boolean)
});

const resolveUpload = (value) => {
  if (!value) return `${siteBase}/logo-full.svg`;
  if (value.startsWith('http')) return value;
  return `${apiOrigin}/uploads/${value.replace(/^\/+/, '').replace(/^uploads\//, '')}`;
};

const renderAdPage = (ad, ssgData = null, pageUrl) => {
  const image = Array.isArray(ad.images) && ad.images.length ? ad.images[0] : `${siteBase}/logo-full.svg`;
  const imageUrl = resolveUpload(image);
  const title = ad.title || 'إعلان في سوقك';
  const description = (ad.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 160) || `إعلان ${title} في سوقك.`;
  const slug = ad.slug || slugify(ad.title) || 'ad';
  const url = pageUrl || `${siteBase}/ad/${ad._id}/${slug}`;
  const breadcrumbs = buildAdBreadcrumbs(ad, url);
  const jsonLd = createAdStructuredData({
    ad,
    url,
    image: imageUrl,
    breadcrumbs,
    siteBaseUrl: siteBase
  });

  return makePageHtml({
    title: `${title} | سوقك`,
    description,
    url,
    canonical: url,
    image: imageUrl,
    type: 'product',
    jsonLd,
    ...(ssgData ? { ssgKind: 'ad', ssgData } : {})
  });
};

const buildAdBreadcrumbs = (ad, url) => {
  const category = ad.categoryId?.parentId || ad.categoryId;
  return [
    { name: 'الرئيسية', url: siteBase },
    ...(category?.slug ? [{ name: category.name, url: `${siteBase}/category/${category.slug}` }] : []),
    { name: ad.title || 'الإعلان', url }
  ];
};

const writeHtml = (routePath, html) => {
  const targetDir = routePath === '/' ? distDir : path.join(distDir, routePath.replace(/^\//, '').replace(/\/$/, ''));
  const targetFile = routePath === '/' ? path.join(distDir, 'index.html') : path.join(targetDir, 'index.html');
  ensureDir(path.dirname(targetFile));
  fs.writeFileSync(targetFile, html, 'utf8');
};

const loadApiPrerenderData = async () => {
  const categories = getItems(await fetchJson(`${apiBase}/categories/main`));
  const homeAdsResponse = await fetchJson(`${apiBase}/ads?limit=20&page=1&sort=new`);
  const homeAds = getItems(homeAdsResponse);
  if (categories.length !== 22) {
    throw new Error(`Expected 22 public categories, received ${categories.length}`);
  }

  const categorySsgDataBySlug = new Map();
  for (const categorySummary of categories) {
    if (!categorySummary?.slug || !(categorySummary.id || categorySummary._id)) {
      throw new Error('A public category is missing its id or slug');
    }
    const category = await fetchJson(`${apiBase}/categories/${encodeURIComponent(categorySummary.slug)}`);
    const categoryId = category.id || category._id;
    const categoryAdsResponse = await fetchJson(
      `${apiBase}/ads?limit=20&page=1&sort=new&categoryId=${encodeURIComponent(categoryId)}`
    );
    const breadcrumbsResponse = await fetchJson(`${apiBase}/categories/breadcrumbs/${categoryId}`);
    categorySsgDataBySlug.set(category.slug, {
      category: sanitizeCategory(category),
      breadcrumbs: [
        { id: null, name: 'الرئيسية', slug: '', url: siteBase },
        ...sanitizeBreadcrumbs(breadcrumbsResponse)
      ],
      subcategories: (category.children || []).map(sanitizeCategory).filter(Boolean),
      ads: getItems(categoryAdsResponse).map(sanitizeAd).filter(Boolean)
    });
  }

  const adsPageSize = 50;
  const firstPage = await fetchJson(`${apiBase}/ads?limit=${adsPageSize}&page=1&sort=new`);
  const ads = getItems(firstPage);
  const pageCount = Math.min(
    Number(firstPage?.pages) || Math.ceil(Number(firstPage?.total || ads.length) / adsPageSize),
    20
  );
  for (let page = 2; page <= pageCount; page += 1) {
    const nextPage = await fetchJson(`${apiBase}/ads?limit=${adsPageSize}&page=${page}&sort=new`);
    ads.push(...getItems(nextPage));
  }

  return {
    source: 'api',
    categories,
    ads,
    categorySsgDataBySlug,
    homeData: {
      categories: categories.map(sanitizeCategory).filter(Boolean),
      ads: homeAds.map(sanitizeAd).filter(Boolean),
      total: Number(homeAdsResponse?.total) || homeAds.length,
      pages: Number(homeAdsResponse?.pages) || 1
    }
  };
};

const generatePages = async (prerenderData) => {
  ensureDir(distDir);
  readViteAssets();

  const ssgHomeData = {
    ...prerenderData.homeData,
    categories: prerenderData.homeData.categories.map(sanitizeCategory).filter(Boolean),
    ads: prerenderData.homeData.ads.map(sanitizeAd).filter(Boolean)
  };
  const categorySsgEntries = prerenderData.categorySsgDataBySlug instanceof Map
    ? [...prerenderData.categorySsgDataBySlug.entries()]
    : Object.entries(prerenderData.categorySsgDataBySlug);
  const ssgCategoryDataBySlug = new Map(
    categorySsgEntries.map(([slug, data]) => [slug, sanitizeCategorySsgData(data)])
  );

  const staticPages = createPublicPrerenderPlan({ siteBase }).staticPages;
  for (const page of staticPages) {
    const html = makePageHtml({
      title: page.title,
      description: page.description,
      url: `${siteBase}${page.canonical}`,
      canonical: `${siteBase}${page.canonical}`,
      image: `${siteBase}/logo-full.svg`,
      type: 'website',
      ...(page.path === '/' ? { ssgKind: 'home', ssgData: ssgHomeData } : {}),
      ...(page.path === '/refund-escrow' ? { ssgKind: 'refund-escrow', ssgData: {} } : {})
    });
    writeHtml(page.path, html);
  }

  for (const page of privateRoutes) {
    const html = makePageHtml({
      title: page.title,
      description: page.description,
      url: page.url,
      canonical: page.url,
      image: page.image,
      type: 'website',
      noIndex: true
    });
    writeHtml(page.path, html);
  }

  const publicPlan = createPublicPrerenderPlan({
    siteBase,
    categories: prerenderData.categories,
    categorySsgDataBySlug: ssgCategoryDataBySlug,
    ads: prerenderData.ads
  });

  for (const page of publicPlan.categoryPages) {
    const { category } = page;
    const description = category.description || `تصفح إعلانات ${category.name} للبيع والشراء في اليمن عبر سوقك، منصة الإعلانات المبوبة اليمنية.`;
    const breadcrumbList = createBreadcrumbList(page.ssgData.breadcrumbs, siteBase);
    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${category.name} للبيع في اليمن`,
      description: category.description || `إعلانات ${category.name} للبيع والشراء في اليمن.`,
      url: page.url,
      isPartOf: { '@type': 'WebSite', name: 'سوقك', url: siteBase }
    };
    writeHtml(page.path, makePageHtml({
      title: `${category.name} للبيع في اليمن | سوقك`,
      description,
      url: page.url,
      canonical: page.url,
      image: resolveUpload(category.image),
      jsonLd: breadcrumbList
        ? { '@context': 'https://schema.org', '@graph': [collectionSchema, breadcrumbList] }
        : collectionSchema,
      ssgKind: 'category',
      ssgData: page.ssgData
    }));
  }

  const renderedAds = publicPlan.adPages.map(({ ad }) => sanitizeAd(ad));
  if (renderedAds.some((ad) => !ad)) {
    throw new Error('A planned public ad could not be sanitized for prerender.');
  }
  publicPlan.adPages.forEach((page, index) => {
    const ad = renderedAds[index];
    if (ad._id !== String(page.ad._id)) {
      throw new Error(`Prerender ad data does not match route ${page.path}.`);
    }
    const ssgData = {
      ad,
      breadcrumbs: buildAdBreadcrumbs(ad, page.url),
      similarAds: renderedAds.filter((item) => item._id !== ad._id).slice(0, 6)
    };
    writeHtml(page.path, renderAdPage(ad, ssgData, page.url));
  });

  const sitemapUrls = publicPlan.sitemapUrls;
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map((url) => `  <url><loc>${htmlEscape(url)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');

  const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /phone-forgot-password\nDisallow: /set-new-password\nDisallow: /verify-email\nDisallow: /seller\nDisallow: /messages\nDisallow: /notifications\nDisallow: /favorites\nDisallow: /following\nDisallow: /wallet\nDisallow: /account-settings\nDisallow: /my-ads\nDisallow: /orders\nDisallow: /edit-ad\nDisallow: /chat\nDisallow: /add-product\nDisallow: /choose-add-type\nDisallow: /commission/pay\nDisallow: /brokerage\nDisallow: /referrals\nSitemap: ${siteBase}/sitemap.xml\n`;
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf8');

  console.log(`Prerendered ${staticPages.length} static pages, ${publicPlan.categoryPages.length} category pages, and ${publicPlan.adPages.length} ad pages; sitemap contains ${sitemapUrls.length} URLs.`);
};

const main = async () => generateFromPrerenderData({
  dataOptions: { loadApiData: loadApiPrerenderData },
  generate: generatePages
});

runAtomicPrerender({
  distDirectory: distDir,
  generate: async (stagingDirectory) => {
    distDir = stagingDirectory;
    await main();
  }
}).catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});
