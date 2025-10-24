import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { Subject, from, of } from 'rxjs';
import { GoogleAuthProvider, signInWithPopup, sendEmailVerification } from '@angular/fire/auth';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false
})
export class RegisterPage {
  regForm = this.fb.group({
    userName: ['', [Validators.required, Validators.minLength(3)]],
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]/)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });
  loading = false;
  errorMsg: string | null = null;
  usernameChecking = false;
  usernameAvailable: boolean | null = null;
  usernameError: string | null = null;
  isOnline = true;
  networkError = false;
  
  // Password strength and visibility
  showPassword = false;
  showConfirmPassword = false;
  passwordStrength = 0;
  passwordStrengthText = '';
  passwordStrengthColor = '';
  
  // Form validation states
  get isEmailValid(): boolean {
    const value = this.regForm.get('email')?.value;
    return !!(value && value.includes('@') && value.length > 5);
  }

  get isPasswordValid(): boolean {
    const value = this.regForm.get('password')?.value;
    return !!(value && value.length >= 6);
  }

  get isFormValid(): boolean {
    return this.regForm.valid && this.isOnline && this.usernameAvailable !== false;
  }
  
  private usernameSubject = new Subject<string>();

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
    // Set up real-time username validation
    this.setupUsernameValidation();
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

  ngOnInit() {
    // Check network status periodically
    setInterval(() => this.checkNetworkStatus(), 30000); // Check every 30 seconds
    
    // Subscribe to username changes for real-time validation
    this.regForm.get('userName')?.valueChanges.subscribe(value => {
      if (value && value.trim().length > 0) {
        this.usernameSubject.next(value.trim().toLowerCase());
      } else {
        this.usernameAvailable = null;
        this.usernameError = null;
      }
    });

    // Subscribe to password changes for strength checking
    this.regForm.get('password')?.valueChanges.subscribe(value => {
      if (value) {
        this.checkPasswordStrength(value);
      } else {
        this.passwordStrength = 0;
        this.passwordStrengthText = '';
        this.passwordStrengthColor = '';
      }
    });
  }

  // Password strength checker
  checkPasswordStrength(password: string) {
    if (!password) {
      this.passwordStrength = 0;
      this.passwordStrengthText = '';
      this.passwordStrengthColor = '';
      return;
    }

    let strength = 0;
    let text = '';
    let color = '';

    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    switch (strength) {
      case 0:
      case 1:
        text = 'Very Weak';
        color = 'danger';
        break;
      case 2:
        text = 'Weak';
        color = 'warning';
        break;
      case 3:
        text = 'Fair';
        color = 'medium';
        break;
      case 4:
        text = 'Good';
        color = 'success';
        break;
      case 5:
        text = 'Strong';
        color = 'success';
        break;
    }

    this.passwordStrength = strength;
    this.passwordStrengthText = text;
    this.passwordStrengthColor = color;
  }

  // Password visibility toggles
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Getter for password value to avoid template null issues
  get passwordValue(): string {
    return this.regForm.get('password')?.value || '';
  }

  // Getter to check if password strength should be shown
  get shouldShowPasswordStrength(): boolean {
    const password = this.passwordValue;
    return !!(password && password.length > 0);
  }

  // Google registration
  async registerWithGoogle() {
    try {
      this.loading = true;
      this.errorMsg = '';
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.firebaseAuth, provider);
      
      // Check if user exists in Firestore
      const userDoc = await this.firestore.getUserByUID(result.user.uid).toPromise();
      
      if (userDoc) {
        this.errorMsg = 'An account with this Google email already exists. Please try logging in instead.';
        this.loading = false;
        return;
      }

      // Create user profile for new Google users
      const userName = result.user.displayName?.toLowerCase().replace(/\s+/g, '') || 'user' + Date.now();
      
      await this.firestore.setDocument('users', result.user.uid, {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email,
        userName: userName,
        photoURL: result.user.photoURL,
        provider: 'google',
        createdAt: new Date()
      }).toPromise();
      
      this.loading = false;
      
      // Show success message and redirect
      const toast = await this.toastCtrl.create({
        message: 'Account created successfully!',
        duration: 2000,
        color: 'success'
      });
      toast.present();
      
      this.nav.navigateRoot('/home');
      
    } catch (error: any) {
      this.loading = false;
      this.handleRegistrationError(error);
    }
  }

  // Email verification
  async sendVerificationEmail() {
    const user = this.firebaseAuth.currentUser;
    if (user) {
      try {
        await sendEmailVerification(user);
        const toast = await this.toastCtrl.create({
          message: 'Verification email sent! Check your inbox.',
          duration: 3000,
          color: 'success'
        });
        toast.present();
      } catch (error) {
        const toast = await this.toastCtrl.create({
          message: 'Failed to send verification email',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
      }
    }
  }

  private setupUsernameValidation() {
    this.usernameSubject.pipe(
      debounceTime(500), // Wait 500ms after user stops typing
      distinctUntilChanged(), // Only check if username actually changed
      switchMap(username => {
        this.usernameChecking = true;
        this.usernameError = null;
        
        // Convert Promise to Observable using from()
        return from(this.firestore.getUserByUsername(username)).pipe(
          catchError(error => {
            console.error('Username check error:', error);
            this.usernameChecking = false;
            this.usernameError = 'Unable to check username availability. Please try again.';
            return of(null);
          })
        );
      })
    ).subscribe({
      next: (userDoc) => {
        this.usernameChecking = false;
        if (userDoc) {
          this.usernameAvailable = false;
          this.usernameError = 'This username is already taken. Please choose another one.';
        } else {
          this.usernameAvailable = true;
          this.usernameError = null;
        }
      },
      error: (error) => {
        this.usernameChecking = false;
        this.usernameError = 'Unable to check username availability. Please try again.';
        console.error('Username validation error:', error);
      }
    });
  }

  // Custom validator for password confirmation
  passwordMatchValidator(form: any) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    return password && confirmPassword && password.value === confirmPassword.value 
      ? null : { mismatch: true };
  }

  async onRegister() {
    if (this.regForm.invalid) {
      this.errorMsg = 'Please fill out all required fields correctly.';
      return;
    }
    
    // Check if username is available
    if (this.usernameAvailable === false) {
      this.errorMsg = 'Please choose a different username.';
      return;
    }
    
    // Check if username is still being validated
    if (this.usernameChecking) {
      this.errorMsg = 'Please wait while we check username availability.';
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
      this.errorMsg = 'Passwords do not match! Please make sure both passwords are identical.';
      return;
    }

    // Proceed with registration
    this.loading = true;
    this.errorMsg = null;

    this.auth.register(email, password, displayName, userName).subscribe({
      next: async (user: any) => {
        const uid = user?.uid;
        if (uid) {
          this.firestore.setDocument('users', uid, {
            uid,
            displayName,
            email,
            userName, // always stored in lowercase!
            createdAt: new Date()
          }).subscribe({
            next: async () => {
              this.loading = false;
              
              // Send email verification
              try {
                await this.sendVerificationEmail();
                
                // Show verification alert
                const alert = await this.alertCtrl.create({
                  header: 'Account Created Successfully!',
                  message: 'We\'ve sent a verification email to your inbox. Please check your email and click the verification link to activate your account.',
                  buttons: [
                    {
                      text: 'Resend Email',
                      handler: () => this.sendVerificationEmail()
                    },
                    {
                      text: 'Continue to Login',
                      handler: () => this.nav.navigateRoot('/login')
                    }
                  ]
                });
                await alert.present();
              } catch (error) {
                // If verification fails, still redirect to login
                this.nav.navigateRoot('/login');
              }
            },
            error: err => {
              this.loading = false;
              this.handleRegistrationError(err, 'User created, but failed to save profile. Please try logging in.');
            }
          });
        } else {
          this.loading = false;
          this.errorMsg = 'User created, but no UID found. Please try logging in.';
        }
      },
      error: err => {
        this.loading = false;
        this.handleRegistrationError(err);
      }
    });
  }

  private handleRegistrationError(err: any, customMessage?: string) {
    console.error('Registration error:', err);
    
    // Handle specific Firebase Auth errors
    if (err?.code) {
      switch (err.code) {
        case 'auth/email-already-in-use':
          this.errorMsg = 'An account with this email already exists. Please use a different email or try logging in.';
          break;
        case 'auth/invalid-email':
          this.errorMsg = 'Invalid email format. Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          this.errorMsg = 'Password is too weak. Please choose a stronger password with at least 6 characters.';
          break;
        case 'auth/operation-not-allowed':
          this.errorMsg = 'Registration is currently disabled. Please contact support for assistance.';
          break;
        case 'auth/network-request-failed':
          this.errorMsg = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/too-many-requests':
          this.errorMsg = 'Too many registration attempts. Please wait a moment and try again.';
          break;
        default:
          this.errorMsg = customMessage || err?.message || 'Registration failed. Please try again.';
      }
    } else {
      this.errorMsg = customMessage || err?.message || 'Registration failed. Please try again.';
    }
  }
}
