import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";

export default function AdminTags() {
  const api = useApi();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    color: "#6366f1",
    isPopular: false,
    order: 0
  });

  const loadTags = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tags");
      setTags(res.data || []);
    } catch {
      setError("تعذر تحميل الوسوم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      color: "#6366f1",
      isPopular: false,
      order: 0
    });
    setEditingTag(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    try {
      if (editingTag) {
        await api.patch(`/tags/${editingTag._id}`, formData);
        setSuccess("تم تحديث الوسم بنجاح");
      } else {
        await api.post("/tags", formData);
        setSuccess("تم إنشاء الوسم بنجاح");
      }
      resetForm();
      loadTags();
    } catch (err) {
      setError(err.response?.data?.error || "تعذر حفظ الوسم");
    }
  };

  const handleEdit = (tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      slug: tag.slug,
      description: tag.description || "",
      color: tag.color || "#6366f1",
      isPopular: tag.isPopular || false,
      order: tag.order || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("هل أنت متأكد من حذف هذا الوسم؟")) return;
    
    try {
      await api.delete(`/tags/${id}`);
      setSuccess("تم حذف الوسم بنجاح");
      loadTags();
    } catch {
      setError("تعذر حذف الوسم");
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">إدارة الوسوم</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
            showForm 
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
          }`}
        >
          {showForm ? "إلغاء" : "+ إضافة وسم"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-bold text-red-700 animate-shake">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm font-bold text-green-700 animate-fade-in">
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1">الاسم</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    name,
                    slug: editingTag ? prev.slug : generateSlug(name)
                  }));
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1">الرابط (Slug)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1">الوصف</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1">اللون</label>
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 p-2 rounded-xl">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="h-9 w-16 rounded-lg border-none cursor-pointer"
                />
                <span className="text-xs font-black text-gray-500 font-mono">{formData.color}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1">الترتيب</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPopular: e.target.checked }))}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="mr-3 text-sm font-black text-gray-700">وسم شائع</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-50">
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">
              {editingTag ? "تحديث الوسم" : "إنشاء الوسم"}
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[11px] font-black text-gray-400 animate-pulse">جاري تحميل الوسوم...</p>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hidden sm:block">
            <table className="w-full text-right text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الوسم</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider">الرابط</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">شائع</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الترتيب</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tags.map((tag) => (
                  <tr key={tag._id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full ring-4 ring-gray-50 shadow-sm"
                          style={{ backgroundColor: tag.color || "#6366f1" }}
                        />
                        <span className="font-bold text-gray-900">{tag.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-400">{tag.slug}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {tag.isPopular ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">نعم</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-50 text-gray-600 border border-gray-100">لا</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        {tag.order}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleEdit(tag)}
                          className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all"
                          title="تعديل"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(tag._id)}
                          className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all"
                          title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tags.length === 0 && (
              <div className="py-12 text-center">
                <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                </div>
                <p className="text-sm font-bold text-gray-400">لا توجد وسوم حالياً.</p>
              </div>
            )}
          </div>

          {/* Mobile View */}
          <div className="sm:hidden space-y-3">
            {tags.map((tag) => (
              <div key={tag._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 active:scale-[0.98] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-3 w-3 rounded-full ring-2 ring-gray-50"
                      style={{ backgroundColor: tag.color || "#6366f1" }}
                    />
                    <h3 className="font-black text-gray-900 text-sm">{tag.name}</h3>
                  </div>
                  {tag.isPopular && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">شائع</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400">الترتيب: {tag.order}</span>
                    <span className="text-[10px] font-mono text-gray-300">{tag.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 active:scale-90 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(tag._id)}
                      className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 active:scale-90 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {tags.length === 0 && (
              <div className="bg-white p-8 text-center rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-400 font-bold">لا توجد وسوم حالياً.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
