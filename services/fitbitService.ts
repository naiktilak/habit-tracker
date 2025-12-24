import { User, DailyMetric } from '../types';
import { upsertUser, upsertDailyMetric, getDailyMetric } from './firebaseService';
import { format } from 'date-fns';

const CLIENT_ID = import.meta.env.VITE_FITBIT_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_FITBIT_REDIRECT_URI;
const AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const API_BASE = 'https://api.fitbit.com/1';

// We store the access token in localStorage for this simple MVP flow.
// In a real app, we'd manage expiry and refresh via backend or handle it more robustly.
const STORAGE_KEY_TOKEN = 'fitbit_access_token';
const STORAGE_KEY_EXPIRES = 'fitbit_token_expires_at';

export const getAuthUrl = () => {
    if (!CLIENT_ID || !REDIRECT_URI) {
        console.error("Fitbit Client ID or Redirect URI not configured.");
        return '#';
    }
    const params = new URLSearchParams({
        response_type: 'token',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'activity', // We only need step data
        expires_in: '31536000', // Request long-lived token (1 year) if possible, though Implicit usually limits to 1 day/week.
                                // Fitbit Implicit defaults to 1 day unless 'expires_in' is set.
                                // 2592000 = 30 days is common max for Implicit. 31536000 is 1 year.
                                // Let's try for a longer duration for UX, but typically Implicit is short-lived.
    });
    return `${AUTH_URL}?${params.toString()}`;
};

export const handleAuthCallback = async (hash: string, currentUser: User): Promise<boolean> => {
    const params = new URLSearchParams(hash.replace('#', '?')); // Parse hash as query params
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const userId = params.get('user_id'); // Fitbit user ID

    if (accessToken && currentUser) {
        const expiresAt = Date.now() + (parseInt(expiresIn || '86400') * 1000);
        localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
        localStorage.setItem(STORAGE_KEY_EXPIRES, expiresAt.toString());

        // Update User Profile
        await upsertUser({
            ...currentUser,
            connectedApps: {
                ...currentUser.connectedApps,
                fitbit: {
                    connected: true,
                    lastSync: Date.now()
                }
            }
        });
        return true;
    }
    return false;
};

export const isConnected = (): boolean => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const expiresAt = localStorage.getItem(STORAGE_KEY_EXPIRES);

    if (!token || !expiresAt) return false;
    return Date.now() < parseInt(expiresAt);
};

export const disconnectFitbit = async (currentUser: User) => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_EXPIRES);

    // Revoke token ideally, but client-side implicit revocation is just forgetting it.

    await upsertUser({
        ...currentUser,
        connectedApps: {
            ...currentUser.connectedApps,
            fitbit: {
                connected: false,
                lastSync: 0
            }
        }
    });
};

export const fetchTodaySteps = async (currentUser: User): Promise<number | null> => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!isConnected() || !token) {
        // If configured as connected in Firestore but local token missing/expired, mark disconnected?
        // Or just return null and let the UI show "reconnect needed" (implied by lack of sync).
        return null;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
        const response = await fetch(`${API_BASE}/user/-/activities/date/${todayStr}.json`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired
                await disconnectFitbit(currentUser);
            }
            throw new Error(`Fitbit API error: ${response.statusText}`);
        }

        const data = await response.json();
        // Fitbit response structure: { "summary": { "steps": 1234, ... }, "activities": [...] }
        const steps = data.summary?.steps || 0;

        // Persist to Daily Metrics
        // Note: The caller (App.tsx) handles logic on whether to overwrite existing data from other sources.
        // But here we can enforce "Source Priority" logic if we want, OR we assume this function is only called
        // when we WANT to sync Fitbit.

        // We will read the existing metric first to check if we should update.
        // Requirement: "If both Google Fit and Fitbit... iOS -> Prefer Fitbit".
        // BUT, this function is specific to "Fetch Fitbit Steps". It should just fetch and return.
        // It SHOULD verify/update Firestore though, as per requirements ("Write to Firestore").

        const metric: DailyMetric = {
            date: todayStr,
            steps: steps,
            source: 'fitbit',
            lastUpdated: Date.now()
        };

        // We'll upsert here. The App.tsx will decide *which* service to call.
        // If this is called, we assume we want to write.
        await upsertDailyMetric(currentUser.id, metric);

        // Update Last Sync timestamp
         await upsertUser({
            ...currentUser,
            connectedApps: {
                ...currentUser.connectedApps,
                fitbit: {
                    connected: true,
                    lastSync: Date.now()
                }
            }
        });

        return steps;

    } catch (error) {
        console.error("Error fetching Fitbit steps:", error);
        return null;
    }
};
