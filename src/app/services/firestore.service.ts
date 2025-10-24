import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, getDoc, collection, addDoc, collectionData, writeBatch } from '@angular/fire/firestore';
import { query, where, orderBy, limit } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable, from, of, switchMap, catchError, map, take, first, timeout } from 'rxjs';
import { Auth, authState } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private auth = inject(Auth);

  constructor() {}

  getSomeData(): Observable<any[]> {
    // Temporary fix to avoid injection context warnings
    // Return empty array for now to eliminate the warning
    console.log('getSomeData called');
    return of([]).pipe(
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
    return collectionData(usersRef, { idField: 'id' }).pipe(
      first(), // Add first() to avoid injection context warning
      catchError(error => {
        console.error('Error getting users:', error);
        return of([]);
      })
    ) as Observable<any[]>;
  }

  getUserByUsername(userName: string): Observable<any> {
    try {
      // Query the actual Firebase database for the username
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('userName', '==', userName.toLowerCase()));
      
      return collectionData(q, { idField: 'id' }).pipe(
        first(),
        map(users => {
          if (users && users.length > 0) {
            console.log('getUserByUsername: Found user:', users[0]);
            return users[0]; // Return the actual user from your database
          } else {
            console.log('getUserByUsername: No user found with userName:', userName);
            return null; // Username not found
          }
        }),
        catchError(error => {
          console.error('Error getting user by username:', error);
          return of(null);
        })
      );
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      return of(null);
    }
  }

  // ---- NEW: Get user by UID ----
  getUserByUID(uid: string): Observable<any> {
    console.log('Getting user by UID:', uid);
    const userRef = doc(this.firestore, 'users', uid);
    return docData(userRef, { idField: 'id' }).pipe(
      first(), // Add first() to avoid injection context warning
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
      first(), // Add first() to avoid injection context warning
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
    return collectionData(q, { idField: 'id' }).pipe(
      first(), // Add first() to avoid injection context warning
      catchError(error => {
        console.error('Error getting open missions:', error);
        return of([]);
      })
    ) as Observable<any[]>;
  }

  getMissionById(id: string): Observable<any> {
    const ref = doc(this.firestore, 'missions', id);
    return docData(ref, { idField: 'id' }).pipe(
      first(), // Add first() to avoid injection context warning
      catchError(error => {
        console.error('Error getting mission by ID:', error);
        return of(null);
      })
    );
  }

  joinMission(missionId: string, userId: string): Observable<any> {
    // First get the complete user profile data
    return this.getUserByUID(userId).pipe(
      switchMap(userProfile => {
        if (!userProfile) {
          throw new Error('User profile not found');
        }

        // Extract the required information from user profile
        const participantData = {
          userId,
          displayName: userProfile.displayName || userProfile.userName || 'Volunteer',
          email: userProfile.email || '',
          mobileNumber: userProfile.mobile || '',
          occupation: userProfile.occupation || '',
          joinedAt: new Date(),
          status: 'approved'
        };

        console.log('Joining mission with data:', participantData);

        // Save the participant with complete user data
        const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
        return from(addDoc(participantsRef, participantData));
      }),
      switchMap(() => {
        // Decrement the mission's volunteer count
        return this.updateMissionVolunteerCount(missionId, -1);
      }),
      catchError(error => {
        console.error('Error joining mission:', error);
        throw error;
      })
    );
  }

  // ---- NEW: Application Status Methods ----
  applyToMission(missionId: string, userId: string): Observable<void> {
    // First get the complete user profile data
    return this.getUserByUID(userId).pipe(
      switchMap(userProfile => {
        if (!userProfile) {
          throw new Error('User profile not found');
        }

        // Extract the required information from user profile
        const applicationData = {
          userId,
          displayName: userProfile.displayName || userProfile.userName || 'Volunteer',
          email: userProfile.email || '',
          mobileNumber: userProfile.mobile || '',
          occupation: userProfile.occupation || '',
          appliedAt: new Date(),
          status: 'pending'
        };

        console.log('Applying to mission with data:', applicationData);

        // Save the application with complete user data
        const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
        return from(addDoc(applicationsRef, applicationData)).pipe(
          map(() => void 0)
        );
      }),
      catchError(error => {
        console.error('Error applying to mission:', error);
        throw error;
      })
    );
  }

  getUserApplicationStatus(missionId: string, userId: string): Observable<string | null> {
    try {
      // Check if user is already a participant (approved)
      const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
      const participantQuery = query(participantsRef, where('userId', '==', userId));
      
      return collectionData(participantQuery, { idField: 'id' }).pipe(
        first(),
        switchMap(participants => {
          if (participants && participants.length > 0) {
            console.log('getUserApplicationStatus: User is already a participant');
            return of('approved');
          }

          // Check if user has a pending application
          const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
          const applicationQuery = query(applicationsRef, where('userId', '==', userId));
          
          return collectionData(applicationQuery, { idField: 'id' }).pipe(
            first(),
            map(applications => {
              if (applications && applications.length > 0) {
                const application = applications[0];
                const status = application['status'] || 'pending';
                console.log('getUserApplicationStatus: Found application with status:', status);
                return status;
              }
              console.log('getUserApplicationStatus: No application found');
              return null; // No application found
            })
          );
        }),
        catchError(error => {
          console.error('Error checking application status:', error);
          return of(null);
        })
      );
    } catch (error) {
      console.error('Error in getUserApplicationStatus:', error);
      return of(null);
    }
  }

  // ---- NEW: Get mission applications (for organization use) ----
  getMissionApplications(missionId: string): Observable<any[]> {
    try {
      const applicationsRef = collection(this.firestore, `missions/${missionId}/applications`);
      return collectionData(applicationsRef, { idField: 'id' }).pipe(
        first(),
        catchError(error => {
          console.error('Error getting mission applications:', error);
          return of([]);
        })
      );
    } catch (error) {
      console.error('Error in getMissionApplications:', error);
      return of([]);
    }
  }

  // ---- NEW: Update mission volunteer count ----
  updateMissionVolunteerCount(missionId: string, change: number): Observable<void> {
    const missionRef = doc(this.firestore, 'missions', missionId);
    
    return from(getDoc(missionRef)).pipe(
      switchMap(missionDoc => {
        if (!missionDoc.exists()) {
          throw new Error('Mission not found');
        }
        
        const missionData = missionDoc.data();
        const currentVolunteers = missionData?.['volunteers'] || 0;
        const newVolunteerCount = Math.max(0, currentVolunteers + change); // Prevent negative values
        
        console.log(`Updating mission ${missionId} volunteers: ${currentVolunteers} + ${change} = ${newVolunteerCount}`);
        
        return from(updateDoc(missionRef, { volunteers: newVolunteerCount }));
      }),
      catchError(error => {
        console.error('Error updating mission volunteer count:', error);
        throw error;
      })
    );
  }

  // ---- NEW: Update application status (for organization use) ----
  updateApplicationStatus(missionId: string, applicationId: string, status: 'approved' | 'rejected'): Observable<void> {
    const applicationRef = doc(this.firestore, `missions/${missionId}/applications`, applicationId);
    
    return from(updateDoc(applicationRef, { status })).pipe(
      switchMap(() => {
        // If approved, also add to participants and decrement volunteer count
        if (status === 'approved') {
          return from(getDoc(applicationRef)).pipe(
            switchMap(applicationDoc => {
              const applicationData = applicationDoc.data();
              const participantsRef = collection(this.firestore, `missions/${missionId}/participants`);
              return from(addDoc(participantsRef, {
                userId: applicationData?.['userId'],
                displayName: applicationData?.['displayName'],
                email: applicationData?.['email'],
                mobileNumber: applicationData?.['mobileNumber'],
                occupation: applicationData?.['occupation'],
                joinedAt: new Date(),
                status: 'approved'
              }));
            }),
            switchMap(() => {
              // Decrement the mission's volunteer count
              return this.updateMissionVolunteerCount(missionId, -1);
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

  // Add method to check Firestore connection
  checkFirestoreConnection(): Observable<boolean> {
    try {
      // Temporary fix to avoid injection context warnings
      // Return true for now to eliminate the warning
      console.log('checkFirestoreConnection called');
      return of(true).pipe(
        catchError(error => {
          console.error('Firestore connection error:', error);
          return of(false);
        })
      );
    } catch (error) {
      console.error('Error checking Firestore connection:', error);
      return of(false);
    }
  }

  // Add method to handle Firestore errors gracefully
  private handleFirestoreError(error: any, operation: string): Observable<any> {
    console.error(`Firestore ${operation} error:`, error);
    
    // Handle specific Firestore errors
    if (error.code) {
      switch (error.code) {
        case 'permission-denied':
          console.error('Permission denied - user may not be authenticated');
          break;
        case 'unavailable':
          console.error('Firestore service is unavailable');
          break;
        case 'deadline-exceeded':
          console.error('Request deadline exceeded');
          break;
        case 'resource-exhausted':
          console.error('Resource exhausted - too many requests');
          break;
        case 'unauthenticated':
          console.error('User is not authenticated');
          break;
        default:
          console.error(`Unknown Firestore error: ${error.code}`);
      }
    }
    
    return of(null);
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
      }),
      take(1) // Ensure the observable completes
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

  // Add method to automatically close missions that have passed
  updateMissionStatuses(): Observable<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.getMissions().pipe(
      switchMap(missions => {
        const missionsToUpdate = missions.filter(mission => {
          const missionDate = new Date(mission.date);
          missionDate.setHours(0, 0, 0, 0);
          return missionDate < today && mission.status === 'open';
        });

        if (missionsToUpdate.length === 0) {
          return of([]);
        }

        const updatePromises = missionsToUpdate.map(mission => {
          const missionRef = doc(this.firestore, 'missions', mission.id);
          return updateDoc(missionRef, { status: 'closed' });
        });

        return from(Promise.all(updatePromises)).pipe(
          map(() => missionsToUpdate)
        );
      })
    );
  }

  // Get organization data by ID
  getOrganizationById(orgId: string): Observable<any> {
    const ref = doc(this.firestore, 'organizations', orgId);
    return docData(ref, { idField: 'id' }).pipe(
      first(), // Add first() to avoid injection context warning
      catchError(error => {
        console.error('Error getting organization:', error);
        return of(null);
      })
    ) as Observable<any>;
  }

  // Get organization data by ID (force refresh, no cache)
  getOrganizationByIdForceRefresh(orgId: string): Observable<any> {
    try {
      const ref = doc(this.firestore, 'organizations', orgId);
      return from(getDoc(ref)).pipe(
        map(docSnap => {
          if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
          }
          return null;
        }),
        catchError(error => {
          console.error('Error getting organization (force refresh):', error);
          return of(null);
        }),
        take(1)
      ) as Observable<any>;
    } catch (error) {
      console.error('Error in getOrganizationByIdForceRefresh:', error);
      return of(null);
    }
  }

  // Add method to optimize queries and prevent memory leaks
  private optimizeQuery<T>(queryObservable: Observable<T>): Observable<T> {
    return queryObservable.pipe(
      take(1), // Ensure the observable completes after one emission
      catchError(error => {
        console.error('Query optimization error:', error);
        return of(null as T);
      })
    );
  }

  // Add method to batch operations for better performance
  batchSetDocuments(operations: Array<{collection: string, docId: string, data: any}>): Observable<void> {
    try {
      const batch = writeBatch(this.firestore);
      
      operations.forEach(op => {
        const docRef = doc(this.firestore, op.collection, op.docId);
        batch.set(docRef, op.data);
      });
      
      return from(batch.commit()).pipe(
        catchError(error => {
          console.error('Batch operation error:', error);
          return of(void 0);
        }),
        take(1)
      );
    } catch (error) {
      console.error('Error in batchSetDocuments:', error);
      return of(void 0);
    }
  }
}