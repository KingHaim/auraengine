"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadStep() {
  const [mode, setMode] = useState<"packshot" | "backshot">("packshot");
  const [product, setProduct] = useState<File | null>(null);
  const [scene, setScene] = useState<File | null>(null);
  const [mods, setMods] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    if (!product) return alert("Upload a product image");

    setIsGenerating(true);

    try {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("user_mods", mods);
      fd.append("angle", "front");
      fd.append("background", "white");
      fd.append("reflection", "false");
      fd.append("shadow_strength", "0.35");
      fd.append("variants", "4");
      fd.append("product", product);
      if (mode === "backshot" && scene) fd.append("scene_or_model", scene);

      const res = await fetch(
        process.env.NEXT_PUBLIC_API_BASE_URL + "/jobs/generate",
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) {
        throw new Error("Generation failed");
      }

      const json = await res.json();
      console.log(json.urls);

      // Redirect to preview with results
      router.push(
        `/preview?urls=${encodeURIComponent(JSON.stringify(json.urls))}`
      );
    } catch (error) {
      console.error("Generation error:", error);
      alert("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Mode Selection */}
      <div className="flex gap-3">
        <button
          onClick={() => setMode("packshot")}
          className={`px-4 py-3 rounded-xl font-medium transition-colors ${
            mode === "packshot"
              ? "bg-purple-600 text-white"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          📦 Packshot
        </button>
        <button
          onClick={() => setMode("backshot")}
          className={`px-4 py-3 rounded-xl font-medium transition-colors ${
            mode === "backshot"
              ? "bg-purple-600 text-white"
              : "bg-white/5 text-gray-300 hover:bg-white/10"
          }`}
        >
          👕 Backshot
        </button>
      </div>

      {/* Product Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Product image (photo or PNG)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProduct(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/5 file:text-gray-300 hover:file:bg-white/10"
        />
        {product && (
          <p className="text-sm text-gray-400">Selected: {product.name}</p>
        )}
      </div>

      {/* Scene Upload (Backshot only) */}
      {mode === "backshot" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Scene or model reference
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setScene(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/5 file:text-gray-300 hover:file:bg-white/10"
          />
          {scene && (
            <p className="text-sm text-gray-400">Selected: {scene.name}</p>
          )}
        </div>
      )}

      {/* Modifications */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Modifications (optional)
        </label>
        <textarea
          placeholder="Example: Add sunlight from the right, change shirt to navy blue…"
          value={mods}
          onChange={(e) => setMods(e.target.value)}
          className="w-full h-32 bg-ui-panel border border-ui-border rounded-xl p-4 text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!product || isGenerating}
        className="w-full px-6 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? "Generating..." : "Generate Mockups"}
      </button>
    </div>
  );
}

