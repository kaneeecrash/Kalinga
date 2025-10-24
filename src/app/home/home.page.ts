import { Component, OnInit, AfterViewInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service'; // Import your Firestore service
import { Auth, authState, User } from '@angular/fire/auth';
import * as mapboxgl from 'mapbox-gl';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from '../../environments/environment';
import { LocalNotifications } from '@capacitor/local-notifications';
import { switchMap, of, from, map, Observable, forkJoin, first } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, AfterViewInit {

  user: { userName?: string; displayName?: string; photoURL?: string; uid?: string } | null = null;
  userLat = 10.291389; // Your current location: 10°17'29.0"N
  userLng = 123.860500; // Your current location: 123°51'37.8"E

  featuredMissions: any[] = [];  // To store the fetched missions
  allMissions: any[] = [];
  knownMissionIds = new Set<string>();
  userMissionStatus: Map<string, string> = new Map(); // Track user's status for each mission

  map?: mapboxgl.Map;
  userMarker?: mapboxgl.Marker;
  missionMarkers: mapboxgl.Marker[] = [];
  mapLoadAttempts = 0;
  maxMapLoadAttempts = 3;

  constructor(
    private nav: NavController,
    private router: Router,
    private firestoreService: FirestoreService, // Inject FirestoreService
    private auth: Auth
  ) {}

  ngOnInit() {
    // First check authentication status
    this.firestoreService.checkAuthStatus().subscribe({
      next: (user) => {
        if (user) {
          console.log('User is authenticated, loading data...');
          this.loadUserData();
          this.fetchFeaturedMissions();
        } else {
          console.log('User not authenticated, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        console.error('Auth check error:', error);
        this.router.navigate(['/login']);
      }
    });
  }

  // Pull-to-refresh functionality
  doRefresh(event: any) {
    console.log('Refreshing home page data...');
    
    // Refresh user data
    this.loadUserData();
    
    // Refresh featured missions
    this.fetchFeaturedMissions();
    
    // Refresh map if it exists
    if (this.map) {
      this.retryMapLoad();
    }
    
    // Complete the refresh after a short delay to show the loading state
    setTimeout(() => {
      event.target.complete();
      console.log('Home page refresh completed');
    }, 1000);
  }

  // Refresh data when page becomes active (when navigating back from Profile Info)
  ionViewWillEnter() {
    this.loadUserData();
    // Also refresh mission statuses when returning to homepage
    this.loadUserMissionStatuses();
  }

  // Extract user loading logic into a reusable method
  private loadUserData() {
    // Use Angular Fire's authState observable properly with proper error handling
    authState(this.auth).pipe(
      first(), // Add first() to avoid injection context warning
      switchMap((user: User | null) => {
        if (user) {
          // Now getUserByUID returns an Observable, so we can use it directly
          return this.firestoreService.getUserByUID(user.uid).pipe(
            map(profile => {
              if (profile) {
                this.user = {
                  userName: profile.userName || profile.displayName || 'User',
                  displayName: profile.displayName || profile.userName || 'User',
                  photoURL: profile.photoURL || '',
                  uid: user.uid
                };
                console.log('Homepage user data refreshed:', this.user);
              } else {
                this.user = { userName: 'User', displayName: 'User', photoURL: '', uid: user.uid };
              }
              return null;
            })
          );
        } else {
          this.user = null;
          return of(null);
        }
      })
    ).subscribe({
      error: (error) => {
        console.error('Error loading user data:', error);
        this.user = null;
      }
    });
  }

  fetchFeaturedMissions() {
    // First update mission statuses for missions that have passed
    this.firestoreService.updateMissionStatuses().subscribe(() => {
      // Then fetch and display missions
      this.firestoreService.getMissions().subscribe(async missions => {
        // Filter out past missions (missions that have already passed)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        const upcomingMissions = missions.filter(mission => {
          const missionDate = new Date(mission.date);
          missionDate.setHours(23, 59, 59, 999); // End of mission date
          return missionDate >= today; // Only include missions from today onwards
        });

        // Sort by mission date (earliest first), then by creation date if same mission date
        const sortedMissions = upcomingMissions.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          
          // Compare mission dates first
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;
          
          // If same mission date, sort by creation date (newest first)
          const createdA = new Date(a.createdAt);
          const createdB = new Date(b.createdAt);
          return createdB.getTime() - createdA.getTime();
        });

        // Take the first 3 (earliest upcoming missions)
        this.featuredMissions = sortedMissions.slice(0, 3);
        
        // Load user's status for each mission
        await this.loadUserMissionStatuses();
      });
    });
  }

  private watchAllMissionsAndNotify() {
    this.firestoreService.getMissions().subscribe(async (missions) => {
      // Filter out past missions for consistency
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      const upcomingMissions = missions.filter(mission => {
        const missionDate = new Date(mission.date);
        missionDate.setHours(23, 59, 59, 999); // End of mission date
        return missionDate >= today; // Only include missions from today onwards
      });
      
      this.allMissions = upcomingMissions;
      // Notify on newly observed missions
      for (const m of upcomingMissions) {
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
    try {
      console.log('Initializing map...');
      
      // Request location permissions first
      await this.requestLocationPermissions();
      
      // Set Mapbox access token
      (mapboxgl as any).accessToken = environment.mapbox.accessToken;
      console.log('Mapbox token set:', environment.mapbox.accessToken ? 'Present' : 'Missing');

      // Get user's current location with high accuracy
      await this.getUserLocation();

      // Initialize map with user's location immediately
      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [this.userLng, this.userLat],
        zoom: 13,
        attributionControl: false
      });

      // Add event listeners for debugging
      this.map.on('load', () => {
        console.log('Map loaded successfully');
      });

      this.map.on('error', (e) => {
        console.error('Map error:', e);
        this.showMapError();
      });

      // Add user marker (red pin)
      this.addUserMarker();

      // Start watching missions for markers & notifications
      await LocalNotifications.requestPermissions();
      this.watchAllMissionsAndNotify();
    } catch (error) {
      console.error('Error initializing map:', error);
      this.showMapError();
    }
  }

  private async requestLocationPermissions() {
    try {
      // Check if we're running on web platform
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.getPlatform() === 'web') {
        console.log('Running on web platform - skipping permission request');
        return true; // On web, we'll try to get location directly
      }
      
      const permissions = await Geolocation.requestPermissions();
      console.log('Location permissions:', permissions);
      
      if (permissions.location !== 'granted') {
        console.warn('Location permission not granted, using default location');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      // On web, this error is expected, so we continue
      return true;
    }
  }

  private async getUserLocation() {
    try {
      console.log('Requesting high accuracy location...');
      
      const coords = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,        // Use GPS instead of network
        timeout: 15000,                   // 15 second timeout
        maximumAge: 60000                // Accept cached location up to 1 minute old
      });
      
      this.userLat = coords.coords.latitude;
      this.userLng = coords.coords.longitude;
      
      console.log('User location:', this.userLat, this.userLng);
      console.log('Location accuracy:', coords.coords.accuracy, 'meters');
      
      // Check if location is accurate enough
      if (coords.coords.accuracy > 100) {
        console.warn('Location accuracy is poor:', coords.coords.accuracy, 'meters - consider moving to an open area');
      } else if (coords.coords.accuracy > 50) {
        console.log('Location accuracy is moderate:', coords.coords.accuracy, 'meters');
      } else {
        console.log('Location accuracy is excellent:', coords.coords.accuracy, 'meters');
      }
      
    } catch (err) {
      console.warn('Could not get location, using default Cebu City:', err);
      console.log('Make sure location permissions are granted and GPS is enabled');
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

  async recenterMap() {
    if (this.map) {
      console.log('Recentering map and refreshing location...');
      
      // Get fresh location
      await this.getUserLocation();
      
      // Update user marker with new location
      this.addUserMarker();
      
      // Fly to new location
      this.map.flyTo({ 
        center: [this.userLng, this.userLat], 
        zoom: 14,
        duration: 1000
      });
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

  // Updated: Apply to mission instead of directly joining
  joinMission(missionId: string): Observable<void> {
    const user = this.auth.currentUser;
    if (user) {
      return this.firestoreService.applyToMission(
        missionId,
        user.uid
      );
    } else {
      return of(null).pipe(
        switchMap(() => {
          throw new Error('User not authenticated');
        })
      );
    }
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
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mission.location)}.json?access_token=${token}&country=PH`);
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

  private showMapError() {
    const mapElement = document.getElementById('map');
    const errorElement = document.getElementById('map-error');
    
    if (mapElement && errorElement) {
      mapElement.style.display = 'none';
      errorElement.style.display = 'flex';
    }
  }

  private hideMapError() {
    const mapElement = document.getElementById('map');
    const errorElement = document.getElementById('map-error');
    
    if (mapElement && errorElement) {
      mapElement.style.display = 'block';
      errorElement.style.display = 'none';
    }
  }

  retryMapLoad() {
    if (this.mapLoadAttempts >= this.maxMapLoadAttempts) {
      console.log('Max map load attempts reached');
      return;
    }

    this.mapLoadAttempts++;
    console.log(`Retrying map load (attempt ${this.mapLoadAttempts}/${this.maxMapLoadAttempts})`);
    
    this.hideMapError();
    
    // Clean up existing map
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    
    // Retry initialization immediately
    this.ngAfterViewInit();
  }

  // Helper function to convert 24-hour format to 12-hour format
  formatTimeTo12Hour(time24: string): string {
    if (!time24) return '';
    
    // Handle different time formats
    let timeStr = time24;
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':');
      const hour24 = parseInt(hours, 10);
      const mins = minutes || '00';
      
      if (hour24 === 0) {
        return `12:${mins} AM`;
      } else if (hour24 < 12) {
        return `${hour24}:${mins} AM`;
      } else if (hour24 === 12) {
        return `12:${mins} PM`;
      } else {
        return `${hour24 - 12}:${mins} PM`;
      }
    }
    
    return time24; // Return original if format is not recognized
  }

  formatLocation(location: string): string {
    if (!location) return '';
    
    // Remove "Philippines" from the location string
    return location.replace(/,?\s*Philippines\s*$/i, '').trim();
  }

  // Navigate to mission detail page
  goToMissionDetail(missionId: string) {
    this.router.navigate(['/mission', missionId]);
  }

  // Get button text based on user's status
  getButtonText(mission: any): string {
    const status = this.userMissionStatus.get(mission.id);
    const missionStatus = mission.status?.toLowerCase();
    
    if (missionStatus !== 'open') {
      return 'Closed';
    }
    
    switch (status) {
      case 'approved':
      case 'accepted':
        return 'Joined ✓';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending...';
      default:
        return 'Join';
    }
  }

  // Get button color based on user's status
  getButtonColor(mission: any): string {
    const status = this.userMissionStatus.get(mission.id);
    const missionStatus = mission.status?.toLowerCase();
    
    if (missionStatus !== 'open') {
      return 'medium';
    }
    
    switch (status) {
      case 'approved':
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return 'success';
    }
  }

  // Check if user can join mission
  canJoinMission(mission: any): boolean {
    const status = this.userMissionStatus.get(mission.id);
    const missionStatus = mission.status?.toLowerCase();
    
    return missionStatus === 'open' && !status;
  }

  // Handle mission action (join or show status)
  handleMissionAction(mission: any, event: Event) {
    event.stopPropagation(); // Prevent card click
    
    const status = this.userMissionStatus.get(mission.id);
    
    if (!status && mission.status?.toLowerCase() === 'open') {
      this.joinMission(mission.id).subscribe({
        next: () => {
          console.log('Successfully applied to mission:', mission.id);
          // Refresh status after joining to update button immediately
          this.loadUserMissionStatuses();
        },
        error: (error) => {
          console.error('Error applying to mission:', error);
        }
      });
    }
    // If user has a status, clicking the button doesn't do anything
  }

  // Load user's mission statuses
  private loadUserMissionStatuses() {
    if (!this.user || !this.user.uid) return;
    
    // Use forkJoin to combine all observables
    const missionStatusObservables = this.featuredMissions
      .filter(mission => mission.id)
      .map(mission => 
        this.firestoreService.getUserMissionStatus(mission.id, this.user!.uid!).pipe(
          map(status => ({ missionId: mission.id, status }))
        )
      );

    if (missionStatusObservables.length > 0) {
      forkJoin(missionStatusObservables).subscribe({
        next: (results) => {
          results.forEach(({ missionId, status }) => {
            if (missionId) {
              this.userMissionStatus.set(missionId, status);
            }
          });
        },
        error: (error) => {
          console.error('Error loading user mission statuses:', error);
        }
      });
    }
  }
}