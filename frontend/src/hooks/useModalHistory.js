import { useCallback, useEffect, useRef } from "react";

const MODAL_STACK_KEY = "__souqakModalStack";

const getModalStack = (state) => (
  state && typeof state === "object" && Array.isArray(state[MODAL_STACK_KEY])
    ? state[MODAL_STACK_KEY]
    : []
);

export default function useModalHistory(isOpen, onClose) {
  const tokenRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const afterCloseRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const token = window.crypto?.randomUUID?.() || `modal-${Date.now()}-${Math.random()}`;
    const currentState = window.history.state;
    const nextState = currentState && typeof currentState === "object" ? currentState : {};
    window.history.pushState(
      { ...nextState, [MODAL_STACK_KEY]: [...getModalStack(currentState), token] },
      "",
      window.location.href
    );
    tokenRef.current = token;

    const handlePopState = (event) => {
      if (getModalStack(event.state).includes(token)) return;

      tokenRef.current = null;
      onCloseRef.current();
      const afterClose = afterCloseRef.current;
      afterCloseRef.current = null;
      afterClose?.();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (tokenRef.current !== token) return;

      tokenRef.current = null;
      const stack = getModalStack(window.history.state);
      if (stack[stack.length - 1] === token) {
        window.history.back();
      }
    };
  }, [isOpen]);

  return useCallback((afterClose = null) => {
    const token = tokenRef.current;
    const stack = getModalStack(window.history.state);
    if (token && stack[stack.length - 1] === token) {
      afterCloseRef.current = afterClose;
      window.history.back();
      return;
    }

    onCloseRef.current();
    afterClose?.();
  }, []);
}
