import React from 'react';
import { Player, Role, ROLE_NAMES, ROLE_COLORS } from '@/types/game';
import { cn } from '@/lib/utils';
import { Crown, Eye, EyeOff, User, Target } from 'lucide-react';

interface PlayerTileProps {
  player: Player;
  isCurrentUser: boolean;
  canSelect?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  showPrivateRole?: boolean;
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
}) => {
  const displayRole = player.revealed ? player.publicRole : (showPrivateRole ? player.privateRole : null);
  
  return (
    <div
      onClick={canSelect ? onSelect : undefined}
      className={cn(
        "relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden transition-all duration-300",
        "flex flex-col items-center justify-center p-4",
        "gradient-card shadow-card border-2",
        isCurrentUser && "ring-2 ring-primary ring-offset-2",
        canSelect && "cursor-pointer hover:scale-[1.02] hover:shadow-glow",
        isSelected && "ring-4 ring-secondary ring-offset-2 scale-[1.02]",
        player.revealed && displayRole && ROLE_COLORS[displayRole],
        !player.revealed && "border-border/50"
      )}
    >
      {/* Video placeholder */}
      <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-muted flex items-center justify-center">
            {player.avatar ? (
              <img 
                src={player.avatar} 
                alt={player.displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8" />
            )}
          </div>
          <p className="text-xs opacity-60">Live video</p>
        </div>
      </div>

      {/* Role card overlay (when revealed or showing private) */}
      {displayRole && (
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
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
            {player.displayName}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-sm font-bold text-primary">{player.score}</span>
          {player.revealed ? (
            <Eye className="w-4 h-4 text-accent" />
          ) : (
            <EyeOff className="w-4 h-4 text-muted-foreground" />
          )}
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
