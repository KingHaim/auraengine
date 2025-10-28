"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import AppLayout from "../../components/AppLayout";

// Add CSS for spinner animation
const spinnerCSS = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

interface Product {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  packshots: string[];
  category?: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

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

interface Scene {
  id: string;
  name: string;
  description?: string;
  image_url: string;
  is_standard: boolean;
  category?: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
}

interface Generation {
  id: string;
  product_id: string;
  model_id: string;
  scene_id: string;
  mode: string;
  prompt: string;
  output_urls: string[];
  video_urls?: string[];
  status: string;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  generation_status: string;
  settings: any;
  generations?: Generation[];
  created_at: string;
  updated_at?: string;
}

export default function CampaignsPage() {
  const { user, token, loading } = useAuth();

  // Inject spinner CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = spinnerCSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
  });
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingInModal, setIsGeneratingInModal] = useState(false);
  const [generatingCampaign, setGeneratingCampaign] = useState<string | null>(
    null
  );
  const [forceLoaded, setForceLoaded] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [selectedPoses, setSelectedPoses] = useState<{
    [modelId: string]: string[];
  }>({});
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<{
    [key: string]: string;
  }>({});
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptModalData, setPromptModalData] = useState<{
    generationId: string;
    imageIndex: number;
  } | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [videoQuality, setVideoQuality] = useState("480p");
  const [videoModel, setVideoModel] = useState("wan");
  const [videoDuration, setVideoDuration] = useState("5s");

  // Parameter selection modal state
  const [showParameterModal, setShowParameterModal] = useState(false);
  const [selectedCampaignForGeneration, setSelectedCampaignForGeneration] =
    useState<Campaign | null>(null);
  const [selectedProductsForGeneration, setSelectedProductsForGeneration] =
    useState<string[]>([]);
  const [selectedModelForGeneration, setSelectedModelForGeneration] =
    useState<string>("");
  const [selectedScenesForGeneration, setSelectedScenesForGeneration] =
    useState<string[]>([]);
  const [selectedPosesForGeneration, setSelectedPosesForGeneration] = useState<{
    [key: string]: string[];
  }>({});
  const [numberOfImagesToGenerate, setNumberOfImagesToGenerate] = useState(1);
  const [showCampaignProfileModal, setShowCampaignProfileModal] =
    useState(false);
  const [selectedCampaignForProfile, setSelectedCampaignForProfile] =
    useState<Campaign | null>(null);
  const [showEnlargedImage, setShowEnlargedImage] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string>("");
  const [enlargedImageAlt, setEnlargedImageAlt] = useState<string>("");
  const [showBulkVideoModal, setShowBulkVideoModal] = useState(false);
  const [selectedCampaignForBulkVideo, setSelectedCampaignForBulkVideo] =
    useState<Campaign | null>(null);
  const [bulkVideoCustomPrompt, setBulkVideoCustomPrompt] = useState("");
  const [bulkVideoQuality, setBulkVideoQuality] = useState("480p");
  const [bulkVideoModel, setBulkVideoModel] = useState("wan");
  const [bulkVideoDuration, setBulkVideoDuration] = useState("5s");
  const [generatingBulkVideos, setGeneratingBulkVideos] = useState(false);
  const [showVideoModelDropdown, setShowVideoModelDropdown] = useState(false);

  // Helper function to get video model information
  const getVideoModelInfo = (model: string) => {
    const models = {
      wan: {
        name: "Wan 2.2 I2V Fast",
        icon: "⚡",
        badge: "FAST",
        badgeColor: "#DCFCE7",
        badgeTextColor: "#166534",
        description: "Quick and efficient video generation",
        pricing: "480p (1 credit) • 720p (2 credits)",
      },
      seedance: {
        name: "Seedance 1 Pro",
        icon: "🎭",
        badge: "PRO",
        badgeColor: "#FEF3C7",
        badgeTextColor: "#D97706",
        description:
          "High-quality video generation with multiple duration options",
        pricing: "480p/1080p • 5s/10s • 2-6 credits",
      },
      veo: {
        name: "Google Veo 3.1",
        icon: "⭐",
        badge: "PREMIUM",
        badgeColor: "#F0F9FF",
        badgeTextColor: "#0EA5E9",
        description: "Premium AI video generation with advanced capabilities",
        pricing: "480p/720p/1080p • 5s/10s • 3-8 credits",
      },
      kling: {
        name: "Kling 2.5 Turbo Pro",
        icon: "⚡",
        badge: "PRO",
        badgeColor: "#FEF3C7",
        badgeTextColor: "#D97706",
        description: "Professional-grade video generation with turbo speed",
        pricing: "480p/720p/1080p • 5s/10s • 2-6 credits",
      },
    };
    return models[model as keyof typeof models];
  };
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(
    new Set()
  );
  const [selectMode, setSelectMode] = useState(false);
  const [showTweakModal, setShowTweakModal] = useState(false);
  const [tweakPrompt, setTweakPrompt] = useState("");
  const [tweaking, setTweaking] = useState(false);
  const [currentImageForTweak, setCurrentImageForTweak] = useState<string>("");
  const [reapplyingClothes, setReapplyingClothes] = useState(false);
  const [currentImageMetadata, setCurrentImageMetadata] = useState<any>(null);
  const [selectedImagesForVideo, setSelectedImagesForVideo] = useState<
    Set<number>
  >(new Set());
  const [veoDirectMode, setVeoDirectMode] = useState(false);
  const [generatingCampaignId, setGeneratingCampaignId] = useState<
    string | null
  >(null);
  const [showModelSelectionModal, setShowModelSelectionModal] = useState(false);
  const [showProductSelectionModal, setShowProductSelectionModal] =
    useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const [currentDisplayedImage, setCurrentDisplayedImage] = useState<
    string | null
  >(null);

  // Function to get last generated images from campaigns
  const getLastGeneratedImages = () => {
    const allImages: string[] = [];

    campaigns.forEach((campaign) => {
      if (campaign.settings?.generated_images?.length > 0) {
        campaign.settings.generated_images.forEach((img: any) => {
          if (img.image_url) {
            allImages.push(img.image_url);
          }
        });
      }
    });

    // Sort by campaign creation date (most recent first) and take last 2
    const sortedImages = allImages.slice(-2).reverse();
    setLastGeneratedImages(sortedImages);

    // Set the most recent image as current displayed image
    if (sortedImages.length > 0 && !currentDisplayedImage) {
      setCurrentDisplayedImage(sortedImages[0]);
    }

    console.log("🖼️ Last generated images:", sortedImages);
  };

  // Function to fetch data from API
  const fetchData = async () => {
    if (!token) {
      console.log("No token available, skipping fetch");
      return null;
    }

    try {
      console.log("🔍 Fetching campaigns data from API...");
      console.log("Token:", token.substring(0, 20) + "...");

      // Fetch all data in parallel
      const [campaignsRes, productsRes, modelsRes, scenesRes] =
        await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/models`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/scenes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

      console.log("API Response statuses:", {
        campaigns: campaignsRes.status,
        products: productsRes.status,
        models: modelsRes.status,
        scenes: scenesRes.status,
      });

      let campaignsData = [];
      if (campaignsRes.ok) {
        campaignsData = await campaignsRes.json();
        console.log("🔍 fetchData - Raw campaigns data:", campaignsData);
        console.log(
          "🔍 fetchData - Number of campaigns:",
          campaignsData.length
        );
        campaignsData.forEach((campaign: any, index: number) => {
          console.log(`🔍 fetchData - Campaign ${index}:`, {
            id: campaign.id,
            name: campaign.name,
            generation_status: campaign.generation_status,
            status: campaign.status,
          });
        });
        setCampaigns(campaignsData);
        console.log(
          "🔍 fetchData - setCampaigns called with:",
          campaignsData.length,
          "campaigns"
        );
      } else {
        console.error(
          "Campaigns fetch failed:",
          campaignsRes.status,
          await campaignsRes.text()
        );
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        console.log("Products data:", productsData);
        setProducts(productsData);
      } else {
        console.error(
          "Products fetch failed:",
          productsRes.status,
          await productsRes.text()
        );
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        console.log("Models data:", modelsData);
        setModels(modelsData);
      } else {
        console.error(
          "Models fetch failed:",
          modelsRes.status,
          await modelsRes.text()
        );
      }

      if (scenesRes.ok) {
        const scenesData = await scenesRes.json();
        console.log("🎬 Scenes data:", scenesData);
        console.log("🎬 Scenes count:", scenesData.length);
        console.log("🎬 First scene:", scenesData[0]);
        setScenes(scenesData);
      } else {
        console.error(
          "❌ Scenes fetch failed:",
          scenesRes.status,
          await scenesRes.text()
        );
      }

      console.log("✅ Fetched all campaigns data");
      return campaignsData;
    } catch (error) {
      console.error("💥 Error fetching campaigns data:", error);
      return [];
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    console.log("📊 Fetching real data from API...");
    if (token) {
      fetchData();
    }
  }, [token]);

  // Debug modal state
  useEffect(() => {
    console.log("🎭 Modal state changed:", showCreateModal);
  }, [showCreateModal]);

  // Debug data state
  useEffect(() => {
    console.log("📊 Data state:", {
      campaigns: campaigns.length,
      products: products.length,
      models: models.length,
      scenes: scenes.length,
      user: user?.email,
      token: token ? "present" : "missing",
    });
    console.log("📊 Products data:", products);
    console.log("📊 Models data:", models);
    console.log("📊 Scenes data:", scenes);
  }, [campaigns, products, models, scenes, user, token]);

  // Force loading to resolve after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("⏰ Force loading timeout reached");
      setForceLoaded(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Clear generating state when campaign is completed
  useEffect(() => {
    if (generatingCampaignId) {
      const campaign = campaigns.find((c) => c.id === generatingCampaignId);
      if (campaign && campaign.generation_status === "completed") {
        console.log(
          "🔍 Campaign completed, clearing generating state for:",
          generatingCampaignId
        );
        setGeneratingCampaignId(null);

        // Show the first generated image in the left panel
        if (campaign.settings?.generated_images?.length > 0) {
          const firstImage = campaign.settings.generated_images[0];
          console.log("🖼️ First image object from polling:", firstImage);
          console.log(
            "🖼️ Setting generated image URL from polling:",
            firstImage.image_url
          );
          setGeneratedImageUrl(firstImage.image_url);
          setCurrentDisplayedImage(firstImage.image_url);
        } else {
          console.log("❌ No generated images found in campaign from polling");
        }
      }
    }
  }, [campaigns, generatingCampaignId]);

  // Update last generated images when campaigns change
  useEffect(() => {
    getLastGeneratedImages();
  }, [campaigns]);

  const handleCreateCampaign = async () => {
    console.log("🔍 handleCreateCampaign called");

    if (
      !newCampaign.name ||
      selectedProducts.length === 0 ||
      !selectedModel ||
      selectedScenes.length === 0
    ) {
      console.log("❌ Validation failed - missing fields");
      alert(
        "Please fill in campaign name and select at least one product, model, and scene"
      );
      return;
    }

    if (!token) {
      alert("Please log in to create campaigns");
      return;
    }

    console.log("🎯 Creating campaign with:", {
      name: newCampaign.name,
      products: selectedProducts.length,
      models: selectedModel ? 1 : 0,
      scenes: selectedScenes.length,
    });

    setIsCreating(true);
    setIsGeneratingInModal(true);
    console.log("🔍 Set isCreating to true and starting generation in modal");

    // Clear any previous generated image
    setGeneratedImageUrl(null);

    try {
      const formData = new FormData();
      formData.append("name", newCampaign.name);
      formData.append("description", newCampaign.description);
      formData.append("product_ids", JSON.stringify(selectedProducts));
      formData.append("model_ids", JSON.stringify([selectedModel]));
      formData.append("scene_ids", JSON.stringify(selectedScenes));
      formData.append("selected_poses", JSON.stringify(selectedPoses));
      formData.append("number_of_images", numberOfImagesToGenerate.toString());

      console.log("🔍 About to make fetch request to create campaign");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/create`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );
      console.log("🔍 Fetch request completed");

      console.log("🔍 Response status:", response.status);
      console.log("🔍 Response ok:", response.ok);

      if (response.ok) {
        console.log("🔍 Response is OK, processing...");
        const result = await response.json();
        console.log("✅ Campaign created:", result);
        console.log("🔍 Campaign ID from result:", result.campaign?.id);

        // Set generating state immediately for instant feedback
        console.log("🔍 About to set generatingCampaignId...");
        console.log("🔍 result.campaign:", result.campaign);
        console.log("🔍 result.campaign.id:", result.campaign?.id);
        console.log(
          "🔍 typeof result.campaign.id:",
          typeof result.campaign?.id
        );

        if (!result.campaign?.id) {
          console.error("❌ ERROR: result.campaign.id is undefined or null!");
          throw new Error("Campaign ID is missing from response");
        }

        setGeneratingCampaignId(result.campaign.id);
        console.log("🔍 Set generatingCampaignId to:", result.campaign.id);

        // Add the new campaign to the list immediately with generating status
        const newCampaignWithGeneratingStatus = {
          ...result.campaign,
          generation_status: "generating",
        };
        console.log(
          "🔍 Adding new campaign to list immediately:",
          newCampaignWithGeneratingStatus
        );
        setCampaigns((prevCampaigns) => [
          newCampaignWithGeneratingStatus,
          ...prevCampaigns,
        ]);

        // Refresh campaigns list to get the real campaign data
        console.log("🔍 Before fetchData, campaigns count:", campaigns.length);
        const freshCampaignsData = await fetchData();
        console.log(
          "🔍 After fetchData, fresh campaigns data:",
          freshCampaignsData
        );
        console.log("🔍 Looking for campaign with ID:", result.campaign.id);
        const newCampaign = freshCampaignsData?.find(
          (c: any) => c.id === result.campaign.id
        );
        console.log("🔍 Found campaign:", newCampaign);
        if (newCampaign) {
          console.log(
            "🔍 Campaign generation_status:",
            newCampaign.generation_status
          );
          console.log("🔍 Campaign settings:", newCampaign.settings);
          console.log(
            "🔍 Generated images:",
            newCampaign.settings?.generated_images
          );
          // Replace the temporary campaign with the real one from the server
          setCampaigns((prevCampaigns) =>
            prevCampaigns.map((campaign) =>
              campaign.id === result.campaign.id ? newCampaign : campaign
            )
          );
          // If campaign is already completed, clear the generating state and show the image
          if (newCampaign.generation_status === "completed") {
            console.log(
              "🔍 Campaign already completed, clearing generating state"
            );
            setGeneratingCampaignId(null);

            // Show the first generated image in the left panel
            if (newCampaign.settings?.generated_images?.length > 0) {
              const firstImage = newCampaign.settings.generated_images[0];
              console.log("🖼️ First image object:", firstImage);
              console.log(
                "🖼️ Setting generated image URL:",
                firstImage.image_url
              );
              setGeneratedImageUrl(firstImage.image_url);
              setCurrentDisplayedImage(firstImage.image_url);
            } else {
              console.log("❌ No generated images found in campaign");
            }
          }
        }

        // Reset form
        setNewCampaign({ name: "", description: "" });
        setSelectedProducts([]);
        setSelectedModel("");
        setSelectedScenes([]);

        // Show alert after UI has been updated
        alert(
          `✅ Campaign "${result.campaign.name}" created successfully! ${result.total_combinations} images will be generated. Credits remaining: ${result.credits_remaining}`
        );
      } else {
        console.log("❌ Response not OK - Status:", response.status);
        console.log("❌ Response not OK - StatusText:", response.statusText);
        const error = await response.text();
        console.error("❌ Campaign creation failed:", response.status);
        console.error("Error details:", error);
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign creation failed:", error);
      alert(
        "Campaign creation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsCreating(false);
      setIsGeneratingInModal(false);
    }
  };

  const handleGenerateCampaign = async (campaignId: string) => {
    if (!token) {
      alert("Please log in to generate campaign images");
      return;
    }

    setGeneratingCampaign(campaignId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Campaign generation completed:", result);
        alert(
          `✅ Campaign generation completed! Generated ${result.completed}/${result.total} images.`
        );

        // Refresh campaigns list
        await fetchData();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign generation failed:", error);
      alert(
        "Campaign generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setGeneratingCampaign(null);
    }
  };

  const toggleSelection = (
    id: string,
    type: "products" | "models" | "scenes"
  ) => {
    switch (type) {
      case "products":
        setSelectedProducts((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
        );
        break;
      case "models":
        if (selectedModel === id) {
          // Deselecting the currently selected model - clear all poses for this model
          setSelectedPoses((prevPoses) => ({
            ...prevPoses,
            [id]: [],
          }));
          setSelectedModel("");
        } else {
          // Selecting a new model - clear poses for the previous model and select new one
          setSelectedPoses((prevPoses) => ({
            ...prevPoses,
            [selectedModel]: [], // Clear poses for previous model
          }));
          setSelectedModel(id);
        }
        break;
      case "scenes":
        setSelectedScenes((prev) =>
          prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
        break;
    }
  };

  const viewCampaignDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowCampaignModal(true);
  };

  const handleOpenCampaignProfile = (campaign: Campaign) => {
    setSelectedCampaignForProfile(campaign);
    setShowCampaignProfileModal(true);
  };

  const handleEnlargeImage = (
    imageUrl: string,
    alt: string,
    metadata?: any
  ) => {
    setEnlargedImageUrl(imageUrl);
    setEnlargedImageAlt(alt);
    setCurrentImageForTweak(imageUrl);
    setCurrentImageMetadata(metadata || null);
    setShowEnlargedImage(true);
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename || "campaign-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reapplyClothes = async () => {
    if (!token) {
      alert("Please log in to reapply clothes");
      return;
    }

    // Try to get product_id from image metadata or from campaign settings
    let productId = currentImageMetadata?.product_id;
    let clothingType = currentImageMetadata?.clothing_type || "top";

    // If no product_id in image, try to get from campaign settings
    const productIds = selectedCampaignForProfile?.settings?.product_ids;
    if (!productId && productIds?.length && productIds.length > 0) {
      productId = productIds[0];
      console.log("Using product_id from campaign settings:", productId);
    }

    if (!productId) {
      alert("❌ Cannot reapply clothes: product information not available");
      return;
    }

    setReapplyingClothes(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reapply-clothes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            image_url: currentImageForTweak,
            product_id: productId,
            clothing_type: clothingType,
            campaign_id: selectedCampaignForProfile?.id || null,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the enlarged image with the new result immediately
        setEnlargedImageUrl(data.reapplied_url);
        setCurrentImageForTweak(data.reapplied_url);

        // Refresh campaign data to show updated image in the grid
        await fetchData();

        // Show success message after refresh
        alert(
          `✅ ${data.message}\n\nThe image has been updated with the new try-on result.`
        );
      } else {
        const error = await response.json();
        alert(`❌ Reapply clothes failed: ${error.detail}`);
      }
    } catch (error) {
      console.error("Error reapplying clothes:", error);
      alert("❌ Failed to reapply clothes. Please try again.");
    } finally {
      setReapplyingClothes(false);
    }
  };

  const tweakImage = async () => {
    if (!tweakPrompt.trim()) {
      alert("Please enter a prompt for tweaking");
      return;
    }

    if (!token) {
      alert("Please log in to tweak images");
      return;
    }

    setTweaking(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tweak-image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: currentImageForTweak,
            prompt: tweakPrompt,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Tweak result:", result);

        // Update the enlarged image with the tweaked version
        setEnlargedImageUrl(result.tweaked_url);
        setCurrentImageForTweak(result.tweaked_url);
        setShowTweakModal(false);
        setTweakPrompt("");

        alert("✅ Image tweaked successfully!");
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Tweak failed");
      }
    } catch (error) {
      console.error("Tweak failed:", error);
      alert(
        "❌ Tweak failed:\n" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setTweaking(false);
    }
  };

  const deleteCampaignImage = async (
    campaignId: string,
    imageIndex: number
  ) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    if (!token) {
      alert("Please log in to delete images");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/images/${imageIndex}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Image deleted:", result);

        alert(
          `✅ Image deleted successfully! ${result.remaining_images} images remaining.`
        );

        // Refresh campaign data
        await fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Delete failed");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert(
        "❌ Delete failed:\n" +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaigns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const selectAllCampaigns = () => {
    if (selectedCampaigns.size === campaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(campaigns.map((c) => c.id)));
    }
  };

  const bulkDeleteCampaigns = async () => {
    if (selectedCampaigns.size === 0) {
      alert("No campaigns selected");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedCampaigns.size} campaign(s)?`
      )
    ) {
      return;
    }

    if (!token) {
      alert("Please log in to delete campaigns");
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const campaignId of selectedCampaigns) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            console.error(
              `Failed to delete campaign ${campaignId}:`,
              await response.text()
            );
          }
        } catch (error) {
          failCount++;
          console.error(`Error deleting campaign ${campaignId}:`, error);
        }
      }

      alert(
        `Bulk delete completed:\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`
      );

      // Refresh campaigns and reset selection
      await fetchData();
      setSelectedCampaigns(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Bulk delete failed: " + String(error));
    }
  };

  const editCampaign = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setEditingCampaign(campaign);
    setEditForm({
      name: campaign.name,
      description: campaign.description || "",
    });
    setShowEditModal(true);
  };

  const deleteCampaign = async (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click

    if (
      !confirm(
        "Are you sure you want to delete this campaign? This action cannot be undone."
      )
    ) {
      return;
    }

    if (!token) {
      alert("Please log in to delete campaigns");
      return;
    }

    setIsDeleting(campaignId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert("Campaign deleted successfully!");
        // Refresh campaigns list
        await fetchData();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign deletion failed:", error);
      alert(
        "Campaign deletion failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign || !token) {
      return;
    }

    if (!editForm.name.trim()) {
      alert("Campaign name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${editingCampaign.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: editForm.name,
            description: editForm.description,
          }),
        }
      );

      if (response.ok) {
        alert("Campaign updated successfully!");
        // Refresh campaigns list
        await fetchData();
        setShowEditModal(false);
        setEditingCampaign(null);
        setEditForm({ name: "", description: "" });
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Campaign update failed:", error);
      alert(
        "Campaign update failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const generateMoreImages = async (campaign: Campaign) => {
    if (!token) {
      alert("Please log in to generate images");
      return;
    }

    // Set the campaign and initialize with campaign's current settings
    setSelectedCampaignForGeneration(campaign);
    setSelectedProductsForGeneration(campaign.settings?.product_ids || []);
    setSelectedModelForGeneration(campaign.settings?.model_ids?.[0] || "");
    setSelectedScenesForGeneration(campaign.settings?.scene_ids || []);
    setSelectedPosesForGeneration(campaign.settings?.selected_poses || {});
    setShowParameterModal(true);
  };

  const executeImageGeneration = async () => {
    if (!selectedCampaignForGeneration || !token) {
      return;
    }

    setGeneratingMore(true);
    try {
      const formData = new FormData();
      formData.append(
        "product_ids",
        JSON.stringify(selectedProductsForGeneration)
      );
      formData.append(
        "model_ids",
        JSON.stringify([selectedModelForGeneration])
      );
      formData.append("scene_ids", JSON.stringify(selectedScenesForGeneration));
      formData.append(
        "selected_poses",
        JSON.stringify(selectedPosesForGeneration)
      );
      formData.append("number_of_images", numberOfImagesToGenerate.toString());

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForGeneration.id}/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        alert("Generating more images for this campaign!");
        // Refresh campaigns list to show updated images
        await fetchData();
        setShowParameterModal(false);
        setShowGenerateModal(false);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      alert(
        "Image generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setGeneratingMore(false);
    }
  };

  const generateVideo = async (
    generationId: string,
    imageIndex: number,
    customPrompt?: string,
    videoQuality: string = "480p",
    videoModel: string = "wan",
    videoDuration: string = "5s"
  ) => {
    if (!token) {
      alert("Please log in to generate videos");
      return;
    }

    setGeneratingVideo(generationId);
    setVideoGenerationStatus((prev) => ({
      ...prev,
      [generationId]: "generating",
    }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/generations/${generationId}/generate-video`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            video_quality: videoQuality,
            duration: videoDuration,
            model: videoModel,
            custom_prompt: customPrompt || null,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Video generated:", result);
        alert(
          `✅ Video generated successfully! Credits remaining: ${result.credits_remaining}`
        );

        // Update the campaign data to include the video
        if (selectedCampaign && selectedCampaign.settings?.generated_images) {
          const updatedImages = [...selectedCampaign.settings.generated_images];
          if (updatedImages[imageIndex]) {
            updatedImages[imageIndex].video_url = result.video_url;
          }

          setSelectedCampaign({
            ...selectedCampaign,
            settings: {
              ...selectedCampaign.settings,
              generated_images: updatedImages,
            },
          });
        }

        setVideoGenerationStatus((prev) => ({
          ...prev,
          [generationId]: "completed",
        }));
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error("Video generation failed:", error);
      alert(
        "Video generation failed: " +
          (error instanceof Error ? error.message : String(error))
      );
      setVideoGenerationStatus((prev) => ({
        ...prev,
        [generationId]: "failed",
      }));
    } finally {
      setGeneratingVideo(null);
    }
  };

  const toggleModelDropdown = (modelId: string) => {
    setExpandedModel(expandedModel === modelId ? null : modelId);
  };

  const closeModelDropdown = () => {
    setExpandedModel(null);
  };

  const togglePoseSelection = (modelId: string, poseUrl: string) => {
    setSelectedPoses((prev) => {
      const currentPoses = prev[modelId] || [];
      const isSelected = currentPoses.includes(poseUrl);

      if (isSelected) {
        // Remove pose
        const newPoses = {
          ...prev,
          [modelId]: currentPoses.filter((url) => url !== poseUrl),
        };

        // If no poses left for this model, deselect the model
        if (newPoses[modelId].length === 0) {
          setSelectedModel("");
        }

        return newPoses;
      } else {
        // Add pose and automatically select the model
        setSelectedModel(modelId);

        return {
          ...prev,
          [modelId]: [...currentPoses, poseUrl],
        };
      }
    });
  };

  const selectAllPoses = (modelId: string, poses: string[]) => {
    setSelectedPoses((prev) => ({
      ...prev,
      [modelId]: poses,
    }));

    // Automatically select the model when selecting all poses
    setSelectedModel(modelId);
  };

  const clearPoseSelection = (modelId: string) => {
    setSelectedPoses((prev) => ({
      ...prev,
      [modelId]: [],
    }));

    // Deselect the model when clearing poses
    setSelectedModel("");
  };

  // Show loading state while authentication is being checked
  if (loading) {
    // Temporarily disable loading check
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
          <div>Loading... (Debug: loading={loading.toString()})</div>
          <div style={{ fontSize: "12px", marginTop: "8px", color: "#9BA3AF" }}>
            If this takes too long, there might be an auth issue
          </div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user || !token) {
    console.log("🔐 No user or token, showing login prompt");
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
            Please log in to access your campaigns
          </p>
          <div style={{ marginBottom: "16px" }}>
            <button
              onClick={() => {
                console.log("🧪 Test modal button clicked!");
                setShowCreateModal(true);
              }}
              style={{
                padding: "12px 24px",
                backgroundColor: "#22D3EE",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "500",
                cursor: "pointer",
                marginRight: "12px",
              }}
            >
              🧪 Test Modal (No Auth)
            </button>
          </div>
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
      <style>{`
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
          padding: "0",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Main Content Area */}
        <div style={{ padding: "32px", flex: 1, backgroundColor: "#FFFFFF" }}>
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
                Campaigns
              </h1>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {selectMode && (
                <>
                  <button
                    onClick={selectAllCampaigns}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#64748B",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    {selectedCampaigns.size === campaigns.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <button
                    onClick={bulkDeleteCampaigns}
                    disabled={selectedCampaigns.size === 0}
                    style={{
                      padding: "12px 24px",
                      backgroundColor:
                        selectedCampaigns.size === 0 ? "#CBD5E1" : "#EF4444",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor:
                        selectedCampaigns.size === 0
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    🗑️ Delete ({selectedCampaigns.size})
                  </button>
                  <button
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedCampaigns(new Set());
                    }}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#F1F5F9",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      color: "#475569",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
              {!selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    color: "#475569",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                  className="select-button"
                >
                  ☑️ Select
                </button>
              )}
              <button
                onClick={() => {
                  console.log("🎯 Create Campaign button clicked!");
                  console.log(
                    "Current showCreateModal state:",
                    showCreateModal
                  );
                  console.log("🎬 Current scenes state:", scenes);
                  console.log("🎬 Scenes length:", scenes.length);
                  setShowCreateModal(true);
                  console.log("Set showCreateModal to true");
                }}
                style={{
                  width: "48px",
                  height: "48px",
                  backgroundColor: "#d42f48",
                  border: "none",
                  borderRadius: "50%",
                  color: "#FFFFFF",
                  fontSize: "24px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.backgroundColor = "#b0263c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.backgroundColor = "#d42f48";
                }}
              >
                +
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
            YOUR CAMPAIGNS ({campaigns.length})
          </div>

          {campaigns.length === 0 ? (
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
                🎯
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                No campaigns yet
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Create your first campaign by selecting products, models, and
                scenes
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#d42f48",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div
              className="campaign-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                alignItems: "start",
              }}
            >
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="campaign-card"
                  style={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                    position: "relative",
                    background: "#FFFFFF",
                    opacity:
                      campaign.generation_status === "generating" ||
                      generatingCampaignId === campaign.id
                        ? 0.75
                        : 1,
                    boxShadow: selectedCampaigns.has(campaign.id)
                      ? "0 0 0 3px #d42f48"
                      : "0 2px 8px rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    aspectRatio: "1",
                  }}
                  onClick={(e) => {
                    if (selectMode) {
                      e.stopPropagation();
                      toggleCampaignSelection(campaign.id);
                    } else {
                      handleOpenCampaignProfile(campaign);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 30px rgba(0,0,0,0.15)";
                    const overlay = e.currentTarget.querySelector(
                      "[data-hover-overlay]"
                    ) as HTMLElement;
                    if (overlay) {
                      overlay.style.opacity = "1";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.08)";
                    const overlay = e.currentTarget.querySelector(
                      "[data-hover-overlay]"
                    ) as HTMLElement;
                    if (overlay) {
                      overlay.style.opacity = "0";
                    }
                  }}
                >
                  {/* Checkbox (in select mode) */}
                  {selectMode && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        left: "12px",
                        zIndex: 10,
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        backgroundColor: selectedCampaigns.has(campaign.id)
                          ? "#d42f48"
                          : "#FFFFFF",
                        border: selectedCampaigns.has(campaign.id)
                          ? "2px solid #d42f48"
                          : "2px solid #CBD5E1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCampaignSelection(campaign.id);
                      }}
                    >
                      {selectedCampaigns.has(campaign.id) && (
                        <span
                          style={{
                            color: "#FFFFFF",
                            fontSize: "18px",
                            lineHeight: 1,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                  {/* Campaign Image */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      position: "relative",
                      overflow: "hidden",
                      backgroundColor: "#F3F4F6",
                    }}
                  >
                    {/* Semi-transparent title overlay for mobile */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                        color: "white",
                        padding: "8px",
                        fontSize: "12px",
                        fontWeight: "500",
                        textAlign: "center",
                        zIndex: 1,
                        display: "none", // Hidden by default, shown via CSS on mobile
                      }}
                      className="campaign-title-overlay"
                    >
                      {campaign.name}
                    </div>
                    {(() => {
                      const isGenerating =
                        campaign.generation_status === "generating" ||
                        generatingCampaignId === campaign.id;
                      console.log(`🔍 Rendering campaign ${campaign.id}:`, {
                        name: campaign.name,
                        generation_status: campaign.generation_status,
                        generatingCampaignId: generatingCampaignId,
                        isGenerating: isGenerating,
                        hasImages:
                          campaign.settings?.generated_images?.length > 0,
                      });
                      return isGenerating;
                    })() ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#454545",
                        }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            border: "2px solid #ffffff",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                            marginBottom: "8px",
                          }}
                        />
                        <div
                          style={{
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: "500",
                          }}
                        >
                          Generando...
                        </div>
                      </div>
                    ) : campaign.settings?.generated_images?.[0]?.image_url ? (
                      <img
                        src={campaign.settings.generated_images[0].image_url}
                        alt={campaign.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          cursor: "pointer",
                        }}
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NSA3NUgxMTVWMTI1SDg1Vjc1WiIgZmlsbD0iIzlDQTNBRiIvPgo8dGV4dCB4PSIxMDAiIHk9IjE1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPC9zdmc+";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "48px",
                          color: "#9CA3AF",
                        }}
                      >
                        📁
                      </div>
                    )}
                  </div>

                  {/* Campaign Info */}
                  <div
                    style={{
                      padding: "20px",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: "18px",
                          fontWeight: "600",
                          color: "#1F2937",
                          margin: "0 0 8px 0",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#6B7280",
                            margin: 0,
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {campaign.description}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        fontSize: "12px",
                        color: "#6B7280",
                        marginTop: "12px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🖼️ {campaign.settings?.generated_images?.length || 0}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🎬{" "}
                        {campaign.settings?.generated_images?.filter(
                          (img: any) => img.video_url
                        )?.length || 0}
                      </span>
                      {(campaign.generation_status === "generating" ||
                        generatingCampaignId === campaign.id) && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#d42f48",
                            fontWeight: "500",
                          }}
                        >
                          ⏳ Generando...
                        </span>
                      )}
                      {campaign.generation_status === "failed" && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            color: "#EF4444",
                            fontWeight: "500",
                          }}
                        >
                          ❌ Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Overlay */}
                  <div
                    data-hover-overlay
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.5)",
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
                    <div
                      style={{
                        backgroundColor: "rgba(212, 47, 72, 0.9)",
                        color: "#FFFFFF",
                        padding: "10px 20px",
                        borderRadius: "24px",
                        fontSize: "14px",
                        fontWeight: "600",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      Click to Edit/Delete
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Campaign Modal */}
        {showCreateModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              overflow: "auto",
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: "16px",
                maxWidth: "95vw",
                maxHeight: "95vh",
                width: "min(1400px, 95vw)",
                height: "min(800px, 95vh)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "row",
              }}
              onClick={(e) => {
                e.stopPropagation();
                closeModelDropdown();
              }}
            >
              {/* Left Panel - Visual Display (40% width) */}
              <div
                style={{
                  width: "40%",
                  height: "100%",
                  backgroundColor: "#111827",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Generation Overlay */}
                {isGeneratingInModal && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      backdropFilter: "blur(8px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 100,
                      gap: "20px",
                    }}
                  >
                    <img
                      src="/beating.gif"
                      alt="Generating..."
                      style={{
                        width: "150px",
                        height: "150px",
                        objectFit: "contain",
                      }}
                    />
                    <div
                      style={{
                        color: "#FFFFFF",
                        fontSize: "18px",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      Generating Campaign...
                    </div>
                    <div
                      style={{
                        color: "#E5E7EB",
                        fontSize: "14px",
                        textAlign: "center",
                        maxWidth: "200px",
                      }}
                    >
                      Creating your campaign with AI models
                    </div>
                  </div>
                )}
                {/* History/Previous Generations - Top Left */}
                <div
                  style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {/* Undo/Refresh Icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      backgroundColor: "rgba(9, 10, 12, 0.7)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#FFFFFF",
                      fontSize: "18px",
                    }}
                    title="Undo/Refresh"
                  >
                    ↶
                  </div>

                  {/* History Thumbnails */}
                  {lastGeneratedImages.length > 0 ? (
                    lastGeneratedImages.slice(0, 2).map((imageUrl, index) => (
                      <div
                        key={index}
                        onClick={() => setCurrentDisplayedImage(imageUrl)}
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundImage: `url(${imageUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          borderRadius: "8px",
                          cursor: "pointer",
                          border:
                            currentDisplayedImage === imageUrl
                              ? "2px solid #d42f48"
                              : "1px solid #6B7280",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {currentDisplayedImage === imageUrl && (
                          <div
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              width: "16px",
                              height: "16px",
                              backgroundColor: "#d42f48",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "#FFFFFF",
                              fontWeight: "bold",
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <>
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#454545",
                          borderRadius: "8px",
                          border: "1px solid #6B7280",
                          backgroundImage:
                            'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23454545"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="12">Preview</text></svg>\')',
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          opacity: 0.5,
                        }}
                      />
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          backgroundColor: "#454545",
                          borderRadius: "8px",
                          border: "1px solid #6B7280",
                          backgroundImage:
                            'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23454545"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="12">Previous</text></svg>\')',
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          opacity: 0.5,
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Main Image Display - Takes whole left side */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#454545",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage:
                      currentDisplayedImage || generatedImageUrl
                        ? `url(${currentDisplayedImage || generatedImageUrl})`
                        : 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="%23454545"/><text x="200" y="300" text-anchor="middle" dy=".3em" fill="white" font-size="18">Generated Image Will Appear Here</text></svg>\')',
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: "2px solid #4B5563",
                    position: "relative",
                  }}
                >
                  {generatingCampaignId &&
                    !currentDisplayedImage &&
                    !generatedImageUrl && (
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          backgroundColor: "rgba(9, 10, 12, 0.8)",
                          color: "#FFFFFF",
                          padding: "20px 30px",
                          borderRadius: "12px",
                          fontSize: "16px",
                          fontWeight: "500",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            border: "2px solid #FFFFFF",
                            borderTop: "2px solid transparent",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        Generating...
                      </div>
                    )}
                </div>
              </div>

              {/* Right Panel - Control Panel (60% width) */}
              <div
                style={{
                  width: "60%",
                  height: "100%",
                  backgroundColor: "#454545",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  boxSizing: "border-box",
                }}
              >
                {/* Campaign Name Input */}
                <div style={{ marginBottom: "16px" }}>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, name: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      backgroundColor: "#4B5563",
                      border: "1px solid #6B7280",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#FFFFFF",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="Enter campaign name"
                  />
                </div>

                {/* SCENES Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    SCENES ({scenes.length})
                    {selectedScenes.length > 0 && (
                      <span
                        style={{
                          fontSize: "12px",
                          backgroundColor: "#d42f48",
                          color: "#FFFFFF",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {selectedScenes.length} selected
                      </span>
                    )}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      overflowX: "auto",
                      paddingBottom: "8px",
                      scrollbarWidth: "thin",
                      scrollbarColor: "#4B5563 #374151",
                    }}
                  >
                    {scenes.length === 0 ? (
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                          padding: "20px",
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        No scenes available
                      </div>
                    ) : (
                      scenes.map((scene) => {
                        console.log("🎬 Rendering scene:", scene);
                        return (
                          <div
                            key={scene.id}
                            onClick={() => toggleSelection(scene.id, "scenes")}
                            style={{
                              minWidth: "120px",
                              height: "80px",
                              backgroundColor: "#4B5563",
                              borderRadius: "8px",
                              backgroundImage: `url(${scene.image_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              cursor: "pointer",
                              border: selectedScenes.includes(scene.id)
                                ? "2px solid #d42f48"
                                : "1px solid #6B7280",
                              position: "relative",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                bottom: "0",
                                left: "0",
                                right: "0",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "4px 8px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              {scene.name}
                            </div>
                            {selectedScenes.includes(scene.id) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                  width: "20px",
                                  height: "20px",
                                  backgroundColor: "#d42f48",
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "12px",
                                  color: "#FFFFFF",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* MODELS Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    MODELS
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedModel ? (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          backgroundImage: `url(${
                            models.find((m) => m.id === selectedModel)
                              ?.image_url
                          })`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          cursor: "pointer",
                          border: "2px solid #d42f48",
                          position: "relative",
                        }}
                        onClick={() => setShowModelSelectionModal(true)}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "4px",
                            backgroundColor: "rgba(9, 10, 12, 0.7)",
                            color: "#FFFFFF",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "500",
                          }}
                        >
                          ✓
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          border: "2px dashed #6B7280",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          textAlign: "center",
                        }}
                        onClick={() => setShowModelSelectionModal(true)}
                      >
                        + Model
                      </div>
                    )}
                  </div>
                </div>

                {/* PRODUCTS Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    PRODUCTS
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    {selectedProducts.length > 0 ? (
                      selectedProducts.slice(0, 2).map((productId) => {
                        const product = products.find(
                          (p) => p.id === productId
                        );
                        return (
                          <div
                            key={productId}
                            style={{
                              width: "120px",
                              height: "80px",
                              backgroundColor: "#4B5563",
                              borderRadius: "8px",
                              backgroundImage: `url(${product?.image_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              cursor: "pointer",
                              border: "2px solid #d42f48",
                              position: "relative",
                            }}
                            onClick={() => setShowProductSelectionModal(true)}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: "500",
                              }}
                            >
                              ✓
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                bottom: "0",
                                left: "0",
                                right: "0",
                                backgroundColor: "rgba(9, 10, 12, 0.7)",
                                color: "#FFFFFF",
                                padding: "4px 8px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              {product?.name}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          width: "120px",
                          height: "80px",
                          backgroundColor: "#4B5563",
                          borderRadius: "8px",
                          border: "2px dashed #6B7280",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#FFFFFF",
                        }}
                        onClick={() => setShowProductSelectionModal(true)}
                      >
                        <div style={{ fontSize: "24px", marginBottom: "4px" }}>
                          👔
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "500" }}>
                          ADD PRODUCT
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* POSES Section */}
                <div style={{ marginBottom: "16px" }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    POSES
                  </h3>
                  <div
                    style={{
                      color: "#9CA3AF",
                      fontSize: "14px",
                    }}
                  >
                    Select a model to view poses
                  </div>
                </div>

                {/* REGENERATE Button */}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    onClick={() => {
                      console.log("🔍 REGENERATE button clicked!");
                      console.log("🔍 Button state:", {
                        isCreating,
                        hasName: !!newCampaign.name,
                        hasProducts: selectedProducts.length > 0,
                        hasModel: !!selectedModel,
                        hasScenes: selectedScenes.length > 0,
                        disabled:
                          isCreating ||
                          !newCampaign.name ||
                          selectedProducts.length === 0 ||
                          !selectedModel ||
                          selectedScenes.length === 0,
                      });
                      handleCreateCampaign();
                    }}
                    disabled={
                      isCreating ||
                      isGeneratingInModal ||
                      !newCampaign.name ||
                      selectedProducts.length === 0 ||
                      !selectedModel ||
                      selectedScenes.length === 0
                    }
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      backgroundColor:
                        isCreating || isGeneratingInModal
                          ? "#6B7280"
                          : !newCampaign.name ||
                            selectedProducts.length === 0 ||
                            !selectedModel ||
                            selectedScenes.length === 0
                          ? "#4B5563"
                          : "#EF4444",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor:
                        isCreating ||
                        isGeneratingInModal ||
                        !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                          ? "not-allowed"
                          : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "all 0.2s",
                      opacity:
                        isCreating ||
                        !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                          ? 0.6
                          : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.backgroundColor = "#DC2626";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCreating) {
                        e.currentTarget.style.backgroundColor = "#EF4444";
                      }
                    }}
                  >
                    {isCreating
                      ? "Creating Campaign..."
                      : !newCampaign.name ||
                        selectedProducts.length === 0 ||
                        !selectedModel ||
                        selectedScenes.length === 0
                      ? "Complete Selection"
                      : "REGENERATE"}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      <span>🪙</span>
                      <span>5</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Model Selection Modal */}
        {showModelSelectionModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowModelSelectionModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: "16px",
                padding: "24px",
                width: "400px",
                maxHeight: "600px",
                overflowY: "auto",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  color: "#FFFFFF",
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                Select Model
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {models.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => {
                      toggleSelection(model.id, "models");
                      setShowModelSelectionModal(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      backgroundColor:
                        selectedModel === model.id ? "#374151" : "#4B5563",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border:
                        selectedModel === model.id
                          ? "2px solid #d42f48"
                          : "1px solid #6B7280",
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={model.image_url}
                      alt={model.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "#FFFFFF",
                          fontSize: "16px",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        {model.name}
                      </div>
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                        }}
                      >
                        {model.poses?.length || 0} poses available
                      </div>
                    </div>
                    {selectedModel === model.id && (
                      <div
                        style={{
                          color: "#d42f48",
                          fontSize: "20px",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowModelSelectionModal(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginTop: "20px",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Product Selection Modal */}
        {showProductSelectionModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowProductSelectionModal(false)}
          >
            <div
              style={{
                backgroundColor: "#1F2937",
                borderRadius: "16px",
                padding: "24px",
                width: "500px",
                maxHeight: "600px",
                overflowY: "auto",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  color: "#FFFFFF",
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                Select Products
              </h3>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => toggleSelection(product.id, "products")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px",
                      backgroundColor: selectedProducts.includes(product.id)
                        ? "#374151"
                        : "#4B5563",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: selectedProducts.includes(product.id)
                        ? "2px solid #d42f48"
                        : "1px solid #6B7280",
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "#FFFFFF",
                          fontSize: "16px",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                      >
                        {product.name}
                      </div>
                      <div
                        style={{
                          color: "#9CA3AF",
                          fontSize: "14px",
                        }}
                      >
                        {product.packshots.length} packshots
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => {}}
                      style={{
                        width: "20px",
                        height: "20px",
                        accentColor: "#d42f48",
                      }}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowProductSelectionModal(false)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#6B7280",
                  border: "none",
                  borderRadius: "8px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  marginTop: "20px",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Campaign Details Modal */}
        {showCampaignModal && selectedCampaign && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              overflow: "auto",
            }}
            onClick={() => setShowCampaignModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "90vw",
                maxHeight: "90vh",
                width: "1000px",
                position: "relative",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "24px",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  {selectedCampaign.name}
                </h2>
                <button
                  onClick={() => generateMoreImages(selectedCampaign)}
                  disabled={generatingMore}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: generatingMore ? "#9CA3AF" : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: generatingMore ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {generatingMore ? "⏳ Generating..." : "✨ Generate More"}
                </button>
              </div>

              {selectedCampaign.description && (
                <p
                  style={{
                    margin: "0 0 32px 0",
                    color: "#6B7280",
                    fontSize: "16px",
                    lineHeight: "1.5",
                  }}
                >
                  {selectedCampaign.description}
                </p>
              )}

              {/* Campaign Status & Workflow */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "24px",
                  padding: "16px",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "16px" }}
                >
                  {selectedCampaign.settings?.total_combinations && (
                    <span
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                      }}
                    >
                      {selectedCampaign.settings.total_combinations} images
                      generated
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>
                    🛍️ Products:{" "}
                    {selectedCampaign.settings?.product_ids?.length || 0}
                  </span>
                  <span>•</span>
                  <span>
                    👤 Models:{" "}
                    {selectedCampaign.settings?.model_ids?.length || 0}
                  </span>
                  <span>•</span>
                  <span>
                    🎬 Scenes:{" "}
                    {selectedCampaign.settings?.scene_ids?.length || 0}
                  </span>
                </div>
              </div>

              {/* Generated Images */}
              {selectedCampaign.settings?.generated_images &&
              selectedCampaign.settings.generated_images.length > 0 ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
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
                      Generated Images (
                      {selectedCampaign.settings.generated_images.length})
                    </h3>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#6B7280",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>📸</span>
                      <span>Click to view full size</span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    {selectedCampaign.settings.generated_images.map(
                      (img: any, index: number) => (
                        <div
                          key={index}
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#F9FAFB",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            position: "relative",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                            e.currentTarget.style.boxShadow =
                              "0 8px 25px rgba(0,0,0,0.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          onClick={() => {
                            if (img.video_url) {
                              window.open(img.video_url, "_blank");
                            } else {
                              window.open(img.image_url, "_blank");
                            }
                          }}
                        >
                          <div style={{ position: "relative" }}>
                            {img.video_url ? (
                              <video
                                src={img.video_url}
                                style={{
                                  width: "100%",
                                  height: "200px",
                                  objectFit: "cover",
                                }}
                                controls
                                loop
                                muted
                                autoPlay
                                preload="metadata"
                                onError={(e) => {
                                  // Fallback to image if video fails
                                  const videoElement = e.currentTarget;
                                  const imgElement =
                                    videoElement.nextElementSibling as HTMLImageElement;
                                  if (imgElement) {
                                    videoElement.style.display = "none";
                                    imgElement.style.display = "block";
                                  }
                                }}
                              />
                            ) : null}
                            <img
                              src={img.image_url}
                              alt={`${img.product_name} + ${img.model_name} + ${img.scene_name}`}
                              style={{
                                width: "100%",
                                height: "200px",
                                objectFit: "cover",
                                display: img.video_url ? "none" : "block",
                              }}
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://via.placeholder.com/300x200?text=Image+Error";
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                backgroundColor: "rgba(0,0,0,0.7)",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "500",
                              }}
                            >
                              #{index + 1}
                            </div>
                            {img.video_url && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  left: "8px",
                                  backgroundColor: "rgba(139, 92, 246, 0.9)",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                🎬 Video
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "12px" }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#1F2937",
                                marginBottom: "4px",
                              }}
                            >
                              {img.product_name} + {img.model_name}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#6B7280",
                                marginBottom: "8px",
                              }}
                            >
                              Scene: {img.scene_name}
                            </div>

                            {/* Generate Video Button */}
                            {!img.video_url && (
                              <div style={{ marginBottom: "8px" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const generationId = img.generation_id;
                                    if (generationId) {
                                      setPromptModalData({
                                        generationId,
                                        imageIndex: index,
                                      });
                                      setCustomPrompt("");
                                      setVideoQuality("480p"); // Reset to default
                                      setVideoModel("wan"); // Reset to default
                                      setVideoDuration("5s"); // Reset to default
                                      setShowPromptModal(true);
                                    } else {
                                      alert(
                                        "Generation ID not found. Please refresh the page."
                                      );
                                    }
                                  }}
                                  disabled={
                                    generatingVideo === img.generation_id
                                  }
                                  style={{
                                    padding: "6px 12px",
                                    backgroundColor:
                                      generatingVideo === img.generation_id
                                        ? "#9CA3AF"
                                        : "#d42f48",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    cursor:
                                      generatingVideo === img.generation_id
                                        ? "not-allowed"
                                        : "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    width: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  {generatingVideo === img.generation_id ? (
                                    <>
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
                                    </>
                                  ) : (
                                    <>🎬 Generate Video</>
                                  )}
                                </button>
                              </div>
                            )}

                            <div
                              style={{
                                fontSize: "11px",
                                color: "#9CA3AF",
                                fontStyle: "italic",
                              }}
                            >
                              Click to view full size
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 40px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "12px",
                    marginBottom: "24px",
                    border: "2px dashed #D1D5DB",
                  }}
                >
                  <div style={{ fontSize: "64px", marginBottom: "20px" }}>
                    📁
                  </div>
                  <h3
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#1F2937",
                      marginBottom: "12px",
                    }}
                  >
                    Empty Campaign Folder
                  </h3>
                  <p
                    style={{
                      color: "#6B7280",
                      marginBottom: "24px",
                      fontSize: "16px",
                    }}
                  >
                    This campaign folder is empty. Generate some images to get
                    started!
                  </p>
                  <button
                    onClick={() => generateMoreImages(selectedCampaign)}
                    disabled={generatingMore}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: generatingMore ? "#9CA3AF" : "#d42f48",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: generatingMore ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      margin: "0 auto",
                    }}
                  >
                    {generatingMore ? (
                      <>
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
                        Generating...
                      </>
                    ) : (
                      "✨ Generate First Images"
                    )}
                  </button>
                </div>
              )}

              {/* Close Button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "24px",
                }}
              >
                <button
                  onClick={() => setShowCampaignModal(false)}
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
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Campaign Modal */}
        {showEditModal && editingCampaign && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowEditModal(false)}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                padding: "32px",
                width: "90%",
                maxWidth: "500px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                color: "#1F2937",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                Edit Campaign
              </h2>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "8px",
                  }}
                >
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#1F2937",
                    fontSize: "14px",
                  }}
                  placeholder="Enter campaign name"
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
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#1F2937",
                    fontSize: "14px",
                    minHeight: "80px",
                    resize: "vertical",
                  }}
                  placeholder="Enter campaign description"
                />
              </div>

              {/* Number of Images Selection */}
              <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                <h3
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Number of Images to Generate
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <label
                      key={num}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 16px",
                        backgroundColor:
                          numberOfImagesToGenerate === num
                            ? "#d42f48"
                            : "#F3F4F6",
                        color:
                          numberOfImagesToGenerate === num
                            ? "#FFFFFF"
                            : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#E5E7EB";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#F3F4F6";
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="numberOfImagesCreate"
                        value={num}
                        checked={numberOfImagesToGenerate === num}
                        onChange={() => setNumberOfImagesToGenerate(num)}
                        style={{ marginRight: "8px" }}
                      />
                      {num} {num === 1 ? "Image" : "Images"}
                    </label>
                  ))}
                </div>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  Generate a professional photoshoot image with the selected
                  model, product, and scene
                </p>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowEditModal(false)}
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
                  onClick={handleUpdateCampaign}
                  disabled={isUpdating || !editForm.name.trim()}
                  style={{
                    padding: "12px 24px",
                    backgroundColor:
                      isUpdating || !editForm.name.trim()
                        ? "#9CA3AF"
                        : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      isUpdating || !editForm.name.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isUpdating ? "Updating..." : "Update Campaign"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Generation Prompt Modal */}
        {showPromptModal && promptModalData && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowPromptModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "90%",
                maxWidth: "500px",
                maxHeight: "80vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Generate Video
              </h3>
              <p
                style={{
                  margin: "0 0 16px 0",
                  color: "#6B7280",
                  fontSize: "14px",
                }}
              >
                Enter a custom prompt for video generation (optional). Leave
                empty to use the default prompt.
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="A realistic model wearing the product, integrated naturally into the scene..."
                style={{
                  width: "100%",
                  height: "120px",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              {/* Video Model Selection */}
              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Video Model
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "wan"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "wan" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="wan"
                      checked={videoModel === "wan"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Wan 2.2 I2V Fast
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        Fast generation, 480p/720p
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "seedance"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "seedance" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="seedance"
                      checked={videoModel === "seedance"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Seedance 1 Pro
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        High quality, 480p/720p/1080p
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoModel === "kling"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoModel === "kling" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoModel"
                      value="kling"
                      checked={videoModel === "kling"}
                      onChange={(e) => setVideoModel(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        Kling 2.5 Turbo Pro
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        Pro-level quality with smooth motion
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Video Quality Selection */}
              <div style={{ marginTop: "16px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  Video Quality
                </label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoQuality === "480p"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoQuality === "480p" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoQuality"
                      value="480p"
                      checked={videoQuality === "480p"}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        480p
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        {videoModel === "seedance" ? "1 credit" : "1 credit"} -
                        Standard quality
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      border:
                        videoQuality === "720p"
                          ? "2px solid #d42f48"
                          : "1px solid #D1D5DB",
                      borderRadius: "8px",
                      cursor: "pointer",
                      backgroundColor:
                        videoQuality === "720p" ? "#F3F4F6" : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="videoQuality"
                      value="720p"
                      checked={videoQuality === "720p"}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      style={{ margin: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: "500", fontSize: "14px" }}>
                        720p
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280" }}>
                        {videoModel === "seedance" ? "2 credits" : "2 credits"}{" "}
                        - High quality
                      </div>
                    </div>
                  </label>
                  {videoModel === "seedance" && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoQuality === "1080p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoQuality === "1080p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoQuality"
                        value="1080p"
                        checked={videoQuality === "1080p"}
                        onChange={(e) => setVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          1080p
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          3 credits - Ultra high quality
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Video Duration Selection (for Seedance and Kling) */}
              {(videoModel === "seedance" || videoModel === "kling") && (
                <div style={{ marginTop: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    Video Duration
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoDuration === "5s"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoDuration === "5s" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoDuration"
                        value="5s"
                        checked={videoDuration === "5s"}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          5 seconds
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          Standard duration
                        </div>
                      </div>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        border:
                          videoDuration === "10s"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          videoDuration === "10s" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="videoDuration"
                        value="10s"
                        checked={videoDuration === "10s"}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          10 seconds
                        </div>
                        <div style={{ fontSize: "12px", color: "#6B7280" }}>
                          Extended duration
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button
                  onClick={() => setShowPromptModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor: "#F3F4F6",
                    color: "#374151",
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
                  onClick={() => {
                    generateVideo(
                      promptModalData.generationId,
                      promptModalData.imageIndex,
                      customPrompt,
                      videoQuality,
                      videoModel,
                      videoDuration
                    );
                    setShowPromptModal(false);
                  }}
                  disabled={generatingVideo === promptModalData.generationId}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    backgroundColor:
                      generatingVideo === promptModalData.generationId
                        ? "#9CA3AF"
                        : "#d42f48",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      generatingVideo === promptModalData.generationId
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {generatingVideo === promptModalData.generationId
                    ? "Generating..."
                    : (() => {
                        let credits = 1;
                        if (videoModel === "seedance") {
                          if (videoQuality === "1080p") credits = 3;
                          else if (videoQuality === "720p") credits = 2;
                          else credits = 1;
                        } else if (videoModel === "kling") {
                          if (videoQuality === "1080p") credits = 4;
                          else if (videoQuality === "720p") credits = 3;
                          else credits = 2;
                        } else {
                          // wan model
                          if (videoQuality === "720p") credits = 2;
                          else credits = 1;
                        }
                        return `Generate Video (${credits} credit${
                          credits > 1 ? "s" : ""
                        })`;
                      })()}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Parameter Selection Modal */}
        {showParameterModal && selectedCampaignForGeneration && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              overflow: "auto",
            }}
            onClick={() => setShowParameterModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "90vw",
                maxHeight: "90vh",
                width: "1000px",
                position: "relative",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "#1F2937",
                }}
              >
                Generate More Images
              </h2>
              <p
                style={{
                  margin: "0 0 32px 0",
                  color: "#6B7280",
                  fontSize: "16px",
                  lineHeight: "1.5",
                }}
              >
                Select products, models, scenes, and poses to generate new
                images for <strong>{selectedCampaignForGeneration.name}</strong>
                .
              </p>

              {/* Products Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Products
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {products.map((product) => (
                    <label
                      key={product.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "2px solid #d42f48"
                          : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "#F3F4F6"
                          : "white",
                        transition: "all 0.2s ease",
                        boxShadow: selectedProductsForGeneration.includes(
                          product.id
                        )
                          ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                          : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsForGeneration.includes(
                          product.id
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductsForGeneration([
                              ...selectedProductsForGeneration,
                              product.id,
                            ]);
                          } else {
                            setSelectedProductsForGeneration(
                              selectedProductsForGeneration.filter(
                                (id) => id !== product.id
                              )
                            );
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={product.image_url}
                        alt={product.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: selectedProductsForGeneration.includes(
                            product.id
                          )
                            ? "#1F2937"
                            : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {product.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Models Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Models
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {models.map((model) => (
                    <label
                      key={model.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border:
                          selectedModelForGeneration === model.id
                            ? "2px solid #d42f48"
                            : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedModelForGeneration === model.id
                            ? "#F3F4F6"
                            : "white",
                        transition: "all 0.2s ease",
                        boxShadow:
                          selectedModelForGeneration === model.id
                            ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                            : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="radio"
                        name="selectedModelForGeneration"
                        checked={selectedModelForGeneration === model.id}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Clear poses for previous model
                            setSelectedPosesForGeneration((prevPoses) => ({
                              ...prevPoses,
                              [selectedModelForGeneration]: [],
                            }));
                            setSelectedModelForGeneration(model.id);
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={model.image_url}
                        alt={model.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color:
                            selectedModelForGeneration === model.id
                              ? "#1F2937"
                              : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {model.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scenes Selection */}
              <div style={{ marginBottom: "32px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "16px",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Scenes
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    overflowX: "auto",
                    paddingBottom: "8px",
                    scrollbarWidth: "thin",
                  }}
                >
                  {scenes.map((scene) => (
                    <label
                      key={scene.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px",
                        border: selectedScenesForGeneration.includes(scene.id)
                          ? "2px solid #d42f48"
                          : "1px solid #E5E7EB",
                        borderRadius: "12px",
                        cursor: "pointer",
                        backgroundColor: selectedScenesForGeneration.includes(
                          scene.id
                        )
                          ? "#F3F4F6"
                          : "white",
                        transition: "all 0.2s ease",
                        boxShadow: selectedScenesForGeneration.includes(
                          scene.id
                        )
                          ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                          : "0 1px 2px rgba(9, 10, 12, 0.05)",
                        minWidth: "120px",
                        maxWidth: "120px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScenesForGeneration.includes(scene.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScenesForGeneration([
                              ...selectedScenesForGeneration,
                              scene.id,
                            ]);
                          } else {
                            setSelectedScenesForGeneration(
                              selectedScenesForGeneration.filter(
                                (id) => id !== scene.id
                              )
                            );
                          }
                        }}
                        style={{
                          margin: 0,
                          width: "16px",
                          height: "16px",
                          accentColor: "#d42f48",
                        }}
                      />
                      <img
                        src={scene.image_url}
                        alt={scene.name}
                        style={{
                          width: "100px",
                          height: "100px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "500",
                          color: selectedScenesForGeneration.includes(scene.id)
                            ? "#1F2937"
                            : "#6B7280",
                          textAlign: "center",
                          wordBreak: "break-word",
                        }}
                      >
                        {scene.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Poses Selection for each selected model */}
              {selectedModelForGeneration && (
                <div style={{ marginBottom: "32px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "16px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#1F2937",
                    }}
                  >
                    Model Poses (Optional)
                  </label>
                  {[selectedModelForGeneration].map((modelId) => {
                    const model = models.find((m) => m.id === modelId);
                    if (!model || !model.poses || model.poses.length === 0)
                      return null;

                    return (
                      <div key={modelId} style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            marginBottom: "8px",
                            fontWeight: "500",
                          }}
                        >
                          {model.name} poses:
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            overflowX: "auto",
                            paddingBottom: "8px",
                            scrollbarWidth: "thin",
                          }}
                        >
                          {(model.poses || []).map((poseUrl, index) => (
                            <label
                              key={index}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px",
                                border: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "2px solid #d42f48"
                                  : "1px solid #E5E7EB",
                                borderRadius: "8px",
                                cursor: "pointer",
                                backgroundColor: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "#F3F4F6"
                                  : "white",
                                transition: "all 0.2s ease",
                                boxShadow: selectedPosesForGeneration[
                                  modelId
                                ]?.includes(poseUrl)
                                  ? "0 2px 4px rgba(139, 92, 246, 0.1)"
                                  : "0 1px 2px rgba(9, 10, 12, 0.05)",
                                minWidth: "80px",
                                maxWidth: "80px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  selectedPosesForGeneration[modelId]?.includes(
                                    poseUrl
                                  ) || false
                                }
                                onChange={(e) => {
                                  const currentPoses =
                                    selectedPosesForGeneration[modelId] || [];
                                  if (e.target.checked) {
                                    // Add pose and automatically select the model
                                    setSelectedPosesForGeneration({
                                      ...selectedPosesForGeneration,
                                      [modelId]: [...currentPoses, poseUrl],
                                    });

                                    setSelectedModelForGeneration(modelId);
                                  } else {
                                    // Remove pose
                                    const newPoses = {
                                      ...selectedPosesForGeneration,
                                      [modelId]: currentPoses.filter(
                                        (url) => url !== poseUrl
                                      ),
                                    };

                                    setSelectedPosesForGeneration(newPoses);

                                    // If no poses left for this model, remove the model from selected models
                                    if (newPoses[modelId].length === 0) {
                                      setSelectedModelForGeneration("");
                                    }
                                  }
                                }}
                                style={{
                                  margin: 0,
                                  width: "12px",
                                  height: "12px",
                                  accentColor: "#d42f48",
                                }}
                              />
                              <img
                                src={poseUrl}
                                alt={`Pose ${index + 1}`}
                                style={{
                                  width: "60px",
                                  height: "60px",
                                  objectFit: "cover",
                                  borderRadius: "6px",
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "500",
                                  color: selectedPosesForGeneration[
                                    modelId
                                  ]?.includes(poseUrl)
                                    ? "#1F2937"
                                    : "#6B7280",
                                  textAlign: "center",
                                }}
                              >
                                Pose {index + 1}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Number of Images Selection */}
              <div style={{ marginTop: "32px" }}>
                <h3
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1F2937",
                  }}
                >
                  Number of Images to Generate
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <label
                      key={num}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 16px",
                        backgroundColor:
                          numberOfImagesToGenerate === num
                            ? "#d42f48"
                            : "#F3F4F6",
                        color:
                          numberOfImagesToGenerate === num
                            ? "#FFFFFF"
                            : "#374151",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#E5E7EB";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (numberOfImagesToGenerate !== num) {
                          e.currentTarget.style.backgroundColor = "#F3F4F6";
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="numberOfImages"
                        value={num}
                        checked={numberOfImagesToGenerate === num}
                        onChange={() => setNumberOfImagesToGenerate(num)}
                        style={{ marginRight: "8px" }}
                      />
                      {num} {num === 1 ? "Image" : "Images"}
                    </label>
                  ))}
                </div>
                <p
                  style={{
                    margin: "8px 0 0 0",
                    fontSize: "12px",
                    color: "#6B7280",
                  }}
                >
                  Generate a professional photoshoot image with the selected
                  model, product, and scene
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
                <button
                  onClick={() => setShowParameterModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    backgroundColor: "#F3F4F6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeImageGeneration}
                  disabled={
                    generatingMore ||
                    selectedProductsForGeneration.length === 0 ||
                    !selectedModelForGeneration ||
                    selectedScenesForGeneration.length === 0
                  }
                  style={{
                    flex: 1,
                    padding: "12px 24px",
                    backgroundColor:
                      generatingMore ||
                      selectedProductsForGeneration.length === 0 ||
                      !selectedModelForGeneration ||
                      selectedScenesForGeneration.length === 0
                        ? "#9CA3AF"
                        : "#d42f48",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor:
                      generatingMore ||
                      selectedProductsForGeneration.length === 0 ||
                      !selectedModelForGeneration ||
                      selectedScenesForGeneration.length === 0
                        ? "not-allowed"
                        : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {generatingMore
                    ? "Generating..."
                    : `Generate Images (${
                        selectedProductsForGeneration.length
                      } × ${selectedModelForGeneration ? 1 : 0} × ${
                        selectedScenesForGeneration.length
                      } = ${
                        selectedProductsForGeneration.length *
                        (selectedModelForGeneration ? 1 : 0) *
                        selectedScenesForGeneration.length
                      } combinations)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Profile Modal */}
        {showCampaignProfileModal && selectedCampaignForProfile && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              overflow: "auto",
            }}
            onClick={() => setShowCampaignProfileModal(false)}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "95vw",
                maxHeight: "95vh",
                width: "1200px",
                position: "relative",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "32px",
                  paddingBottom: "24px",
                  borderBottom: "2px solid #E5E7EB",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: "700",
                    color: "#1F2937",
                  }}
                >
                  {selectedCampaignForProfile.name}
                </h2>
                <button
                  onClick={() => setShowCampaignProfileModal(false)}
                  style={{
                    padding: "12px",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: "#6B7280",
                    fontSize: "24px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#6B7280";
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                  marginBottom: "24px",
                }}
              >
                {/* Campaign Images Gallery */}
                {selectedCampaignForProfile.settings?.generated_images &&
                selectedCampaignForProfile.settings.generated_images.length >
                  0 ? (
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#1F2937",
                        marginBottom: "16px",
                      }}
                    >
                      Campaign Images (
                      {
                        selectedCampaignForProfile.settings.generated_images
                          .length
                      }
                      )
                    </h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: "24px",
                        maxHeight: "70vh",
                        overflowY: "auto",
                        padding: "8px",
                      }}
                    >
                      {selectedCampaignForProfile.settings.generated_images.map(
                        (img: any, index: number) => (
                          <div
                            key={index}
                            style={{
                              aspectRatio: "1",
                              borderRadius: "12px",
                              overflow: "hidden",
                              backgroundColor: "#FFFFFF",
                              border: "2px solid #E5E7EB",
                              position: "relative",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-4px)";
                              e.currentTarget.style.boxShadow =
                                "0 8px 25px rgba(0,0,0,0.15)";
                              e.currentTarget.style.borderColor = "#d42f48";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(0,0,0,0.08)";
                              e.currentTarget.style.borderColor = "#E5E7EB";
                            }}
                          >
                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCampaignImage(
                                  selectedCampaignForProfile.id,
                                  index
                                );
                              }}
                              style={{
                                position: "absolute",
                                top: "12px",
                                right: "12px",
                                zIndex: 10,
                                backgroundColor: "rgba(239, 68, 68, 0.9)",
                                border: "none",
                                borderRadius: "8px",
                                color: "#FFFFFF",
                                padding: "8px 12px",
                                fontSize: "14px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                backdropFilter: "blur(4px)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "rgba(220, 38, 38, 0.95)";
                                e.currentTarget.style.transform = "scale(1.05)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "rgba(239, 68, 68, 0.9)";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                            >
                              🗑️
                            </button>
                            {img.image_url ? (
                              img.video_url ? (
                                // Show video if available
                                <video
                                  src={img.video_url}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    // Open video in enlarged view
                                    handleEnlargeImage(
                                      img.video_url,
                                      `${
                                        selectedCampaignForProfile.name
                                      } - Video ${index + 1}`
                                    );
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.play()}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.pause();
                                    e.currentTarget.currentTime = 0;
                                  }}
                                  muted
                                  loop
                                />
                              ) : (
                                // Show image if no video
                                <img
                                  src={img.image_url}
                                  alt={`${
                                    selectedCampaignForProfile.name
                                  } - Image ${index + 1}`}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                  onClick={() =>
                                    handleEnlargeImage(
                                      img.image_url,
                                      `${
                                        selectedCampaignForProfile.name
                                      } - Image ${index + 1}`,
                                      img
                                    )
                                  }
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              )
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "24px",
                                  backgroundColor: "#F3F4F6",
                                  color: "#9CA3AF",
                                }}
                              >
                                📁
                              </div>
                            )}
                            {/* Video indicator */}
                            {img.video_url && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  right: "8px",
                                  backgroundColor: "rgba(9, 10, 12, 0.7)",
                                  color: "white",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  fontWeight: "500",
                                }}
                              >
                                🎬
                              </div>
                            )}
                            {/* Image number / Shot type label */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "8px",
                                backgroundColor: "rgba(9, 10, 12, 0.8)",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "600",
                              }}
                            >
                              {img.shot_type || `#${index + 1}`}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      aspectRatio: "16/9",
                      borderRadius: "12px",
                      overflow: "hidden",
                      backgroundColor: "#F3F4F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "48px",
                        color: "#9CA3AF",
                      }}
                    >
                      📁
                    </div>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        margin: 0,
                      }}
                    >
                      No images generated yet
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  {/* Generate More Images Button */}
                  <button
                    onClick={() => {
                      setShowCampaignProfileModal(false);
                      // TODO: Open generate more images modal
                      // For now, open the parameter selection modal
                      setSelectedCampaignForGeneration(
                        selectedCampaignForProfile
                      );
                      setShowParameterModal(true);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#d42f48",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#d42f48";
                    }}
                  >
                    ➕ Generate More
                  </button>

                  {/* Generate Videos Button */}
                  <button
                    onClick={() => {
                      setSelectedCampaignForBulkVideo(
                        selectedCampaignForProfile
                      );
                      setShowCampaignProfileModal(false);
                      // Reset video generation state
                      setSelectedImagesForVideo(new Set());
                      setVeoDirectMode(false);
                      setBulkVideoCustomPrompt("");
                      setShowBulkVideoModal(true);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#d42f48",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#d42f48";
                    }}
                  >
                    🎬 Generate Videos
                  </button>

                  {/* Edit Campaign Button */}
                  <button
                    onClick={(e) => {
                      setShowCampaignProfileModal(false);
                      editCampaign(selectedCampaignForProfile, e);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      border: "1px solid #E5E7EB",
                      borderRadius: "6px",
                      color: "#6B7280",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#F9FAFB";
                      e.currentTarget.style.borderColor = "#D1D5DB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.borderColor = "#E5E7EB";
                    }}
                  >
                    ✏️ Edit
                  </button>

                  {/* Delete Campaign Button */}
                  <button
                    onClick={(e) => {
                      setShowCampaignProfileModal(false);
                      deleteCampaign(selectedCampaignForProfile.id, e);
                    }}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "transparent",
                      border: "1px solid #EF4444",
                      borderRadius: "6px",
                      color: "#EF4444",
                      fontSize: "13px",
                      fontWeight: "500",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#FEF2F2";
                      e.currentTarget.style.borderColor = "#DC2626";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.borderColor = "#EF4444";
                    }}
                  >
                    🗑️ Delete
                  </button>
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
                  onClick={() => setShowCampaignProfileModal(false)}
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

        {/* Enlarged Image Modal */}
        {showEnlargedImage && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2000,
            }}
            onClick={() => setShowEnlargedImage(false)}
          >
            <div
              style={{
                position: "relative",
                maxWidth: "90vw",
                maxHeight: "90vh",
                display: "flex",
                gap: "24px",
                alignItems: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowEnlargedImage(false)}
                style={{
                  position: "absolute",
                  top: "-50px",
                  right: "0",
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  color: "white",
                  fontSize: "24px",
                  cursor: "pointer",
                  zIndex: 2001,
                }}
              >
                ✕
              </button>

              {/* Main Image/Video Display */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  maxHeight: "90vh",
                }}
              >
                {enlargedImageUrl.endsWith(".mp4") ||
                enlargedImageUrl.includes("/video_") ? (
                  <video
                    src={enlargedImageUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    style={{
                      maxWidth: "100%",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <img
                    src={enlargedImageUrl}
                    alt={enlargedImageAlt}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "80vh",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                )}
                <p
                  style={{
                    color: "white",
                    marginTop: "16px",
                    fontSize: "16px",
                    textAlign: "center",
                  }}
                >
                  {enlargedImageAlt}
                </p>
              </div>

              {/* Side Menu */}
              <div
                style={{
                  width: "300px",
                  backgroundColor: "rgba(30, 30, 30, 0.95)",
                  borderRadius: "12px",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                }}
              >
                <h3
                  style={{
                    color: "#FFFFFF",
                    fontSize: "18px",
                    fontWeight: "600",
                    margin: 0,
                    marginBottom: "8px",
                  }}
                >
                  Image Actions
                </h3>

                {/* Download Button */}
                <button
                  onClick={() =>
                    downloadImage(
                      enlargedImageUrl,
                      `campaign-${Date.now()}.jpg`
                    )
                  }
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#10B981",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  ⬇️ Download Image
                </button>

                {/* Tweak Button */}
                <button
                  onClick={() => setShowTweakModal(true)}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#b91c1c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#d42f48";
                  }}
                >
                  ✨ Tweak Image
                </button>

                {/* Reapply Clothes Button - Always show, will use campaign product_id if needed */}
                {
                  <button
                    onClick={reapplyClothes}
                    disabled={reapplyingClothes}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: reapplyingClothes
                        ? "#6B7280"
                        : "#F59E0B",
                      border: "none",
                      borderRadius: "8px",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: reapplyingClothes ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                      opacity: reapplyingClothes ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!reapplyingClothes) {
                        e.currentTarget.style.backgroundColor = "#D97706";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!reapplyingClothes) {
                        e.currentTarget.style.backgroundColor = "#F59E0B";
                      }
                    }}
                  >
                    {reapplyingClothes
                      ? "👔 Reapplying..."
                      : "👔 Reapply Clothes"}
                  </button>
                }

                {/* Info Section */}
                <div
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    paddingTop: "16px",
                    marginTop: "8px",
                  }}
                >
                  <p
                    style={{
                      color: "#9CA3AF",
                      fontSize: "12px",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "#FFFFFF" }}>Download:</strong> Save
                    image to your device
                  </p>
                  <p
                    style={{
                      color: "#9CA3AF",
                      fontSize: "12px",
                      margin: "8px 0 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: "#FFFFFF" }}>Tweak:</strong>{" "}
                    AI-powered image editing with custom prompts
                  </p>
                  {currentImageMetadata?.product_id && (
                    <p
                      style={{
                        color: "#9CA3AF",
                        fontSize: "12px",
                        margin: "8px 0 0 0",
                        lineHeight: 1.5,
                      }}
                    >
                      <strong style={{ color: "#FFFFFF" }}>
                        Reapply Clothes:
                      </strong>{" "}
                      Re-run virtual try-on with the same product
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Video Generation Modal */}
        {showBulkVideoModal && selectedCampaignForBulkVideo && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(9, 10, 12, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              overflow: "auto",
            }}
            onClick={() => {
              setShowBulkVideoModal(false);
              setShowVideoModelDropdown(false);
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "20px",
                padding: "min(40px, 5vw)",
                maxWidth: "95vw",
                maxHeight: "90vh",
                width: "min(800px, 95vw)",
                position: "relative",
                overflow: "visible",
                boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
                margin: "20px",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowBulkVideoModal(false);
                  setShowVideoModelDropdown(false);
                }}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  padding: "12px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "24px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F3F4F6";
                  e.currentTarget.style.color = "#374151";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#6B7280";
                }}
              >
                ✕
              </button>
              {/* Scrollable Content Container */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: "8px",
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "32px",
                    paddingBottom: "24px",
                    borderBottom: "2px solid #E5E7EB",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "28px",
                        fontWeight: "700",
                        color: "#1F2937",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      🎬 Generate Videos
                    </h2>
                    <p
                      style={{
                        fontSize: "16px",
                        color: "#6B7280",
                        margin: "8px 0 0 0",
                        lineHeight: 1.5,
                      }}
                    >
                      Transform your campaign images into engaging videos for
                      social media
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#F3F4F6",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      {selectedCampaignForBulkVideo.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        marginTop: "4px",
                      }}
                    >
                      {selectedCampaignForBulkVideo.settings?.generated_images
                        ?.length || 0}{" "}
                      images
                    </div>
                  </div>
                </div>

                {/* Veo Direct Mode Toggle */}
                {bulkVideoModel === "veo" && (
                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        backgroundColor: veoDirectMode ? "#F0F9FF" : "#F9FAFB",
                        border: `2px solid ${
                          veoDirectMode ? "#0EA5E9" : "#E5E7EB"
                        }`,
                        borderRadius: "16px",
                        padding: "20px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "16px",
                          cursor: "pointer",
                          margin: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={veoDirectMode}
                          onChange={(e) => setVeoDirectMode(e.target.checked)}
                          style={{
                            margin: 0,
                            marginTop: "2px",
                            transform: "scale(1.2)",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "16px",
                              color: veoDirectMode ? "#0EA5E9" : "#374151",
                              marginBottom: "8px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            ⭐ Veo Direct Mode
                            <span
                              style={{
                                backgroundColor: "#FEF3C7",
                                color: "#D97706",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
                              EXPERIMENTAL
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#6B7280",
                              lineHeight: 1.5,
                            }}
                          >
                            Generate videos directly from model + product +
                            scene without needing existing images. Perfect for
                            creating original video content from scratch.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Image Selection (only if NOT in Veo Direct Mode) */}
                {!veoDirectMode && (
                  <div style={{ marginBottom: "32px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#1F2937",
                            margin: "0 0 4px 0",
                          }}
                        >
                          Select Images for Video Generation
                        </h3>
                        <p
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            margin: 0,
                          }}
                        >
                          Choose which shots to transform into videos
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => {
                            const allIndices = new Set(
                              Array.from(
                                {
                                  length:
                                    selectedCampaignForBulkVideo.settings
                                      ?.generated_images?.length || 0,
                                },
                                (_, i) => i
                              )
                            );
                            setSelectedImagesForVideo(allIndices);
                          }}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#d42f48",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#b0263c")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#d42f48")
                          }
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedImagesForVideo(new Set())}
                          style={{
                            padding: "8px 16px",
                            backgroundColor: "#F3F4F6",
                            color: "#374151",
                            border: "1px solid #D1D5DB",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#E5E7EB";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#F3F4F6";
                          }}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: "16px",
                        maxHeight: "300px",
                        overflowY: "auto",
                        padding: "20px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "16px",
                        backgroundColor: "#FAFAFA",
                      }}
                    >
                      {selectedCampaignForBulkVideo.settings?.generated_images?.map(
                        (img: any, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedImagesForVideo((prev) => {
                                const newSet = new Set(prev);
                                if (newSet.has(idx)) {
                                  newSet.delete(idx);
                                } else {
                                  newSet.add(idx);
                                }
                                return newSet;
                              });
                            }}
                            style={{
                              position: "relative",
                              cursor: "pointer",
                              border: selectedImagesForVideo.has(idx)
                                ? "3px solid #d42f48"
                                : "2px solid #E5E7EB",
                              borderRadius: "12px",
                              overflow: "hidden",
                              aspectRatio: "1",
                              transition: "all 0.3s ease",
                              backgroundColor: "#FFFFFF",
                              boxShadow: selectedImagesForVideo.has(idx)
                                ? "0 8px 25px rgba(212, 47, 72, 0.3)"
                                : "0 2px 8px rgba(0,0,0,0.1)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-4px)";
                              e.currentTarget.style.boxShadow =
                                selectedImagesForVideo.has(idx)
                                  ? "0 12px 35px rgba(212, 47, 72, 0.4)"
                                  : "0 8px 25px rgba(0,0,0,0.15)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                selectedImagesForVideo.has(idx)
                                  ? "0 8px 25px rgba(212, 47, 72, 0.3)"
                                  : "0 2px 8px rgba(0,0,0,0.1)";
                            }}
                          >
                            <img
                              src={img.image_url}
                              alt={`Image ${idx + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                opacity: selectedImagesForVideo.has(idx)
                                  ? 1
                                  : 0.7,
                                transition: "opacity 0.2s ease",
                              }}
                            />
                            {/* Shot type label */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "8px",
                                right: "8px",
                                backgroundColor: "rgba(9, 10, 12, 0.8)",
                                color: "#FFFFFF",
                                borderRadius: "8px",
                                padding: "6px 8px",
                                fontSize: "11px",
                                fontWeight: "600",
                                textAlign: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              {img.shot_type || `Shot ${idx + 1}`}
                            </div>
                            {selectedImagesForVideo.has(idx) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  right: "8px",
                                  backgroundColor: "#d42f48",
                                  color: "#FFFFFF",
                                  borderRadius: "50%",
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "14px",
                                  fontWeight: "bold",
                                  boxShadow: "0 2px 8px rgba(212, 47, 72, 0.4)",
                                }}
                              >
                                ✓
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: "16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 20px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#1F2937",
                          }}
                        >
                          {selectedImagesForVideo.size} of{" "}
                          {selectedCampaignForBulkVideo.settings
                            ?.generated_images?.length || 0}{" "}
                          images selected
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#6B7280",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          💡 Tip: Select 3-5 shots for TikTok, or all 10 for a
                          complete CapCut sequence
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => {
                            const allIndices = new Set(
                              Array.from(
                                {
                                  length:
                                    selectedCampaignForBulkVideo.settings
                                      ?.generated_images?.length || 0,
                                },
                                (_, i) => i
                              )
                            );
                            setSelectedImagesForVideo(allIndices);
                          }}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#d42f48",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#b0263c")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#d42f48")
                          }
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedImagesForVideo(new Set())}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#EF4444",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#DC2626")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "#EF4444")
                          }
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Custom Prompt */}
                <div style={{ marginBottom: "32px" }}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Custom Prompt (Optional)
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Add specific instructions for video generation
                  </p>
                  <textarea
                    value={bulkVideoCustomPrompt}
                    onChange={(e) => setBulkVideoCustomPrompt(e.target.value)}
                    placeholder={
                      veoDirectMode
                        ? "Describe the video scene... (e.g., 'model walking in a luxury setting, dramatic lighting')"
                        : "e.g., smooth camera movement, professional fashion, cinematic lighting..."
                    }
                    style={{
                      width: "100%",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "2px solid #E5E7EB",
                      fontSize: "14px",
                      resize: "vertical",
                      minHeight: "100px",
                      fontFamily: "inherit",
                      backgroundColor: "#FAFAFA",
                      transition: "border-color 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#d42f48";
                      e.currentTarget.style.backgroundColor = "#FFFFFF";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                      e.currentTarget.style.backgroundColor = "#FAFAFA";
                    }}
                  />
                </div>

                {/* Video Model Selection */}
                <div style={{ marginBottom: "32px" }}>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#1F2937",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Video Model
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#6B7280",
                      margin: "0 0 16px 0",
                    }}
                  >
                    Choose the AI model for video generation
                  </p>

                  {/* Dropdown Button */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() =>
                        setShowVideoModelDropdown(!showVideoModelDropdown)
                      }
                      style={{
                        width: "100%",
                        padding: "16px 20px",
                        border: "2px solid #E5E7EB",
                        borderRadius: "12px",
                        backgroundColor: "#FFFFFF",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s ease",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#d42f48";
                        e.currentTarget.style.backgroundColor = "#FEF2F2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#E5E7EB";
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>
                          {getVideoModelInfo(bulkVideoModel).icon}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "16px",
                              color: "#1F2937",
                              marginBottom: "2px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {getVideoModelInfo(bulkVideoModel).name}
                            <span
                              style={{
                                backgroundColor:
                                  getVideoModelInfo(bulkVideoModel).badgeColor,
                                color:
                                  getVideoModelInfo(bulkVideoModel)
                                    .badgeTextColor,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "500",
                              }}
                            >
                              {getVideoModelInfo(bulkVideoModel).badge}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                            {getVideoModelInfo(bulkVideoModel).pricing}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "16px",
                          color: "#6B7280",
                          transform: showVideoModelDropdown
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        ▼
                      </span>
                    </button>

                    {/* Dropdown Options */}
                    {showVideoModelDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          backgroundColor: "#FFFFFF",
                          border: "2px solid #E5E7EB",
                          borderRadius: "12px",
                          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                          zIndex: 1000,
                          marginTop: "4px",
                          overflow: "hidden",
                        }}
                      >
                        {["wan", "seedance", "veo", "kling"].map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              setBulkVideoModel(model);
                              setShowVideoModelDropdown(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "16px 20px",
                              border: "none",
                              backgroundColor:
                                bulkVideoModel === model
                                  ? "#FEF2F2"
                                  : "transparent",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              transition: "background-color 0.2s ease",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (bulkVideoModel !== model) {
                                e.currentTarget.style.backgroundColor =
                                  "#F9FAFB";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (bulkVideoModel !== model) {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }
                            }}
                          >
                            <span style={{ fontSize: "20px" }}>
                              {getVideoModelInfo(model).icon}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: "600",
                                  fontSize: "16px",
                                  color: "#1F2937",
                                  marginBottom: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {getVideoModelInfo(model).name}
                                <span
                                  style={{
                                    backgroundColor:
                                      getVideoModelInfo(model).badgeColor,
                                    color:
                                      getVideoModelInfo(model).badgeTextColor,
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: "500",
                                  }}
                                >
                                  {getVideoModelInfo(model).badge}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#6B7280",
                                  marginBottom: "4px",
                                }}
                              >
                                {getVideoModelInfo(model).description}
                              </div>
                              <div
                                style={{ fontSize: "12px", color: "#9CA3AF" }}
                              >
                                {getVideoModelInfo(model).pricing}
                              </div>
                            </div>
                            {bulkVideoModel === model && (
                              <span
                                style={{
                                  fontSize: "16px",
                                  color: "#d42f48",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Quality Selection */}
                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "500",
                      marginBottom: "12px",
                      color: "#374151",
                    }}
                  >
                    Video Quality
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                    }}
                  >
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        border:
                          bulkVideoQuality === "480p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          bulkVideoQuality === "480p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="bulkVideoQuality"
                        value="480p"
                        checked={bulkVideoQuality === "480p"}
                        onChange={(e) => setBulkVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          480p
                        </div>
                        <div style={{ fontSize: "11px", color: "#6B7280" }}>
                          {bulkVideoModel === "seedance"
                            ? `${
                                bulkVideoDuration === "10s" ? "3" : "2"
                              } credits`
                            : bulkVideoModel === "kling"
                            ? `${
                                bulkVideoDuration === "10s" ? "3" : "2"
                              } credits`
                            : bulkVideoModel === "veo"
                            ? `${
                                bulkVideoDuration === "10s" ? "4" : "3"
                              } credits`
                            : "1 credit"}
                        </div>
                      </div>
                    </label>
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        border:
                          bulkVideoQuality === "720p"
                            ? "2px solid #d42f48"
                            : "1px solid #D1D5DB",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor:
                          bulkVideoQuality === "720p" ? "#F3F4F6" : "white",
                      }}
                    >
                      <input
                        type="radio"
                        name="bulkVideoQuality"
                        value="720p"
                        checked={bulkVideoQuality === "720p"}
                        onChange={(e) => setBulkVideoQuality(e.target.value)}
                        style={{ margin: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          720p
                        </div>
                        <div style={{ fontSize: "11px", color: "#6B7280" }}>
                          {bulkVideoModel === "kling"
                            ? `${
                                bulkVideoDuration === "10s" ? "4" : "3"
                              } credits`
                            : bulkVideoModel === "veo"
                            ? `${
                                bulkVideoDuration === "10s" ? "6" : "4"
                              } credits`
                            : "2 credits"}
                        </div>
                      </div>
                    </label>
                    {(bulkVideoModel === "seedance" ||
                      bulkVideoModel === "kling" ||
                      bulkVideoModel === "veo") && (
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 14px",
                          border:
                            bulkVideoQuality === "1080p"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoQuality === "1080p" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoQuality"
                          value="1080p"
                          checked={bulkVideoQuality === "1080p"}
                          onChange={(e) => setBulkVideoQuality(e.target.value)}
                          style={{ margin: 0 }}
                        />
                        <div>
                          <div style={{ fontWeight: "500", fontSize: "14px" }}>
                            1080p
                          </div>
                          <div style={{ fontSize: "11px", color: "#6B7280" }}>
                            {bulkVideoModel === "kling"
                              ? `${
                                  bulkVideoDuration === "10s" ? "6" : "4"
                                } credits`
                              : bulkVideoModel === "veo"
                              ? `${
                                  bulkVideoDuration === "10s" ? "8" : "5"
                                } credits`
                              : `${
                                  bulkVideoDuration === "10s" ? "6" : "4"
                                } credits`}
                          </div>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Video Duration Selection (for Seedance, Kling & Veo) */}
                {(bulkVideoModel === "seedance" ||
                  bulkVideoModel === "kling" ||
                  bulkVideoModel === "veo") && (
                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: "500",
                        marginBottom: "12px",
                        color: "#374151",
                      }}
                    >
                      Video Duration
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                      }}
                    >
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 14px",
                          border:
                            bulkVideoDuration === "5s"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoDuration === "5s" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoDuration"
                          value="5s"
                          checked={bulkVideoDuration === "5s"}
                          onChange={(e) => setBulkVideoDuration(e.target.value)}
                          style={{ marginRight: "8px" }}
                        />
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          5 seconds
                        </div>
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 14px",
                          border:
                            bulkVideoDuration === "10s"
                              ? "2px solid #d42f48"
                              : "1px solid #D1D5DB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          backgroundColor:
                            bulkVideoDuration === "10s" ? "#F3F4F6" : "white",
                        }}
                      >
                        <input
                          type="radio"
                          name="bulkVideoDuration"
                          value="10s"
                          checked={bulkVideoDuration === "10s"}
                          onChange={(e) => setBulkVideoDuration(e.target.value)}
                          style={{ marginRight: "8px" }}
                        />
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>
                          10 seconds
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>{" "}
              {/* End of scrollable content container */}
              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "24px",
                  paddingTop: "24px",
                  borderTop: "2px solid #E5E7EB",
                }}
              >
                <button
                  onClick={() => setShowBulkVideoModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: "transparent",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    color: "#6B7280",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Validate based on mode
                    if (!veoDirectMode && selectedImagesForVideo.size === 0) {
                      alert(
                        "Please select at least one image for video generation"
                      );
                      return;
                    }

                    if (!token) {
                      alert("Please log in to generate videos");
                      return;
                    }

                    setGeneratingBulkVideos(true);

                    try {
                      const response = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${selectedCampaignForBulkVideo.id}/generate-videos`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            video_quality: bulkVideoQuality,
                            duration: bulkVideoDuration,
                            model: bulkVideoModel,
                            custom_prompt: bulkVideoCustomPrompt || null,
                            veo_direct_mode: veoDirectMode,
                            selected_image_indices: veoDirectMode
                              ? []
                              : Array.from(selectedImagesForVideo),
                          }),
                        }
                      );

                      if (response.ok) {
                        const result = await response.json();
                        console.log("✅ Bulk video generation result:", result);

                        setGeneratingBulkVideos(false);
                        setShowBulkVideoModal(false);

                        alert(
                          `✅ Video generation completed!\n\n` +
                            `Success: ${result.success_count}\n` +
                            `Failed: ${result.failed_count}\n` +
                            `Credits used: ${result.credits_used}\n` +
                            `Credits remaining: ${result.credits_remaining}`
                        );

                        // Refresh campaign data
                        await fetchData();
                      } else {
                        const error = await response.json();
                        throw new Error(
                          error.detail || "Video generation failed"
                        );
                      }
                    } catch (error) {
                      console.error("Bulk video generation failed:", error);
                      setGeneratingBulkVideos(false);
                      alert(
                        "❌ Video generation failed:\n" +
                          (error instanceof Error
                            ? error.message
                            : String(error))
                      );
                    }
                  }}
                  disabled={generatingBulkVideos}
                  style={{
                    flex: 1,
                    padding: "12px",
                    backgroundColor: generatingBulkVideos
                      ? "#D1D5DB"
                      : "#d42f48",
                    border: "none",
                    borderRadius: "8px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: generatingBulkVideos ? "not-allowed" : "pointer",
                  }}
                >
                  {generatingBulkVideos
                    ? "Generating..."
                    : "🎬 Generate Videos"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tweak Image Modal */}
        {showTweakModal && (
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
                backgroundColor: "rgba(9, 10, 12, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 3000,
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
                {/* Left Panel - Image Display */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#F9FAFB",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {tweaking && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: 10,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          border: "4px solid #F3F4F6",
                          borderTop: "4px solid #d42f48",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          margin: "0 auto 16px",
                        }}
                      />
                      <p
                        style={{
                          color: "#6B7280",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                      >
                        Tweaking image...
                      </p>
                    </div>
                  )}
                  <img
                    src={currentImageForTweak}
                    alt="Image to tweak"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(9, 10, 12, 0.1)",
                      opacity: tweaking ? 0.5 : 1,
                      transition: "opacity 0.3s ease",
                    }}
                  />
                </div>

                {/* Right Panel - Input */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#090a0c",
                    display: "flex",
                    flexDirection: "column",
                    padding: "32px",
                    position: "relative",
                  }}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowTweakModal(false);
                      setTweakPrompt("");
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
                      margin: "0 0 8px 0",
                    }}
                  >
                    ✨ Tweak Image
                  </h2>
                  <p
                    style={{
                      color: "#9CA3AF",
                      fontSize: "14px",
                      marginBottom: "24px",
                    }}
                  >
                    Describe the changes you want to make. AI will apply your
                    modifications while preserving the overall composition.
                  </p>

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
                      Tweak Prompt
                    </label>
                    <textarea
                      value={tweakPrompt}
                      onChange={(e) => setTweakPrompt(e.target.value)}
                      placeholder="Type your changes... (e.g., 'make the background darker, add more contrast, warmer tones')"
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

                  {/* Example Prompts */}
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
                      Quick Examples
                    </h3>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                    >
                      {[
                        "make it more dramatic",
                        "darker background",
                        "brighter lighting",
                        "add more contrast",
                        "warmer tones",
                        "cooler tones",
                        "vintage look",
                        "cinematic mood",
                      ].map((example) => (
                        <button
                          key={example}
                          onClick={() => setTweakPrompt(example)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#454545",
                            border: "1px solid #4B5563",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#D1D5DB",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#4B5563";
                            e.currentTarget.style.color = "#FFFFFF";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#374151";
                            e.currentTarget.style.color = "#D1D5DB";
                          }}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "auto",
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowTweakModal(false);
                        setTweakPrompt("");
                      }}
                      style={{
                        flex: 1,
                        padding: "14px 24px",
                        backgroundColor: "#374151",
                        border: "1px solid #4B5563",
                        borderRadius: "8px",
                        color: "#D1D5DB",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4B5563";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#374151";
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={tweakImage}
                      disabled={tweaking || !tweakPrompt.trim()}
                      style={{
                        flex: 2,
                        padding: "14px 24px",
                        backgroundColor:
                          tweaking || !tweakPrompt.trim()
                            ? "#4B5563"
                            : "#d42f48",
                        border: "none",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor:
                          tweaking || !tweakPrompt.trim()
                            ? "not-allowed"
                            : "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!tweaking && tweakPrompt.trim()) {
                          e.currentTarget.style.backgroundColor = "#b91c1c";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!tweaking && tweakPrompt.trim()) {
                          e.currentTarget.style.backgroundColor = "#d42f48";
                        }
                      }}
                    >
                      {tweaking ? "✨ Tweaking..." : "✨ Apply Tweak"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
