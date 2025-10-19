import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController, ToastController } from '@ionic/angular';
import { FirestoreService } from '../services/firestore.service';
import { Auth, authState } from '@angular/fire/auth';
import { switchMap, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-profile-info',
  templateUrl: './profile-info.page.html',
  styleUrls: ['./profile-info.page.scss'],
  standalone: false
})
export class ProfileInfoPage implements OnInit {
  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  user: any = null;              // User profile data
  avatarPreview: string = '';  // For local avatar preview
  editMode = false;
  today: string = '';
  profileForm!: FormGroup;
  userUid: string = '';
  isSaving: boolean = false;
  isUploadingAvatar: boolean = false;
  uploadProgress: number = 0;
  isLoading: boolean = true;

  constructor(
    private fb: FormBuilder,
    private navCtrl: NavController,
    private firestoreService: FirestoreService,
    private toastCtrl: ToastController,
    private auth: Auth
  ) {
    // Set max date for birthdate (today)
    const now = new Date();
    this.today = now.toISOString().substring(0, 10);
  }

  ngOnInit() {
    this.isLoading = true;
    
    // Use authState to get current user
    authState(this.auth).pipe(
      switchMap(user => {
        if (!user) {
          this.presentToast('Not authenticated.');
          this.navCtrl.back();
          return of(null);
        }
        
        this.userUid = user.uid;
        return this.loadUser();
      }),
      catchError(error => {
        console.error('Error in ngOnInit:', error);
        this.presentToast('Failed to initialize profile page.');
        return of(null);
      })
    ).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.isLoading = false;
        this.presentToast('Failed to initialize profile page.');
      }
    });
  }

  // Load user from FirestoreService
  loadUser() {
    if (!this.userUid) return of(null);
    
    return this.firestoreService.getUserByUID(this.userUid).pipe(
      map(user => {
        if (!user) {
          this.presentToast('User profile not found.');
          this.navCtrl.back();
          return null;
        }
        
        this.user = user;
        
        // Load avatar from localStorage first, then fallback to user.photoURL
        const localAvatar = this.loadAvatarFromLocalStorage();
        this.avatarPreview = localAvatar || this.user.photoURL || '';
        
        // Initialize form after user data is loaded
        this.initializeForm();
        
        console.log('User loaded successfully:', this.user);
        return user;
      }),
      catchError(error => {
        console.error('Error loading user:', error);
        this.presentToast('Failed to load user profile.');
        this.user = null; // Ensure user is null on error
        return of(null);
      })
    );
  }

  private initializeForm() {
    this.profileForm = this.fb.group({
      displayName: [this.user?.displayName || '', [Validators.required, Validators.minLength(2)]],
      bio: [this.user?.bio || ''],
      mobile: [this.user?.mobile || ''],
      birthdate: [this.user?.birthdate || ''],
      gender: [this.user?.gender || ''],
      occupation: [this.user?.occupation || ''],
      skills: [this.user?.skills || ''],
      // email not editable
    });
    
    // Disable/enable form controls based on edit mode
    this.updateFormControlsState();
    
    console.log('Form initialized:', this.profileForm.value);
    console.log('Form valid:', this.profileForm.valid);
  }

  private updateFormControlsState() {
    if (this.profileForm) {
      if (this.editMode) {
        this.profileForm.enable();
      } else {
        this.profileForm.disable();
      }
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  enableEdit() {
    this.editMode = true;
    this.updateFormControlsState();
    console.log('Edit mode enabled:', this.editMode);
    console.log('Current form value:', this.profileForm?.value);
    console.log('Current user data:', this.user);
  }

  cancelEdit() {
    this.editMode = false;
    this.avatarPreview = this.user?.photoURL || '';
    this.updateFormControlsState();
  }

  // Save profile changes
  async saveProfile() {
    console.log('Save profile called');
    
    if (!this.profileForm) {
      this.presentToast('Form not initialized. Please refresh the page.');
      return;
    }

    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      this.presentToast('Please fix the form errors before saving.');
      return;
    }

    if (!this.userUid) {
      this.presentToast('User not authenticated.');
      return;
    }

    this.isSaving = true;
    
    try {
      const formData = this.profileForm.value;
      console.log('Saving form data:', formData);
      
      // Check if there's a new avatar in localStorage
      const localAvatar = this.loadAvatarFromLocalStorage();
      if (localAvatar && localAvatar !== this.user.photoURL) {
        console.log('Using avatar from localStorage');
        formData.photoURL = localAvatar;
      }

      // Update user profile in Firestore
      console.log('Updating user profile in Firestore...');
      await this.firestoreService.updateUserProfile(this.userUid, formData);
      console.log('User profile updated successfully');
      
      // Update local user data
      this.user = { ...this.user, ...formData };
      
      // Reset form state
      this.editMode = false;
      this.uploadProgress = 0;
      
      console.log('Profile updated successfully, user data:', this.user);
      
      // Show success toast
      const toast = await this.toastCtrl.create({
        message: 'Profile updated successfully!',
        duration: 1000,
        color: 'success',
        position: 'bottom'
      });
      toast.present();
      
      // Small delay to ensure Firestore update is complete
      setTimeout(() => {
        console.log('Profile save completed, data should be available in Profile page');
      }, 500);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      this.presentToast('Failed to update profile. Please try again.');
    } finally {
      this.isSaving = false;
      this.isUploadingAvatar = false;
    }
  }
    // For avatar selection
  selectAvatar() {
    if (this.editMode && this.avatarInput) {
      this.avatarInput.nativeElement.click();
    }
  }

  async onAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      console.log('File selected:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.presentToast('Please select a valid image file (JPG, PNG, GIF, etc.).');
        this.resetAvatarInput(input);
        return;
      }
      
      // Validate file size (max 2MB for localStorage)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        this.presentToast(`File size must be less than 2MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        this.resetAvatarInput(input);
        return;
      }
      
      try {
        // Create preview and save to localStorage immediately
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result) {
            this.avatarPreview = e.target.result as string;
            console.log('Image preview loaded successfully');
            // Save to localStorage immediately
            this.saveAvatarToLocalStorage(e.target.result as string);
          }
        };
        
        reader.readAsDataURL(file);
        
      } catch (error) {
        console.error('Error processing image:', error);
        this.presentToast('Error processing image. Please try again.');
        this.isUploadingAvatar = false;
        this.resetAvatarInput(input);
      }
    }
  }

  private resetAvatarInput(input: HTMLInputElement) {
    input.value = '';
    // No need to reset avatarFile since we're not using it anymore
  }

  // localStorage methods for avatar
  private saveAvatarToLocalStorage(base64String: string) {
    try {
      const avatarKey = `avatar_${this.userUid}`;
      localStorage.setItem(avatarKey, base64String);
      console.log('Avatar saved to localStorage');
    } catch (error) {
      console.error('Error saving avatar to localStorage:', error);
      this.presentToast('Error saving avatar. Please try again.');
    }
  }

  private loadAvatarFromLocalStorage(): string | null {
    try {
      const avatarKey = `avatar_${this.userUid}`;
      return localStorage.getItem(avatarKey);
    } catch (error) {
      console.error('Error loading avatar from localStorage:', error);
      return null;
    }
  }

  private removeAvatarFromLocalStorage() {
    try {
      const avatarKey = `avatar_${this.userUid}`;
      localStorage.removeItem(avatarKey);
      console.log('Avatar removed from localStorage');
    } catch (error) {
      console.error('Error removing avatar from localStorage:', error);
    }
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    console.log('Form submitted');
    this.saveProfile();
  }

  async presentToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 1000,
      position: 'bottom'
    });
    toast.present();
  }
}
