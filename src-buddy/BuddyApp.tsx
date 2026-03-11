import React, { useState, useCallback, useEffect } from 'react';
import { CharBotGLB } from './CharBotGLB';
import { useBuddyBridge } from './useBuddyBridge';

const ACCENT = '#00ccff';
const a = (op: number) => `rgba(0,204,255,${op})`;

const MENU_ITEMS = [
  { id: 'charbot', label: 'Otwórz Charbot OS', icon: '🤖' },
  { id: 'hide',    label: 'Ukryj buddy',        icon: '👁' },
  { id: 'dance',   label: 'Tańcz!',             icon: '🕺' },
];

export function BuddyApp() {
  const { emotion, isTalking, isListening, lastMessage } = useBuddyBridge();
  const [showMsg, setShowMsg]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden]     = useState(false);
  const [forceDance, setForceDance] = useState(false);

  useEffect(() => {
    if (lastMessage) {
      setShowMsg(true);
      const t = setTimeout(() => setShowMsg(false), 4000);
      return () => clearTimeout(t);
    }
  }, [lastMessage]);

  const handleMenu = (id: string) => {
    setMenuOpen(false);
    if (id === 'charbot') window.open('http://127.0.0.1:3000', '_blank');
    if (id === 'hide')    setHidden(h => !h);
    if (id === 'dance')   { setForceDance(true); setTimeout(() => setForceDance(false), 4000); }
  };

  const handleDrag = useCallback(() => {}, []);

  if (hidden) return (
    <div
      onClick={() => setHidden(false)}
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: a(0.3), border: `1.5px solid ${ACCENT}`,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, boxShadow: `0 0 16px ${a(0.4)}`,
      }}
    >🤖</div>
  );

  return (
    <div style={{ position: 'relative', width: 260, height: 320, background: 'rgba(0,8,24,0.88)', borderRadius: 16, overflow: 'visible' }}>

      {/* Chat bubble */}
      {showMsg && lastMessage && (
        <div style={{
          position: 'absolute', bottom: 330, left: 0, right: 0,
          background: 'rgba(6,14,36,0.95)',
          border: `1px solid ${a(0.4)}`,
          borderRadius: 12, padding: '8px 12px',
          fontSize: 11, color: '#c8e8ff',
          fontFamily: 'Segoe UI, sans-serif', lineHeight: 1.4,
          boxShadow: `0 0 20px ${a(0.2)}`, zIndex: 20,
        }}>
          {lastMessage.slice(0, 140)}{lastMessage.length > 140 ? '…' : ''}
        </div>
      )}

      {/* Status */}
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        color: isTalking ? '#00ffcc' : isListening ? '#00aaff' : a(0.4),
        fontFamily: 'monospace', zIndex: 10, whiteSpace: 'nowrap',
      }}>
        {isTalking ? '● MÓWI' : isListening ? '● SŁUCHA' : emotion === 'thinking' ? '● MYŚLI' : '○ STANDBY'}
      </div>

      {/* Menu button */}
      <div style={{ position: 'absolute', right: -44, top: '40%', zIndex: 30 }}>
        {/* Flyout */}
        {menuOpen && (
          <div style={{
            position: 'absolute', right: 44, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'rgba(4,10,28,0.97)',
            border: `1.5px solid ${a(0.4)}`,
            borderRadius: 12, padding: '6px',
            boxShadow: `0 0 24px ${a(0.2)}`,
            whiteSpace: 'nowrap',
          }}>
            {MENU_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => handleMenu(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  color: '#c8e8ff', fontSize: 11, fontWeight: 600,
                  fontFamily: 'Segoe UI, sans-serif',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = a(0.12))}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setMenuOpen(m => !m)}
          style={{
            width: 36, height: 36, borderRadius: 12, border: `1.5px solid ${a(menuOpen ? 0.9 : 0.35)}`,
            background: menuOpen ? a(0.25) : 'rgba(4,10,28,0.9)',
            cursor: 'pointer', fontSize: 16, color: ACCENT,
            boxShadow: menuOpen ? `0 0 16px ${a(0.5)}` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✦</button>
      </div>

      <CharBotGLB
        emotion={forceDance ? 'happy' : emotion}
        isTalking={isTalking}
        isListening={isListening}
        onDoubleClick={() => { setForceDance(true); setTimeout(() => setForceDance(false), 4000); }}
        onDrag={handleDrag}
      />
    </div>
  );
}
