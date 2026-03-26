/**
 * gamestate.js
 * Tracks game mode and status; pure data — no Three.js dependency.
 */

export const GameMode = {
  VS_AI:         'vs-ai',
  LOCAL_VERSUS:  'local-versus',
};

export const GameStatus = {
  MENU:      'menu',
  PLAYING:   'playing',
  PAUSED:    'paused',
  GAME_OVER: 'game-over',
};

export class GameState {
  constructor() {
    this.mode   = GameMode.VS_AI;
    this.status = GameStatus.MENU;
    this.winner = null;
  }

  start(mode) {
    this.mode   = mode;
    this.status = GameStatus.PLAYING;
    this.winner = null;
  }

  pause()  { this.status = GameStatus.PAUSED;    }
  resume() { this.status = GameStatus.PLAYING;   }
  toMenu() { this.status = GameStatus.MENU;       }

  endGame(winnerName) {
    this.status = GameStatus.GAME_OVER;
    this.winner = winnerName;
  }

  get isPlaying() { return this.status === GameStatus.PLAYING;  }
  get isPaused()  { return this.status === GameStatus.PAUSED;   }
  get isOver()    { return this.status === GameStatus.GAME_OVER; }
}
