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

const ELEVENLABS_API_KEY = 'e5bf2487d77506133f1d6a856687942f73efb5e89a6cd9c1fcadf9e6faa52bda';
const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';
const SHOULD_TRANSCRIBE = true; // Global preference; actual run will also check for audio

const FALLBACK_VIDEO_MODEL = 'veo-3.1-generate-preview';
const modelHasAudio = (model: string): boolean => model.startsWith('veo-3');

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
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    setTranscription(null);
    setLoadingMessage(LOADING_MESSAGES[0]);

    try {
      // Gemini API call for video generation
      setLoadingMessage('Calling Gemini API...');
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Animate the provided image of a person's face to realistically speak the following line: "${inputText.trim()}". Ensure natural lip, mouth, and jaw movements that precisely match the dialogue audio. Do not have whole head movements, bobbing, nodding, or shaking. The expression should be polite and casual, and the background should remain consistent with the original image. The animation should be smooth and lifelike. The video must end immediately after the character is done speaking.`;

      const imagePayload = {
        imageBytes: imageData?.base64,
        mimeType: imageData?.mimeType,
      };

      let usedModel = VIDEO_MODEL;
      let operation;
      try {
        operation = await ai.models.generateVideos({
          model: usedModel,
          prompt: prompt,
          image: imagePayload,
          config: {
            numberOfVideos: 1,
            aspectRatio: '9:16'
          }
        });
      } catch (initialErr: any) {
        const msg = String(initialErr?.message || '');
        const isInvalidArg = msg.includes('INVALID_ARGUMENT') || msg.includes('not supported');
        if (isInvalidArg) {
          // Fallback to VEO-2 if VEO-3 is not supported for this use case
          usedModel = FALLBACK_VIDEO_MODEL;
          operation = await ai.models.generateVideos({
            model: usedModel,
            prompt: prompt,
            image: imagePayload,
            config: {
              numberOfVideos: 1,
              aspectRatio: '9:16'
            }
          });
        } else {
          throw initialErr;
        }
      }
        /*
        // Fallback logic (commented out by request)
        try {
          operation = await ai.models.generateVideos({
            model: usedModel,
            prompt: prompt,
            image: imagePayload,
            config: {
              numberOfVideos: 1,
              aspectRatio: '9:16'
            }
          });
        } catch (initialErr: any) {
          const msg = String(initialErr?.message || '');
          const isInvalidArg = msg.includes('INVALID_ARGUMENT') || msg.includes('not supported');
          if (isInvalidArg) {
            // Fallback to VEO-2 if VEO-3 is not supported for this use case
            usedModel = FALLBACK_VIDEO_MODEL;
            operation = await ai.models.generateVideos({
              model: usedModel,
              prompt: prompt,
              image: imagePayload,
              config: {
                numberOfVideos: 1,
                aspectRatio: '9:16'
              }
            });
          } else {
            throw initialErr;
          }
        }
        */

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      // Debug: log the full Gemini API response
      console.log('Gemini API operation.response:', operation.response);
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) throw new Error("Video generation failed to provide a download link. See console for Gemini API response.");

      // Download the generated video
      const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
      if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      
      // Get raw video data and create blob
      const videoData = await videoResponse.arrayBuffer();
      console.log('Received video data size:', videoData.byteLength);

      // Create blob with proper MP4 content type
      const videoBlob = new Blob([videoData], { type: 'video/mp4' });
      
      // Create URL for video preview
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);

      // Validate video metadata before proceeding
      await new Promise((resolve, reject) => {
        const tempVideo = document.createElement('video');
        tempVideo.src = url;
        
        tempVideo.onloadedmetadata = () => {
          console.log('Video metadata:', {
            duration: tempVideo.duration,
            videoWidth: tempVideo.videoWidth,
            videoHeight: tempVideo.videoHeight
          });
          
          if (tempVideo.duration < 0.5) {
            reject(new Error('Generated video is too short'));
            return;
          }
          resolve(true);
        };
        
        tempVideo.onerror = () => reject(new Error('Failed to validate video metadata'));
      });

      const hasAudio = modelHasAudio(usedModel);
      if (SHOULD_TRANSCRIBE && hasAudio && ELEVENLABS_API_KEY) {
        setLoadingMessage('Transcribing video with ElevenLabs...');

        // Prepare form data for ElevenLabs API
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
          console.error('ElevenLabs API Error:', errorText);
          throw new Error(`ElevenLabs API Error: ${elevenLabsResponse.statusText}. Check console for details.`);
        }

        const transcriptionData = await elevenLabsResponse.json();
        console.log('ElevenLabs transcriptionData:', transcriptionData); // Debug API response

      // Robust parsing of ElevenLabs transcription response to extract per-word timestamps
      const parseElevenLabs = (data: any): WordTimestamp[] => {
        // 1) data.words -> [{word, start, end}]
        if (Array.isArray(data.words) && data.words.length > 0) {
          return data.words.map((w: any) => ({ word: String(w.word || w.text || w.content || ''), start: Number(w.start || w.start_time || 0), end: Number(w.end || w.end_time || 0) }));
        }

        // 2) Common structure: data.results[0].alternatives[0].words
        if (data.results && Array.isArray(data.results) && data.results[0]?.alternatives?.[0]?.words) {
          return data.results[0].alternatives[0].words.map((w: any) => ({ word: String(w.word || w.text || w.content || ''), start: Number(w.start || w.start_time || 0), end: Number(w.end || w.end_time || 0) }));
        }

        // 3) segments -> array of {words: [{text, start, end}]}
        if (Array.isArray(data.segments) && data.segments.length > 0) {
          const out: WordTimestamp[] = [];
          data.segments.forEach((seg: any) => {
            if (Array.isArray(seg.words)) {
              seg.words.forEach((w: any) => out.push({ word: String(w.word || w.text || w.content || ''), start: Number(w.start || w.start_time || 0), end: Number(w.end || w.end_time || 0) }));
            }
          });
          if (out.length) return out;
        }

        // 4) items array (AWS-style) -> items with type 'pronunciation' or 'word'
        if (Array.isArray(data.items) && data.items.length > 0) {
          const out: WordTimestamp[] = [];
          data.items.forEach((it: any) => {
            const isWord = it.type === 'pronunciation' || it.type === 'word' || it.type === 'pron';
            if (isWord) {
              const content = it.alternatives?.[0]?.content || it.content || it.word || '';
              out.push({ word: String(content), start: Number(it.start_time || it.start || 0), end: Number(it.end_time || it.end || 0) });
            }
          });
          if (out.length) return out;
        }

        // 5) Fallbacks: plain text fields
        if (typeof data.transcript === 'string' && data.transcript.trim().length > 0) {
          return [{ word: data.transcript.trim(), start: 0, end: 0 }];
        }
        if (typeof data.text === 'string' && data.text.trim().length > 0) {
          return [{ word: data.text.trim(), start: 0, end: 0 }];
        }

        return [];
      };

        const parsed = parseElevenLabs(transcriptionData);
        if (parsed.length === 0) {
          setTranscription([{ word: 'No transcript available', start: 0, end: 0 }]);
        } else {
          // Prefer entries that have non-zero durations
          const withTimestamps = parsed.map(p => ({ word: p.word, start: Number.isFinite(p.start) ? p.start : 0, end: Number.isFinite(p.end) ? p.end : (p.start + 0.8) }));
          setTranscription(withTimestamps);
        }
      } else {
        // Skip transcription when no audio is present or preference is disabled
        if (!hasAudio) {
          setTranscription([{ word: 'No audio track available for transcription.', start: 0, end: 0 }]);
        } else if (!SHOULD_TRANSCRIBE) {
          setTranscription([{ word: 'Transcription disabled by preference.', start: 0, end: 0 }]);
        } else if (!ELEVENLABS_API_KEY) {
          setTranscription([{ word: 'Transcription unavailable: ElevenLabs API key missing.', start: 0, end: 0 }]);
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to transcribe video.');
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

    // Handle word click for manual seeking
    const handleWordClick = (wordData: WordTimestamp, index: number) => {
        if (videoRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            
            const video = videoRef.current;
            video.currentTime = wordData.start;
            video.play();
            setActiveIndex(index);
        }
    };

    // Track video playback to highlight current word
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const currentTime = video.currentTime;
            const currentIndex = transcription.findIndex(
                word => currentTime >= word.start && currentTime <= word.end
            );
            setActiveIndex(currentIndex >= 0 ? currentIndex : null);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }, [transcription]);
    
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
                        className={`cursor-pointer transition-all duration-300 px-2 py-1 rounded-md mr-1 ${
                          activeIndex === index 
                            ? 'bg-indigo-600 text-white transform scale-125 font-bold text-lg shadow-lg z-10' 
                            : 'hover:bg-gray-700 hover:scale-110'
                        }`}
                        onClick={() => handleWordClick(wordData, index)}
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e) => e.key === 'Enter' && handleWordClick(wordData, index)}
                        aria-label={`Play word: ${wordData.word}`}
                        style={{
                          transition: 'all 0.15s ease-in-out',
                          display: 'inline-block'
                        }}
                    >
                        {wordData.word}
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
            disabled={isLoading || !inputText.trim() || !imageData}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
            title={!imageData ? "Please upload an image first." : ""}
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
            <>
              <ClickableText transcription={transcription} videoRef={videoRef} />
              <div className="bg-gray-800 p-4 border-x border-b border-gray-700 rounded-b-lg mt-4">
                <h2 className="text-lg font-semibold text-white mb-2">Transcript</h2>
                <p className="text-gray-300 leading-relaxed">
                  {transcription && transcription.length > 0
                    ? transcription.map((wordData) => wordData.word).join(' ')
                    : 'No transcript available'}
                </p>
              </div>
            </>
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
