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
  userLat = 10.291389; // Your current location: 10°17'29.0"N
  userLng = 123.860500; // Your current location: 123°51'37.8"E

  featuredMissions: any[] = [];  // To store the fetched missions
  allMissions: any[] = [];
  knownMissionIds = new Set<string>();

  map?: mapboxgl.Map;
  userMarker?: mapboxgl.Marker;
  missionMarkers: mapboxgl.Marker[] = [];

  constructor(
    private nav: NavController,
    private firestoreService: FirestoreService, // Inject FirestoreService
    private ngZone: NgZone,
    private auth: Auth
  ) {}

  ngOnInit() {
    // Use Angular Fire's authState observable with proper zone handling
    this.ngZone.run(() => {
      authState(this.auth).subscribe(async (user: User | null) => {
        if (user) {
          const profile = await this.firestoreService.getUserByUID(user.uid);
          this.user = profile ? { userName: profile.userName || 'User' } : { userName: 'User' };
        } else {
          this.user = null;
        }
      });
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

    // Get user's current location
    await this.getUserLocation();

    // Initialize map with user's location
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [this.userLng, this.userLat],
      zoom: 13,
    });

    // Add user marker (red pin)
    this.addUserMarker();

    // Start watching missions for markers & notifications
    await LocalNotifications.requestPermissions();
    this.watchAllMissionsAndNotify();
  }

  private async getUserLocation() {
    try {
      const coords = await Geolocation.getCurrentPosition();
      this.userLat = coords.coords.latitude;
      this.userLng = coords.coords.longitude;
      console.log('User location:', this.userLat, this.userLng);
    } catch (err) {
      console.warn('Could not get location, using default Cebu City:', err);
      // Keep default coordinates for Cebu City
    }
  }

  private addUserMarker() {
    if (!this.map) return;

    // Remove existing user marker if any
    if (this.userMarker) {
      this.userMarker.remove();
    }

    // Add new user marker (red pin)
    this.userMarker = new mapboxgl.Marker({ color: '#e53935' })
      .setLngLat([this.userLng, this.userLat])
      .setPopup(new mapboxgl.Popup().setText("You are here"))
      .addTo(this.map);
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

  // Updated: Redirect to mission detail page instead of directly joining
  joinMission(missionId: string) {
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

    // Clear existing mission markers
    this.missionMarkers.forEach(marker => marker.remove());
    this.missionMarkers = [];

    // Add markers for all missions
    for (const mission of this.allMissions) {
      const coords = await this.ensureCoordinates(mission);
      if (!coords) continue;

      // Create green marker for mission
      const marker = new mapboxgl.Marker({ color: '#218838' })
        .setLngLat([coords.lng, coords.lat])
        .setPopup(new mapboxgl.Popup().setText(mission.missionName || 'Mission'))
        .addTo(this.map);

      this.missionMarkers.push(marker);
    }
  }

  private async ensureCoordinates(mission: any): Promise<{ lng: number; lat: number } | null> {
    // If mission has exact coordinates, use them
    if (typeof mission?.lng === 'number' && typeof mission?.lat === 'number') {
      return { lng: mission.lng, lat: mission.lat };
    }

    // If mission has location string, geocode it
    if (mission?.location) {
      try {
        const token = environment.mapbox.accessToken;
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mission.location)}.json?access_token=${token}`);
        const data = await resp.json();
        const center = data?.features?.[0]?.center;
        if (Array.isArray(center) && center.length >= 2) {
          return { lng: center[0], lat: center[1] };
        }
      } catch (error) {
        console.error('Geocoding error for mission:', mission.missionName, error);
      }
    }

    return null;
  }
}