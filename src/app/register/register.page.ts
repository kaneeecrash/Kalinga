import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController } from '@ionic/angular';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { Subject, from, of } from 'rxjs';

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
  }, { validators: this.passwordMatchValidator });
  loading = false;
  errorMsg: string | null = null;
  usernameChecking = false;
  usernameAvailable: boolean | null = null;
  usernameError: string | null = null;
  
  private usernameSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private firestore: FirestoreService,
    private nav: NavController
  ) {
    // Set up real-time username validation
    this.setupUsernameValidation();
  }

  ngOnInit() {
    // Subscribe to username changes for real-time validation
    this.regForm.get('userName')?.valueChanges.subscribe(value => {
      if (value && value.trim().length > 0) {
        this.usernameSubject.next(value.trim().toLowerCase());
      } else {
        this.usernameAvailable = null;
        this.usernameError = null;
      }
    });
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
