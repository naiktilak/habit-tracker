import { GoogleGenAI } from "@google/genai";
import { Habit, Log, User, HabitStatus } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateHabitInsights = async (
  user: User,
  habits: Habit[],
  timeframe: 'weekly' | 'monthly'
): Promise<string> => {
  const client = getClient();
  if (!client) return "AI Insights unavailable (Missing API Key).";

  // Prepare context
  const habitSummary = habits.map(h => {
    const totalLogs = Object.values(h.logs).length;
    const completed = Object.values(h.logs).filter(l => l.status === HabitStatus.DONE).length;
    return `- Habit: ${h.title} (${h.frequency}). Completed: ${completed}/${totalLogs} recorded days.`;
  }).join('\n');

  const prompt = `
    You are an expert habit coach. Analyze the following habit data for user ${user.name} for the ${timeframe} view.
    
    Data:
    ${habitSummary}
    
    Provide 3 brief, motivating bullet points. 
    1. Highlight a success.
    2. Point out an area for improvement.
    3. Give a short actionable tip for consistency.
    Keep the tone friendly and encouraging.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Keep pushing! You're doing great.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate insights at this moment. Stay consistent!";
  }
};
