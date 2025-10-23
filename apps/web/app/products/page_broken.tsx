"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  category: string;
  tags: string[];
  packshots?: string[];
  packshot_front_url?: string;
  packshot_back_url?: string;
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
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);

  // Function to fetch products from API
  const fetchProducts = async () => {
    if (!token) {
      console.log("No token available, skipping fetch");
      return;
    }

    try {
      console.log("🔍 Fetching products from API...");
      const response = await fetch(
        "${process.env.NEXT_PUBLIC_API_URL}/products",
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
    if (!token) return;

    try {
      const response = await fetch(
        "${process.env.NEXT_PUBLIC_API_URL}/categories",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [token]);

  const handleUpload = async () => {
    if (!newProduct.name || !newProduct.image) {
      alert("Please fill in all required fields");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("name", newProduct.name);
      formData.append("description", newProduct.description);
      formData.append("category", newProduct.category);
      formData.append("tags", JSON.stringify(selectedTags));
      formData.append("image", newProduct.image);

      if (newProduct.packshotFront) {
        formData.append("packshot_front", newProduct.packshotFront);
        formData.append("packshot_front_type", newProduct.packshotFrontType);
      }

      if (newProduct.packshotBack) {
        formData.append("packshot_back", newProduct.packshotBack);
        formData.append("packshot_back_type", newProduct.packshotBackType);
      }

      const response = await fetch(
        "${process.env.NEXT_PUBLIC_API_URL}/products",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const newProductData = await response.json();
        setProducts([...products, newProductData]);
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
        const errorData = await response.json();
        alert("Upload failed: " + errorData.detail);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(
        "Upload failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleGenerateMockup = async () => {
    if (!selectedProduct || !token) return;

    setIsGeneratingMockup(true);

    try {
      const response = await fetch(
        "${process.env.NEXT_PUBLIC_API_URL}/products/generate-mockup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            product_id: selectedProduct.id,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Refresh the product data to show new mockups
        fetchProducts();
        alert("Mockup generated successfully!");
      } else {
        const errorData = await response.json();
        alert("Failed to generate mockup: " + errorData.detail);
      }
    } catch (error) {
      console.error("Mockup generation error:", error);
      alert(
        "Failed to generate mockup: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsGeneratingMockup(false);
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
              backgroundColor: "#d42f48",
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
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: "#1E293B",
              margin: 0,
            }}
          >
            Products
          </h1>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#d42f48",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 6px -1px rgba(9, 10, 12, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#7C3AED";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 10px 15px -3px rgba(9, 10, 12, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#d42f48";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 6px -1px rgba(9, 10, 12, 0.1)";
            }}
          >
            Add Product
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "64px 32px",
                color: "#6B7280",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
              <h3 style={{ marginBottom: "8px", color: "#374151" }}>
                No products yet
              </h3>
              <p>Upload your first product to get started</p>
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #E5E7EB",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px 0 rgba(9, 10, 12, 0.1)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 25px -5px rgba(9, 10, 12, 0.1)";
                  e.currentTarget.style.borderColor = "#d42f48";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 1px 3px 0 rgba(9, 10, 12, 0.1)";
                  e.currentTarget.style.borderColor = "#E5E7EB";
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "200px",
                    backgroundColor: "#F9FAFB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6B7280",
                    backgroundImage: product.image_url
                      ? `url(${product.image_url})`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!product.image_url && "Product Image"}
                </div>
                <div style={{ padding: "16px" }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 8px 0",
                    }}
                  >
                    {product.name}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: "0 0 12px 0",
                    }}
                  >
                    {product.description || "No description"}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {product.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: "#F3F4F6",
                          color: "#374151",
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
            backgroundColor: "rgba(9, 10, 12, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "0",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(9, 10, 12, 0.25)",
              border: "1px solid #E5E7EB",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #E5E7EB",
                backgroundColor: "#F9FAFB",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#1F2937",
                      margin: 0,
                      marginBottom: "4px",
                    }}
                  >
                    Add New Product
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: 0,
                    }}
                  >
                    Upload a product with optional packshot generation
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "28px",
                    cursor: "pointer",
                    color: "#6B7280",
                    padding: "8px",
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#E5E7EB";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              style={{ padding: "32px", maxHeight: "70vh", overflow: "auto" }}
            >
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
                    padding: "12px 16px",
                    border: "2px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#FFFFFF",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#d42f48";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(139, 92, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E5E7EB";
                    e.target.style.boxShadow = "none";
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
                    setNewProduct({
                      ...newProduct,
                      description: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#FFFFFF",
                    minHeight: "80px",
                    resize: "vertical",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#d42f48";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(139, 92, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E5E7EB";
                    e.target.style.boxShadow = "none";
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
                    padding: "12px 16px",
                    border: "2px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#d42f48";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(139, 92, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E5E7EB";
                    e.target.style.boxShadow = "none";
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
                    padding: "12px 16px",
                    border: "2px solid #E5E7EB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: "#FFFFFF",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#d42f48";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(139, 92, 246, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#E5E7EB";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Footer with buttons */}
            <div
              style={{
                padding: "24px 32px",
                borderTop: "1px solid #E5E7EB",
                backgroundColor: "#F9FAFB",
                borderRadius: "0 0 16px 16px",
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#374151",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                  e.currentTarget.style.borderColor = "#9CA3AF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                  e.currentTarget.style.borderColor = "#D1D5DB";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !newProduct.name || !newProduct.image}
                style={{
                  padding: "12px 24px",
                  backgroundColor: isUploading ? "#9CA3AF" : "#d42f48",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isUploading
                    ? "none"
                    : "0 4px 6px -1px rgba(9, 10, 12, 0.1)",
                }}
                onMouseEnter={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.backgroundColor = "#7C3AED";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 15px -3px rgba(9, 10, 12, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUploading) {
                    e.currentTarget.style.backgroundColor = "#d42f48";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 6px -1px rgba(9, 10, 12, 0.1)";
                  }
                }}
              >
                {isUploading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid #ffffff",
                        borderTop: "2px solid transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Uploading...
                  </div>
                ) : (
                  "Upload Product"
                )}
              </button>
            </div>
          </div>

          {/* CSS Animation for spinner */}
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {/* Product View Modal */}
      {showProductModal && selectedProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(9, 10, 12, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowProductModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "0",
              maxWidth: "800px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(9, 10, 12, 0.25)",
              border: "1px solid #E5E7EB",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #E5E7EB",
                backgroundColor: "#F9FAFB",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#1F2937",
                      margin: 0,
                      marginBottom: "4px",
                    }}
                  >
                    {selectedProduct.name}
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: 0,
                    }}
                  >
                    {selectedProduct.description || "No description"}
                  </p>
                </div>
                <button
                  onClick={() => setShowProductModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "28px",
                    cursor: "pointer",
                    color: "#6B7280",
                    padding: "8px",
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#E5E7EB";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              style={{ padding: "32px", maxHeight: "70vh", overflow: "auto" }}
            >
              {/* Product Image */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1F2937",
                    margin: "0 0 16px 0",
                  }}
                >
                  Product Image
                </h3>
                <div
                  style={{
                    width: "100%",
                    height: "300px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6B7280",
                    backgroundImage: selectedProduct.image_url
                      ? `url(${selectedProduct.image_url})`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: "2px solid #E5E7EB",
                  }}
                >
                  {!selectedProduct.image_url && "No product image"}
                </div>
              </div>

              {/* Product Details */}
              <div style={{ marginBottom: "24px" }}>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1F2937",
                    margin: "0 0 16px 0",
                  }}
                >
                  Product Details
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#6B7280",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Category
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#F3F4F6",
                        borderRadius: "6px",
                        fontSize: "14px",
                        color: "#374151",
                      }}
                    >
                      {selectedProduct.category || "No category"}
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "#6B7280",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Created
                    </label>
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#F3F4F6",
                        borderRadius: "6px",
                        fontSize: "14px",
                        color: "#374151",
                      }}
                    >
                      {new Date(
                        selectedProduct.created_at
                      ).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Tags
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedProduct.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: "#d42f48",
                          color: "white",
                          padding: "6px 12px",
                          borderRadius: "16px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mockups Section */}
              <div style={{ marginBottom: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: 0,
                    }}
                  >
                    Generated Mockups
                  </h3>
                  <button
                    onClick={handleGenerateMockup}
                    disabled={isGeneratingMockup}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: isGeneratingMockup
                        ? "#9CA3AF"
                        : "#d42f48",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: isGeneratingMockup ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isGeneratingMockup ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #ffffff",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Generating...
                      </div>
                    ) : (
                      "Generate Mockup"
                    )}
                  </button>
                </div>

                {/* Mockups Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {selectedProduct.packshots &&
                  selectedProduct.packshots.length > 0 ? (
                    selectedProduct.packshots.map((mockup, index) => (
                      <div
                        key={index}
                        style={{
                          aspectRatio: "1",
                          backgroundColor: "#F9FAFB",
                          borderRadius: "8px",
                          backgroundImage: `url(${mockup})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: "2px solid #E5E7EB",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.borderColor = "#d42f48";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.borderColor = "#E5E7EB";
                        }}
                      />
                    ))
                  ) : (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        textAlign: "center",
                        padding: "32px",
                        color: "#6B7280",
                        backgroundColor: "#F9FAFB",
                        borderRadius: "8px",
                        border: "2px dashed #D1D5DB",
                      }}
                    >
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                        🎨
                      </div>
                      <p style={{ margin: 0 }}>No mockups generated yet</p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "14px" }}>
                        Click "Generate Mockup" to create your first mockup
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
