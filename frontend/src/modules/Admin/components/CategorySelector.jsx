import { useState, useRef, useEffect, useMemo } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useCategoryStore } from "../../../shared/store/categoryStore";

const CategorySelector = ({
  value,
  subcategoryId,
  onChange,
  isCustomCategory = false,
  customCategoryName = "",
  customParentCategoryId = "",
  allowCustom = true,
  required = false,
  className = "",
  isRefurbished = false,
}) => {
  const {
    categories,
    getRootCategories,
    getCategoriesByParent,
    getCategoryById,
  } = useCategoryStore();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const containerRef = useRef(null);
  const parentDropdownRef = useRef(null);
  const subcategoryDropdownRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const isCustomActive = isCustomCategory || value === "__custom__";

  // Get root categories (parent categories)
  const rootCategories = useMemo(() => {
    return getRootCategories().filter((cat) => {
      const activeMatch = cat.isActive !== false && cat.status !== 'rejected';
      const refurbishedMatch = isRefurbished
        ? cat.isRefurbishedCategory === true
        : !cat.isRefurbishedCategory;
      return activeMatch && refurbishedMatch;
    });
  }, [categories, getRootCategories, isRefurbished]);

  // Get selected category and subcategory info
  const selectedCategory = value && value !== "__custom__" ? getCategoryById(value) : null;
  const selectedSubcategory = subcategoryId
    ? getCategoryById(subcategoryId)
    : null;
  const parentCategory = selectedSubcategory
    ? getCategoryById(selectedSubcategory.parentId)
    : selectedCategory;

  // Get subcategories for hovered category
  const hoveredSubcategories = useMemo(() => {
    if (!hoveredCategoryId) return [];
    return getCategoriesByParent(hoveredCategoryId).filter((cat) => {
      const activeMatch = cat.isActive !== false && cat.status !== 'rejected';
      const refurbishedMatch = isRefurbished
        ? cat.isRefurbishedCategory === true
        : !cat.isRefurbishedCategory;
      return activeMatch && refurbishedMatch;
    });
  }, [hoveredCategoryId, categories, getCategoriesByParent, isRefurbished]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setHoveredCategoryId(null);
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, []);

  // Position subcategory dropdown
  useEffect(() => {
    if (
      hoveredCategoryId &&
      subcategoryDropdownRef.current &&
      parentDropdownRef.current &&
      containerRef.current
    ) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const parentDropdownRect =
        parentDropdownRef.current.getBoundingClientRect();
      const hoveredElement = parentDropdownRef.current.querySelector(
        `[data-category-id="${hoveredCategoryId}"]`
      );

      if (hoveredElement) {
        const elementRect = hoveredElement.getBoundingClientRect();
        const dropdown = subcategoryDropdownRef.current;
        const viewportWidth = window.innerWidth;
        const dropdownWidth = 200;

        let left = parentDropdownRect.right - containerRect.left + 8;
        let top = elementRect.top - containerRect.top;

        const rightEdge = parentDropdownRect.right + dropdownWidth + 8;
        if (rightEdge > viewportWidth - 20) {
          left =
            parentDropdownRect.left - containerRect.left - dropdownWidth - 8;
        }

        if (top < 0) top = 0;
        const maxTop = parentDropdownRect.height - 40;
        if (top > maxTop) top = maxTop;

        dropdown.style.top = `${top}px`;
        dropdown.style.left = `${left}px`;
      }
    }
  }, [hoveredCategoryId, isOpen]);

  const handleCategorySelect = (categoryId) => {
    onChange({
      target: {
        name: "isCustomCategory",
        value: false,
      },
    });
    onChange({
      target: {
        name: "customCategoryName",
        value: "",
      },
    });
    onChange({
      target: {
        name: "customParentCategoryId",
        value: "",
      },
    });
    onChange({
      target: {
        name: "categoryId",
        value: categoryId,
      },
    });
    onChange({
      target: {
        name: "subcategoryId",
        value: "",
      },
    });
    setIsOpen(false);
    setHoveredCategoryId(null);
  };

  const handleSubcategorySelect = (subcategoryId, parentId) => {
    onChange({
      target: {
        name: "isCustomCategory",
        value: false,
      },
    });
    onChange({
      target: {
        name: "customCategoryName",
        value: "",
      },
    });
    onChange({
      target: {
        name: "customParentCategoryId",
        value: "",
      },
    });
    onChange({
      target: {
        name: "categoryId",
        value: parentId,
      },
    });
    onChange({
      target: {
        name: "subcategoryId",
        value: subcategoryId,
      },
    });
    setIsOpen(false);
    setHoveredCategoryId(null);
  };

  const handleStartCustomCategory = () => {
    onChange({
      target: {
        name: "isCustomCategory",
        value: true,
      },
    });
    onChange({
      target: {
        name: "categoryId",
        value: "__custom__",
      },
    });
    onChange({
      target: {
        name: "subcategoryId",
        value: "",
      },
    });
    setIsOpen(false);
    setHoveredCategoryId(null);
  };

  const handleCancelCustomCategory = () => {
    onChange({
      target: {
        name: "isCustomCategory",
        value: false,
      },
    });
    onChange({
      target: {
        name: "customCategoryName",
        value: "",
      },
    });
    onChange({
      target: {
        name: "customParentCategoryId",
        value: "",
      },
    });
    onChange({
      target: {
        name: "categoryId",
        value: "",
      },
    });
    onChange({
      target: {
        name: "subcategoryId",
        value: "",
      },
    });
  };

  // Display text
  const displayText = useMemo(() => {
    if (isCustomActive) {
      return customCategoryName ? `Custom: ${customCategoryName}` : "✨ Add Custom Category (Under Review)";
    }
    if (selectedSubcategory && parentCategory) {
      return `${parentCategory.name} (${selectedSubcategory.name})`;
    }
    if (selectedCategory) {
      return selectedCategory.name;
    }
    return "Select Category";
  }, [selectedCategory, selectedSubcategory, parentCategory, isCustomActive, customCategoryName]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Category Header Row with "+ Not Listed" Quick Trigger */}
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-700">
          Category {required && <span className="text-red-500">*</span>}
        </label>
        {allowCustom && !isCustomActive && (
          <button
            type="button"
            onClick={handleStartCustomCategory}
            className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 underline flex items-center gap-1"
          >
            + Category not listed?
          </button>
        )}
      </div>

      {/* Selected Value Display */}
      {!isCustomActive ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = null;
            }
            if (!isOpen) {
              setHoveredCategoryId(null);
            }
          }}
          className={`w-full px-4 py-2.5 text-left border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white flex items-center justify-between transition-all duration-200 hover:border-primary-400 ${
            !value ? "text-gray-500" : "text-gray-900"
          }`}>
          <span className="truncate">{displayText}</span>
          <FiChevronDown
            className={`ml-2 text-gray-500 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        /* Custom Category Form Box */
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-blue-50/30 border border-emerald-200 rounded-xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-950">Custom Category Request</span>
              <span className="text-[10px] font-medium px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded-md">
                Admin Approval Required
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelCustomCategory}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline"
            >
              Cancel & Pick Existing
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Category Type / Parent <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <select
                value={customParentCategoryId || ""}
                onChange={(e) =>
                  onChange({
                    target: {
                      name: "customParentCategoryId",
                      value: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Top-Level Main Category (New Category)</option>
                {rootCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    Subcategory under: {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Custom Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customCategoryName"
                value={customCategoryName || ""}
                onChange={onChange}
                placeholder="e.g. Smart Wearables, Organic Honey, Solar Gadgets"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required={isCustomActive}
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            Once approved by Admin, this category will become live for your product and available for all vendors.
          </p>
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && !isCustomActive && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setIsOpen(false);
                setHoveredCategoryId(null);
              }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 sm:hidden"
            />

            {/* Categories Dropdown */}
            <motion.div
              ref={parentDropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
              <div className="py-1">
                {allowCustom && (
                  <div
                    onClick={handleStartCustomCategory}
                    className="px-4 py-2.5 cursor-pointer flex items-center justify-between bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 font-semibold text-xs border-b border-emerald-100 transition-colors duration-150"
                  >
                    <span>✨ + Add Custom Category (Not Listed)</span>
                    <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded text-emerald-900">New</span>
                  </div>
                )}

                {rootCategories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500 text-center">
                    No categories available
                  </div>
                ) : (
                  rootCategories.map((category) => {
                    const subcategories = getCategoriesByParent(
                      category.id
                    ).filter((cat) => cat.isActive !== false && cat.status !== 'rejected');
                    const hasSubcategories = subcategories.length > 0;
                    const isSelected = value === category.id && !subcategoryId;

                    return (
                      <div key={category.id} data-category-id={category.id}>
                        <motion.div
                          whileHover={{
                            backgroundColor: isSelected
                              ? "rgba(40, 116, 240, 0.1)"
                              : "rgba(249, 250, 251, 1)",
                          }}
                          className={`px-4 py-2 cursor-pointer flex items-center justify-between transition-colors duration-150 ${
                            isSelected
                              ? "bg-primary-50 text-primary-600 font-medium"
                              : "text-gray-900"
                          }`}
                          onClick={() => {
                            handleCategorySelect(category.id);
                          }}
                          onMouseEnter={() => {
                            if (hasSubcategories) {
                              if (closeTimeoutRef.current) {
                                clearTimeout(closeTimeoutRef.current);
                                closeTimeoutRef.current = null;
                              }
                              setHoveredCategoryId(category.id);
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (closeTimeoutRef.current) {
                              clearTimeout(closeTimeoutRef.current);
                            }
                            closeTimeoutRef.current = setTimeout(() => {
                              if (subcategoryDropdownRef.current) {
                                const rect =
                                  subcategoryDropdownRef.current.getBoundingClientRect();
                                const x = e.clientX;
                                const y = e.clientY;
                                const isHoveringSub =
                                  x >= rect.left &&
                                  x <= rect.right &&
                                  y >= rect.top &&
                                  y <= rect.bottom;
                                if (!isHoveringSub) {
                                  setHoveredCategoryId(null);
                                }
                              } else {
                                setHoveredCategoryId(null);
                              }
                              closeTimeoutRef.current = null;
                            }, 200);
                          }}>
                          <span className="flex-1">{category.name}</span>
                          {hasSubcategories && (
                            <FiChevronRight className="ml-2 text-gray-400" />
                          )}
                        </motion.div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Subcategories Dropdown */}
            {hoveredCategoryId && hoveredSubcategories.length > 0 && (
              <motion.div
                ref={subcategoryDropdownRef}
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute bg-white border border-gray-200 rounded-xl shadow-xl min-w-[200px] z-[60]"
                onMouseEnter={() => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                    closeTimeoutRef.current = null;
                  }
                  setHoveredCategoryId(hoveredCategoryId);
                }}
                onMouseLeave={() => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                  }
                  closeTimeoutRef.current = setTimeout(() => {
                    setHoveredCategoryId(null);
                    closeTimeoutRef.current = null;
                  }, 200);
                }}>
                <div className="py-1 max-h-60 overflow-y-auto">
                  {hoveredSubcategories.map((subcategory) => {
                    const isSubSelected = subcategoryId === subcategory.id;
                    return (
                      <motion.div
                        key={subcategory.id}
                        onClick={() =>
                          handleSubcategorySelect(
                            subcategory.id,
                            hoveredCategoryId
                          )
                        }
                        whileHover={{
                          backgroundColor: isSubSelected
                            ? "rgba(40, 116, 240, 0.1)"
                            : "rgba(249, 250, 251, 1)",
                        }}
                        className={`px-4 py-2 cursor-pointer transition-colors duration-150 ${
                          isSubSelected
                            ? "bg-primary-50 text-primary-600 font-medium"
                            : "text-gray-900"
                        }`}>
                        {subcategory.name}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="hidden"
          value={isCustomActive ? (customCategoryName || "") : (value || "")}
          required={required}
        />
      )}
    </div>
  );
};

export default CategorySelector;
