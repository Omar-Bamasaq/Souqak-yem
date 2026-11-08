import { useEffect } from "react";

const FORM_ERROR_SELECTOR = '[role="alert"], .bg-red-50, .bg-rose-50, .text-red-700, .text-red-600, .text-red-500';

function scrollToElement(element) {
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

  if (element instanceof HTMLElement) {
    element.focus({ preventScroll: true });
  }
}

function findVisibleFormError(form) {
  return Array.from(form.querySelectorAll(FORM_ERROR_SELECTOR)).find((element) => (
    element.textContent.trim().length > 1 && element.getClientRects().length > 0
  ));
}

export default function FormErrorNavigation() {
  useEffect(() => {
    const observers = new Map();
    let invalidField = null;
    let invalidFrame = null;

    const handleInvalid = (event) => {
      if (!(event.target instanceof HTMLElement) || invalidFrame !== null) return;
      invalidField = event.target;
      invalidFrame = window.requestAnimationFrame(() => {
        invalidField.focus({ preventScroll: true });
        scrollToElement(invalidField);
        invalidField = null;
        invalidFrame = null;
      });
    };

    const handleSubmit = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      observers.get(form)?.();

      let timeoutId;
      let frameId;
      const observer = new MutationObserver(() => {
        frameId = window.requestAnimationFrame(() => {
          const error = findVisibleFormError(form);
          if (error) {
            scrollToElement(error);
            cleanup();
          }
        });
      });

      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
        if (frameId !== undefined) window.cancelAnimationFrame(frameId);
        observers.delete(form);
      };

      observer.observe(form, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      });
      observers.set(form, cleanup);
      timeoutId = window.setTimeout(cleanup, 15000);
      frameId = window.requestAnimationFrame(() => {
        const error = findVisibleFormError(form);
        if (error) {
          scrollToElement(error);
          cleanup();
        }
      });
    };

    document.addEventListener("invalid", handleInvalid, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      document.removeEventListener("invalid", handleInvalid, true);
      document.removeEventListener("submit", handleSubmit, true);
      observers.forEach((cleanup) => cleanup());
      if (invalidFrame !== null) window.cancelAnimationFrame(invalidFrame);
    };
  }, []);

  return null;
}
