import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, image, url, type = 'website', price, currency, canonicalUrl, indexable = true }) => {
  const siteName = 'سوقك';
  const baseUrl = 'https://souqak-yem.com';
  const defaultDescription = 'سوقك هو منصة يمنية موثوقة للبيع والشراء والإعلانات المبوبة، مع ميزة الشراء الآمن في السيارات، العقارات، الإلكترونيات والمنتجات والخدمات.';
  const metaDescription = description || defaultDescription;
  const cleanDescription = String(metaDescription).replace(/<[^>]*>?/gm, '').trim().substring(0, 160);

  const safeTitle = title ? title.trim() : 'سوقك - سوق اليمن للإعلانات والبيع والشراء';
  const fullTitle = title ? `${safeTitle} | سوقك` : 'سوقك - سوق اليمن للإعلانات والبيع والشراء';
  const metaImage = image ? (image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`) : `${baseUrl}/logo.png`;
  const canonical = canonicalUrl ? (canonicalUrl.startsWith('http') ? canonicalUrl : `${baseUrl}${canonicalUrl.startsWith('/') ? canonicalUrl : `/${canonicalUrl}`}`) : `${baseUrl}/`;
  const currentUrl = url ? (url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`) : canonical;
  const robotsContent = indexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,nofollow';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type === 'product' ? 'Product' : 'WebSite',
    name: safeTitle,
    description: cleanDescription,
    url: currentUrl,
    image: metaImage,
    ...(type === 'product' && price ? {
      offers: {
        '@type': 'Offer',
        price: Number(price) || 0,
        priceCurrency: currency || 'YER',
        availability: 'https://schema.org/InStock'
      }
    } : {}),
    ...(type !== 'product' ? {
      alternateName: 'Souqak',
      inLanguage: 'ar-YE',
      publisher: {
        '@type': 'Organization',
        name: 'سوقك',
        alternateName: 'Souqak',
        url: baseUrl,
        logo: `${baseUrl}/logo.png`
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    } : {})
  };

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

      {price && <meta property="product:price:amount" content={String(price)} />}
      {currency && <meta property="product:price:currency" content={currency} />}

      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
};

export default SEO;
