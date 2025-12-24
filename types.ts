
export enum HabitFrequency {
  DAILY = 'Daily',
  WEEKLY = 'Weekly',
  INTERVAL = 'Interval',
  SPECIFIC_DAYS = 'Specific Days'
}

export enum HabitStatus {
  DONE = 'DONE',
  NOT_DONE = 'NOT_DONE',
  PENDING = 'PENDING'
}

export interface User {
  id: string;
  name: string;
  email?: string;
  mobile?: string; // +91 format
  avatar: string;
  dailyReminderTime?: string; // HH:mm format, e.g. "09:00"
  connectedApps?: {
    googleFit?: {
      connected: boolean;
      lastSync: number;
    };
  };
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  steps: number;
  source: 'google-fit' | 'manual';
  lastUpdated: number;
}

export interface Log {
  date: string; // ISO Date string YYYY-MM-DD
  status: HabitStatus;
  notes?: string;
  timestamp: number;
}

export interface Habit {
  id: string;
  userId: string;
  groupId?: string; // If null, it's a personal habit
  title: string;
  description?: string;
  frequency: HabitFrequency;
  durationMinutes?: number;
  targetDaysPerWeek?: number; // For weekly frequency
  intervalDays?: number; // For Interval frequency (e.g. every 2 days)
  logs: Record<string, Log>; // Key is YYYY-MM-DD
  completed?: boolean; // If true, the habit is marked as finished/archived
  createdAt: number;
  autoTracking?: {
    type: 'STEPS';
    targetValue: number;
  };
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  text: string;
  timestamp: number;
}

export interface Group {
  id: string;
  name: string;
  members: string[]; // User IDs
  admins: string[]; // User IDs of admins
  inviteCode: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  timestamp: number;
  type: 'info' | 'alert' | 'success';
}

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface GroupJoinRequest {
  id: string;
  groupId: string;
  groupName: string;
  requestedByUserId: string; // The person who sent the invite
  requestedUserId: string;   // The person being invited
  status: JoinRequestStatus;
  createdAt: number;
}

export interface Achievement {
  id: string;
  userId: string;
  habitId: string;
  habitName: string;
  milestone: 11 | 21 | 31;
  badgeType: 'BRONZE' | 'SILVER' | 'GOLD';
  earnedAt: number;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  groups: Group[];
  habits: Habit[];
  messages: ChatMessage[];
  notifications: Notification[];
}
