import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD1UOUzvYOkQhVm0f1M3MLivhSDJWTEOgM",
  authDomain: "prison-control.firebaseapp.com",
  projectId: "prison-control",
  storageBucket: "prison-control.firebasestorage.app",
  messagingSenderId: "134476681312",
  appId: "1:134476681312:web:5d91df29292096d14f7305",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'teams',
  'issues',
  'auditLogs',
  'participants',
  'repositories',
  'pullRequests',
  'scoreEvents',
  'reviews',
  'webhookEvents',
  'bonusAwards',
  'challengeMappings',
];

async function purgeAll() {
  console.log('Initiating purge of collections...');
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`Found ${snap.size} documents in "${colName}". Deleting...`);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      console.log(`Cleared "${colName}".`);
    } catch (e) {
      console.error(`Error clearing "${colName}":`, e.message);
    }
  }
  console.log('Purge complete!');
  process.exit(0);
}

purgeAll();
