import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Crown, Users, Sparkles } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen gradient-sunny flex flex-col items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-primary/20 blur-2xl animate-float" />
      <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-secondary/20 blur-2xl animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 right-1/4 w-16 h-16 rounded-full bg-accent/20 blur-2xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 text-center max-w-md mx-auto">
        {/* Logo/Title */}
        <div className="mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full gradient-royal shadow-glow mb-6">
            <Crown className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-2">
            Badshah ka Wazir
          </h1>
          <p className="text-lg text-muted-foreground">
            The Royal Party Game
          </p>
        </div>

        {/* Game preview cards */}
        <div className="flex justify-center gap-3 mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {['👑', '🎭', '⚖️', '🥷'].map((emoji, i) => (
            <div 
              key={i}
              className="w-14 h-20 rounded-lg gradient-card shadow-card flex items-center justify-center text-2xl border border-border/50 animate-float"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              {emoji}
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="space-y-3 mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 text-left bg-card/60 backdrop-blur-sm rounded-xl p-3 shadow-soft">
            <div className="w-10 h-10 rounded-full gradient-royal flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">4-Player Party Game</p>
              <p className="text-sm text-muted-foreground">Play with friends in real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-left bg-card/60 backdrop-blur-sm rounded-xl p-3 shadow-soft">
            <div className="w-10 h-10 rounded-full gradient-magenta flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Hidden Roles & Deduction</p>
              <p className="text-sm text-muted-foreground">Who is the Chor? Find out!</p>
            </div>
          </div>
        </div>

        {/* Login button */}
        <Button 
          onClick={handleLogin}
          disabled={loading}
          size="xl"
          className="w-full animate-slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </Button>

        <p className="mt-6 text-sm text-muted-foreground animate-slide-up" style={{ animationDelay: '0.4s' }}>
          Create or join a room to start playing!
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
