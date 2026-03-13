import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BlankVoteModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  area: string;
};

const BlankVoteModal = ({ open, onClose, onConfirm, area }: BlankVoteModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">
            Voto en Blanco
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            ¿Está seguro que desea emitir un voto en blanco para{" "}
            <span className="font-semibold text-foreground">{area}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="gradient-primary text-primary-foreground"
          >
            Confirmar Voto en Blanco
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default BlankVoteModal;
