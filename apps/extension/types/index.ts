export type InteractionMode = 'guide' | 'assist' | 'autonomous';

export type TaskState =
  | 'IDLE'
  | 'UNDERSTANDING'
  | 'PLANNING'
  | 'WAITING_FOR_ACTION'
  | 'EXECUTING'
  | 'WAITING_FOR_USER_APPROVAL'
  | 'WAITING_FOR_USER_INPUT'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ElementMetadata {
  element_id: string;
  role?: string;
  tag: string;
  accessible_name?: string;
  text?: string;
  selector?: string;
  is_visible: boolean;
  is_enabled: boolean;
  input_type?: string;
  current_value?: string;
  placeholder?: string;
  href?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HeadingItem {
  level: number;
  text: string;
}

export interface PageContext {
  url: string;
  domain: string;
  title: string;
  headings: HeadingItem[];
  interactive_elements: ElementMetadata[];
  main_content_summary?: string;
  notifications?: string[];
  screenshot_base64?: string;
  timestamp?: string;
}

export type ActionType =
  | 'CLICK'
  | 'TYPE'
  | 'FILL'
  | 'SELECT'
  | 'SCROLL'
  | 'NAVIGATE'
  | 'HIGHLIGHT'
  | 'READ'
  | 'WAIT'
  | 'PRESS_KEY'
  | 'REQUEST_FILE_UPLOAD';

export interface BrowserActionTarget {
  element_id?: string;
  selector?: string;
  accessible_name?: string;
  role?: string;
}

export interface BrowserAction {
  action_id: string;
  type: ActionType;
  target?: BrowserActionTarget;
  value?: string;
  options?: Record<string, any>;
  reason: string;
  requires_approval: boolean;
  risk_level: RiskLevel;
}

export interface ActionResult {
  action_id: string;
  success: boolean;
  error?: string;
  observed_changes?: Record<string, any>;
  current_url?: string;
}

export interface PlanStep {
  step_number: number;
  description: string;
  action_type?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  risk_level: RiskLevel;
}

export interface ApprovalResponse {
  approval_id: string;
  approved: boolean;
}

export interface ApprovalRequest {
  approval_id: string;
  task_id: string;
  action_id: string;
  action_type: string;
  risk_level: RiskLevel;
  target_description: string;
  reason: string;
  affected_domain?: string;
  data_payload?: string;
}

export interface TaskResponse {
  task_id: string;
  state: TaskState;
  mode: InteractionMode;
  user_request: string;
  plan?: PlanStep[];
  current_action?: BrowserAction;
  pending_approval?: ApprovalRequest;
  message?: string;
  completion_summary?: string;
  error?: string;
}

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  spokenText?: string;
  timestamp: string;
  plan?: PlanStep[];
  state?: TaskState;
  suggestedActions?: string[];
  inferenceSource?: 'on_device' | 'in_cloud';
  modelUsed?: string;
  attachment?: {
    base64: string;
    mimeType: string;
    name: string;
    previewUrl?: string;
  };
}

export interface StoredConversation {
  id: string;
  title: string;
  domain?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageItem[];
}

export interface UserPreferences {
  interaction_mode: InteractionMode;
  inference_mode: 'PREFER_ON_DEVICE' | 'ONLY_ON_DEVICE' | 'PREFER_IN_CLOUD' | 'ONLY_IN_CLOUD';
  speech_rate: number;
  text_size: 'small' | 'medium' | 'large' | 'xlarge';
  voice_enabled: boolean;
  response_output_mode: 'both' | 'text' | 'voice';
  voice_gender: string;
  simplified_language: boolean;
  reduced_motion: boolean;
  high_contrast: boolean;
  auto_approve_low_risk: boolean;
}

// Extension Internal Messages
export type ExtensionMessage =
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'EXECUTE_ACTION'; action: BrowserAction }
  | { type: 'HIGHLIGHT_ELEMENT'; element_id?: string; selector?: string; label?: string }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'PING' };

export type ExtensionResponse =
  | { success: true; page_context: PageContext }
  | { success: true; result: ActionResult }
  | { success: true }
  | { success: false; error: string };
