import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false
})
export class RegisterPage {
  regForm = this.fb.group({
    userName: ['', [Validators.required]],
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });
  loading = false;
  errorMsg: string | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private firestore: FirestoreService,
    private nav: NavController
  ) {}

  async onRegister() {
    if (this.regForm.invalid) {
      this.errorMsg = 'Please fill out all required fields.';
      return;
    }
    let { email, password, confirmPassword, displayName, userName } = this.regForm.value;
    email = (email || '').trim();
    password = password || '';
    confirmPassword = confirmPassword || '';
    displayName = (displayName || '').trim();
    userName = (userName || '').trim().toLowerCase(); // case-insensitive

    // Check password match
    if (password !== confirmPassword) {
      this.errorMsg = 'Passwords do not match!';
      return;
    }

    // Check if username is unique (case-insensitive)
    this.loading = true;
    this.errorMsg = null;
    const existingUser = await this.firestore.getUserByUsername(userName);
    if (existingUser) {
      this.loading = false;
      this.errorMsg = 'Username already exists. Please choose another one.';
      return;
    }

    // Proceed with registration
    this.auth.register(email, password, displayName, userName).subscribe({
      next: (user: any) => {
        const uid = user?.uid;
        if (uid) {
          this.firestore.setDocument('users', uid, {
            uid,
            displayName,
            email,
            userName, // always stored in lowercase!
            createdAt: new Date()
          }).subscribe({
            next: () => {
              this.loading = false;
              this.nav.navigateRoot('/login');
            },
            error: err => {
              this.loading = false;
              this.errorMsg = 'User created, but failed to save profile.';
            }
          });
        } else {
          this.loading = false;
          this.errorMsg = 'User created, but no UID found.';
        }
      },
      error: err => {
        this.loading = false;
        this.errorMsg = err?.message || 'Registration failed.';
      }
    });
  }
}
