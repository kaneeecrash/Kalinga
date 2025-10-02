import { Injectable, NgZone } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, getDoc, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { query, where, orderBy, limit, getDocs } from '@angular/fire/firestore';
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
      return this.ngZone.run(() => {
        const docRef = doc(this.firestore, collectionName, docId);
        return from(setDoc(docRef, data));
      });
    }

    addUser(user: any) {
      return this.ngZone.run(() => {
        const usersRef = collection(this.firestore, 'users');
        return addDoc(usersRef, user);
      });
    }

    getUsers(): Observable<any[]> {
      return this.ngZone.run(() => {
        const usersRef = collection(this.firestore, 'users');
        return collectionData(usersRef, { idField: 'id' }) as Observable<any[]>;
      });
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
      return this.ngZone.run(async () => {
        const userRef = doc(this.firestore, 'users', uid);
        const snap = await getDoc(userRef);
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
      });
    }

    // ---- NEW: Update user profile by UID ----
    async updateUserProfile(uid: string, data: any): Promise<void> {
      return this.ngZone.run(async () => {
        const userRef = doc(this.firestore, 'users', uid);
        return updateDoc(userRef, data);
      });
    }

    // ---- NEW: Upload avatar to storage, return download URL ----
    async uploadAvatar(file: File, uid: string): Promise<string> {
      try {
        // Validate file before upload
        if (!file || file.size === 0) {
          throw new Error('Invalid file selected');
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          throw new Error('File size must be less than 10MB');
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }

        // Create a unique file path with timestamp
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `avatars/${uid}/${timestamp}_${sanitizedFileName}`;
        
        console.log('Uploading avatar to:', filePath);
        console.log('File details:', {
          name: file.name,
          size: file.size,
          type: file.type
        });
        
        const storageRef = ref(this.storage, filePath);
        
        // Set metadata for better CORS handling
        const metadata = {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000',
          customMetadata: {
            uploadedBy: uid,
            uploadedAt: new Date().toISOString()
          }
        };
        
        // Upload the file with metadata
        console.log('Starting upload...');
        const uploadResult = await uploadBytes(storageRef, file, metadata);
        console.log('Upload completed:', uploadResult);
        
        // Get the download URL
        console.log('Getting download URL...');
        const downloadURL = await getDownloadURL(storageRef);
        console.log('Download URL obtained:', downloadURL);
        
        return downloadURL;
      } catch (error) {
        console.error('Avatar upload error:', error);
        
        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('storage/unauthorized')) {
            throw new Error('You do not have permission to upload files. Please check your authentication.');
          } else if (error.message.includes('storage/canceled')) {
            throw new Error('Upload was canceled by user.');
          } else if (error.message.includes('storage/unknown')) {
            throw new Error('An unknown error occurred during upload. Please try again.');
          } else if (error.message.includes('storage/quota-exceeded')) {
            throw new Error('Storage quota exceeded. Please contact support.');
          } else if (error.message.includes('storage/invalid-format')) {
            throw new Error('Invalid file format. Please select a valid image file.');
          }
        }
        
        // Re-throw with more context
        throw new Error(`Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

          //missions//
    getMissions(limitTo:number = 100): Observable<any[]> {
      const ref = collection(this.firestore, 'missions');
      const q = query(ref, orderBy('createdAt', 'desc'), limit(limitTo));
      return collectionData(q, { idField: 'id' }) as Observable<any[]>;
    }

    getOpenMissions(limitTo:number = 100): Observable<any[]> {
      const ref = collection(this.firestore, 'missions');
      const q = query(ref, where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(limitTo));
      return collectionData(q, { idField: 'id' }) as Observable<any[]>;
    }

    getMissionById(id: string): Observable<any> {
      const ref = doc(this.firestore, 'missions', id);
      return docData(ref, { idField: 'id' });
    }

    async joinMission(missionId: string, userId: string, name: string) {
      return this.ngZone.run(async () => {
        const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
        return await addDoc(participantsRef, {
          userId,
          name,
          joinedAt: new Date()
        });
      });
    }
  }
