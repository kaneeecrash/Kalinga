import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
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

  user: any = {};              // User profile data
  avatarPreview: string = '';  // For local avatar preview
  avatarFile: File | null = null;
  editMode = false;
  today: string = '';
  profileForm!: FormGroup;
  userUid: string = '';

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
    this.user = await this.firestoreService.getUserByUID(this.userUid);
    this.avatarPreview = this.user?.photoURL || '';
    this.profileForm = this.fb.group({
      displayName: [this.user.displayName || ''],
      bio: [this.user.bio || ''],
      mobile: [this.user.mobile || ''],
      birthdate: [this.user.birthdate || ''],
      gender: [this.user.gender || ''],
      occupation: [this.user.occupation || ''],
      skills: [this.user.skills || ''],
      // email not editable
    });
  }

  goBack() {
    this.navCtrl.back();
  }

  enableEdit() {
    this.editMode = true;
  }

  cancelEdit() {
    this.editMode = false;
    this.loadUser();
    this.avatarPreview = this.user?.photoURL || '';
    this.avatarFile = null;
  }

  // Save profile changes
  async saveProfile() {
    if (!this.profileForm.valid) return;

    Object.assign(this.user, this.profileForm.value);

    // Handle avatar upload if changed
    if (this.avatarFile) {
      const downloadURL = await this.firestoreService.uploadAvatar(this.avatarFile, this.userUid);
      this.user.photoURL = downloadURL;
    }

    await this.firestoreService.updateUserProfile(this.userUid, {
      ...this.profileForm.value,
      photoURL: this.user.photoURL
    });

    this.editMode = false;
    this.avatarFile = null;
    this.presentToast('Profile updated.');
  }

  // For avatar selection
  selectAvatar() {
    if (this.editMode && this.avatarInput) {
      this.avatarInput.nativeElement.click();
    }
  }

  onAvatarChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.avatarFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
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
