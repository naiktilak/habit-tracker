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

// 5. Disconnect Google Fit
export const disconnectGoogleFit = async (user: User) => {
    const updatedUser: User = {
        ...user,
        connectedApps: {
            ...user.connectedApps,
            googleFit: {
                ...user.connectedApps?.googleFit,
                connected: false,
                // We keep the lastSync time or maybe reset it?
                // Requirement says "keep history", lastSync refers to connection status usually.
                // But let's just mark connected: false.
                lastSync: user.connectedApps?.googleFit?.lastSync || 0
            }
        }
    };
    await upsertUser(updatedUser);

    // Revoke token if possible (Best Effort)
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        // There isn't a direct "revoke" in the implicit client object easily accessible without the token.
        // If we had the token we could call google.accounts.oauth2.revoke(token, done).
        // Since we don't persist the token, we rely on the app state.
        // Future improvement: Store short-lived token in memory and revoke if present.
    }
};

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
    // Ensure we merge with existing connectedApps to avoid overwriting other potential apps
    const updatedUser: User = {
        ...user,
        connectedApps: {
            ...(user.connectedApps || {}),
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
