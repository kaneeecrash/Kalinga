import { Component, OnInit } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';

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
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      const userRef = doc(this.firestore, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        this.user.displayName = data['displayName'] || '';
        this.user.email = data['email'] || '';
        this.user.occupation = data['occupation'] || '';
        this.user.photoURL = data['photoURL'] || '';
      }
    }
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
