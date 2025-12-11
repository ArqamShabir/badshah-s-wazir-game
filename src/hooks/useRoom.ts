import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, update, remove, push, get, onDisconnect } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Room, Player, Role, GameStage, ROLE_SCORES } from '@/types/game';
import { useAuth } from '@/contexts/AuthContext';

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const STALE_PLAYER_MS = 5 * 60_000; // 5 minutes before pruning stale players

export const useRoom = (roomId: string | null) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof ref> | null>(null);

  // Listen to room changes
  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const roomRef = ref(db, `rooms/${roomId}`);
    const playersRef = ref(db, `rooms/${roomId}/players`);

    const unsubRoom = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRoom({
          roomId,
          stage: data.stage || 'waiting',
          timerEndsAt: data.timerEndsAt || null,
          hostId: data.hostId,
          guessTarget: data.guessTarget || null,
          round: data.round || 1,
          createdAt: data.createdAt,
        });
        setError(null);
      } else {
        setRoom(null);
        setError('Room not found');
      }
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    const unsubPlayers = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const now = Date.now();
        const stale: string[] = [];
        const playerList = Object.entries(data).map(([uid, player]: [string, any]) => {
          if (player.lastSeen && now - player.lastSeen > STALE_PLAYER_MS) {
            stale.push(uid);
          }
          return {
            uid,
            ...player,
          };
        });
        setPlayers(playerList.sort((a, b) => a.createdAt - b.createdAt));

        if (stale.length) {
          const updates: Record<string, null> = {};
          stale.forEach((uid) => {
            updates[uid] = null;
          });
          void update(playersRef, updates);
        }
      } else {
        setPlayers([]);
      }
    });

    return () => {
      unsubRoom();
      unsubPlayers();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (presenceRef.current) {
        void onDisconnect(presenceRef.current).cancel();
        presenceRef.current = null;
      }
    };
  }, [roomId]);

  const createRoom = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('Must be logged in');

    const roomCode = generateRoomCode();
    const roomRef = ref(db, `rooms/${roomCode}`);
    
    await set(roomRef, {
      stage: 'waiting',
      timerEndsAt: null,
      hostId: user.uid,
      guessTarget: null,
      round: 1,
      createdAt: Date.now(),
    });

    // Add host as first player
    const hostPlayerRef = ref(db, `rooms/${roomCode}/players/${user.uid}`);
    await set(hostPlayerRef, {
      displayName: user.displayName || 'Player',
      avatar: user.photoURL || '',
      privateRole: null,
      publicRole: null,
      revealed: false,
      score: 0,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    });
    await onDisconnect(hostPlayerRef).remove();
    presenceRef.current = hostPlayerRef;
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
      if (presenceRef.current) {
        void update(presenceRef.current, { lastSeen: Date.now() });
      }
    }, 5000);

    return roomCode;
  }, [user]);

  const joinRoom = useCallback(async (code: string): Promise<boolean> => {
    if (!user) throw new Error('Must be logged in');

    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    
    if (!snapshot.exists()) {
      throw new Error('Room not found');
    }

    const playersRef = ref(db, `rooms/${code}/players`);
    const playersSnap = await get(playersRef);
    const playerCount = playersSnap.exists() ? Object.keys(playersSnap.val()).length : 0;

    if (playerCount >= 4) {
      throw new Error('Room is full');
    }

    // Check if already in room
    const playerRef = ref(db, `rooms/${code}/players/${user.uid}`);
    const playerSnap = await get(playerRef);
    
    if (!playerSnap.exists()) {
      await set(playerRef, {
        displayName: user.displayName || 'Player',
        avatar: user.photoURL || '',
        privateRole: null,
        publicRole: null,
        revealed: false,
        score: 0,
        createdAt: Date.now(),
        lastSeen: Date.now(),
      });
    } else {
      await update(playerRef, { lastSeen: Date.now() });
    }

    await onDisconnect(playerRef).remove();
    presenceRef.current = playerRef;
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(() => {
      if (presenceRef.current) {
        void update(presenceRef.current, { lastSeen: Date.now() });
      }
    }, 5000);

    return true;
  }, [user]);

  const leaveRoom = useCallback(async () => {
    if (!user || !roomId) return;

    const playerRef = ref(db, `rooms/${roomId}/players/${user.uid}`);
    await onDisconnect(playerRef).cancel();
    await remove(playerRef);

    // If host leaves and there are other players, assign new host
    if (room?.hostId === user.uid && players.length > 1) {
      const newHost = players.find(p => p.uid !== user.uid);
      if (newHost) {
        await update(ref(db, `rooms/${roomId}`), { hostId: newHost.uid });
      }
    }

    // If no players left, delete room
    if (players.length <= 1) {
      await remove(ref(db, `rooms/${roomId}`));
    }
  }, [user, roomId, room, players]);

  const dealRoles = useCallback(async () => {
    if (!user || !roomId || room?.hostId !== user.uid) return;
    if (players.length !== 4) {
      throw new Error('Need exactly 4 players');
    }

    const roles: Role[] = shuffleArray(['badshah', 'vizier', 'qazi', 'chor']);
    
    const updates: Record<string, any> = {
      stage: 'badshah_reveal',
      guessTarget: null,
    };

    players.forEach((player, index) => {
      updates[`players/${player.uid}/privateRole`] = roles[index];
      updates[`players/${player.uid}/publicRole`] = null;
      updates[`players/${player.uid}/revealed`] = false;
    });

    await update(ref(db, `rooms/${roomId}`), updates);
  }, [user, roomId, room, players]);

  const revealBadshah = useCallback(async () => {
    if (!user || !roomId) return;
    
    const currentPlayer = players.find(p => p.uid === user.uid);
    if (currentPlayer?.privateRole !== 'badshah') return;

    await update(ref(db, `rooms/${roomId}/players/${user.uid}`), {
      publicRole: 'badshah',
      revealed: true,
    });

    await update(ref(db, `rooms/${roomId}`), {
      stage: 'vizier_reveal',
    });
  }, [user, roomId, players]);

  const revealVizier = useCallback(async () => {
    if (!user || !roomId) return;
    
    const currentPlayer = players.find(p => p.uid === user.uid);
    if (currentPlayer?.privateRole !== 'vizier') return;

    await update(ref(db, `rooms/${roomId}/players/${user.uid}`), {
      publicRole: 'vizier',
      revealed: true,
    });

    await update(ref(db, `rooms/${roomId}`), {
      stage: 'vizier_guess',
    });
  }, [user, roomId, players]);

  const makeGuess = useCallback(async (targetUid: string) => {
    if (!user || !roomId) return;
    
    const currentPlayer = players.find(p => p.uid === user.uid);
    if (currentPlayer?.privateRole !== 'vizier') return;

    await update(ref(db, `rooms/${roomId}`), {
      guessTarget: targetUid,
      stage: 'final_reveal',
    });

    // Reveal all players
    const updates: Record<string, any> = {};
    players.forEach(player => {
      updates[`players/${player.uid}/publicRole`] = player.privateRole;
      updates[`players/${player.uid}/revealed`] = true;
    });
    await update(ref(db, `rooms/${roomId}`), updates);

    // Calculate and update scores
    setTimeout(async () => {
      const targetPlayer = players.find(p => p.uid === targetUid);
      const vizierCorrect = targetPlayer?.privateRole === 'chor';
      
      const scoreUpdates: Record<string, any> = { stage: 'scoring' };
      players.forEach(player => {
        let scoreGain = ROLE_SCORES[player.privateRole as Role];
        
        // If vizier guessed correctly, chor gets 0, otherwise chor steals from vizier
        if (player.privateRole === 'vizier') {
          scoreGain = vizierCorrect ? 50 : 0;
        } else if (player.privateRole === 'chor') {
          scoreGain = vizierCorrect ? 0 : 50;
        }
        
        scoreUpdates[`players/${player.uid}/score`] = (player.score || 0) + scoreGain;
      });
      
      await update(ref(db, `rooms/${roomId}`), scoreUpdates);
    }, 2000);
  }, [user, roomId, players]);

  const resetRound = useCallback(async () => {
    if (!user || !roomId || room?.hostId !== user.uid) return;

    const updates: Record<string, any> = {
      stage: 'waiting',
      guessTarget: null,
      round: (room?.round || 0) + 1,
    };

    players.forEach(player => {
      updates[`players/${player.uid}/privateRole`] = null;
      updates[`players/${player.uid}/publicRole`] = null;
      updates[`players/${player.uid}/revealed`] = false;
    });

    await update(ref(db, `rooms/${roomId}`), updates);
  }, [user, roomId, room, players]);

  const currentPlayer = user ? players.find(p => p.uid === user.uid) : null;
  const isHost = user?.uid === room?.hostId;

  return {
    room,
    players,
    currentPlayer,
    isHost,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    dealRoles,
    revealBadshah,
    revealVizier,
    makeGuess,
    resetRound,
  };
};
