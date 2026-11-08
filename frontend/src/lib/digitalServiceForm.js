export function isDigitalServiceConditionMet(condition, answers) {
  if (!Object.hasOwn(answers, condition.fieldId)) return false;
  const actual = answers[condition.fieldId];
  if (condition.operator === "EQUALS") return actual === condition.value;
  if (condition.operator === "NOT_EQUALS") return actual !== condition.value;
  const contains = Array.isArray(actual)
    ? actual.includes(condition.value)
    : typeof actual === "string" && actual.includes(condition.value);
  return condition.operator === "CONTAINS" ? contains : !contains;
}

export function getVisibleDigitalServiceAnswers(schema = [], answers = {}) {
  const visibleAnswers = {};
  const resolvedAnswers = {};
  const orderedFields = [...schema].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  for (const field of orderedFields) {
    const visible = !field.when || isDigitalServiceConditionMet(field.when, resolvedAnswers);
    if (!visible) continue;
    if (Object.hasOwn(answers, field.id)) visibleAnswers[field.id] = answers[field.id];
    const value = Object.hasOwn(answers, field.id) ? answers[field.id] : field.defaultValue;
    if (value !== undefined) resolvedAnswers[field.id] = value;
  }
  return visibleAnswers;
}

export function hasRequiredDigitalServiceAnswers(schema = [], answers = {}) {
  const resolvedAnswers = {};
  const orderedFields = [...schema].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  for (const field of orderedFields) {
    if (field.when && !isDigitalServiceConditionMet(field.when, resolvedAnswers)) continue;
    const value = Object.hasOwn(answers, field.id) ? answers[field.id] : field.defaultValue;
    if (field.required) {
      if (field.type === "BOOLEAN" && value === undefined) return false;
      if (field.type === "MULTI_SELECT" && (!Array.isArray(value) || value.length === 0)) return false;
      if (field.type === "SELECT" && (typeof value !== "string" || !value)) return false;
      if (field.type === "NUMBER" && (value === undefined || value === null || value === "")) return false;
      if (["TEXT", "EMAIL", "URL", "TEXTAREA"].includes(field.type)
        && (typeof value !== "string" || !value.trim())) return false;
    }
    if (value !== undefined) resolvedAnswers[field.id] = value;
  }
  return true;
}
