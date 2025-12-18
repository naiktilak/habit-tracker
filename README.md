# HabitSync - Collaborative Habit Tracker

HabitSync is a React-based habit tracking application that allows users to log daily activities, join groups, and view analytics.

## 🚀 Features

- **Daily & Weekly Habits:** Track simple tasks or interval-based activities.
- **Group Collaboration:** Create groups, invite friends, and compete on leaderboards.
- **Visual Analytics:** View completion rates and weekly trends using Recharts.
- **AI Insights:** Integrated with Google Gemini API for personalized habit coaching.
- **Responsive Design:** Works seamlessly on mobile and desktop.

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS, Lucide Icons
- **Logic:** Date-fns for time management
- **AI:** Google GenAI SDK

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/habitsync.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your Google Gemini API key:
   ```
   API_KEY=your_gemini_api_key_here
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## ⚠️ Important Note on Data Persistence

Currently, this application uses **LocalStorage** for data persistence. This means:
- Data is stored in the browser of the device you are using.
- Data **does not sync** between different devices or users.
- To test the "Group" features, you must simulate multiple users in the same browser (or Incognito window) on the same computer.

To make this app truly collaborative across different devices, a backend service (like Firebase, Supabase, or a Node.js server) needs to be integrated.

## 🌐 Deployment

This app is ready to be deployed on **Vercel** or **Netlify**.

1. Push your code to GitHub.
2. Login to Vercel/Netlify.
3. Import the repository.
4. Add the `API_KEY` in the deployment Environment Variables settings.
5. Deploy!
