const AD_ALREADY_CREATED_MESSAGE =
  "يبدو أن الإعلان أُضيف بالفعل. تحقق من إعلاناتك قبل المحاولة مرة أخرى.";

export function getAdCreationError(error) {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.error;

  if (status === 400 && typeof serverMessage === "string" && serverMessage.includes("إعلان مشابه")) {
    return AD_ALREADY_CREATED_MESSAGE;
  }
  if (status === 408) {
    return "انتهت مهلة معالجة الطلب. تحقق من إعلاناتك قبل إعادة المحاولة لتجنب التكرار.";
  }
  if (status === 422 && error?.response?.data?.code === "IMAGE_PROCESSING_FAILED") {
    return serverMessage || "تعذر تجهيز الصور. لم يتم حفظ الإعلان، يرجى إعادة رفع الصور.";
  }
  if (status === 413) {
    return "حجم الرفع تجاوز الحد المسموح. قلّل حجم الصور أو عددها ثم أعد المحاولة.";
  }
  if (status === 429) {
    return serverMessage || "تم تجاوز حد نشر الإعلانات. يرجى الانتظار قبل المحاولة مجددًا.";
  }
  if (status >= 500) {
    return "حدث خطأ مؤقت أثناء حفظ الإعلان. تحقق من إعلاناتك قبل إعادة المحاولة.";
  }
  if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) {
    return "استغرق رفع الصور وقتًا أطول من المتوقع. تحقق من إعلاناتك قبل إعادة المحاولة لتجنب التكرار.";
  }
  if (error?.code === "ERR_NETWORK" && !error.response) {
    return "تعذّر استلام رد من الخادم. قد يكون الإعلان حُفظ؛ تحقق من إعلاناتك قبل إعادة المحاولة.";
  }

  return null;
}
