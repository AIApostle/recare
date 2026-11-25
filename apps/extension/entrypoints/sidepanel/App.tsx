import React, { useState, useEffect, useRef } from 'react';
import {
  InteractionMode,
  TaskState,
  PageContext,
  BrowserAction,
  ApprovalRequest,
  UserPreferences,
  StoredConversation,
  ChatMessageItem,
} from '../../types';
import { StorageService, DEFAULT_PREFERENCES } from '../../services/storage';
import { MessagingService } from '../../services/messaging';
import { RecareApiClient } from '../../services/api';
import { VoiceService } from '../../services/voice';
import { Header } from '../../components/Header';
import { InteractionModeSelector } from '../../components/InteractionModeSelector';
import { ConversationArea } from '../../components/ConversationArea';
import { ApprovalPrompt } from '../../components/ApprovalPrompt';
import { TaskControls } from '../../components/TaskControls';
import { Composer } from '../../components/Composer';
import { AccessibilitySettings } from '../../components/AccessibilitySettings';
import { OnboardingModal } from '../../components/OnboardingModal';
import { TaskHistory } from '../../components/TaskHistory';
import { LocalModelModal } from '../../components/LocalModelModal';

import { FirebaseAiService, CurrentInferencePath } from '../../services/firebase-ai/firebaseAiService';

export default function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLocalModelSetup, setShowLocalModelSetup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  const [inferencePath, setInferencePath] = useState<CurrentInferencePath>('idle');

  // Active page state
  const [pageContext, setPageContext] = useState<PageContext | null>(null);

  // Active task state machine
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskState>('IDLE');
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Persistent chat conversation history
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string | null>(null);
  const hasHydratedConversationsRef = useRef(false);

  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
  const isLiveVoiceRef = useRef(isLiveVoiceActive);
  isLiveVoiceRef.current = isLiveVoiceActive;
  const listenTriggerRef = useRef<(() => void) | null>(null);

  const checkRenderHealth = async (): Promise<boolean> => {
    const healthy = await RecareApiClient.checkHealth();
    setIsBackendConnected(healthy);
    return healthy;
  };

  // Load preferences, restore previous active conversation, and check Render health on mount
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      const [prefs, onboardingDone, savedConvs, savedActiveId] = await Promise.all([
        StorageService.getPreferences(),
        StorageService.isOnboardingCompleted(),
        StorageService.getConversations(),
        StorageService.getActiveConversationId(),
      ]);

      setPreferences(prefs);
      if (!onboardingDone) {
        setShowOnboarding(true);
      }

      if (savedConvs.length > 0) {
        const target = savedActiveId
          ? savedConvs.find((c) => c.id === savedActiveId)
          : savedConvs[0];
        if (target && target.messages.length > 0) {
          setActiveConversationId(target.id);
          setConversationCreatedAt(target.createdAt);
          setMessages(target.messages);
        }
      }
      hasHydratedConversationsRef.current = true;

      // Initialize Firebase AI Logic service cleanly
      FirebaseAiService.initialize().catch(() => {});

      const healthy = await checkRenderHealth();
      if (!healthy) {
        // Retry once in case Render free tier is waking up from idle
        retryTimer = setTimeout(() => {
          checkRenderHealth();
        }, 4000);
      }

      refreshPageContext();
    }
    init();

    // Listen for tab updates
    const messageListener = (msg: any) => {
      if (msg.type === 'TAB_UPDATED') {
        refreshPageContext();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  // Automatically persist active conversation whenever messages update
  useEffect(() => {
    if (!hasHydratedConversationsRef.current || messages.length === 0) return;

    const now = new Date().toISOString();
    const convId = activeConversationId || `conv_${Date.now()}`;
    const createdAt = conversationCreatedAt || now;
    if (!activeConversationId) {
      setActiveConversationId(convId);
      setConversationCreatedAt(createdAt);
    }

    const firstUserMsg = messages.find((m) => m.sender === 'user')?.text;
    const rawTitle = firstUserMsg || messages[0]?.text || 'Conversation';
    const title = rawTitle.length > 48 ? `${rawTitle.slice(0, 48).trim()}...` : rawTitle;

    const record: StoredConversation = {
      id: convId,
      title,
      domain: pageContext?.domain,
      url: pageContext?.url,
      createdAt,
      updatedAt: now,
      messages,
    };

    StorageService.saveConversation(record).catch(() => {});
    StorageService.setActiveConversationId(convId).catch(() => {});
  }, [messages, activeConversationId, conversationCreatedAt, pageContext?.domain, pageContext?.url]);

  const refreshPageContext = async (): Promise<PageContext | null> => {
    try {
      const ctx = await MessagingService.getPageContext();
      if (ctx) {
        // Capture visible page screenshot for multimodal visual understanding
        const screenshot = await MessagingService.capturePageScreenshot();
        if (screenshot) {
          ctx.screenshot_base64 = screenshot;
        }
        setPageContext(ctx);
        return ctx;
      }
    } catch (e) {
      console.warn('Could not fetch active page context:', e);
    }
    return null;
  };

  const handlePreferencesUpdate = async (updates: Partial<UserPreferences>) => {
    const updated = await StorageService.savePreferences(updates);
    setPreferences(updated);
  };

  const handleOnboardingFinish = async () => {
    await StorageService.setOnboardingCompleted(true);
    setShowOnboarding(false);
    // Add welcome message
    addAssistantMessage(
      "Welcome! I'm ready to assist you on this website. Ask me anything about the page or tell me what task you want to accomplish."
    );
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_u_${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const addAssistantMessage = (
    text: string,
    spokenText?: string,
    plan?: any,
    suggestedActions?: string[],
    inferenceSource?: 'on_device' | 'in_cloud',
    modelUsed?: string
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        text,
        spokenText,
        timestamp: new Date().toLocaleTimeString(),
        plan,
        suggestedActions,
        inferenceSource,
        modelUsed,
      },
    ]);

    const triggerNextLiveListen = () => {
      if (isLiveVoiceRef.current && listenTriggerRef.current) {
        setTimeout(() => {
          if (isLiveVoiceRef.current) {
            listenTriggerRef.current?.();
          }
        }, 350);
      }
    };

    const mode = preferences.response_output_mode || 'both';
    const shouldSpeak = (mode === 'both' || mode === 'voice' || preferences.voice_enabled) && mode !== 'text';
    if (shouldSpeak && (spokenText || text)) {
      VoiceService.speak(
        spokenText || text,
        preferences.speech_rate,
        triggerNextLiveListen,
        preferences.voice_gender !== 'neutral' ? preferences.voice_gender : undefined
      );
    } else {
      triggerNextLiveListen();
    }
  };

  /** Handle user prompt input (text or speech) */
  const handleUserMessage = async (userInput: string) => {
    const historyForBackend = messages.slice(-10).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    addUserMessage(userInput);
    const liveCtx = await refreshPageContext();

    const currentCtx = liveCtx || pageContext || {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title || 'Webpage',
      headings: [],
      interactive_elements: [],
    };

    const trimmedInput = userInput.trim().toLowerCase();

    // Explicit action intent check (user wants to perform a browser action)
    const actionWords = [
      'signin',
      'sign in',
      'login',
      'log in',
      'download',
      'click',
      'press',
      'tap',
      'fill',
      'type',
      'enter',
      'submit',
      'search',
      'find',
      'open',
      'buy',
      'order',
      'register',
      'watch',
      'play',
      'go to',
      'scroll',
      'select',
      'choose',
    ];
    const hasExplicitActionIntent = actionWords.some((w) => trimmedInput.includes(w));

    // Conversational / explanation queries (including speech without punctuation) go via Render Chat + Nano fallback
    const isConversational = !hasExplicitActionIntent || preferences.interaction_mode === 'guide';

    // 1. Render Cloud Chat + Automatic Local Gemini Nano Fallback
    if (isConversational && !hasExplicitActionIntent) {
      setInferencePath(
        preferences.inference_mode === 'ONLY_ON_DEVICE' || preferences.inference_mode === 'PREFER_ON_DEVICE'
          ? 'on_device'
          : 'in_cloud'
      );
      try {
        const aiRes = await FirebaseAiService.explainPageLocally(
          currentCtx,
          preferences.simplified_language,
          preferences.inference_mode,
          userInput,
          historyForBackend
        );

        setInferencePath(aiRes.inferenceSource);
        if (aiRes.inferenceSource === 'in_cloud') {
          setIsBackendConnected(true);
        }

        // Highlight candidate elements if mentioned in query
        const words = userInput.toLowerCase().split(/\s+/);
        const match = currentCtx.interactive_elements.find((el) => {
          const name = (el.accessible_name || el.text || '').toLowerCase();
          return words.some((w) => w.length > 3 && name.includes(w));
        });
        if (match) {
          await MessagingService.highlightElement(match.element_id, match.selector, match.accessible_name);
        }

        addAssistantMessage(
          aiRes.text,
          aiRes.text,
          undefined,
          ['Highlight key buttons', 'Help me fill this form', 'Explain next step'],
          aiRes.inferenceSource,
          aiRes.modelUsed
        );
      } catch (err: any) {
        setInferencePath('idle');
        addAssistantMessage(`Sorry, I encountered an issue: ${err.message}`);
      }
      return;
    }

    // 2. Render Cloud Task State Machine (+ Local Gemini Nano Fallback when offline)
    try {
      setInferencePath('in_cloud');
      setTaskState('PLANNING');

      const taskRes = await RecareApiClient.createTask(
        userInput,
        preferences.interaction_mode,
        currentCtx
      );

      setIsBackendConnected(true);
      setActiveTaskId(taskRes.task_id);
      setTaskState(taskRes.state);

      if (taskRes.message) {
        addAssistantMessage(
          taskRes.message,
          taskRes.message,
          taskRes.plan,
          undefined,
          'in_cloud',
          'Recare Cloud (Render)'
        );
      }

      // Check if approval is required before action
      if (taskRes.pending_approval) {
        setPendingApproval(taskRes.pending_approval);
        setTaskState('WAITING_FOR_USER_APPROVAL');
        return;
      }

      // If user disabled auto-approval of safe actions, prompt even for low-risk actions
      if (taskRes.current_action && preferences.auto_approve_low_risk === false) {
        setPendingApproval({
          approval_id: crypto.randomUUID(),
          task_id: taskRes.task_id,
          action_id: taskRes.current_action.action_id,
          action_type: taskRes.current_action.type,
          risk_level: taskRes.current_action.risk_level,
          target_description:
            taskRes.current_action.target?.accessible_name ||
            taskRes.current_action.target?.element_id ||
            'Webpage element',
          reason: taskRes.current_action.reason,
        });
        setTaskState('WAITING_FOR_USER_APPROVAL');
        return;
      }

      // If action is ready to execute immediately
      if (taskRes.current_action) {
        await executeActionCycle(taskRes.task_id, taskRes.current_action);
      }
    } catch (err: any) {
      // Automatic fallback to Local Gemini Nano / DOM guidance if Render is unreachable
      setIsBackendConnected(false);
      setTaskState('IDLE');
      try {
        const localFallback = await FirebaseAiService.planOrAnswerWithLocalFallback(
          userInput,
          currentCtx,
          preferences.simplified_language
        );
        setInferencePath(localFallback.inferenceSource);
        addAssistantMessage(
          localFallback.text,
          localFallback.text,
          undefined,
          undefined,
          localFallback.inferenceSource,
          localFallback.modelUsed
        );
      } catch {
        setInferencePath('idle');
        addAssistantMessage(`Could not reach Render backend: ${err.message}`);
      }
    }
  };

  /** Execute action on webpage and return result to backend */
  const executeActionCycle = async (taskId: string, action: BrowserAction) => {
    setIsExecutingAction(true);
    setTaskState('EXECUTING');

    try {
      const actionResult = await MessagingService.executeBrowserAction(action);
      setTaskState('VERIFYING');

      // Refresh page context after DOM action
      const updatedContext = await MessagingService.getPageContext();
      if (updatedContext) {
        setPageContext(updatedContext);
      }

      // Step task in backend
      const nextTaskState = await RecareApiClient.submitActionResult(
        taskId,
        actionResult,
        updatedContext || undefined
      );

      setTaskState(nextTaskState.state);

      if (nextTaskState.message) {
        addAssistantMessage(nextTaskState.message, nextTaskState.message, nextTaskState.plan);
      }

      if (nextTaskState.pending_approval) {
        setPendingApproval(nextTaskState.pending_approval);
        setTaskState('WAITING_FOR_USER_APPROVAL');
      } else if (nextTaskState.current_action && nextTaskState.state !== 'COMPLETED') {
        // Execute next action in chain
        await executeActionCycle(taskId, nextTaskState.current_action);
      } else if (nextTaskState.state === 'COMPLETED') {
        setActiveTaskId(null);
      }
    } catch (err: any) {
      setTaskState('FAILED');
      addAssistantMessage(`Action execution failed: ${err.message}`);
    } finally {
      setIsExecutingAction(false);
    }
  };

  /** Handle user approval of consequential action */
  const handleApprove = async () => {
    if (!activeTaskId || !pendingApproval) return;
    const approvalReq = pendingApproval;
    setPendingApproval(null);

    try {
      const taskRes = await RecareApiClient.submitApproval(
        activeTaskId,
        { approval_id: approvalReq.approval_id, approved: true },
        pageContext || undefined
      );

      setTaskState(taskRes.state);
      if (taskRes.current_action) {
        await executeActionCycle(activeTaskId, taskRes.current_action);
      }
    } catch (err: any) {
      addAssistantMessage(`Approval error: ${err.message}`);
    }
  };

  /** Handle rejection / cancel of consequential action */
  const handleReject = async () => {
    if (!activeTaskId || !pendingApproval) return;
    const approvalReq = pendingApproval;
    setPendingApproval(null);

    try {
      await RecareApiClient.submitApproval(
        activeTaskId,
        { approval_id: approvalReq.approval_id, approved: false },
        pageContext || undefined
      );
      setTaskState('CANCELLED');
      setActiveTaskId(null);
      addAssistantMessage('Action approval was rejected. Task cancelled.');
    } catch (err: any) {
      addAssistantMessage(`Error rejecting action: ${err.message}`);
    }
  };

  const handleStop = async () => {
    if (activeTaskId) {
      try {
        await RecareApiClient.cancelTask(activeTaskId);
      } catch {}
      setActiveTaskId(null);
    }
    setTaskState('CANCELLED');
    setPendingApproval(null);
    await MessagingService.clearHighlights();
    addAssistantMessage('Task stopped immediately. No further actions will be executed.');
  };

  const handlePause = () => {
    setTaskState('PAUSED');
  };

  const handleResume = () => {
    setTaskState('EXECUTING');
  };

  const handleTakeover = async () => {
    handleStop();
    addAssistantMessage('Manual takeover initiated. You have direct control of the webpage.');
  };

  const handleNewConversation = async () => {
    setMessages([]);
    setActiveConversationId(null);
    setConversationCreatedAt(null);
    await StorageService.setActiveConversationId(null);
    setActiveTaskId(null);
    setTaskState('IDLE');
    setPendingApproval(null);
    setInferencePath('idle');
    try {
      await MessagingService.sendToActiveTab({ type: 'CLEAR_HIGHLIGHTS' });
    } catch {}
    setShowHistory(false);
  };

  const handleSelectConversation = async (conv: StoredConversation) => {
    setActiveConversationId(conv.id);
    setConversationCreatedAt(conv.createdAt);
    setMessages(conv.messages || []);
    await StorageService.setActiveConversationId(conv.id);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (convId: string) => {
    if (convId === activeConversationId) {
      setMessages([]);
      setActiveConversationId(null);
      setConversationCreatedAt(null);
    }
  };

  return (
    <div
      className={`flex flex-col h-screen w-full bg-white select-text ${
        preferences.text_size === 'small'
          ? 'text-size-small'
          : preferences.text_size === 'large'
          ? 'text-size-large'
          : preferences.text_size === 'xlarge'
          ? 'text-size-xlarge'
          : 'text-size-medium'
      } ${preferences.high_contrast ? 'high-contrast-mode' : ''} ${
        preferences.reduced_motion ? 'reduced-motion-mode' : ''
      }`}
    >
      <Header
        currentDomain={pageContext?.domain}
        isBackendConnected={isBackendConnected}
        inferencePath={inferencePath}
        onNewConversation={handleNewConversation}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenLocalModelSetup={() => setShowLocalModelSetup(true)}
      />

      <InteractionModeSelector
        currentMode={preferences.interaction_mode}
        onModeChange={(mode) => handlePreferencesUpdate({ interaction_mode: mode })}
      />

      {pendingApproval && (
        <ApprovalPrompt
          request={pendingApproval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      <ConversationArea
        messages={messages}
        onSuggestedAction={handleUserMessage}
        speechRate={preferences.speech_rate}
      />

      <TaskControls
        state={taskState}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onTakeover={handleTakeover}
      />

      <Composer
        onSendMessage={handleUserMessage}
        disabled={isExecutingAction || taskState === 'WAITING_FOR_USER_APPROVAL'}
        isLiveVoice={isLiveVoiceActive}
        onToggleLiveVoice={setIsLiveVoiceActive}
        onRegisterListenTrigger={(triggerFn) => {
          listenTriggerRef.current = triggerFn;
        }}
      />

      {showSettings && (
        <AccessibilitySettings
          preferences={preferences}
          onUpdate={handlePreferencesUpdate}
          onOpenLocalModelSetup={() => setShowLocalModelSetup(true)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHistory && (
        <TaskHistory
          activeConversationId={activeConversationId}
          onClose={() => setShowHistory(false)}
          onNewConversation={handleNewConversation}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onSelectTask={(t) => {
            setShowHistory(false);
            addAssistantMessage(
              `Viewing task ${t.task_id.slice(0, 8)} (${t.state}): "${t.user_request}"`,
              undefined,
              t.plan
            );
          }}
        />
      )}

      {showLocalModelSetup && (
        <LocalModelModal onClose={() => setShowLocalModelSetup(false)} />
      )}

      {showOnboarding && <OnboardingModal onFinish={handleOnboardingFinish} />}
    </div>
  );
}
