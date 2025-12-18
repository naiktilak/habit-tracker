import { MOCK_USERS, MOCK_GROUPS, MOCK_HABITS, MOCK_MESSAGES, MOCK_NOTIFICATIONS } from '../constants';
import { AppState, Group } from '../types';

const KEY = 'habitsync_db_v1';

export const getStoredData = (): AppState => {
  try {
    const str = localStorage.getItem(KEY);
    if (str) {
        const data = JSON.parse(str);
        
        // Data Migration: Ensure groups have admins
        const migratedGroups = (data.groups || MOCK_GROUPS).map((g: Group) => ({
            ...g,
            admins: g.admins || (g.members.length > 0 ? [g.members[0]] : [])
        }));

        return {
            currentUser: null, // Session specific, don't load from DB
            users: data.users || MOCK_USERS,
            groups: migratedGroups,
            habits: data.habits || MOCK_HABITS,
            messages: data.messages || MOCK_MESSAGES,
            notifications: data.notifications || MOCK_NOTIFICATIONS
        };
    }
  } catch (e) {
    console.error("Error loading data", e);
  }
  
  // Initialize with mocks if empty
  const initialData: AppState = {
    currentUser: null,
    users: MOCK_USERS,
    groups: MOCK_GROUPS,
    habits: MOCK_HABITS,
    messages: MOCK_MESSAGES,
    notifications: MOCK_NOTIFICATIONS
  };
  saveData(initialData);
  return initialData;
};

export const saveData = (data: Partial<AppState>) => {
  try {
    const current = getStoredData();
    // Merge new data with current DB state
    const newData = {
        ...current,
        ...data,
        currentUser: null // Never save session user to DB
    };
    localStorage.setItem(KEY, JSON.stringify(newData));
  } catch (e) {
    console.error("Error saving data", e);
  }
};