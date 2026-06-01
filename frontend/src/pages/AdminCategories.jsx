import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCategoryApi } from "../api/categories.js";
import { useCategoryAttributeApi } from "../api/categoryAttributes.js";
import { uploadsUrl } from "../lib/uploads.js";

const API_BASE_URL = "http://localhost:5000";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [moveOptions, setMoveOptions] = useState({ moveAdsTo: "", moveChildrenTo: "" });
  const [stats, setStats] = useState(null);
  
  // Attribute management state
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [attributeForm, setAttributeForm] = useState({
    name: "",
    label: "",
    type: "text",
    options: [],
    required: false,
    sortOrder: 0,
    placeholder: "",
    helpText: ""
  });
  const [newOption, setNewOption] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parentId: "",
    sortOrder: 0,
    status: "active",
    image: null,
    imagePreview: ""
  });

  const categoryApi = useCategoryApi();
  const attributeApi = useCategoryAttributeApi();

  useEffect(() => {
    loadCategories();
    loadStats();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryApi.getCategories({ admin: true });
      setCategories(response.data);
    } catch (error) {
      console.error("Error loading categories:", error);
      alert("فشل في تحميل الفئات");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await categoryApi.getCategoryStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description || "");
      formDataToSend.append("parentId", formData.parentId || "");
      formDataToSend.append("sortOrder", formData.sortOrder || 0);
      formDataToSend.append("status", formData.status || "active");
      
      if (formData.image && formData.image instanceof File) {
        formDataToSend.append("image", formData.image);
      }

      if (editingCategory) {
        await categoryApi.updateCategory(editingCategory.id, formDataToSend);
      } else {
        await categoryApi.createCategory(formDataToSend);
      }

      setShowModal(false);
      resetForm();
      loadCategories();
      loadStats();
    } catch (error) {
      console.error("Error saving category:", error);
      alert(error.response?.data?.error || "فشل في حفظ الفئة");
    }
  };

  const handleDelete = async () => {
    try {
      await categoryApi.deleteCategory(categoryToDelete.id, {
        moveAdsTo: moveOptions.moveAdsTo || undefined,
        moveChildrenTo: moveOptions.moveChildrenTo || undefined
      });

      setShowDeleteModal(false);
      setCategoryToDelete(null);
      setMoveOptions({ moveAdsTo: "", moveChildrenTo: "" });
      loadCategories();
      loadStats();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert(error.response?.data?.error || error.response?.data?.message || "فشل في حذف الفئة");
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCategories(items);

    try {
      const reorderData = items.map((item, index) => ({
        id: item.id,
        parentId: item.parentId,
        sortOrder: index
      }));
      await categoryApi.reorderCategories(reorderData);
    } catch (error) {
      console.error("Error reordering categories:", error);
      loadCategories();
    }
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      parentId: category.parentId || "",
      sortOrder: category.sortOrder || 0,
      status: category.status,
      image: null,
      imagePreview: category.image || ""
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    resetForm();
    setShowModal(true);
  };

  const openDeleteModal = (category) => {
    setCategoryToDelete(category);
    setMoveOptions({ moveAdsTo: "", moveChildrenTo: "" });
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      parentId: "",
      sortOrder: 0,
      status: "active",
      image: null,
      imagePreview: ""
    });
  };

  const refreshStats = async () => {
    try {
      await categoryApi.refreshStats();
      loadStats();
      loadCategories();
      alert("تم تحديث الإحصائيات بنجاح");
    } catch (error) {
      console.error("Error refreshing stats:", error);
      alert("فشل في تحديث الإحصائيات");
    }
  };

  const getParentName = (parentId) => {
    if (!parentId) return "-";
    const parent = categories.find(c => c.id === parentId || c._id === parentId);
    return parent ? parent.name : "-";
  };

  const getCategoryLevel = (category) => {
    let level = 0;
    let current = category;
    while (current.parentId) {
      level++;
      current = categories.find(c => c.id === current.parentId || c._id === current.parentId);
      if (!current) break;
    }
    return level;
  };

  // Attribute management functions
  const openAttributeModal = async (category) => {
    setSelectedCategory(category);
    setShowAttributeModal(true);
    await loadAttributes(category.id || category._id);
  };

  const loadAttributes = async (categoryId) => {
    try {
      const response = await attributeApi.getCategoryAttributes(categoryId);
      setAttributes(response.data);
    } catch (error) {
      console.error("Error loading attributes:", error);
      alert("فشل في تحميل الخصائص");
    }
  };

  const resetAttributeForm = () => {
    setAttributeForm({
      name: "",
      label: "",
      type: "text",
      options: [],
      required: false,
      sortOrder: 0,
      placeholder: "",
      helpText: ""
    });
    setNewOption("");
    setEditingAttribute(null);
  };

  const handleAttributeSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...attributeForm,
        categoryId: selectedCategory.id || selectedCategory._id
      };

      if (editingAttribute) {
        await attributeApi.updateAttribute(editingAttribute.id || editingAttribute._id, data);
      } else {
        await attributeApi.createAttribute(data);
      }

      resetAttributeForm();
      await loadAttributes(selectedCategory.id || selectedCategory._id);
    } catch (error) {
      console.error("Error saving attribute:", error);
      alert(error.response?.data?.error || "فشل في حفظ الخاصية");
    }
  };

  const handleDeleteAttribute = async (attribute) => {
    if (!confirm(`هل أنت متأكد من حذف الخاصية "${attribute.label}"؟`)) return;
    
    try {
      await attributeApi.deleteAttribute(attribute.id || attribute._id);
      await loadAttributes(selectedCategory.id || selectedCategory._id);
    } catch (error) {
      console.error("Error deleting attribute:", error);
      alert("فشل في حذف الخاصية");
    }
  };

  const openEditAttribute = (attribute) => {
    setEditingAttribute(attribute);
    setAttributeForm({
      name: attribute.name,
      label: attribute.label,
      type: attribute.type,
      options: attribute.options || [],
      required: attribute.required,
      sortOrder: attribute.sortOrder,
      placeholder: attribute.placeholder || "",
      helpText: attribute.helpText || ""
    });
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setAttributeForm({
      ...attributeForm,
      options: [...attributeForm.options, newOption.trim()]
    });
    setNewOption("");
  };

  const removeOption = (index) => {
    setAttributeForm({
      ...attributeForm,
      options: attributeForm.options.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <h1 className="text-xl font-black text-gray-900">إدارة الفئات</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={refreshStats}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all border border-gray-100"
          >
            تحديث الإحصائيات
          </button>
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
          >
            + إضافة فئة
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">إجمالي الفئات</p>
            <p className="text-xl font-black text-gray-900">{stats.totalCategories}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">الفئات الرئيسية</p>
            <p className="text-xl font-black text-gray-900">{stats.mainCategories}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">الفئات الفرعية</p>
            <p className="text-xl font-black text-gray-900">{stats.subCategories}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">إجمالي الإعلانات</p>
            <p className="text-xl font-black text-blue-600">{stats.totalAds || 0}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 font-bold animate-pulse">جاري تحميل الفئات...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden sm:grid grid-cols-[48px_1fr_150px_100px_100px_150px] gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100 items-center">
            <div className="w-8"></div>
            <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">الفئة</div>
            <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الفئة الأم</div>
            <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الإعلانات</div>
            <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">الحالة</div>
            <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider text-left">إجراءات</div>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="categories">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="divide-y divide-gray-50"
                >
                  {categories.map((category, index) => (
                    <Draggable
                      key={category.id || category._id}
                      draggableId={category.id || category._id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`transition-all ${
                            snapshot.isDragging ? "bg-blue-50/50 z-50 ring-2 ring-blue-100 shadow-xl" : "bg-white hover:bg-gray-50/30"
                          } ${category.status === "hidden" ? "opacity-60 grayscale-[0.5]" : ""}`}
                          style={{
                            ...provided.draggableProps.style,
                          }}
                        >
                          {/* Desktop View Row */}
                          <div 
                            className="hidden sm:grid grid-cols-[48px_1fr_150px_100px_100px_150px] gap-4 px-6 py-4 items-center group"
                            style={{
                              marginRight: `${getCategoryLevel(category) * 32}px`
                            }}
                          >
                            <div {...provided.dragHandleProps} className="p-2 text-gray-300 hover:text-blue-500 cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                                {category.image ? (
                                  <img
                                    src={`${API_BASE_URL}${category.image}`}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-gray-300">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 text-sm truncate">{category.name}</h3>
                                {category.description && (
                                  <p className="text-[10px] text-gray-400 truncate max-w-[200px] font-medium">{category.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="text-center">
                              <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                {getParentName(category.parentId)}
                              </span>
                            </div>

                            <div className="text-center">
                              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                {category.adCount || 0}
                              </span>
                            </div>

                            <div className="text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${
                                category.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                              }`}>
                                {category.status === "active" ? "نشط" : "مخفي"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => openEditModal(category)}
                                className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all active:scale-95"
                                title="تعديل"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button
                                onClick={() => openAttributeModal(category)}
                                className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 transition-all active:scale-95"
                                title="الخصائص"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(category)}
                                className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-95"
                                title="حذف"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>

                          {/* Mobile View Card */}
                          <div 
                            className="block sm:hidden p-4 space-y-3 relative group"
                            style={{
                              marginRight: `${getCategoryLevel(category) * 16}px`
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="p-1 text-gray-300 active:text-blue-500 cursor-grab active:cursor-grabbing">
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8h16M4 16h16" />
                                  </svg>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                                  {category.image ? (
                                    <img
                                      src={`${API_BASE_URL}${category.image}`}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-300">
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-black text-gray-900 text-sm">{category.name}</h3>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black border ${
                                    category.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                  }`}>
                                    {category.status === "active" ? "نشط" : "مخفي"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-left">
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                  {category.adCount || 0} إعلان
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                              <span className="text-[10px] font-bold text-gray-400">الفئة الأم: {getParentName(category.parentId)}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditModal(category)}
                                  className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 active:scale-90 transition-all"
                                  title="تعديل"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => openAttributeModal(category)}
                                  className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 active:scale-90 transition-all"
                                  title="الخصائص"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                                </button>
                                <button
                                  onClick={() => openDeleteModal(category)}
                                  className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 active:scale-90 transition-all"
                                  title="حذف"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {categories.length === 0 && (
            <div className="py-20 text-center">
              <div className="bg-gray-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <p className="text-sm font-bold text-gray-400">لا توجد فئات حالياً.</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[70vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <h2 className="text-sm font-black text-gray-900">
                {editingCategory ? "تعديل الفئة" : "إضافة فئة جديدة"}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all active:scale-95 border border-transparent hover:border-gray-100 shadow-sm hover:shadow-md"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
              <form id="categoryForm" onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">اسم الفئة</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="أدخل اسم الفئة..."
                      className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">صورة الفئة (اختياري)</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center relative group">
                        {formData.imagePreview ? (
                          <>
                            <img 
                              src={formData.image instanceof File ? formData.imagePreview : uploadsUrl(formData.imagePreview)} 
                              alt="Category Preview" 
                              className="w-full h-full object-cover" 
                            />
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, image: null, imagePreview: "" })}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </>
                        ) : (
                          <div className="text-gray-300">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                      </div>
                      <label className="flex-1">
                        <div className="w-full h-10 rounded-xl border-2 border-dashed border-gray-100 hover:border-blue-500/30 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                          <span className="text-[10px] font-black text-blue-600 uppercase">اختر صورة</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setFormData({
                                ...formData,
                                image: file,
                                imagePreview: URL.createObjectURL(file)
                              });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الوصف</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="وصف مختصر للفئة..."
                      rows={3}
                      className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الفئة الأم</label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                        className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                      >
                        <option value="">فئة رئيسية</option>
                        {categories
                          .filter(c => (c.id || c._id) !== editingCategory?.id)
                          .map((cat) => (
                            <option key={cat.id || cat._id} value={cat.id || cat._id}>
                              {cat.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الحالة</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                      >
                        <option value="active">نشطة</option>
                        <option value="hidden">مخفية</option>
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-3 gap-2 border-t border-gray-50 flex shrink-0">
              <button
                form="categoryForm"
                type="submit"
                className="flex-[2] bg-blue-600 text-white py-2.5 rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                حفظ الفئة
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-black hover:bg-gray-200 transition-all active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[70vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <h3 className="text-sm font-black text-gray-900">تأكيد الحذف</h3>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                <div className="w-12 h-12 bg-white text-red-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm border border-red-50">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-gray-700">
                  هل أنت متأكد من حذف الفئة <span className="text-red-600 font-black">"{categoryToDelete?.name}"</span>؟
                </p>
                <p className="text-[10px] text-gray-500 mt-1">لا يمكن التراجع عن هذا الإجراء.</p>
              </div>

              {categoryToDelete && categories.some(c => c.parentId === categoryToDelete.id || c.parentId === categoryToDelete._id) && (
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                    نقل الفئات الفرعية إلى:
                  </label>
                  <select
                    value={moveOptions.moveChildrenTo}
                    onChange={(e) => setMoveOptions({ ...moveOptions, moveChildrenTo: e.target.value })}
                    className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                  >
                    <option value="">-- جعلها فئات رئيسية --</option>
                    {categories
                      .filter(c => (c.id !== categoryToDelete.id && c._id !== categoryToDelete._id))
                      .map((cat) => (
                        <option key={cat.id || cat._id} value={cat.id || cat._id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                  نقل الإعلانات إلى: {categories.some(c => (c.parentId === categoryToDelete.id || c.parentId === categoryToDelete._id)) ? "(اختياري)" : "(مطلوب)"}
                </label>
                <select
                  value={moveOptions.moveAdsTo}
                  onChange={(e) => setMoveOptions({ ...moveOptions, moveAdsTo: e.target.value })}
                  className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                >
                  <option value="">-- اختر فئة --</option>
                  {categories
                    .filter(c => (c.id !== categoryToDelete.id && c._id !== categoryToDelete._id))
                    .map((cat) => (
                      <option key={cat.id || cat._id} value={cat.id || cat._id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="p-3 gap-2 border-t border-gray-50 flex shrink-0">
              <button
                onClick={handleDelete}
                className="flex-[2] bg-red-600 text-white py-2.5 rounded-xl text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                تأكيد الحذف
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-xs font-black hover:bg-gray-200 transition-all active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Management Modal */}
      {showAttributeModal && selectedCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => {
          setShowAttributeModal(false);
          setSelectedCategory(null);
          resetAttributeForm();
        }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <h2 className="text-sm font-black text-gray-900">خصائص الفئة: {selectedCategory.name}</h2>
              <button
                onClick={() => {
                  setShowAttributeModal(false);
                  setSelectedCategory(null);
                  resetAttributeForm();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-3 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 -translate-x-16 -translate-y-16 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                
                <h3 className="text-xs font-black text-blue-900 mb-3 flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                    {editingAttribute ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    )}
                  </div>
                  {editingAttribute ? "تعديل خاصية" : "إضافة خاصية جديدة"}
                </h3>
                
                <form onSubmit={handleAttributeSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الاسم (بالإنجليزية)</label>
                      <input
                        type="text"
                        value={attributeForm.name}
                        onChange={(e) => setAttributeForm({ ...attributeForm, name: e.target.value })}
                        placeholder="مثال: brand"
                        required
                        disabled={editingAttribute}
                        className="w-full bg-white border-blue-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all outline-none disabled:bg-blue-50/50 disabled:text-blue-400"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">العنوان (بالعربية)</label>
                      <input
                        type="text"
                        value={attributeForm.label}
                        onChange={(e) => setAttributeForm({ ...attributeForm, label: e.target.value })}
                        placeholder="مثال: الماركة"
                        required
                        className="w-full bg-white border-blue-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">نوع البيانات</label>
                      <select
                        value={attributeForm.type}
                        onChange={(e) => setAttributeForm({ ...attributeForm, type: e.target.value })}
                        className="w-full bg-white border-blue-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                      >
                        <option value="text">نص حر</option>
                        <option value="number">رقم</option>
                        <option value="select">قائمة منسدلة</option>
                        <option value="checkbox">مربع اختيار</option>
                      </select>
                    </div>
                    
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 cursor-pointer bg-white px-5 py-3.5 rounded-2xl border border-blue-100 w-full hover:bg-blue-50/50 transition-all group/check">
                        <input
                          type="checkbox"
                          checked={attributeForm.required}
                          onChange={(e) => setAttributeForm({ ...attributeForm, required: e.target.checked })}
                          className="w-5 h-5 rounded-lg border-blue-200 text-blue-600 focus:ring-blue-500/20"
                        />
                        <span className="text-sm font-black text-gray-700 group-hover/check:text-blue-600 transition-colors">هذه الخاصية مطلوبة</span>
                      </label>
                    </div>
                  </div>

                  {(attributeForm.type === "select" || attributeForm.type === "multiselect") && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">الخيارات (افصل بينها بفاصلة)</label>
                      <textarea
                        value={attributeForm.options.join(",")}
                        onChange={(e) => setAttributeForm({ ...attributeForm, options: e.target.value.split(",").map(s => s.trim()) })}
                        placeholder="مثال: تويوتا, نيسان, هوندا"
                        rows={2}
                        className="w-full bg-white border-blue-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 transition-all outline-none resize-none"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-[2] bg-blue-600 text-white py-3.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {editingAttribute ? "تحديث الخاصية" : "إضافة الخاصية"}
                    </button>
                    {editingAttribute && (
                      <button
                        type="button"
                        onClick={resetAttributeForm}
                        className="flex-1 bg-white text-gray-600 py-3.5 rounded-2xl text-sm font-black border border-blue-100 hover:bg-gray-50 transition-all active:scale-95"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Attributes List */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-gray-900 px-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  الخصائص الحالية ({attributes.length})
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  {attributes.length > 0 ? (
                    attributes.map((attr, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-all">
                              <span className="text-xs font-black">{attr.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-gray-900">{attr.label}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{attr.name}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg">{attr.type}</span>
                                {attr.required && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-gray-200"></span>
                                    <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">مطلوب</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditAttribute(attr)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                              title="تعديل"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteAttribute(attr)}
                              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                              title="حذف"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300 shadow-sm border border-gray-50">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      </div>
                      <p className="text-gray-400 font-bold text-sm">لا توجد خصائص مضافة لهذه الفئة حتى الآن</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
