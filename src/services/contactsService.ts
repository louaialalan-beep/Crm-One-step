import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Account, Contact, RecycleBinItem, Touchpoint } from '../types/crm';
import { executeWithAdapter, stripUndefinedFields } from './apiClient';

export const contactsService = {
  async listContacts(params: {
    orgId: string;
    fallbackContacts?: Contact[];
  }): Promise<Contact[]> {
    return executeWithAdapter({
      endpoint: '/api/v1/contacts',
      method: 'GET',
      orgId: params.orgId,
      fallback: () => params.fallbackContacts || [],
    });
  },

  async createContactWithTouchpoint(params: {
    orgId: string;
    isCloudMode: boolean;
    contact: Contact;
    newAccount: Account | null;
    initialTouchpoint: Touchpoint;
    onPreviewApply: () => void;
  }): Promise<Contact> {
    return executeWithAdapter({
      endpoint: '/api/v1/contacts',
      method: 'POST',
      orgId: params.orgId,
      payload: {
        lead_uid: params.contact.leadUniqueId,
        full_name: params.contact.fullName,
        job_title: params.contact.jobTitle,
        email: params.contact.email,
        phone: params.contact.phone,
        company_name: params.contact.accountName,
        owner_id: params.contact.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return params.contact;
        }
        try {
          const batch = writeBatch(db);
          if (params.newAccount) {
            const { id: accId, ...accRest } = params.newAccount;
            batch.set(doc(db, 'accounts', accId), {
              ...stripUndefinedFields(accRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          const { id: conId, ...conRest } = params.contact;
          batch.set(doc(db, 'contacts', conId), {
            ...stripUndefinedFields(conRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const { id: tpId, ...tpRest } = params.initialTouchpoint;
          batch.set(doc(db, 'touchpoints', tpId), {
            ...stripUndefinedFields(tpRest),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `contacts/${params.contact.id}`);
        }
        return params.contact;
      },
    });
  },

  async updateContactFields(params: {
    orgId: string;
    isCloudMode: boolean;
    contactId: string;
    patch: Partial<Contact>;
    onPreviewApply: () => void;
  }): Promise<void> {
    return executeWithAdapter({
      endpoint: `/api/v1/contacts/${params.contactId}`,
      method: 'PATCH',
      orgId: params.orgId,
      payload: {
        full_name: params.patch.fullName,
        job_title: params.patch.jobTitle,
        email: params.patch.email,
        phone: params.patch.phone,
        company_name: params.patch.accountName,
        owner_id: params.patch.ownerId,
      },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          await updateDoc(doc(db, 'contacts', params.contactId), {
            ...stripUndefinedFields(params.patch),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `contacts/${params.contactId}`);
        }
      },
    });
  },

  async softDeleteContacts(params: {
    orgId: string;
    isCloudMode: boolean;
    targets: Contact[];
    recycleEntries: RecycleBinItem[];
    onPreviewApply: () => void;
  }): Promise<void> {
    const firstId = params.targets[0]?.id;
    return executeWithAdapter({
      endpoint: firstId ? `/api/v1/contacts/${firstId}` : '/api/v1/contacts/soft-delete',
      method: firstId && params.targets.length === 1 ? 'DELETE' : 'POST',
      orgId: params.orgId,
      payload:
        firstId && params.targets.length === 1
          ? undefined
          : { contactIds: params.targets.map((c) => c.id) },
      fallback: async () => {
        if (!params.isCloudMode) {
          params.onPreviewApply();
          return;
        }
        try {
          const batch = writeBatch(db);
          for (const entry of params.recycleEntries) {
            const { id: rbId, ...rbRest } = entry;
            batch.set(doc(db, 'recycle_bin', rbId), {
              ...stripUndefinedFields(rbRest),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const contact of params.targets) {
            batch.delete(doc(db, 'contacts', contact.id));
          }
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'contacts_soft_delete');
        }
      },
    });
  },
};
