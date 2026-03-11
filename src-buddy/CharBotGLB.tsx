import React, { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

const ANIM: Record<string, string> = {
  idle:      '/buddy-models/Meshy_AI_Animation_Idle_4_withSkin.glb',
  happy:     '/buddy-models/Meshy_AI_Animation_Cheer_with_Both_Hands_withSkin.glb',
  thinking:  '/buddy-models/Meshy_AI_Animation_Torch_Look_Around_withSkin.glb',
  surprised: '/buddy-models/Meshy_AI_Animation_Sumo_High_Pull_withSkin.glb',
  talking:   '/buddy-models/Meshy_AI_Animation_FunnyDancing_02_withSkin.glb',
  greeting:  '/buddy-models/Meshy_AI_Animation_Wave_One_Hand_withSkin.glb',
  dance:     '/buddy-models/Meshy_AI_Animation_FunnyDancing_02_withSkin.glb',
};

Object.values(ANIM).forEach(src => useGLTF.preload(src));
useGLTF.preload('/buddy-models/Meshy_AI_Character_output.glb');

interface ModelProps {
  emotion: string;
  isTalking: boolean;
  isListening: boolean;
  forcedAnim: string | null;
  cursorRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

function CharBotModel({ emotion, isTalking, isListening, forcedAnim, cursorRef }: ModelProps) {
  const { scene } = useGLTF('/buddy-models/Meshy_AI_Character_output.glb');
  const animIdle      = useGLTF(ANIM.idle);
  const animHappy     = useGLTF(ANIM.happy);
  const animThinking  = useGLTF(ANIM.thinking);
  const animSurprised = useGLTF(ANIM.surprised);
  const animTalking   = useGLTF(ANIM.talking);
  const animGreeting  = useGLTF(ANIM.greeting);

  const groupRef      = useRef<THREE.Group>(null);
  const mixer         = useRef<THREE.AnimationMixer | null>(null);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const clock         = useRef(0);
  const rotTarget     = useRef({ x: 0, y: 0 });
  const rotCurrent    = useRef({ x: 0, y: 0 });
  const idleTimer     = useRef(0);
  const idleInterval  = useRef(2.0);

  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(scene);
  }, [scene]);

  useEffect(() => {
    if (!mixer.current) return;
    let src: { animations: THREE.AnimationClip[] };
    if (forcedAnim === 'dance')         src = animTalking;
    else if (forcedAnim === 'greeting') src = animGreeting;
    else if (isTalking)                 src = animTalking;
    else if (isListening)               src = animThinking;
    else if (emotion === 'happy')       src = animHappy;
    else if (emotion === 'thinking')    src = animThinking;
    else if (emotion === 'surprised')   src = animSurprised;
    else                                src = animIdle;

    const clip = src.animations[0];
    if (!clip) return;
    const next = mixer.current.clipAction(clip);
    next.reset().fadeIn(0.3).play();
    if (currentAction.current && currentAction.current !== next) {
      currentAction.current.fadeOut(0.3);
    }
    currentAction.current = next;
  }, [emotion, isTalking, isListening, forcedAnim, animIdle, animHappy, animThinking, animSurprised, animTalking, animGreeting]);

  useFrame((_, delta) => {
    clock.current += delta;
    mixer.current?.update(delta);
    if (!groupRef.current) return;

    if (cursorRef.current) {
      rotTarget.current.y = cursorRef.current.x * 0.4;
      rotTarget.current.x = -cursorRef.current.y * 0.2;
    } else {
      idleTimer.current += delta;
      if (idleTimer.current > idleInterval.current) {
        idleTimer.current = 0;
        idleInterval.current = 1.5 + Math.random() * 2.5;
        rotTarget.current.y = (Math.random() - 0.5) * 0.5;
        rotTarget.current.x = (Math.random() - 0.5) * 0.1;
      }
    }

    rotCurrent.current.x = lerp(rotCurrent.current.x, rotTarget.current.x, 0.04);
    rotCurrent.current.y = lerp(rotCurrent.current.y, rotTarget.current.y, 0.04);
    groupRef.current.rotation.x = rotCurrent.current.x;
    groupRef.current.rotation.y = rotCurrent.current.y;
    groupRef.current.position.y = Math.sin(clock.current * 1.1) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.4} position={[0, -1.0, 0]} />
    </group>
  );
}

interface Props {
  emotion: string;
  isTalking: boolean;
  isListening: boolean;
  onDoubleClick: () => void;
  onDrag: (dx: number, dy: number) => void;
}

export function CharBotGLB({ emotion, isTalking, isListening, onDoubleClick, onDrag }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef    = useRef<{ x: number; y: number } | null>(null);
  const [forcedAnim, setForcedAnim] = useState<string | null>(null);
  const forcedTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart    = useRef<{ x: number; y: number } | null>(null);

  const triggerForced = (anim: string, ms: number) => {
    if (forcedTimer.current) clearTimeout(forcedTimer.current);
    setForcedAnim(anim);
    forcedTimer.current = setTimeout(() => setForcedAnim(null), ms);
  };

  const handleMouseEnter = () => triggerForced('greeting', 1500);
  const handleMouseMove  = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    cursorRef.current = {
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((e.clientY - rect.top)  / rect.height - 0.5) * 2,
    };
    if (dragStart.current) {
      onDrag(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };
  const handleMouseLeave  = () => { cursorRef.current = null; dragStart.current = null; };
  const handleMouseDown   = (e: React.MouseEvent) => { dragStart.current = { x: e.clientX, y: e.clientY }; };
  const handleMouseUp     = () => { dragStart.current = null; };
  const handleDoubleClick = () => { triggerForced('dance', 4000); onDoubleClick(); };

  return (
    <div
      ref={containerRef}
      style={{ width: 260, height: 280, cursor: 'grab' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <Canvas camera={{ position: [0, 0.3, 3.2], fov: 55 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.2} color="#e0f0ff" />
        <directionalLight position={[2, 4, 2]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-1, 1, 2]} intensity={0.8} color="#00ccff" />
        <Suspense fallback={<mesh><boxGeometry args={[0.5,0.5,0.5]}/><meshStandardMaterial color="cyan"/></mesh>}>
          <CharBotModel
            emotion={emotion}
            isTalking={isTalking}
            isListening={isListening}
            forcedAnim={forcedAnim}
            cursorRef={cursorRef}
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}
