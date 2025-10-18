"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface EditorLayoutProps {
  imageUrl: string;
}

export default function EditorLayout({ imageUrl }: EditorLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex h-screen w-full bg-black text-gray-300">
      <div className="relative w-1/2 flex items-center justify-center bg-neutral-900">
        <img src={imageUrl} alt="mockup" className="max-h-[90%] rounded-xl" />
        <button
          onClick={() => router.back()}
          className="absolute left-6 top-1/2 -translate-y-1/2 text-white opacity-80 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft size={48} />
        </button>
        <button
          onClick={() => console.log("next")}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white opacity-80 hover:opacity-100 transition-opacity"
        >
          <ArrowRight size={48} />
        </button>
      </div>
      <div className="flex w-1/2 flex-col items-center justify-center p-10">
        <h2 className="text-3xl font-semibold mb-6 text-gray-300">
          Type your modifications…
        </h2>
        <textarea
          className="w-full h-72 bg-neutral-800 rounded-xl p-5 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-300 placeholder:text-gray-500"
          placeholder="Example: Add sunlight from the right, change shirt to navy blue…"
        />
        <button className="mt-6 px-8 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors">
          Apply Changes
        </button>
      </div>
    </div>
  );
}

