import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCategoryApi } from "../api/categories.js";

function CategoryItem({ category, level = 0 }) {
  const [isOpen, setIsOpen] = useState(level === 0); // Auto open main categories
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-2 px-3 hover:bg-gray-100 rounded-lg cursor-pointer ${
          level > 0 ? "mr-4" : ""
        }`}
        style={{ paddingRight: `${level * 16 + 12}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-6"></div>}
        <Link
          to={`/category/${category.slug}`}
          className="flex-1 text-gray-700 hover:text-emerald-600 font-medium"
        >
          {category.name}
        </Link>
        <span className="text-xs text-gray-400 mr-2">({category.adCount || 0})</span>
      </div>
      {isOpen && hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryItem key={child.id || child._id} category={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryTree({ onSelect, showCount = true }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const categoryApi = useCategoryApi();
  const navigate = useNavigate();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryApi.getCategoryTree();
      setCategories(response.data);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="font-semibold text-gray-900 mb-4">الفئات</h3>
      <div className="space-y-1">
        {categories.map((category) => (
          <CategoryItem key={category.id || category._id} category={category} />
        ))}
      </div>
    </div>
  );
}
