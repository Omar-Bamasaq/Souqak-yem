import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminSupervisors() {
  const api = useApi();
  const [supervisors, setSupervisors] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", permissions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/supervisors");
      setSupervisors(response.data.supervisors || []);
      setPermissions(response.data.permissions || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحميل المشرفين.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const togglePermission = (key) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((value) => value !== key)
        : [...current.permissions, key]
    }));
  };

  const createSupervisor = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/supervisors", form);
      setForm({ name: "", email: "", password: "", permissions: [] });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر إنشاء المشرف.");
    } finally {
      setSaving(false);
    }
  };

  const updatePermissions = async (supervisor, key) => {
    const next = editingPermissions.includes(key)
      ? editingPermissions.filter((value) => value !== key)
      : [...editingPermissions, key];
    setEditingPermissions(next);
  };

  const startEditing = (supervisor) => {
    setEditingId(supervisor._id);
    setEditingPermissions(supervisor.permissions || []);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingPermissions([]);
  };

  const savePermissions = async (supervisor) => {
    try {
      await api.patch(`/admin/supervisors/${supervisor._id}`, { permissions: editingPermissions });
      setSupervisors((current) => current.map((item) => item._id === supervisor._id ? { ...item, permissions: editingPermissions } : item));
      cancelEditing();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحديث الصلاحيات.");
    }
  };

  const remove = async (supervisor) => {
    if (!window.confirm(`حذف حساب المشرف ${supervisor.name}؟`)) return;
    try {
      await api.delete(`/admin/supervisors/${supervisor._id}`);
      setSupervisors((current) => current.filter((item) => item._id !== supervisor._id));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر حذف المشرف.");
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-4 px-1 pb-6 sm:space-y-6 sm:px-0">
      <div className="px-1 sm:px-0">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">المشرفون والصلاحيات</h1>
        <p className="mt-1 text-xs font-bold leading-6 text-slate-500 sm:text-sm">إنشاء حسابات إدارية بصلاحيات محددة وإدارتها من مكان واحد.</p>
      </div>

      {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-xs font-bold leading-5 text-red-700 sm:px-4 sm:text-sm">{error}</div>}

      <form onSubmit={createSupervisor} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-black text-slate-900 sm:mb-4 sm:text-lg">إنشاء مشرف جديد</h2>
        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-3">
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="اسم المشرف" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
          <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="البريد الإلكتروني" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
          <input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="كلمة المرور" className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 lg:grid-cols-4">
          {permissions.map((permission) => (
            <label key={permission.key} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2 py-2.5 text-[11px] font-bold text-slate-700 sm:gap-3 sm:px-3 sm:text-sm">
              <input type="checkbox" checked={form.permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} className="h-5 w-5 shrink-0 accent-blue-600" />
              {permission.label}
            </label>
          ))}
        </div>
        <button disabled={saving} className="mt-4 min-h-12 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60 sm:mt-5 sm:w-auto">{saving ? "جاري الإنشاء..." : "إنشاء المشرف"}</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-3 py-3.5 sm:px-5 sm:py-4"><h2 className="text-sm font-black text-slate-900 sm:text-base">الحسابات الحالية</h2></div>
        {loading ? <div className="p-8 text-center text-xs font-bold text-slate-400 sm:text-sm">جاري التحميل...</div> : supervisors.length === 0 ? <div className="p-8 text-center text-xs font-bold text-slate-400 sm:text-sm">لا يوجد مشرفون بعد.</div> : (
          <div className="divide-y divide-slate-100">
            {supervisors.map((supervisor) => (
              <div key={supervisor._id} className="p-3 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 sm:text-base">{supervisor.name}</h3>
                    <p className="mt-1 break-all text-[11px] font-bold text-slate-500 sm:text-xs">{supervisor.email}</p>
                    {editingId !== supervisor._id && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(supervisor.permissions || []).length > 0 ? supervisor.permissions.map((permissionKey) => {
                          const permission = permissions.find((item) => item.key === permissionKey);
                          return permission ? <span key={permissionKey} className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700 sm:text-[11px]">{permission.label}</span> : null;
                        }) : <span className="text-xs font-bold text-slate-400">لا توجد صلاحيات مفعلة</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    {editingId === supervisor._id ? (
                      <>
                        <button onClick={() => savePermissions(supervisor)} className="min-h-10 flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white sm:flex-none">حفظ الصلاحيات</button>
                        <button onClick={cancelEditing} className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 sm:flex-none">إلغاء</button>
                      </>
                    ) : (
                      <button onClick={() => startEditing(supervisor)} className="min-h-10 flex-1 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 sm:flex-none">تعديل الصلاحيات</button>
                    )}
                    <button onClick={() => remove(supervisor)} className="min-h-10 flex-1 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700 sm:flex-none">حذف الحساب</button>
                  </div>
                </div>
                {editingId === supervisor._id && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {permissions.map((permission) => (
                      <label key={permission.key} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-2 py-2.5 text-[11px] font-bold text-slate-600 sm:gap-3 sm:px-3 sm:text-xs">
                        <input type="checkbox" checked={editingPermissions.includes(permission.key)} onChange={() => updatePermissions(supervisor, permission.key)} className="h-5 w-5 shrink-0 accent-blue-600" />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
