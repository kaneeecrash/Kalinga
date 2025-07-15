import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { FirestoreService } from '../services/firestore.service';
import { NavController } from '@ionic/angular';

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
          this.errorMsg = err?.message || 'Login failed. Please try again.';
        }
      });
    } else {
      // Case-insensitive username support
      const normalizedUserName = emailOrUserName.toLowerCase();

      this.firestore.getUserByUsername(normalizedUserName)
        .then(userDoc => {
          if (userDoc && userDoc.email) {
            this.auth.login(userDoc.email, password).subscribe({
              next: () => {
                this.loading = false;
                this.nav.navigateRoot('/home');
              },
              error: err => {
                this.loading = false;
                this.errorMsg = err?.message || 'Login failed. Please try again.';
              }
            });
          } else {
            this.loading = false;
            this.errorMsg = 'No account found for this username.';
          }
        })
        .catch(() => {
          this.loading = false;
          this.errorMsg = 'Error checking username. Please try again.';
        });
    }
  }
}
