import test from "node:test";
import assert from "node:assert/strict";
import { nextDigitalServiceId } from "../src/lib/digitalServiceIds.js";
import {
  normalizeFormSchema,
  normalizeWalletServicePackages
} from "../../backend/src/utils/walletServiceDynamicConfig.js";

const backendIdPattern = /^[A-Za-z][A-Za-z0-9_-]{0,49}$/;

function appendId(ids, prefix) {
  return [...ids, nextDigitalServiceId(prefix, ids)];
}

test("adds the first package, option, and field IDs to empty lists", () => {
  assert.equal(nextDigitalServiceId("package", []), "package1");
  assert.equal(nextDigitalServiceId("option", []), "option1");
  assert.equal(nextDigitalServiceId("field", []), "field1");
});

test("adding after deleting a middle item does not collide with a current ID", () => {
  const packageIds = ["package1", "package2", "package3"].filter((id) => id !== "package2");
  assert.equal(nextDigitalServiceId("package", packageIds), "package2");
  assert.equal(new Set(appendId(packageIds, "package")).size, 3);

  const optionIds = ["option1", "option2", "option3"].filter((id) => id !== "option2");
  assert.equal(nextDigitalServiceId("option", optionIds), "option2");
  assert.equal(new Set(appendId(optionIds, "option")).size, 3);
});

test("repeated deletions and additions keep package, option, and field IDs unique", () => {
  const groups = [
    { prefix: "package", ids: ["package1", "package2", "package3", "package4"] },
    { prefix: "option", ids: ["option1", "option2", "option3", "option4"] },
    { prefix: "field", ids: ["field1", "field2", "field3", "field4"] }
  ];

  for (const { prefix, ids } of groups) {
    for (const deletedIndexes of [[0], [1], [3], [1, 3]]) {
      const deleted = new Set(deletedIndexes);
      const remaining = ids.filter((_, index) => !deleted.has(index));
      const next = appendId(appendId(remaining, prefix), prefix);
      assert.equal(new Set(next).size, next.length, `${prefix}: ${deletedIndexes}`);
      assert.ok(next.every((id) => backendIdPattern.test(id)), `${prefix}: ${deletedIndexes}`);
      assert.deepEqual(next.slice(0, remaining.length), remaining);
    }
  }
});

test("adding a field or editing another item does not change existing IDs", () => {
  const existing = [
    { id: "field1", label: "قديم" },
    { id: "field3", label: "قديم آخر" }
  ];
  const edited = existing.map((field, index) =>
    index === 0 ? { ...field, label: "تم التعديل" } : field
  );
  const withAddedField = [
    ...edited,
    { id: nextDigitalServiceId("field", edited.map((field) => field.id)), label: "جديد" }
  ];

  assert.deepEqual(withAddedField.map((field) => field.id), ["field1", "field3", "field2"]);
  assert.equal(withAddedField[1].id, existing[1].id);
  assert.equal(new Set(withAddedField.map((field) => field.id)).size, withAddedField.length);
});

test("generated package, field, and option IDs pass backend validation", () => {
  const packageIds = appendId(["package1", "package3"], "package");
  assert.doesNotThrow(() => normalizeWalletServicePackages(
    packageIds.map((id, index) => ({
      id,
      name: `باقة ${index + 1}`,
      price: index + 1,
      currency: "USD",
      isActive: true,
      sortOrder: index
    })),
    "USD"
  ));

  const fieldIds = appendId(["field1", "field3"], "field");
  const optionIds = appendId(["option1", "option3"], "option");
  assert.doesNotThrow(() => normalizeFormSchema(fieldIds.map((id, index) => ({
    id,
    name: id,
    label: `حقل ${index + 1}`,
    type: "SELECT",
    required: false,
    sortOrder: index,
    options: optionIds.map((optionId, optionIndex) => ({
      id: optionId,
      label: `خيار ${optionIndex + 1}`,
      value: `value${optionIndex + 1}`,
      isActive: true,
      sortOrder: optionIndex
    }))
  }))));
});
