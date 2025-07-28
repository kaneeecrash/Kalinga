import { Injectable, NgZone } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc, getDoc, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { query, where, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable, from } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private ngZone: NgZone
  ) {}

  async getSomeData() {
    return this.ngZone.run(async () => {
      const colRef = collection(this.firestore, 'my-collection');
      const docsSnap = await getDocs(colRef);
      return docsSnap.docs.map(d => d.data());
    });
  }

  setDocument(collectionName: string, docId: string, data: any) {
    const docRef = doc(this.firestore, collectionName, docId);
    return from(setDoc(docRef, data));
  }

  addUser(user: any) {
    const usersRef = collection(this.firestore, 'users');
    return addDoc(usersRef, user);
  }

  getUsers(): Observable<any[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'id' }) as Observable<any[]>;
  }

  async getUserByUsername(userName: string): Promise<any> {
    return this.ngZone.run(async () => {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('userName', '==', userName.toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      } else {
        return null;
      }
    });
  }

  // ---- NEW: Get user by UID ----
  async getUserByUID(uid: string): Promise<any> {
    const userRef = doc(this.firestore, 'users', uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  // ---- NEW: Update user profile by UID ----
  async updateUserProfile(uid: string, data: any): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    return updateDoc(userRef, data);
  }

  // ---- NEW: Upload avatar to storage, return download URL ----
  async uploadAvatar(file: File, uid: string): Promise<string> {
    const filePath = `avatars/${uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, filePath);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}
