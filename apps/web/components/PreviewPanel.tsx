"use client";
import { ArrowLeft, Download, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

interface PreviewPanelProps {
  results: string[];
}

export default function PreviewPanel({ results }: PreviewPanelProps) {
  const router = useRouter();

  const handleDownload = (index: number) => {
    const link = document.createElement("a");
    link.href = results[index];
    link.download = `variant-${index + 1}.jpg`;
    link.click();
  };

  const handleDownloadAll = () => {
    results.forEach((url, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = url;
        link.download = `variant-${index + 1}.jpg`;
        link.click();
      }, index * 100);
    });
  };

  return (
    <div className="flex h-screen flex-col bg-black text-gray-200">
      <header className="flex items-center justify-between p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white opacity-70 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={28} />
          <span>Back</span>
        </button>
        <h1 className="text-xl font-semibold">Generated Variants</h1>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-2 text-white opacity-70 hover:opacity-100 transition-opacity"
        >
          <Download size={28} />
          <span>Download All</span>
        </button>
      </header>
      <main className="flex-1 grid grid-cols-2 gap-6 p-8 overflow-y-auto">
        {results.map((img, i) => (
          <div key={i} className="relative group">
            <img
              src={img}
              alt={`Variant ${i + 1}`}
              className="w-full rounded-xl border border-neutral-800"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <button
                onClick={() => console.log("reroll", i)}
                className="bg-neutral-800/70 hover:bg-purple-700 px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                <RefreshCcw size={20} /> Re-roll
              </button>
              <button
                onClick={() => handleDownload(i)}
                className="bg-neutral-800/70 hover:bg-purple-700 px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"
              >
                <Download size={20} /> Download
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

