import DraftAction from "../models/DraftAction.js";

export async function findDraftActionResult(Model, draftId, userId, ownerField = "user") {
  if (!draftId) return null;
  return Model.findOne({ draftActionId: draftId, [ownerField]: userId }).lean();
}

export async function getIncompleteDraftForSubmission(draftId, userId, type) {
  if (!draftId) return { draft: null };
  const draft = await DraftAction.findOne({
    _id: draftId,
    userId,
    expiresAt: { $gt: new Date() }
  }).lean();
  if (!draft || draft.type !== type) {
    return { error: "العملية غير موجودة.", status: 404 };
  }
  if (draft.status !== "incomplete") {
    return { error: "تم إرسال هذه العملية مسبقًا. تحقق من سجل طلباتك.", status: 409 };
  }
  return { draft };
}

export async function markDraftCompleted(draftId, userId, type, resultId, resultType, resultStoreId = null) {
  if (!draftId) return;
  await DraftAction.updateOne(
    { _id: draftId, userId, type, status: "incomplete" },
    {
      $set: {
        status: "completed",
        resultId,
        resultType,
        resultStoreId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }
  );
}
