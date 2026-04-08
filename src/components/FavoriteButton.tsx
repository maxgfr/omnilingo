import { Heart } from "lucide-react";
import * as bridge from "../lib/bridge";

interface Props {
  wordId: number;
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}

export default function FavoriteButton({ wordId, isFavorite, onToggle, className = "" }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    bridge.toggleFavorite(wordId).catch(console.error);
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-lg transition-all ${
        isFavorite
          ? "text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20"
          : "text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
      } ${className}`}
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
