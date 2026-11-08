import React from "react";
import ProductCard from "./ProductCard.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { getStoreTemplateConfig } from "../utils/storeTemplates.js";

function TemplateIntro({ store, templateKey, total, sectionBackgroundColor, advanced, storefrontTextColor }) {
  const config = getStoreTemplateConfig(templateKey);
  if (config.intro) {
    const intro = config.intro;
    return (
      <section className={`rounded-2xl border p-5 sm:p-7 ${intro.accent}`} style={sectionBackgroundColor ? { background: sectionBackgroundColor } : undefined}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black">{intro.eyebrow}</p>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${intro.chip}`}>
            <span>{intro.icon}</span> {intro.label}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl" style={advanced ? { color: advanced.secondaryColor } : undefined}>{intro.title} · {store.storeName}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{store.description || intro.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className="rounded-lg bg-white/80 px-2.5 py-2">{intro.highlight}</span>
              <a href="#products" className="rounded-lg bg-white/90 px-3 py-2" style={advanced ? { backgroundColor: advanced.primaryColor, color: storefrontTextColor } : undefined}>{intro.buttonLabel}</a>
            </div>
          </div>
          <span className="rounded-lg bg-white/80 px-3 py-2 text-xs font-black">{total} منتج</span>
        </div>
      </section>
    );
  }

  if (["family-food", "family-handicrafts", "family-tailoring"].includes(templateKey)) {
    const familyStyle = templateKey === "family-food"
      ? "border-orange-200 bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-100 text-orange-900"
      : templateKey === "family-handicrafts"
        ? "border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-pink-50 to-violet-100 text-fuchsia-900"
        : "border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-100 text-teal-900";
    return (
      <section className={`rounded-2xl border p-5 sm:p-7 ${familyStyle}`} style={sectionBackgroundColor ? { background: sectionBackgroundColor } : undefined}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black">صناعات سوقك · أسرة منتجة</p>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black ${config.chip}`}>
            <span>{config.icon}</span> {config.label}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl" style={advanced ? { color: advanced.secondaryColor } : undefined}>{store.storeName}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{store.description || store.businessActivity}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-black">
              <span className="rounded-lg bg-white/80 px-2.5 py-2 text-orange-900">{config.highlight}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black">
            <span className="rounded-lg bg-white/80 px-3 py-2">{total} منتج</span>
          </div>
        </div>
      </section>
    );
  }

  if (templateKey === "vehicle-dealer") {
    return (
      <section className="grid gap-4 overflow-hidden rounded-2xl bg-slate-950 text-white sm:grid-cols-[1fr_auto] sm:items-center" style={sectionBackgroundColor ? { background: sectionBackgroundColor } : undefined}>
        <div className="space-y-3 p-5 sm:p-7">
          <p className="text-xs font-black text-emerald-300">معرض سيارات</p>
          <h2 className="text-2xl font-black sm:text-3xl" style={advanced ? { color: advanced.secondaryColor } : undefined}>سيارات {store.storeName}</h2>
          <p className="max-w-xl text-sm leading-6 text-slate-300">{store.location || "تواصل مع المعرض لمعرفة التفاصيل وموقعه."}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white">{total} إعلان</span>
            <a href="#products" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950" style={advanced ? { backgroundColor: advanced.primaryColor, color: storefrontTextColor } : undefined}>عرض السيارات</a>
          </div>
        </div>
      </section>
    );
  }

  if (templateKey === "furniture-store") {
    return (
      <section className="grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-7" style={sectionBackgroundColor ? { background: sectionBackgroundColor } : undefined}>
        <div className="space-y-2">
          <p className="text-xs font-black text-amber-800">أقسام وأثاث المتجر</p>
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl" style={advanced ? { color: advanced.secondaryColor } : undefined}>اختَر ما يناسب منزلك</h2>
          <p className="text-sm leading-6 text-slate-600">{store.description || store.businessActivity || store.storeName}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-amber-900">{total} منتج</span>
            <a href="#products" className="inline-flex min-h-11 items-center rounded-lg bg-amber-800 px-4 py-2 text-sm font-black text-white" style={advanced ? { backgroundColor: advanced.primaryColor, color: storefrontTextColor } : undefined}>تصفح الأثاث</a>
          </div>
        </div>
      </section>
    );
  }

  if (templateKey === "electronics-retail") {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" style={sectionBackgroundColor ? { background: sectionBackgroundColor } : undefined}>
        <div>
          <p className="text-xs font-black text-sky-800">جوالات وإلكترونيات</p>
          <h2 className="mt-1 text-xl font-black text-slate-900" style={advanced ? { color: advanced.secondaryColor } : undefined}>أجهزة وملحقات {store.storeName}</h2>
          <p className="mt-1 text-sm text-slate-600">{store.location || store.businessActivity || "تصفح الأجهزة المتاحة في المتجر."}</p>
        </div>
        <a href="#store-product-search" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-sky-800 px-4 py-2 text-sm font-black text-white" style={advanced ? { backgroundColor: advanced.primaryColor, color: storefrontTextColor } : undefined}>ابحث عن جهاز</a>
      </section>
    );
  }

  return null;
}

export default function StoreTemplateRenderer({
  store,
  ads,
  total,
  pages,
  page,
  productView = "products",
  categoryOptions,
  selectedCategory,
  storeSearch,
  templateKey,
  storefrontColor,
  storefrontTextColor,
  onSelectCategory,
  onSearchChange,
  onPageChange,
  onProductViewChange,
  onAddToCart
}) {
  const config = getStoreTemplateConfig(templateKey);
  const presentationVariant = config.presentationVariant;
  const advanced = store?.advancedCustomizationEnabled ? store.advancedCustomization : null;
  const sectionOrder = advanced?.sectionOrder || ["intro", "products"];
  const hiddenSections = advanced?.hiddenSections || [];
  const featuredProducts = advanced?.featuredProducts || [];
  const sectionBackgroundColor = advanced?.sectionBackgroundColor;
  const productCardBackgroundColor = advanced?.productCardBackgroundColor;
  const storeCardColors = advanced ? {
    backgroundColor: productCardBackgroundColor || "#ffffff",
    accentColor: advanced.primaryColor || storefrontColor,
    secondaryColor: advanced.secondaryColor || "#0f172a"
  } : null;
  const buttonTargets = { products: "#products", story: "#story", contact: "#store-contact" };

  const catalog = (
    <section key="products" id="products" className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${presentationVariant === "automotive" ? "border-t-4 border-t-emerald-700" : ""}`} style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` } : undefined}>
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800" style={sectionBackgroundColor ? { backgroundColor: `${storefrontColor}12` } : undefined}>
        <button
          type="button"
          aria-pressed={productView === "products"}
          onClick={() => onProductViewChange("products")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-black transition ${productView === "products" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70"}`}
          style={productView === "products" ? { color: storefrontColor, ...(sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor } : {}) } : undefined}
        >
          المنتجات
        </button>
        <button
          type="button"
          aria-pressed={productView === "discounts"}
          onClick={() => onProductViewChange("discounts")}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-black transition ${productView === "discounts" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70"}`}
          style={productView === "discounts" ? { color: storefrontColor, ...(sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor } : {}) } : undefined}
        >
          العروض والتخفيضات
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-black" style={{ color: storefrontColor }}>{config.categoryLabel}</p>
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl" style={advanced ? { color: advanced.secondaryColor } : undefined}>{productView === "discounts" ? "العروض والتخفيضات" : config.catalogTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{productView === "discounts" ? "منتجات هذا المتجر التي عليها خصم حاليًا." : config.catalogDescription}</p>
        </div>
        <span className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-black sm:text-sm" style={{ backgroundColor: `${storefrontColor}18`, color: storefrontColor }}>{total} {productView === "discounts" ? "عرض" : "منتج"}</span>
      </div>

      {categoryOptions.length > 0 && (
        <div className={`mt-5 border-b border-slate-100 pb-4 ${presentationVariant === "automotive" ? "bg-slate-50 p-3" : ""}`} style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}33` } : undefined}>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={config.categoryLabel}>
            <button type="button" onClick={() => onSelectCategory("all")} className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${selectedCategory === "all" ? "border-transparent" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} style={selectedCategory === "all" ? { backgroundColor: storefrontColor, color: storefrontTextColor } : sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` } : undefined}>الكل</button>
            {categoryOptions.map((category) => (
              <button key={category.id} type="button" onClick={() => onSelectCategory(category.id)} className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${selectedCategory === category.id ? "border-transparent" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} style={selectedCategory === category.id ? { backgroundColor: storefrontColor, color: storefrontTextColor } : sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` } : undefined}>{category.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className={`mt-4 ${presentationVariant === "consumer-electronics" ? "max-w-2xl" : ""}`}>
        <label htmlFor="store-product-search" className="mb-2 block text-sm font-bold text-slate-700">{config.searchLabel}</label>
        <input id="store-product-search" type="search" value={storeSearch} onChange={(event) => onSearchChange(event.target.value)} placeholder={config.searchPlaceholder} className="min-h-12 w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:bg-white focus:ring-2" style={{ backgroundColor: sectionBackgroundColor || undefined, borderColor: `${storefrontColor}55`, "--tw-ring-color": `${storefrontColor}33` }} />
      </div>

      {ads.length === 0 ? (
        <div className={`mt-5 rounded-xl border border-dashed p-8 text-center ${presentationVariant === "automotive" ? "border-emerald-200 bg-emerald-50" : presentationVariant === "home-furnishings" ? "border-amber-200 bg-amber-50" : presentationVariant === "consumer-electronics" ? "border-sky-200 bg-sky-50" : "border-slate-300 bg-slate-50"}`} style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}55` } : undefined}>
          <h3 className="text-lg font-black text-slate-800">{productView === "discounts" ? "لا توجد عروض أو تخفيضات حاليًا" : config.emptyTitle}</h3>
          <p className="mt-2 text-sm text-slate-600">{productView === "discounts" ? "لم يضف هذا المتجر منتجات مخفّضة في الوقت الحالي." : config.emptyDescription}</p>
          {(selectedCategory !== "all" || storeSearch) && <button type="button" onClick={() => { onSelectCategory("all"); onSearchChange(""); }} className="mt-4 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700" style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor } : undefined}>عرض كل المنتجات</button>}
        </div>
      ) : (
        <div className={`mt-5 grid gap-3 sm:gap-4 ${config.gridClassName}`}>
          {ads.map((ad) => <ProductCard key={ad._id} product={ad} to={`/ad/${ad._id}`} featured={!!ad.featured} presentationVariant={presentationVariant} presentationBadge={config.productBadge} storefrontCardColors={storeCardColors} onAddToCart={onAddToCart} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40" style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor } : undefined}>السابق</button>
          <span className="px-3 py-2 text-sm font-bold text-slate-500">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40" style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor } : undefined}>التالي</button>
        </div>
      )}
    </section>
  );

  const sections = {
    intro: <TemplateIntro key="intro" store={store} templateKey={templateKey} total={total} sectionBackgroundColor={sectionBackgroundColor} advanced={advanced} storefrontTextColor={storefrontTextColor} />,
    hero: advanced?.hero && (advanced.hero.title || advanced.hero.text || advanced.hero.image) ? (
      <section key="hero" id="hero" className="grid gap-3 overflow-hidden rounded-2xl border p-3 sm:grid-cols-2 sm:items-center sm:gap-4 sm:p-6" style={{ backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` }}>
        <div className="space-y-2 sm:space-y-3">
          {advanced.hero.title && <h2 className="text-xl font-black sm:text-2xl" style={{ color: advanced.secondaryColor || "#0f172a" }}>{advanced.hero.title}</h2>}
          {advanced.hero.text && <p className="text-sm leading-6 text-slate-600 sm:leading-7">{advanced.hero.text}</p>}
          {advanced.hero.buttonLabel && <a href={buttonTargets[advanced.hero.buttonTarget] || "#products"} className="inline-flex min-h-11 items-center rounded-xl px-5 py-3 text-sm font-black" style={{ backgroundColor: storefrontColor, color: storefrontTextColor }}>{advanced.hero.buttonLabel}</a>}
        </div>
        {advanced.hero.image && <img src={uploadsUrl(advanced.hero.image)} alt={advanced.hero.title || `واجهة ${store.storeName}`} loading="lazy" className="h-36 w-full rounded-xl object-cover sm:h-auto sm:max-h-72" />}
      </section>
    ) : null,
    story: advanced?.story && (advanced.story.text || advanced.story.images?.length) ? (
      <section key="story" id="story" className="rounded-2xl border p-3 sm:p-6" style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` } : undefined}>
        <h2 className="text-lg font-black sm:text-xl" style={{ color: advanced.secondaryColor || "#0f172a" }}>قصتنا</h2>
        {advanced.story.text && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 sm:mt-3 sm:leading-7">{advanced.story.text}</p>}
        {!!advanced.story.images?.length && (
          <div className="-mx-3 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-4 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
            {advanced.story.images.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={uploadsUrl(image)}
                alt={`من قصة ${store.storeName}، صورة ${index + 1}`}
                loading="lazy"
                className="h-28 w-[72%] max-w-56 shrink-0 snap-start rounded-xl object-cover sm:h-44 sm:w-full sm:max-w-none"
              />
            ))}
          </div>
        )}
      </section>
    ) : null,
    featuredProducts: productView === "products" && featuredProducts.length ? (
      <section key="featuredProducts" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" style={sectionBackgroundColor ? { backgroundColor: sectionBackgroundColor, borderColor: `${storefrontColor}44` } : undefined}>
        <h2 className="mb-4 text-xl font-black" style={{ color: advanced?.secondaryColor || "#0f172a" }}>منتجات مميزة</h2>
        <div className={`grid gap-3 sm:gap-4 ${config.gridClassName}`}>
          {featuredProducts.map((product) => <ProductCard key={product._id} product={product} to={`/ad/${product._id}`} featured presentationVariant={presentationVariant} presentationBadge={config.productBadge} storefrontCardColors={storeCardColors} onAddToCart={onAddToCart} />)}
        </div>
      </section>
    ) : null,
    products: catalog
  };

  return (
    <div
      className="space-y-5 rounded-[2rem] p-3 sm:p-5"
      style={advanced ? { backgroundColor: advanced.pageBackgroundColor || "#f1f5f9" } : undefined}
    >
      {sectionOrder.filter((key) => !hiddenSections.includes(key)).map((key) => sections[key] || null)}
    </div>
  );
}