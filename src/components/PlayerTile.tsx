import React, { useEffect, useRef, useState } from 'react';
import { Player, Role, ROLE_NAMES, ROLE_COLORS } from '@/types/game';
import { cn } from '@/lib/utils';
import { User, Target, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface PlayerTileProps {
  player: Player;
  isCurrentUser: boolean;
  canSelect?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  showPrivateRole?: boolean;
  mediaStream?: MediaStream;
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  timerText?: string | null;
}

const getRoleEmoji = (role: Role | null): string => {
  switch (role) {
    case 'badshah': return '👑';
    case 'vizier': return '🎭';
    case 'qazi': return '⚖️';
    case 'chor': return '🥷';
    default: return '❓';
  }
};

const PlayerTile: React.FC<PlayerTileProps> = ({
  player,
  isCurrentUser,
  canSelect = false,
  isSelected = false,
  onSelect,
  showPrivateRole = false,
  mediaStream,
  onToggleAudio,
  onToggleVideo,
  isAudioEnabled,
  isVideoEnabled,
  timerText,
}) => {
  const displayRole = player.revealed ? player.publicRole : (showPrivateRole ? player.privateRole : null);
  const displayName = player.displayName?.trim() || 'Player';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (!mediaStream) {
      videoRef.current.srcObject = null;
      setStreamError(null);
      return;
    }

    videoRef.current.srcObject = mediaStream;
    videoRef.current.muted = isCurrentUser;
    setStreamError(null);
    const playPromise = videoRef.current.play();
    if (playPromise instanceof Promise) {
      playPromise.catch((err) => {
        console.warn("Video autoplay blocked", err);
        setStreamError("Tap to allow video playback");
      });
    }
  }, [mediaStream, isCurrentUser, isVideoEnabled]);

  const initials = player.displayName
    ? player.displayName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : displayName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
  
  return (
    <div
      onClick={canSelect ? onSelect : undefined}
      className={cn(
        "relative w-full max-w-[360px] sm:max-w-[380px] md:max-w-[420px]",
        "aspect-[2/3] md:aspect-[3/2] rounded-2xl overflow-hidden transition-all duration-300",
        "flex flex-col items-center justify-center p-4 mx-auto",
        "gradient-card shadow-card border-2",
        isCurrentUser && "ring-2 ring-primary ring-offset-2",
        canSelect && "cursor-pointer hover:scale-[1.02] hover:shadow-glow",
        isSelected && "ring-4 ring-secondary ring-offset-2 scale-[1.02]",
        player.revealed && displayRole && ROLE_COLORS[displayRole],
        !player.revealed && "border-border/50"
      )}
    >
      {/* Video / Avatar */}
      <div className="absolute inset-0 bg-muted/20 z-0">
        {mediaStream && (!isCurrentUser || isVideoEnabled !== false) ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/40">
            <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border border-border/50 flex items-center justify-center overflow-hidden">
              {player.avatar ? (
                <img 
                  src={player.avatar} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : initials ? (
                <span className="text-xl font-semibold text-foreground/80">{initials}</span>
              ) : (
                <User className="w-8 h-8" />
              )}
            </div>
            <p className="text-xs opacity-60">
              {streamError ? streamError : (isCurrentUser && isVideoEnabled === false ? 'Video off' : 'Waiting for video / avatar')}
            </p>
          </div>
        )}
      </div>

      {timerText && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <span className="px-3 py-1 rounded-full bg-background/90 backdrop-blur text-xs font-semibold border border-border/60 shadow-soft">
            {timerText}
          </span>
        </div>
      )}

      {/* Self controls */}
      {isCurrentUser && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVideo?.();
            }}
            className={cn(
              "w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border/60 shadow-soft flex items-center justify-center transition",
              isVideoEnabled === false && "bg-red-100 text-red-600 border-red-200"
            )}
            aria-label={isVideoEnabled === false ? "Turn video on" : "Turn video off"}
          >
            {isVideoEnabled === false ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAudio?.();
            }}
            className={cn(
              "w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border/60 shadow-soft flex items-center justify-center transition",
              isAudioEnabled === false && "bg-red-100 text-red-600 border-red-200"
            )}
            aria-label={isAudioEnabled === false ? "Unmute microphone" : "Mute microphone"}
          >
            {isAudioEnabled === false ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Role card overlay (when revealed or showing private) */}
      {displayRole && (
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center z-10",
          "bg-gradient-to-br from-background/90 to-background/70 backdrop-blur-sm",
          "animate-scale-in"
        )}>
          <span className="text-6xl mb-2 animate-float">{getRoleEmoji(displayRole)}</span>
          <span className="text-xl font-bold">{ROLE_NAMES[displayRole]}</span>
          {displayRole && (
            <span className="text-sm text-muted-foreground mt-1">
              {displayRole === 'badshah' && '+100 pts'}
              {displayRole === 'vizier' && '+50 pts'}
              {displayRole === 'qazi' && '+25 pts'}
              {displayRole === 'chor' && '+0 pts'}
            </span>
          )}
        </div>
      )}

      {/* Name badge */}
      <div className={cn(
        "absolute bottom-3 left-3 right-3",
        "bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2",
        "flex items-center justify-between shadow-soft border border-border/50"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {isCurrentUser && (
            <span className="shrink-0 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
              You
            </span>
          )}
          <span className="font-semibold truncate text-sm">
            {displayName}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-sm font-bold text-primary">{player.score}</span>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-secondary flex items-center justify-center shadow-lg animate-scale-in">
          <Target className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}

      {/* Private role peek (only for current user when not revealed) */}
      {isCurrentUser && showPrivateRole && !player.revealed && player.privateRole && (
        <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-soft border border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getRoleEmoji(player.privateRole)}</span>
            <span className="text-xs font-semibold">Your role</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerTile;
