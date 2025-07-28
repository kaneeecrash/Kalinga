import { Component, OnInit, AfterViewInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import * as mapboxgl from 'mapbox-gl';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, AfterViewInit {

  user: { userName?: string } | null = null;
  userLat = 10.317347; // add these vars to your class
  userLng = 123.885437;

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

  map?: mapboxgl.Map;

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

  async ngAfterViewInit() {
    // Set Mapbox access token
    (mapboxgl as any).accessToken = environment.mapbox.accessToken;

    // Default center if geolocation fails (Cebu City)
    let lat = 10.317347;
    let lng = 123.885437;

    try {
      const coords = await Geolocation.getCurrentPosition();
      lat = coords.coords.latitude;
      lng = coords.coords.longitude;
    } catch (err) {
      console.warn('Could not get location, using default:', err);
    }

    // Initialize map
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [lng, lat],
      zoom: 13,
    });

    // Add user marker (red)
    if (this.map) {
      new mapboxgl.Marker({ color: '#e53935' })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setText("You are here"))
        .addTo(this.map);

      // Add ongoing mission markers (green)
      this.ongoingMissions.forEach(mission => {
        new mapboxgl.Marker({ color: '#218838' })
          .setLngLat([mission.lng, mission.lat])
          .setPopup(new mapboxgl.Popup().setText(mission.name))
          .addTo(this.map as mapboxgl.Map);
      });
    }
  }

  recenterMap() {
    if (this.map) {
      this.map.flyTo({ center: [this.userLng, this.userLat], zoom: 14 });
    }
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

  goToNotifications() {
    this.nav.navigateForward('/notifications');
  }
}
