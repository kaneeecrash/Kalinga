import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit {

  user: { userName?: string } | null = null;

  featuredMissions = [
    {
      type: 'Medical Mission',
      venue: 'Brgy. Tisa, Cebu City',
      date: 'July 20, 2025',
      time: '8:00 AM - 5:00 PM',
      status: 'OPEN',
      distance: '5km away',
    },
    {
      type: 'Free Dental Services',
      venue: 'USJR Basak Campus',
      date: 'July 10, 2025',
      time: '10:00 AM - 4:00 PM',
      status: 'OPEN',
      distance: '500m away',
    },
    {
      type: 'Free Dental Services',
      venue: 'USJR Basak Campus',
      date: 'July 10, 2025',
      time: '10:00 AM - 4:00 PM',
      status: 'OPEN',
      distance: '500m away',
    }
  ];

  ongoingMissions = [
    { lat: 10.307, lng: 123.892, name: "Mission A" },
    { lat: 10.300, lng: 123.900, name: "Mission B" },
  ];

  constructor(
    private nav: NavController,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const docRef = doc(this.firestore, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          this.user = {
            userName: profile['userName'] || 'User'
          };
        } else {
          this.user = { userName: 'User' };
        }
      } else {
        this.user = null;
      }
    });
  }

  viewDetails(mission: any) {
    alert(`Mission: ${mission.type}\nVenue: ${mission.venue}`);
  }

  goToJoinMission() {
    this.nav.navigateForward('/missions');
  }
  goToDonate() {
    this.nav.navigateForward('/donations');
  }
  goToLeaderboard() {
    this.nav.navigateForward('/leaderboards');
  }
}
