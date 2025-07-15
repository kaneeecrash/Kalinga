import { Injectable, NgZone } from '@angular/core';
import { Firestore, doc, setDoc, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { query, where, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { from } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(
    private firestore: Firestore,
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
}
