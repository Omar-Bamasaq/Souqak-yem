import React, { useEffect, useMemo } from "react";
import { getVisibleDigitalServiceAnswers, isDigitalServiceConditionMet } from "../lib/digitalServiceForm.js";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function fieldValue(field, answers) {
  if (Object.hasOwn(answers, field.id)) return answers[field.id];
  return field.defaultValue;
}

export default function DigitalServiceForm({
  schema = [],
  answers = {},
  onChange,
  disabled = false,
  idPrefix = "digital-service"
}) {
  const orderedFields = useMemo(
    () => [...schema].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)),
    [schema]
  );
  const visibleFields = [];
  const resolvedAnswers = {};
  const visibleAnswers = {};

  for (const field of orderedFields) {
    const visible = !field.when || isDigitalServiceConditionMet(field.when, resolvedAnswers);
    if (!visible) continue;
    visibleFields.push(field);
    const value = fieldValue(field, answers);
    if (value !== undefined) visibleAnswers[field.id] = value;
    if (value !== undefined) resolvedAnswers[field.id] = value;
  }

  useEffect(() => {
    const filtered = getVisibleDigitalServiceAnswers(orderedFields, answers);
    if (JSON.stringify(filtered) !== JSON.stringify(answers)) onChange?.(filtered);
  }, [answers, onChange, orderedFields]);

  const update = (fieldId, value) => {
    const next = getVisibleDigitalServiceAnswers(orderedFields, { ...answers, [fieldId]: value });
    onChange?.(next);
  };

  if (!orderedFields.length) return null;

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="text-sm font-black text-slate-800 dark:text-white">بيانات الخدمة المطلوبة</legend>
      {visibleFields.map((field) => {
        const value = fieldValue(field, answers);
        const id = `${idPrefix}-${field.id}`;
        const common = {
          id,
          name: field.id,
          required: Boolean(field.required),
          disabled,
          className: fieldClass,
          "aria-describedby": field.helpText ? `${id}-help` : undefined
        };
        let control;
        if (field.type === "TEXTAREA") {
          control = <textarea {...common} rows={4} minLength={field.validation?.minLength} maxLength={field.validation?.maxLength} placeholder={field.placeholder || ""} value={value ?? ""} onChange={(event) => update(field.id, event.target.value)} />;
        } else if (field.type === "SELECT") {
          control = (
            <select {...common} value={value ?? ""} onChange={(event) => update(field.id, event.target.value)}>
              <option value="">اختر قيمة</option>
              {(field.options || []).filter((option) => option.isActive !== false).map((option) => (
                <option key={option.id || option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          );
        } else if (field.type === "MULTI_SELECT") {
          const selected = Array.isArray(value) ? value : [];
          control = (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              {(field.options || []).filter((option) => option.isActive !== false).map((option) => (
                <label key={option.id || option.value} className="flex min-h-10 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    disabled={disabled}
                    onChange={(event) => update(field.id, event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value))}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          );
        } else if (field.type === "BOOLEAN") {
          control = (
            <select {...common} value={value === undefined ? "" : value ? "true" : "false"} onChange={(event) => update(field.id, event.target.value === "true")}>
              <option value="">اختر</option>
              <option value="true">نعم</option>
              <option value="false">لا</option>
            </select>
          );
        } else {
          const type = field.type === "NUMBER" ? "number" : field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text";
          control = (
            <input
              {...common}
              type={type}
              min={field.type === "NUMBER" ? field.validation?.min : undefined}
              max={field.type === "NUMBER" ? field.validation?.max : undefined}
              minLength={field.type !== "NUMBER" ? field.validation?.minLength : undefined}
              maxLength={field.type !== "NUMBER" ? field.validation?.maxLength : undefined}
              inputMode={field.validation?.format === "YE_MOBILE_73_77" ? "tel" : undefined}
              pattern={field.validation?.format === "YE_MOBILE_73_77" ? "7[37][0-9]{7}" : undefined}
              title={field.validation?.format === "YE_MOBILE_73_77"
                ? "أدخل رقمًا من 9 أرقام يبدأ بـ73 أو 77."
                : undefined}
              step={field.type === "NUMBER" ? "any" : undefined}
              placeholder={field.placeholder || ""}
              value={value ?? ""}
              onChange={(event) => update(field.id, field.type === "NUMBER" && event.target.value !== ""
                ? Number(event.target.value)
                : event.target.value)}
            />
          );
        }

        return (
          <div key={field.id} className="space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
            {field.type === "MULTI_SELECT"
              ? <p>{field.label}{field.required && <span className="ms-1 text-red-600">*</span>}</p>
              : <label htmlFor={id} className="block">{field.label}{field.required && <span className="ms-1 text-red-600">*</span>}</label>}
            {field.type === "BOOLEAN" && field.helpText && <span id={`${id}-help`} className="block text-[11px] font-medium leading-5 text-slate-500">{field.helpText}</span>}
            {control}
            {field.type !== "BOOLEAN" && field.helpText && <span id={`${id}-help`} className="block text-[11px] font-medium leading-5 text-slate-500">{field.helpText}</span>}
          </div>
        );
      })}
    </fieldset>
  );
}
