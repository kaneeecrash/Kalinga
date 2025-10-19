import { Injectable } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, getDoc, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { query, where, orderBy, limit, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable, from, of, switchMap, catchError, map } from 'rxjs';
import { Auth, authState } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private auth: Auth
  ) {}

  getSomeData(): Observable<any[]> {
    const colRef = collection(this.firestore, 'my-collection');
    return from(getDocs(colRef)).pipe(
      map(docsSnap => docsSnap.docs.map(d => d.data())),
      catchError(error => {
        console.error('Error getting data:', error);
        return of([]);
      })
    );
  }

  setDocument(collectionName: string, docId: string, data: any): Observable<void> {
    const docRef = doc(this.firestore, collectionName, docId);
    return from(setDoc(docRef, data));
  }

  addUser(user: any): Observable<any> {
    const usersRef = collection(this.firestore, 'users');
    return from(addDoc(usersRef, user));
  }

  getUsers(): Observable<any[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'id' }) as Observable<any[]>;
  }

  getUserByUsername(userName: string): Observable<any> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('userName', '==', userName.toLowerCase()));
    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          return { id: doc.id, ...doc.data() };
        }
        return null;
      }),
      catchError(error => {
        console.error('Error getting user by username:', error);
        return of(null);
      })
    );
  }

  // ---- NEW: Get user by UID ----
  getUserByUID(uid: string): Observable<any> {
    console.log('Getting user by UID:', uid);
    const userRef = doc(this.firestore, 'users', uid);
    return docData(userRef, { idField: 'id' }).pipe(
      map(userData => {
        console.log('User data received:', userData);
        return userData || null;
      }),
      catchError(error => {
        console.error('Error getting user by UID:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          uid: uid
        });
        return of(null);
      })
    );
  }

  // ---- NEW: Update user profile by UID ----
  updateUserProfile(uid: string, data: any): Observable<void> {
    const userRef = doc(this.firestore, 'users', uid);
    return from(updateDoc(userRef, data));
  }

  // ---- NEW: Upload avatar to storage, return download URL ----
  uploadAvatar(file: File, uid: string): Observable<string> {
    return from(this.uploadAvatarFile(file, uid)).pipe(
      catchError(error => {
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
      })
    );
  }

  private async uploadAvatarFile(file: File, uid: string): Promise<string> {
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
      
      // Add retry logic for CORS issues
      let uploadResult;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          uploadResult = await uploadBytes(storageRef, file, metadata);
          console.log('Upload completed:', uploadResult);
          break;
        } catch (uploadError) {
          retryCount++;
          console.warn(`Upload attempt ${retryCount} failed:`, uploadError);
          
          if (retryCount >= maxRetries) {
            throw uploadError;
          }
          
          // No delay - retry immediately
        }
      }
    
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
  getMissions(limitTo: number = 100): Observable<any[]> {
    console.log('Getting missions with limit:', limitTo);
    const ref = collection(this.firestore, 'missions');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(limitTo));
    return collectionData(q, { idField: 'id' }).pipe(
      map(missions => {
        console.log('Missions received:', missions);
        return missions;
      }),
      catchError(error => {
        console.error('Error getting missions:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message
        });
        return of([]);
      })
    ) as Observable<any[]>;
  }

  getOpenMissions(limitTo: number = 100): Observable<any[]> {
    const ref = collection(this.firestore, 'missions');
    const q = query(ref, where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(limitTo));
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

  getMissionById(id: string): Observable<any> {
    const ref = doc(this.firestore, 'missions', id);
    return docData(ref, { idField: 'id' });
  }

  joinMission(missionId: string, userId: string, name: string): Observable<any> {
    const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
    return from(addDoc(participantsRef, {
      userId,
      name,
      joinedAt: new Date(),
      status: 'approved'
    }));
  }

  // ---- NEW: Application Status Methods ----
  applyToMission(missionId: string, userId: string, name: string): Observable<void> {
    const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
    return from(addDoc(applicationsRef, {
      userId,
      name,
      appliedAt: new Date(),
      status: 'pending'
    })).pipe(map(() => void 0));
  }

  getUserApplicationStatus(missionId: string, userId: string): Observable<string | null> {
    // Check if user is already a participant (approved)
    const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
    const participantQuery = query(participantsRef, where('userId', '==', userId));
    
    return from(getDocs(participantQuery)).pipe(
      switchMap(participantSnapshot => {
        if (!participantSnapshot.empty) {
          return of('approved');
        }

        // Check if user has a pending application
        const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
        const applicationQuery = query(applicationsRef, where('userId', '==', userId));
        
        return from(getDocs(applicationQuery)).pipe(
          map(applicationSnapshot => {
            if (!applicationSnapshot.empty) {
              const application = applicationSnapshot.docs[0].data();
              return application['status'] || 'pending';
            }
            return null; // No application found
          })
        );
      }),
      catchError(error => {
        console.error('Error checking application status:', error);
        return of(null);
      })
    );
  }

  // ---- NEW: Get mission applications (for organization use) ----
  getMissionApplications(missionId: string): Observable<any[]> {
    const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
    return from(getDocs(applicationsRef)).pipe(
      map(applicationsSnapshot => 
        applicationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      ),
      catchError(error => {
        console.error('Error getting mission applications:', error);
        return of([]);
      })
    );
  }

  // ---- NEW: Update application status (for organization use) ----
  updateApplicationStatus(missionId: string, applicationId: string, status: 'approved' | 'rejected'): Observable<void> {
    const applicationRef = doc(this.firestore, `missions/${missionId}/applications`, applicationId);
    
    return from(updateDoc(applicationRef, { status })).pipe(
      switchMap(() => {
        // If approved, also add to participants
        if (status === 'approved') {
          return from(getDoc(applicationRef)).pipe(
            switchMap(applicationDoc => {
              const applicationData = applicationDoc.data();
              const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
              return from(addDoc(participantsRef, {
                userId: applicationData?.['userId'],
                name: applicationData?.['name'],
                joinedAt: new Date(),
                status: 'approved'
              }));
            }),
            map(() => void 0)
          );
        }
        return of(void 0);
      }),
      catchError(error => {
        console.error('Error updating application status:', error);
        throw error;
      })
    );
  }

  // Add method to check authentication status
  checkAuthStatus(): Observable<any> {
    return authState(this.auth).pipe(
      map(user => {
        console.log('Auth status check - User:', user);
        if (user) {
          console.log('User authenticated:', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
          });
        } else {
          console.log('No authenticated user');
        }
        return user;
      }),
      catchError(error => {
        console.error('Auth status check error:', error);
        return of(null);
      })
    );
  }

  // Add method to get current user
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // ---- NEW: Get user mission status (alias for getUserApplicationStatus) ----
  getUserMissionStatus(missionId: string, userId: string): Observable<string> {
    return this.getUserApplicationStatus(missionId, userId).pipe(
      map(status => status || ''),
      catchError(error => {
        console.error('Error getting user mission status:', error);
        return of('');
      })
    );
  }
}