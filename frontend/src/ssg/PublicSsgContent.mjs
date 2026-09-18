import React from "react";

const e = React.createElement;

const absoluteUrl = (path) => {
  if (!path) return "https://souqak-yem.com/";
  return path.startsWith("http") ? path : `https://souqak-yem.com${path.startsWith("/") ? path : `/${path}`}`;
};

const imageUrl = (image) => {
  if (!image) return "https://souqak-yem.com/logo.png";
  if (image.startsWith("http")) return image;
  return `https://api.souqak-yem.com/uploads/${image.replace(/^\/+/, "").replace(/^uploads\//, "")}`;
};

const formatPrice = (ad) => {
  if (ad?.priceOnContact || ad?.price === undefined || ad?.price === null) return "السعر عند التواصل";
  return `${Number(ad.price).toLocaleString("ar-EG")} ${ad.currency || "ريال يمني"}`;
};

const AdLink = ({ ad }) => {
  if (!ad?._id) return null;
  const slug = ad.slug || ad.title || "ad";
  const href = `/ad/${ad._id}/${slugify(slug)}`;
  return e("li", { key: ad._id }, e("a", { href }, ad.title || "إعلان في سوقك"));
};

const slugify = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^\w\s\u0600-\u06ff-]/g, "")
  .replace(/[\s_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 60)
  .replace(/-+$/, "") || "ad";

export function PublicHomeContent({ categories = [], ads = [] }) {
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("h1", null, "سوقك، سوق اليمن بين يديك"),
    e("h2", null, "بيع واشترِ بكل سهولة وأمان"),
    e("p", null, "سوقك الموثوق لكل ما تحتاجه في اليمن."),
    e("section", { "aria-labelledby": "ssg-home-categories" },
      e("h2", { id: "ssg-home-categories" }, "تصفح حسب الفئة"),
      e("ul", null, categories.map((category) => e("li", { key: category.id || category._id || category.slug },
        e("a", { href: `/category/${category.slug}` }, category.name)
      )))
    ),
    e("section", { "aria-labelledby": "ssg-home-ads" },
      e("h2", { id: "ssg-home-ads" }, "أحدث الإعلانات"),
      e("ul", null, ads.map((ad) => e(AdLink, { key: ad._id, ad })))
    )
  );
}

export function PublicCategoryContent({ category, breadcrumbs = [], subcategories = [], ads = [] }) {
  if (!category) return null;
  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: breadcrumb.url }, breadcrumb.name))
    ),
    e("h1", null, `${category.name} للبيع في اليمن`),
    category.description ? e("p", null, category.description) : null,
    e("section", { "aria-labelledby": "ssg-category-children" },
      e("h2", { id: "ssg-category-children" }, "الأقسام الفرعية"),
      e("ul", null, subcategories.map((subcategory) => e("li", { key: subcategory.id || subcategory._id || subcategory.slug },
        e("a", { href: `/category/${category.slug}?sub=${encodeURIComponent(subcategory.slug)}` }, subcategory.name)
      )))
    ),
    e("section", { "aria-labelledby": "ssg-category-ads" },
      e("h2", { id: "ssg-category-ads" }, "أحدث الإعلانات"),
      e("ul", null, ads.map((ad) => e(AdLink, { key: ad._id, ad })))
    )
  );
}

export function PublicAdContent({ ad, breadcrumbs = [], similarAds = [] }) {
  if (!ad) return null;
  const title = ad.title || "إعلان في سوقك";
  const image = Array.isArray(ad.images) && ad.images.length ? ad.images[0] : null;
  const category = ad.categoryId?.parentId || ad.categoryId;
  const adUrl = `/ad/${ad._id}/${slugify(ad.slug || title)}`;

  return e("main", { className: "ssg-public-content", dir: "rtl" },
    e("nav", { "aria-label": "مسار التنقل" },
      breadcrumbs.map((breadcrumb) => e("a", { key: breadcrumb.url, href: breadcrumb.url }, breadcrumb.name))
    ),
    e("article", null,
      e("h1", null, title),
      image ? e("img", { src: imageUrl(image), alt: title, loading: "eager" }) : null,
      e("p", null, ad.description || `إعلان ${title} في سوقك.`),
      e("p", null, formatPrice(ad)),
      ad.governorateId?.name || ad.cityId?.name ? e("p", null, [ad.governorateId?.name, ad.cityId?.name].filter(Boolean).join("، ")) : null,
      category?.slug ? e("p", null, e("a", { href: `/category/${category.slug}` }, category.name)) : null,
      e("p", null, e("a", { href: adUrl }, "رابط الإعلان")),
      similarAds.length > 0 ? e("section", { "aria-labelledby": "ssg-similar-ads" },
        e("h2", { id: "ssg-similar-ads" }, "إعلانات مشابهة"),
        e("ul", null, similarAds.map((similarAd) => e(AdLink, { key: similarAd._id, ad: similarAd })))
      ) : null
    )
  );
}

export function PublicSsgContent({ kind, data }) {
  if (kind === "home") return e(PublicHomeContent, data);
  if (kind === "category") return e(PublicCategoryContent, data);
  if (kind === "ad") return e(PublicAdContent, data);
  return null;
}
