const inFlightRequests = new Map();

export function getNotificationRequest(api, path, scope = "anonymous") {
  const key = `${scope}:${path}`;
  if (!inFlightRequests.has(key)) {
    const request = api.get(path).finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, request);
  }
  return inFlightRequests.get(key);
}
