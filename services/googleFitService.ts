import { User, DailyMetric } from "../types";
import { upsertDailyMetric, upsertUser } from "./firebaseService";
import { format } from "date-fns";

declare global {
  interface Window {
    google: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/fitness.activity.read";

let tokenClient: any;
let gapiLoaded = false;
let gisLoaded = false;

// 1. Load Google Scripts
export const loadGoogleScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.body.appendChild(script);
  });
};

// 2. Initialize Token Client
export const initTokenClient = (callback: (response: any) => void) => {
  if (!window.google) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: callback,
  });
};

// 3. Trigger Auth Flow
export const requestGoogleAuth = () => {
  if (tokenClient) {
    // Prompt the user to select an account and consent only if no valid token
    tokenClient.requestAccessToken();
  } else {
    console.error("Token client not initialized");
  }
};

// 4. Fetch Steps from Google Fit API
export const fetchTodaySteps = async (accessToken: string): Promise<number> => {
  const now = new Date();
  const startTime = new Date(now);
  startTime.setHours(0, 0, 0, 0);
  const endTime = new Date(now);

  const startMillis = startTime.getTime();
  const endMillis = endTime.getTime();

  const url = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

  const body = {
    aggregateBy: [
      {
        dataTypeName: "com.google.step_count.delta",
        dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
      },
    ],
    bucketByTime: { durationMillis: 86400000 }, // 1 day in ms
    startTimeMillis: startMillis,
    endTimeMillis: endMillis,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Fit API Error:", errorText);
      throw new Error("Failed to fetch steps");
    }

    const data = await response.json();
    // Parse response
    // bucket[0].dataset[0].point[0].value[0].intVal
    let steps = 0;
    if (data.bucket && data.bucket.length > 0) {
      const bucket = data.bucket[0];
      if (bucket.dataset && bucket.dataset.length > 0) {
        const point = bucket.dataset[0].point;
        if (point && point.length > 0) {
            steps = point.reduce((acc: number, p: any) => {
                const val = p.value?.[0]?.intVal || 0;
                return acc + val;
            }, 0);
        }
      }
    }
    return steps;

  } catch (error) {
    console.error("Error fetching steps:", error);
    throw error;
  }
};

// 5. Orchestrator: Sync Steps (Call this from UI)
export const syncSteps = async (user: User): Promise<number | null> => {
  // If we had a stored token, we could use it. But Implicit flow requires validation/refresh often via interaction
  // or checking validity. For simplicity in this client-side MVP, we assume we might need to prompt
  // OR we rely on the caller to have obtained a token via requestGoogleAuth if needed.

  // However, `requestAccessToken` can skip prompt if authorized previously?
  // Actually, implicit flow tokens expire. We usually need to request again.
  // We'll expose `requestGoogleAuth` to UI. The callback there should call `fetchTodaySteps`.
  // Wait, `syncSteps` implies a one-shot function.
  // Refactor: We can't return the result synchronously from `requestGoogleAuth`.
  return null;
};

// Improved Flow for React integration:
// 1. Component mounts -> loads script -> inits client.
// 2. User clicks "Connect/Sync" -> calls `requestGoogleAuth`.
// 3. Callback receives token -> calls `handleAuthSuccess`.
// 4. `handleAuthSuccess` calls `fetchTodaySteps` -> `storeDailySteps`.

export const handleAuthSuccess = async (tokenResponse: any, user: User) => {
  if (tokenResponse && tokenResponse.access_token) {
    const steps = await fetchTodaySteps(tokenResponse.access_token);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const metric: DailyMetric = {
      date: todayStr,
      steps: steps,
      source: 'google-fit',
      lastUpdated: Date.now()
    };

    await upsertDailyMetric(user.id, metric);

    // Update User Profile with connection status
    const updatedUser: User = {
        ...user,
        connectedApps: {
            ...user.connectedApps,
            googleFit: {
                connected: true,
                lastSync: Date.now()
            }
        }
    };
    await upsertUser(updatedUser);

    return steps;
  }
  return null;
};
