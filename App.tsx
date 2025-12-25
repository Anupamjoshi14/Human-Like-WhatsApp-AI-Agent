
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import BrainInspector from './components/BrainInspector';
import VoiceCall from './components/VoiceCall';
import { ChatSession, Message, Contact } from './types';
import { analyzeAndGenerateResponse } from './services/geminiService';

const INITIAL_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Anupam Sharma', avatar: 'https://picsum.photos/seed/anupam/100/100', statusText: 'Hi, pricing kya hai?' },
  { id: 'c2', name: 'Sarah Connor', avatar: 'https://picsum.photos/seed/sarah/100/100', statusText: 'At the gym 🏋️' },
  { id: 'c3', name: 'John Doe', avatar: 'https://picsum.photos/seed/john/100/100', statusText: 'Urgent calls only.' },
  { id: 'c4', name: 'Priya Patel', avatar: 'https://picsum.photos/seed/priya/100/100', statusText: 'Living the dream ✨' },
  { id: 'c5', name: 'Michael Scott', avatar: 'https://picsum.photos/seed/michael/100/100', statusText: 'Worlds Best Boss' },
  { id: 'c6', name: 'Dwight Schrute', avatar: 'https://picsum.photos/seed/dwight/100/100', statusText: 'Bears, Beets, Battlestar Galactica.' },
  { id: 'c7', name: 'Pam Beesly', avatar: 'https://picsum.photos/seed/pam/100/100', statusText: 'Art is everything.' },
];

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'c1',
    name: 'Anupam Sharma',
    avatar: 'https://picsum.photos/seed/anupam/100/100',
    lastMessage: 'Hi, pricing kya hai?',
    lastTimestamp: new Date(),
    status: 'active',
    messages: [
      { id: 'm1', sender: 'user', text: 'Hi, pricing kya hai?', timestamp: new Date() }
    ]
  },
  {
    id: 'c2',
    name: 'Sarah Connor',
    avatar: 'https://picsum.photos/seed/sarah/100/100',
    lastMessage: 'Thanks for the quick booking!',
    lastTimestamp: new Date(Date.now() - 3600000),
    status: 'resolved',
    messages: [
      { id: 'm2', sender: 'user', text: 'I need to book a slot for tomorrow.', timestamp: new Date(Date.now() - 7200000) },
      { id: 'm3', sender: 'agent', text: 'Sure thing Sarah! I have a slot at 10 AM. Should I lock it?', timestamp: new Date(Date.now() - 7000000) },
      { id: 'm4', sender: 'user', text: 'Yes please.', timestamp: new Date(Date.now() - 6800000) },
      { id: 'm5', sender: 'agent', text: 'Done! Thanks for the quick booking!', timestamp: new Date(Date.now() - 3600000) }
    ]
  }
];

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_SESSIONS);
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_SESSIONS[0].id);
  const [lastAnalysis, setLastAnalysis] = useState<Message | undefined>();
  const [isCalling, setIsCalling] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const processResponse = async (
    targetSessionId: string,
    userText: string | null, 
    audioData?: { data: string; mimeType: string }
  ) => {
    const typingMessage: Message = {
      id: 'typing-' + Date.now(),
      sender: 'agent',
      text: '',
      timestamp: new Date(),
      isTyping: true
    };

    setSessions(prev => prev.map(s => {
      if (s.id === targetSessionId) {
        return { ...s, messages: [...s.messages, typingMessage] };
      }
      return s;
    }));

    try {
      const currentSession = sessions.find(s => s.id === targetSessionId);
      const history = currentSession ? currentSession.messages : [];
      
      const analysis = await analyzeAndGenerateResponse(userText, history, audioData);
      
      const isVoiceResponse = !!audioData;

      const agentReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: analysis.response,
        timestamp: new Date(),
        intent: analysis.intent,
        emotion: analysis.emotion,
        urgency: analysis.urgency,
        detectedLanguage: analysis.detectedLanguage,
        isVoice: isVoiceResponse
      };

      if (targetSessionId === activeSessionId) {
        setLastAnalysis(agentReply);
      }

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          let updatedMessages = s.messages.filter(m => !m.isTyping);
          
          if (audioData && analysis.transcription) {
            const lastUserMsgIndex = updatedMessages.findLastIndex(m => m.sender === 'user' && m.isVoice);
            if (lastUserMsgIndex !== -1) {
              updatedMessages[lastUserMsgIndex] = { ...updatedMessages[lastUserMsgIndex], text: analysis.transcription };
            }
          }
          
          updatedMessages = [...updatedMessages, agentReply];
          
          if (analysis.isEscalationNeeded) {
            const systemMsg: Message = { id: 'sys-' + Date.now(), sender: 'system', text: 'Escalated to human agent', timestamp: new Date() };
            return { ...s, messages: [...updatedMessages, systemMsg], status: 'escalated', lastMessage: agentReply.text };
          }
          return { ...s, messages: updatedMessages, lastMessage: isVoiceResponse ? `🎤 Voice: ${agentReply.text}` : agentReply.text, lastTimestamp: new Date() };
        }
        return s;
      }));
    } catch (error) {
      console.error("AI Error", error);
      setSessions(prev => prev.map(s => s.id === targetSessionId ? { ...s, messages: s.messages.filter(m => !m.isTyping) } : s));
    }
  };

  const handleSendMessage = async (text: string) => {
    const newMessage: Message = { id: Date.now().toString(), sender: 'user', text, timestamp: new Date() };
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, newMessage], lastMessage: text, lastTimestamp: new Date() } : s));
    await processResponse(activeSessionId, text);
  };

  const handleSendVoice = async (audioBase64: string, mimeType: string) => {
    const newMessage: Message = { id: Date.now().toString(), sender: 'user', text: '', timestamp: new Date(), isVoice: true };
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, newMessage], lastMessage: "🎤 Voice Message", lastTimestamp: new Date() } : s));
    await processResponse(activeSessionId, null, { data: audioBase64, mimeType });
  };

  const handleEscalate = () => {
    const systemMsg: Message = { id: 'sys-' + Date.now(), sender: 'system', text: 'User requested a human agent', timestamp: new Date() };
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, systemMsg], status: 'escalated' } : s));
  };

  const handleStartNewChat = (contact: Contact) => {
    const existingSession = sessions.find(s => s.id === contact.id);
    if (existingSession) {
      setActiveSessionId(existingSession.id);
    } else {
      const newSession: ChatSession = {
        id: contact.id,
        name: contact.name,
        avatar: contact.avatar,
        lastMessage: 'Started a new conversation',
        lastTimestamp: new Date(),
        messages: [
          { id: 'sys-' + Date.now(), sender: 'system', text: `You are now chatting with ${contact.name}`, timestamp: new Date() }
        ],
        status: 'active'
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }
  };

  const handleAddContact = (name: string, status: string) => {
    const newContact: Contact = {
      id: 'c-' + Date.now(),
      name,
      avatar: `https://picsum.photos/seed/${name}/100/100`,
      statusText: status
    };
    setContacts(prev => [...prev, newContact]);
  };

  const handleCreateGroup = (name: string, memberIds: string[]) => {
    const groupId = 'g-' + Date.now();
    const membersNames = memberIds.map(id => contacts.find(c => c.id === id)?.name).join(', ');
    
    const newSession: ChatSession = {
      id: groupId,
      name,
      avatar: `https://picsum.photos/seed/${name}/100/100`,
      lastMessage: `Group created with ${memberIds.length} members`,
      lastTimestamp: new Date(),
      isGroup: true,
      messages: [
        { id: 'sys-' + Date.now(), sender: 'system', text: `You created group "${name}" with: ${membersNames}`, timestamp: new Date() }
      ],
      status: 'active'
    };
    
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(groupId);
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      <Sidebar 
        sessions={sessions} 
        contacts={contacts}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onStartNewChat={handleStartNewChat}
        onAddContact={handleAddContact}
        onCreateGroup={handleCreateGroup}
      />
      
      <ChatWindow 
        sessionName={activeSession.name}
        avatar={activeSession.avatar}
        messages={activeSession.messages}
        onSendMessage={handleSendMessage}
        onSendVoice={handleSendVoice}
        onEscalate={handleEscalate}
        onStartCall={() => setIsCalling(true)}
        isEscalated={activeSession.status === 'escalated'}
      />

      <BrainInspector lastMessageAnalysis={lastAnalysis} />

      {isCalling && (
        <VoiceCall 
          sessionName={activeSession.name} 
          avatar={activeSession.avatar} 
          onEndCall={() => setIsCalling(false)} 
        />
      )}
    </div>
  );
};

export default App;
