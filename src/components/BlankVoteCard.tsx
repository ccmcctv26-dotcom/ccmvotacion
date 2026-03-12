import { motion } from "framer-motion";
import { Check, Ban } from "lucide-react";

type BlankVoteCardProps = {
  isSelected: boolean;
  onSelect: () => void;
};

const BlankVoteCard = ({ isSelected, onSelect }: BlankVoteCardProps) => {
  return (
    <motion.button
      onClick={onSelect}
      className={`relative w-full p-10 rounded-2xl border-3 transition-all duration-200 flex flex-col items-center gap-5 text-center ${
        isSelected
          ? "border-muted-foreground bg-muted shadow-elevated"
          : "border-dashed border-border bg-muted/50 shadow-card hover:shadow-soft hover:border-muted-foreground"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-muted-foreground flex items-center justify-center"
        >
          <Check className="w-6 h-6 text-destructive-foreground" />
        </motion.div>
      )}

      {/* Icon */}
      <div className={`w-28 h-28 rounded-full flex items-center justify-center border-4 transition-colors ${
        isSelected ? "border-destructive bg-destructive/20" : "border-border bg-muted"
      }`}>
        <Ban className={`w-14 h-14 ${isSelected ? "text-destructive" : "text-muted-foreground"}`} />
      </div>

      {/* Label */}
      <h3 className={`font-bold text-xl ${
        isSelected ? "text-destructive" : "text-card-foreground"
      }`}>
        VOTO EN BLANCO
      </h3>
      <p className={`text-base ${isSelected ? "text-destructive/80" : "text-muted-foreground"}`}>
        No votar por ningún candidato
      </p>
    </motion.button>
  );
};

export default BlankVoteCard;
