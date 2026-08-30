import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const siteBase = process.env.PUBLIC_SITE_URL || 'https://souqak-yem.com';
const apiBase = process.env.VITE_API_URL || 'https://api.souqak-yem.com/api';

const htmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const makePageHtml = ({
  title,
  description,
  url,
  canonical,
  image,
  type = 'website',
  jsonLd,
  noIndex = false
}) => {
  const safeTitle = htmlEscape(title || 'سوقك - سوق اليمن للإعلانات والبيع والشراء');
  const safeDescription = htmlEscape(description || 'سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة.');
  const safeCanonical = htmlEscape(canonical || url || siteBase);
  const safeUrl = htmlEscape(url || canonical || siteBase);
  const safeImage = htmlEscape(image || `${siteBase}/logo-full.svg`);
  const robots = noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const structured = jsonLd ? JSON.stringify(jsonLd).replace(/</g, '\\u003c') : '';

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
    <link rel="icon" href="${siteBase}/favicon.ico" type="image/x-icon" />
    <link rel="manifest" href="${siteBase}/manifest.json" />
  </head>
  <body>
    <main style="max-width: 900px; margin: 40px auto; padding: 24px; font-family: Tahoma, Arial, sans-serif; line-height: 1.7; color: #111827;">
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
      <p><a href="${safeCanonical}">${safeCanonical}</a></p>
    </main>
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

const renderAdPage = (ad) => {
  const image = Array.isArray(ad.images) && ad.images.length ? ad.images[0] : `${siteBase}/logo-full.svg`;
  const imageUrl = image.startsWith('http') ? image : `${siteBase}${image.startsWith('/') ? image : `/${image}`}`;
  const title = ad.title || 'إعلان في سوقك';
  const description = (ad.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 160) || `إعلان ${title} في سوقك.`;
  const price = Number(ad.price || 0);
  const currency = ad.currency || 'YER';
  const url = `${siteBase}/ad/${ad._id}${ad.slug ? `/${ad.slug}` : ''}`;

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
    jsonLd
  });
};

const writeHtml = (routePath, html) => {
  const targetDir = routePath === '/' ? distDir : path.join(distDir, routePath.replace(/^\//, '').replace(/\/$/, ''));
  const targetFile = routePath === '/' ? path.join(distDir, 'index.html') : path.join(targetDir, 'index.html');
  ensureDir(path.dirname(targetFile));
  fs.writeFileSync(targetFile, html, 'utf8');
};

const main = async () => {
  ensureDir(distDir);

  for (const page of publicRoutes) {
    const html = makePageHtml({
      title: page.title,
      description: page.description,
      url: page.url,
      canonical: page.url,
      image: page.image,
      type: 'website'
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

  let adUrls = [];
  try {
    const list = await fetchJson(`${apiBase}/ads?limit=12&sort=new`);
    const items = Array.isArray(list?.items) ? list.items : Array.isArray(list) ? list : [];
    const approved = items.filter((ad) => ad && ad.status === 'approved' && !ad.isDeleted && !ad.isArchived && !ad.sold && ad.isVisible !== false);
    for (const ad of approved.slice(0, 10)) {
      const adUrl = `${siteBase}/ad/${ad._id}${ad.slug ? `/${ad.slug}` : ''}`;
      adUrls.push(adUrl);
      writeHtml(`/ad/${ad._id}${ad.slug ? `/${ad.slug}` : ''}`, renderAdPage(ad));
    }
  } catch (error) {
    console.warn('Prerender ad fetch skipped:', error.message);
  }

  const sitemapUrls = [...publicRoutes.map((page) => page.url), ...adUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map((url) => `  <url><loc>${htmlEscape(url)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');

  const robotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /verify-email\nDisallow: /seller\nDisallow: /messages\nDisallow: /notifications\nDisallow: /favorites\nDisallow: /following\nDisallow: /wallet\nDisallow: /account-settings\nDisallow: /my-ads\nDisallow: /orders\nDisallow: /chat\nDisallow: /add-product\nDisallow: /choose-add-type\nDisallow: /commission/pay\nSitemap: ${siteBase}/sitemap.xml\n`;
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf8');

  console.log(`Prerendered ${publicRoutes.length} static pages and ${adUrls.length} ad pages.`);
};

main().catch((error) => {
  console.error('Prerender failed:', error);
  process.exit(1);
});
