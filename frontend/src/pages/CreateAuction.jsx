import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { prepareFilesForUpload } from "../lib/imageCompression.js";
import { uploadsUrl } from "../lib/uploads.js";
import { isUserVerificationCurrent } from "../lib/userVerification.js";
import {
  auctionDeliveryMethodLabel,
  formatAuctionMoney,
  getAuctionError,
  unpackList
} from "../utils/auctionFormat.js";

const AUCTION_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export default function CreateAuction() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auctionId = searchParams.get("id") || "";
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryRequirements, setCategoryRequirements] = useState({
    type: "general",
    supported: false,
    publicListingEnabled: false,
    fields: [],
    requiredImageLabels: [],
    optionalImageLabels: [],
    documentsRequired: 0,
    documentTypes: []
  });
  const [categoryDetails, setCategoryDetails] = useState({});
  const [documentFiles, setDocumentFiles] = useState({});
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [acknowledgment, setAcknowledgment] = useState("");
  const [durationOptions, setDurationOptions] = useState([]);
  const [existingAuction, setExistingAuction] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingCategoryRequirements, setLoadingCategoryRequirements] = useState(false);
  const [loadingAuction, setLoadingAuction] = useState(Boolean(auctionId));
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [draftId, setDraftId] = useState("");
  const [previewAuction, setPreviewAuction] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/auctions/categories"),
      api.get("/governorates", { params: { active: true } }),
      api.get("/auctions/submission-requirements")
    ])
      .then(([categoryResponse, governorateResponse, requirementsResponse]) => {
        if (!active) return;
        setCategories(unpackList(categoryResponse.data));
        setGovernorates(unpackList(governorateResponse.data));
        setAcknowledgment(requirementsResponse.data.acknowledgment.text);
        setDurationOptions(requirementsResponse.data.durationOptions);
      })
      .catch((requestError) => {
        if (active) setError(getAuctionError(requestError));
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!auctionId) return;
    let active = true;
    api
      .get(`/auctions/mine/${auctionId}`)
      .then(async (response) => {
        if (!active) return;
        const auction = response.data.auction;
        let availableCities = [];
        if (auction.governorateId) {
          const citiesResponse = await api.get("/cities", {
            params: { governorateId: auction.governorateId, active: true }
          });
          availableCities = unpackList(citiesResponse.data);
        }
        if (active) {
          setCities(availableCities);
          setExistingAuction(auction);
          setDraftId(auction.id);
          setSelectedCategoryId(auction.categoryId);
          setCategoryDetails(auction.categoryDetails || {});
        }
      })
      .catch((requestError) => {
        if (active) setError(getAuctionError(requestError));
      })
      .finally(() => {
        if (active) setLoadingAuction(false);
      });
    return () => {
      active = false;
    };
  }, [api, auctionId]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryRequirements({
        type: "general",
        supported: false,
        publicListingEnabled: false,
        fields: [],
        requiredImageLabels: [],
        optionalImageLabels: [],
        documentsRequired: 0,
        documentTypes: []
      });
      setLoadingCategoryRequirements(false);
      return;
    }
    let active = true;
    setLoadingCategoryRequirements(true);
    api.get("/auctions/category-requirements", {
      params: { categoryId: selectedCategoryId }
    }).then((response) => {
      if (active) {
        const requirements = response.data.requirements;
        setCategoryRequirements(requirements);
      }
    }).catch((requestError) => {
      if (active) {
        setCategoryRequirements((requirements) => ({ ...requirements, supported: false }));
        setError(getAuctionError(requestError));
      }
    }).finally(() => {
      if (active) setLoadingCategoryRequirements(false);
    });
    return () => {
      active = false;
    };
  }, [api, selectedCategoryId]);

  const updateCategoryDetail = (field, value) => {
    setCategoryDetails((details) => {
      const nextDetails = { ...details, [field.key]: value };
      for (const dependentField of categoryRequirements.fields) {
        if (dependentField.visibleWhen &&
          !isAuctionFieldVisible(dependentField, nextDetails)) {
          delete nextDetails[dependentField.key];
        }
      }
      return nextDetails;
    });
  };

  const selectGovernorate = async (event) => {
    const governorateId = event.target.value;
    setCities([]);
    if (!governorateId) return;
    try {
      const response = await api.get("/cities", {
        params: { governorateId, active: true }
      });
      setCities(unpackList(response.data));
    } catch (requestError) {
      setError(getAuctionError(requestError));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    setUploadProgress(null);
    try {
      const form = new FormData(event.currentTarget);
      let selectedImages = [];
      let imageLabels = existingAuction?.imageLabels || [];
      if (categoryRequirements.requiredImageLabels.length ||
        categoryRequirements.optionalImageLabels.length) {
        selectedImages = [];
        const uploadedImageLabels = [];
        for (const label of [
          ...categoryRequirements.requiredImageLabels,
          ...categoryRequirements.optionalImageLabels
        ]) {
          const file = form.get(`image_${label}`);
          form.delete(`image_${label}`);
          if (file instanceof File && file.size > 0) {
            selectedImages.push(file);
            uploadedImageLabels.push(label);
          }
        }
        if (selectedImages.length > 0) imageLabels = uploadedImageLabels;
        form.delete("images");
      } else {
        selectedImages = form
          .getAll("images")
          .filter((file) => file instanceof File && file.size > 0);
        form.delete("images");
      }
      if (selectedImages.length > 10) {
        throw new Error("يمكن رفع 10 صور كحد أقصى للمزاد.");
      }
      if (selectedImages.length > 0) {
        const preparedImages = await prepareFilesForUpload(selectedImages);
        form.delete("images");
        preparedImages.forEach((file) => form.append("images", file, file.name));
      }
      for (const field of categoryRequirements.fields) {
        form.delete(`category_${field.key}`);
      }
      form.set("categoryDetails", JSON.stringify(categoryDetails));
      form.set("imageLabels", JSON.stringify(imageLabels));
      const editingId = existingAuction?.id || auctionId;
      const requestConfig = {
        timeout: AUCTION_UPLOAD_TIMEOUT_MS,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
          }
        }
      };
      const saveResponse = editingId
        ? await api.patch(`/auctions/${editingId}`, form, requestConfig)
        : await api.post("/auctions", form, requestConfig);
      const createdId = saveResponse.data.auction.id;
      setDraftId(createdId);
      const detailResponse = await api.get(`/auctions/mine/${createdId}`);
      setExistingAuction(detailResponse.data.auction);
      setPreviewAuction(detailResponse.data.auction);
      setAcknowledged(false);
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const submitForReview = async () => {
    if (!previewAuction || !acknowledged) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/auctions/${draftId}/submit`, { accepted: true });
      navigate("/my-auctions", { replace: true });
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadCategoryDocument = async (event, requirement) => {
    event.preventDefault();
    const documentFile = documentFiles[requirement.key];
    if (!draftId || !documentFile) return;
    setError("");
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("type", requirement.key);
      form.set("document", documentFile);
      await api.post(`/auctions/${draftId}/documents`, form);
      const detailResponse = await api.get(`/auctions/mine/${draftId}`);
      setExistingAuction(detailResponse.data.auction);
      setPreviewAuction(detailResponse.data.auction);
      setDocumentFiles((files) => ({ ...files, [requirement.key]: null }));
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section dir="rtl" className="mx-auto max-w-3xl space-y-5">
      <header className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{existingAuction ? "تعديل مسودة المزاد" : "إنشاء مزاد"}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          أدخل بيانات السلعة بدقة. سيظهر المزاد للناس بعد مراجعة الإدارة.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>
      )}

      {!isUserVerificationCurrent(user) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-lg font-black text-amber-950 dark:text-amber-100">
            يلزم توثيق الحساب قبل إنشاء المزاد
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
            يجب أن يكون حسابك موثقًا وساري التوثيق قبل تعبئة نموذج إنشاء المزاد.
          </p>
          <Link
            to="/seller/verification"
            className="mt-4 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800"
          >
            الانتقال إلى صفحة توثيق الحساب
          </Link>
        </div>
      ) : loadingAuction ? (
        <p className="py-8 text-center text-sm text-slate-500">جارٍ تحميل بيانات المزاد…</p>
      ) : previewAuction ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-black">معاينة المزاد قبل الإرسال</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">راجع المعلومات والصور كما ستظهر للمشترين.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(previewAuction.images || []).map((image, index) => (
              <figure key={`${image}-${index}`} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                <img src={uploadsUrl(image, "med")} alt={`${previewAuction.title} - ${index + 1}`} className="h-48 w-full object-contain" />
                <figcaption className="pt-1 text-xs text-slate-600">{imageLabelText(previewAuction.imageLabels?.[index])}</figcaption>
              </figure>
            ))}
          </div>
          <h3 className="text-2xl font-black">{previewAuction.title}</h3>
          <p className="whitespace-pre-wrap text-sm leading-7">{previewAuction.description}</p>
          <dl className="grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2">
            <div><dt className="text-slate-500">الفئة</dt><dd className="font-bold">{previewAuction.category?.name || "—"}</dd></div>
            <div><dt className="text-slate-500">الموقع</dt><dd className="font-bold">{[previewAuction.city?.name, previewAuction.governorate?.name].filter(Boolean).join("، ") || "—"}</dd></div>
            <div><dt className="text-slate-500">السعر الابتدائي</dt><dd className="font-bold">{formatAuctionMoney(previewAuction.startingPrice, previewAuction.currency)}</dd></div>
            <div><dt className="text-slate-500">الحد الأدنى للزيادة</dt><dd className="font-bold">{formatAuctionMoney(previewAuction.minimumIncrement, previewAuction.currency)}</dd></div>
            <div><dt className="text-slate-500">مدة المزاد</dt><dd className="font-bold">{previewAuction.durationLabel}</dd></div>
            <div className="sm:col-span-2 text-slate-600 dark:text-slate-300">تبدأ المدة من وقت موافقة الإدارة؛ وسيُحدد وقت البداية والنهاية عند الموافقة.</div>
            <div><dt className="text-slate-500">حالة السلعة</dt><dd className="whitespace-pre-wrap font-bold">{previewAuction.itemCondition}</dd></div>
            <div><dt className="text-slate-500">العيوب والملاحظات</dt><dd className="whitespace-pre-wrap font-bold">{previewAuction.defectsNotes}</dd></div>
            <div><dt className="text-slate-500">طريقة التسليم والاستلام</dt><dd className="font-bold">{auctionDeliveryMethodLabel(previewAuction.deliveryMethod)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">تفاصيل التسليم والاستلام</dt><dd className="whitespace-pre-wrap font-bold">{previewAuction.deliveryDetails}</dd></div>
          </dl>
          {categoryRequirements.fields.some((field) =>
            field.public !== false && isAuctionFieldVisible(field, previewAuction.categoryDetails || {})
          ) && (
            <dl className="grid gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800 sm:grid-cols-2">
              {categoryRequirements.fields.filter((field) =>
                field.public !== false &&
                isAuctionFieldVisible(field, previewAuction.categoryDetails || {})
              ).map((field) => (
                <div key={field.key}>
                  <dt className="text-slate-500">{field.label}</dt>
                  <dd className="whitespace-pre-wrap font-bold">{String(previewAuction.categoryDetails?.[field.key] ?? "—")}</dd>
                </div>
              ))}
            </dl>
          )}
          {categoryRequirements.documentTypes.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div>
                <h3 className="font-bold">{categoryRequirements.type === "vehicle" ? "وثائق المركبة" : "وثائق العقار"}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  الوثائق خاصة ولا تظهر للمشترين، وتستخدم فقط لمراجعة المزاد والتحقق من بيانات السلعة. رفعها لا يعني اعتماد صحتها أو إثبات الملكية.
                </p>
              </div>
              {categoryRequirements.documentTypes.map((requirement) => {
                const document = previewAuction.categoryDocuments?.items?.find(
                  (item) => item.type === requirement.key && item.isCurrent !== false
                );
                const canReplace = previewAuction.reviewStatus !== "pending" &&
                  ["draft", "rejected"].includes(previewAuction.status);
                return (
                  <form
                    key={requirement.key}
                    onSubmit={(event) => uploadCategoryDocument(event, requirement)}
                    className="space-y-2 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-slate-900"
                  >
                    <p className="font-bold">{requirement.label} — {requirement.required ? "مطلوب" : "اختياري"}</p>
                    <p className="text-sm">
                      الحالة: {categoryDocumentStatusText(document?.reviewStatus || "missing")}
                      {document?.rejectionReason ? ` — سبب الرفض: ${document.rejectionReason}` : ""}
                    </p>
                    {canReplace && (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="min-w-48 flex-1">
                          <FieldLabel required>الملف (PDF أو JPEG أو PNG أو WebP، حتى 5MB)</FieldLabel>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            required={!document}
                            onChange={(event) => setDocumentFiles((files) => ({
                              ...files,
                              [requirement.key]: event.target.files?.[0] || null
                            }))}
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={submitting || !documentFiles[requirement.key]}
                          className="rounded-lg bg-slate-800 px-4 py-2 font-bold text-white disabled:opacity-50"
                        >
                          {document?.reviewStatus === "rejected" ? "إعادة رفع الوثيقة" : "رفع الوثيقة"}
                        </button>
                      </div>
                    )}
                  </form>
                );
              })}
            </div>
          )}
          <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
            <span>
              {acknowledgment} <span className="text-red-600" aria-label="مطلوب">*</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={submitForReview} disabled={submitting || !acknowledged || !acknowledgment} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">
              {submitting ? "جارٍ الإرسال للمراجعة…" : "أوافق وأرسل للمراجعة"}
            </button>
            <button type="button" onClick={() => { setPreviewAuction(null); setAcknowledged(false); }} disabled={submitting} className="rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-600">
              العودة لتعديل البيانات
            </button>
            <Link to="/my-auctions" className="rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-600">حفظ كمسودة والخروج</Link>
          </div>
        </div>
      ) : (
      <form key={existingAuction?.id || "new-auction"} onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs text-slate-500">
          <span className="text-red-600" aria-label="مطلوب">*</span> مطلوب
          <span className="mx-2">|</span>
          اختياري
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldLabel required>الفئة</FieldLabel>
            <select name="categoryId" required disabled={loadingOptions} value={selectedCategoryId} onChange={(event) => { setLoadingCategoryRequirements(true); setSelectedCategoryId(event.target.value); setCategoryDetails({}); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="">اختر الفئة</option>
              {categories.map((category) => (
                <option key={category._id || category.id} value={category._id || category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel required>عنوان السلعة</FieldLabel>
            <input name="title" required minLength={3} maxLength={120} defaultValue={existingAuction?.title || ""} className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
        </div>
        {categoryRequirements.supported && categoryRequirements.documentTypes.length > 0 && (
          <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="font-bold">وثائق المركبة المطلوبة</h2>
            <ul className="list-inside list-disc text-sm">
              {categoryRequirements.documentTypes.map((requirement) => (
                <li key={requirement.key}>{requirement.label} — مطلوب</li>
              ))}
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              سترفع الوثائق بعد حفظ بيانات المزاد كمسودة. تبقى خاصة ولا تظهر للمشترين، وتخضع لمراجعة الإدارة.
            </p>
          </section>
        )}
        {selectedCategoryId && !loadingCategoryRequirements && !categoryRequirements.supported && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            هذا التصنيف غير مفعّل للمزادات حاليًا. اختر تصنيفًا مدعومًا.
          </p>
        )}
        {categoryRequirements.fields.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div>
              <h2 className="font-black">بيانات الفئة</h2>
              <p className="text-sm text-slate-500">الحقول المكتملة لا تعني اعتماد الوثائق أو صحة المعلومات.</p>
            </div>
            <p className="text-sm font-bold">
              اكتمل {categoryRequirements.fields.filter((field) =>
                isAuctionFieldVisible(field, categoryDetails) &&
                (!isAuctionFieldRequired(field, categoryDetails) ||
                  String(categoryDetails[field.key] ?? "").trim())
              ).length} من {categoryRequirements.fields.filter((field) =>
                isAuctionFieldVisible(field, categoryDetails)
              ).length} حقول متطلبات الفئة.
            </p>
            {categoryRequirements.fields.filter((field) =>
              isAuctionFieldVisible(field, categoryDetails)
            ).map((field) => (
              <label key={field.key} className="block">
                <FieldLabel required={isAuctionFieldRequired(field, categoryDetails)}>
                  {field.label}{field.public === false ? " (خاص)" : ""}
                </FieldLabel>
                {field.type === "textarea" ? (
                  <textarea rows={3} value={categoryDetails[field.key] ?? ""} onChange={(event) => updateCategoryDetail(field, event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
                ) : field.type === "boolean" ? (
                  <select value={categoryDetails[field.key] === undefined ? "" : String(categoryDetails[field.key])} onChange={(event) => updateCategoryDetail(field, event.target.value === "" ? "" : event.target.value === "true")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <option value="">اختر</option><option value="true">نعم</option><option value="false">لا</option>
                  </select>
                ) : field.type === "select" ? (
                  <select value={categoryDetails[field.key] ?? ""} onChange={(event) => updateCategoryDetail(field, event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <option value="">اختر</option>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input type={field.type === "number" ? "number" : "text"} min={field.type === "number" ? "0" : undefined} maxLength={field.maxLength} value={categoryDetails[field.key] ?? ""} onChange={(event) => updateCategoryDetail(field, field.type === "number" && event.target.value ? Number(event.target.value) : event.target.value)} className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
                )}
              </label>
            ))}
            {categoryRequirements.fields.some((field) => field.public === false) && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                البيانات الخاصة لا تظهر للمشترين، وتكون متاحة للبائع والمراجعين المخولين فقط.
              </p>
            )}
          </div>
        )}
        <label className="block">
          <FieldLabel required>الوصف والتفاصيل</FieldLabel>
          <textarea name="description" required minLength={5} maxLength={5000} rows={5} defaultValue={existingAuction?.description || ""} className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldLabel required>حالة السلعة</FieldLabel>
            <textarea name="itemCondition" required minLength={3} maxLength={500} rows={2} defaultValue={existingAuction?.itemCondition || ""} placeholder="صف الحالة الحالية للسلعة بوضوح" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
          <label>
            <FieldLabel required>العيوب والملاحظات</FieldLabel>
            <textarea name="defectsNotes" required maxLength={2000} rows={3} defaultValue={existingAuction?.defectsNotes || ""} placeholder="اذكر العيوب المعروفة، أو اكتب: لا توجد عيوب معروفة" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
        </div>
        {categoryRequirements.requiredImageLabels.length ? (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="font-bold">صور السلعة — مطلوبة لإثبات حالتها بصريًا</p>
          <p className="text-sm text-slate-500">اكتمال التصنيفات لا يثبت حداثة الصور أو أصالتها.</p>
          {[...categoryRequirements.requiredImageLabels, ...categoryRequirements.optionalImageLabels].map((label) => (
            <label key={label} className="block">
              <FieldLabel required={
                categoryRequirements.requiredImageLabels.includes(label) && !existingAuction
              }>
                {imageLabelText(label)}
              </FieldLabel>
              <input name={`image_${label}`} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
            </label>
          ))}
          {existingAuction?.images?.length > 0 && <p className="text-xs text-slate-500">إذا رفعت صورًا جديدة فستحل محل مجموعة الصور الحالية.</p>}
        </div>
        ) : (
        <label className="block rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <FieldLabel required={!existingAuction}>صور السلعة (1 إلى 10)</FieldLabel>
          <input name="images" type="file" accept="image/jpeg,image/png,image/webp" required={!existingAuction} multiple className="block w-full text-sm" />
        </label>
        )}
        <div className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2">
          <p className="font-bold sm:col-span-2">موقع المعروض</p>
          <label>
            <FieldLabel required>المحافظة</FieldLabel>
            <select name="governorateId" required disabled={loadingOptions} defaultValue={existingAuction?.governorateId || ""} onChange={selectGovernorate} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="">اختر المحافظة</option>
              {governorates.map((governorate) => (
                <option key={governorate._id} value={governorate._id}>{governorate.name}</option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel required={categoryRequirements.type === "vehicle"}>المدينة</FieldLabel>
            <select name="cityId" required={categoryRequirements.type === "vehicle"} disabled={cities.length === 0} defaultValue={existingAuction?.cityId || ""} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="">اختر المدينة</option>
              {cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">السعر ومدة المزاد</h2>
          <label>
            <FieldLabel required>العملة</FieldLabel>
            <select name="currency" required defaultValue={existingAuction?.currency || "YER_ADEN"} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="YER_ADEN">ريال يمني - عدن</option>
              <option value="YER_SANAA">ريال يمني - صنعاء</option>
              <option value="SAR">ريال سعودي</option>
              <option value="USD">دولار أمريكي</option>
            </select>
          </label>
          <label>
            <FieldLabel required>السعر الابتدائي</FieldLabel>
            <input name="startingPrice" required inputMode="decimal" autoComplete="off" defaultValue={existingAuction?.startingPrice || ""} placeholder="مثال: 1000 أو 1000.50" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
          <label>
            <FieldLabel required>الحد الأدنى للزيادة</FieldLabel>
            <input name="minimumIncrement" required inputMode="decimal" autoComplete="off" defaultValue={existingAuction?.minimumIncrement || ""} placeholder="قيمة الزيادة لكل عرض" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
          <label>
            <FieldLabel required>مدة المزاد</FieldLabel>
            <select name="durationDays" required defaultValue={existingAuction?.durationDays || durationOptions[0]?.days || ""} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              {durationOptions.map((option) => (
                <option key={option.days} value={option.days}>{option.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">يبدأ احتساب المدة عند موافقة الإدارة، وليس عند إرسال الطلب.</span>
          </label>
        </div>
        <div className="grid gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">التسليم والاستلام</h2>
          <label>
            <FieldLabel required>طريقة التسليم والاستلام</FieldLabel>
            <select name="deliveryMethod" required defaultValue={existingAuction?.deliveryMethod || ""} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <option value="">اختر الطريقة</option>
              <option value="delivery">توصيل</option>
              <option value="pickup">استلام</option>
              <option value="both">توصيل أو استلام</option>
            </select>
          </label>
          <label>
            <FieldLabel required>تفاصيل التسليم والاستلام</FieldLabel>
            <textarea name="deliveryDetails" required minLength={3} maxLength={1000} rows={2} defaultValue={existingAuction?.deliveryDetails || ""} placeholder="وضح المنطقة أو الترتيبات المتاحة" className="w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={submitting || loadingOptions || loadingCategoryRequirements || !categoryRequirements.supported} className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">
            {submitting ? "جارٍ رفع الصور وحفظ المسودة…" : existingAuction ? "حفظ التعديلات ثم المعاينة" : "حفظ المسودة ثم المعاينة"}
          </button>
          <Link to="/auctions" className="rounded-xl border border-slate-300 px-5 py-3 font-bold dark:border-slate-600">إلغاء</Link>
        </div>
        {submitting && (
          <p role="status" className="text-sm font-bold text-blue-700 dark:text-blue-300">
            {uploadProgress === null
              ? "جارٍ تجهيز الطلب والاتصال بالخادم…"
              : uploadProgress < 100
                ? `جارٍ رفع صور المزاد: ${uploadProgress}٪`
                : "اكتمل رفع الصور، جارٍ تجهيزها وحفظ المسودة…"}
          </p>
        )}
      </form>
      )}
    </section>
  );
}

function FieldLabel({ children, required = false }) {
  return (
    <span className="mb-1 block text-sm font-bold">
      {children}{" "}
      {required ? (
        <span className="text-red-600" aria-label="مطلوب">*</span>
      ) : (
        <span className="text-xs font-normal text-slate-500">اختياري</span>
      )}
    </span>
  );
}

function imageLabelText(label) {
  return ({
    front: "الواجهة الأمامية",
    rear: "الواجهة الخلفية",
    left_side: "الجانب الأيسر",
    right_side: "الجانب الأيمن",
    interior: "المقصورة الداخلية",
    dashboard: "لوحة العدادات وقراءة العداد",
    reported_damage: "العيوب أو الأضرار المعلنة",
    actual_item: "صورة السلعة الفعلية"
  })[label] || "صورة السلعة";
}

function isAuctionFieldVisible(field, details) {
  const condition = field.visibleWhen;
  if (!condition) return true;
  if (Object.hasOwn(condition, "equals")) return details[condition.key] === condition.equals;
  return Array.isArray(condition.oneOf) && condition.oneOf.includes(details[condition.key]);
}

function isAuctionFieldRequired(field, details) {
  if (field.required) return true;
  const condition = field.requiredWhen;
  if (!condition) return false;
  if (Object.hasOwn(condition, "equals")) return details[condition.key] === condition.equals;
  return Array.isArray(condition.oneOf) && condition.oneOf.includes(details[condition.key]);
}

function categoryDocumentStatusText(status) {
  return ({
    missing: "مفقودة",
    pending_review: "بانتظار المراجعة",
    approved: "معتمدة",
    rejected: "مرفوضة"
  })[status] || "غير محددة";
}
