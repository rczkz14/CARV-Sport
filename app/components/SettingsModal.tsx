"use client";

import { Modal } from "./Modal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  onToggleDarkMode,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <h3 className="text-xl font-semibold mb-4">Settings</h3>
            
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-700 dark:text-gray-300">Theme</span>
          <button 
            onClick={onToggleDarkMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {darkMode ? (
              <>
                <span>☀️</span>
                <span className="text-gray-700 dark:text-gray-300">Light Mode</span>
              </>
            ) : (
              <>
                <span>🌙</span>
                <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button 
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};