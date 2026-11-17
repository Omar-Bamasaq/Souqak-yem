export const PWA_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const PWA_FORCE_CHECK_INTERVAL_MS = 15 * 1000;

const RELOAD_KEY_PREFIX = "souqak:pwa-reloaded:";
const UPDATE_REQUEST_ID = "__souqakPwaUpdateRequestId";
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";
let activeSafetyTracker = null;

export function shouldCheckForPwaUpdate(now, lastCheckedAt, online = true) {
  return online && (lastCheckedAt === 0 || now - lastCheckedAt >= PWA_UPDATE_CHECK_INTERVAL_MS);
}

export function createPwaUpdateCheckScheduler({
  update,
  now = () => Date.now(),
  isOnline = () => navigator.onLine !== false,
  onError = () => {}
}) {
  let lastCheckedAt = 0;
  let lastForcedCheckAt = null;
  let retryAfterAt = 0;
  let inFlight = null;
  return async (force = false) => {
    if (!isOnline()) return false;
    if (inFlight) return inFlight;

    const checkedAt = now();
    if (checkedAt < retryAfterAt) return false;
    if (force) {
      if (lastForcedCheckAt !== null
        && checkedAt - lastForcedCheckAt < PWA_FORCE_CHECK_INTERVAL_MS) return false;
      lastForcedCheckAt = checkedAt;
    } else if (!shouldCheckForPwaUpdate(checkedAt, lastCheckedAt, true)) {
      return false;
    }

    inFlight = (async () => {
      try {
        await update();
        lastCheckedAt = now();
        return true;
      } catch (error) {
        retryAfterAt = now() + PWA_FORCE_CHECK_INTERVAL_MS;
        onError(error);
        return false;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}

export function canReloadPwaBuild(buildId, lastReloadedBuildId, safe) {
  return Boolean(safe && buildId && buildId !== lastReloadedBuildId);
}

export function resolvePwaRegistrationScope(origin, storeBasePath, existingScope) {
  if (!existingScope) return "/";

  try {
    const scope = new URL(existingScope, origin);
    if (scope.origin !== origin) return "/";
    if (scope.pathname === "/") return "/";
    if (/^\/store\/[a-f\d]{24}$/i.test(String(storeBasePath || ""))
      && scope.pathname.startsWith(`${storeBasePath}/`)) {
      return scope.pathname;
    }
    return "/";
  } catch {
    return "/";
  }
}

export function shouldReloadForPwaController(pageBuildId, controllerBuildId, lastReloadedBuildId) {
  return Boolean(
    controllerBuildId
    && controllerBuildId !== pageBuildId
    && pageBuildId !== lastReloadedBuildId
  );
}

function readControlValue(control) {
  if (control.type === "checkbox" || control.type === "radio") {
    return `${control.checked}:${control.value}`;
  }
  if (control.type === "file") {
    return Array.from(control.files || [])
      .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
      .join("|");
  }
  if (control.tagName === "SELECT" && control.multiple) {
    return Array.from(control.selectedOptions).map((option) => option.value).join("|");
  }
  return String(control.value ?? "");
}

function snapshotForm(form) {
  return Array.from(form.elements).map((control) => [
    control.name || control.id || control.type || control.tagName,
    readControlValue(control)
  ]);
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createPwaUpdateSafetyTracker({ document, setTimer = setTimeout }) {
  const formBaselines = new WeakMap();
  const controlBaselines = new WeakMap();
  const dirtyForms = new Set();
  const dirtyControls = new Set();
  const submittedForms = new Map();
  const activeMutations = new Map();
  const listeners = [];
  let onSafetyChange = () => {};
  let submissionId = 0;

  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };

  const currentFormSnapshot = (form) => snapshotForm(form);

  const updateDirtyState = (target) => {
    const form = target.form || target.closest?.("form");
    if (form) {
      const baseline = formBaselines.get(form);
      if (baseline && sameSnapshot(currentFormSnapshot(form), baseline)) dirtyForms.delete(form);
      else dirtyForms.add(form);
      return;
    }

    const baseline = controlBaselines.get(target);
    if (baseline !== undefined && readControlValue(target) === baseline) dirtyControls.delete(target);
    else dirtyControls.add(target);
  };

  const captureFormBaseline = (form) => {
    if (!formBaselines.has(form)) formBaselines.set(form, currentFormSnapshot(form));
  };

  const handleFocusIn = (event) => {
    const target = event.target;
    if (!target.matches?.(EDITABLE_SELECTOR)) return;
    const form = target.form || target.closest?.("form");
    if (form) captureFormBaseline(form);
    else if (!controlBaselines.has(target)) controlBaselines.set(target, readControlValue(target));
  };

  const handleInput = (event) => {
    if (event.target.matches?.(EDITABLE_SELECTOR)) {
      updateDirtyState(event.target);
      onSafetyChange();
    }
  };

  const handleSubmit = (event) => {
    const form = event.target;
    if (!form?.elements) return;
    captureFormBaseline(form);
    submittedForms.set(form, {
      id: ++submissionId,
      snapshot: currentFormSnapshot(form)
    });
    updateDirtyState({ form });
    onSafetyChange();
  };

  const handleReset = (event) => {
    const form = event.target;
    setTimer(() => {
      if (!form?.elements) return;
      const baseline = currentFormSnapshot(form);
      formBaselines.set(form, baseline);
      dirtyForms.delete(form);
      submittedForms.delete(form);
      onSafetyChange();
    }, 0);
  };

  listen(document, "focusin", handleFocusIn, true);
  listen(document, "input", handleInput, true);
  listen(document, "change", handleInput, true);
  listen(document, "submit", handleSubmit, true);
  listen(document, "reset", handleReset, true);

  const isSafe = () => {
    for (const form of dirtyForms) {
      if (!form.isConnected) dirtyForms.delete(form);
    }
    for (const control of dirtyControls) {
      if (!control.isConnected) dirtyControls.delete(control);
    }
    for (const form of submittedForms.keys()) {
      if (!form.isConnected) submittedForms.delete(form);
    }

    const activeElement = document.activeElement;
    const focusedEditable = Boolean(activeElement?.matches?.(EDITABLE_SELECTOR));
    return !focusedEditable
      && dirtyForms.size === 0
      && dirtyControls.size === 0
      && submittedForms.size === 0
      && activeMutations.size === 0;
  };

  const beginMutation = (config) => {
    const method = String(config?.method || "get").toLowerCase();
    if (!["post", "put", "patch", "delete"].includes(method)) return;
    if (config[UPDATE_REQUEST_ID] && activeMutations.has(config[UPDATE_REQUEST_ID])) return;
    const requestId = `${Date.now()}-${Math.random()}`;
    const submitted = Array.from(submittedForms.entries());
    activeMutations.set(requestId, submitted);
    config[UPDATE_REQUEST_ID] = requestId;
    onSafetyChange();
  };

  const finishMutation = (config, succeeded) => {
    const requestId = config?.[UPDATE_REQUEST_ID];
    if (!requestId || !activeMutations.has(requestId)) return;
    const submissions = activeMutations.get(requestId);
    activeMutations.delete(requestId);

    for (const [form, submission] of submissions) {
      const currentSubmission = submittedForms.get(form);
      if (!currentSubmission || currentSubmission.id !== submission.id) continue;

      if (succeeded && form.isConnected
        && sameSnapshot(currentFormSnapshot(form), submission.snapshot)) {
        formBaselines.set(form, submission.snapshot);
        dirtyForms.delete(form);
        submittedForms.delete(form);
      } else if (!succeeded) {
        submittedForms.delete(form);
      }
    }
    delete config[UPDATE_REQUEST_ID];
    onSafetyChange();
  };

  return {
    isSafe,
    beginMutation,
    finishMutation,
    setOnSafetyChange(callback) {
      onSafetyChange = callback;
    },
    destroy() {
      listeners.forEach((removeListener) => removeListener());
      listeners.length = 0;
    }
  };
}

export function trackPwaUpdateRequestStart(config) {
  activeSafetyTracker?.beginMutation(config);
}

export function trackPwaUpdateRequestFinish(config, succeeded) {
  activeSafetyTracker?.finishMutation(config, succeeded);
}

export function startPwaUpdateManager(buildId) {
  if (!("serviceWorker" in navigator)) return () => {};

  const safety = createPwaUpdateSafetyTracker({ document });
  activeSafetyTracker = safety;
  let registration = null;
  let pendingReload = false;
  let updateNotice = null;
  let retryTimer = null;
  let disposed = false;

  const isSafe = () => safety.isSafe();
  const getLastReloadedBuild = () => {
    try {
      return sessionStorage.getItem(`${RELOAD_KEY_PREFIX}${buildId}`);
    } catch (error) {
      console.warn("[PWA] Automatic reload is blocked because session storage is unavailable.", {
        name: error?.name || "SessionStorageUnavailable"
      });
      return buildId;
    }
  };

  const showNotice = (message) => {
    if (!document.body) return;
    if (!updateNotice) {
      updateNotice = document.createElement("section");
      updateNotice.setAttribute("role", "status");
      updateNotice.setAttribute("aria-live", "polite");
      Object.assign(updateNotice.style, {
        position: "fixed",
        zIndex: "2147483647",
        insetInline: "12px",
        bottom: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "14px 16px",
        borderRadius: "16px",
        background: "#0f172a",
        color: "#fff",
        boxShadow: "0 12px 30px rgba(0,0,0,.25)",
        font: "600 14px/1.6 system-ui, sans-serif",
        direction: "rtl"
      });

      const text = document.createElement("span");
      text.dataset.updateText = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "إعادة المحاولة";
      Object.assign(button.style, {
        border: "0",
        borderRadius: "10px",
        padding: "9px 12px",
        background: "#2563eb",
        color: "#fff",
        font: "inherit",
        whiteSpace: "nowrap"
      });
      button.addEventListener("click", () => {
        pendingReload = true;
        reloadWhenSafe();
      });
      updateNotice.append(text, button);
      document.body.append(updateNotice);
    }

    updateNotice.querySelector("[data-update-text]").textContent = message;
    updateNotice.querySelector("button").disabled = !isSafe();
  };

  const hideNotice = () => {
    updateNotice?.remove();
    updateNotice = null;
  };

  const reloadWhenSafe = () => {
    if (!pendingReload || !isSafe()) {
      if (pendingReload) showNotice("سيُحدّث سوقك الصفحة بعد انتهاء العمل الجاري أو حفظ التغييرات.");
      return;
    }
    if (!canReloadPwaBuild(buildId, getLastReloadedBuild(), true)) {
      showNotice("تعذر تحميل جزء من الصفحة. أغلق هذه الصفحة وافتحها مجددًا لتحديثها.");
      return;
    }
    try {
      sessionStorage.setItem(`${RELOAD_KEY_PREFIX}${buildId}`, buildId);
    } catch (error) {
      console.warn("[PWA] Automatic reload is blocked because session storage is unavailable.", {
        name: error?.name || "SessionStorageUnavailable"
      });
      showNotice("تعذر تحديث الصفحة تلقائيًا؛ أعد فتح التطبيق يدويًا.");
      return;
    }
    pendingReload = false;
    window.location.reload();
  };

  const checkForUpdate = createPwaUpdateCheckScheduler({
    update: async () => {
      if (!registration || disposed) throw new Error("Service worker registration is unavailable.");
      await registration.update();
    },
    isOnline: () => navigator.onLine !== false,
    onError: (error) => console.info("[PWA] Update check deferred until connectivity is available.", {
      name: error?.name || "UpdateCheckFailed"
    })
  });

  const handleControllerChange = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    const requestId = `${buildId}-${Date.now()}-${Math.random()}`;
    const handleBuildResponse = (event) => {
      if (event.data?.type !== "BUILD_ID_RESPONSE" || event.data.requestId !== requestId) return;
      navigator.serviceWorker.removeEventListener("message", handleBuildResponse);
      if (event.data.buildId === buildId) {
        pendingReload = false;
        hideNotice();
        return;
      }
      if (!shouldReloadForPwaController(buildId, event.data.buildId, getLastReloadedBuild())) {
        showNotice("تعذر تحديث الصفحة تلقائيًا؛ أعد فتح التطبيق يدويًا.");
        return;
      }
      pendingReload = true;
      reloadWhenSafe();
    };
    navigator.serviceWorker.addEventListener("message", handleBuildResponse);
    controller.postMessage({ type: "GET_BUILD_ID", requestId });
    window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", handleBuildResponse);
    }, 1500);
  };

  const scheduleSafetyCheck = () => {
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      reloadWhenSafe();
    }, 100);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    void checkForUpdate();
    scheduleSafetyCheck();
  };

  const onOnline = () => {
    void checkForUpdate().then((checked) => {
      if (checked || pendingReload) reloadWhenSafe();
    });
  };

  const onPreloadError = (event) => {
    event.preventDefault();
    pendingReload = true;
    showNotice("تعذر تحميل جزء من الصفحة. سيُعاد تحميلها بأمان بعد انتهاء عملك.");
    void checkForUpdate(true).then((checked) => {
      if (checked || navigator.onLine !== false) reloadWhenSafe();
    });
  };

  const onSafetyChange = () => {
    if (updateNotice) updateNotice.querySelector("button").disabled = !isSafe();
    if (!isSafe()) return;
    reloadWhenSafe();
  };

  safety.setOnSafetyChange(onSafetyChange);
  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  window.addEventListener("vite:preloadError", onPreloadError);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", scheduleSafetyCheck);
  window.addEventListener("souqak:pwa-update-safe", scheduleSafetyCheck);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("focusout", scheduleSafetyCheck, true);

  const register = async () => {
    try {
      const storeRegistration = window.__SOUQAK_STORE_PWA_REGISTRATION__;
      if (storeRegistration) {
        registration = await storeRegistration;
      } else {
        const currentRegistration = await navigator.serviceWorker.getRegistration(window.location.href);
        const scope = resolvePwaRegistrationScope(
          window.location.origin,
          window.__SOUQAK_STORE_PWA_APP__?.basePath,
          currentRegistration?.scope
        );
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope,
          updateViaCache: "none"
        });
      }
      const checked = await checkForUpdate(true);
      handleControllerChange();
      if (pendingReload && checked) reloadWhenSafe();
    } catch (error) {
      console.warn("[PWA] Service worker registration failed.", {
        name: error?.name || "RegistrationFailed"
      });
    }
  };

  const onLoad = () => { void register(); };
  if (document.readyState === "complete") onLoad();
  else window.addEventListener("load", onLoad, { once: true });

  return () => {
    disposed = true;
    safety.destroy();
    if (activeSafetyTracker === safety) activeSafetyTracker = null;
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    window.removeEventListener("vite:preloadError", onPreloadError);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", scheduleSafetyCheck);
    window.removeEventListener("souqak:pwa-update-safe", scheduleSafetyCheck);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("focusout", scheduleSafetyCheck, true);
    if (retryTimer !== null) window.clearTimeout(retryTimer);
  };
}
