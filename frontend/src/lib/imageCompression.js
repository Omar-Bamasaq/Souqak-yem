import imageCompression from "browser-image-compression";

export function supportsWebp() {
  if (typeof window === "undefined") return false;
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

export function isImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type.startsWith("image/") || /(jpg|jpeg|png|webp|heic|heif)$/i.test(name);
}

export function isPdfFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

export async function convertImageToWebp(file) {
  if (!file || !isImageFile(file)) {
    throw new Error("يرجى اختيار صورة سند بصيغة JPG أو PNG أو WebP.");
  }
  if (/heic|heif/i.test(String(file.type || file.name || ""))) {
    throw new Error("صيغة HEIC/HEIF غير مدعومة. يرجى اختيار صورة JPG أو PNG.");
  }
  if (!supportsWebp()) {
    throw new Error("تحويل الصور إلى WebP غير مدعوم في هذا المتصفح.");
  }

  try {
    const converted = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1800,
      useWebWorker: true,
      initialQuality: 0.85,
      fileType: "image/webp",
      alwaysKeepResolution: false,
      maxIteration: 10,
    });
    if (converted.type !== "image/webp") {
      throw new Error("لم يتم تحويل الصورة إلى WebP.");
    }
    const baseName = String(file.name || "payment-receipt").replace(/\.[^.]+$/, "");
    return new File([converted], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified || Date.now(),
    });
  } catch (error) {
    console.error("[imageCompression] WebP conversion failed:", error);
    throw new Error("تعذر تحويل صورة السند إلى WebP. يرجى اختيار صورة أخرى.");
  }
}

export function normalizeImageUploadFile(file, index = 0) {
  const mimeType = String(file?.type || "").toLowerCase();
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  const extensionMimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const normalizedMimeType = mimeType === "image/jpg"
    ? "image/jpeg"
    : ["image/jpeg", "image/png", "image/webp"].includes(mimeType)
      ? mimeType
      : extensionMimeTypes[extension];

  if (!normalizedMimeType) {
    throw new Error("نوع الصورة غير مدعوم. يرجى اختيار صورة JPG أو PNG أو WebP.");
  }

  const normalizedExtension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[normalizedMimeType];

  return new File([file], `upload-image-${index + 1}.${normalizedExtension}`, {
    type: normalizedMimeType,
    lastModified: file.lastModified || Date.now(),
  });
}

export async function compressImageFile(file, options = {}) {
  if (!file || !isImageFile(file)) {
    return file;
  }

  const isHeic = /heic|heif/i.test(String(file.type || file.name || ""));
  if (isHeic) {
    throw new Error("نوع الصورة HEIC/HEIF غير مدعوم في هذا المتصفح. يرجى تحويل الصورة إلى JPG أو PNG قبل الرفع.");
  }

  const shouldCompress = file.size > 500 * 1024;

  if (!shouldCompress) {
    return file;
  }

  const defaults = {
    maxSizeMB: 0.9,
    maxWidthOrHeight: 1800,
    useWebWorker: true,
    initialQuality: 0.85,
    fileType: supportsWebp() ? "image/webp" : "image/jpeg",
    alwaysKeepResolution: false,
    maxIteration: 10,
    ...options,
  };

  try {
    const compressed = await imageCompression(file, defaults);
    return compressed || file;
  } catch (error) {
    console.error("[imageCompression] failed:", error);
    throw new Error("تعذر ضغط الصورة في المتصفح. يرجى اختيار صورة أخرى أو تحويلها إلى JPG/PNG ثم المحاولة مرة أخرى.");
  }
}

export async function prepareFilesForUpload(files, options = {}) {
  const prepared = [];
  const items = Array.isArray(files) ? files : [files];

  for (let index = 0; index < items.length; index += 1) {
    const file = items[index];
    if (!file) continue;

    if (isPdfFile(file)) {
      prepared.push(file);
      continue;
    }

    if (!isImageFile(file)) {
      prepared.push(file);
      continue;
    }

    const onProgress = options.onProgress;
    if (typeof onProgress === "function") {
      onProgress({
        index,
        total: items.length,
        progress: 0,
        fileName: file.name,
      });
    }

    const compressed = await compressImageFile(file, {
      maxSizeMB: options.maxSizeMB ?? 0.9,
      maxWidthOrHeight: options.maxWidthOrHeight ?? 1800,
      initialQuality: options.initialQuality ?? 0.85,
      fileType: options.fileType ?? (supportsWebp() ? "image/webp" : "image/jpeg"),
      useWebWorker: options.useWebWorker ?? true,
      maxIteration: options.maxIteration ?? 10,
      onProgress: (progress) => {
        if (typeof onProgress === "function") {
          onProgress({ index, total: items.length, progress, fileName: file.name });
        }
      },
    });

    prepared.push(normalizeImageUploadFile(compressed, index));
  }

  return prepared;
}
