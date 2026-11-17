import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CrmTask,
  InboxMessage,
  SignalNotification,
} from '../types/crm';
import { PREVIEW_OWNER_ID, stripUndefined, useAuth } from './AuthContext';
import { useSetup } from './SetupContext';

export interface CommsActivitiesContextValue {
  tasks: CrmTask[];
  messages: InboxMessage[];
  signals: SignalNotification[];

  inboxOpen: boolean;
  inboxFilterLeadId: string | null;
  inboxFilterContactId: string | null;
  openInboxForLead: (leadId?: string) => void;
  openInboxForContact: (contactId?: string) => void;
  closeInbox: () => void;
  clearInboxLeadFilter: () => void;
  clearInboxContactFilter: () => void;

  toggleTaskStatus: (taskId: string) => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  sendInboxReply: (
    channel: InboxMessage['channel'],
    recipientName: string,
    body: string,
    meta?: { leadId?: string; contactId?: string; leadUniqueId?: string; companyName?: string }
  ) => Promise<void>;
  markAllSignalsRead: () => void;
}

const CommsActivitiesContext = createContext<CommsActivitiesContextValue | null>(null);

export function CommsActivitiesProvider({ children }: { children: React.ReactNode }) {
  const {
    firebaseUser,
    currentUser,
    currentOrgId,
    belongsToCurrentOrg,
    data,
    setData,
    signals,
    setSignals,
  } = useAuth();
  const { canViewRecord, canViewChat } = useSetup();

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxFilterLeadId, setInboxFilterLeadId] = useState<string | null>(null);
  const [inboxFilterContactId, setInboxFilterContactId] = useState<string | null>(null);

  const openInboxForLead = useCallback((leadId?: string) => {
    setInboxFilterContactId(null);
    setInboxFilterLeadId(leadId ?? null);
    setInboxOpen(true);
  }, []);

  const openInboxForContact = useCallback((contactId?: string) => {
    setInboxFilterLeadId(null);
    setInboxFilterContactId(contactId ?? null);
    setInboxOpen(true);
  }, []);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
  }, []);

  const clearInboxLeadFilter = useCallback(() => {
    setInboxFilterLeadId(null);
  }, []);

  const clearInboxContactFilter = useCallback(() => {
    setInboxFilterContactId(null);
  }, []);

  const toggleTaskStatus = useCallback(
    async (taskId: string) => {
      const task = data.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const nextStatus: CrmTask['status'] = task.status === 'مكتملة' ? 'قيد التنفيذ' : 'مكتملة';

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      }
    },
    [data.tasks, firebaseUser, setData]
  );

  const markMessageRead = useCallback(
    async (messageId: string) => {
      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          messages: prev.messages.map((m) => (m.id === messageId ? { ...m, unread: false } : m)),
        }));
        return;
      }

      try {
        await updateDoc(doc(db, 'messages', messageId), {
          unread: false,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `messages/${messageId}`);
      }
    },
    [firebaseUser, setData]
  );

  const sendInboxReply = useCallback(
    async (
      channel: InboxMessage['channel'],
      recipientName: string,
      body: string,
      meta?: { leadId?: string; contactId?: string; leadUniqueId?: string; companyName?: string }
    ) => {
      const cleanBody = body.trim();
      if (!cleanBody) return;
      const ownerId = firebaseUser?.uid ?? PREVIEW_OWNER_ID;
      const msgId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const newMsg: InboxMessage = {
        id: msgId,
        ownerId,
        org_id: currentOrgId,
        channel,
        senderName: currentUser.fullName,
        companyName: meta?.companyName ?? recipientName,
        subject: `رد صادر إلى ${recipientName}`,
        body: cleanBody,
        direction: 'outbound',
        unread: false,
        timestampLabel: 'الآن',
        leadId: meta?.leadId,
        leadUniqueId: meta?.leadUniqueId,
      };

      if (!firebaseUser) {
        setData((prev) => ({
          ...prev,
          messages: [newMsg, ...prev.messages],
          leads: meta?.leadId
            ? prev.leads.map((l) =>
                l.id === meta.leadId
                  ? {
                      ...l,
                      awaitingReplyHours: 0,
                      lastActivityLabel: 'الآن',
                      lastMessageSnippet: cleanBody,
                    }
                  : l
              )
            : prev.leads,
          contacts: meta?.contactId
            ? prev.contacts.map((c) =>
                c.id === meta.contactId
                  ? {
                      ...c,
                      lastActivityLabel: 'الآن',
                      lastMessageSnippet: cleanBody,
                    }
                  : c
              )
            : prev.contacts,
        }));
        return;
      }

      try {
        const { id: _id, ...rest } = newMsg;
        await setDoc(doc(db, 'messages', msgId), {
          ...stripUndefined(rest),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (meta?.leadId) {
          await updateDoc(doc(db, 'leads', meta.leadId), {
            awaitingReplyHours: 0,
            lastActivityLabel: 'الآن',
            lastMessageSnippet: cleanBody.slice(0, 280),
            updatedAt: serverTimestamp(),
          });
        }
        if (meta?.contactId) {
          await updateDoc(doc(db, 'contacts', meta.contactId), {
            lastActivityLabel: 'الآن',
            lastMessageSnippet: cleanBody.slice(0, 280),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `messages/${msgId}`);
      }
    },
    [currentOrgId, currentUser.fullName, firebaseUser, setData]
  );

  const markAllSignalsRead = useCallback(() => {
    setSignals((prev) => prev.map((s) => ({ ...s, unread: false })));
  }, [setSignals]);

  const scopedMessages = useMemo(
    () =>
      data.messages.filter(
        (m) => belongsToCurrentOrg(m.org_id) && canViewChat(m.senderName || m.ownerId)
      ),
    [belongsToCurrentOrg, canViewChat, data.messages]
  );

  const scopedTasks = useMemo(
    () =>
      data.tasks.filter(
        (t) => belongsToCurrentOrg(t.org_id) && canViewRecord(t.assignedToName || t.ownerId)
      ),
    [belongsToCurrentOrg, canViewRecord, data.tasks]
  );

  const value = useMemo<CommsActivitiesContextValue>(
    () => ({
      tasks: scopedTasks,
      messages: scopedMessages,
      signals,
      inboxOpen,
      inboxFilterLeadId,
      inboxFilterContactId,
      openInboxForLead,
      openInboxForContact,
      closeInbox,
      clearInboxLeadFilter,
      clearInboxContactFilter,
      toggleTaskStatus,
      markMessageRead,
      sendInboxReply,
      markAllSignalsRead,
    }),
    [
      scopedTasks,
      scopedMessages,
      signals,
      inboxOpen,
      inboxFilterLeadId,
      inboxFilterContactId,
      openInboxForLead,
      openInboxForContact,
      closeInbox,
      clearInboxLeadFilter,
      clearInboxContactFilter,
      toggleTaskStatus,
      markMessageRead,
      sendInboxReply,
      markAllSignalsRead,
    ]
  );

  return (
    <CommsActivitiesContext.Provider value={value}>
      {children}
    </CommsActivitiesContext.Provider>
  );
}

export function useCommsActivities(): CommsActivitiesContextValue {
  const ctx = useContext(CommsActivitiesContext);
  if (!ctx) {
    throw new Error('useCommsActivities must be used inside CommsActivitiesProvider');
  }
  return ctx;
}
