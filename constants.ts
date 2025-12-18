import { User, Group, Habit, HabitFrequency, HabitStatus, ChatMessage, Notification } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Arjun', mobile: '+919876543210', avatar: 'https://picsum.photos/seed/u1/100/100' },
  { id: 'u2', name: 'Priya', email: 'priya@example.com', avatar: 'https://picsum.photos/seed/u2/100/100' },
  { id: 'u3', name: 'Rohan', mobile: '+919988776655', avatar: 'https://picsum.photos/seed/u3/100/100' },
];

export const MOCK_GROUPS: Group[] = [
  { id: 'g1', name: 'Fitness Freaks', members: ['u1', 'u2', 'u3'], admins: ['u1'], inviteCode: 'FIT2024' },
  { id: 'g2', name: 'Book Club', members: ['u1', 'u2'], admins: ['u1'], inviteCode: 'READJS' },
];

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const MOCK_HABITS: Habit[] = [
  {
    id: 'h1',
    userId: 'u1',
    groupId: 'g1',
    title: 'Morning Jog',
    frequency: HabitFrequency.DAILY,
    durationMinutes: 30,
    logs: {
      [today]: { date: today, status: HabitStatus.DONE, timestamp: Date.now() },
      [yesterday]: { date: yesterday, status: HabitStatus.NOT_DONE, timestamp: Date.now() - 86400000 },
    },
    createdAt: Date.now() - 100000000
  },
  {
    id: 'h2',
    userId: 'u2',
    groupId: 'g1',
    title: 'Yoga',
    frequency: HabitFrequency.DAILY,
    durationMinutes: 45,
    logs: {
      [today]: { date: today, status: HabitStatus.DONE, timestamp: Date.now() }
    },
    createdAt: Date.now() - 100000000
  },
  {
    id: 'h3',
    userId: 'u1',
    groupId: undefined, // Personal
    title: 'Learn React',
    frequency: HabitFrequency.WEEKLY,
    targetDaysPerWeek: 5,
    logs: {},
    createdAt: Date.now() - 50000000
  }
];

export const MOCK_MESSAGES: ChatMessage[] = [
  { id: 'm1', groupId: 'g1', userId: 'u2', text: 'Did everyone finish their walk?', timestamp: Date.now() - 3600000 },
  { id: 'm2', groupId: 'g1', userId: 'u1', text: 'Yes! It was exhausting.', timestamp: Date.now() - 1800000 },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', userId: 'u1', message: 'Priya completed "Yoga"', read: false, timestamp: Date.now(), type: 'success' }
];

export const MOTIVATIONAL_QUOTES = [
  "The secret of getting ahead is getting started. – Mark Twain",
  "It does not matter how slowly you go as long as you do not stop. – Confucius",
  "Motivation is what gets you started. Habit is what keeps you going. – Jim Ryun",
  "Success is the sum of small efforts, repeated day in and day out. – Robert Collier",
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit. – Aristotle",
  "You’ll never change your life until you change something you do daily. – John C. Maxwell",
  "Discipline is choosing between what you want now and what you want most. – Abraham Lincoln",
  "Don't watch the clock; do what it does. Keep going. – Sam Levenson",
  "The only way to do great work is to love what you do. – Steve Jobs",
  "Your future is created by what you do today, not tomorrow. – Robert Kiyosaki"
];
