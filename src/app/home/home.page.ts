import { Component, OnInit, AfterViewInit, NgZone } from '@angular/core';
import { NavController } from '@ionic/angular';
import { FirestoreService } from '../services/firestore.service'; // Import your Firestore service
import { Auth, authState, User } from '@angular/fire/auth';
import * as mapboxgl from 'mapbox-gl';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from '../../environments/environment';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, AfterViewInit {

  user: { userName?: string } | null = null;
  userLat = 10.317347; // default coordinates for Cebu City
  userLng = 123.885437;

  featuredMissions: any[] = [];  // To store the fetched missions
  allMissions: any[] = [];
  knownMissionIds = new Set<string>();

  ongoingMissions = [
    { lat: 10.307, lng: 123.892, missionName: "Mission A" },
    { lat: 10.300, lng: 123.900, missionName: "Mission B" },
  ];

  map?: mapboxgl.Map;

  constructor(
    private nav: NavController,
    private firestoreService: FirestoreService, // Inject FirestoreService
    private ngZone: NgZone,
    private auth: Auth
  ) {}

  ngOnInit() {
    // Use Angular Fire's authState observable instead of direct Firebase calls
    authState(this.auth).subscribe(async (user: User | null) => {
      if (user) {
        const profile = await this.firestoreService.getUserByUID(user.uid);
        this.user = profile ? { userName: profile.userName || 'User' } : { userName: 'User' };
      } else {
        this.user = null;
      }
    });

    // Fetch the latest 3 missions for Featured Missions
    this.fetchFeaturedMissions();
  }

  fetchFeaturedMissions() {
    this.firestoreService.getMissions(3).subscribe(missions => {
      this.featuredMissions = missions;
    });
  }

  private watchAllMissionsAndNotify() {
    this.firestoreService.getMissions().subscribe(async (missions) => {
      this.allMissions = missions;
      // Notify on newly observed missions
      for (const m of missions) {
        if (m.id && !this.knownMissionIds.has(m.id)) {
          this.knownMissionIds.add(m.id);
          await this.sendLocalNotification(m);
        }
      }
      // Plot markers for all missions
      this.plotMissionMarkers();
    });
  }

  async ngAfterViewInit() {
    // Set Mapbox access token
    (mapboxgl as any).accessToken = environment.mapbox.accessToken;

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
          .setPopup(new mapboxgl.Popup().setText(mission.missionName))
          .addTo(this.map as mapboxgl.Map);
      });
      // Start watching missions for markers & notifications
      await LocalNotifications.requestPermissions();
      this.watchAllMissionsAndNotify();
    }
  }

  recenterMap() {
    if (this.map) {
      this.map.flyTo({ center: [this.userLng, this.userLat], zoom: 14 });
    }
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

  async joinMission(missionId: string) {
    const user = this.auth.currentUser;
    if (!user) {
      alert('Please login first');
      this.nav.navigateForward('/login');
      return;
    }
    await this.firestoreService.joinMission(
      missionId,
      user.uid,
      user.displayName || user.email || 'Volunteer'
    );
    this.nav.navigateForward(['/mission', missionId]);
  }

  private async sendLocalNotification(mission: any) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: 'New Mission Posted',
            body: `${mission.missionName || 'A new mission'} at ${mission.location || ''}`.trim(),
            schedule: { at: new Date(Date.now() + 500) },
            extra: { missionId: mission.id }
          }
        ]
      });
    } catch {}
  }

  private async plotMissionMarkers() {
    if (!this.map) return;
    for (const m of this.allMissions) {
      const coords = await this.ensureCoordinates(m);
      if (!coords) continue;
      new mapboxgl.Marker({ color: '#e53935' })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(new mapboxgl.Popup().setText(m.missionName || 'Mission'))
        .addTo(this.map as mapboxgl.Map);
    }
  }

  private async ensureCoordinates(mission: any): Promise<{ lng: number; lat: number } | null> {
    if (typeof mission?.lng === 'number' && typeof mission?.lat === 'number') {
      return { lng: mission.lng, lat: mission.lat };
    }
    if (!mission?.location) return null;
    try {
      const token = environment.mapbox.accessToken;
      const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mission.location)}.json?access_token=${token}`);
      const data = await resp.json();
      const center = data?.features?.[0]?.center;
      if (Array.isArray(center) && center.length >= 2) {
        return { lng: center[0], lat: center[1] };
      }
    } catch {}
    return null;
  }
}