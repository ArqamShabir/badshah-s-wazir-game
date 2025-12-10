import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Crown, Theater, Scale, UserX } from 'lucide-react';

const RulesModal: React.FC = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="glass" 
          size="icon" 
          className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg"
        >
          <HelpCircle className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Crown className="w-6 h-6 text-primary" />
            How to Play
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Roles section */}
          <div>
            <h3 className="font-bold text-lg mb-3">The Roles</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-2xl">👑</span>
                <div>
                  <p className="font-semibold text-badshah">Badshah (King)</p>
                  <p className="text-sm text-muted-foreground">+100 points. Reveals first to start the game.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-2xl">🎭</span>
                <div>
                  <p className="font-semibold text-vizier">Vizier (Minister)</p>
                  <p className="text-sm text-muted-foreground">+50 points. Must identify the Chor!</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-2xl">⚖️</span>
                <div>
                  <p className="font-semibold text-accent">Qazi (Judge)</p>
                  <p className="text-sm text-muted-foreground">+25 points. Safe from accusations.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                <span className="text-2xl">🥷</span>
                <div>
                  <p className="font-semibold text-chor">Chor (Thief)</p>
                  <p className="text-sm text-muted-foreground">+0 points (or steals 50 if Vizier guesses wrong!)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Game flow */}
          <div>
            <h3 className="font-bold text-lg mb-3">Game Flow</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full gradient-royal text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <span>Host deals hidden roles to all 4 players</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full gradient-royal text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <span>Badshah reveals themselves first</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full gradient-royal text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <span>Vizier reveals and must guess who the Chor is</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full gradient-royal text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                <span>All roles are revealed and scores are calculated</span>
              </li>
            </ol>
          </div>

          {/* Scoring */}
          <div>
            <h3 className="font-bold text-lg mb-3">Scoring</h3>
            <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-2">
              <p><strong>If Vizier guesses correctly:</strong></p>
              <ul className="list-disc list-inside text-muted-foreground ml-2">
                <li>Vizier gets 50 points</li>
                <li>Chor gets 0 points</li>
              </ul>
              <p className="mt-2"><strong>If Vizier guesses wrong:</strong></p>
              <ul className="list-disc list-inside text-muted-foreground ml-2">
                <li>Chor steals 50 points!</li>
                <li>Vizier gets 0 points</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RulesModal;
