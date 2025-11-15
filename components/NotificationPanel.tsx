import React, { useRef, useEffect } from 'react';
import { Invitation } from '../types';
import NotificationItem from './NotificationItem';
import { BellRing } from 'lucide-react';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Invitation[];
  onAccept: (invitation: Invitation) => Promise<void>;
  onDecline: (invitationId: string) => Promise<void>;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications, onAccept, onDecline }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click target is the bell icon itself to prevent immediate closing
      const bellButton = (event.target as HTMLElement).closest('button[title="Thông báo"]');
      if (panelRef.current && !panelRef.current.contains(event.target as Node) && !bellButton) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-14 right-0 w-80 bg-slate-800/80 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50 flex flex-col max-h-[400px] animate-fadeIn"
    >
      <div className="p-3 border-b border-white/10">
        <h3 className="font-semibold text-white">Thông báo</h3>
      </div>
      <div className="flex-grow overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map(inv => (
            <NotificationItem
              key={inv.id}
              invitation={inv}
              onAccept={onAccept}
              onDecline={onDecline}
            />
          ))
        ) : (
          <div className="p-6 text-center text-sm text-slate-400">
            <BellRing size={24} className="mx-auto mb-2"/>
            <p>Bạn không có thông báo mới.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
