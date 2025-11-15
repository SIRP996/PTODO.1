
import React, { useState, useEffect, useMemo } from 'react';
import { Project, UserProfile, Invitation } from '../types';
import { User } from 'firebase/auth';
import { X, Users, UserPlus, Mail, Send, Loader2, Trash2, Clock, UserCircle } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

interface MemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  currentUser: User;
  profiles: Map<string, UserProfile>;
  onInviteUser: (project: Project, email: string) => Promise<void>;
  onRemoveUser: (projectId: string, userId: string) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
}

const MemberManagerModal: React.FC<MemberManagerModalProps> = ({
  isOpen,
  onClose,
  project,
  currentUser,
  profiles,
  onInviteUser,
  onRemoveUser,
  onCancelInvitation,
}) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const { addToast } = useToast();

  const members = useMemo(() => {
    if (!isOpen) return [];
    return project.memberIds
      .map(id => profiles.get(id))
      .filter((p): p is UserProfile => !!p);
  }, [isOpen, project.memberIds, profiles]);


  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);

    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('projectId', '==', project.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
      const invs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Invitation));
      setInvitations(invs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching invitations:", error);
      addToast("Không thể tải danh sách lời mời.", "error");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, project.id, addToast]);
  
  const handleInvite = async () => {
    if (!inviteeEmail.trim()) return;
    setIsInviting(true);
    await onInviteUser(project, inviteeEmail.trim());
    setInviteeEmail('');
    setIsInviting(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 max-w-2xl w-full rounded-2xl shadow-2xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users size={20} className="text-primary-400" /> Quản lý Thành viên</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>

        <div className="flex-grow p-6 overflow-y-auto space-y-6">
            {isLoading && members.length < project.memberIds.length ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary-400"/></div>
            ) : (
                <>
                    {/* Current Members */}
                    <div>
                        <h4 className="text-md font-semibold text-slate-300 mb-3">Thành viên trong "{project.name}" ({members.length})</h4>
                        <div className="space-y-2">
                            {members.map(member => (
                                <div key={member.uid} className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                            {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : <UserCircle size={20} className="text-slate-400" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-200">{member.displayName} {member.uid === currentUser.uid && '(Bạn)'}</p>
                                            <p className="text-xs text-slate-400">{member.email}</p>
                                        </div>
                                        {member.uid === project.ownerId && <span className="text-xs bg-primary-900/50 text-primary-300 px-2 py-0.5 rounded-full">Chủ sở hữu</span>}
                                    </div>
                                    {currentUser.uid === project.ownerId && member.uid !== currentUser.uid && (
                                        <button onClick={() => onRemoveUser(project.id, member.uid)} className="p-2 text-slate-500 hover:text-red-400 rounded-full transition-colors" title="Xóa thành viên"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pending Invitations */}
                    {currentUser.uid === project.ownerId && invitations.length > 0 && (
                        <div>
                             <h4 className="text-md font-semibold text-slate-300 mb-3">Lời mời đang chờ ({invitations.length})</h4>
                             <div className="space-y-2">
                                {invitations.map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center"><Clock size={18} className="text-amber-400"/></div>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-300">{inv.inviteeEmail}</p>
                                                <p className="text-xs text-slate-500">Đang chờ phản hồi</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onCancelInvitation(inv.id)} className="p-2 text-slate-500 hover:text-red-400 rounded-full transition-colors" title="Hủy lời mời"><X size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>

        {currentUser.uid === project.ownerId ? (
            <div className="p-4 border-t border-slate-700 flex-shrink-0">
                <h4 className="text-md font-semibold text-slate-300 mb-3 flex items-center gap-2"><UserPlus size={18}/> Mời thành viên mới</h4>
                <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500"><Mail size={16}/></span>
                        <input
                            type="email"
                            value={inviteeEmail}
                            onChange={e => setInviteeEmail(e.target.value)}
                            placeholder="Nhập email của thành viên"
                            className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg pl-10 pr-4 py-2 transition text-sm"
                            disabled={isInviting}
                        />
                    </div>
                    <button
                        onClick={handleInvite}
                        disabled={isInviting || !inviteeEmail.trim()}
                        className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-lg transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
                    >
                        {isInviting ? <Loader2 className="animate-spin" size={20}/> : <Send size={20} />}
                    </button>
                </div>
            </div>
        ) : (
            <div className="p-4 border-t border-slate-700 flex-shrink-0">
                <p className="text-sm text-slate-500 text-center italic">Chỉ chủ sở hữu dự án mới có thể mời thành viên mới.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default MemberManagerModal;
