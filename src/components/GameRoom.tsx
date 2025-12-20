import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom } from '@/hooks/useRoom';
import { useVideoChat } from '@/hooks/useVideoChat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PlayerTile from './PlayerTile';
import RulesModal from './RulesModal';
import { 
  Crown, 
  Play, 
  Eye, 
  Target, 
  RotateCcw, 
  Copy, 
  Check, 
  ArrowLeft,
  Users,
  Timer,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GameStage } from '@/types/game';

const STAGE_LABELS: Record<GameStage, string> = {
  waiting: 'Waiting for players...',
  dealing: 'Dealing cards...',
  badshah_reveal: 'Badshah must reveal!',
  vizier_reveal: 'Vizier must reveal!',
  vizier_guess: 'Vizier is guessing...',
  final_reveal: 'Revealing all roles...',
  scoring: 'Scores updated!',
};

const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    room,
    players,
    currentPlayer,
    isHost,
    loading,
    error,
    leaveRoom,
    dealRoles,
    revealBadshah,
    revealVizier,
    makeGuess,
    resetRound,
    joinRoom,
    fillBotsToCapacity,
  } = useRoom(roomId || null);

  const [copied, setCopied] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [timerText, setTimerText] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<'neutral' | 'accent'>('neutral');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const selfId = currentPlayer?.uid || user?.uid;
  const { streams, error: videoError, toggleAudio, toggleVideo, isAudioEnabled, isVideoEnabled } = useVideoChat(
    roomId || null,
    selfId
  );

  const badshahAudioRef = useRef<HTMLAudioElement | null>(null);
  const vizierAudioRef = useRef<HTMLAudioElement | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStageRef = useRef<GameStage | null>(null);
  const lastGuessTargetRef = useRef<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });

  // Ensure the current user is present in the room even when navigating via shared links
  const joinInFlightRef = useRef(false);
  useEffect(() => {
    if (!roomId || !user) return;
    const alreadyInRoom = players.some((p) => p.uid === user.uid);
    if (alreadyInRoom) {
      joinInFlightRef.current = false;
      return;
    }
    if (joinInFlightRef.current) return;
    joinInFlightRef.current = true;
    void joinRoom(roomId).catch((err: any) => {
      console.error('[GameRoom] auto-join failed', err);
      toast({
        title: 'Unable to join room',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
      joinInFlightRef.current = false;
    });
  }, [roomId, user, players, joinRoom, toast]);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;
    setHeaderHeight(Math.ceil(headerEl.getBoundingClientRect().height));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const getSize = () => ({
      width: window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    });

    const apply = () => {
      const next = getSize();
      const prev = viewportRef.current;
      if (!prev.width) {
        viewportRef.current = next;
        setViewportSize(next);
        return;
      }
      const widthDelta = Math.abs(next.width - prev.width);
      const heightDelta = Math.abs(next.height - prev.height);
      if (widthDelta >= 20 || heightDelta >= 80) {
        viewportRef.current = next;
        setViewportSize(next);
      }
    };

    let rafId: number | null = null;
    const onResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        apply();
        rafId = null;
      });
    };

    apply();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const mainHeightPx = viewportSize.height
    ? Math.max(0, viewportSize.height - headerHeight)
    : 0;
  const mainHeight = mainHeightPx
    ? `${mainHeightPx}px`
    : 'calc(100vh - 72px)';
  const isMobile = viewportSize.width > 0 && viewportSize.width < 640;
  const gridPaddingPx = isMobile ? 16 : 0;
  const gridGapPx = isMobile ? 8 : 12;
  const gridHeightPx = isMobile ? Math.max(0, mainHeightPx - gridPaddingPx) : 0;
  const rowHeightPx = isMobile && gridHeightPx
    ? Math.max(0, Math.floor((gridHeightPx - gridGapPx) / 2))
    : 0;
  const tileMinHeight = isMobile && rowHeightPx ? rowHeightPx : undefined;

  const handleCopyCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
  };

  const handleStart = async () => {
    try {
      await dealRoles();
      toast({ title: 'Cards dealt!', description: 'Check your role!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRevealBadshah = async () => {
    await revealBadshah();
    if (!badshahAudioRef.current) {
      badshahAudioRef.current = new Audio('/audio/badshah.mp3');
    }
    void badshahAudioRef.current.play().catch(() => {});
    toast({ title: 'Badshah revealed!', description: 'Now Vizier must reveal.' });
  };

  const handleRevealVizier = async () => {
    await revealVizier();
    if (!vizierAudioRef.current) {
      vizierAudioRef.current = new Audio('/audio/vizier.mp3');
    }
    void vizierAudioRef.current.play().catch(() => {});
    toast({ title: 'Vizier revealed!', description: 'Choose who you think is the Chor!' });
  };

  const handleMakeGuess = async () => {
    if (!selectedTarget) return;
    await makeGuess(selectedTarget);
    setSelectedTarget(null);
  };

  const handleNextRound = async () => {
    await resetRound();
    toast({ title: 'New round!', description: 'Ready to deal again.' });
  };

  const handleAddBots = async () => {
    if (!roomId) return;
    try {
      const added = await fillBotsToCapacity(roomId);
      if (added > 0) {
        toast({ title: 'Bots added', description: `Filled ${added} bot${added > 1 ? 's' : ''} to start the game.` });
      } else {
        toast({ title: 'Room already full' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Could not add bots.', variant: 'destructive' });
    }
  };

  const showBanner = useCallback((text: string, tone: 'neutral' | 'accent' = 'neutral') => {
    setBannerText(text);
    setBannerTone(tone);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setBannerText(null);
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const canRevealBadshah = 
    room?.stage === 'badshah_reveal' && 
    currentPlayer?.privateRole === 'badshah' &&
    !currentPlayer?.revealed;

  const canRevealVizier = 
    room?.stage === 'vizier_reveal' && 
    currentPlayer?.privateRole === 'vizier' &&
    !currentPlayer?.revealed;

  const canGuess = 
    room?.stage === 'vizier_guess' && 
    currentPlayer?.privateRole === 'vizier';

  const vizierPlayer = players.find(p => p.publicRole === 'vizier' || p.privateRole === 'vizier');
  const chorPlayer = players.find(p => p.publicRole === 'chor' || p.privateRole === 'chor');
  const targetPlayer = room?.guessTarget ? players.find(p => p.uid === room.guessTarget) : null;
  const vizierCorrect = targetPlayer?.privateRole === 'chor';

  useEffect(() => {
    if (!room?.timerEndsAt) {
      setTimerText(null);
      return;
    }
    const update = () => {
      const diff = room.timerEndsAt - Date.now();
      if (diff <= 0) {
        setTimerText('00:00');
        return;
      }
      const secs = Math.floor(diff / 1000);
      const m = Math.floor(secs / 60)
        .toString()
        .padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      setTimerText(`${m}:${s}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [room?.timerEndsAt]);

  useEffect(() => {
    if (room?.stage === 'final_reveal') {
      setShowOutcome(true);
    }
    if (room?.stage === 'waiting') {
      setShowOutcome(false);
    }
  }, [room?.stage]);

  useEffect(() => {
    if (!room?.stage) return;
    if (room.stage === lastStageRef.current) return;
    const isVizier = currentPlayer?.privateRole === 'vizier';
    let nextBanner: string | null = null;
    let tone: 'neutral' | 'accent' = 'neutral';

    if (room.stage === 'badshah_reveal') {
      nextBanner = 'Game started • Badshah reveal';
    } else if (room.stage === 'vizier_reveal') {
      nextBanner = 'Badshah revealed • Vizier reveal';
    } else if (room.stage === 'vizier_guess') {
      if (!currentPlayer?.privateRole) {
        return;
      }
      nextBanner = isVizier ? 'Your turn • Pick the Chor and press Guess' : 'Vizier is guessing';
      tone = 'accent';
    } else if (room.stage === 'final_reveal') {
      nextBanner = 'Guess locked • Revealing roles';
    } else if (room.stage === 'scoring') {
      nextBanner = 'Scores updated';
    }

    if (nextBanner) {
      lastStageRef.current = room.stage;
      showBanner(nextBanner, tone);
    } else {
      lastStageRef.current = room.stage;
    }
  }, [room?.stage, currentPlayer?.privateRole, showBanner]);

  useEffect(() => {
    if (!canGuess) {
      lastGuessTargetRef.current = null;
      return;
    }
    if (!selectedTarget) return;
    if (lastGuessTargetRef.current === selectedTarget) return;
    const targetName = players.find(p => p.uid === selectedTarget)?.displayName || 'player';
    lastGuessTargetRef.current = selectedTarget;
    showBanner(`Tap "Guess" to accuse ${targetName}`, 'accent');
  }, [canGuess, selectedTarget, players, showBanner]);

  // Auto-select a target when vizier needs to guess to reduce extra taps
  useEffect(() => {
    if (!canGuess) return;
    if (selectedTarget) return;
    const candidate = players.find(p => !p.revealed && p.uid !== selfId);
    if (candidate) {
      setSelectedTarget(candidate.uid);
    }
  }, [canGuess, selectedTarget, players, selfId]);

  const selfAction = (() => {
    if (canRevealBadshah) {
      return {
        label: 'Reveal',
        icon: <Crown className="w-4 h-4" />,
        onClick: handleRevealBadshah,
        variant: 'default' as const,
        className: undefined,
        disabled: false,
      };
    }
    if (canRevealVizier) {
      return {
        label: 'Reveal',
        icon: <Eye className="w-4 h-4" />,
        onClick: handleRevealVizier,
        variant: 'secondary' as const,
        className: undefined,
        disabled: false,
      };
    }
    if (canGuess) {
      return {
        label: 'Guess',
        icon: <Target className="w-4 h-4" />,
        onClick: handleMakeGuess,
        variant: 'accent' as const,
        className: undefined,
        disabled: !selectedTarget,
      };
    }
    if (isHost && room?.stage === 'scoring') {
      return {
        label: 'Next',
        icon: <RotateCcw className="w-4 h-4" />,
        onClick: handleNextRound,
        variant: 'secondary' as const,
        className: undefined,
        disabled: false,
      };
    }
    if (isHost && room?.stage === 'waiting' && players.length === 4) {
      return {
        label: 'Start',
        icon: <Play className="w-4 h-4" />,
        onClick: handleStart,
        variant: 'default' as const,
        className: undefined,
        disabled: false,
      };
    }
    if (isHost && room?.stage === 'waiting' && players.length < 4) {
      return {
        label: 'Add Bot',
        icon: <Users className="w-4 h-4" />,
        onClick: handleAddBots,
        variant: 'glass' as const,
        className: 'bg-white text-foreground border-border/60 hover:bg-white/90 sm:bg-card/80',
        disabled: false,
      };
    }
    return null;
  })();

  if (loading) {
    return (
      <div className="min-h-screen gradient-sunny flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen gradient-sunny flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Room not found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-sunny flex flex-col overflow-hidden">
      {/* Top Controls */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-border/30 bg-card/80 backdrop-blur-md shadow-soft pb-4 sm:pb-6"
      >
        <div className="flex flex-col gap-2 p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 md:gap-3">
            {/* Left: Back + Room code */}
            <div className="flex items-center gap-2 flex-1 min-w-0 sm:min-w-[260px]">
              <Button variant="outline" size="sm" onClick={handleLeave} className="inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Leave
              </Button>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto justify-center"
              >
                <span className="font-mono font-bold tracking-wider text-sm">{roomId}</span>
                {copied ? (
                  <Check className="w-4 h-4 text-accent" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Center: Status */}
            <div className="hidden sm:flex justify-center flex-1 min-w-[180px]">
              <Badge variant="secondary" className="px-3 py-1 w-full sm:w-auto justify-center">
                <Timer className="w-3 h-3 mr-1" />
                {STAGE_LABELS[room.stage]}
              </Badge>
            </div>

            {/* Right: Player count + Round + Toggle */}
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0 sm:min-w-[170px]">
              <Badge variant="outline" className="gap-1 shrink-0">
                <Users className="w-3 h-3" />
                {players.length}/4
              </Badge>
              <Badge variant="outline" className="shrink-0">R{room.round}</Badge>
            </div>
          </div>
        </div>
      </header>

      {bannerText && (
        <div className="fixed top-16 sm:top-24 left-1/2 -translate-x-1/2 z-40 px-3 pointer-events-none">
          <div
            className={`w-[80vw] max-w-[80vw] sm:w-auto sm:max-w-[420px] text-center rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-soft border border-border/50 backdrop-blur ${
              bannerTone === 'accent'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-card/95 text-foreground'
            }`}
          >
            {bannerText}
          </div>
        </div>
      )}

      {/* 2x2 Grid always on screen */}
      <main
        className="flex-1 min-h-0 p-2 sm:p-3 md:p-6 overflow-hidden pb-2 sm:pb-16"
        style={{ height: mainHeight }}
      >
        <div
          className="h-full min-h-0 max-w-5xl mx-auto grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 auto-rows-fr place-items-stretch sm:place-items-center"
          style={isMobile && gridHeightPx ? { height: `${gridHeightPx}px` } : undefined}
        >
          {players.map((player) => {
            const isSelf = player.uid === selfId;
            const action = isSelf ? selfAction : null;
            return (
              <PlayerTile
                key={player.uid}
                player={player}
                isCurrentUser={isSelf}
                showPrivateRole={isSelf}
                mediaStream={streams[player.uid]}
                onToggleAudio={isSelf ? toggleAudio : undefined}
                onToggleVideo={isSelf ? toggleVideo : undefined}
                isAudioEnabled={isSelf ? isAudioEnabled : undefined}
                isVideoEnabled={isSelf ? isVideoEnabled : undefined}
                timerText={timerText}
                actionLabel={action?.label}
                actionIcon={action?.icon}
                onAction={action?.onClick}
                actionDisabled={action?.disabled}
                actionVariant={action?.variant}
                actionClassName={action?.className}
                minHeight={tileMinHeight}
                canSelect={canGuess && !player.revealed && player.uid !== user?.uid}
                isSelected={selectedTarget === player.uid}
                onSelect={() => setSelectedTarget(player.uid)}
              />
            );
          })}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="relative w-full h-full max-w-full sm:max-w-[380px] md:max-w-[420px] sm:h-auto sm:aspect-[2/3] md:aspect-[3/2] rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 shadow-card"
              style={tileMinHeight ? { minHeight: tileMinHeight } : undefined}
            >
              <div className="text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waiting...</p>
              </div>
            </div>
          ))}
        </div>
        {videoError && (
          <div className="mt-3 text-center text-sm text-destructive">
            {videoError}
          </div>
        )}
      </main>

      {/* Rules button */}
      <RulesModal />

      {/* Outcome modal */}
      {showOutcome && (room.stage === 'final_reveal' || room.stage === 'scoring') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-md text-center space-y-4 border border-border/50">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${vizierCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {vizierCorrect ? <Check className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>
            <h3 className="text-xl font-bold">
              {vizierCorrect ? 'Vizier guessed right!' : 'Vizier guessed wrong'}
            </h3>
            <p className="text-muted-foreground">
              {vizierPlayer
                ? `${vizierPlayer.displayName || 'Vizier'} accused ${targetPlayer ? targetPlayer.displayName : 'no one'}. ${vizierCorrect ? 'Chor caught.' : 'Chor escaped.'}`
                : 'Waiting for result...'}
            </p>
            <div className="bg-muted/60 rounded-xl p-3 text-left border border-border/40">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Vizier</span>
                <span className="font-semibold">{vizierPlayer?.displayName || 'TBD'}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Guess</span>
                <span className="font-semibold">{targetPlayer ? targetPlayer.displayName : 'No guess'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual Chor</span>
                <span className="font-semibold">{chorPlayer ? chorPlayer.displayName : 'TBD'}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              {isHost && room.stage === 'scoring' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await handleNextRound();
                    setShowOutcome(false);
                  }}
                >
                  Next Round
                </Button>
              )}
              <Button onClick={() => setShowOutcome(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
