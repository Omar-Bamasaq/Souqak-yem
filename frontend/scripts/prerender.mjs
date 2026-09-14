import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicSsgContent } from '../src/ssg/PublicSsgContent.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const siteBase = process.env.PUBLIC_SITE_URL || 'https://souqak-yem.com';
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
  const safeCanonical = htmlEscape(canonical || url || siteBase);
  const safeUrl = htmlEscape(url || canonical || siteBase);
  const safeImage = htmlEscape(image || `${siteBase}/logo-full.svg`);
  const robots = noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const structured = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : '';
  const serializedSsgData = ssgKind && ssgData
    ? JSON.stringify({ kind: ssgKind, data: ssgData }).replace(/</g, '\\u003c')
    : '';
  const bodyContent = ssgKind && ssgData
    ? renderToStaticMarkup(React.createElement(PublicSsgContent, { kind: ssgKind, data: ssgData }))
    : viteAssets.body;
  const bodyMarkup = ssgKind && ssgData
    ? `<div id="root" data-ssg="true">${bodyContent}</div>${serializedSsgData ? `<script>window.__SOUQAK_SSG_DATA__=${serializedSsgData};</script>` : ''}`
    : bodyContent;

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="content-language" content="ar" />
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
    ${structured ? `<script type="application/ld+json">${structured}</script>` : ''}
    ${viteAssets.head}
    <link rel="icon" href="${siteBase}/favicon.ico" type="image/x-icon" />
    <link rel="manifest" href="${siteBase}/manifest.json" />
  </head>
  <body>
    ${bodyMarkup}
    ${viteAssets.moduleScripts}
  </body>
</html>`;
};

const routePages = [
  {
    path: '/',
    title: 'سوقك - سوق اليمن للإعلانات والبيع والشراء',
    description: 'سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة مع ميزة الشراء الآمن، وتتيح لك عرض وشراء السيارات، العقارات، الإلكترونيات والمنتجات والخدمات بسهولة.',
    canonical: '/'
  },
  {
    path: '/categories',
    title: 'الفئات | سوقك',
    description: 'تصفح فئات الإعلانات في سوقك، بما في ذلك السيارات، العقارات، الإلكترونيات، الأثاث والأعمال والخدمات.',
    canonical: '/categories'
  },
  {
    path: '/how-it-works',
    title: 'كيف يعمل سوقك | سوقك',
    description: 'تعرف على طريقة البيع والشراء، والشراء الآمن، وكيفية حماية المستخدمين في سوقك.',
    canonical: '/how-it-works'
  },
  {
    path: '/secure-deal-explanation',
    title: 'الشراء الآمن | سوقك',
    description: 'اكتشف كيف يضمن سوقك سلامة المعاملات والرسوم والإجراءات الأمنية في البيع والشراء.',
    canonical: '/secure-deal-explanation'
  },
  {
    path: '/platform-reviews',
    title: 'آراء المنصة | سوقك',
    description: 'اقرأ تقييمات المستخدمين ومراجعات سوقك لتتأكد من الموثوقية والثقة في المنصة.',
    canonical: '/platform-reviews'
  },
  {
    path: '/pricing',
    title: 'الأسعار والخطط | سوقك',
    description: 'اكتشف خطط سوقك وخدمات الترويج والإعلانات المميزة للأسعار المناسبة.',
    canonical: '/pricing'
  },
  {
    path: '/terms',
    title: 'شروط الاستخدام | سوقك',
    description: 'اقرأ شروط الاستخدام في سوقك والالتزامات والحقوق المتعلقة بالتطبيق.',
    canonical: '/terms'
  },
  {
    path: '/privacy',
    title: 'سياسة الخصوصية | سوقك',
    description: 'تعرف على سياسة الخصوصية وكيفية حماية بيانات المستخدمين في سوقك.',
    canonical: '/privacy'
  }
];

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

const publicRoutes = [];
for (const route of routePages) {
  publicRoutes.push({
    ...route,
    url: `${siteBase}${route.canonical}`,
    image: `${siteBase}/logo-full.svg`
  });
}

const privateRoutes = privateRoutePages.map((route) => ({
  ...route,
  url: `${siteBase}${route.canonical}`,
  image: `${siteBase}/logo-full.svg`
}));

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
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
    slug: ad.slug || slugify(ad.title) || 'ad',
    description: ad.description || '',
    images: Array.isArray(ad.images) ? ad.images.slice(0, 3).map(publicImage).filter(Boolean) : [],
    price: ad.price,
    priceOnContact: Boolean(ad.priceOnContact),
    currency: ad.currency || 'YER',
    condition: ad.condition || null,
    sellerName: ad.userId?.name || ad.seller?.name || ad.user?.name || '',
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

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^\w\s\u0600-\u06ff-]/g, '')
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const resolveUpload = (value) => {
  if (!value) return `${siteBase}/logo-full.svg`;
  if (value.startsWith('http')) return value;
  return `${apiOrigin}/uploads/${value.replace(/^\/+/, '').replace(/^uploads\//, '')}`;
};

const renderAdPage = (ad, ssgData = null) => {
  const image = Array.isArray(ad.images) && ad.images.length ? ad.images[0] : `${siteBase}/logo-full.svg`;
  const imageUrl = resolveUpload(image);
  const title = ad.title || 'إعلان في سوقك';
  const description = (ad.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 160) || `إعلان ${title} في سوقك.`;
  const price = Number(ad.price || 0);
  const currency = ad.currency || 'YER';
  const slug = ad.slug || slugify(ad.title) || 'ad';
  const url = `${siteBase}/ad/${ad._id}/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image: imageUrl,
    url,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      url
    },
    brand: {
      '@type': 'Brand',
      name: 'سوقك'
    }
  };

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

const main = async () => {
  ensureDir(distDir);
  readViteAssets();

  let ssgHomeData = null;
  const ssgCategoryDataBySlug = new Map();
  let ssgAdData = null;
  let ssgAdId = '';

  try {
    const categories = getItems(await fetchJson(`${apiBase}/categories/main`));
    const homeAdsResponse = await fetchJson(`${apiBase}/ads?limit=20&page=1&sort=new`);
    const homeAds = getItems(homeAdsResponse);
    ssgHomeData = {
      categories: categories.map(sanitizeCategory).filter(Boolean),
      ads: homeAds.map(sanitizeAd).filter(Boolean),
      total: Number(homeAdsResponse?.total) || homeAds.length,
      pages: Number(homeAdsResponse?.pages) || 1
    };

    if (categories.length !== 22) {
      throw new Error(`Expected 22 public categories, received ${categories.length}`);
    }

    const categoryAdSets = new Map();
    for (const categorySummary of categories) {
      if (!categorySummary?.slug || !(categorySummary.id || categorySummary._id)) {
        throw new Error('A public category is missing its id or slug');
      }
      const category = await fetchJson(`${apiBase}/categories/${encodeURIComponent(categorySummary.slug)}`);
      const categoryId = category.id || category._id;
      const categoryAdsResponse = await fetchJson(`${apiBase}/ads?limit=20&page=1&sort=new&categoryId=${encodeURIComponent(categoryId)}`);
      const categoryAds = getItems(categoryAdsResponse);
      const breadcrumbsResponse = await fetchJson(`${apiBase}/categories/breadcrumbs/${categoryId}`);
      ssgCategoryDataBySlug.set(category.slug, {
        category: sanitizeCategory(category),
        breadcrumbs: [{ id: null, name: 'الرئيسية', slug: '', url: siteBase }, ...sanitizeBreadcrumbs(breadcrumbsResponse)],
        subcategories: (category.children || []).map(sanitizeCategory).filter(Boolean),
        ads: categoryAds.map(sanitizeAd).filter(Boolean)
      });
      categoryAdSets.set(category.slug, categoryAds);
    }

    const targetCategoryAds = categoryAdSets.get('المركبات') || getItems(await fetchJson(`${apiBase}/ads?limit=20&page=1&sort=new`));
    const targetAd = targetCategoryAds[0] || homeAds[0];
    if (targetAd?._id) {
      const ad = await fetchJson(`${apiBase}/ads/${targetAd._id}`);
      const adSlug = ad.slug || slugify(ad.title) || 'ad';
      const adUrl = `${siteBase}/ad/${ad._id}/${adSlug}`;
      ssgAdId = String(ad._id);
      ssgAdData = {
        ad: sanitizeAd(ad),
        breadcrumbs: buildAdBreadcrumbs(ad, adUrl),
        similarAds: targetCategoryAds
          .filter((item) => String(item._id) !== String(ad._id))
          .slice(0, 6)
          .map(sanitizeAd)
          .filter(Boolean)
      };
    }
  } catch (error) {
    console.error('Required limited SSG data fetch failed:', error.message);
    throw error;
  }

  for (const page of publicRoutes) {
    const html = makePageHtml({
      title: page.title,
      description: page.description,
      url: page.url,
      canonical: page.url,
      image: page.image,
      type: 'website',
      ...(page.path === '/' ? { ssgKind: 'home', ssgData: ssgHomeData } : {})
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

  const categoryUrls = [];
  try {
    const categories = getItems(await fetchJson(`${apiBase}/categories/main`));
    for (const category of categories.filter((item) => item?.slug && item?.name)) {
        const categoryUrl = `${siteBase}/category/${encodeURIComponent(category.slug)}`;
      categoryUrls.push(categoryUrl);
      writeHtml(`/category/${category.slug}`, makePageHtml({
        title: `${category.name} للبيع في اليمن | سوقك`,
        description: category.description || `تصفح إعلانات ${category.name} للبيع والشراء في اليمن عبر سوقك، منصة الإعلانات المبوبة اليمنية.`,
        url: categoryUrl,
        canonical: categoryUrl,
        image: resolveUpload(category.image),
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${category.name} للبيع في اليمن`,
          description: category.description || `إعلانات ${category.name} للبيع والشراء في اليمن.`,
          url: categoryUrl,
          isPartOf: { '@type': 'WebSite', name: 'سوقك', url: siteBase }
        },
        ssgKind: 'category',
        ssgData: ssgCategoryDataBySlug.get(category.slug)
      }));
    }
  } catch (error) {
    console.error('Required category prerender failed:', error.message);
    throw error;
  }

  let adUrls = [];
  try {
    const pageSize = 50;
    const firstPage = await fetchJson(`${apiBase}/ads?limit=${pageSize}&page=1&sort=new`);
    const items = getItems(firstPage);
    const totalPages = Math.min(Number(firstPage?.pages) || Math.ceil(Number(firstPage?.total || items.length) / pageSize), 20);
    for (let page = 2; page <= totalPages; page += 1) {
      const nextPage = await fetchJson(`${apiBase}/ads?limit=${pageSize}&page=${page}&sort=new`);
      items.push(...getItems(nextPage));
    }
    const approved = items.filter((ad) => ad && (!ad.status || ad.status === 'approved') && !ad.isDeleted && !ad.isArchived && !ad.sold && ad.isVisible !== false);
    adUrls = approved.map((ad) => `${siteBase}/ad/${ad._id}/${ad.slug || slugify(ad.title) || 'ad'}`);
    for (const ad of approved.slice(0, 10)) {
      const adSlug = ad.slug || slugify(ad.title) || 'ad';
      const adForRender = String(ad._id) === ssgAdId && ssgAdData?.ad ? ssgAdData.ad : ad;
      writeHtml(`/ad/${ad._id}/${adSlug}`, renderAdPage(adForRender, String(ad._id) === ssgAdId ? ssgAdData : null));
    }
  } catch (error) {
    console.error('Required ad sitemap/prerender fetch failed:', error.message);
    throw error;
  }

  const sitemapUrls = [...publicRoutes.map((page) => page.url), ...categoryUrls, ...adUrls];
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

  console.log(`Prerendered ${publicRoutes.length} static pages, ${categoryUrls.length} category pages, and ${Math.min(adUrls.length, 10)} ad pages; sitemap contains ${sitemapUrls.length} URLs.`);
};

main().catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});
