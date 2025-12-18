# HabitSync - Collaborative Habit Tracker

HabitSync is a React-based habit tracking application that allows users to log daily activities, join groups, and view analytics.

## 🚀 Features

- **Daily & Weekly Habits:** Track simple tasks or interval-based activities.
- **Group Collaboration:** Create groups, invite friends, and compete on leaderboards.
- **Visual Analytics:** View completion rates and weekly trends using Recharts.
- **AI Insights:** Integrated with Google Gemini API for personalized habit coaching.
- **Responsive Design:** Works seamlessly on mobile and desktop.

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS (via CDN), Lucide Icons
- **Logic:** Date-fns for time management
- **AI:** Google GenAI SDK
- **Build Tool:** Vite

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/habitsync.git
   cd habitsync
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   - Create a `.env` file in the root directory.
   - You can copy the example file:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and add your Google Gemini API key:
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

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
4. Add the `GEMINI_API_KEY` in the deployment Environment Variables settings.
5. Deploy!
