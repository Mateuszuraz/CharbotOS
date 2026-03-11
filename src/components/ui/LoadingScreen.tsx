import React, { useEffect, useRef, useState } from 'react';

const VIDEOS = ['/loading-1.mp4', '/loading-2.mp4', '/loading-3.mp4'];
const DISPLAY_MS = 4500; // each video shown for this long (loops if shorter)
const FADE_MS = 400;

interface LoadingScreenProps {
  onDone: () => void;
}

function useAppVersion(): string {
  const [version, setVersion] = useState('');
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { if (d.version) setVersion(d.version); })
      .catch(() => {});
  }, []);
  return version;
}

export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOpacity, setVideoOpacity] = useState(0);
  const [screenFading, setScreenFading] = useState(false);
  const doneRef = useRef(false);
  const version = useAppVersion();

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setScreenFading(true);
    setTimeout(onDone, 700);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    // Try to play video at index idx; timing is controlled by timers, not video events
    const showVideo = (idx: number) => {
      if (cancelled) return;

      video.src = VIDEOS[idx];
      video.loop = true;
      video.load();

      // Best-effort play — never call finish() on failure
      video.play()
        .then(() => { if (!cancelled) setVideoOpacity(1); })
        .catch(() => {
          // Autoplay blocked or file missing — just stay visible (black bg shows)
          if (!cancelled) setVideoOpacity(1);
        });

      const isLast = idx === VIDEOS.length - 1;

      timers.push(setTimeout(() => {
        if (cancelled) return;

        if (isLast) {
          // After last video: fade out and finish
          setVideoOpacity(0);
          timers.push(setTimeout(finish, FADE_MS));
        } else {
          // Dip to black, then show next video
          setVideoOpacity(0);
          timers.push(setTimeout(() => showVideo(idx + 1), FADE_MS));
        }
      }, DISPLAY_MS));
    };

    showVideo(0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // Hard safety fallback (in case timers break)
  useEffect(() => {
    const t = setTimeout(finish, DISPLAY_MS * VIDEOS.length + 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `opacity 700ms ease`,
        opacity: screenFading ? 0 : 1,
        pointerEvents: screenFading ? 'none' : 'all',
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transition: `opacity ${FADE_MS}ms ease`,
          opacity: videoOpacity,
        }}
      />
      {version && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 10000,
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.05em',
          pointerEvents: 'none',
        }}>
          v{version}
        </div>
      )}
    </div>
  );
}
