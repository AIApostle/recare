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
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
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
  const [liveWorkingStatus, setLiveWorkingStatus] = useState<string | null>(null);

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

      // Try to load conversations from server first, fall back to local cache
      let conversations = savedConvs;
      try {
        const serverConvs = await RecareApiClient.fetchConversations();
        if (serverConvs.length > 0) {
          conversations = serverConvs;
          // Update local cache with server data
          for (const sc of serverConvs.slice(0, 20)) {
            await StorageService.saveConversation(sc);
          }
        }
      } catch {
        // Server unavailable — use local cache
      }

      if (conversations.length > 0) {
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

      // Initialize Firebase AI Logic & persistent WebSocket connection cleanly
      FirebaseAiService.initialize().catch(() => {});
      RecareApiClient.connectRealtime().catch(() => {});

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
    RecareApiClient.syncConversation(record).catch(() => {});
  }, [messages, activeConversationId, conversationCreatedAt, pageContext?.domain, pageContext?.url]);

  const refreshPageContext = async (): Promise<PageContext | null> => {
    try {
      const ctx =
        (await MessagingService.getPageContext()) ||
        (await MessagingService.getActiveTabFallbackContext());
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

    const currentPrefs = preferencesRef.current;
    const mode = currentPrefs.response_output_mode || 'both';
    const shouldSpeak =
      (mode === 'both' || mode === 'voice' || currentPrefs.voice_enabled !== false) &&
      mode !== 'text';
    if (shouldSpeak && (spokenText || text)) {
      VoiceService.speak(
        spokenText || text,
        currentPrefs.speech_rate,
        triggerNextLiveListen,
        currentPrefs.voice_gender !== 'neutral' ? currentPrefs.voice_gender : undefined
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
      url: 'about:blank',
      domain: 'browser',
      title: 'Current Tab',
      headings: [],
      interactive_elements: [],
    };

    const trimmedInput = userInput.trim().toLowerCase();

    // Quick suggestion navigation / settings triggers
    if (trimmedInput === 'open settings') {
      setShowSettings(true);
      return;
    }
    if (trimmedInput === 'open local model setup') {
      setShowLocalModelSetup(true);
      return;
    }
    if (trimmedInput === 'switch to cloud ai') {
      await handlePreferencesUpdate({ inference_mode: 'PREFER_IN_CLOUD' });
      addAssistantMessage(
        'Switched to Hybrid Cloud AI! You can now chat, ask questions, and perform actions freely.'
      );
      return;
    }

    let activeMode = preferences.interaction_mode;
    let effectiveRequest = userInput;

    // Detect in-chat mode switching: e.g. "now you are an auto", "switch to auto", "set mode to guide"
    const modeSwitchMatch = trimmedInput.match(
      /(?:switch to|change mode to|set mode to|now you are (?:an? )?|you are in |mode\s*:\s*)(guide|assist|auto(?:nomous)?)/i
    );
    if (modeSwitchMatch) {
      const modeWord = modeSwitchMatch[1].toLowerCase();
      const newMode: InteractionMode = modeWord.startsWith('auto')
        ? 'autonomous'
        : modeWord === 'guide'
        ? 'guide'
        : 'assist';
      activeMode = newMode;
      await handlePreferencesUpdate({ interaction_mode: newMode });

      // Strip out mode switch prefix so any follow-up command executes immediately
      // e.g. "okay now you are an auto you can open the front page now" -> "open the front page now"
      const cleaned = userInput
        .replace(
          /(?:okay\s+|ok\s+)?(?:now\s+)?(?:you are\s+(?:an?\s+)?|switch to\s+|set mode to\s+)(?:guide|assist|auto(?:nomous)?)(?:\s+mode)?(?:\s+now)?[\s,.:;]*(?:you can\s+)?/i,
          ''
        )
        .trim();
      if (cleaned) {
        effectiveRequest = cleaned;
      } else {
        addAssistantMessage(
          `Switched to ${newMode === 'autonomous' ? 'Auto (Autonomous)' : newMode === 'assist' ? 'Assist' : 'Guide'} mode. ${
            newMode === 'autonomous'
              ? 'I will now autonomously execute browser actions like searching, clicking, navigating, and opening tabs for you.'
              : newMode === 'assist'
              ? 'I will co-pilot and confirm actions with you.'
              : 'I will guide, explain, and highlight controls without taking actions.'
          }`
        );
        return;
      }
    }

    const effectiveTrimmed = effectiveRequest.trim().toLowerCase();

    // Check if user is asking an explanation / capability question (e.g. "can you explain...", "can it perform...")
    const isExplanationQuery =
      /\b(can you explain|explain|can it perform|what is|what are|how do you|how does|what can you do|difference between)\b/i.test(
        effectiveTrimmed
      );

    // Explicit action intent check (user wants Recare to operate the browser right now)
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
      'go back',
      'take me back',
      'previous page',
      'forward',
      'reload',
      'refresh',
      'scroll',
      'select',
      'choose',
      'close',
      'dismiss',
      "didn't",
      'front page',
      'new tab',
      'homepage',
    ];
    const hasExplicitActionIntent =
      !isExplanationQuery && actionWords.some((w) => effectiveTrimmed.includes(w));

    // Conversational / explanation queries go via Firebase hybrid + WebSocket Render Chat
    const isConversational = !hasExplicitActionIntent || activeMode === 'guide';

    // 1. Conversational & Page Understanding
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
          effectiveRequest,
          historyForBackend
        );

        setInferencePath(aiRes.inferenceSource);
        if (aiRes.inferenceSource === 'in_cloud') {
          setIsBackendConnected(true);
        }

        // Highlight candidate elements if mentioned in query
        const words = effectiveRequest.toLowerCase().split(/\s+/);
        const match = currentCtx.interactive_elements.find((el) => {
          const name = (el.accessible_name || el.text || '').toLowerCase();
          return words.some((w) => w.length > 3 && name.includes(w));
        });
        if (match) {
          await MessagingService.highlightElement(match.element_id, match.selector, match.accessible_name);
        }

        const suggestions: string[] = [];
        if (preferences.inference_mode === 'ONLY_ON_DEVICE') {
          suggestions.push('Switch to Cloud AI', 'Open Local Model Setup');
        } else {
          const hasInputs = currentCtx.interactive_elements.some(
            (e) => e.tag === 'input' || e.tag === 'textarea' || e.role === 'textbox'
          );
          const hasButtons = currentCtx.interactive_elements.some(
            (e) => e.tag === 'button' || e.role === 'button' || e.tag === 'a'
          );
          if (hasButtons) suggestions.push('Highlight key buttons');
          if (hasInputs) suggestions.push('Help me fill this form');
          suggestions.push('Explain next step');
          if (currentCtx.domain.includes('newtab') || currentCtx.interactive_elements.length === 0) {
            suggestions.push('Open Test Bench');
          }
        }

        addAssistantMessage(
          aiRes.text,
          aiRes.text,
          undefined,
          suggestions.slice(0, 3),
          aiRes.inferenceSource,
          aiRes.modelUsed
        );
      } catch (err: any) {
        setInferencePath('idle');
        addAssistantMessage(`Sorry, I encountered an issue: ${err.message}`);
      }
      return;
    }

    // 2. Agentic Browser Execution Loop (silent execution -> verify -> report simple result)
    // If user selected ONLY_ON_DEVICE: Run purely on-device without cloud calls
    if (preferences.inference_mode === 'ONLY_ON_DEVICE') {
      setInferencePath('on_device');
      setTaskState('PLANNING');
      setLiveWorkingStatus('Planning on-device...');
      try {
        const localAction = await FirebaseAiService.planLocalAction(
          effectiveRequest,
          currentCtx
        );

        if (localAction) {
          // Check if approval is required before action
          if (localAction.risk_level === 'HIGH' || preferences.auto_approve_low_risk === false) {
            setLiveWorkingStatus(null);
            setPendingApproval({
              approval_id: crypto.randomUUID(),
              task_id: 'local-task',
              action_id: localAction.action_id,
              action_type: localAction.type,
              risk_level: localAction.risk_level,
              target_description:
                localAction.target?.accessible_name ||
                localAction.target?.element_id ||
                'Webpage element',
              reason: localAction.reason,
            });
            setTaskState('WAITING_FOR_USER_APPROVAL');
            return;
          }

          setTaskState('EXECUTING');
          setLiveWorkingStatus(localAction.reason ? `${localAction.reason}...` : 'Performing on-device action...');
          const execRes = await MessagingService.executeBrowserAction(localAction);
          setTaskState('VERIFYING');
          await MessagingService.waitForPageSettle();
          setTaskState('COMPLETED');
          setLiveWorkingStatus(null);

          const replyText =
            localAction.reason ||
            (execRes.success ? 'Action executed on-device.' : 'Could not complete on-device action.');
          addAssistantMessage(
            replyText,
            replyText,
            undefined,
            undefined,
            'on_device',
            'Gemini Nano (On-Device)'
          );
          return;
        }

        // If no explicit browser action was resolved, answer via on-device model
        const localExpl = await FirebaseAiService.explainPageLocally(
          currentCtx,
          preferences.simplified_language,
          'ONLY_ON_DEVICE',
          effectiveRequest,
          historyForBackend
        );
        setInferencePath(localExpl.inferenceSource);
        setTaskState('IDLE');
        setLiveWorkingStatus(null);
        addAssistantMessage(
          localExpl.text,
          localExpl.text,
          undefined,
          preferences.inference_mode === 'ONLY_ON_DEVICE'
            ? ['Switch to Cloud AI', 'Open Local Model Setup']
            : ['Explain next step'],
          localExpl.inferenceSource,
          localExpl.modelUsed
        );
        return;
      } catch (err: any) {
        setLiveWorkingStatus(null);
        setTaskState('IDLE');
        setInferencePath('idle');
        addAssistantMessage(`On-device execution issue: ${err.message || String(err)}`);
        return;
      }
    }

    // Hybrid mode: Use Cloud backend with seamless on-device local fallback
    try {
      setInferencePath('in_cloud');
      setTaskState('PLANNING');
      setLiveWorkingStatus('Working on your request...');

      const taskRes = await RecareApiClient.createTask(
        effectiveRequest,
        activeMode,
        currentCtx,
        (status) => setLiveWorkingStatus(status)
      );

      setIsBackendConnected(true);
      setActiveTaskId(taskRes.task_id);
      setTaskState(taskRes.state);

      // Check if approval is required before action
      if (taskRes.pending_approval) {
        setLiveWorkingStatus(null);
        setPendingApproval(taskRes.pending_approval);
        setTaskState('WAITING_FOR_USER_APPROVAL');
        return;
      }

      // If user disabled auto-approval of safe actions, prompt even for low-risk actions
      if (taskRes.current_action && preferences.auto_approve_low_risk === false) {
        setLiveWorkingStatus(null);
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

      // If action is ready, execute silently & continuously verify until done
      if (taskRes.current_action) {
        await executeActionCycle(taskRes.task_id, taskRes.current_action, 1);
      } else {
        setLiveWorkingStatus(null);
        if (taskRes.message) {
          addAssistantMessage(
            taskRes.message,
            taskRes.message,
            undefined,
            undefined,
            'in_cloud',
            'Recare Cloud'
          );
        }
      }
    } catch (err: any) {
      setLiveWorkingStatus(null);
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
        addAssistantMessage(`Could not reach backend: ${err.message}`);
      }
    }
  };

  /** Execute browser action silently, settle DOM/navigation, re-observe, and loop until verified complete */
  const executeActionCycle = async (taskId: string, action: BrowserAction, depth: number = 1) => {
    if (depth > 8) {
      setLiveWorkingStatus(null);
      setIsExecutingAction(false);
      setTaskState('COMPLETED');
      setActiveTaskId(null);
      addAssistantMessage('I finished the steps I could perform on this page.');
      return;
    }

    setIsExecutingAction(true);
    setTaskState('EXECUTING');
    setLiveWorkingStatus(
      action.reason
        ? `${action.reason}...`
        : depth > 1
        ? `Continuing (step ${depth})...`
        : 'Performing action...'
    );

    try {
      const actionResult = await MessagingService.executeBrowserAction(action);
      setTaskState('VERIFYING');
      setLiveWorkingStatus('Verifying result...');

      // Wait for real page navigation / SPA DOM settle, then capture fresh DOM + screenshot
      await MessagingService.waitForPageSettle();
      const updatedContext = await refreshPageContext();

      // Send updated page observation back to agent orchestrator over WebSocket
      const nextTaskState = await RecareApiClient.submitActionResult(
        taskId,
        actionResult,
        updatedContext || undefined,
        (status) => setLiveWorkingStatus(status)
      );

      setTaskState(nextTaskState.state);

      if (nextTaskState.pending_approval) {
        setLiveWorkingStatus(null);
        setPendingApproval(nextTaskState.pending_approval);
        setTaskState('WAITING_FOR_USER_APPROVAL');
      } else if (nextTaskState.current_action && nextTaskState.state !== 'COMPLETED' && nextTaskState.state !== 'FAILED') {
        // Continue silent multi-step agent loop
        await executeActionCycle(taskId, nextTaskState.current_action, depth + 1);
      } else {
        setLiveWorkingStatus(null);
        setActiveTaskId(null);
        if (nextTaskState.state === 'FAILED' && nextTaskState.error) {
          addAssistantMessage(nextTaskState.error, nextTaskState.error);
        } else if (nextTaskState.message) {
          addAssistantMessage(
            nextTaskState.message,
            nextTaskState.message,
            undefined,
            undefined,
            'in_cloud',
            'Recare Agent'
          );
        }
      }
    } catch (err: any) {
      setLiveWorkingStatus(null);
      setTaskState('FAILED');
      setActiveTaskId(null);
      addAssistantMessage(`I ran into an issue completing that: ${err.message}`);
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
    await RecareApiClient.deleteConversationRemote(convId);
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

      {liveWorkingStatus && (
        <div
          role="status"
          aria-live="polite"
          className="mx-3 mb-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-2 text-xs font-medium shadow-xs"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping flex-shrink-0" />
          <span className="truncate">{liveWorkingStatus}</span>
        </div>
      )}

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
