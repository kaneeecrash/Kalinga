import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private authSubscription: Subscription | null = null;

  constructor(
    private nav: NavController,
    private router: Router,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.setupAuthListener();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  private setupAuthListener() {
    // Listen to authentication state changes
    this.authSubscription = authState(this.auth)
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        const currentUrl = this.router.url;
        
        // Skip redirect if on splash page (let splash handle initial navigation)
        if (currentUrl === '/splash') {
          return;
        }

        if (user) {
          // User is authenticated
          if (currentUrl === '/login' || currentUrl === '/register') {
            // Redirect authenticated users away from login/register pages
            this.router.navigate(['/home'], { replaceUrl: true });
          }
        } else {
          // User is not authenticated
          if (currentUrl !== '/login' && currentUrl !== '/register' && currentUrl !== '/splash') {
            // Redirect unauthenticated users to login page
            this.router.navigate(['/login'], { replaceUrl: true });
          }
        }
      });
  }

  isActive(url: string): boolean {
    return this.router.url === url;
  }
  
  isLoginPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/register';
  }
  
  isSplashPage(): boolean {
    return this.router.url === '/splash';
  }
}



