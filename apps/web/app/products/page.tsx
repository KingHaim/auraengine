"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  packshots: string[];
  packshot_front_url?: string;
  packshot_back_url?: string;
  packshot_front_type?: string;
  packshot_back_type?: string;
  category?: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

export default function ProductsPage() {
  const { user, token, loading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    category: "",
    tags: "",
    image: null as File | null,
    packshotFront: null as File | null,
    packshotBack: null as File | null,
    packshotFrontType: "front",
    packshotBackType: "back",
  });
  const [categories, setCategories] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPackshotsModal, setShowPackshotsModal] = useState(false);
  const [selectedProductForPackshots, setSelectedProductForPackshots] =
    useState<Product | null>(null);
  const [isRerolling, setIsRerolling] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Function to fetch products from API
  const fetchProducts = async () => {
    if (!token) {
      console.log("No token available, skipping fetch");
      return;
    }

    try {
      console.log("🔍 Fetching products from API...");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products`,
        {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        }
      );

      if (response.ok) {
        const apiProducts = await response.json();
        console.log("✅ Fetched products from API:", apiProducts);
        setProducts(apiProducts);
      } else {
        console.error("❌ Failed to fetch products:", response.status);
      }
    } catch (error) {
      console.error("💥 Error fetching products:", error);
    }
  };

  // Function to fetch categories and tags
  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/categories`
      );
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Fetch products and categories on component mount
  useEffect(() => {
    if (token) {
      fetchProducts();
    }
    fetchCategories();
  }, [token]);

  const handleUpload = async () => {
    if (!newProduct.name || !newProduct.image) return;
    if (!token) {
      alert("Please log in to upload products");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newProduct.name);
      formData.append("description", newProduct.description);
      formData.append("category", newProduct.category);
      formData.append("tags", selectedTags.join(","));
      formData.append("product_image", newProduct.image);

      // Add packshot files if provided
      if (newProduct.packshotFront) {
        formData.append("packshot_front", newProduct.packshotFront);
        formData.append("packshot_front_type", newProduct.packshotFrontType);
      }
      if (newProduct.packshotBack) {
        formData.append("packshot_back", newProduct.packshotBack);
        formData.append("packshot_back_type", newProduct.packshotBackType);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/upload`,
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Product uploaded with packshots:", result);
        const packshotCount = result.packshots?.length || 0;
        const uploadedPackshots =
          (result.packshot_front_url ? 1 : 0) +
          (result.packshot_back_url ? 1 : 0);
        const generatedPackshots = packshotCount - uploadedPackshots;

        let message = `✅ Product "${result.name}" uploaded successfully!`;
        if (uploadedPackshots > 0) {
          message += ` ${uploadedPackshots} packshot(s) uploaded.`;
        }
        if (generatedPackshots > 0) {
          message += ` ${generatedPackshots} packshot(s) auto-generated.`;
        }
        alert(message);

        // Refresh products list
        await fetchProducts();

        // Reset form
        setNewProduct({
          name: "",
          description: "",
          category: "",
          tags: "",
          image: null,
          packshotFront: null,
          packshotBack: null,
          packshotFrontType: "front",
          packshotBackType: "back",
        });
        setSelectedTags([]);
        setShowUploadModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert(
        "Upload failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      tags: "",
      image: null,
      packshotFront: null,
      packshotBack: null,
      packshotFrontType: "front",
      packshotBackType: "back",
    });
    setSelectedTags(product.tags || []);
    setShowEditModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !newProduct.name) return;
    if (!token) {
      alert("Please log in to update products");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newProduct.name);
      formData.append("description", newProduct.description);
      formData.append("category", newProduct.category);
      formData.append("tags", selectedTags.join(","));
      if (newProduct.image) {
        formData.append("product_image", newProduct.image);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${editingProduct.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Product updated:", result);
        alert(`✅ Product "${result.name}" updated successfully!`);

        // Refresh products list
        await fetchProducts();

        // Reset form and close modal
        setNewProduct({
          name: "",
          description: "",
          category: "",
          tags: "",
          image: null,
          packshotFront: null,
          packshotBack: null,
          packshotFrontType: "front",
          packshotBackType: "back",
        });
        setSelectedTags([]);
        setEditingProduct(null);
        setShowEditModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Update failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setDeletingProduct(product);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct || !token) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${deletingProduct.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        console.log("✅ Product deleted:", deletingProduct.name);
        alert(`✅ Product "${deletingProduct.name}" deleted successfully!`);

        // Refresh products list
        await fetchProducts();

        // Close confirmation dialog
        setDeletingProduct(null);
        setShowDeleteConfirm(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRerollPackshots = async (productId: string) => {
    if (!token) {
      alert("Please log in to re-roll packshots");
      return;
    }

    setIsRerolling(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/products/${productId}/reroll-packshots`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Packshots re-rolled:", result);
        alert(
          `✅ Packshots re-rolled successfully! ${result.packshots.length} new packshots generated. Credits remaining: ${result.credits_remaining}`
        );

        // Refresh products list
        await fetchProducts();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Re-roll failed:", error);
      alert(
        "Re-roll failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsRerolling(false);
    }
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "16px" }}>⏳</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user || !token) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#0E1115",
          color: "#E6E8EB",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
          <h2 style={{ marginBottom: "16px" }}>Authentication Required</h2>
          <p style={{ marginBottom: "24px", color: "#9BA3AF" }}>
            Please log in to access your product library
          </p>
          <a
            href="/"
            style={{
              padding: "12px 24px",
              backgroundColor: "#8B5CF6",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "500",
            }}
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
    <div
      style={{
          padding: "32px",
          flex: 1,
          backgroundColor: "#FFFFFF",
          color: "#1E293B",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
            justifyContent: "space-between",
              alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#1E293B",
                margin: 0,
              }}
            >
              Product Library
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748B",
                margin: "4px 0 0 0",
              }}
            >
              {user.email}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#8B5CF6",
              border: "none",
              borderRadius: "8px",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            + Add Product
          </button>
        </div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#9BA3AF",
              letterSpacing: "0.18em",
              marginBottom: "16px",
            }}
          >
            YOUR PRODUCTS ({products.length})
          </div>

          {products.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "64px 32px",
                color: "#6B7280",
              }}
            >
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                }}
              >
                📦
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                No products yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Upload your first product to get started with automatic packshot
                generation
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#8B5CF6",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Upload Product
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "24px",
              }}
            >
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    border: "1px solid #E5E7EB",
                    overflow: "hidden",
                    transition: "all 0.2s",
                    cursor: "default",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 25px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "2/3",
                      position: "relative",
                      backgroundColor: "#F3F4F6",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (product.packshots && product.packshots.length > 0) {
                        setSelectedProductForPackshots(product);
                        setShowPackshotsModal(true);
                      }
                    }}
                  >
                    <img
                    src={product.packshot_front_url || product.image_url}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        console.error(
                          `Failed to load image for product ${product.name}:`,
                        product.packshot_front_url || product.image_url
                      );
                      // Fallback to original product image if packshot fails
                      if (e.currentTarget.src === product.packshot_front_url) {
                        e.currentTarget.src = product.image_url;
                      } else {
                        e.currentTarget.src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                      }
                      }}
                    />
                    {product.packshots && product.packshots.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          backgroundColor: "rgba(139, 92, 246, 0.9)",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        📸 {product.packshots.length} packshots
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "16px" }}>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "4px",
                      }}
                    >
                      {product.name}
                    </h3>
                    {product.description && (
                      <p
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          marginBottom: "8px",
                        }}
                      >
                        {product.description}
                      </p>
                    )}
                    {product.packshots && product.packshots.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#8B5CF6",
                          fontSize: "12px",
                          fontWeight: "500",
                          marginBottom: "12px",
                        }}
                      >
                        <span>📸</span>
                        <span>
                          {product.packshots.length} packshots generated
                        </span>
                        <span style={{ color: "#6B7280", fontSize: "10px" }}>
                          • Click image to view
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        alignItems: "center",
                        marginTop: "8px",
                      }}
                    >
                      {product.category && (
                        <div
                          style={{
                            display: "inline-block",
                            backgroundColor: "#F3F4F6",
                            color: "#374151",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "500",
                          }}
                        >
                          {product.category}
                        </div>
                      )}
                      {product.tags && product.tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          {product.tags
                            .slice(0, 3)
                            .map((tag: string, index: number) => (
                              <span
                                key={index}
                                style={{
                                  backgroundColor: "#8B5CF6",
                                  color: "white",
                                  padding: "2px 6px",
                                  borderRadius: "12px",
                                  fontSize: "10px",
                                  fontWeight: "500",
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          {product.tags.length > 3 && (
                            <span
                              style={{
                                backgroundColor: "#E5E7EB",
                                color: "#6B7280",
                                padding: "2px 6px",
                                borderRadius: "12px",
                                fontSize: "10px",
                                fontWeight: "500",
                              }}
                            >
                              +{product.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "12px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        onClick={() => handleEditProduct(product)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#8B5CF6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "500",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#EF4444",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "500",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "32px",
              width: "500px",
              maxWidth: "90vw",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
          >
            <h2
              style={{
                  color: "#1F2937",
                fontSize: "20px",
                fontWeight: "600",
                  margin: 0,
              }}
            >
              Upload New Product
            </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6B7280",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Product Name *
              </label>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#F9FAFB",
                }}
                placeholder="Enter product name"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Description
              </label>
              <textarea
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minHeight: "80px",
                  resize: "vertical",
                  backgroundColor: "#F9FAFB",
                }}
                placeholder="Enter product description"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Category *
              </label>
              <select
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <option value="">Select a category</option>
                {categories?.categories?.map((cat: any) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Tags
              </label>
              <div style={{ marginBottom: "8px" }}>
                <input
                  type="text"
                  value={newProduct.tags}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, tags: e.target.value })
                  }
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newProduct.tags.trim()) {
                      e.preventDefault();
                      if (!selectedTags.includes(newProduct.tags.trim())) {
                        setSelectedTags([
                          ...selectedTags,
                          newProduct.tags.trim(),
                        ]);
                        setNewProduct({ ...newProduct, tags: "" });
                      }
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                  placeholder="Type a tag and press Enter"
                />
              </div>

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  {selectedTags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "#8B5CF6",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTags(
                            selectedTags.filter((_, i) => i !== index)
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "0",
                          marginLeft: "4px",
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Common Tags */}
              {categories?.common_tags && (
                <div style={{ marginTop: "8px" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      marginBottom: "4px",
                    }}
                  >
                    Common tags:
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                  >
                    {categories.common_tags.slice(0, 10).map((tag: string) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!selectedTags.includes(tag)) {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                        disabled={selectedTags.includes(tag)}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid #D1D5DB",
                          borderRadius: "12px",
                          fontSize: "11px",
                          backgroundColor: selectedTags.includes(tag)
                            ? "#8B5CF6"
                            : "white",
                          color: selectedTags.includes(tag)
                            ? "white"
                            : "#374151",
                          cursor: selectedTags.includes(tag)
                            ? "not-allowed"
                            : "pointer",
                          opacity: selectedTags.includes(tag) ? 0.6 : 1,
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Product Image *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    image: e.target.files?.[0] || null,
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "#F9FAFB",
                }}
              />
              {newProduct.image && (
                <div
                  style={{
                    marginTop: "8px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={URL.createObjectURL(newProduct.image as any)}
                    alt="Preview"
                    style={{
                      width: "80px",
                      height: "80px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      backgroundColor: "#FFF",
                    }}
                  />
                  <div style={{ fontSize: "12px", color: "#6B7280" }}>
                    {(newProduct.image as any).name}
                  </div>
                </div>
              )}
            </div>

            {/* Packshot Upload Section */}
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "16px",
                  paddingBottom: "8px",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                Packshot Images (Optional)
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginBottom: "16px",
                }}
              >
                Upload your own packshot images or leave empty to auto-generate
                them (costs 10 credits total).
              </p>

              {/* Front Packshot */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    color: "#374151",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                  }}
                >
                  Front Packshot
                </label>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        packshotFront: e.target.files?.[0] || null,
                      })
                    }
                    style={{
                      flex: 1,
                      padding: "12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                  <select
                    value={newProduct.packshotFrontType}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        packshotFrontType: e.target.value,
                      })
                    }
                    style={{
                      padding: "12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      backgroundColor: "#FFFFFF",
                      minWidth: "100px",
                    }}
                  >
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                  </select>
                </div>
              </div>

              {/* Back Packshot */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    color: "#374151",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "8px",
                  }}
                >
                  Back Packshot
                </label>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        packshotBack: e.target.files?.[0] || null,
                      })
                    }
                    style={{
                      flex: 1,
                      padding: "12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  />
                  <select
                    value={newProduct.packshotBackType}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        packshotBackType: e.target.value,
                      })
                    }
                    style={{
                      padding: "12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      backgroundColor: "#FFFFFF",
                      minWidth: "100px",
                    }}
                  >
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                  </select>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#F3F4F6",
                  border: "none",
                  borderRadius: "8px",
                  color: "#374151",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !newProduct.name || !newProduct.image}
                style={{
                  padding: "12px 24px",
                  background: isUploading
                    ? "#9CA3AF"
                    : "linear-gradient(90deg, #8B5CF6, #7C3AED)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  cursor: isUploading ? "not-allowed" : "pointer",
                }}
              >
                {isUploading ? "Uploading..." : "Upload Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Packshots Modal */}
      {showPackshotsModal && selectedProductForPackshots && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowPackshotsModal(false);
            setSelectedProductForPackshots(null);
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                {selectedProductForPackshots.name} - Packshots (
                {selectedProductForPackshots.packshots?.length || 0})
              </h2>
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <button
                  onClick={() =>
                    handleRerollPackshots(selectedProductForPackshots.id)
                  }
                  disabled={isRerolling}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: isRerolling ? "#9CA3AF" : "#8B5CF6",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: isRerolling ? "not-allowed" : "pointer",
                  }}
                >
                  {isRerolling ? "Re-rolling..." : "🔄 Re-roll Packshots"}
                </button>
                <button
                  onClick={() => {
                    setShowPackshotsModal(false);
                    setSelectedProductForPackshots(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#6B7280",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "20px",
              }}
            >
              {selectedProductForPackshots.packshots?.map(
                (packshotUrl, index) => {
                  const packshotType = index === 0 ? "Front" : "Back";
                  return (
                    <div
                      key={index}
                      style={{
                        backgroundColor: "#F9FAFB",
                        borderRadius: "12px",
                        border: "1px solid #E5E7EB",
                        overflow: "hidden",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: "2/3",
                          position: "relative",
                          backgroundColor: "#F3F4F6",
                        }}
                      >
                        <img
                          src={packshotUrl}
                          alt={`${packshotType} Packshot`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            console.error(
                              `Failed to load ${packshotType.toLowerCase()} packshot:`,
                              packshotUrl
                            );
                          }}
                        />
                      </div>
                      <div style={{ padding: "12px" }}>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "#1F2937",
                            textAlign: "center",
                          }}
                        >
                          {packshotType} View
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 24px 0",
                fontSize: "20px",
                fontWeight: "600",
              }}
            >
              Edit Product
            </h2>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Product Name *
              </label>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
                placeholder="Enter product name"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Description
              </label>
              <textarea
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minHeight: "80px",
                  resize: "vertical",
                }}
                placeholder="Enter product description"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Category *
              </label>
              <select
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select a category</option>
                {categories?.categories?.map((cat: any) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                Tags
              </label>
              <div style={{ marginBottom: "8px" }}>
                <input
                  type="text"
                  value={newProduct.tags}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, tags: e.target.value })
                  }
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newProduct.tags.trim()) {
                      e.preventDefault();
                      if (!selectedTags.includes(newProduct.tags.trim())) {
                        setSelectedTags([
                          ...selectedTags,
                          newProduct.tags.trim(),
                        ]);
                        setNewProduct({ ...newProduct, tags: "" });
                      }
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                  placeholder="Type a tag and press Enter"
                />
              </div>

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  {selectedTags.map((tag, index) => (
                    <span
                      key={index}
                      style={{
                        backgroundColor: "#8B5CF6",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "16px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTags(
                            selectedTags.filter((_, i) => i !== index)
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "0",
                          marginLeft: "4px",
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Common Tags */}
              {categories?.common_tags && (
                <div style={{ marginTop: "8px" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      marginBottom: "4px",
                    }}
                  >
                    Common tags:
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                  >
                    {categories.common_tags.slice(0, 10).map((tag: string) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!selectedTags.includes(tag)) {
                            setSelectedTags([...selectedTags, tag]);
                          }
                        }}
                        disabled={selectedTags.includes(tag)}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid #D1D5DB",
                          borderRadius: "12px",
                          fontSize: "11px",
                          backgroundColor: selectedTags.includes(tag)
                            ? "#8B5CF6"
                            : "white",
                          color: selectedTags.includes(tag)
                            ? "white"
                            : "#374151",
                          cursor: selectedTags.includes(tag)
                            ? "not-allowed"
                            : "pointer",
                          opacity: selectedTags.includes(tag) ? 0.6 : 1,
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  marginBottom: "8px",
                }}
              >
                New Product Image (optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewProduct({
                    ...newProduct,
                    image: e.target.files?.[0] || null,
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                }}
              />
              {newProduct.image && (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginTop: "4px",
                  }}
                >
                  New image: {newProduct.image.name}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setNewProduct({
                    name: "",
                    description: "",
                    category: "",
                    tags: "",
                    image: null,
                    packshotFront: null,
                    packshotBack: null,
                    packshotFrontType: "front",
                    packshotBackType: "back",
                  });
                  setSelectedTags([]);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#6B7280",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                disabled={!newProduct.name || isUploading}
                style={{
                  padding: "12px 24px",
                  backgroundColor:
                    !newProduct.name || isUploading ? "#9CA3AF" : "#8B5CF6",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor:
                    !newProduct.name || isUploading ? "not-allowed" : "pointer",
                }}
              >
                {isUploading ? "Updating..." : "Update Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && deletingProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: "20px",
                fontWeight: "600",
                color: "#EF4444",
              }}
            >
              Delete Product
            </h2>

            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: "14px",
                color: "#6B7280",
                lineHeight: "1.5",
              }}
            >
              Are you sure you want to delete{" "}
              <strong>"{deletingProduct.name}"</strong>? This action cannot be
              undone and will also delete all associated packshots and campaign
              generations.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingProduct(null);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#6B7280",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={isDeleting}
                style={{
                  padding: "12px 24px",
                  backgroundColor: isDeleting ? "#9CA3AF" : "#EF4444",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: isDeleting ? "not-allowed" : "pointer",
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
