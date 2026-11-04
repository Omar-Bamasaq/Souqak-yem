import React from "react";
import MobileSelect from "./MobileSelect.jsx";

export default function CategoryAttributeFields({ attributes, values, onChange, title = "معلومات إضافية (اختياري)" }) {
  if (!attributes?.length) return null;

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      {attributes.map((attribute) => {
        const id = String(attribute.id || attribute._id);
        const value = values[id] ?? (attribute.type === "multiselect" ? [] : "");
        const setValue = (nextValue) => onChange(id, nextValue);

        return (
          <div key={id} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {attribute.label}
              {attribute.required && <span className="mr-1 text-red-500">*</span>}
            </label>
            {attribute.type === "number" ? (
              <input
                type="number"
                min={attribute.validation?.min}
                max={attribute.validation?.max}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={attribute.placeholder || ""}
                required={attribute.required}
                className="ds-input"
              />
            ) : attribute.type === "select" ? (
              <MobileSelect
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required={attribute.required}
                options={attribute.options?.map((option) => ({ value: option, label: option }))}
                placeholder="اختر..."
              />
            ) : attribute.type === "boolean" ? (
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={attribute.label}>
                {[{ value: true, label: "نعم" }, { value: false, label: "لا" }].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={value === option.value || String(value) === String(option.value)}
                    onClick={() => setValue(option.value)}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold ${value === option.value || String(value) === String(option.value) ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-700"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : attribute.type === "multiselect" ? (
              <div className="flex flex-wrap gap-2">
                {attribute.options?.map((option) => {
                  const selectedValues = Array.isArray(value) ? value : value ? String(value).split(",").map((entry) => entry.trim()) : [];
                  const selected = selectedValues.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setValue(selected ? selectedValues.filter((entry) => entry !== option) : [...selectedValues, option])}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${selected ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={attribute.placeholder || ""}
                required={attribute.required}
                pattern={attribute.validation?.pattern || undefined}
                className="ds-input"
              />
            )}
            {attribute.helpText && <p className="text-xs text-gray-500">{attribute.helpText}</p>}
          </div>
        );
      })}
    </section>
  );
}