
export enum GameStep {
  START = 'START',
  STATE = 'STATE',
  SENSATIONS = 'SENSATIONS',
  TRIGGERS = 'TRIGGERS',
  ROLES = 'ROLES',
  FEAR = 'FEAR',
  EMOTION = 'EMOTION',
  REGULATION = 'REGULATION',
  INTEGRATION = 'INTEGRATION',
  END = 'END'
}

export type SessionTier = 'free' | 'paid';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isQuestion?: boolean;
}

export interface UserSession {
  id: string;
  messages: Message[];
  currentStep: GameStep;
  lastUpdated: Date;
  isComplete: boolean;
  tier: SessionTier;
}

export interface CheckIn {
  id: string;
  timestamp: Date;
  emotion: string;
}

export interface ResetUsage {
  id: string;
  timestamp: Date;
  resetType: string;
  emotionBefore: string;
}

export interface JourneyDay {
  dayNumber: number;
  title: string;
  focus: string;
  resetType: string;
  reflectionPrompt: string;
}

export interface Journey {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  days: JourneyDay[];
}

export interface UserJourney {
  journeyId: string;
  startDate: Date;
  completedDays: number[];
  isComplete: boolean;
}

export interface User {
  name: string;
  email: string;
  phone: string;
  password?: string;
  isVerified: boolean;
  sessions: UserSession[];
  checkIns: CheckIn[];
  resetUsage: ResetUsage[];
  activeJourney?: UserJourney;
  journeyHistory: UserJourney[];
}

export type AppView = 'LANDING' | 'AUTH' | 'VERIFY' | 'DASHBOARD' | 'CHAT' | 'REVIEW' | 'JOURNEY';

export interface GameState {
  currentStep: GameStep;
  messages: Message[];
  isThinking: boolean;
}
