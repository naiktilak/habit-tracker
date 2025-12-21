import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { User, Group, Habit, ChatMessage, Notification, GroupJoinRequest, Achievement } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// --- WRITE OPERATIONS ---

// User
export const upsertUser = async (user: User) => {
  const userRef = doc(db, "users", user.id);
  // Merge true to avoid overwriting if exists, but for profile update we might want to overwrite fields
  await setDoc(userRef, user, { merge: true });
};

// Group
export const createGroup = async (group: Group) => {
  const groupRef = doc(db, "groups", group.id);
  await setDoc(groupRef, group);
};

export const updateGroup = async (groupId: string, data: Partial<Group>) => {
  const groupRef = doc(db, "groups", groupId);
  await updateDoc(groupRef, data);
};

// Habit
export const createHabit = async (habit: Habit) => {
  const habitRef = doc(db, "habits", habit.id);
  await setDoc(habitRef, habit);
};

export const updateHabit = async (habitId: string, data: Partial<Habit>) => {
  const habitRef = doc(db, "habits", habitId);
  await updateDoc(habitRef, data);
};

export const deleteHabit = async (habitId: string) => {
  const habitRef = doc(db, "habits", habitId);
  await deleteDoc(habitRef);
};

// Message
export const createMessage = async (message: ChatMessage) => {
  const msgRef = doc(db, "messages", message.id);
  await setDoc(msgRef, message);
};

// Notification
export const createNotification = async (notification: Notification) => {
  const notifRef = doc(db, "notifications", notification.id);
  await setDoc(notifRef, notification);
};

export const createNotificationsBatch = async (notifications: Notification[]) => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
        const ref = doc(db, "notifications", n.id);
        batch.set(ref, n);
    });
    await batch.commit();
}

// Join Requests
export const createJoinRequest = async (request: GroupJoinRequest) => {
  const reqRef = doc(db, "groupJoinRequests", request.id);
  await setDoc(reqRef, request);
};

export const createJoinRequestsBatch = async (requests: GroupJoinRequest[]) => {
    const batch = writeBatch(db);
    requests.forEach(r => {
        const ref = doc(db, "groupJoinRequests", r.id);
        batch.set(ref, r);
    });
    await batch.commit();
}

export const updateJoinRequest = async (requestId: string, data: Partial<GroupJoinRequest>) => {
  const reqRef = doc(db, "groupJoinRequests", requestId);
  await updateDoc(reqRef, data);
};

export const updateNotification = async (notifId: string, data: Partial<Notification>) => {
  const notifRef = doc(db, "notifications", notifId);
  await updateDoc(notifRef, data);
};

export const markNotificationsReadBatch = async (userId: string, notificationIds: string[]) => {
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
        const ref = doc(db, "notifications", id);
        batch.update(ref, { read: true });
    });
    await batch.commit();
}

// Achievements
export const createAchievement = async (achievement: Achievement) => {
  const achRef = doc(db, "achievements", achievement.id);
  await setDoc(achRef, achievement);
};

export const createAchievementsBatch = async (achievements: Achievement[]) => {
  const batch = writeBatch(db);
  achievements.forEach(a => {
      const ref = doc(db, "achievements", a.id);
      batch.set(ref, a);
  });
  await batch.commit();
};
