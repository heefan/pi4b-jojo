'use client';

import { IconMicrophone } from "@/components/icons/IconMicrophone";
import { IconSpinner } from "@/components/icons/IconSpinner";
import { IconStop } from "@/components/icons/IconStop";
import { getKeysHeader } from '@/utils/settings';
import { useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Add new type for chat messages
type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string>('');
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  const getButtonStyles = () => {
    if (connectionStatus === 'disconnected') {
      return ' bg-blue-500  bg-primary-500 hover:bg-primary-600 dark:bg-primary-700 dark:hover:bg-primary-800 text-white';
    }
    if (connectionStatus === 'connecting') {
      return 'bg-yellow-500 dark:bg-yellow-600 text-white cursor-not-allowed';
    }
    return 'bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 text-white';
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Initializing connection...';
      case 'connected':
        return 'Tap to end conversation';
      default:
        return 'Tap to start conversation';
    }
  };

  const stopConnection = async () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    setConnectionStatus('disconnected');
  };

  const initConnection = async () => {
    try {
      setConnectionStatus('connecting');
      setError('');

      const tokenResponse = await fetch('/api/audio/session', {
        method: 'POST',
        headers: getKeysHeader()
      });
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data.client_secret.value;

      peerConnection.current = new RTCPeerConnection();

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      peerConnection.current.ontrack = e => audioEl.srcObject = e.streams[0];

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      } catch (err) {
        console.error('Microphone access error:', err);
        throw new Error(`Microphone access failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please check if a microphone is connected and permissions are granted.`);
      }

      if (!mediaStream) {
        throw new Error('Failed to get media stream');
      }

      peerConnection.current.addTrack(mediaStream.getTracks()[0]);

      dataChannel.current = peerConnection.current.createDataChannel('oai-events');
      dataChannel.current.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'transcript') {
          setCurrentTranscript(data.text);
        } else if (data.type === 'response') {
          handleNewMessage('assistant', data.text);
          setCurrentTranscript('');
        }
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp'
        },
      });

      const answer: RTCSessionDescriptionInit = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      await peerConnection.current.setRemoteDescription(answer);

      setConnectionStatus('connected');

      peerConnection.current.onconnectionstatechange = () => {
        if (peerConnection.current?.connectionState === 'disconnected') {
          setConnectionStatus('disconnected');
        }
      };

    } catch (err: any) {
      console.error('Connection error:', err);
      setError(`Failed to connect: ${err.message}`);
      setConnectionStatus('disconnected');
    }
  };

  const handleConnectionToggle = async () => {
    console.log("handleConnectionToggle: ", connectionStatus)
    if (connectionStatus === 'connected') {
      await stopConnection();
    } else {
      await initConnection();
    }
  };

  // Add message handler
  const handleNewMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, {
      role,
      content,
      timestamp: new Date()
    }]);
  };

  // Update the data channel event handler
  const handleDataChannelMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebRTC data received:', data); // Debug log

      // Handle OpenAI speech events
      if (data.event === 'speech.transcribe') {
        setCurrentTranscript(data.text);
        setIsTranscribing(true);
      }
      // Handle final transcript
      else if (data.event === 'speech.final_transcript') {
        setMessages(prev => [...prev, {
          role: 'user',
          content: data.text,
          timestamp: new Date()
        }]);
        setCurrentTranscript('');
        setIsTranscribing(false);
      }
      // Handle OpenAI's response
      else if (data.event === 'speech.message') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error parsing data channel message:', error);
    }
  };

  // Set up data channel listener
  useEffect(() => {
    if (dataChannel.current) {
      dataChannel.current.onmessage = handleDataChannelMessage;
    }
  }, []);

  // Render messages and current transcript
  const renderMessages = () => (
    <div className="flex-grow overflow-y-auto space-y-4 mb-4">
      {/* Existing messages */}
      {messages.map((message, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg ${message.role === 'user'
            ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]'
            : 'bg-gray-100 dark:bg-gray-700 mr-auto max-w-[80%]'
            }`}
        >
          <p className="text-sm dark:text-gray-100">{message.content}</p>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
      ))}

      {/* Current transcript */}
      {isTranscribing && currentTranscript && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/50 ml-auto max-w-[80%]">
          <p className="text-sm dark:text-gray-100 italic">
            {currentTranscript}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen">
      <div className="w-1/2 p-4 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Chat History</h2>

        {/* Debug info - remove after testing */}
        <div className="text-xs text-gray-500 mb-2">
          Status: {isTranscribing ? 'Transcribing...' : 'Not transcribing'}
          {currentTranscript && <p>Current: {currentTranscript}</p>}
        </div>

        {/* Messages Container */}
        {renderMessages()}

        {/* Microphone Controls */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleConnectionToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${getButtonStyles()}`}
              disabled={connectionStatus === 'connecting'}
            >
              {/* Single-size icon container */}
              <div className="w-8 h-8 flex items-center justify-center">
                {connectionStatus === 'disconnected' && <IconMicrophone className="w-6 h-6" />}
                {connectionStatus === 'connecting' && <IconSpinner className="w-6 h-6" />}
                {connectionStatus === 'connected' && <IconStop className="w-6 h-6" />}
              </div>
            </button>

            {/* Fixed height for status text */}
            <div className="h-6 flex items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {getStatusText()}
              </span>
            </div>

            {/* Wave Animation */}
            {connectionStatus === 'connected' && (
              <div className="h-12 flex justify-center items-center">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="mx-1 w-1 bg-primary-500 dark:bg-primary-700 rounded-full animate-wave"
                    style={{
                      height: `${20 + Math.random() * 20}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="h-6 flex items-center">
                <span className="text-red-500 dark:text-red-400 text-sm">
                  {error}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Reserved for Claude Artifact Features */}
      <div className="w-1/2 p-4 bg-gray-50 dark:bg-gray-800">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Claude Artifacts</h2>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <p>Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
