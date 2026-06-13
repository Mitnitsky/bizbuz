import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyA06eeQufVZy4DK-ORpLCamLkVHhMqcEEs",
  authDomain: "bizbuz-3a473.firebaseapp.com",
  projectId: "bizbuz-3a473",
  storageBucket: "bizbuz-3a473.firebasestorage.app",
  messagingSenderId: "873734975774",
  appId: "1:873734975774:web:9a834670a4073a705b990f",
}

const app = initializeApp(firebaseConfig)
// Enable offline persistence — cached data renders instantly on repeat visits
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})
export const auth = getAuth(app)
