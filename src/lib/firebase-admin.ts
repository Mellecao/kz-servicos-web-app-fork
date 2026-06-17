import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import type { ServiceAccount } from 'firebase-admin'
import serviceAccount from '../../kz-notifica-serviceaccount.json'

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    projectId: 'kz-notifica',
  })
}

export const adminAuth = getAuth()
export const adminFirestore = getFirestore()
export const adminMessaging = getMessaging()
