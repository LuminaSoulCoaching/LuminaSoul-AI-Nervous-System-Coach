
import React, { useState, useEffect, useRef } from 'react';
import { geminiService } from './services/geminiService';
import { GameStep, Message, User, UserSession, AppView, SessionTier, CheckIn, ResetUsage, UserJourney, JourneyDay } from './types';
import { STEP_ORDER, SYSTEM_PROMPT, JOURNEYS } from './constants';
import ProgressBar from './components/ProgressBar';
import MessageBubble from './components/MessageBubble';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('LANDING');
  const [user, setUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*`]/g, ''); // Remove markdown characters
    const speech = new SpeechSynthesisUtterance(cleanText);
    speech.rate = 0.85;
    speech.pitch = 1;
    speech.volume = 1;
    window.speechSynthesis.speak(speech);
  };
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  // Auth States
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('SIGNUP');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [verifyCode, setVerifyCode] = useState('');
  const [authError, setAuthError] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeUserId = localStorage.getItem('lumina_active_user_id');
    if (activeUserId) {
      const savedUser = JSON.parse(localStorage.getItem(`user_${activeUserId}`) || 'null');
      if (savedUser) {
        setUser(savedUser);
        // We still start at LANDING for the experience, but user is loaded
      }
    } else {
      // Create a default guest user for immediate access
      const guestUser: User = {
        name: 'Guest Traveler',
        email: 'guest@luminasoul.space',
        phone: '',
        password: '',
        isVerified: true,
        sessions: [],
        checkIns: [],
        resetUsage: [],
        journeyHistory: []
      };
      setUser(guestUser);
      localStorage.setItem('lumina_active_user_id', guestUser.email);
      localStorage.setItem(`user_${guestUser.email}`, JSON.stringify(guestUser));
    }
  }, []);

  const handleCheckIn = (emotion: string) => {
    if (!user) return;
    const newCheckIn: CheckIn = {
      id: Date.now().toString(),
      timestamp: new Date(),
      emotion
    };
    const updatedUser = {
      ...user,
      checkIns: [...(user.checkIns || []), newCheckIn]
    };
    setUser(updatedUser);
    localStorage.setItem(`user_${user.email}`, JSON.stringify(updatedUser));
  };

  const handleResetUsage = (resetType: string, emotionBefore: string) => {
    if (!user) return;
    const newUsage: ResetUsage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      resetType,
      emotionBefore
    };
    const updatedUser = {
      ...user,
      resetUsage: [...(user.resetUsage || []), newUsage]
    };
    setUser(updatedUser);
    localStorage.setItem(`user_${user.email}`, JSON.stringify(updatedUser));
  };

  const startJourney = (journeyId: string) => {
    if (!user) return;
    const newJourney: UserJourney = {
      journeyId,
      startDate: new Date(),
      completedDays: [],
      isComplete: false
    };
    const updatedUser = {
      ...user,
      activeJourney: newJourney
    };
    setUser(updatedUser);
    localStorage.setItem(`user_${user.email}`, JSON.stringify(updatedUser));
    setView('JOURNEY');
  };

  const completeJourneyDay = (dayNumber: number) => {
    if (!user || !user.activeJourney) return;
    const updatedCompletedDays = [...new Set([...user.activeJourney.completedDays, dayNumber])];
    const isComplete = updatedCompletedDays.length === JOURNEYS.find(j => j.id === user.activeJourney?.journeyId)?.durationDays;
    
    const updatedJourney = {
      ...user.activeJourney,
      completedDays: updatedCompletedDays,
      isComplete
    };

    const updatedUser = {
      ...user,
      activeJourney: isComplete ? undefined : updatedJourney,
      journeyHistory: isComplete ? [...user.journeyHistory, updatedJourney] : user.journeyHistory
    };

    setUser(updatedUser);
    localStorage.setItem(`user_${user.email}`, JSON.stringify(updatedUser));
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem(`user_${user.email}`, JSON.stringify(user));
      if (user.isVerified) localStorage.setItem('lumina_active_user_id', user.email);
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeSession?.messages, isThinking]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'SIGNUP') {
      if (!formData.name || !formData.email || !formData.phone || !formData.password) {
        setAuthError('Please fill in all fields.');
        return;
      }
      localStorage.setItem(`user_${formData.email}`, JSON.stringify({ ...formData, isVerified: false, sessions: [], checkIns: [], resetUsage: [], journeyHistory: [] }));
      setUser({ ...formData, isVerified: false, sessions: [], checkIns: [], resetUsage: [], journeyHistory: [] });
      setView('VERIFY');
    } else {
      const savedUser = JSON.parse(localStorage.getItem(`user_${formData.email}`) || 'null');
      if (savedUser && savedUser.password === formData.password) {
        setUser(savedUser);
        setView(savedUser.isVerified ? 'DASHBOARD' : 'VERIFY');
      } else {
        setAuthError('Incorrect details. Please try again.');
      }
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode === '1111') {
      if (user) {
        const verifiedUser = { ...user, isVerified: true };
        setUser(verifiedUser);
        setView('DASHBOARD');
      }
    } else {
      setAuthError('Code is 1111 for this demo.');
    }
  };

  const startNewSession = async (tier: SessionTier, initialEmotion?: string) => {
    const newSession: UserSession = {
      id: Math.random().toString(36).substring(7),
      messages: [],
      currentStep: GameStep.START,
      lastUpdated: new Date(),
      isComplete: false,
      tier
    };
    setActiveSession(newSession);
    setView('CHAT');
    setIsThinking(true);
    
    const patternContext = user.checkIns && user.checkIns.length > 0 
      ? `\n\nUSER PATTERN CONTEXT: The user has been feeling ${user.checkIns[user.checkIns.length-1].emotion} recently. They have used resets ${user.resetUsage.length} times.`
      : "";
    geminiService.initChat(SYSTEM_PROMPT + patternContext);

    if (tier === 'free') {
      handleResetUsage('2-Minute Reset', initialEmotion || 'unknown');
    }
    
    const tierContext = tier === 'free' 
      ? "I am starting a 2-MINUTE NERVOUS SYSTEM RESET. Keep it very brief." 
      : "I am starting a DEEP JOURNEY. We will move through multiple layers of awareness.";

    const response = await geminiService.sendMessage(
      `I am ${user?.name}. ${tierContext}`
    );
    
    const modelMsg: Message = { id: 'm1', role: 'model', text: response, timestamp: new Date(), isQuestion: true };
    const updatedSession = { ...newSession, messages: [modelMsg] };
    setActiveSession(updatedSession);
    setIsThinking(false);
    updateUserSessions(updatedSession);
    speak(response);
  };

  const updateUserSessions = (session: UserSession) => {
    if (!user) return;
    const otherSessions = user.sessions.filter(s => s.id !== session.id);
    setUser({ ...user, sessions: [session, ...otherSessions] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking || !activeSession) return;

    const text = inputValue;
    setInputValue('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    const messagesWithUser = [...activeSession.messages, userMsg];
    setActiveSession({ ...activeSession, messages: messagesWithUser });
    setIsThinking(true);

    let nextStep = activeSession.currentStep;
    const idx = STEP_ORDER.indexOf(activeSession.currentStep) + 1;
    nextStep = STEP_ORDER[idx] || GameStep.END;

    if (activeSession.tier === 'free' && activeSession.messages.length >= 3) {
      nextStep = GameStep.END;
    }

    const prompt = text;
    
    const response = await geminiService.sendMessage(prompt);
    const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response, timestamp: new Date(), isQuestion: true };
    
    const finalSession = { 
      ...activeSession, 
      messages: [...messagesWithUser, modelMsg],
      currentStep: nextStep,
      isComplete: nextStep === GameStep.END,
      lastUpdated: new Date()
    };
    setActiveSession(finalSession);
    setIsThinking(false);
    updateUserSessions(finalSession);
    speak(response);
  };

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 serene-bg text-center">
        <div className="max-w-2xl glass-card p-16 rounded-[4rem] shadow-2xl border border-white/50">
          <h1 className="text-7xl text-indigo-900 mb-6 font-serif tracking-tight">LuminaSoul</h1>
          <p className="text-2xl text-indigo-700/80 mb-12 font-light italic">"A sacred space for your nervous system to be heard."</p>
          <button onClick={() => setView('DASHBOARD')} className="px-16 py-5 bg-indigo-600 text-white rounded-full text-xl shadow-xl hover:bg-indigo-700 transition-all font-medium active:scale-95">
            Enter the Space
          </button>
        </div>
      </div>
    );
  }

  if (view === 'AUTH') {
    return (
      <div className="min-h-screen flex items-center justify-center serene-bg p-6">
        <form onSubmit={handleAuth} className="bg-white p-10 rounded-[2rem] shadow-xl w-full max-w-md border border-purple-50">
          <h2 className="text-3xl font-serif text-indigo-900 mb-2 text-center">{authMode === 'SIGNUP' ? 'Join LuminaSoul' : 'Welcome Back'}</h2>
          <p className="text-gray-400 text-sm mb-8 text-center font-light">{authMode === 'SIGNUP' ? 'Create a space for your inner peace.' : 'Reconnect with your journey.'}</p>
          {authError && <div className="mb-6 p-4 bg-red-50 text-red-500 text-xs rounded-2xl border border-red-100">{authError}</div>}
          <div className="space-y-4">
            {authMode === 'SIGNUP' && (
              <>
                <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-6 py-4 rounded-full border border-purple-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
                <input type="tel" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-6 py-4 rounded-full border border-purple-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
              </>
            )}
            <input type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-6 py-4 rounded-full border border-purple-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
            <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-8 py-4 rounded-full border border-purple-100 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          <button type="submit" className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-all shadow-lg active:scale-95 transition-transform">{authMode === 'SIGNUP' ? 'Begin Journey' : 'Continue Journey'}</button>
          <button type="button" onClick={() => setAuthMode(authMode === 'SIGNUP' ? 'LOGIN' : 'SIGNUP')} className="w-full mt-6 text-indigo-400 text-sm hover:underline">
            {authMode === 'SIGNUP' ? 'Already have an account? Sign In' : "New here? Sign Up"}
          </button>
        </form>
      </div>
    );
  }

  if (view === 'VERIFY') {
    return (
      <div className="min-h-screen flex items-center justify-center serene-bg p-6 text-center">
        <div className="bg-white p-10 rounded-[2rem] shadow-xl w-full max-w-md border border-purple-50">
          <h2 className="text-3xl font-serif text-indigo-900 mb-4 tracking-tight">Confirm Your Email</h2>
          <p className="text-gray-500 font-light mb-8">Verification code sent to {user?.email}. (Demo: 1111)</p>
          <input type="text" placeholder="0000" value={verifyCode} maxLength={4} onChange={e => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))} className="w-full mb-8 text-center text-4xl tracking-[0.3em] font-serif border-b-2 border-indigo-100 outline-none focus:border-indigo-400 transition-all" />
          <button onClick={handleVerify} className="w-full py-4 bg-indigo-600 text-white rounded-full shadow-lg font-medium hover:bg-indigo-700 transition-all">Verify</button>
        </div>
      </div>
    );
  }

  if (view === 'DASHBOARD' && user) {
    const emotions = ['calm', 'anxious', 'overwhelmed', 'frustrated', 'exhausted', 'numb', 'sad'];
    
    return (
      <div className="min-h-screen serene-bg p-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <p className="text-indigo-400 text-xs uppercase tracking-[0.3em] font-bold mb-1">Peace be with you</p>
              <h1 className="text-5xl font-serif text-indigo-900">{user.name}</h1>
            </div>
            <div className="flex space-x-4">
              <button onClick={() => setShowInsights(!showInsights)} className="text-indigo-600 hover:text-indigo-800 uppercase tracking-widest text-[10px] font-bold border border-indigo-100 px-6 py-2 rounded-full transition-all bg-white/50">
                {showInsights ? 'Back to Dashboard' : 'View Patterns'}
              </button>
              <button onClick={() => { setView('LANDING'); }} className="text-indigo-300 hover:text-indigo-600 uppercase tracking-widest text-[10px] font-bold border px-6 py-2 rounded-full transition-all">Return Home</button>
            </div>
          </header>

          {showInsights ? (
            <div className="space-y-8 message-fade-in">
              <div className="glass-card p-10 rounded-[3rem] border border-white/50">
                <h2 className="text-3xl font-serif text-indigo-900 mb-8">Nervous System Insights</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/40 p-8 rounded-[2rem] border border-white/20">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-4">Emotional Trends</h3>
                    {user.checkIns && user.checkIns.length > 0 ? (
                      <div className="space-y-4">
                        {Array.from(new Set(user.checkIns.map(c => c.emotion))).slice(0, 3).map(emotion => {
                          const count = user.checkIns.filter(c => c.emotion === emotion).length;
                          const percentage = Math.round((count / user.checkIns.length) * 100);
                          return (
                            <div key={emotion} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="capitalize text-indigo-900">{emotion}</span>
                                <span className="text-indigo-400">{percentage}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-indigo-50 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No check-ins recorded yet.</p>
                    )}
                  </div>

                  <div className="bg-white/40 p-8 rounded-[2rem] border border-white/20">
                    <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-4">Most Helpful Tools</h3>
                    {user.resetUsage && user.resetUsage.length > 0 ? (
                      <div className="space-y-4">
                        {Array.from(new Set(user.resetUsage.map(r => r.resetType))).map(type => {
                          const count = user.resetUsage.filter(r => r.resetType === type).length;
                          return (
                            <div key={type} className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-indigo-50">
                              <span className="text-indigo-900 text-sm">{type}</span>
                              <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-3 py-1 rounded-full">{count} uses</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No resets used yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-8 bg-indigo-600/5 p-8 rounded-[2rem] border border-indigo-100/50">
                  <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-600 mb-4">Coach's Observation</h3>
                  <p className="text-indigo-900/80 italic leading-relaxed">
                    {!user.checkIns || user.checkIns.length < 3 
                      ? "I'm still learning your unique rhythms. Continue checking in so I can offer more personalized insights."
                      : `I've noticed you often reach for support when feeling ${user.checkIns[user.checkIns.length-1].emotion}. This awareness is a beautiful first step toward regulation.`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="glass-card p-10 rounded-[3rem] mb-12 border border-white/50">
                <h2 className="text-2xl font-serif text-indigo-900 mb-6">How are you feeling right now?</h2>
                <div className="flex flex-wrap gap-3">
                  {emotions.map(emotion => (
                    <button 
                      key={emotion} 
                      onClick={() => handleCheckIn(emotion)}
                      className="px-6 py-3 bg-white/60 hover:bg-indigo-600 hover:text-white rounded-full text-sm transition-all border border-indigo-50 shadow-sm active:scale-95 capitalize"
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {user.activeJourney ? (
                    <button onClick={() => setView('JOURNEY')} className="w-full bg-indigo-50 p-8 rounded-[2.5rem] shadow-sm border border-indigo-100 text-left hover:shadow-xl transition-all group relative overflow-hidden">
                      <div className="absolute top-4 right-8 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Active Journey</div>
                      <h3 className="text-2xl font-serif text-indigo-900 mb-2">Continue Your Path</h3>
                      <p className="text-indigo-400 text-sm font-light leading-relaxed">
                        {JOURNEYS.find(j => j.id === user.activeJourney?.journeyId)?.title} • Day {user.activeJourney.completedDays.length + 1}
                      </p>
                    </button>
                  ) : (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-purple-50">
                      <h3 className="text-xl font-serif text-indigo-900 mb-4">Start a Journey</h3>
                      <div className="space-y-3">
                        {JOURNEYS.map(j => (
                          <button key={j.id} onClick={() => startJourney(j.id)} className="w-full p-4 rounded-2xl border border-indigo-50 hover:bg-indigo-50 transition-all text-left group">
                            <div className="flex justify-between items-center">
                              <span className="text-indigo-900 font-medium">{j.title}</span>
                              <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">{j.durationDays} Days</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">{j.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => startNewSession('free', user.checkIns && user.checkIns.length > 0 ? user.checkIns[user.checkIns.length-1].emotion : undefined)} className="w-full bg-white p-8 rounded-[2.5rem] shadow-sm border border-purple-50 text-left hover:shadow-xl transition-all group">
                    <h3 className="text-2xl font-serif text-indigo-900 mb-2 group-hover:text-indigo-600 transition-colors">2-Minute Reset</h3>
                    <p className="text-gray-400 text-sm font-light leading-relaxed">A brief moment of grounding, safety, and focused regulation breath.</p>
                  </button>
                  
                  <button onClick={() => startNewSession('paid')} className="w-full bg-indigo-600 p-8 rounded-[2.5rem] shadow-lg text-left text-white hover:bg-indigo-700 transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-125"></div>
                    <h3 className="text-2xl font-serif mb-2">Deep Journey</h3>
                    <p className="text-indigo-100 text-sm font-light leading-relaxed">Explore patterns, triggers, and protective roles in a sacred flowing session.</p>
                  </button>
                </div>
                
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-purple-50 flex flex-col">
                  <h3 className="text-xl font-serif text-indigo-900 mb-6 flex items-center">
                    <svg className="w-5 h-5 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round"/></svg>
                    Previous Sessions
                  </h3>
                  <div className="space-y-4 overflow-y-auto max-h-[340px] pr-2 custom-scrollbar flex-1">
                    {user.sessions.length > 0 ? user.sessions.map(s => (
                      <div key={s.id} onClick={() => { setActiveSession(s); setView('CHAT'); }} className="p-5 border border-purple-50 rounded-2xl hover:bg-purple-50 transition-all cursor-pointer group">
                        <div className="flex justify-between text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2">
                          <span>{s.tier === 'free' ? 'Reset' : 'Journey'}</span>
                          <span>{new Date(s.lastUpdated).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 italic line-clamp-1 group-hover:text-indigo-600 transition-colors">"{s.messages[s.messages.length - 1]?.text}"</p>
                      </div>
                    )) : <div className="text-center py-12 text-gray-300 italic text-sm">Your healing history will appear here.</div>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === 'JOURNEY' && user && user.activeJourney) {
    const journey = JOURNEYS.find(j => j.id === user.activeJourney?.journeyId);
    if (!journey) return null;

    const currentDayNumber = user.activeJourney.completedDays.length + 1;
    const currentDay = journey.days.find(d => d.dayNumber === currentDayNumber) || journey.days[journey.days.length - 1];

    return (
      <div className="min-h-screen serene-bg p-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <p className="text-indigo-400 text-xs uppercase tracking-[0.3em] font-bold mb-1">Your Healing Journey</p>
              <h1 className="text-5xl font-serif text-indigo-900">{journey.title}</h1>
            </div>
            <button onClick={() => setView('DASHBOARD')} className="text-indigo-300 hover:text-indigo-600 uppercase tracking-widest text-[10px] font-bold border px-6 py-2 rounded-full transition-all">Dashboard</button>
          </header>

          <div className="glass-card p-10 rounded-[3rem] border border-white/50 mb-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-serif text-indigo-900">Day {currentDayNumber}: {currentDay.title}</h2>
              <div className="text-sm font-bold text-indigo-400 uppercase tracking-widest">
                {user.activeJourney.completedDays.length} / {journey.durationDays} Days
              </div>
            </div>

            <div className="w-full h-2 bg-indigo-50 rounded-full mb-12 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-1000" 
                style={{ width: `${(user.activeJourney.completedDays.length / journey.durationDays) * 100}%` }}
              ></div>
            </div>

            <div className="space-y-8">
              <div className="bg-white/40 p-8 rounded-[2rem] border border-white/20">
                <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-2">Today's Focus</h3>
                <p className="text-indigo-900 text-lg font-light">{currentDay.focus}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={() => startNewSession('free', currentDay.resetType)}
                  className="bg-indigo-600 text-white p-8 rounded-[2rem] shadow-lg hover:bg-indigo-700 transition-all text-left group"
                >
                  <h4 className="text-xl font-serif mb-2">Guided Reset</h4>
                  <p className="text-indigo-100 text-sm font-light">Experience your daily {currentDay.resetType}.</p>
                </button>

                <button 
                  onClick={() => {
                    completeJourneyDay(currentDayNumber);
                    if (currentDayNumber === journey.durationDays) {
                      setView('DASHBOARD');
                    }
                  }}
                  className="bg-white text-indigo-900 p-8 rounded-[2rem] border border-indigo-100 hover:shadow-xl transition-all text-left"
                >
                  <h4 className="text-xl font-serif mb-2">Complete Day</h4>
                  <p className="text-gray-400 text-sm font-light">Mark today's practice as complete.</p>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/40 p-8 rounded-[2rem] border border-white/20">
            <h3 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-4">Daily Reflection Prompt</h3>
            <p className="text-indigo-900 italic font-serif text-xl leading-relaxed">"{currentDay.reflectionPrompt}"</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'CHAT' && activeSession) {
    return (
      <div className="flex flex-col h-screen serene-bg overflow-hidden">
        <div className="px-6 py-4 bg-white/90 border-b border-purple-50 flex justify-between items-center z-10">
          <button onClick={() => setView('DASHBOARD')} className="text-indigo-400 text-sm flex items-center hover:text-indigo-700 transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round"/></svg>
            Dashboard
          </button>
          <div className="text-center">
            <h2 className="text-xl font-serif text-indigo-900 tracking-tight">{activeSession.tier === 'free' ? 'Nervous System Reset' : 'Healing Space'}</h2>
            <div className="text-[9px] uppercase tracking-[0.3em] text-indigo-300 font-bold">Session Active</div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                const newState = !isVoiceEnabled;
                setIsVoiceEnabled(newState);
                if (!newState) window.speechSynthesis.cancel();
              }} 
              className={`p-2 rounded-full transition-all ${isVoiceEnabled ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
              title={isVoiceEnabled ? "Disable Voice" : "Enable Voice"}
            >
              {isVoiceEnabled ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm12.879-6.364l-4.243 4.243m4.243 0l-4.243-4.243" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </button>
            <button onClick={() => setView('REVIEW')} className="text-indigo-400 text-sm hover:text-indigo-700 transition-colors">Reflections</button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 py-8 space-y-4 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {activeSession.messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
            {isThinking && (
              <div className="flex justify-start mb-6 message-fade-in">
                <div className="bg-white/80 text-gray-400 px-8 py-5 rounded-3xl rounded-tl-none italic text-sm border border-purple-50 shadow-sm">
                  LuminaSoul is holding space...
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 md:p-8 bg-white/70 backdrop-blur-md border-t border-purple-50 shadow-2xl">
          {activeSession.isComplete ? (
            <div className="max-w-4xl mx-auto text-center py-6">
              <p className="text-indigo-500 font-serif italic text-2xl mb-8">"Awareness itself is healing."</p>
              <button onClick={() => setView('DASHBOARD')} className="px-12 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all font-medium">Return to Dashboard</button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto relative">
              <form onSubmit={handleSubmit}>
                <input 
                  type="text" 
                  value={inputValue} 
                  onChange={e => setInputValue(e.target.value)} 
                  placeholder={isThinking ? "Quiet moments..." : "Share what's in your heart..."} 
                  disabled={isThinking} 
                  className="w-full px-10 py-7 pr-24 glass-input rounded-full shadow-lg outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-xl font-light" 
                />
                <button 
                  type="submit" 
                  disabled={!inputValue.trim() || isThinking} 
                  className="absolute right-3 top-3 bottom-3 px-8 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 disabled:bg-gray-200 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'REVIEW' && activeSession) {
    return (
      <div className="min-h-screen serene-bg p-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex justify-between items-center mb-12">
            <h1 className="text-4xl font-serif text-indigo-900 tracking-tight">Reflections</h1>
            <button onClick={() => setView('CHAT')} className="text-indigo-600 font-bold bg-white px-8 py-3 rounded-full shadow-sm hover:shadow-md transition-all">Back to Session</button>
          </header>
          <div className="space-y-8 pb-12">
            {activeSession.messages.filter(m => m.role === 'user').map((m, idx) => (
              <div key={m.id} className="bg-white/80 p-10 rounded-[2.5rem] border border-indigo-50 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-200"></div>
                <h4 className="text-indigo-300 uppercase tracking-[0.3em] text-[10px] font-bold mb-4">Discovery {idx + 1}</h4>
                <p className="text-2xl text-indigo-900 italic font-light leading-relaxed">"{m.text}"</p>
              </div>
            ))}
            {activeSession.messages.filter(m => m.role === 'user').length === 0 && (
              <div className="text-center py-24 text-gray-400 italic">No reflections have been shared in this session yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default App;
