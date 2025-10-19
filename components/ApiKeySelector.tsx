import React, { useState } from 'react';
import { KeyIcon } from './Icons';

interface ApiKeySelectorProps {
  onKeySelected?: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [status, setStatus] = useState('Waiting for API key...');
  // const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY;
  // const apiKey = process.env.API_KEY
  const apiKey = process.env.NEXT_PUBLIC_API_KEY

  const callGemini = async (prompt: string) => {
    if (!apiKey) {
      setStatus('API key is missing. Please set it in your .env file.');
      return;
    }

    try {
      setStatus('Calling Gemini API...');
      const response = await fetch('https://api.gemini.google.com/v1/your-endpoint', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setStatus('API call successful!');
      console.log('Gemini response:', data);

      if (onKeySelected) onKeySelected();
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setStatus('Error calling Gemini API. Check console.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700 text-center">
        <div className="inline-block bg-yellow-500/10 p-3 rounded-full mb-4">
          <KeyIcon className="h-8 w-8 text-yellow-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">API Key Status</h1>
        <p className="text-gray-400 mb-6">{status}</p>
        <button
          onClick={() => callGemini('Hello Gemini!')}
          className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
        >
          Test API Key
        </button>
        <p className="text-xs text-gray-500 mt-4">
          Make sure your <code>.env</code> file contains <code>API_KEY=your_key_here</code>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeySelector;
