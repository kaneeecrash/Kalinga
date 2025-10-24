import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from '@angular/fire/auth';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  loginForm = this.fb.group({
    emailOrUserName: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false]
  });
  errorMsg = '';
  loading = false;
  showPassword = false;
  isOnline = true;
  networkError = false;

  // Form validation states
  get isEmailValid(): boolean {
    const value = this.loginForm.get('emailOrUserName')?.value;
    return !!(value && value.includes('@') && value.length > 5);
  }

  get isPasswordValid(): boolean {
    const value = this.loginForm.get('password')?.value;
    return !!(value && value.length >= 6);
  }

  get isFormValid(): boolean {
    return this.loginForm.valid && this.isOnline;
  }

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private firestore: FirestoreService,
    private nav: NavController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private firebaseAuth: Auth
  ) {
    this.checkNetworkStatus();
  }

  ngOnInit() {
    // Check network status periodically
    setInterval(() => this.checkNetworkStatus(), 30000); // Check every 30 seconds
  }

  // Network status checking
  async checkNetworkStatus() {
    try {
      this.isOnline = navigator.onLine;
      if (!this.isOnline) {
        this.networkError = true;
        this.showOfflineMessage();
      } else {
        this.networkError = false;
      }
    } catch (error) {
      console.warn('Network check failed:', error);
      this.isOnline = false;
      this.networkError = true;
    }
  }

  async showOfflineMessage() {
    const toast = await this.toastCtrl.create({
      message: 'You\'re offline. Please check your internet connection.',
      duration: 3000,
      color: 'warning',
      position: 'top'
    });
    toast.present();
  }

  // Password visibility toggle
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Smart form behavior methods
  onEmailFocus() {
    // Add focus styling or behavior
    console.log('Email field focused');
  }

  onEmailBlur() {
    // Validate email format on blur
    const email = this.loginForm.get('emailOrUserName')?.value;
    if (email && email.includes('@')) {
      // Email format detected
      console.log('Email format detected');
    }
  }

  // Google login
  async loginWithGoogle() {
    try {
      this.loading = true;
      this.errorMsg = '';
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.firebaseAuth, provider);
      
      this.loading = false;
      this.nav.navigateRoot('/home');
      
    } catch (error: any) {
      this.loading = false;
      this.handleLoginError(error);
    }
  }

  // Password reset
  async resetPassword() {
    const alert = await this.alertCtrl.create({
      header: 'Reset Password',
      message: 'Enter your email address to receive a password reset link.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Enter your email address'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send Reset Link',
          handler: async (data) => {
            if (data.email) {
              await this.sendPasswordReset(data.email);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async sendPasswordReset(email: string) {
    try {
      await sendPasswordResetEmail(this.firebaseAuth, email);
      const toast = await this.toastCtrl.create({
        message: 'Password reset email sent! Check your inbox.',
        duration: 3000,
        color: 'success'
      });
      toast.present();
    } catch (error: any) {
      let errorMessage = 'Failed to send password reset email';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      }
      
      const toast = await this.toastCtrl.create({
        message: errorMessage,
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
  }

  onLogin() {
    if (!this.isOnline) {
      this.errorMsg = 'You\'re currently offline. Please check your internet connection and try again.';
      return;
    }

    if (this.loginForm.invalid) {
      this.errorMsg = 'Please enter valid credentials.';
      this.loginForm.markAllAsTouched();
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
          this.handleRememberMe();
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
            this.handleRememberMe();
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

  // Handle remember me functionality
  handleRememberMe() {
    const rememberMe = this.loginForm.get('rememberMe')?.value;
    if (rememberMe) {
      // Store user preference for auto-login
      localStorage.setItem('rememberUser', 'true');
      localStorage.setItem('lastLoginEmail', this.loginForm.get('emailOrUserName')?.value || '');
    } else {
      localStorage.removeItem('rememberUser');
      localStorage.removeItem('lastLoginEmail');
    }
  }

  private handleLoginError(err: any) {
    console.error('Login error:', err);
    
    // Handle specific Firebase Auth errors with more helpful messages
    if (err?.code) {
      switch (err.code) {
        case 'auth/user-not-found':
          this.errorMsg = 'No account found with this email address. Please check your email or create a new account.';
          break;
        case 'auth/wrong-password':
          this.errorMsg = 'Incorrect password. Please try again or use "Forgot Password" to reset it.';
          break;
        case 'auth/invalid-email':
          this.errorMsg = 'Invalid email format. Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          this.errorMsg = 'This account has been disabled. Please contact support for assistance.';
          break;
        case 'auth/too-many-requests':
          this.errorMsg = 'Too many failed login attempts. Please wait a few minutes and try again.';
          break;
        case 'auth/network-request-failed':
          this.errorMsg = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/invalid-credential':
          this.errorMsg = 'Invalid credentials. Please check your username/email and password.';
          break;
        case 'auth/email-not-verified':
          this.errorMsg = 'Please verify your email address before logging in. Check your inbox for a verification email.';
          break;
        case 'auth/account-exists-with-different-credential':
          this.errorMsg = 'An account already exists with this email address using a different sign-in method.';
          break;
        default:
          this.errorMsg = err?.message || 'Login failed. Please try again.';
      }
    } else {
      this.errorMsg = err?.message || 'Login failed. Please try again.';
    }
  }
}
