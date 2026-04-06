import { ref } from 'vue'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { getApp } from 'firebase/app'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const VAPID_KEY_STORAGE = 'bizbuz:fcm-token'

const notificationsEnabled = ref(false)
const notificationPermission = ref(Notification.permission)
const isLoading = ref(false)

let messaging: ReturnType<typeof getMessaging> | null = null

async function initMessaging() {
  if (messaging) return messaging
  const supported = await isSupported()
  if (!supported) return null
  messaging = getMessaging(getApp())
  return messaging
}

export function useNotifications() {
  async function requestPermissionAndSubscribe(familyId: string, uid: string) {
    isLoading.value = true
    try {
      const msg = await initMessaging()
      if (!msg) { isLoading.value = false; return false }

      const permission = await Notification.requestPermission()
      notificationPermission.value = permission
      if (permission !== 'granted') { isLoading.value = false; return false }

      // Register service worker
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

      const token = await getToken(msg, {
        vapidKey: 'BLTbAbRP7T8MHxeZDKR08UaqEJ0hw4AyPTmaVe-YxCIEjndttswcBJZAlSL4hmkakazbego2b4L391RB1UQUkH0',
        serviceWorkerRegistration: swReg,
      })

      if (token) {
        // Store token in Firestore under family's fcm_tokens collection
        await setDoc(
          doc(db, 'families', familyId, 'fcm_tokens', token),
          { uid, token, createdAt: new Date(), userAgent: navigator.userAgent }
        )
        localStorage.setItem(VAPID_KEY_STORAGE, token)
        notificationsEnabled.value = true
      }

      // Handle foreground messages
      onMessage(msg, (payload) => {
        const data = payload.data || {}
        const title = data.title || payload.notification?.title || 'BizBuz'
        const body = data.body || payload.notification?.body || ''
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag: data.tag || 'bizbuz-foreground',
        })
      })

      return true
    } catch (err) {
      console.error('[FCM] Error requesting permission:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function unsubscribe(familyId: string) {
    const token = localStorage.getItem(VAPID_KEY_STORAGE)
    if (token) {
      await deleteDoc(doc(db, 'families', familyId, 'fcm_tokens', token))
      localStorage.removeItem(VAPID_KEY_STORAGE)
    }
    notificationsEnabled.value = false
  }

  function checkExistingSubscription() {
    const token = localStorage.getItem(VAPID_KEY_STORAGE)
    notificationsEnabled.value = !!token
    notificationPermission.value = typeof Notification !== 'undefined' ? Notification.permission : 'default'
    return !!token
  }

  return {
    notificationsEnabled,
    notificationPermission,
    isLoading,
    requestPermissionAndSubscribe,
    unsubscribe,
    checkExistingSubscription,
  }
}
