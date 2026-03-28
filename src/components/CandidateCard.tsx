import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { User } from "lucide-react";

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
};

type CandidateCardProps = {
  candidate: Candidate;
  isSelected: boolean;
  onSelect: () => void;
};

const CandidateCard = ({ candidate, isSelected, onSelect }: CandidateCardProps) => {
  return (
    <motion.button
      onClick={onSelect}
      className={`relative w-full rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-5 text-center overflow-hidden ${
        isSelected
          ? "border-primary bg-accent shadow-elevated"
          : "border-border bg-card shadow-card hover:shadow-soft hover:border-primary/30"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Prev code: */}
      {/* <motion.button
        onClick={onSelect}
        className={`relative w-full p-10 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-5 text-center ${
          isSelected
            ? "border-primary bg-accent shadow-elevated"
            : "border-border bg-card shadow-card hover:shadow-soft hover:border-primary/30"
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
    > */}
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="w-6 h-6 text-primary-foreground" />
        </motion.div>
      )}

      {/* Photo */}
      {/* Prev code: */}
      {/* <div className={`w-36 h-36 rounded-full overflow-hidden border-4 transition-colors ${
        isSelected ? "border-primary" : "border-border"
      }`}> */}
      <div className={`w-full aspect-square overflow-hidden transition-colors ${
        isSelected ? "border-primary" : "border-border"
      }`}>
        {candidate.photo_url ? (
          <img
            src={candidate.photo_url}
            alt={candidate.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User className="w-14 h-14 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name */}
      <h3 style={{fontFamily: "sans-serif"}} className={`font-display font-bold text-xl md:text-lg px-2 pb-4 leading-tight ${
        isSelected ? "text-accent-foreground" : "text-card-foreground"
      }`}>
        {candidate.full_name}
      </h3>
    </motion.button>
  );
};

export default CandidateCard;
