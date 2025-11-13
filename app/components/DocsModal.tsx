"use client";

import { Modal } from "./Modal";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <h2 className="text-2xl font-bold mb-6">How CARV Prediction Market Works</h2>
            
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-indigo-600">Overview</h3>
          <p className="text-gray-700 dark:text-gray-300">
            CARV Prediction Market is a unique platform where users can purchase sports predictions and participate in daily raffles.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-indigo-600">How It Works</h3>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
            <li>Purchase predictions for upcoming sports matches during open windows</li>
            <li>Each purchase automatically enters you into the daily raffle</li>
            <li><span className="font-semibold">80%</span> of all prediction purchases goes to the raffle pool</li>
            <li>One lucky buyer is selected as the winner each day at 08:00 UTC</li>
            <li>Winners receive the entire raffle pool for that day</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-indigo-600">Predictions & Betting</h3>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
            <li>After purchase, access your prediction details instantly</li>
            <li>Use predictions to inform your betting decisions</li>
            <li>Place bets on your preferred betting platforms</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-indigo-600">Treasury</h3>
          <p className="text-gray-700 dark:text-gray-300">
            20% of purchases are allocated to the treasury, supporting:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
            <li>Marketing initiatives</li>
            <li>Platform development</li>
            <li>Community rewards</li>
            <li>Operational expenses</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button 
          onClick={onClose} 
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};