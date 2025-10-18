
import React from 'react';
import { KeyIcon } from './Icons';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const handleSelectKey = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Assume success and optimistically update UI
        onKeySelected();
      } else {
        alert("API key selection utility is not available.");
      }
    } catch (e) {
      console.error("Error opening API key selection:", e);
      alert("Could not open the API key selector. Please check the console for errors.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700 text-center">
        <div className="inline-block bg-yellow-500/10 p-3 rounded-full mb-4">
          <KeyIcon className="h-8 w-8 text-yellow-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">API Key Required</h1>
        <p className="text-gray-400 mb-6">
          This application uses Google's Veo model for video generation, which requires you to select an API key associated with a project that has billing enabled.
        </p>
        <button
          onClick={handleSelectKey}
          className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
        >
          Select Your API Key
        </button>
        <p className="text-xs text-gray-500 mt-4">
          For more information on billing, please visit the{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            official documentation
          </a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeySelector;
