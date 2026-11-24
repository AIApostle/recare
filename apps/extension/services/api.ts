import {
  TaskResponse,
  PageContext,
  ActionResult,
  ApprovalResponse,
  InteractionMode,
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_RECARE_API_URL || 'http://127.0.0.1:8000';

export class RecareApiClient {
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  static async listTasks(limit: number = 20): Promise<TaskResponse[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tasks?limit=${limit}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  static async sendChat(
    message: string,
    pageContext?: PageContext,
    mode: InteractionMode = 'guide',
    simplified: boolean = false
  ): Promise<{
    reply: string;
    spoken_summary?: string;
    highlight_targets: Array<{ element_id?: string; selector?: string; label?: string }>;
    suggested_actions: string[];
    suggested_task?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        page_context: pageContext,
        mode,
        simplified_language: simplified,
      }),
    });
    if (!res.ok) {
      throw new Error(`Chat error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  static async createTask(
    userRequest: string,
    mode: InteractionMode,
    pageContext?: PageContext
  ): Promise<TaskResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_request: userRequest,
        mode,
        page_context: pageContext,
      }),
    });
    if (!res.ok) {
      throw new Error(`Task creation error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  static async submitActionResult(
    taskId: string,
    actionResult: ActionResult,
    pageContext?: PageContext
  ): Promise<TaskResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}/action-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_result: actionResult,
        page_context: pageContext,
      }),
    });
    if (!res.ok) {
      throw new Error(`Action result submission error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  static async submitApproval(
    taskId: string,
    approval: ApprovalResponse,
    pageContext?: PageContext
  ): Promise<TaskResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval,
        page_context: pageContext,
      }),
    });
    if (!res.ok) {
      throw new Error(`Approval error (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  static async cancelTask(taskId: string): Promise<TaskResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Task cancel error: ${await res.text()}`);
    }
    return res.json();
  }
}
