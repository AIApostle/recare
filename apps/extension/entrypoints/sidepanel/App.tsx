import React, { useState, useEffect, useRef } from 'react';
import {
  InteractionMode,
  TaskState,
  PageContext,
  BrowserAction,
  ApprovalRequest,
  UserPreferences,
} from '../../types';
import { StorageService, DEFAULT_PREFERENCES } from '../../services/storage';
import { MessagingService } from '../../services/messaging';
import { RecareApiClient } from '../../services/api';
import { VoiceService } from '../../services/voice';
import { Header } from '../../components/Header';
import { InteractionModeSelector } from '../../components/InteractionModeSelector';
import { ConversationArea, ChatMessageItem } from '../../components/ConversationArea';
import { ApprovalPrompt } from '../../components/ApprovalPrompt';
import { TaskControls } from '../../components/TaskControls';
import { Composer } from '../../components/Composer';
import { AccessibilitySettings } from '../../components/AccessibilitySettings';
import { OnboardingModal } from '../../components/OnboardingModal';
import { TaskHistory } from '../../components/TaskHistory';

export default function App() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);

  // Active page state
  const [pageContext, setPageContext] = useState<PageContext | null>(null);

  // Active task state machine
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskState, setTaskState] = useState<TaskState>('IDLE');
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Chat conversation history
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  // Load preferences and check health on mount
  useEffect(() => {
    async function init() {
      const prefs = await StorageService.getPreferences();
      setPreferences(prefs);

      const onboardingDone = await StorageService.isOnboardingCompleted();
      if (!onboardingDone) {
        setShowOnboarding(true);
      }

      const healthy = await RecareApiClient.checkHealth();
      setIsBackendConnected(healthy);

      // Fetch active page context
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
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  const refreshPageContext = async () => {
    try {
      const ctx = await MessagingService.getPageContext();
      if (ctx) {
        setPageContext(ctx);
      }
    } catch (e) {
      console.warn('Could not fetch active page context:', e);
    }
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
    suggestedActions?: string[]
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
      },
    ]);

    if (preferences.voice_enabled && spokenText) {
      VoiceService.speak(spokenText, preferences.speech_rate);
    }
  };

  /** Handle user prompt input (text or speech) */
  const handleUserMessage = async (userInput: string) => {
    addUserMessage(userInput);
    await refreshPageContext();

    // GUIDE mode or question: route to Chat endpoint
    if (preferences.interaction_mode === 'guide' || userInput.endsWith('?') || userInput.toLowerCase().startsWith('what') || userInput.toLowerCase().startsWith('explain')) {
      try {
        const chatRes = await RecareApiClient.sendChat(
          userInput,
          pageContext || undefined,
          preferences.interaction_mode,
          preferences.simplified_language
        );

        // Highlight requested element if returned
        if (chatRes.highlight_targets && chatRes.highlight_targets.length > 0) {
          const target = chatRes.highlight_targets[0];
          await MessagingService.highlightElement(target.element_id, target.selector, target.label);
        }

        addAssistantMessage(
          chatRes.reply,
          chatRes.spoken_summary,
          undefined,
          chatRes.suggested_actions
        );
      } catch (err: any) {
        addAssistantMessage(`Sorry, I encountered an issue: ${err.message}`);
      }
      return;
    }

    // ASSIST or AUTONOMOUS mode: Start task execution state machine
    try {
      setTaskState('PLANNING');
      const taskRes = await RecareApiClient.createTask(
        userInput,
        preferences.interaction_mode,
        pageContext || undefined
      );

      setActiveTaskId(taskRes.task_id);
      setTaskState(taskRes.state);

      if (taskRes.message) {
        addAssistantMessage(taskRes.message, taskRes.message, taskRes.plan);
      }

      // Check if approval is required before action
      if (taskRes.pending_approval) {
        setPendingApproval(taskRes.pending_approval);
        setTaskState('WAITING_FOR_USER_APPROVAL');
        return;
      }

      // If action is ready to execute immediately
      if (taskRes.current_action) {
        await executeActionCycle(taskRes.task_id, taskRes.current_action);
      }
    } catch (err: any) {
      setTaskState('FAILED');
      addAssistantMessage(`Could not start task: ${err.message}`);
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
      } ${preferences.high_contrast ? 'contrast-125' : ''}`}
    >
      <Header
        currentDomain={pageContext?.domain}
        isBackendConnected={isBackendConnected}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
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
      />

      {showSettings && (
        <AccessibilitySettings
          preferences={preferences}
          onUpdate={handlePreferencesUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHistory && (
        <TaskHistory
          onClose={() => setShowHistory(false)}
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

      {showOnboarding && <OnboardingModal onFinish={handleOnboardingFinish} />}
    </div>
  );
}
