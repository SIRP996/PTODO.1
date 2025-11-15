import React, { useState } from 'react';
import { Invitation } from '../types';
import { Check, X, Loader2 } from 'lucide-react';

interface NotificationItemProps {
  invitation: Invitation;
  onAccept: (invitation: Invitation) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ invitation, onAccept, onDecline }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    await onAccept(invitation);
    // Component will unmount, no need to setIsProcessing(false)
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    await onDecline(invitation.id);
    // Component will unmount, no need to setIsProcessing(false)
  };

  return (
    <div className="p-3 border-b border-white/10 last:border-b-0 hover:bg-slate-700/50 transition-colors">
      <p className="text-sm text-slate-300 mb-2">
        <span className="font-semibold text-white">{invitation.inviterName}</span> đã mời bạn tham gia dự án <span className="font-semibold text-white">"{invitation.projectName}"</span>.
      </p>
      <div className="flex items-center justify-end gap-2">
        {isProcessing ? (
          <Loader2 className="animate-spin text-slate-400" size={16} />
        ) : (
          <>
            <button
              onClick={handleDecline}
              className="p-1.5 bg-slate-700 hover:bg-red-900/50 text-slate-300 hover:text-red-400 rounded-md transition-colors"
              title="Từ chối"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleAccept}
              className="p-1.5 bg-slate-700 hover:bg-green-900/50 text-slate-300 hover:text-green-400 rounded-md transition-colors"
              title="Chấp nhận"
            >
              <Check size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationItem;
