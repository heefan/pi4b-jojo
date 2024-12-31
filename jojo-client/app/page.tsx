'use client';

import { IconMicrophone } from "@/components/icons/IconMicrophone";
import { IconSpinner } from "@/components/icons/IconSpinner";
import { IconStop } from "@/components/icons/IconStop";
import { getKeysHeader } from '@/utils/settings';
import { useRef, useState } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export default function Home() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string>('');
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

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

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      peerConnection.current.addTrack(mediaStream.getTracks()[0]);

      dataChannel.current = peerConnection.current.createDataChannel('oai-events');
      dataChannel.current.addEventListener('message', (e) => {
        console.log('Received message:', e);
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

      const answer = {
        type: 'answer',
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

  return (
    <div className="flex items-center justify-center">
      <div className="max-w-md w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-10 text-center dark:text-gray-100">
          Realtime WebRTC Connection
        </h1>

        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <button
              onClick={handleConnectionToggle}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative text-white ${getButtonStyles()}`}
              disabled={connectionStatus === 'connecting'}
            >
              {connectionStatus === 'disconnected' && <IconMicrophone className="w-6 h-6" />}
              {connectionStatus === 'connecting' && <IconSpinner className="w-6 h-6" />}
              {connectionStatus === 'connected' && <IconStop className="w-6 h-6" />}

              {connectionStatus === 'connected' && (
                <div className="absolute inset-0">
                  <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-primary-500 dark:bg-primary-700"></div>
                </div>
              )}
            </button>

            <span className="mt-6 text-sm text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </span>
          </div>

          {connectionStatus === 'connected' && (
            <div className="flex justify-center items-center h-12">
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
            <div className="text-red-500 dark:text-red-400 text-center text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
