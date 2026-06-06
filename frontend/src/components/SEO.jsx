import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, image, url, type = 'website', price, currency }) => {
  const siteName = 'سوقك - منصتك الأولى للتجارة الإلكترونية في اليمن';
  const fullTitle = title ? `${title} | سوقك` : siteName;
  const defaultDescription = 'اكتشف آلاف الإعلانات في السيارات، العقارات، الإلكترونيات، والمزيد في اليمن. بيع واشتري بكل سهولة وأمان.';
  const metaDescription = description || defaultDescription;
  
  // Clean up description (remove HTML tags and limit length)
  const cleanDescription = metaDescription.replace(/<[^>]*>?/gm, '').substring(0, 160);

  const domain = window.location.origin;
  const metaImage = image ? (image.startsWith('http') ? image : `${domain}${image}`) : `${domain}/favicon.svg`;
  const metaUrl = url ? (url.startsWith('http') ? url : `${domain}${url}`) : window.location.href;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDescription} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:site_name" content="سوقك" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={metaUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={metaImage} />

      {/* Product Specific (if applicable) */}
      {price && <meta property="product:price:amount" content={price} />}
      {currency && <meta property="product:price:currency" content={currency} />}
      
      {/* Arabic Support */}
      <meta property="og:locale" content="ar_AR" />

      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": type === "product" ? "Product" : "WebSite",
          name: fullTitle,
          description: cleanDescription,
          url: metaUrl,
          image: metaImage,
          ...(type === "product" && price ? {
            offers: {
              "@type": "Offer",
              price: price,
              priceCurrency: currency || "YER",
              availability: "https://schema.org/InStock"
            }
          } : {})
        })}
      </script>
    </Helmet>
  );
};

export default SEO;
