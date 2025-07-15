import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
  userName: string = '';
  userEmail: string = '';
  userPhotoURL: string = 'assets/me.jpg';

  constructor( private nav : NavController) {}

  ngOnInit() {
    // Example: Load user data from a service or storage
    // this.userName = 'Juan Dela Cruz';
    // this.userEmail = 'juan@email.com';
    // this.userPhotoURL = 'assets/me.jpg';
  }
  goToProfileInfo() {
    this.nav.navigateForward('/profile-info');
  }

}