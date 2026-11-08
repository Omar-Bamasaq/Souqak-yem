import React from 'react';
import { Helmet } from 'react-helmet-async';
import { createBreadcrumbList } from '../lib/structuredData.js';
import { resolveCanonicalUrl, resolveSiteBaseUrl, resolveSiteUrl } from '../lib/siteUrl.js';

const SEO = ({ title, description, image, url, type = 'website', canonicalUrl, indexable = true, breadcrumbs = [], includeSearchAction = false, jsonLd }) => {
  const siteName = 'سوقك';
  const baseUrl = resolveSiteBaseUrl(import.meta.env.PUBLIC_SITE_URL);
  const defaultDescription = 'سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة، مع ميزة الشراء الآمن في السيارات، العقارات، الإلكترونيات والمنتجات والخدمات.';
  const metaDescription = description || defaultDescription;
  const cleanDescription = String(metaDescription).replace(/<[^>]*>?/gm, '').trim().substring(0, 160);

  const safeTitle = title ? title.trim() : 'سوقك - سوق اليمن للإعلانات والبيع والشراء';
  const fullTitle = title
    ? (/\|\s*سوقك\s*$/.test(safeTitle) ? safeTitle : `${safeTitle} | سوقك`)
    : 'سوقك - سوق اليمن للإعلانات والبيع والشراء';
  const metaImage = image ? (image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`) : `${baseUrl}/logo.png`;
  const canonical = resolveCanonicalUrl(canonicalUrl, baseUrl);
  const currentUrl = resolveSiteUrl(url || canonical, baseUrl);
  const robotsContent = indexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow';
  const breadcrumbList = createBreadcrumbList(breadcrumbs, baseUrl);

  const baseJsonLd = {
    '@context': 'https://schema.org',
    '@type': type === 'collection' ? 'CollectionPage' : 'WebSite',
    name: safeTitle,
    description: cleanDescription,
    url: currentUrl,
    image: metaImage,
    alternateName: 'Souqak',
    inLanguage: 'ar-YE',
    publisher: {
      '@type': 'Organization',
      name: 'سوقك',
      alternateName: 'Souqak',
      url: baseUrl,
      logo: `${baseUrl}/logo.png`
    },
    ...(includeSearchAction ? { potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    } } : {})
  };

  const pageJsonLd = jsonLd !== undefined
    ? jsonLd
    : breadcrumbList
      ? {
      '@context': 'https://schema.org',
      '@graph': [
        baseJsonLd,
        breadcrumbList
      ]
    }
      : baseJsonLd;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDescription} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:image:alt" content={safeTitle} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="ar_YE" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={metaImage} />

      {pageJsonLd && <script type="application/ld+json">{JSON.stringify(pageJsonLd).replace(/</g, '\\u003c')}</script>}
    </Helmet>
  );
};

export default SEO;
