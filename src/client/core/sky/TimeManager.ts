export interface TimeConfig {
  timeScale: number; // Not used in synchronized mode
  startTime: number; // Not used in synchronized mode - overridden by real-world time
  pauseTime: boolean; // Whether time is paused
  cycleDuration: number; // Not used in synchronized mode
}

/**
 * TimeManager with real-world time synchronization
 * 
 * Game time is calculated as: (currentMinute % 15) / 15
 * This ensures all players see the same time of day:
 * - Minutes 0-14: 0.0-0.93 (0-14/15)
 * - Minutes 15-29: 0.0-0.93 (0-14/15) 
 * - Minutes 30-44: 0.0-0.93 (0-14/15)
 * - Minutes 45-59: 0.0-0.93 (0-14/15)
 * 
 * This creates a 15-minute day/night cycle that repeats every hour
 */

export class TimeManager {
  private config: TimeConfig;
  private currentTime: number;
  private lastUpdateTime: number;
  private isPaused: boolean;

  constructor(config: Partial<TimeConfig> = {}) {
    this.config = {
      timeScale: 1, // Not used in synchronized mode
      startTime: 0.5, // Will be overridden by real-world time
      pauseTime: false,
      cycleDuration: 900, // 15 minutes for full cycle (not used in sync mode)
      ...config,
    };

    // Initialize with real-world time
    const now = new Date();
    const currentMinute = now.getMinutes();
    this.currentTime = (currentMinute % 15) / 15; // 0-1 based on 15-minute cycle
    
    this.lastUpdateTime = Date.now();
    this.isPaused = this.config.pauseTime;
  }

  public update(): number {
    if (this.isPaused) {
      return this.currentTime;
    }

    // Use real-world time to calculate synchronized game time
    // This ensures all players see the same time of day
    const now = new Date();
    const currentMinute = now.getMinutes();
    const gameTime = (currentMinute % 15) / 15; // 0-1 based on 15-minute cycle
    
    this.currentTime = gameTime;
    return this.currentTime;
  }

  public getTimeOfDay(): number {
    return this.currentTime;
  }

  public getTimeString(): string {
    const hours = Math.floor(this.currentTime * 24);
    const minutes = Math.floor((this.currentTime * 24 * 60) % 60);
    const seconds = Math.floor((this.currentTime * 24 * 60 * 60) % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  public getTimeOfDayName(): string {
    if (this.currentTime < 0.05 || this.currentTime > 0.95) return 'Midnight';
    if (this.currentTime < 0.15) return 'Dawn';
    if (this.currentTime < 0.25) return 'Early Morning';
    if (this.currentTime < 0.35) return 'Morning';
    if (this.currentTime < 0.45) return 'Late Morning';
    if (this.currentTime < 0.55) return 'Noon';
    if (this.currentTime < 0.65) return 'Afternoon';
    if (this.currentTime < 0.75) return 'Late Afternoon';
    if (this.currentTime < 0.85) return 'Evening';
    if (this.currentTime < 0.95) return 'Sunset';
    return 'Night';
  }

  public setTimeOfDay(time: number): void {
    this.currentTime = Math.max(0, Math.min(1, time));
  }

  public setTimeScale(scale: number): void {
    this.config.timeScale = Math.max(0.1, scale);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.lastUpdateTime = Date.now();
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  public isTimePaused(): boolean {
    return this.isPaused;
  }

  public getConfig(): TimeConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
