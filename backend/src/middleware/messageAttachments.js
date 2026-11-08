export function rejectClientSuppliedAttachmentRefs(req, res, next) {
  if (Object.hasOwn(req.body || {}, "images")) {
    return res.status(400).json({
      error: "يجب رفع المرفقات كملفات، ولا تقبل أسماء الملفات المرسلة ضمن البيانات."
    });
  }
  return next();
}
