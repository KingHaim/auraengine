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
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [showBulkVideoModal, setShowBulkVideoModal] = useState(false);
  const [selectedCampaignForBulkVideo, setSelectedCampaignForBulkVideo] = useState<any>(null);
  const [showCampaignProfileModal, setShowCampaignProfileModal] = useState(false);
  const [selectedCampaignForProfile, setSelectedCampaignForProfile] = useState<any>(null);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim() || !token) return;

    setCreatingCampaign(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newCampaignName.trim(),
        }),
      });

      if (response.ok) {
        const newCampaign = await response.json();
        setCampaigns([newCampaign, ...campaigns]);
        setNewCampaignName("");
        setShowCreateModal(false);
      } else {
        throw new Error("Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign. Please try again.");
    } finally {
      setCreatingCampaign(false);
    }
  };

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

  // Close video model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showVideoModelDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-dropdown="video-model"]')) {
          setShowVideoModelDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVideoModelDropdown]);

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
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#1F2937",
                margin: 0,
              }}
            >
              Campaigns
            </h1>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#d42f48",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#b0263c";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#d42f48";
              }}
            >
              + Create Campaign
            </button>
          </div>

          {/* Campaign Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "24px",
            }}
          >
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  border: "1px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
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
                    {campaign.name}
                  </h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setSelectedCampaignForBulkVideo(campaign);
                        setShowBulkVideoModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#d42f48",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#b0263c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#d42f48";
                      }}
                    >
                      🎬 Videos
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCampaignForProfile(campaign);
                        setShowCampaignProfileModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#6B7280",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4B5563";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#6B7280";
                      }}
                    >
                      👁️ View
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#6B7280",
                    marginBottom: "16px",
                  }}
                >
                  {campaign.settings?.generated_images?.length || 0} images
                  {campaign.settings?.generated_images?.length > 0 && (
                    <span style={{ marginLeft: "8px", color: "#10B981" }}>
                      ✓ Generated
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "#9CA3AF",
                  }}
                >
                  Created: {new Date(campaign.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
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
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color: "#1F2937",
                margin: "0 0 24px 0",
              }}
            >
              Create New Campaign
            </h2>
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
                Campaign Name
              </label>
              <input
                type="text"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="Enter campaign name..."
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "16px",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "transparent",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  color: "#6B7280",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={!newCampaignName.trim() || creatingCampaign}
                style={{
                  padding: "12px 24px",
                  backgroundColor: newCampaignName.trim() && !creatingCampaign ? "#d42f48" : "#D1D5DB",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "16px",
                  cursor: newCampaignName.trim() && !creatingCampaign ? "pointer" : "not-allowed",
                }}
              >
                {creatingCampaign ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
