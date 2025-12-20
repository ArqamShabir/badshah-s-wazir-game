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
const BADSHAH_REVEAL_MS = 30_000;
const VIZIER_REVEAL_MS = 30_000;
const VIZIER_GUESS_MS = 30_000;
const BOT_THINK_MS = 10_000;

const STAGE_DURATION_MS: Partial<Record<GameStage, number>> = {
  badshah_reveal: BADSHAH_REVEAL_MS,
  vizier_reveal: VIZIER_REVEAL_MS,
  vizier_guess: VIZIER_GUESS_MS,
};

const getRemainingGuessTargets = (playerList: Player[], excludeUid?: string | null): Player[] =>
  playerList.filter((player) => !player.revealed && player.uid !== excludeUid);

export const useRoom = (roomId: string | null) => {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof ref> | null>(null);
  const timerGateRef = useRef<string | null>(null);

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
    const currentPlayers = playersSnap.exists() ? playersSnap.val() : {};
    let playerIds = Object.keys(currentPlayers);
    if (playerIds.length >= 4) {
      // Prefer to remove a bot to make space
      const botId = playerIds.find(id => currentPlayers[id]?.isBot);
      if (botId) {
        await remove(ref(db, `rooms/${code}/players/${botId}`));
        playerIds = playerIds.filter(id => id !== botId);
      }
    }
    if (playerIds.length >= 4) {
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
      timerEndsAt: Date.now() + BADSHAH_REVEAL_MS,
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
      timerEndsAt: Date.now() + VIZIER_REVEAL_MS,
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
      timerEndsAt: Date.now() + VIZIER_GUESS_MS,
    });
  }, [user, roomId, players]);

  const makeGuess = useCallback(async (targetUid: string) => {
    if (!user || !roomId) return;
    
    const currentPlayer = players.find(p => p.uid === user.uid);
    if (currentPlayer?.privateRole !== 'vizier') return;

    const remainingTargets = getRemainingGuessTargets(players, user.uid);
    const resolvedTarget =
      remainingTargets.find((player) => player.uid === targetUid)?.uid ?? remainingTargets[0]?.uid;
    if (!resolvedTarget) return;

    await update(ref(db, `rooms/${roomId}`), {
      guessTarget: resolvedTarget,
      stage: 'final_reveal',
      timerEndsAt: null,
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
      const targetPlayer = players.find(p => p.uid === resolvedTarget);
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

  const forceGuessAndScore = useCallback(async (targetUid: string | null) => {
    if (!roomId) return;

    await update(ref(db, `rooms/${roomId}`), {
      guessTarget: targetUid,
      stage: 'final_reveal',
      timerEndsAt: null,
    });

    // Reveal all players
    const revealUpdates: Record<string, any> = {};
    players.forEach(player => {
      revealUpdates[`players/${player.uid}/publicRole`] = player.privateRole;
      revealUpdates[`players/${player.uid}/revealed`] = true;
    });
    await update(ref(db, `rooms/${roomId}`), revealUpdates);

    // Calculate and update scores (treat missing/invalid target as incorrect guess)
    setTimeout(async () => {
      const targetPlayer = targetUid ? players.find(p => p.uid === targetUid) : null;
      const vizierCorrect = targetPlayer?.privateRole === 'chor';
      
      const scoreUpdates: Record<string, any> = { stage: 'scoring' };
      players.forEach(player => {
        let scoreGain = ROLE_SCORES[player.privateRole as Role];
        
        if (player.privateRole === 'vizier') {
          scoreGain = vizierCorrect ? 50 : 0;
        } else if (player.privateRole === 'chor') {
          scoreGain = vizierCorrect ? 0 : 50;
        }
        
        scoreUpdates[`players/${player.uid}/score`] = (player.score || 0) + scoreGain;
      });
      
      await update(ref(db, `rooms/${roomId}`), scoreUpdates);
    }, 2000);
  }, [players, roomId]);

  const addBotToRoom = useCallback(async (targetRoomId: string): Promise<void> => {
    if (!user) throw new Error('Must be logged in');
    const roomSnap = await get(ref(db, `rooms/${targetRoomId}`));
    if (!roomSnap.exists()) throw new Error('Room not found');
    const hostId = roomSnap.val()?.hostId;
    if (hostId !== user.uid) throw new Error('Only host can add bots');

    const playersRef = ref(db, `rooms/${targetRoomId}/players`);
    const playersSnap = await get(playersRef);
    const count = playersSnap.exists() ? Object.keys(playersSnap.val()).length : 0;
    if (count >= 4) throw new Error('Room is full');

    const botId = `bot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    await set(ref(db, `rooms/${targetRoomId}/players/${botId}`), {
      displayName: `Bot ${count + 1}`,
      avatar: '',
      privateRole: null,
      publicRole: null,
      revealed: false,
      score: 0,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      isBot: true,
    });
  }, [user]);

  const fillBotsToCapacity = useCallback(async (targetRoomId: string): Promise<number> => {
    const playersRef = ref(db, `rooms/${targetRoomId}/players`);
    const playersSnap = await get(playersRef);
    const current = playersSnap.exists() ? Object.keys(playersSnap.val()).length : 0;
    let added = 0;
    for (let i = current; i < 4; i++) {
      await addBotToRoom(targetRoomId);
      added += 1;
    }
    return added;
  }, [addBotToRoom]);

  const resetRound = useCallback(async () => {
    if (!user || !roomId || room?.hostId !== user.uid) return;

    const updates: Record<string, any> = {
      stage: 'waiting',
      guessTarget: null,
      round: (room?.round || 0) + 1,
      timerEndsAt: null,
    };

    players.forEach(player => {
      updates[`players/${player.uid}/privateRole`] = null;
      updates[`players/${player.uid}/publicRole`] = null;
      updates[`players/${player.uid}/revealed`] = false;
    });

    await update(ref(db, `rooms/${roomId}`), updates);
  }, [user, roomId, room, players]);

  const stopRoundForLeave = useCallback(async () => {
    if (!user || !roomId || room?.hostId !== user.uid) return;

    const updates: Record<string, any> = {
      stage: 'waiting',
      guessTarget: null,
      timerEndsAt: null,
    };

    players.forEach(player => {
      updates[`players/${player.uid}/privateRole`] = null;
      updates[`players/${player.uid}/publicRole`] = null;
      updates[`players/${player.uid}/revealed`] = false;
    });

    await update(ref(db, `rooms/${roomId}`), updates);
  }, [user, roomId, room, players]);

  // reset timeout tracker when stage/timer changes
  useEffect(() => {
    timerGateRef.current = null;
  }, [room?.stage, room?.timerEndsAt]);

  // Host-only timeout/bot automation with polling
  useEffect(() => {
    if (!user || room?.hostId !== user.uid) return;
    if (!room?.timerEndsAt) return;

    const checkAndRun = () => {
      if (!room?.timerEndsAt || !room?.stage) return;
      const now = Date.now();
      const stageDuration = STAGE_DURATION_MS[room.stage];
      const stageStartAt = stageDuration ? room.timerEndsAt - stageDuration : null;
      const isBotTurn =
        room.stage === 'badshah_reveal'
          ? players.some(p => p.privateRole === 'badshah' && p.isBot && !p.revealed)
          : room.stage === 'vizier_reveal'
          ? players.some(p => p.privateRole === 'vizier' && p.isBot && !p.revealed)
          : room.stage === 'vizier_guess'
          ? players.some(p => p.privateRole === 'vizier' && p.isBot)
          : false;
      const botReady =
        isBotTurn && stageStartAt !== null && now >= stageStartAt + BOT_THINK_MS;
      if (now < room.timerEndsAt && !botReady) return;
      const key = `${room.stage}-${room.timerEndsAt}`;
      if (timerGateRef.current === key) return;
      timerGateRef.current = key;

      const revealRole = async (role: Role, nextStage: GameStage, nextDurationMs: number) => {
        const player = players.find(p => p.privateRole === role && !p.revealed);
        if (!player) return;
        await update(ref(db, `rooms/${roomId}/players/${player.uid}`), {
          publicRole: role,
          revealed: true,
        });
        await update(ref(db, `rooms/${roomId}`), {
          stage: nextStage,
          timerEndsAt: Date.now() + nextDurationMs,
        });
      };

      const autoGuessForVizier = async () => {
        const vizier = players.find(p => p.privateRole === 'vizier');
        if (!vizier) return;
        const remainingTargets = getRemainingGuessTargets(players, vizier.uid);
        const wrongTarget = remainingTargets.find(p => p.privateRole !== 'chor');
        const targetUid = wrongTarget?.uid || remainingTargets[0]?.uid || null;
        await forceGuessAndScore(targetUid);
      };

      const runTimeout = async () => {
        if (!room) return;
        if (room.stage === 'badshah_reveal') {
          await revealRole('badshah', 'vizier_reveal', VIZIER_REVEAL_MS);
        } else if (room.stage === 'vizier_reveal') {
          await revealRole('vizier', 'vizier_guess', VIZIER_GUESS_MS);
        } else if (room.stage === 'vizier_guess') {
          await autoGuessForVizier();
        }
      };

      void runTimeout();
    };

    const id = setInterval(checkAndRun, 500);
    return () => clearInterval(id);
  }, [user, room?.hostId, room?.timerEndsAt, room?.stage, roomId, players, forceGuessAndScore]);

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
    stopRoundForLeave,
    addBotToRoom,
    fillBotsToCapacity,
  };
};
