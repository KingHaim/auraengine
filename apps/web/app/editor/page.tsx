import EditorLayout from "@/components/EditorLayout";

export default function EditorPage() {
  // In a real app, this would get the image URL from params or state
  const imageUrl = "https://picsum.photos/800/600?random=1";

  return <EditorLayout imageUrl={imageUrl} />;
}
