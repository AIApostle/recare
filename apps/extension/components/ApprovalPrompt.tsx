import React from 'react';
import { ApprovalRequest } from '../types';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';

interface ApprovalPromptProps {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalPrompt: React.FC<ApprovalPromptProps> = ({
  request,
  onApprove,
  onReject,
}) => {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="approval-title"
      aria-describedby="approval-desc"
      className="m-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl shadow-md text-gray-900"
    >
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded bg-amber-200 text-amber-900 tracking-wider">
              {request.risk_level} Risk Confirmation
            </span>
            <span className="text-xs text-gray-500 font-mono">[{request.action_type}]</span>
          </div>
          <h2 id="approval-title" className="mt-1 text-sm font-bold text-gray-900">
            Permission Required to Proceed
          </h2>
          <p id="approval-desc" className="mt-1 text-xs text-gray-700 leading-relaxed">
            {request.reason}
          </p>

          <div className="mt-2.5 p-2 bg-white rounded-lg border border-amber-200 text-xs">
            <div className="font-semibold text-gray-800">Target:</div>
            <div className="text-gray-600 font-mono text-[11px] truncate">{request.target_description}</div>
            {request.affected_domain && (
              <div className="mt-1 text-[11px] text-gray-500">
                Website: <span className="font-medium text-gray-700">{request.affected_domain}</span>
              </div>
            )}
            {request.data_payload && (
              <div className="mt-1 text-[11px] text-gray-600">
                Payload: <span className="font-mono bg-gray-100 px-1 rounded">{request.data_payload}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center space-x-2">
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-recare-600 hover:bg-recare-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve Action</span>
            </button>
            <button
              type="button"
              onClick={onReject}
              className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Task</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
