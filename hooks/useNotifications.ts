import { useState, useEffect, useCallback } from 'react';
import { Invitation } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

export const useNotifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Invitation[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    if (!currentUser?.email) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'invitations'),
      where('inviteeEmail', '==', currentUser.email),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Invitation));
      setNotifications(invs);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const acceptInvitation = useCallback(async (invitation: Invitation) => {
    if (!currentUser) return;
    try {
      const batch = writeBatch(db);
      
      const projectRef = doc(db, 'projects', invitation.projectId);
      batch.update(projectRef, { memberIds: arrayUnion(currentUser.uid) });

      const invitationRef = doc(db, 'invitations', invitation.id);
      batch.update(invitationRef, { status: 'accepted' });

      await batch.commit();
      addToast(`Bạn đã tham gia dự án "${invitation.projectName}"!`, 'success');
    } catch (error) {
      console.error("Error accepting invitation: ", error);
      addToast("Không thể chấp nhận lời mời.", 'error');
    }
  }, [currentUser, addToast]);
  
  const declineInvitation = useCallback(async (invitationId: string) => {
    try {
      const invitationRef = doc(db, 'invitations', invitationId);
      await updateDoc(invitationRef, { status: 'declined' });
      addToast("Đã từ chối lời mời.", 'info');
    } catch (error) {
      console.error("Error declining invitation: ", error);
      addToast("Không thể từ chối lời mời.", 'error');
    }
  }, [addToast]);

  return { notifications, acceptInvitation, declineInvitation };
};
