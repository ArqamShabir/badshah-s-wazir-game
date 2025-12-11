import React, { useEffect, useRef, useState } from 'react';
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
  Timer
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
  } = useRoom(roomId || null);

  const [copied, setCopied] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const selfId = currentPlayer?.uid || user?.uid;
  const { streams, error: videoError, toggleAudio, toggleVideo, isAudioEnabled, isVideoEnabled } = useVideoChat(
    roomId || null,
    selfId
  );

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

  const handleDeal = async () => {
    try {
      await dealRoles();
      toast({ title: 'Cards dealt!', description: 'Check your role!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRevealBadshah = async () => {
    await revealBadshah();
    toast({ title: 'Badshah revealed!', description: 'Now Vizier must reveal.' });
  };

  const handleRevealVizier = async () => {
    await revealVizier();
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

  const unrevealed = players.filter(p => !p.revealed && p.uid !== currentPlayer?.uid);

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
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/50 shadow-soft">
        <div className="flex flex-col gap-2 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Left: Back + Room code */}
            <div className="flex items-center gap-2 flex-1 min-w-[220px] sm:min-w-[260px]">
              <Button variant="ghost" size="icon" onClick={handleLeave} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
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
            <div className="flex justify-center flex-1 min-w-[180px]">
              <Badge variant="secondary" className="px-3 py-1 w-full sm:w-auto justify-center">
                <Timer className="w-3 h-3 mr-1" />
                {STAGE_LABELS[room.stage]}
              </Badge>
            </div>

            {/* Right: Player count + Round */}
            <div className="flex items-center gap-2 flex-1 justify-end min-w-[170px]">
              <Badge variant="outline" className="gap-1 shrink-0">
                <Users className="w-3 h-3" />
                {players.length}/4
              </Badge>
              <Badge variant="outline" className="shrink-0">R{room.round}</Badge>
            </div>
          </div>

          {/* Host controls */}
          {isHost && (
            <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
              <Button
                size="sm"
                onClick={handleDeal}
                disabled={players.length !== 4 || room.stage !== 'waiting'}
                className="whitespace-nowrap"
              >
                <Play className="w-4 h-4 mr-1" />
                Deal
              </Button>
              {room.stage === 'scoring' && (
                <Button size="sm" variant="secondary" onClick={handleNextRound}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Next Round
                </Button>
              )}
            </div>
          )}

          {/* Player action controls */}
          {!isHost && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {canRevealBadshah && (
                <Button size="sm" onClick={handleRevealBadshah}>
                  <Crown className="w-4 h-4 mr-1" />
                  I am the Badshah!
                </Button>
              )}
              {canRevealVizier && (
                <Button size="sm" variant="secondary" onClick={handleRevealVizier}>
                  <Eye className="w-4 h-4 mr-1" />
                  I am the Vizier!
                </Button>
              )}
              {canGuess && selectedTarget && (
                <Button size="sm" variant="accent" onClick={handleMakeGuess}>
                  <Target className="w-4 h-4 mr-1" />
                  Confirm Guess
                </Button>
              )}
            </div>
          )}

          {/* Current player can also reveal if they're Badshah/Vizier */}
          {isHost && (canRevealBadshah || canRevealVizier) && (
            <div className="flex items-center gap-2 overflow-x-auto border-t border-border/50 pt-2">
              {canRevealBadshah && (
                <Button size="sm" onClick={handleRevealBadshah}>
                  <Crown className="w-4 h-4 mr-1" />
                  I am the Badshah!
                </Button>
              )}
              {canRevealVizier && (
                <Button size="sm" variant="secondary" onClick={handleRevealVizier}>
                  <Eye className="w-4 h-4 mr-1" />
                  I am the Vizier!
                </Button>
              )}
              {canGuess && selectedTarget && (
                <Button size="sm" variant="accent" onClick={handleMakeGuess}>
                  <Target className="w-4 h-4 mr-1" />
                  Confirm Guess
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 2x2 Grid always on screen */}
      <main className="flex-1 p-3 md:p-6 overflow-auto">
        <div className="h-full min-h-0 max-w-5xl mx-auto grid grid-cols-2 grid-rows-2 gap-2 md:gap-3 auto-rows-auto place-items-center">
          {players.map((player) => (
            <PlayerTile
              key={player.uid}
              player={player}
              isCurrentUser={player.uid === selfId}
              showPrivateRole={player.uid === selfId}
              mediaStream={streams[player.uid]}
              onToggleAudio={player.uid === selfId ? toggleAudio : undefined}
              onToggleVideo={player.uid === selfId ? toggleVideo : undefined}
              isAudioEnabled={player.uid === selfId ? isAudioEnabled : undefined}
              isVideoEnabled={player.uid === selfId ? isVideoEnabled : undefined}
              canSelect={canGuess && !player.revealed && player.uid !== user?.uid}
              isSelected={selectedTarget === player.uid}
              onSelect={() => setSelectedTarget(player.uid)}
            />
          ))}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="relative w-full max-w-[320px] sm:max-w-[340px] md:max-w-[360px] aspect-square rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center bg-muted/20 shadow-card"
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

      {/* Guess prompt */}
      {canGuess && (
        <div className="sticky bottom-20 left-0 right-0 px-4">
          <div className="max-w-md mx-auto bg-secondary text-secondary-foreground rounded-xl p-4 shadow-lg text-center animate-slide-up">
            <p className="font-semibold">
              {selectedTarget 
                ? `Tap "Confirm Guess" to accuse ${players.find(p => p.uid === selectedTarget)?.displayName}`
                : 'Tap on a player to guess who the Chor is!'}
            </p>
          </div>
        </div>
      )}

      {/* Rules button */}
      <RulesModal />
    </div>
  );
};

export default GameRoom;
