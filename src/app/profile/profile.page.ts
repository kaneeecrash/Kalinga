import { Component, OnInit } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { switchMap, of, map } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
  user: any = {
    displayName: '',
    email: '',
    occupation: '',
    photoURL: '',
    missionsAttended: 51,   // static for now
    missionPoints: 186      // static for now
  };

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private authService: AuthService,
    private nav: NavController,
    private router: Router
  ) {}

  async ngOnInit() {
    this.loadUserData();
  }

  // Refresh data when page becomes active (when navigating back from Profile Info)
  ionViewWillEnter() {
    this.loadUserData();
  }

  // Extract user loading logic into a reusable method
  private loadUserData() {
    authState(this.auth).pipe(
      switchMap((user) => {
        if (user) {
          // Use docData which returns an Observable directly
          const userRef = doc(this.firestore, 'users', user.uid);
          return docData(userRef).pipe(
            map(userData => {
              if (userData) {
                this.user.displayName = userData['displayName'] || '';
                this.user.email = userData['email'] || '';
                this.user.occupation = userData['occupation'] || '';
                this.user.photoURL = userData['photoURL'] || '';
                
                console.log('Profile data refreshed:', this.user);
              }
              return null;
            })
          );
        } else {
          return of(null);
        }
      })
    ).subscribe({
      error: (error) => {
        console.error('Error loading profile data:', error);
      }
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.nav.navigateRoot('/login');
      },
      error: (err) => {
        alert('Logout failed. Please try again.');
      }
    });
  }
}
