"use client";

import { Modal } from "./Modal";

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictionText: string | null;
}

export const PredictionModal: React.FC<PredictionModalProps> = ({
  isOpen,
  onClose,
  predictionText,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <h3 className="text-lg font-semibold mb-3">Your Prediction</h3>
      <div className="mb-4 whitespace-pre-wrap">{predictionText}</div>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
      </div>
    </Modal>
  );
};