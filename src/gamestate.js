/**
 * gamestate.js
 * Tracks game mode, status, and current level; pure data — no Three.js dependency.
 */

export const GameMode = {
  VS_AI:        'vs-ai',
  VS_TWO_AI:    'vs-two-ai',
  VS_MULTI_AI:  'vs-multi-ai',   // player vs 4 AI enemies simultaneously
  LOCAL_VERSUS: 'local-versus',
};

export const GameStatus = {
  MENU:      'menu',
  PLAYING:   'playing',
  PAUSED:    'paused',
  GAME_OVER: 'game-over',
};

export class GameState {
  constructor() {
    this.mode              = GameMode.VS_AI;
    this.status            = GameStatus.MENU;
    this.winner            = null;
    this.currentLevelIndex = 0;
    this.score             = 0;
    this.difficulty        = 'medium'; // 'easy' | 'medium' | 'hard'
  }

  addWin()  { this.score += 10; }
  addLoss() { this.score = Math.max(0, this.score - 5); }
  setDifficulty(d) { this.difficulty = d; }

  start(mode, levelIndex = 0) {
    this.mode              = mode;
    this.status            = GameStatus.PLAYING;
    this.winner            = null;
    this.currentLevelIndex = levelIndex;
  }

  pause()  { this.status = GameStatus.PAUSED;    }
  resume() { this.status = GameStatus.PLAYING;   }
  toMenu() { this.status = GameStatus.MENU;       }

  endGame(winnerName) {
    this.status = GameStatus.GAME_OVER;
    this.winner = winnerName;
  }

  nextLevel() {
    this.currentLevelIndex = (this.currentLevelIndex + 1) % 3;
    return this.currentLevelIndex;
  }

  /** True when in a mode that uses simultaneous multiple AI enemies. */
  get isMultiAI() {
    return this.mode === GameMode.VS_MULTI_AI;
  }

  setLevel(index) {
    this.currentLevelIndex = Math.max(0, Math.min(2, index));
  }

  get isPlaying() { return this.status === GameStatus.PLAYING;  }
  get isPaused()  { return this.status === GameStatus.PAUSED;   }
  get isOver()    { return this.status === GameStatus.GAME_OVER; }
}
