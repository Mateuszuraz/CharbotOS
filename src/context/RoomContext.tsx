import React, { createContext, useContext, useState } from 'react';

interface RoomSession {
  roomId: string;
  participantId: string;
  username: string;
  model: string;
}

interface RoomContextValue {
  roomSession: RoomSession | null;
  enterRoom: (session: RoomSession) => void;
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextValue>({
  roomSession: null,
  enterRoom: () => {},
  leaveRoom: () => {},
});

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);
  return (
    <RoomContext.Provider value={{
      roomSession,
      enterRoom: (s) => setRoomSession(s),
      leaveRoom: () => setRoomSession(null),
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}
