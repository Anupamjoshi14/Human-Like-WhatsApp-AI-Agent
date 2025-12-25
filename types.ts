
export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: Date;
  intent?: string;
  emotion?: string;
  urgency?: 'low' | 'medium' | 'high';
  isTyping?: boolean;
  isVoice?: boolean;
  transcription?: string;
  detectedLanguage?: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  statusText: string;
}

export interface ChatSession {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTimestamp: Date;
  messages: Message[];
  status: 'active' | 'escalated' | 'resolved';
  isGroup?: boolean;
}

export interface AIAnalysis {
  intent: string;
  emotion: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  isEscalationNeeded: boolean;
  response: string;
  detectedLanguage: string;
  transcription?: string;
}
