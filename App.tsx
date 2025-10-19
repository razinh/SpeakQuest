import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import ApiKeySelector from './components/ApiKeySelector';
import Loader from './components/Loader';
import { FaceIcon, SparklesIcon, AlertTriangleIcon, UploadIcon } from './components/Icons';

const LOADING_MESSAGES = [
  "Warming up the digital vocal cords...",
  "Crafting pixels into a personality...",
  "Synchronizing lips with your script...",
  "This can take a few minutes, the AI is hard at work...",
  "Rendering lifelike textures and lighting...",
  "Finalizing video generation...",
  "Sending video to ElevenLabs for transcription...",
  "Analyzing audio and generating timestamps...",
  "Almost there, putting it all together...",
];

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface ImageData {
    url: string;
    base64: string;
    mimeType: string;
}

// TODO: Add your ElevenLabs API key here.
const ELEVENLABS_API_KEY = 'sk_4e98eb97ab73ecb477c48ac0e57f298aa99fd722fa36449d';

const App: React.FC = () => {
  const [isKeySelected, setIsKeySelected] = useState(false);
  const [inputText, setInputText] = useState<string>('');
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<WordTimestamp[] | null>(null);
  const messageIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const checkApiKey = useCallback(async () => {
    try {
      // If we have an API key in the environment, use that
      if (process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY) {
        setIsKeySelected(true);
        return;
      }
      
      // Otherwise check for AI Studio integration
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setIsKeySelected(true);
      } else {
        setIsKeySelected(false);
      }
    } catch (e) {
      console.error("Error checking for API key:", e);
      setIsKeySelected(false);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  useEffect(() => {
    if (isLoading) {
      messageIntervalRef.current = window.setInterval(() => {
        setLoadingMessage(prev => {
          const currentIndex = LOADING_MESSAGES.indexOf(prev);
          const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
          return LOADING_MESSAGES[nextIndex];
        });
      }, 4000);
    } else if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }

    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
    };
  }, [isLoading]);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setVideoUrl(null);
    setTranscription(null);

    const reader = new FileReader();
    reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64String = dataUrl.split(',')[1];
        if (base64String) {
            setImageData({
                url: dataUrl,
                base64: base64String,
                mimeType: file.type,
            });
        } else {
            setError("Could not read the selected image file. Please try another one.");
        }
    };
    reader.onerror = () => {
        setError("Error reading the image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!inputText.trim() || !imageData || isLoading) return;

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    setTranscription(null);
    setLoadingMessage(LOADING_MESSAGES[0]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_API_KEY });
      const prompt = `Animate the provided image of a person's face to realistically speak the following line: "${inputText.trim()}". Ensure natural lip, mouth, and jaw movements that precisely match the dialogue audio. Do not have whole head movemements, bobbing, nodding, or shaking. The expression should be polite and casual, and the background should remain consistent with the original image. The animation should be smooth and lifelike. The video must end immediately after the character is done speaking.`;
      
      const imagePayload = {
        imageBytes: imageData.base64,
        mimeType: imageData.mimeType,
      };

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: imagePayload,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video generation failed to provide a download link.");

      const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      
      const videoBlob = await videoResponse.blob();

      setLoadingMessage("Transcribing video with ElevenLabs...");
      const formData = new FormData();
      formData.append('file', videoBlob, 'video.mp4');
      formData.append('model_id', 'scribe_v1');

      const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        body: formData,
      });

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        console.error("ElevenLabs API Error:", errorText);
        throw new Error(`ElevenLabs API Error: ${elevenLabsResponse.statusText}. Check console for details.`);
      }
      
      const transcriptionData = await elevenLabsResponse.json();
      if (!transcriptionData.words || transcriptionData.words.length === 0) {
        throw new Error("Transcription failed or returned no words.");
      }
      setTranscription(transcriptionData.words);

      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);

    } catch (err: any) {
      console.error(err);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (err.message) {
        if (err.message.includes("Requested entity was not found")) {
            errorMessage = "API Key not found or invalid. Please re-select your API key.";
            setIsKeySelected(false);
        } else {
            errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeySelected = () => {
    setIsKeySelected(true);
  }

  if (!isKeySelected) {
    return <ApiKeySelector onKeySelected={handleKeySelected} />;
  }

  const ClickableText = ({ transcription, videoRef }: { transcription: WordTimestamp[], videoRef: React.RefObject<HTMLVideoElement> }) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const handleWordClick = (wordData: WordTimestamp, index: number) => {
        if (videoRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            const video = videoRef.current;
            video.currentTime = wordData.start;
            video.play();
            setActiveIndex(index);

            const duration = (wordData.end - wordData.start) * 1000;
            timeoutRef.current = window.setTimeout(() => {
                video.pause();
                setActiveIndex(null);
            }, duration);
        }
    };
    
    useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    }, []);

    return (
        <div className="bg-gray-800 p-4 border-x border-b border-gray-700 rounded-b-lg">
            <p className="text-center text-gray-300 leading-relaxed">
                {transcription.map((wordData, index) => (
                    <span 
                        key={index} 
                        className={`cursor-pointer transition-all duration-300 px-1 py-0.5 rounded-md ${activeIndex === index ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}
                        onClick={() => handleWordClick(wordData, index)}
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e) => e.key === 'Enter' && handleWordClick(wordData, index)}
                        aria-label={`Play word: ${wordData.word}`}
                    >
                        {wordData.word}{' '}
                    </span>
                ))}
            </p>
        </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-2xl bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <div className="inline-block bg-indigo-500/10 p-3 rounded-full mb-4">
            <FaceIcon className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            Text to Talking Face
          </h1>
          <p className="text-gray-400 mt-2">Bring your words to life with an AI-generated animated face.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label 
                htmlFor="image-upload" 
                className="w-full flex items-center justify-center gap-2 bg-gray-700/50 text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-gray-700 cursor-pointer transition-all duration-300 border border-dashed border-gray-600 hover:border-indigo-500"
            >
                <UploadIcon className="h-5 w-5" />
                {imageData ? 'Change Image' : 'Upload Face Image'}
            </label>
            <input 
                id="image-upload" 
                type="file" 
                className="hidden"
                onChange={handleImageUpload}
                accept="image/png, image/jpeg"
                disabled={isLoading}
            />
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter the text you want the face to say..."
            className="w-full h-28 p-4 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 resize-none placeholder-gray-500"
            disabled={isLoading}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !inputText.trim() || !imageData || !ELEVENLABS_API_KEY}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
            title={!ELEVENLABS_API_KEY ? "ElevenLabs API Key is missing in the code." : (!imageData ? "Please upload an image first." : "")}
          >
            <SparklesIcon className="h-5 w-5" />
            {isLoading ? 'Generating...' : 'Generate Video & Transcript'}
          </button>
        </div>

        <div className="mt-8">
          <div className={`min-h-[320px] bg-gray-900/50 flex items-center justify-center p-4 border border-gray-700 ${transcription && videoUrl ? 'rounded-t-lg border-b-0' : 'rounded-lg'}`}>
            {isLoading ? (
              <Loader message={loadingMessage} />
            ) : error ? (
              <div className="text-center text-red-400 flex flex-col items-center gap-2">
                <AlertTriangleIcon className="h-8 w-8" />
                <p className="font-semibold">Error</p>
                <p className="text-sm text-gray-400 max-w-sm">{error}</p>
              </div>
            ) : videoUrl ? (
              <video ref={videoRef} controls autoPlay loop src={videoUrl} className="w-full max-w-sm rounded-lg shadow-lg" />
            ) : imageData ? (
                <div className="text-center">
                    <img src={imageData.url} alt="Uploaded preview" className="max-w-xs max-h-80 rounded-lg shadow-lg mx-auto" />
                    <p className="text-sm mt-4 text-gray-400">Image ready. Enter text and generate.</p>
                </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>Upload an image and enter text to begin.</p>
                <p className="text-sm mt-1">Your generated video will appear here.</p>
              </div>
            )}
          </div>
          {transcription && videoUrl && !isLoading && !error && (
            <ClickableText transcription={transcription} videoRef={videoRef} />
          )}
        </div>
      </div>
      <footer className="text-center mt-8 text-gray-600 text-sm">
        <p>Powered by Google Gemini & ElevenLabs. Video generation may take several minutes.</p>
      </footer>
    </div>
  );
};

export default App;
