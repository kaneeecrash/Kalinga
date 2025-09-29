import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController, ToastController } from '@ionic/angular';
import { FirestoreService } from '../services/firestore.service';
import { Auth } from '@angular/fire/auth';

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
  avatarFile: File | null = null;
  editMode = false;
  today: string = '';
  profileForm!: FormGroup;
  userUid: string = '';
  isSaving: boolean = false;
  isUploadingAvatar: boolean = false;
  uploadProgress: number = 0;

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

  async ngOnInit() {
    const currUser = this.auth.currentUser;
    if (!currUser) {
      this.presentToast('Not authenticated.');
      this.navCtrl.back();
      return;
    }
    this.userUid = currUser.uid;
    await this.loadUser();
  }

  // Load user from FirestoreService
  async loadUser() {
    if (!this.userUid) return;
    
    try {
      this.user = await this.firestoreService.getUserByUID(this.userUid);
      
      if (!this.user) {
        this.presentToast('User profile not found.');
        this.navCtrl.back();
        return;
      }
      
      this.avatarPreview = this.user.photoURL || '';
      this.initializeForm();
    } catch (error) {
      console.error('Error loading user:', error);
      this.presentToast('Failed to load user profile.');
    }
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
    
    console.log('Form initialized:', this.profileForm.value);
    console.log('Form valid:', this.profileForm.valid);
  }

  goBack() {
    this.navCtrl.back();
  }

  enableEdit() {
    this.editMode = true;
    console.log('Edit mode enabled:', this.editMode);
    console.log('Current form value:', this.profileForm?.value);
    console.log('Current user data:', this.user);
  }

  cancelEdit() {
    this.editMode = false;
    this.avatarPreview = this.user?.photoURL || '';
    this.avatarFile = null;
    this.initializeForm();
  }

  // Save profile changes
  async saveProfile() {
    console.log('Save profile called');
    console.log('Form exists:', !!this.profileForm);
    console.log('Form valid:', this.profileForm?.valid);
    console.log('Form value:', this.profileForm?.value);
    console.log('Form errors:', this.profileForm?.errors);
    
    if (!this.profileForm) {
      this.presentToast('Form not initialized. Please refresh the page.');
      return;
    }

    if (!this.profileForm.valid) {
      // Mark all fields as touched to show validation errors
      this.profileForm.markAllAsTouched();
      
      // Get specific validation errors
      const errors = this.getFormErrors();
      console.log('Form validation errors:', errors);
      
      this.presentToast(`Please fix the following errors: ${errors.join(', ')}`);
      return;
    }

    if (!this.userUid) {
      this.presentToast('User not authenticated.');
      return;
    }

    this.isSaving = true;
    this.uploadProgress = 0;
    
    try {
      const formData = this.profileForm.value;
      console.log('Saving form data:', formData);
      
      // Upload avatar if changed
      if (this.avatarFile) {
        this.isUploadingAvatar = true;
        this.uploadProgress = 10;
        
        // Show upload progress
        const progressToast = await this.toastCtrl.create({
          message: 'Uploading avatar...',
          duration: 0,
          color: 'primary',
          position: 'bottom'
        });
        progressToast.present();
        
        try {
          // Simulate progress updates
          this.simulateUploadProgress();
          
          console.log('Uploading avatar file:', this.avatarFile.name);
          const avatarUrl = await this.firestoreService.uploadAvatar(this.avatarFile, this.userUid);
          console.log('Avatar upload successful, URL:', avatarUrl);
          
          formData.photoURL = avatarUrl;
          this.uploadProgress = 100;
          
          // Dismiss progress toast
          progressToast.dismiss();
          
          // Show upload success
          const uploadSuccessToast = await this.toastCtrl.create({
            message: 'Avatar uploaded successfully!',
            duration: 1500,
            color: 'success',
            position: 'bottom'
          });
          uploadSuccessToast.present();
          
        } catch (uploadError) {
          progressToast.dismiss();
          console.error('Avatar upload error:', uploadError);
          
          // Show specific error message
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
          this.presentToast(`Failed to upload avatar: ${errorMessage}`);
          
          this.isUploadingAvatar = false;
          this.uploadProgress = 0;
          return;
        }
        
        this.isUploadingAvatar = false;
      }

      // Update user profile in Firestore
      console.log('Updating user profile in Firestore...');
      await this.firestoreService.updateUserProfile(this.userUid, formData);
      console.log('User profile updated successfully');
      
      // Update local user data
      this.user = { ...this.user, ...formData };
      console.log('Local user data updated:', this.user);
      
      // Reset form state
      this.editMode = false;
      this.avatarFile = null;
      this.uploadProgress = 0;
      
      // Reload user data to ensure consistency
      await this.loadUser();
      
      // Show success toast
      const toast = await this.toastCtrl.create({
        message: 'Profile updated successfully!',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      toast.present();
    } catch (error) {
      console.error('Error saving profile:', error);
      // Show error toast
      const toast = await this.toastCtrl.create({
        message: 'Failed to update profile. Please try again.',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      toast.present();
    } finally {
      this.isSaving = false;
      this.isUploadingAvatar = false;
      this.uploadProgress = 0;
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
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        this.presentToast(`File size must be less than 10MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        this.resetAvatarInput(input);
        return;
      }
      
      // Check minimum file size (at least 1KB)
      if (file.size < 1024) {
        this.presentToast('File is too small. Please select a valid image file.');
        this.resetAvatarInput(input);
        return;
      }
      
      this.isUploadingAvatar = true;
      
      try {
        // Compress image if it's larger than 1MB
        if (file.size > 1024 * 1024) {
          console.log('Compressing large image...');
          this.avatarFile = await this.compressImage(file);
        } else {
          this.avatarFile = file;
        }
        
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result) {
            this.avatarPreview = e.target.result as string;
            this.isUploadingAvatar = false;
            console.log('Image preview loaded successfully');
          }
        };
        
        reader.onerror = () => {
          console.error('Error reading image file');
          this.presentToast('Error reading image file. Please try a different image.');
          this.isUploadingAvatar = false;
          this.resetAvatarInput(input);
        };
        
        reader.readAsDataURL(this.avatarFile);
        
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        this.presentToast('Error processing image. Using original file.');
        this.avatarFile = file;
        this.isUploadingAvatar = false;
      }
    }
  }

  private resetAvatarInput(input: HTMLInputElement) {
    input.value = '';
    this.avatarFile = null;
  }

  private async compressImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              });
              console.log(`Image compressed: ${file.size} -> ${compressedFile.size} bytes`);
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private simulateUploadProgress() {
    const interval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 20;
      } else {
        clearInterval(interval);
      }
    }, 200);
  }

  private getFormErrors(): string[] {
    const errors: string[] = [];
    
    if (this.profileForm?.get('displayName')?.errors) {
      const displayNameErrors = this.profileForm.get('displayName')?.errors;
      if (displayNameErrors?.['required']) {
        errors.push('Full Name is required');
      }
      if (displayNameErrors?.['minlength']) {
        errors.push('Full Name must be at least 2 characters');
      }
    }
    
    return errors;
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    console.log('Form submitted');
    this.saveProfile();
  }

  async presentToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 1500,
      position: 'bottom'
    });
    toast.present();
  }
}
