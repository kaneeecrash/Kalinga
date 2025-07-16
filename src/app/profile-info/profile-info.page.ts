import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NavController } from '@ionic/angular';

// Mock user object for demo (replace with real user data)
const DEMO_USER = {
  displayName: '',
  bio: '',
  email: '',
  photoURL: '',
  mobile: '',
  birthdate: '',
  gender: '',
  occupation: '',
  skills: ''
};

@Component({
  selector: 'app-profile-info',
  templateUrl: './profile-info.page.html',
  styleUrls: ['./profile-info.page.scss'],
  standalone: false
})
export class ProfileInfoPage {
  @ViewChild('avatarInput') avatarInputRef!: ElementRef<HTMLInputElement>;

  user = { ...DEMO_USER };
  editMode = false;
  today = new Date().toISOString().split('T')[0];
  avatarPreview: string | null = null;
  profileForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private nav: NavController
  ) {
    this.profileForm = this.fb.group({
      displayName: [this.user.displayName],
      bio: [this.user.bio],
      mobile: [this.user.mobile],
      birthdate: [this.user.birthdate],
      gender: [this.user.gender],
      occupation: [this.user.occupation],
      skills: [this.user.skills]
    });
  }

  goBack() {
    this.nav.back();
  }

  enableEdit() {
    this.editMode = true;
    this.profileForm.patchValue({ ...this.user });
  }

  cancelEdit() {
    this.editMode = false;
    this.avatarPreview = null;
    this.profileForm.patchValue({ ...this.user });
  }

  saveEdit() {
    if (this.profileForm.valid) {
      this.user = {
        ...this.user,
        ...this.profileForm.value,
        photoURL: this.avatarPreview || this.user.photoURL
      };
      this.editMode = false;
      this.avatarPreview = null;
      // TODO: save to backend here if needed
    }
  }

  selectAvatar() {
    this.avatarInputRef.nativeElement.click();
  }

  onAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
}
