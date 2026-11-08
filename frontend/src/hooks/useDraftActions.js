import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const CHANGE_EVENT = "app:draft-actions-changed";

function draftKey(type, currentStep, data, references) {
  return JSON.stringify({ type, currentStep, data, ...references });
}

function notifyDraftChange(detail) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
}

export function useIncompleteActions(api, userId) {
  const queryClient = useQueryClient();
  const queryKey = ["draft-actions", userId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.get("/draft-actions");
      return response.data || [];
    },
    enabled: Boolean(userId),
    staleTime: 30_000
  });

  useEffect(() => {
    const onChange = (event) => {
      const { draft, removeId } = event.detail || {};
      if (removeId) {
        queryClient.setQueryData(queryKey, (current = []) => current.filter((item) => item._id !== removeId));
      }
      if (draft?.status === "incomplete" && String(draft.userId) === String(userId)) {
        queryClient.setQueryData(queryKey, (current = []) => [draft, ...current.filter((item) => item._id !== draft._id)]
          .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)));
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [queryClient, userId]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/draft-actions/${id}`);
      return id;
    },
    onSuccess: (id) => {
      notifyDraftChange({ removeId: id });
    }
  });
  const deleteDraft = useCallback(async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
      return true;
    } catch {
      return false;
    }
  }, [deleteMutation]);

  return {
    drafts: query.data || [],
    error: deleteMutation.error?.response?.data?.error
      || (query.error ? query.error.response?.data?.error || "تعذر تحميل العمليات غير المكتملة." : ""),
    deleteDraft
  };
}

export function useDraftAction(api, userId, type) {
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState("");
  const [error, setError] = useState("");
  const draftIdRef = useRef("");
  const timerRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const lastSavedKeyRef = useRef("");
  const scheduledKeyRef = useRef("");
  const mountedRef = useRef(true);
  const ownerRef = useRef(userId);
  const initialOwnerRef = useRef(null);
  const ownerChangedRef = useRef(false);

  useEffect(() => {
    ownerRef.current = userId;
    if (userId && !initialOwnerRef.current) initialOwnerRef.current = String(userId);
    else if (userId && initialOwnerRef.current !== String(userId)) ownerChangedRef.current = true;
    draftIdRef.current = "";
    lastSavedKeyRef.current = "";
    setDraftId("");
    setError(ownerChangedRef.current ? "تغير الحساب؛ أعد فتح العملية قبل المتابعة." : "");
  }, [userId, type]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const persist = useCallback((currentStep, data, references = {}) => {
    if (!userId) return Promise.reject(new Error("سجل الدخول أولًا لحفظ تقدمك."));
    if (ownerChangedRef.current) {
      const ownerError = new Error("تغير الحساب؛ أعد فتح العملية قبل المتابعة.");
      setError(ownerError.message);
      return Promise.reject(ownerError);
    }
    const saveOwner = userId;
    const key = draftKey(type, currentStep, data, references);
    window.clearTimeout(timerRef.current);
    scheduledKeyRef.current = "";
    if (key === lastSavedKeyRef.current) {
      return Promise.resolve(draftIdRef.current ? { _id: draftIdRef.current } : null);
    }
    window.clearTimeout(timerRef.current);
    const task = queueRef.current.catch(() => undefined).then(async () => {
      if (String(ownerRef.current) !== String(saveOwner)) return null;
      const response = await api.post("/draft-actions", {
        id: draftIdRef.current || undefined,
        type,
        currentStep,
        data,
        ...references
      });
      const draft = response.data;
      if (String(ownerRef.current) !== String(saveOwner)) return null;
      draftIdRef.current = draft._id;
      lastSavedKeyRef.current = key;
      scheduledKeyRef.current = "";
      if (mountedRef.current) {
        setDraftId(draft._id);
        setError("");
      }
      queryClient.setQueryData(["draft-actions", saveOwner], (current = []) => [
        draft,
        ...current.filter((item) => item._id !== draft._id)
      ].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)));
      notifyDraftChange({ draft });
      return draft;
    }).catch((saveError) => {
      if (mountedRef.current) {
        setError(saveError.response?.data?.error || "تعذر حفظ تقدمك. تحقق من الاتصال ثم حاول مجددًا.");
      }
      throw saveError;
    });
    queueRef.current = task;
    return task;
  }, [api, queryClient, type, userId]);

  const scheduleSave = useCallback((currentStep, data, references = {}, delay = 1000) => {
    if (!userId) return;
    const key = draftKey(type, currentStep, data, references);
    if (!draftIdRef.current && !Object.values(data || {}).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim().length > 0;
      return value !== null && value !== undefined && value !== 1;
    }) && !Object.values(references).some(Boolean)) return;
    if (key === lastSavedKeyRef.current || key === scheduledKeyRef.current) return;
    window.clearTimeout(timerRef.current);
    scheduledKeyRef.current = key;
    timerRef.current = window.setTimeout(() => {
      scheduledKeyRef.current = "";
      persist(currentStep, data, references).catch(() => {});
    }, delay);
  }, [persist, type]);

  const resume = useCallback(async (id) => {
    if (!userId) throw new Error("سجل الدخول أولًا لاستئناف العملية.");
    if (ownerChangedRef.current) throw new Error("تغير الحساب؛ أعد فتح العملية قبل المتابعة.");
    const resumeOwner = userId;
    const response = await api.get(`/draft-actions/${id}/resume`);
    const draft = response.data;
    if (String(ownerRef.current) !== String(resumeOwner)) {
      throw new Error("تغير الحساب قبل اكتمال الاستئناف. حاول مرة أخرى.");
    }
    draftIdRef.current = draft._id;
    setDraftId(draft._id);
    const references = {
      ...(draft.planId ? { planId: draft.planId } : {}),
      ...(draft.adId ? { adId: draft.adId } : {}),
      ...(draft.serviceId ? { serviceId: draft.serviceId } : {}),
      ...(draft.sectionId ? { sectionId: draft.sectionId } : {})
    };
    lastSavedKeyRef.current = draftKey(draft.type, draft.currentStep, draft.data || {}, references);
    scheduledKeyRef.current = "";
    setError("");
    return draft;
  }, [api, userId]);

  const clear = useCallback(() => {
    window.clearTimeout(timerRef.current);
    draftIdRef.current = "";
    lastSavedKeyRef.current = "";
    scheduledKeyRef.current = "";
    setDraftId("");
    setError("");
  }, []);

  const removeDraft = useCallback((id) => {
    queryClient.setQueryData(["draft-actions", userId], (current = []) => current.filter((item) => item._id !== id));
    notifyDraftRemoved(id);
  }, [queryClient, userId]);

  return { draftId, error, scheduleSave, persist, resume, clear, removeDraft };
}

export function notifyDraftRemoved(id) {
  notifyDraftChange({ removeId: id });
}
