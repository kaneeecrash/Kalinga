import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  standalone: false,
})
export class SplashPage implements OnInit {
  isLoading = true;
  progress = 0;

  constructor(
    private router: Router,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.startSplashAnimation();
  }

  private startSplashAnimation() {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      this.progress += 2;
      if (this.progress >= 100) {
        clearInterval(progressInterval);
        this.checkAuthAndNavigate();
      }
    }, 30);

    // Minimum splash screen duration (2 seconds)
    setTimeout(() => {
      if (this.progress < 100) {
        clearInterval(progressInterval);
        this.progress = 100;
        this.checkAuthAndNavigate();
      }
    }, 2000);
  }

  private checkAuthAndNavigate() {
    // Check if user is authenticated
    authState(this.auth).pipe(take(1)).subscribe(user => {
      this.isLoading = false;
      
      if (user) {
        // User is logged in, go to home
        this.router.navigate(['/home'], { replaceUrl: true });
      } else {
        // User is not logged in, go to login
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
}
