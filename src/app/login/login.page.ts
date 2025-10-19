import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController } from '@ionic/angular';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  loginForm = this.fb.group({
    emailOrUserName: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });
  errorMsg = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private firestore: FirestoreService,
    private nav: NavController
  ) {}

  onLogin() {
    if (this.loginForm.invalid) {
      this.errorMsg = 'Please enter your username/email and password.';
      return;
    }
    let { emailOrUserName, password } = this.loginForm.value;
    emailOrUserName = (emailOrUserName || '').trim();
    password = password || '';

    if (!emailOrUserName || !password) {
      this.errorMsg = 'Please enter your username/email and password.';
      return;
    }

    this.loading = true;
    this.errorMsg = '';

    if (emailOrUserName.includes('@')) {
      // Login with email
      this.auth.login(emailOrUserName, password).subscribe({
        next: () => {
          this.loading = false;
          this.nav.navigateRoot('/home');
        },
        error: err => {
          this.loading = false;
          this.handleLoginError(err);
        }
      });
    } else {
      // Case-insensitive username support
      const normalizedUserName = emailOrUserName.toLowerCase();

      this.firestore.getUserByUsername(normalizedUserName).pipe(
        switchMap(userDoc => {
          if (userDoc && userDoc.email) {
            return this.auth.login(userDoc.email, password);
          } else {
            this.loading = false;
            this.errorMsg = 'No account found with this username. Please check your username or create a new account.';
            return of(null);
          }
        }),
        catchError(error => {
          this.loading = false;
          this.errorMsg = 'Unable to verify username. Please check your internet connection and try again.';
          return of(null);
        })
      ).subscribe({
        next: (result) => {
          if (result) {
            this.loading = false;
            this.nav.navigateRoot('/home');
          }
        },
        error: err => {
          this.loading = false;
          this.handleLoginError(err);
        }
      });
    }
  }

  private handleLoginError(err: any) {
    console.error('Login error:', err);
    
    // Handle specific Firebase Auth errors
    if (err?.code) {
      switch (err.code) {
        case 'auth/user-not-found':
          this.errorMsg = 'No account found with this email address. Please check your email or create a new account.';
          break;
        case 'auth/wrong-password':
          this.errorMsg = 'Incorrect password. Please try again or reset your password.';
          break;
        case 'auth/invalid-email':
          this.errorMsg = 'Invalid email format. Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          this.errorMsg = 'This account has been disabled. Please contact support for assistance.';
          break;
        case 'auth/too-many-requests':
          this.errorMsg = 'Too many failed login attempts. Please wait a moment and try again.';
          break;
        case 'auth/network-request-failed':
          this.errorMsg = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/invalid-credential':
          this.errorMsg = 'Invalid credentials. Please check your username/email and password.';
          break;
        default:
          this.errorMsg = err?.message || 'Login failed. Please try again.';
      }
    } else {
      this.errorMsg = err?.message || 'Login failed. Please try again.';
    }
  }
}
