import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRoom } from '@/hooks/useRoom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Users, Plus, LogIn, LogOut, Copy, Check, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LobbyScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { createRoom, joinRoom, fillBotsToCapacity } = useRoom(null);
  const { toast } = useToast();
  
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingWithBots, setIsCreatingWithBots] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const displayName = useMemo(() => {
    if (user?.displayName?.trim()) return user.displayName.trim();
    if (user?.email?.trim()) return user.email.trim().split('@')[0];
    return 'Player';
  }, [user?.displayName, user?.email]);

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.photoURL]);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const roomCode = await createRoom();
      setCreatedCode(roomCode);
      toast({
        title: 'Room Created!',
        description: `Share code: ${roomCode}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateRoomWithBots = async () => {
    setIsCreatingWithBots(true);
    try {
      const roomCode = await createRoom();
      setCreatedCode(roomCode);
      toast({
        title: 'Room Created!',
        description: `Filling with bots...`,
      });
      await fillBotsToCapacity(roomCode);
      toast({
        title: 'Room ready vs bots',
        description: `Share code: ${roomCode}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingWithBots(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    try {
      await joinRoom(joinCode.toUpperCase());
      navigate(`/room/${joinCode.toUpperCase()}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterRoom = () => {
    if (createdCode) {
      navigate(`/room/${createdCode}`);
    }
  };

  return (
    <div className="min-h-screen gradient-sunny flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gradient-royal flex items-center justify-center shadow-soft">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">Badshah ka Wazir</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-primary shadow-soft overflow-hidden bg-card flex items-center justify-center">
            {user?.photoURL && !avatarFailed ? (
              <img 
                src={user.photoURL} 
                alt={displayName} 
                className="w-full h-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : initials ? (
              <span className="text-xs font-semibold text-foreground/80">{initials}</span>
            ) : (
              <User className="w-4 h-4 text-foreground/70" />
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-slide-up">
          {/* Welcome message */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome, {displayName.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground">
              Create a room or join with a code
            </p>
          </div>

          {/* Create Room Card */}
          <Card className="shadow-card border-border/50 overflow-hidden">
            <CardHeader className="gradient-royal pb-4">
              <CardTitle className="flex items-center gap-2 text-primary-foreground">
                <Plus className="w-5 h-5" />
                Create New Room
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {createdCode ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Your room code:</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold tracking-widest text-primary">
                        {createdCode}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleCopyCode}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-accent" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleEnterRoom} className="w-full" size="lg">
                    <Users className="w-5 h-5 mr-2" />
                    Enter Room
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleCreateRoom} 
                    disabled={isCreating}
                    className="w-full sm:flex-1 min-w-0 text-sm sm:text-base"
                    size="lg"
                  >
                    {isCreating ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Create Room
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCreateRoomWithBots}
                    disabled={isCreatingWithBots}
                    className="w-full sm:flex-1 min-w-0 text-sm sm:text-base"
                    size="lg"
                    variant="secondary"
                  >
                    {isCreatingWithBots ? (
                      <div className="w-5 h-5 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <Users className="w-5 h-5 mr-2" />
                        Vs Bots
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Join Room Card */}
          <Card className="shadow-card border-border/50 overflow-hidden">
            <CardHeader className="gradient-magenta pb-4">
              <CardTitle className="flex items-center gap-2 text-secondary-foreground">
                <LogIn className="w-5 h-5" />
                Join Existing Room
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Input
                placeholder="Enter 6-letter code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-2xl tracking-widest font-bold uppercase h-14"
                maxLength={6}
              />
              <Button 
                onClick={handleJoinRoom} 
                disabled={isJoining || joinCode.length !== 6}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Join Room
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LobbyScreen;
