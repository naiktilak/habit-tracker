import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameDay, subMonths, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getISOWeek, differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import ExcelJS from 'exceljs';
import { generateHabitInsights } from './services/geminiService';
import { getStoredData, saveData } from './services/storage';
import { User, Group, Habit, HabitStatus, HabitFrequency, ChatMessage, Notification } from './types';
import { MOTIVATIONAL_QUOTES } from './constants';
import { Icons } from './components/Icons';
import { Button, Input, Card, Modal } from './components/UI';
import { useAuth } from "./AuthContext";
import FirebaseLogin from "./FirebaseLogin";

// --- MAIN APP ---

const App: React.FC = () => {
    const { user, loading, logout } = useAuth();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [showDemoBanner, setShowDemoBanner] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
    const [welcomeQuote, setWelcomeQuote] = useState('');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editProfileName, setEditProfileName] = useState('');
    const [editProfileAvatar, setEditProfileAvatar] = useState('');
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [createGroupEmailInput, setCreateGroupEmailInput] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isManageGroupModalOpen, setIsManageGroupModalOpen] = useState(false);


    const [currentView, setCurrentView] = useState<
        'dashboard' | 'personal' | 'group' | 'notifications'
    >('dashboard');

    useEffect(() => {
        const db = getStoredData();
        setUsers(db.users);
        setGroups(db.groups);
        setHabits(db.habits);
        setMessages(db.messages);
        setNotifications(db.notifications);
    }, []);

    if (loading) {
        return <div className="p-6">Checking login...</div>;
    }

    if (!user) {
        return <FirebaseLogin />;
    }

    const currentUser: User = {
        id: user.uid,
        name: user.displayName || "User",
        email: user.email || undefined,
        mobile: undefined,
        avatar:
            user.photoURL ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
    };



        const handleLogout = async () => {
            await logout();
            setActiveGroupId(null);
        };


        const handleUpdateProfile = (e: React.FormEvent) => {
          e.preventDefault();
          if (!currentUser) return;

          const updatedUser = { ...currentUser, name: editProfileName, avatar: editProfileAvatar };
          const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);

          setUsers(updatedUsers);
          saveData({ users: updatedUsers });
          setIsProfileModalOpen(false);
      };

      const openProfileModal = () => {
          if (!currentUser) return;
          setEditProfileName(currentUser.name);
          setEditProfileAvatar(currentUser.avatar);
          setIsProfileModalOpen(true);
      };

      const randomizeAvatar = () => {
          setEditProfileAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`);
      };

      const ensureUserByEmail = (email: string): User => {
          // Check if user exists, if not create them
          const existingUser = users.find(u => u.email === email);
          if (existingUser) return existingUser;

          const newUser: User = {
              id: `u${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: email.split('@')[0],
              email: email,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
          };
          const updatedUsers = [...users, newUser];
          setUsers(updatedUsers);
          saveData({ users: updatedUsers });
          return newUser;
      };

      const toggleHabitStatus = (habitId: string, dateStr: string) => {
        if (!currentUser) return;

        const habitToUpdate = habits.find(h => h.id === habitId);
        if (habitToUpdate?.completed) return; // Cannot edit logs of completed habits

        const updatedHabits = habits.map(h => {
          if (h.id !== habitId) return h;

          const currentStatus = h.logs[dateStr]?.status;
          let newStatus = HabitStatus.DONE;
          if (currentStatus === HabitStatus.DONE) newStatus = HabitStatus.NOT_DONE;
          else if (currentStatus === HabitStatus.NOT_DONE) newStatus = HabitStatus.PENDING; // remove log

          const newLogs = { ...h.logs };

          if (newStatus === HabitStatus.PENDING) {
            delete newLogs[dateStr];
          } else {
            newLogs[dateStr] = {
              date: dateStr,
              status: newStatus,
              timestamp: Date.now()
            };
          }
          return { ...h, logs: newLogs };
        });

        setHabits(updatedHabits);

        // Prepare notifications
        let updatedNotifications = [...notifications];
        const changedHabit = updatedHabits.find(h => h.id === habitId);

        // If marked DONE and it's a group habit, notify others
        if (changedHabit?.logs[dateStr]?.status === HabitStatus.DONE && changedHabit.groupId) {
            const group = groups.find(g => g.id === changedHabit.groupId);
            if (group) {
                // Notify all members except self
                const membersToNotify = group.members.filter(mId => mId !== currentUser.id);
                const newNotifs = membersToNotify.map(mId => ({
                    id: `n${Date.now()}-${mId}`,
                    userId: mId,
                    message: `${currentUser.name} completed "${changedHabit.title}" in ${group.name}!`,
                    read: false,
                    timestamp: Date.now(),
                    type: 'success' as const
                }));
                updatedNotifications = [...newNotifs, ...updatedNotifications];
                setNotifications(updatedNotifications);
            }
        }

        // Persist ALL changes
        saveData({ habits: updatedHabits, notifications: updatedNotifications });
      };

      const toggleHabitCompletion = (habitId: string) => {
          const updatedHabits = habits.map(h => {
              if (h.id === habitId) {
                  return { ...h, completed: !h.completed };
              }
              return h;
          });
          setHabits(updatedHabits);
          saveData({ habits: updatedHabits });
      };

      const addNewHabit = (habitData: Partial<Habit>) => {
        if (!currentUser) return;
        const newHabit: Habit = {
            id: `h${Date.now()}`,
            userId: currentUser.id,
            title: habitData.title || 'New Habit',
            frequency: habitData.frequency || HabitFrequency.DAILY,
            durationMinutes: habitData.durationMinutes,
            targetDaysPerWeek: habitData.targetDaysPerWeek,
            intervalDays: habitData.intervalDays,
            groupId: habitData.groupId,
            logs: {},
            completed: false,
            createdAt: Date.now()
        };
        const updatedHabits = [...habits, newHabit];
        setHabits(updatedHabits);
        saveData({ habits: updatedHabits });
      };

      const sendMessage = (text: string) => {
        if (!currentUser || !activeGroupId) return;
        const newMsg: ChatMessage = {
          id: `m${Date.now()}`,
          groupId: activeGroupId,
          userId: currentUser.id,
          text,
          timestamp: Date.now()
        };
        const updatedMessages = [...messages, newMsg];
        setMessages(updatedMessages);
        saveData({ messages: updatedMessages });
      };

      const handleCreateGroup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !newGroupName.trim()) return;

        const newGroup: Group = {
          id: `g${Date.now()}`,
          name: newGroupName,
          members: [currentUser.id, ...selectedFriendIds],
          admins: [currentUser.id], // Creator is admin
          inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase()
        };

        const updatedGroups = [...groups, newGroup];
        setGroups(updatedGroups);
        saveData({ groups: updatedGroups });

        setIsCreateGroupModalOpen(false);
        setNewGroupName('');
        setSelectedFriendIds([]);
        setCreateGroupEmailInput('');
        setActiveGroupId(newGroup.id);
        setCurrentView('group');
        setShowMobileMenu(false);
      };

      const handleAddEmailToCreateGroup = () => {
          if (!createGroupEmailInput.trim() || !createGroupEmailInput.includes('@')) return;
          const user = ensureUserByEmail(createGroupEmailInput.trim());
          if (!selectedFriendIds.includes(user.id)) {
              setSelectedFriendIds([...selectedFriendIds, user.id]);
          }
          setCreateGroupEmailInput('');
      };

      const handleInviteMember = (e: React.FormEvent) => {
          e.preventDefault();
          if (!activeGroupId || !inviteEmail.trim() || !inviteEmail.includes('@')) return;

          const user = ensureUserByEmail(inviteEmail.trim());

          const updatedGroups = groups.map(g => {
              if (g.id === activeGroupId) {
                  if (g.members.includes(user.id)) return g;
                  return { ...g, members: [...g.members, user.id] };
              }
              return g;
          });

          setGroups(updatedGroups);
          saveData({ groups: updatedGroups });
          setIsInviteModalOpen(false);
          setInviteEmail('');
          alert(`${user.name} added to the group! They can now login with ${user.email} to see the group.`);
      };

      const handlePromoteAdmin = (userId: string) => {
        if (!activeGroupId) return;
        const updatedGroups = groups.map(g => {
            if (g.id === activeGroupId) {
                if (g.admins && !g.admins.includes(userId)) {
                    return { ...g, admins: [...(g.admins || []), userId] };
                }
            }
            return g;
        });
        setGroups(updatedGroups);
        saveData({ groups: updatedGroups });
      };

      const handleDemoteAdmin = (userId: string) => {
        if (!activeGroupId) return;
        const updatedGroups = groups.map(g => {
            if (g.id === activeGroupId) {
                if (g.admins && g.admins.includes(userId)) {
                    // Ensure at least one admin remains
                    if (g.admins.length > 1) {
                       return { ...g, admins: g.admins.filter(id => id !== userId) };
                    } else {
                       alert("Group must have at least one admin. Promote someone else first.");
                    }
                }
            }
            return g;
        });
        setGroups(updatedGroups);
        saveData({ groups: updatedGroups });
      };

      const handleRemoveMember = (userId: string) => {
        if (!activeGroupId || !window.confirm("Are you sure you want to remove this member?")) return;

        // Check if member is the last admin
        const group = groups.find(g => g.id === activeGroupId);
        if (group?.admins.includes(userId) && group.admins.length === 1) {
            alert("Cannot remove the only admin of the group. Promote someone else first.");
            return;
        }

        const updatedGroups = groups.map(g => {
            if (g.id === activeGroupId) {
                return {
                    ...g,
                    members: g.members.filter(m => m !== userId),
                    admins: (g.admins || []).filter(a => a !== userId)
                };
            }
            return g;
        });
        setGroups(updatedGroups);
        saveData({ groups: updatedGroups });
      };

      const markNotificationsRead = () => {
        if (!currentUser) return;
        const updatedNotifications = notifications.map(n =>
            n.userId === currentUser.id ? { ...n, read: true } : n
        );
        setNotifications(updatedNotifications);
        saveData({ notifications: updatedNotifications });
      };

      const getAIAnalysis = async () => {
        if (!currentUser) return;

        const relevantHabits = activeGroupId
            ? habits.filter(h => h.groupId === activeGroupId && h.userId === currentUser.id)
            : habits.filter(h => h.userId === currentUser.id && !h.groupId);

        const insight = await generateHabitInsights(currentUser, relevantHabits, 'weekly');


      };

      const toggleFriendSelection = (userId: string) => {
        setSelectedFriendIds(prev =>
          prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
      };

      // --- VIEWS ---


      // --- MAIN LAYOUT ---

      const activeGroup = groups.find(g => g.id === activeGroupId);
      const unreadCount = notifications.filter(n => n.userId === currentUser?.id && !n.read).length;

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">

          <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-full flex flex-col">
              <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                  <Icons.Activity className="w-6 h-6" />
                  HabitSync
                </h1>
                <button onClick={() => setShowMobileMenu(false)} className="md:hidden text-gray-500">
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <NavItem
                  icon={<Icons.BarChart2 className="w-5 h-5" />}
                  label="Dashboard"
                  isActive={currentView === 'dashboard'}
                  onClick={() => { setCurrentView('dashboard'); setActiveGroupId(null); setShowMobileMenu(false); }}
                />
                <NavItem
                  icon={<Icons.User className="w-5 h-5" />}
                  label="Personal Space"
                  isActive={currentView === 'personal'}
                  onClick={() => { setCurrentView('personal'); setActiveGroupId(null); setShowMobileMenu(false); }}
                />
                <NavItem
                    icon={
                        <div className="relative">
                            <Icons.Bell className="w-5 h-5" />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>}
                        </div>
                    }
                    label="Notifications"
                    isActive={currentView === 'notifications'}
                    onClick={() => { setCurrentView('notifications'); setActiveGroupId(null); setShowMobileMenu(false); markNotificationsRead(); }}
                />

                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Groups</p>
                </div>
                {groups.filter(g => g.members.includes(currentUser?.id || '')).map(group => (
                  <NavItem
                    key={group.id}
                    icon={<Icons.Users className="w-5 h-5" />}
                    label={group.name}
                    isActive={currentView === 'group' && activeGroupId === group.id}
                    onClick={() => { setCurrentView('group'); setActiveGroupId(group.id); setShowMobileMenu(false); }}
                  />
                ))}
                <button
                  onClick={() => setIsCreateGroupModalOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors border border-dashed border-gray-300 mt-2"
                >
                  <Icons.Plus className="w-5 h-5" /> Create Group
                </button>
              </nav>

              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                      <img src={currentUser?.avatar} alt="Profile" className="w-10 h-10 rounded-full bg-gray-200" />
                      <button
                        onClick={openProfileModal}
                        className="absolute -bottom-1 -right-1 bg-white border border-gray-200 rounded-full p-0.5 text-gray-500 hover:text-indigo-600"
                        title="Edit Profile"
                      >
                          <Icons.Edit className="w-3 h-3" />
                      </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser?.mobile || currentUser?.email}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium">
                  <Icons.LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </aside>


          <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

            <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                 <button onClick={() => setShowMobileMenu(true)} className="md:hidden text-gray-600">
                  <Icons.Menu className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-semibold text-gray-800">
                  {currentView === 'dashboard' && 'Overview'}
                  {currentView === 'personal' && 'Personal Habits'}
                  {currentView === 'notifications' && 'Notifications'}
                  {currentView === 'group' && activeGroup?.name}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <button
                    onClick={() => { setCurrentView('notifications'); markNotificationsRead(); }}
                    className="text-gray-500 hover:text-indigo-600 relative"
                >
                     <Icons.Bell className="w-6 h-6" />
                     {unreadCount > 0 && (
                       <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                     )}
                </button>
              </div>
            </header>


            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
                {currentView === 'dashboard' && (
                    <DashboardView
                        user={currentUser!}
                        habits={habits}
                        groups={groups}
                        notifications={notifications}
                    />
                )}
                 {currentView === 'notifications' && (
                    <NotificationsView
                        notifications={notifications}
                        user={currentUser!}
                    />
                )}
                {(currentView === 'personal' || currentView === 'group') && (
                    <HabitTrackerView
                        key={activeGroupId || 'personal'}
                        isGroup={currentView === 'group'}
                        activeGroupId={activeGroupId}
                        habits={habits}
                        setHabits={setHabits} // Pass setter for adding habits
                        users={users}
                        groups={groups}
                        currentUser={currentUser!}

                        onToggleStatus={toggleHabitStatus}
                        onToggleCompletion={toggleHabitCompletion}
                        onAddHabit={addNewHabit}
                        onGetAI={getAIAnalysis}

                        messages={messages}
                        onSendMessage={sendMessage}
                        onOpenInvite={() => setIsInviteModalOpen(true)}
                        onOpenManageGroup={() => setIsManageGroupModalOpen(true)}
                    />
                )}
            </div>
          </main>


          <Modal isOpen={isWelcomeModalOpen} onClose={() => setIsWelcomeModalOpen(false)} title="Daily Inspiration">
            <div className="text-center py-6">
                <div className="mb-4">
                    <Icons.BrainCircuit className="w-12 h-12 text-indigo-500 mx-auto opacity-80" />
                </div>
                <p className="text-xl font-medium text-gray-800 italic mb-2">"{welcomeQuote.split('–')[0].trim()}"</p>
                {welcomeQuote.includes('–') && (
                    <p className="text-sm text-gray-500 mt-2">— {welcomeQuote.split('–')[1].trim()}</p>
                )}
                <div className="mt-8">
                    <Button onClick={() => setIsWelcomeModalOpen(false)} className="w-full">Let's do this!</Button>
                </div>
            </div>
          </Modal>


          <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Edit Profile">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="flex flex-col items-center mb-4">
                      <div className="relative group cursor-pointer" onClick={randomizeAvatar}>
                        <img src={editProfileAvatar} className="w-20 h-20 rounded-full bg-gray-100 mb-2" />
                        <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Icons.RefreshCw className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">Click avatar to randomize</span>
                  </div>
                  <Input
                      label="Display Name"
                      value={editProfileName}
                      onChange={e => setEditProfileName(e.target.value)}
                      required
                  />
                  <Input
                      label="Avatar URL (Optional)"
                      value={editProfileAvatar}
                      onChange={e => setEditProfileAvatar(e.target.value)}
                  />
                  <div className="flex gap-3 pt-2">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsProfileModalOpen(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Save Profile</Button>
                  </div>
              </form>
          </Modal>


          <Modal isOpen={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)} title="Create New Group">
              <form onSubmit={handleCreateGroup} className="space-y-4">
                  <Input
                      label="Group Name"
                      placeholder="e.g., Early Risers"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      required
                  />

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Add Friends</label>


                      <div className="flex gap-2 mb-3">
                          <input
                            type="email"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Invite via email (e.g. john@gmail.com)"
                            value={createGroupEmailInput}
                            onChange={e => setCreateGroupEmailInput(e.target.value)}
                          />
                          <Button type="button" variant="secondary" className="py-1 px-3 text-sm" onClick={handleAddEmailToCreateGroup}>
                              Add
                          </Button>
                      </div>

                      <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
                          {users.filter(u => u.id !== currentUser?.id).map(u => (
                              <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer" onClick={() => toggleFriendSelection(u.id)}>
                                  <div className="flex items-center gap-2">
                                      <img src={u.avatar} className="w-8 h-8 rounded-full" />
                                      <div className="flex flex-col">
                                          <span className="text-sm font-medium text-gray-700">{u.name}</span>
                                          {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                                      </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedFriendIds.includes(u.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                      {selectedFriendIds.includes(u.id) && <Icons.Check className="w-3 h-3 text-white" />}
                                  </div>
                              </div>
                          ))}
                          {users.filter(u => u.id !== currentUser?.id).length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-2">No other users found. Add by email above.</p>
                          )}
                      </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsCreateGroupModalOpen(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Create Group</Button>
                  </div>
              </form>
          </Modal>


          <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Member to Group">
              <form onSubmit={handleInviteMember} className="space-y-4">
                  <p className="text-sm text-gray-600">Enter the email address of the person you want to invite to <strong>{activeGroup?.name}</strong>. If they don't have an account, one will be created for them to log in later.</p>
                  <Input
                      label="Email Address"
                      placeholder="e.g., friend@example.com"
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                  />
                  <div className="flex gap-3 pt-2">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1">Send Invite</Button>
                  </div>
              </form>
          </Modal>


          <Modal isOpen={isManageGroupModalOpen} onClose={() => setIsManageGroupModalOpen(false)} title={`Manage ${activeGroup?.name}`}>
              <div className="space-y-4">
                 <p className="text-sm text-gray-600 mb-2">Members of this group:</p>
                 <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activeGroup?.members.map(memberId => {
                        const member = users.find(u => u.id === memberId);
                        const isAdmin = activeGroup.admins?.includes(memberId);
                        const isMe = memberId === currentUser?.id;
                        const amIAdmin = activeGroup.admins?.includes(currentUser?.id || '');

                        if (!member) return null;

                        return (
                            <div key={memberId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <img src={member.avatar} className="w-10 h-10 rounded-full" />
                                     <div>
                                         <div className="flex items-center gap-1">
                                            <span className="font-medium text-gray-900">{member.name}</span>
                                            {isAdmin && (
                                                <span title="Admin">
                                                    <Icons.ShieldCheck className="w-4 h-4 text-indigo-600" />
                                                </span>
                                            )}
                                         </div>
                                         <div className="text-xs text-gray-500">{member.email || member.mobile}</div>
                                     </div>
                                 </div>
                                 {amIAdmin && !isMe && (
                                     <div className="flex gap-2">
                                         {!isAdmin ? (
                                             <Button
                                                variant="secondary"
                                                className="px-2 py-1 text-xs"
                                                onClick={() => handlePromoteAdmin(memberId)}
                                                title="Promote to Admin"
                                             >
                                                 <Icons.Shield className="w-4 h-4" />
                                             </Button>
                                         ) : (
                                             <Button
                                                variant="secondary"
                                                className="px-2 py-1 text-xs"
                                                onClick={() => handleDemoteAdmin(memberId)}
                                                title="Remove Admin"
                                             >
                                                 <Icons.ShieldOff className="w-4 h-4 text-gray-500" />
                                             </Button>
                                         )}
                                         <Button
                                            variant="danger"
                                            className="px-2 py-1 text-xs"
                                            onClick={() => handleRemoveMember(memberId)}
                                            title="Remove User"
                                        >
                                             <Icons.UserMinus className="w-4 h-4" />
                                         </Button>
                                     </div>
                                 )}
                            </div>
                        )
                    })}
                 </div>
                 <Button variant="secondary" className="w-full" onClick={() => setIsManageGroupModalOpen(false)}>Close</Button>
              </div>
          </Modal>

        </div>
      );
    };



// --- SUB-VIEWS ---

const AuthScreen: React.FC<{ onLogin: (id: string, type: 'email' | 'mobile') => void }> = ({ onLogin }) => {
  const [method, setMethod] = useState<'mobile' | 'email'>('mobile');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'mobile') {
        if (!input.startsWith('+91') || input.length !== 13) {
            setError('Please enter a valid Indian mobile number starting with +91');
            return;
        }
    } else {
        if (!input.includes('@')) {
            setError('Please enter a valid email');
            return;
        }
    }
    onLogin(input, method);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Activity className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome to HabitSync</h1>
            <p className="text-gray-500 mt-2">Track together, grow together.</p>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
                onClick={() => { setMethod('mobile'); setInput('+91'); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${method === 'mobile' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Mobile
            </button>
            <button
                onClick={() => { setMethod('email'); setInput(''); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${method === 'email' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Email
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {method === 'mobile' ? 'Mobile Number' : 'Email Address'}
              </label>
              <input
                type={method === 'mobile' ? 'tel' : 'email'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={method === 'mobile' ? '+91 98765 43210' : 'you@example.com'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full py-3 text-lg">
                Login / Sign Up
            </Button>
            <p className="text-center text-xs text-gray-400 mt-4">
                Note: Since this is a demo, your data is saved in your browser's local storage.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

const DashboardView: React.FC<{ user: User, habits: Habit[], groups: Group[], notifications: Notification[] }> = ({ user, habits, groups, notifications }) => {
    // ... existing dashboard code ...
    // Calculate global stats
    const totalLogs = habits.filter(h => h.userId === user.id).reduce((acc, h) => acc + Object.keys(h.logs).length, 0);
    const completedLogs = habits.filter(h => h.userId === user.id).reduce((acc, h) => acc + Object.values(h.logs).filter(l => l.status === HabitStatus.DONE).length, 0);
    const rate = totalLogs > 0 ? Math.round((completedLogs / totalLogs) * 100) : 0;
    const myNotifications = notifications.filter(n => n.userId === user.id || n.userId === 'ALL');

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
                    <h3 className="text-indigo-100 font-medium mb-1">Weekly Completion Rate</h3>
                    <div className="text-4xl font-bold mb-2">{rate}%</div>
                    <div className="text-sm text-indigo-100 flex items-center">
                        <Icons.Activity className="w-4 h-4 mr-1" />
                        All time stats
                    </div>
                </Card>
                <Card className="p-6">
                    <h3 className="text-gray-500 font-medium mb-1">Active Habits</h3>
                    <div className="text-4xl font-bold text-gray-800 mb-2">{habits.filter(h => h.userId === user.id).length}</div>
                    <div className="text-sm text-gray-400">Across {groups.length} groups + Personal</div>
                </Card>
                <Card className="p-6">
                    <h3 className="text-gray-500 font-medium mb-1">Total Completions</h3>
                    <div className="text-4xl font-bold text-gray-800 mb-2">{completedLogs}</div>
                    <div className="text-sm text-gray-400">Keep up the streak!</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
                    <div className="space-y-4">
                        {myNotifications.slice(0, 5).map(n => (
                            <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className={`mt-1 w-2 h-2 rounded-full ${n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                <div>
                                    <p className="text-sm text-gray-800">{n.message}</p>
                                    <p className="text-xs text-gray-500">{new Date(n.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                        {myNotifications.length === 0 && <p className="text-gray-400 text-center py-4">No recent activity.</p>}
                    </div>
                </Card>

                <Card className="p-6 flex flex-col items-center justify-center text-center">
                    <div className="bg-indigo-50 p-4 rounded-full mb-4">
                        <Icons.BrainCircuit className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">AI Insights</h3>
                    <p className="text-gray-500 mb-4">Get personalized analysis of your habit trends.</p>
                    <Button variant="secondary" onClick={() => alert("Go to a Group or Personal view to generate specific insights.")}>
                        Go to Tracker
                    </Button>
                </Card>
            </div>
        </div>
    );
};

const NotificationsView: React.FC<{ notifications: Notification[], user: User }> = ({ notifications, user }) => {
    // ... existing ...
    const myNotifications = notifications.filter(n => n.userId === user.id || n.userId === 'ALL').sort((a,b) => b.timestamp - a.timestamp);

    return (
        <Card className="max-w-3xl mx-auto p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Icons.Bell className="w-6 h-6 text-indigo-600" />
                Notifications
            </h2>
            <div className="space-y-2">
                {myNotifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-lg flex gap-4 ${n.read ? 'bg-white border border-gray-100' : 'bg-indigo-50 border border-indigo-100'}`}>
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        <div className="flex-1">
                            <p className={`text-sm ${n.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                ))}
                {myNotifications.length === 0 && (
                    <div className="text-center py-12">
                         <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Icons.Bell className="w-8 h-8 text-gray-400" />
                         </div>
                         <h3 className="text-gray-900 font-medium">No notifications yet</h3>
                         <p className="text-gray-500 text-sm mt-1">Activity from your groups will appear here.</p>
                    </div>
                )}
            </div>
        </Card>
    )
}

const HabitTrackerView: React.FC<{
    isGroup: boolean;
    activeGroupId: string | null;
    habits: Habit[];
    setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
    users: User[];
    groups: Group[];
    currentUser: User;
    selectedDate: Date;
    setSelectedDate: (d: Date) => void;
    onToggleStatus: (id: string, date: string) => void;
    onToggleCompletion: (id: string) => void;
    onAddHabit: (h: Partial<Habit>) => void;
    onGetAI: () => void;
    aiInsight: string | null;
    isAiLoading: boolean;
    setAiInsight: (s: string | null) => void;
    messages: ChatMessage[];
    onSendMessage: (t: string) => void;
    onOpenInvite?: () => void;
    onOpenManageGroup?: () => void;
}> = ({ isGroup, activeGroupId, habits, setHabits, users, groups, currentUser, selectedDate, setSelectedDate, onToggleStatus, onToggleCompletion, onAddHabit, onGetAI, aiInsight, isAiLoading, setAiInsight, messages, onSendMessage, onOpenInvite, onOpenManageGroup }) => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
    const [hideCompleted, setHideCompleted] = useState(true); // Default to hiding archived

    const [newHabitTitle, setNewHabitTitle] = useState('');
    const [newHabitFreq, setNewHabitFreq] = useState(HabitFrequency.DAILY);
    const [newHabitDuration, setNewHabitDuration] = useState('');
    const [newHabitTarget, setNewHabitTarget] = useState('1'); // Days per week
    const [newHabitInterval, setNewHabitInterval] = useState('2'); // Every X days

    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');

    // Filter Logic
    const relevantHabits = isGroup
        ? habits.filter(h => h.groupId === activeGroupId)
        : habits.filter(h => h.userId === currentUser.id && !h.groupId);

    // Group Logic
    const currentGroupObj = groups.find(g => g.id === activeGroupId);
    const activeMembers = isGroup && currentGroupObj
        ? currentGroupObj.members.map(mid => users.find(u => u.id === mid)).filter(u => u !== undefined) as User[]
        : [currentUser];

    // Admin Logic
    const isCurrentGroupAdmin = isGroup && currentGroupObj && (currentGroupObj.admins || []).includes(currentUser.id);

    // Date Logic
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

    // Monthly Logic
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Helper: Calculate Streak (Current consecutive days)
    const calculateStreak = (habit: Habit): number => {
        let streak = 0;
        const today = new Date();

        // Check if today is done (streak includes today if done)
        const todayStr = format(today, 'yyyy-MM-dd');
        const isTodayDone = habit.logs[todayStr]?.status === HabitStatus.DONE;

        if (isTodayDone) streak++;

        // Iterate backwards from yesterday
        let current = subDays(today, 1);
        while (true) {
            const dStr = format(current, 'yyyy-MM-dd');
            const status = habit.logs[dStr]?.status;

            // Only count explicit DONE statuses
            if (status === HabitStatus.DONE) {
                streak++;
                current = subDays(current, 1);
            } else {
                // Break on missed or pending days (strict streak)
                break;
            }
        }
        return streak;
    };

    // --- CHART DATA GENERATION ---
    const chartData = useMemo(() => {
        const data = [];
        const daysToMap = viewMode === 'weekly' ? weekDays : monthDays;

        for (const day of daysToMap) {
            const dStr = format(day, 'yyyy-MM-dd');
            // Personal progress calculation
            const myHabits = relevantHabits.filter(h => h.userId === currentUser.id);
            const total = myHabits.length;

            // Logic for "Completed":
            const completed = myHabits.filter(h => h.logs[dStr]?.status === HabitStatus.DONE).length;

            data.push({
                name: viewMode === 'weekly' ? format(day, 'EEE') : format(day, 'd'),
                completed,
                total
            });
        }
        return data;
    }, [relevantHabits, currentUser.id, weekDays, monthDays, viewMode]);

    // --- EXPORT LOGIC ---
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HabitSync';
        workbook.created = new Date();

        // --- SHEET 1: SUMMARY ---
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.columns = [
            { header: 'Member Name', key: 'name', width: 25 },
            { header: 'Total Score (%)', key: 'score', width: 20 },
            { header: 'Rank', key: 'rank', width: 10 }
        ];

        // Styling Header
        const summaryHeader = summarySheet.getRow(1);
        summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
        summaryHeader.alignment = { horizontal: 'center', vertical: 'middle' };
        summaryHeader.height = 25;

        // Add Data
        const summaryData = activeMembers.map(m => ({
            name: m.name,
            score: getGroupStats(m.id)
        })).sort((a, b) => b.score - a.score);

        summaryData.forEach((d, index) => {
            const row = summarySheet.addRow({ ...d, rank: index + 1 });

            // Zebra Striping for Summary
            if ((index + 1) % 2 === 0) {
                 row.eachCell(cell => {
                     cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; // Light gray
                 });
            }

            // Borders
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
                cell.alignment = { horizontal: 'center' };
            });
            // Left align name
            row.getCell(1).alignment = { horizontal: 'left' };
        });

        // --- SHEET 2: DETAILED LOG ---
        const detailSheet = workbook.addWorksheet('Detailed Log');
        const daysToMap = viewMode === 'weekly' ? weekDays : monthDays;

        // Define columns width
        detailSheet.columns = [
             { key: 'member', width: 20 },
             { key: 'habit', width: 25 },
             { key: 'freq', width: 25 },
             ...daysToMap.map(() => ({ width: 14 })), // increased width slightly
             { key: 'total', width: 10 }
        ];

        const headerValues = ['Member', 'Habit', 'Frequency Details', ...daysToMap.map(d => format(d, 'EEE, MMM dd')), 'Total'];

        let currentRow = 1;

        for (const member of activeMembers) {
             const memberHabits = relevantHabits.filter(h => h.userId === member.id);

             // Spacing from previous block
             if (currentRow > 1) currentRow++;

             // 1. User Header Row (Merged block for distinction)
             const userRow = detailSheet.getRow(currentRow);
             detailSheet.mergeCells(currentRow, 1, currentRow, headerValues.length);
             userRow.getCell(1).value = `User: ${member.name.toUpperCase()} (${member.email || member.mobile})`;
             userRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
             userRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600 background
             userRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
             userRow.height = 25;
             currentRow++;

             // 2. Column Header Row (Repeating columns as requested)
             const headerRow = detailSheet.getRow(currentRow);
             headerRow.values = headerValues;
             headerRow.font = { bold: true, color: { argb: 'FF374151' } }; // Gray-700
             headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }; // Gray-200
             headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
             headerRow.height = 30;
             // Apply borders to header
             headerRow.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                };
             });
             currentRow++;

             if (memberHabits.length === 0) {
                 const noDataRow = detailSheet.getRow(currentRow);
                 detailSheet.mergeCells(currentRow, 1, currentRow, headerValues.length);
                 noDataRow.getCell(1).value = "No habits found for this period.";
                 noDataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                 noDataRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
                 noDataRow.height = 25;
                 currentRow++;
                 continue;
             }

             // 3. Data Rows
             let localIndex = 0;
             memberHabits.forEach(habit => {
                let freqLabel = habit.frequency.toString();
                if (habit.frequency === HabitFrequency.WEEKLY) freqLabel = `Weekly (${habit.targetDaysPerWeek}/7)`;
                else if (habit.frequency === HabitFrequency.INTERVAL) freqLabel = `Every ${habit.intervalDays} Days`;
                if (habit.durationMinutes) freqLabel += ` - ${habit.durationMinutes}m`;

                const logStatuses = daysToMap.map(d => {
                    const dStr = format(d, 'yyyy-MM-dd');
                    const log = habit.logs[dStr];
                    if (log?.status === HabitStatus.DONE) return HabitStatus.DONE;
                    if (log?.status === HabitStatus.NOT_DONE) return HabitStatus.NOT_DONE;
                    return '';
                });

                const totalCount = logStatuses.filter(s => s === HabitStatus.DONE).length;

                const rowData = [
                    member.name,
                    habit.title,
                    freqLabel,
                    ...logStatuses.map(s => s === HabitStatus.DONE ? '✓' : s === HabitStatus.NOT_DONE ? '✗' : ''),
                    totalCount
                ];

                const row = detailSheet.getRow(currentRow);
                row.values = rowData;

                // Styling
                const rowBg = localIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'; // Alternating White / Gray-50

                row.eachCell((cell, colNum) => {
                     // Borders
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };

                    // Default Background
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };

                    // Alignment
                    if (colNum <= 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    else cell.alignment = { horizontal: 'center', vertical: 'middle' };

                    // Status Colors (Date columns are index 4 to 4+length-1)
                    if (colNum > 3 && colNum <= 3 + daysToMap.length) {
                         const status = logStatuses[colNum - 4];
                         if (status === HabitStatus.DONE) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Green
                            cell.font = { color: { argb: 'FF166534' }, bold: true };
                         } else if (status === HabitStatus.NOT_DONE) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Red
                            cell.font = { color: { argb: 'FF991B1B' }, bold: true };
                         }
                    }

                    // Total Column Bold
                    if (colNum === headerValues.length) {
                        cell.font = { bold: true };
                    }
                });

                currentRow++;
                localIndex++;
             });
        }

        // Write and Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HabitSync_Report_${viewMode}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // --- HELPER: CHECK IF ENABLED ---
    const isHabitActionable = (habit: Habit, date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // 1. Basic Future Check
        if (date > new Date()) return { enabled: false, reason: 'Future' };

        // 2. Frequency Checks
        if (habit.frequency === HabitFrequency.WEEKLY) {
            const target = habit.targetDaysPerWeek || 1;
            const startOfHabitWeek = startOfWeek(date, { weekStartsOn: 1 });
            const endOfHabitWeek = addDays(startOfHabitWeek, 6);

            // Count logs in this specific week
            let count = 0;
            let isDoneToday = false;

            for (let d = startOfHabitWeek; d <= endOfHabitWeek; d = addDays(d, 1)) {
                const ds = format(d, 'yyyy-MM-dd');
                if (habit.logs[ds]?.status === HabitStatus.DONE) {
                    count++;
                    if (ds === dateStr) isDoneToday = true;
                }
            }

            // If already done today, it's actionable (to undo).
            // If not done today, but target reached, disable.
            if (!isDoneToday && count >= target) {
                return { enabled: false, reason: 'Weekly target met' };
            }
        }
        else if (habit.frequency === HabitFrequency.INTERVAL) {
            const interval = habit.intervalDays || 2;
            const logDates = Object.keys(habit.logs).sort();

            // Find the last completed log before today
            // Interpretation: If there is a log within (interval - 1) days BEFORE this date, disable.

            const checkDate = new Date(dateStr);

            for (const logDateStr of logDates) {
                if (habit.logs[logDateStr].status !== HabitStatus.DONE) continue;
                if (logDateStr === dateStr) continue; // Ignore self (allows toggle off)

                const logDate = parseISO(logDateStr);
                const diff = Math.abs(differenceInCalendarDays(checkDate, logDate));

                if (diff < interval) {
                    return { enabled: false, reason: `Wait ${interval} days` };
                }
            }
        }

        return { enabled: true };
    };

    // --- HELPER: Calculate Group Stats ---
    const getGroupStats = (memberId: string) => {
        const memberHabits = relevantHabits.filter(h => h.userId === memberId);
        if (memberHabits.length === 0) return 0;

        let totalPoints = 0;
        let earnedPoints = 0;

        const daysToScore = viewMode === 'weekly' ? weekDays : monthDays;

        memberHabits.forEach(h => {
             if (h.frequency === HabitFrequency.WEEKLY) {
                 const expected = (daysToScore.length / 7) * (h.targetDaysPerWeek || 1);
                 const actual = Object.values(h.logs).filter(l => l.status === HabitStatus.DONE && daysToScore.find(d => format(d, 'yyyy-MM-dd') === l.date)).length;
                 totalPoints += Math.max(1, expected);
                 earnedPoints += Math.min(actual, expected);
             } else {
                 const expectedDivisor = h.frequency === HabitFrequency.INTERVAL ? (h.intervalDays || 1) : 1;
                 const expected = daysToScore.length / expectedDivisor;
                 const actual = Object.values(h.logs).filter(l => l.status === HabitStatus.DONE && daysToScore.find(d => format(d, 'yyyy-MM-dd') === l.date)).length;
                 totalPoints += expected;
                 earnedPoints += actual;
             }
        });

        return totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
    }

    const openAddModal = () => {
        setEditingHabit(null);
        setNewHabitTitle('');
        setNewHabitFreq(HabitFrequency.DAILY);
        setNewHabitDuration('');
        setNewHabitTarget('1');
        setNewHabitInterval('2');
        setIsModalOpen(true);
    };

    const handleEditClick = (habit: Habit) => {
        setEditingHabit(habit);
        setNewHabitTitle(habit.title);
        setNewHabitFreq(habit.frequency);
        setNewHabitDuration(habit.durationMinutes?.toString() || '');
        setNewHabitTarget(habit.targetDaysPerWeek?.toString() || '1');
        setNewHabitInterval(habit.intervalDays?.toString() || '2');
        setIsModalOpen(true);
    };

    const handleDeleteHabit = (habitId: string) => {
        if (!window.confirm("Are you sure you want to delete this habit? This cannot be undone.")) return;
        const updatedHabits = habits.filter(h => h.id !== habitId);
        setHabits(updatedHabits);
        saveData({ habits: updatedHabits });
        setIsModalOpen(false);
        setEditingHabit(null);
    };

    const handleArchiveHabit = (habitId: string) => {
         onToggleCompletion(habitId);
         setIsModalOpen(false); // Close modal after toggling
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const habitData: Partial<Habit> = {
            title: newHabitTitle,
            frequency: newHabitFreq,
            durationMinutes: parseInt(newHabitDuration) || 0,
            targetDaysPerWeek: parseInt(newHabitTarget) || 1,
            intervalDays: parseInt(newHabitInterval) || 2,
            groupId: isGroup ? activeGroupId! : undefined
        };

        if (editingHabit) {
            // Update Existing
            const updatedHabits = habits.map(h =>
                h.id === editingHabit.id ? { ...h, ...habitData } : h
            );
            setHabits(updatedHabits);
            saveData({ habits: updatedHabits });
        } else {
            // Create New
            onAddHabit(habitData);
        }

        setIsModalOpen(false);
        setEditingHabit(null);
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!chatInput.trim()) return;
        onSendMessage(chatInput);
        setChatInput('');
    }

    const currentGroupMessages = messages.filter(m => m.groupId === activeGroupId);

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedDate(addWeeks(selectedDate, -1))} className="p-1 hover:bg-gray-100 rounded">
                        <Icons.ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 px-2">
                        <Icons.Calendar className="w-5 h-5 text-gray-500" />
                        <span className="font-medium text-gray-900">
                            {format(selectedDate, 'MMMM yyyy')}
                            {viewMode === 'weekly' && ` - Week ${format(selectedDate, 'w')}`}
                        </span>
                    </div>
                    <button onClick={() => setSelectedDate(addWeeks(selectedDate, 1))} className="p-1 hover:bg-gray-100 rounded">
                        <Icons.ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex gap-2 flex-wrap md:flex-nowrap">
                    <div className="bg-gray-100 p-1 rounded-lg flex text-sm">
                        <button
                            className={`px-3 py-1 rounded-md transition-all ${viewMode === 'weekly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                            onClick={() => setViewMode('weekly')}
                        >Weekly</button>
                         <button
                            className={`px-3 py-1 rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                            onClick={() => setViewMode('monthly')}
                        >Monthly</button>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => setHideCompleted(!hideCompleted)}
                        className={`flex items-center gap-2 ${!hideCompleted ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : ''}`}
                        title={hideCompleted ? "Show archived habits" : "Hide archived habits"}
                    >
                         {hideCompleted ? <Icons.Archive className="w-4 h-4" /> : <Icons.ArchiveRestore className="w-4 h-4" />}
                         {hideCompleted ? 'Show Archived' : 'Hide Archived'}
                    </Button>

                    {isGroup && isCurrentGroupAdmin && (
                        <Button
                            variant="secondary"
                            onClick={handleExportExcel}
                            title="Export data to Excel"
                        >
                            <Icons.Download className="w-4 h-4 mr-2 inline" />
                            Export
                        </Button>
                    )}

                    {isGroup && (
                        <>
                        <Button variant="secondary" onClick={() => setChatOpen(!chatOpen)}>
                            <Icons.MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="secondary" onClick={onOpenInvite}>
                             <Icons.Plus className="w-4 h-4" />
                        </Button>
                        <Button variant="secondary" onClick={onOpenManageGroup} title="Group Members">
                            <Icons.Settings className="w-4 h-4" />
                        </Button>
                        </>
                    )}
                    <Button onClick={openAddModal}>
                        <Icons.Plus className="w-4 h-4 mr-2 inline" />
                        Habit
                    </Button>
                </div>
            </div>

            {/* Split View: Tracker & Analytics/Chat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COL: Habit Grid */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Group Leaderboard (Only in Group View) */}
                    {isGroup && (
                        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Group Leaderboard ({viewMode})</h3>
                            <div className="flex flex-wrap gap-4">
                                {activeMembers.map(m => {
                                    const score = getGroupStats(m.id);
                                    const isAdmin = currentGroupObj?.admins?.includes(m.id);
                                    return (
                                        <div key={m.id} className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                                            <div className="relative">
                                                <img src={m.avatar} className="w-10 h-10 rounded-full" />
                                                <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {score}%
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    {m.name}
                                                    {isAdmin && <Icons.ShieldCheck className="w-3 h-3 text-indigo-500" />}
                                                </p>
                                                <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${score}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Iterate per user in group, or just current user */}
                    {activeMembers.map(member => {
                         let memberHabits = relevantHabits.filter(h => h.userId === member?.id);
                         const isMe = member.id === currentUser.id;
                         const canEdit = isMe || isCurrentGroupAdmin;

                         // Determine habits to show based on archive toggle
                         let visibleHabits = memberHabits;
                         if (hideCompleted) {
                             visibleHabits = memberHabits.filter(h => !h.completed);
                         }

                         // Group into Active and Archived if we are showing archived
                         const activeHabits = visibleHabits.filter(h => !h.completed);
                         const archivedHabits = visibleHabits.filter(h => h.completed);

                         const habitSections = [
                             { title: 'Active Habits', habits: activeHabits },
                             ...( (!hideCompleted && archivedHabits.length > 0) ? [{ title: 'Archived Habits', habits: archivedHabits }] : [])
                         ];

                         if (visibleHabits.length === 0 && member.id !== currentUser.id) return null;

                         return (
                            <Card key={member?.id} className="p-6 overflow-x-auto">
                                <div className="flex items-center gap-3 mb-4 sticky left-0">
                                    <img src={member?.avatar} className="w-8 h-8 rounded-full" />
                                    <h3 className="font-bold text-gray-800">{member?.name}'s Habits</h3>
                                </div>
                                {visibleHabits.length === 0 ? (
                                    <p className="text-gray-400 italic text-sm">
                                        {hideCompleted ? "All archived habits hidden." : "No habits added yet."}
                                    </p>
                                ) : (
                                    <div className="space-y-6">
                                        {habitSections.map((section, idx) => (
                                            section.habits.length > 0 && (
                                            <div key={idx}>
                                                {habitSections.length > 1 && (
                                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sticky left-0">{section.title}</h4>
                                                )}
                                                <table className="w-full min-w-[600px]">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Activity</th>
                                                            {viewMode === 'weekly' ? weekDays.map(d => (
                                                                <th key={d.toString()} className="text-center py-2 px-1">
                                                                    <div className={`text-xs font-medium ${isSameDay(d, new Date()) ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>
                                                                        {format(d, 'EEE')}
                                                                    </div>
                                                                    <div className={`text-xs mt-1 ${isSameDay(d, new Date()) ? 'bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center mx-auto' : 'text-gray-400'}`}>
                                                                        {format(d, 'd')}
                                                                    </div>
                                                                </th>
                                                            )) : (
                                                                // Simplified monthly header
                                                                <th className="text-left text-xs font-medium text-gray-500 pl-4">Monthly Progress Summary</th>
                                                            )}
                                                            {viewMode === 'weekly' && <th className="text-center text-xs font-medium text-gray-500">Total</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {section.habits.map(habit => {
                                                            const streak = calculateStreak(habit);
                                                            return (
                                                            <tr key={habit.id} className={`group hover:bg-gray-50 transition-colors ${habit.completed ? 'opacity-50 grayscale' : ''}`}>
                                                                <td className="py-3 px-2">
                                                                    <div className="flex items-center justify-between group-hover:pr-2">
                                                                        <div>
                                                                            <div className={`font-medium flex items-center gap-2 ${habit.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                                                                {habit.title}
                                                                                {/* Streak Indicator */}
                                                                                {!habit.completed && streak > 0 && (
                                                                                    <div className="flex items-center text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full font-bold" title={`${streak} day streak`}>
                                                                                        <Icons.Flame className="w-3 h-3 mr-0.5 fill-orange-500" />
                                                                                        {streak}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                                                <span>
                                                                                    {habit.frequency === HabitFrequency.WEEKLY ? `${habit.targetDaysPerWeek}x/Wk` :
                                                                                    habit.frequency === HabitFrequency.INTERVAL ? `Every ${habit.intervalDays}d` :
                                                                                    habit.frequency}
                                                                                </span>
                                                                                {habit.durationMinutes && <span className="bg-gray-100 px-1 rounded">{habit.durationMinutes}m</span>}
                                                                            </div>
                                                                        </div>
                                                                        {canEdit && (
                                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    onClick={() => handleEditClick(habit)}
                                                                                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1 hover:bg-gray-100 rounded"
                                                                                    title="Edit Habit"
                                                                                >
                                                                                    <Icons.Edit className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {viewMode === 'weekly' ? weekDays.map(d => {
                                                                    const dStr = format(d, 'yyyy-MM-dd');
                                                                    const log = habit.logs[dStr];
                                                                    const isDone = log?.status === HabitStatus.DONE;
                                                                    const isMissed = log?.status === HabitStatus.NOT_DONE;

                                                                    const { enabled, reason } = isHabitActionable(habit, d);
                                                                    const isDisabled = (!enabled && !isDone && !isMissed) || habit.completed; // Allow unchecking if done or missed, but block if habit is completed

                                                                    return (
                                                                        <td key={dStr} className="text-center p-1">
                                                                            <button
                                                                                disabled={isDisabled || !isMe} // Strict check: only owner can toggle daily status
                                                                                onClick={() => onToggleStatus(habit.id, dStr)}
                                                                                title={isDisabled ? (habit.completed ? 'Habit is archived' : reason) : (!isMe ? 'Only owner can mark' : '')}
                                                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                                                    isDone ? 'bg-green-100 text-green-600 border border-green-200' : 
                                                                                    isMissed ? 'bg-red-100 text-red-600 border border-red-200' :
                                                                                    'bg-transparent hover:bg-gray-100' // Keeping it minimal for pending state
                                                                                } ${isDisabled ? 'opacity-30 cursor-not-allowed border-none bg-gray-50' : ''}`}
                                                                            >
                                                                                {isDone && <Icons.Check className="w-5 h-5" />}
                                                                                {isMissed && <Icons.X className="w-5 h-5" />}
                                                                                {!isDone && !isMissed && !isDisabled && isMe && <div className="w-2 h-2 rounded-full bg-gray-300" />}
                                                                            </button>
                                                                        </td>
                                                                    );
                                                                }) : (
                                                                    <td className="pl-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                                                <div
                                                                                    className="bg-green-500 h-2.5 rounded-full"
                                                                                    style={{ width: `${Math.min(100, (Object.values(habit.logs).filter(l => l.status === HabitStatus.DONE).length / 30) * 100)}%` }}
                                                                                ></div>
                                                                            </div>
                                                                            <span className="text-xs text-gray-500 w-12">{Object.values(habit.logs).filter(l => l.status === HabitStatus.DONE).length} days</span>
                                                                        </div>
                                                                    </td>
                                                                )}
                                                                {viewMode === 'weekly' && (
                                                                    <td className="text-center text-sm font-semibold text-gray-700">
                                                                        {Object.values(habit.logs).filter(l => l.status === HabitStatus.DONE).length}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )})}
                                                    </tbody>
                                                </table>
                                            </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </Card>
                         )
                    })}
                </div>

                {/* RIGHT COL: Analytics & Chat */}
                <div className="space-y-6">
                    {/* Analytics Card */}
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Your Progress</h3>
                            <button onClick={onGetAI} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 border border-indigo-100 flex items-center gap-1">
                                <Icons.BrainCircuit className="w-3 h-3" /> AI Insight
                            </button>
                        </div>

                        {(aiInsight || isAiLoading) && (
                            <div className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100 text-sm">
                                {isAiLoading ? (
                                    <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                        <Icons.BrainCircuit className="w-4 h-4" /> Analyzing logs...
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-indigo-900">AI Coach:</span>
                                            <button onClick={() => setAiInsight(null)} className="text-gray-400 hover:text-gray-600"><Icons.X className="w-3 h-3"/></button>
                                        </div>
                                        <div className="whitespace-pre-line text-indigo-800 leading-relaxed">
                                            {aiInsight}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9CA3AF'}} />
                                    <Tooltip
                                        cursor={{fill: '#F3F4F6'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                    />
                                    <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Chat Widget (If Group) */}
                    {isGroup && chatOpen && (
                        <Card className="flex flex-col h-80">
                            <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between">
                                <span>Group Chat</span>
                                <button onClick={() => setChatOpen(false)} className="md:hidden"><Icons.X className="w-4 h-4"/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                                {currentGroupMessages.map(msg => {
                                    const isMe = msg.userId === currentUser.id;
                                    const sender = users.find(u => u.id === msg.userId);
                                    return (
                                        <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            {!isMe && <img src={sender?.avatar} className="w-6 h-6 rounded-full mt-1" />}
                                            <div className={`p-2 rounded-lg max-w-[80%] text-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    )
                                })}
                                {currentGroupMessages.length === 0 && <p className="text-center text-xs text-gray-400 mt-4">Start the conversation!</p>}
                            </div>
                            <form onSubmit={handleChatSubmit} className="p-3 border-t border-gray-100 flex gap-2">
                                <input
                                    className="flex-1 bg-gray-50 border-none rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder="Say something..."
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                />
                                <button type="submit" className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700">
                                    <Icons.ChevronRight className="w-4 h-4" />
                                </button>
                            </form>
                        </Card>
                    )}
                </div>
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingHabit ? "Edit Habit" : "Add New Habit"}>
                <form onSubmit={handleAddSubmit} className="space-y-4">
                    <Input
                        label="Habit Title"
                        placeholder="e.g., Read 15 mins"
                        value={newHabitTitle}
                        onChange={e => setNewHabitTitle(e.target.value)}
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500"
                            value={newHabitFreq}
                            onChange={e => setNewHabitFreq(e.target.value as HabitFrequency)}
                        >
                            <option value={HabitFrequency.DAILY}>Daily</option>
                            <option value={HabitFrequency.WEEKLY}>Weekly</option>
                            <option value={HabitFrequency.INTERVAL}>Specific Interval</option>
                        </select>
                    </div>

                    {/* Conditional Inputs */}
                    {newHabitFreq === HabitFrequency.WEEKLY && (
                         <Input
                            label="Target Days per Week"
                            type="number"
                            min="1"
                            max="7"
                            value={newHabitTarget}
                            onChange={e => setNewHabitTarget(e.target.value)}
                        />
                    )}
                    {newHabitFreq === HabitFrequency.INTERVAL && (
                         <Input
                            label="Every X Days (Gap)"
                            type="number"
                            min="1"
                            value={newHabitInterval}
                            onChange={e => setNewHabitInterval(e.target.value)}
                            placeholder="e.g. 2 for every 2nd day"
                        />
                    )}

                    <Input
                        label="Duration (minutes, optional)"
                        type="number"
                        placeholder="30"
                        value={newHabitDuration}
                        onChange={e => setNewHabitDuration(e.target.value)}
                    />

                    {/* Archive/Delete Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
                         {editingHabit && (
                            <>
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={() => handleDeleteHabit(editingHabit.id)}
                                    title="Delete permanently"
                                >
                                    <Icons.Trash className="w-5 h-5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleArchiveHabit(editingHabit.id)}
                                    title={editingHabit.completed ? "Restore to active habits" : "Move to archive"}
                                    className="flex-1 flex items-center justify-center gap-2"
                                >
                                    {editingHabit.completed ? (
                                        <>
                                            <Icons.ArchiveRestore className="w-4 h-4" /> Unarchive
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Archive className="w-4 h-4" /> Archive
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                        {!editingHabit && (
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        )}
                        <Button type="submit" className="flex-1">{editingHabit ? 'Save Changes' : 'Create Habit'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
// ... existing helpers ...
const NavItem: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
      isActive 
        ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    <span className={`${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>{icon}</span>
    {label}
  </button>
);

export default App;
