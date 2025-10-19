"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

interface Model {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  gender?: string;
  poses?: string[];
  created_at: string;
  updated_at?: string;
}

export default function ModelsPage() {
  const { user, token, loading } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newModel, setNewModel] = useState({
    name: "",
    description: "",
    gender: "male" as "male" | "female",
    image: null as File | null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showPoseModal, setShowPoseModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [posePrompt, setPosePrompt] = useState(
    "fashion model in different full-body poses, standing, walking, sitting, professional photography"
  );
  const [modelGender, setModelGender] = useState<"male" | "female">("male");
  const [isGeneratingPoses, setIsGeneratingPoses] = useState(false);
  const [generatedPoses, setGeneratedPoses] = useState<string[]>([]);
  const [showPoseResults, setShowPoseResults] = useState(false);
  const [showModelPosesModal, setShowModelPosesModal] = useState(false);
  const [selectedModelForPoses, setSelectedModelForPoses] =
    useState<Model | null>(null);
  const [showPoseZoomModal, setShowPoseZoomModal] = useState(false);
  const [selectedPoseForZoom, setSelectedPoseForZoom] = useState<string | null>(
    null
  );
  const [poseVariants, setPoseVariants] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    gender: "male" as "male" | "female",
  });
  const [deletingPoseIndex, setDeletingPoseIndex] = useState<number | null>(
    null
  );
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);
  const [generatedModel, setGeneratedModel] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<"male" | "female">(
    "male"
  );
  const [physicalAttributes, setPhysicalAttributes] = useState({
    age: 25,
    height: "average",
    build: "athletic",
    hairColor: "brown",
    eyeColor: "brown",
    skinTone: "medium",
  });
  const [showModelProfileModal, setShowModelProfileModal] = useState(false);
  const [selectedModelForProfile, setSelectedModelForProfile] =
    useState<Model | null>(null);

  // Function to open model profile modal
  const handleOpenModelProfile = (model: Model) => {
    setSelectedModelForProfile(model);
    setShowModelProfileModal(true);
  };

  // Function to generate model
  const handleGenerateModel = async () => {
    // Allow generation with just physical attributes, no prompt required

    setIsGeneratingModel(true);
    try {
      const formData = new FormData();
      formData.append("prompt", generatePrompt);
      formData.append("variants", poseVariants.toString());
      formData.append("gender", selectedGender);
      formData.append("age", physicalAttributes.age.toString());
      formData.append("height", physicalAttributes.height);
      formData.append("build", physicalAttributes.build);
      formData.append("hair_color", physicalAttributes.hairColor);
      formData.append("eye_color", physicalAttributes.eyeColor);
      formData.append("skin_tone", physicalAttributes.skinTone);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/ai-generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Model generation failed");
      }

      const result = await response.json();
      console.log("Model generation result:", result);

      if (result.models && result.models.length > 0) {
        setGeneratedModel(result.models[0].image_url);
        // Refresh models list
        fetchModels();
        alert(
          `Model generated successfully! Used ${result.credits_used} credits. Remaining: ${result.remaining_credits}`
        );
      }
    } catch (error) {
      console.error("Model generation error:", error);
      alert(
        `Model generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsGeneratingModel(false);
    }
  };

  // Function to edit model
  const handleEditModel = (model: Model) => {
    setEditingModel(model);
    setEditForm({
      name: model.name,
      description: model.description || "",
      gender: (model.gender as "male" | "female") || "male",
    });
    setShowEditModal(true);
  };

  // Function to save edited model
  const handleSaveEdit = async () => {
    if (!editingModel || !token) return;

    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("description", editForm.description);
      formData.append("gender", editForm.gender);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/${editingModel.id}`,
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
        alert(`✅ Model "${result.name}" updated successfully!`);
        setShowEditModal(false);
        setEditingModel(null);
        fetchModels(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`❌ Failed to update model: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error updating model:", error);
      alert("❌ Error updating model");
    }
  };

  // Function to delete a specific pose
  const handleDeletePose = async (modelId: string, poseIndex: number) => {
    if (!token) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this pose? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingPoseIndex(poseIndex);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/${modelId}/poses/${poseIndex}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        fetchModels(); // Refresh the list
        // Update the selected model's poses if it's the same model
        if (selectedModelForPoses && selectedModelForPoses.id === modelId) {
          const updatedPoses = [...(selectedModelForPoses.poses || [])];
          updatedPoses.splice(poseIndex, 1);
          setSelectedModelForPoses({
            ...selectedModelForPoses,
            poses: updatedPoses,
          });
        }
      } else {
        const error = await response.json();
        alert(`❌ Failed to delete pose: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error deleting pose:", error);
      alert("❌ Error deleting pose");
    } finally {
      setDeletingPoseIndex(null);
    }
  };

  const handlePoseZoom = (poseUrl: string) => {
    setSelectedPoseForZoom(poseUrl);
    setShowPoseZoomModal(true);
  };

  // Function to delete model
  const handleDeleteModel = async (model: Model) => {
    if (!token) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${model.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/${model.id}`,
        {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        }
      );

      if (response.ok) {
        alert(`✅ Model "${model.name}" deleted successfully!`);
        fetchModels(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`❌ Failed to delete model: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error deleting model:", error);
      alert("❌ Error deleting model");
    }
  };

  // Function to fetch models from API
  const fetchModels = async () => {
    if (!token) {
      console.log("No token available, skipping fetch");
      return;
    }

    try {
      console.log("🔍 Fetching models from API...");
      console.log("🔑 Using token:", token.substring(0, 20) + "...");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models`,
        {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        }
      );

      console.log("📡 API Response status:", response.status);

      if (response.ok) {
        const apiModels = await response.json();
        console.log("✅ Fetched models from API:", apiModels);
        console.log("📊 Number of models:", apiModels.length);
        // Debug pose counts
        apiModels.forEach((model: Model) => {
          console.log(`Model ${model.name}: ${model.poses?.length || 0} poses`);
        });
        setModels(apiModels);
      } else {
        console.error("❌ Failed to fetch models:", response.status);
        // Fallback to mock data if API fails
        const mockModels: Model[] = [
          {
            id: "1",
            name: "Alex Johnson",
            description: "Professional model, 5'9\"",
            image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`,
            created_at: "2024-01-15T10:00:00Z",
          },
          {
            id: "2",
            name: "Sarah Chen",
            description: "Fashion model, 5'7\"",
            image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/model.jpg`,
            created_at: "2024-01-14T15:30:00Z",
          },
          {
            id: "3",
            name: "Marcus Williams",
            description: "Male model, 6'1\"",
            image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/IMG_6695.PNG`,
            created_at: "2024-01-13T09:15:00Z",
          },
        ];
        console.log("🔄 Using fallback mock models:", mockModels);
        setModels(mockModels);
      }
    } catch (error) {
      console.error("💥 Error fetching models:", error);
      // Fallback to mock data
      const mockModels: Model[] = [
        {
          id: "1",
          name: "Alex Johnson",
          description: "Professional model, 5'9\"",
          image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`,
          created_at: "2024-01-15T10:00:00Z",
        },
        {
          id: "2",
          name: "Sarah Chen",
          description: "Fashion model, 5'7\"",
          image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/model.jpg`,
          created_at: "2024-01-14T15:30:00Z",
        },
        {
          id: "3",
          name: "Marcus Williams",
          description: "Male model, 6'1\"",
          image_url: `${process.env.NEXT_PUBLIC_API_URL}/static/IMG_6695.PNG`,
          created_at: "2024-01-13T09:15:00Z",
        },
      ];
      console.log("🔄 Using fallback mock models (catch):", mockModels);
      setModels(mockModels);
    }
  };

  // Test API connectivity first
  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log("🧪 Testing API connectivity...");
        const testResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/health`
        );
        console.log("🏥 Health check status:", testResponse.status);
        if (testResponse.ok) {
          const healthData = await testResponse.json();
          console.log("✅ API is reachable:", healthData);
        }
      } catch (error) {
        console.error("❌ API connectivity test failed:", error);
      }
    };

    testAPI();
    fetchModels();
  }, [token]);

  // Debug: Log models state changes
  useEffect(() => {
    console.log("📋 Models state updated:", models);
  }, [models]);

  const handleUpload = async () => {
    if (!newModel.name || !newModel.image) return;
    if (!token) {
      alert("Please log in to upload models");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newModel.name);
      formData.append("description", newModel.description);
      formData.append("gender", newModel.gender);
      formData.append("model_image", newModel.image);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/upload`,
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
        console.log("✅ Model uploaded:", result);
        alert(`✅ Model "${result.name}" uploaded successfully!`);

        // Refresh models list
        await fetchModels();

        // Reset form
        setNewModel({ name: "", description: "", gender: "male", image: null });
        setShowUploadModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGeneratePoses = async () => {
    if (!selectedModel || !token) return;

    setIsGeneratingPoses(true);
    try {
      console.log("Starting pose generation...");

      // Create gender-specific full-body pose prompt
      const genderSpecificPrompt = `${modelGender} fashion model in different full-body poses, professional photography, clean background, studio lighting, high quality, ${posePrompt}`;

      console.log("Using model ID:", selectedModel.id);
      console.log("Gender-specific prompt:", genderSpecificPrompt);
      console.log("Selected model object:", selectedModel);

      console.log("Sending API request...");

      const formData = new FormData();
      formData.append("prompt", genderSpecificPrompt);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/models/${selectedModel.id}/generate-poses`,
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        }
      );

      console.log("Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", errorText);
        throw new Error(`Pose generation failed: ${res.status} ${errorText}`);
      }

      const result = await res.json();
      console.log("Generated poses:", result.urls);
      console.log("Model info:", {
        model_id: result.model_id,
        model_name: result.model_name,
        total_poses: result.total_poses,
      });

      // Store the generated poses and show them
      setGeneratedPoses(result.urls);
      setShowPoseResults(true);

      // Close modal
      setShowPoseModal(false);
      setSelectedModel(null);

      // Show success message
      alert(
        `✅ Generated ${result.urls.length} poses for ${result.model_name}! Total poses: ${result.total_poses}`
      );

      // Refresh the models list to show updated poses
      await fetchModels();
    } catch (error) {
      console.error("Pose generation error:", error);
      alert(
        "Pose generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsGeneratingPoses(false);
    }
  };

  // Skip loading check for now

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
            Please log in to access your model library
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
              Model Library
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#64748B",
                margin: "4px 0 0 0",
              }}
            >
              {user?.email || "No user"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => setShowGenerateModal(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#10B981",
                border: "none",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ✨ Generate Model
            </button>
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
            + Add Model
          </button>
          </div>
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
            YOUR MODELS ({models.length})
          </div>

          {models.length === 0 ? (
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
                👤
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                No models yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Upload model photos for virtual try-on campaigns
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
                Add Your First Model
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
              {models.map((model) => (
                <div
                  key={model.id}
                  style={{
                  aspectRatio: "2/3",
                    borderRadius: "12px",
                    overflow: "hidden",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                    position: "relative",
                  background: "#F3F4F6",
                  }}
                onClick={() => handleOpenModelProfile(model)}
                  onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                    e.currentTarget.style.boxShadow =
                    "0 12px 40px rgba(0,0,0,0.15)";
                  const overlay = e.currentTarget.querySelector(
                    "[data-hover-overlay]"
                  ) as HTMLElement;
                  if (overlay) {
                    overlay.style.opacity = "1";
                  }
                  }}
                  onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  const overlay = e.currentTarget.querySelector(
                    "[data-hover-overlay]"
                  ) as HTMLElement;
                  if (overlay) {
                    overlay.style.opacity = "0";
                  }
                }}
              >
                {/* Main Model Image */}
                    <img
                      src={model.image_url}
                      alt={model.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                      }}
                      onError={(e) => {
                        console.error(
                          `Failed to load image for model ${model.name}:`,
                          model.image_url
                        );
                    e.currentTarget.src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                      }}
                    />

                {/* Dark Semi-transparent Banner with Model Name */}
                    <div
                      style={{
                        position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                    padding: "24px 16px 16px",
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                    <h3
                      style={{
                      fontSize: "18px",
                        fontWeight: "600",
                      color: "#FFFFFF",
                      margin: 0,
                      textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                      lineHeight: 1.2,
                      }}
                    >
                      {model.name}
                    </h3>
                </div>

                {/* Poses Indicator */}
                    {model.poses && model.poses.length > 0 && (
                      <div
                        style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      backgroundColor: "rgba(34, 211, 238, 0.9)",
                      color: "white",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    🎭 {model.poses.length} poses
                      </div>
                    )}

                {/* Hover Overlay with Model Information */}
                    <div
                  data-hover-overlay
                      style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px",
                    opacity: 0,
                    transition: "all 0.3s ease",
                    pointerEvents: "none",
                  }}
                >
                  {/* Model Description */}
                  {model.description && (
                      <div
                        style={{
                        textAlign: "center",
                        marginBottom: "20px",
                        maxWidth: "80%",
                        }}
                      >
                      <p
                          style={{
                            color: "#FFFFFF",
                          fontSize: "14px",
                          lineHeight: 1.5,
                          margin: 0,
                          fontWeight: "400",
                        }}
                      >
                        {model.description}
                      </p>
                    </div>
                  )}

                  {/* Model Stats */}
                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      fontSize: "14px",
                      color: "#FFFFFF",
                            fontWeight: "500",
                          }}
                        >
                    <span
                          style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>🎭</span>
                      {model.poses?.length || 0} Poses
                    </span>
                    <span
                          style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>👤</span>
                      Model
                    </span>
                      </div>

                  {/* Regenerate Poses Button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!token) return;
                      
                      setIsGeneratingPoses(true);
                      try {
                        const res = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL}/models/${model.id}/generate-poses`,
                          {
                            method: "POST",
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          }
                        );

                        if (!res.ok) {
                          throw new Error(`Pose generation failed: ${res.status}`);
                        }

                        const result = await res.json();
                        console.log("✅ Poses regenerated:", result.total_poses);
                        
                        // Refresh models list to show new poses
                        await fetchModels();
                        
                        alert(`✅ Successfully generated ${result.total_poses} new poses for ${model.name}!`);
                      } catch (error) {
                        console.error("❌ Pose generation error:", error);
                        alert("Failed to generate poses. Please try again.");
                      } finally {
                        setIsGeneratingPoses(false);
                      }
                    }}
                    disabled={isGeneratingPoses}
                    style={{
                      marginTop: "16px",
                      padding: "10px 20px",
                      backgroundColor: isGeneratingPoses 
                        ? "rgba(107, 114, 128, 0.9)" 
                        : "rgba(34, 211, 238, 0.9)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: isGeneratingPoses ? "not-allowed" : "pointer",
                      pointerEvents: "auto",
                      transition: "all 0.2s ease",
                      backdropFilter: "blur(4px)",
                      opacity: isGeneratingPoses ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isGeneratingPoses) {
                        e.currentTarget.style.backgroundColor = "rgba(34, 211, 238, 1)";
                        e.currentTarget.style.transform = "scale(1.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGeneratingPoses) {
                        e.currentTarget.style.backgroundColor = "rgba(34, 211, 238, 0.9)";
                        e.currentTarget.style.transform = "scale(1)";
                      }
                    }}
                  >
                    {isGeneratingPoses ? "⏳ Generating..." : "🔄 Regenerate Poses"}
                  </button>

                  {/* Click to View Profile */}
                  <div
                        style={{
                      marginTop: "16px",
                      backgroundColor: "rgba(139, 92, 246, 0.8)",
                          color: "#FFFFFF",
                      padding: "8px 16px",
                      borderRadius: "20px",
                          fontSize: "12px",
                      fontWeight: "600",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    Click to View Profile
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
                Add New Model
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
                Model Name
              </label>
              <input
                type="text"
                value={newModel.name}
                onChange={(e) =>
                  setNewModel({ ...newModel, name: e.target.value })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#1F2937",
                  fontSize: "14px",
                }}
                placeholder="Enter model name"
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
                Description (optional)
              </label>
              <textarea
                value={newModel.description}
                onChange={(e) =>
                  setNewModel({ ...newModel, description: e.target.value })
                }
                style={{
                  width: "100%",
                  height: "80px",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#1F2937",
                  fontSize: "14px",
                  resize: "vertical",
                }}
                placeholder="Height, measurements, etc."
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
                Gender
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => setNewModel({ ...newModel, gender: "male" })}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    backgroundColor:
                      newModel.gender === "male" ? "#8B5CF6" : "transparent",
                    color: newModel.gender === "male" ? "#FFFFFF" : "#6B7280",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  ♂ Male
                </button>
                <button
                  onClick={() => setNewModel({ ...newModel, gender: "female" })}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    backgroundColor:
                      newModel.gender === "female" ? "#8B5CF6" : "transparent",
                    color: newModel.gender === "female" ? "#FFFFFF" : "#6B7280",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  ♀ Female
                </button>
              </div>
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
                Model Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewModel({
                    ...newModel,
                    image: e.target.files?.[0] || null,
                  })
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#1F2937",
                }}
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "4px",
                }}
              >
                Best results with full-body or upper-body photos
              </p>
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
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!newModel.name || !newModel.image || isUploading}
                style={{
                  padding: "12px 24px",
                  backgroundColor:
                    !newModel.name || !newModel.image || isUploading
                      ? "#9CA3AF"
                      : "#8B5CF6",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  cursor:
                    !newModel.name || !newModel.image || isUploading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {isUploading ? "Uploading..." : "Add Model"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Model Modal */}
      {showGenerateModal && (
        <>
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
                width: "90vw",
                height: "80vh",
                maxWidth: "1200px",
                maxHeight: "800px",
                border: "1px solid #E5E7EB",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {/* Left Panel - Model Display */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#F9FAFB",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Gender Switcher */}
                <div
                  style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px",
                    display: "flex",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "8px",
                    padding: "2px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    border: "1px solid rgba(229, 231, 235, 0.8)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <button
                    onClick={() => setSelectedGender("male")}
                    style={{
                      padding: "6px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor:
                        selectedGender === "male" ? "#8B5CF6" : "transparent",
                      color: selectedGender === "male" ? "#FFFFFF" : "#6B7280",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      transition: "all 0.2s ease",
                    }}
                    title="Male"
                  >
                    ♂
                  </button>
                  <button
                    onClick={() => setSelectedGender("female")}
                    style={{
                      padding: "6px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor:
                        selectedGender === "female" ? "#8B5CF6" : "transparent",
                      color:
                        selectedGender === "female" ? "#FFFFFF" : "#6B7280",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      transition: "all 0.2s ease",
                    }}
                    title="Female"
                  >
                    ♀
                  </button>
                </div>

                {/* Model Display */}
                {generatedModel ? (
                  <img
                    src={generatedModel}
                    alt="Generated Model"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                ) : (
                  <img
                    src={
                      selectedGender === "male"
                        ? "https://i.ibb.co/M5n1qznw/model.png"
                        : "https://i.ibb.co/tp4LPg7t/model-female.png"
                    }
                    alt={`Base ${
                      selectedGender === "male" ? "Male" : "Female"
                    } Model`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    }}
                  />
                )}
              </div>

              {/* Right Panel - Input */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#000000",
                  display: "flex",
                  flexDirection: "column",
                  padding: "32px",
                  position: "relative",
                }}
              >
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setGeneratedModel(null);
                    setGeneratePrompt("");
                  }}
                  style={{
                    position: "absolute",
                    top: "24px",
                    right: "24px",
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>

                {/* Title */}
                <h2
                  style={{
                    color: "#FFFFFF",
                    fontSize: "24px",
                    fontWeight: "600",
                    margin: "0 0 24px 0",
                  }}
                >
                  Generate Model
                </h2>

                {/* Prompt Input */}
                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      color: "#E5E7EB",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "8px",
                    }}
                  >
                    Describe your model
                  </label>
                  <textarea
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    placeholder="Type your modifications... (e.g., 'wearing a blue suit, short blonde hair, standing with arms crossed')"
                    style={{
                      width: "100%",
                      height: "120px",
                      padding: "16px",
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                {/* Physical Attributes */}
                <div
                  style={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "20px",
                  }}
                >
                  <h3
                    style={{
                      color: "#E5E7EB",
                      fontSize: "14px",
                      margin: "0 0 12px 0",
                      fontWeight: "600",
                    }}
                  >
                    Physical Attributes
                  </h3>

                  {/* Two Column Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    {/* Age */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Age: {physicalAttributes.age}
                      </label>
                      <input
                        type="range"
                        min="18"
                        max="60"
                        step="1"
                        value={physicalAttributes.age}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            age: parseInt(e.target.value),
                          })
                        }
                        style={{
                          width: "100%",
                          height: "4px",
                          borderRadius: "2px",
                          background: "#374151",
                          outline: "none",
                          accentColor: "#8B5CF6",
                        }}
                      />
                    </div>

                    {/* Height */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Height
                      </label>
                      <select
                        value={physicalAttributes.height}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            height: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          backgroundColor: "#374151",
                          border: "1px solid #4B5563",
                          borderRadius: "4px",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="short">Short</option>
                        <option value="average">Average</option>
                        <option value="tall">Tall</option>
                      </select>
                    </div>

                    {/* Build */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Build
                      </label>
                      <select
                        value={physicalAttributes.build}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            build: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          backgroundColor: "#374151",
                          border: "1px solid #4B5563",
                          borderRadius: "4px",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="slim">Slim</option>
                        <option value="athletic">Athletic</option>
                        <option value="muscular">Muscular</option>
                        <option value="curvy">Curvy</option>
                      </select>
                    </div>

                    {/* Hair Color */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Hair
                      </label>
                      <select
                        value={physicalAttributes.hairColor}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            hairColor: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          backgroundColor: "#374151",
                          border: "1px solid #4B5563",
                          borderRadius: "4px",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="black">Black</option>
                        <option value="brown">Brown</option>
                        <option value="blonde">Blonde</option>
                        <option value="red">Red</option>
                        <option value="gray">Gray</option>
                      </select>
                    </div>

                    {/* Eye Color */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Eyes
                      </label>
                      <select
                        value={physicalAttributes.eyeColor}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            eyeColor: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          backgroundColor: "#374151",
                          border: "1px solid #4B5563",
                          borderRadius: "4px",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="brown">Brown</option>
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="hazel">Hazel</option>
                        <option value="gray">Gray</option>
                      </select>
                    </div>

                    {/* Skin Tone */}
                    <div>
                      <label
                        style={{
                          display: "block",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          marginBottom: "4px",
                          fontWeight: "500",
                        }}
                      >
                        Skin
                      </label>
                      <select
                        value={physicalAttributes.skinTone}
                        onChange={(e) =>
                          setPhysicalAttributes({
                            ...physicalAttributes,
                            skinTone: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          backgroundColor: "#374151",
                          border: "1px solid #4B5563",
                          borderRadius: "4px",
                          color: "#D1D5DB",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      >
                        <option value="fair">Fair</option>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="olive">Olive</option>
                        <option value="tan">Tan</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      padding: "6px 10px",
                      backgroundColor: "#111827",
                      borderRadius: "4px",
                      border: "1px solid #374151",
                    }}
                  >
                    <p
                      style={{
                        color: "#9CA3AF",
                        fontSize: "11px",
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      💰 1 credit per model
                    </p>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateModel}
                  disabled={isGeneratingModel}
                  style={{
                    width: "100%",
                    padding: "16px",
                    backgroundColor: isGeneratingModel ? "#374151" : "#10B981",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: isGeneratingModel ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {isGeneratingModel && (
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid #FFFFFF",
                        borderTop: "2px solid transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                  {isGeneratingModel
                    ? "Generating Model..."
                    : "✨ Generate Model"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pose Generation Modal */}
      {showPoseModal && selectedModel && (
        <>
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
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPoseModal(false);
            }
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
              position: "relative",
              zIndex: 1001,
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
              <h2
                style={{
                  color: "#1F2937",
                  fontSize: "20px",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                Generate Model Poses
              </h2>
              <button
                onClick={() => setShowPoseModal(false)}
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
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Model: {selectedModel.name}
              </div>
              <div
                style={{
                  width: "100%",
                  height: "200px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#F3F4F6",
                }}
              >
                <img
                  src={selectedModel.image_url}
                  alt={selectedModel.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
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
                Model Gender
              </label>
              <div style={{ display: "flex", gap: "12px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={modelGender === "male"}
                    onChange={(e) =>
                      setModelGender(e.target.value as "male" | "female")
                    }
                    style={{ margin: 0 }}
                  />
                  <span style={{ color: "#374151", fontSize: "14px" }}>
                    Male
                  </span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={modelGender === "female"}
                    onChange={(e) =>
                      setModelGender(e.target.value as "male" | "female")
                    }
                    style={{ margin: 0 }}
                  />
                  <span style={{ color: "#374151", fontSize: "14px" }}>
                    Female
                  </span>
                </label>
              </div>
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
                Pose Description
              </label>
              <textarea
                value={posePrompt}
                onChange={(e) => setPosePrompt(e.target.value)}
                style={{
                  width: "100%",
                  height: "80px",
                  padding: "12px",
                  backgroundColor: "#F9FAFB",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#1F2937",
                  fontSize: "14px",
                  resize: "vertical",
                }}
                placeholder="Describe the poses you want to generate..."
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "4px",
                }}
              >
                Example: "fashion model in different poses, standing, sitting,
                walking"
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "24px",
              }}
            >
                {/* Variants Selector */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#1E293B",
                    }}
                  >
                    Number of Poses
                  </label>
                  <select
                    value={poseVariants}
                    onChange={(e) => setPoseVariants(parseInt(e.target.value))}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      fontSize: "14px",
                      backgroundColor: "#FFFFFF",
                      color: "#1E293B",
                    }}
                  >
                    <option value={1}>1 pose</option>
                    <option value={2}>2 poses</option>
                    <option value={3}>3 poses</option>
                    <option value={4}>4 poses</option>
                    <option value={5}>5 poses</option>
                  </select>
                </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#1E293B",
                  marginBottom: "4px",
                }}
              >
                  Cost: {poseVariants} credit{poseVariants > 1 ? "s" : ""}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                }}
              >
                  This will generate {poseVariants} dynamic pose
                  {poseVariants > 1 ? "s" : ""} of the same model
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
                onClick={() => setShowPoseModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleGeneratePoses();
                }}
                disabled={isGeneratingPoses}
                style={{
                  padding: "12px 24px",
                  backgroundColor: isGeneratingPoses ? "#9CA3AF" : "#22D3EE",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  cursor: isGeneratingPoses ? "not-allowed" : "pointer",
                  position: "relative",
                  zIndex: 10,
                  transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                }}
                onMouseEnter={(e) => {
                  if (!isGeneratingPoses) {
                    e.currentTarget.style.backgroundColor = "#06B6D4";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isGeneratingPoses) {
                    e.currentTarget.style.backgroundColor = "#22D3EE";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                  {isGeneratingPoses && (
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid #FFFFFF",
                        borderTop: "2px solid transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                  {isGeneratingPoses ? "Generating Poses..." : "Generate Poses"}
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Generated Poses Results Modal */}
      {showPoseResults &&
        generatedPoses.length > 0 &&
        (() => {
          console.log("Rendering results modal with poses:", generatedPoses);
          return (
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
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowPoseResults(false);
                }
              }}
            >
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  padding: "32px",
                  width: "90vw",
                  maxWidth: "1200px",
                  maxHeight: "90vh",
                  border: "1px solid #E5E7EB",
                  position: "relative",
                  zIndex: 1001,
                  overflow: "auto",
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
                  <h2
                    style={{
                      color: "#1F2937",
                      fontSize: "24px",
                      fontWeight: "600",
                      margin: 0,
                    }}
                  >
                    Generated Model Poses
                  </h2>
                  <button
                    onClick={() => setShowPoseResults(false)}
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "20px",
                    marginBottom: "24px",
                  }}
                >
                  {generatedPoses.map((poseUrl, index) => (
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
                          src={poseUrl}
                          alt={`Generated pose ${index + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onLoad={() => {
                            console.log(
                              `Successfully loaded pose image ${index + 1}:`,
                              poseUrl
                            );
                          }}
                          onError={(e) => {
                            console.error(
                              `Failed to load pose image ${index + 1}:`,
                              poseUrl
                            );
                            e.currentTarget.style.display = "none";
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
                          Pose {index + 1}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => setShowPoseResults(false)}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#8B5CF6",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Model Poses Modal */}
      {showModelPosesModal && selectedModelForPoses && (
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
            setShowModelPosesModal(false);
            setSelectedModelForPoses(null);
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
                {selectedModelForPoses.name} - All Poses (
                {selectedModelForPoses.poses?.length || 0})
              </h2>
              <button
                onClick={() => {
                  setShowModelPosesModal(false);
                  setSelectedModelForPoses(null);
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              {selectedModelForPoses.poses?.map((poseUrl, index) => (
                <div
                  key={index}
                  style={{
                    aspectRatio: "2/3",
                    borderRadius: "12px",
                    overflow: "hidden",
                    backgroundColor: "#F3F4F6",
                    position: "relative",
                  }}
                >
                  <img
                    src={poseUrl}
                    alt={`Pose ${index + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      cursor: "pointer",
                    }}
                    onClick={() => handlePoseZoom(poseUrl)}
                    onError={(e) => {
                      console.error(
                        `Failed to load pose ${index + 1}:`,
                        poseUrl
                      );
                    }}
                  />
                  {/* Delete button overlay */}
                  <button
                    onClick={() =>
                      handleDeletePose(selectedModelForPoses.id, index)
                    }
                    disabled={deletingPoseIndex === index}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(239, 68, 68, 0.9)",
                      border: "none",
                      color: "white",
                      fontSize: "16px",
                      cursor:
                        deletingPoseIndex === index ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: deletingPoseIndex === index ? 0.6 : 1,
                    }}
                    title="Delete this pose"
                  >
                    {deletingPoseIndex === index ? "..." : "×"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pose Zoom Modal */}
      {showPoseZoomModal && selectedPoseForZoom && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => {
            setShowPoseZoomModal(false);
            setSelectedPoseForZoom(null);
          }}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "95vw",
              maxHeight: "95vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setShowPoseZoomModal(false);
                setSelectedPoseForZoom(null);
              }}
              style={{
                position: "absolute",
                top: "-50px",
                right: "0",
                background: "rgba(255, 255, 255, 0.9)",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "24px",
                cursor: "pointer",
                color: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2001,
              }}
            >
              ×
            </button>

            {/* Zoomed image */}
            <img
              src={selectedPoseForZoom}
              alt="Zoomed pose"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
              onError={(e) => {
                console.error(
                  "Failed to load zoomed pose:",
                  selectedPoseForZoom
                );
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Model Modal */}
      {showEditModal && editingModel && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              width: "90%",
              maxWidth: "500px",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1F2937",
                marginBottom: "20px",
              }}
            >
              Edit Model
            </h2>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Model Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Enter model name"
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Description (Optional)
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Enter model description"
                rows={3}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Gender
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => setEditForm({ ...editForm, gender: "male" })}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    backgroundColor:
                      editForm.gender === "male" ? "#8B5CF6" : "transparent",
                    color: editForm.gender === "male" ? "#FFFFFF" : "#6B7280",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  ♂ Male
                </button>
                <button
                  onClick={() => setEditForm({ ...editForm, gender: "female" })}
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #D1D5DB",
                    backgroundColor:
                      editForm.gender === "female" ? "#8B5CF6" : "transparent",
                    color: editForm.gender === "female" ? "#FFFFFF" : "#6B7280",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  ♀ Female
                </button>
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
                onClick={() => {
                  setShowEditModal(false);
                  setEditingModel(null);
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.name.trim()}
                style={{
                  padding: "10px 20px",
                  backgroundColor: editForm.name.trim() ? "#8B5CF6" : "#D1D5DB",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  cursor: editForm.name.trim() ? "pointer" : "not-allowed",
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Profile Modal */}
      {showModelProfileModal && selectedModelForProfile && (
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
              width: "800px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              border: "1px solid #E5E7EB",
              overflow: "auto",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "24px",
                paddingBottom: "16px",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#1F2937",
                  margin: 0,
                }}
              >
                {selectedModelForProfile.name} Profile
              </h2>
              <button
                onClick={() => setShowModelProfileModal(false)}
                style={{
                  padding: "8px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
    </div>

            {/* Modal Content */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "32px",
                marginBottom: "24px",
              }}
            >
              {/* Left Side - Model Image */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    aspectRatio: "2/3",
                    borderRadius: "12px",
                    overflow: "hidden",
                    backgroundColor: "#F3F4F6",
                  }}
                >
                  <img
                    src={selectedModelForProfile.image_url}
                    alt={selectedModelForProfile.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      e.currentTarget.src = `${process.env.NEXT_PUBLIC_API_URL}/static/Julian_model.jpg`;
                    }}
                  />
                </div>

                {/* Model Info */}
                <div
                  style={{
                    backgroundColor: "#F9FAFB",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1F2937",
                      marginBottom: "8px",
                    }}
                  >
                    Model Information
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#374151",
                        }}
                      >
                        Name:
                      </span>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          marginLeft: "8px",
                        }}
                      >
                        {selectedModelForProfile.name}
                      </span>
                    </div>
                    {selectedModelForProfile.description && (
                      <div>
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: "#374151",
                          }}
                        >
                          Description:
                        </span>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            margin: "4px 0 0 0",
                            lineHeight: 1.4,
                          }}
                        >
                          {selectedModelForProfile.description}
                        </p>
                      </div>
                    )}
                    <div>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#374151",
                        }}
                      >
                        Poses Generated:
                      </span>
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                          marginLeft: "8px",
                        }}
                      >
                        {selectedModelForProfile.poses?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Actions and Poses */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Action Buttons */}
                <div
                  style={{
                    backgroundColor: "#F9FAFB",
                    padding: "20px",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1F2937",
                      marginBottom: "16px",
                    }}
                  >
                    Actions
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowModelProfileModal(false);
                        setSelectedModel(selectedModelForProfile);
                        setShowPoseModal(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "#22D3EE",
                        border: "none",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      🎭 Generate Poses
                    </button>
                    <button
                      onClick={() => {
                        setShowModelProfileModal(false);
                        handleEditModel(selectedModelForProfile);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        color: "#6B7280",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      ✏️ Edit Model
                    </button>
                    <button
                      onClick={() => {
                        setShowModelProfileModal(false);
                        handleDeleteModel(selectedModelForProfile);
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        backgroundColor: "transparent",
                        border: "1px solid #EF4444",
                        borderRadius: "8px",
                        color: "#EF4444",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      🗑️ Delete Model
                    </button>
                  </div>
                </div>

                {/* Generated Poses */}
                {selectedModelForProfile.poses &&
                  selectedModelForProfile.poses.length > 0 && (
                    <div
                      style={{
                        backgroundColor: "#F9FAFB",
                        padding: "20px",
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#1F2937",
                          marginBottom: "16px",
                        }}
                      >
                        Generated Poses ({selectedModelForProfile.poses.length})
                      </h3>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(80px, 1fr))",
                          gap: "12px",
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                      >
                        {selectedModelForProfile.poses.map((poseUrl, index) => (
                          <div
                            key={index}
                            style={{
                              aspectRatio: "2/3",
                              borderRadius: "8px",
                              overflow: "hidden",
                              backgroundColor: "#F3F4F6",
                              cursor: "pointer",
                              transition: "transform 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            onClick={() => {
                              setShowModelProfileModal(false);
                              setSelectedModelForPoses(selectedModelForProfile);
                              setShowModelPosesModal(true);
                            }}
                          >
                            <img
                              src={poseUrl}
                              alt={`Pose ${index + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setShowModelProfileModal(false);
                          setSelectedModelForPoses(selectedModelForProfile);
                          setShowModelPosesModal(true);
                        }}
                        style={{
                          width: "100%",
                          marginTop: "12px",
                          padding: "8px 12px",
                          backgroundColor: "transparent",
                          border: "1px solid #8B5CF6",
                          borderRadius: "6px",
                          color: "#8B5CF6",
                          fontSize: "12px",
                          fontWeight: "500",
                          cursor: "pointer",
                        }}
                      >
                        View All Poses
                      </button>
                    </div>
                  )}

                {/* No Poses Message */}
                {(!selectedModelForProfile.poses ||
                  selectedModelForProfile.poses.length === 0) && (
                  <div
                    style={{
                      backgroundColor: "#F9FAFB",
                      padding: "20px",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "48px",
                        marginBottom: "12px",
                      }}
                    >
                      🎭
                    </div>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "8px",
                      }}
                    >
                      No Poses Generated
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                        margin: 0,
                      }}
                    >
                      Generate poses to see them here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                paddingTop: "16px",
                borderTop: "1px solid #E5E7EB",
              }}
            >
              <button
                onClick={() => setShowModelProfileModal(false)}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
