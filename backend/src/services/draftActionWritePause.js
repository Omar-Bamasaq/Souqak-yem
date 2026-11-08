export function draftActionWritesPaused() {
  return process.env.DRAFT_ACTIONS_WRITES_PAUSED === "YES";
}

export function rejectIfDraftActionWritesPaused(res) {
  if (!draftActionWritesPaused()) return false;
  res.status(503).json({ error: "حفظ المسودات متوقف مؤقتًا لأعمال صيانة. حاول مجددًا بعد قليل." });
  return true;
}

export function draftActionWritePauseMiddleware(_req, res, next) {
  if (rejectIfDraftActionWritesPaused(res)) return;
  next();
}
