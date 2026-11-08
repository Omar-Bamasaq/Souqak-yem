export function nextDigitalServiceId(prefix, existingIds) {
  const usedIds = new Set(existingIds);
  let suffix = 1;
  let id = `${prefix}${suffix}`;

  while (usedIds.has(id)) {
    suffix += 1;
    id = `${prefix}${suffix}`;
  }

  return id;
}
