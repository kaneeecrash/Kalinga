import { Component, OnInit, AfterViewInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { Auth, authState, User } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';
import { switchMap, map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

type ApplicationStatus = 'not_applied' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-mission-detail',
  templateUrl: './mission-detail.page.html',
  styleUrls: ['./mission-detail.page.scss'],
  standalone: false
})
export class MissionDetailPage implements OnInit, AfterViewInit {
  mission: any;
  map?: mapboxgl.Map;
  user: User | null = null;
  applicationStatus: ApplicationStatus = 'not_applied';
  isLoading = true;
  mapInitialized = false;
  userLat = 10.317347; // Default Cebu City
  userLng = 123.885437;

  constructor(
    private route: ActivatedRoute, 
    private firestore: FirestoreService,
    private auth: Auth,
    private alertController: AlertController,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    // Get current user with proper zone handling
    this.ngZone.run(() => {
      authState(this.auth).subscribe(user => {
        this.user = user;
        if (user && this.mission) {
          this.checkApplicationStatus();
        }
      });
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.firestore.getMissionById(id).subscribe((m) => {
        this.mission = m;
        this.isLoading = false;
        
        // Initialize map after mission data is loaded
        if (this.mapInitialized) {
          this.initializeMap();
        }
        
        // Check application status if user is logged in
        if (this.user) {
          this.checkApplicationStatus();
        }
      });
    }
  }

  ngAfterViewInit() {
    // Get user location first, then initialize map immediately
    this.getUserLocation().then(() => {
      this.initializeMap();
    });
  }

  private async getUserLocation() {
    try {
      console.log('Requesting high accuracy location for mission detail...');
      
      const coords = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,        // Use GPS instead of network
        timeout: 15000,                   // 15 second timeout
        maximumAge: 60000                // Accept cached location up to 1 minute old
      });
      
      this.userLat = coords.coords.latitude;
      this.userLng = coords.coords.longitude;
      
      console.log('User location for mission detail:', this.userLat, this.userLng);
      console.log('Location accuracy:', coords.coords.accuracy, 'meters');
      
      // Check if location is accurate enough
      if (coords.coords.accuracy > 100) {
        console.warn('Location accuracy is poor:', coords.coords.accuracy, 'meters');
      } else {
        console.log('Location accuracy is good:', coords.coords.accuracy, 'meters');
      }
      
    } catch (err) {
      console.warn('Could not get location, using default Cebu City:', err);
      // Keep default coordinates for Cebu City
    }
  }

  private initializeMap() {
    if (this.mapInitialized || !this.mission) return;

    try {
      console.log('Initializing mission detail map...');
      (mapboxgl as any).accessToken = environment.mapbox.accessToken;
      console.log('Mapbox token set:', environment.mapbox.accessToken ? 'Present' : 'Missing');
      
      // Determine map center - use mission location if available, otherwise user location
      let centerLng = this.userLng;
      let centerLat = this.userLat;
      let zoom = 12;

      if (this.mission?.lng && this.mission?.lat) {
        centerLng = this.mission.lng;
        centerLat = this.mission.lat;
        zoom = 14; // Closer zoom for mission location
      }

      this.map = new mapboxgl.Map({
        container: 'mission-map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [centerLng, centerLat],
        zoom: zoom,
        attributionControl: false
      });

      // Add event listeners for debugging
      this.map.on('load', () => {
        console.log('Mission detail map loaded successfully');
      });

      this.map.on('error', (e) => {
        console.error('Mission detail map error:', e);
      });

      this.mapInitialized = true;

      // Add user marker (red pin) if we have user location
      this.addUserMarker();

      // Add mission marker (green pin) if mission has coordinates
      if (this.mission?.lng && this.mission?.lat) {
        this.addMissionMarker(this.mission.lng, this.mission.lat);
      } else if (this.mission?.location) {
        this.geocodeIfNeeded();
      }
    } catch (error) {
      console.error('Error initializing mission detail map:', error);
    }
  }

  private addUserMarker() {
    if (!this.map) return;

    // Add user marker (red pin)
    new mapboxgl.Marker({ color: '#e53935' })
      .setLngLat([this.userLng, this.userLat])
      .setPopup(new mapboxgl.Popup().setText("You are here"))
      .addTo(this.map);
  }

  private addMissionMarker(lng: number, lat: number) {
    if (!this.map) return;

    // Add mission marker (green pin)
    new mapboxgl.Marker({ color: '#218838' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText(this.mission?.missionName || 'Mission Location'))
      .addTo(this.map);
  }

  checkApplicationStatus() {
    if (!this.user || !this.mission) return;

    this.firestore.getUserApplicationStatus(this.mission.id, this.user.uid).pipe(
      map(status => (status as ApplicationStatus) || 'not_applied'),
      catchError(error => {
        console.error('Error checking application status:', error);
        return of('not_applied' as ApplicationStatus);
      })
    ).subscribe({
      next: (status) => {
        this.applicationStatus = status;
      },
      error: (error) => {
        console.error('Error checking application status:', error);
        this.applicationStatus = 'not_applied';
      }
    });
  }

  joinMission() {
    if (!this.user) {
      this.showAlert('Login Required', 'Please login to join this mission.', ['OK']);
      this.router.navigate(['/login']);
      return;
    }

    if (!this.mission) return;

    // Check if organization requires manual approval
    const requiresApproval = this.mission.requiresApproval !== false; // Default to true if not specified
    
    if (requiresApproval) {
      // Manual approval required
      this.firestore.applyToMission(this.mission.id, this.user.uid, this.user.displayName || this.user.email || 'Volunteer').subscribe({
        next: () => {
          this.applicationStatus = 'pending';
          this.showAlert('Application Submitted', 'Your application is now pending. The organization will review your application and notify you of their decision.', ['OK']);
        },
        error: (error) => {
          console.error('Error applying to mission:', error);
          this.showAlert('Error', 'Failed to apply to mission. Please try again.', ['OK']);
        }
      });
    } else {
      // Auto-approval
      this.firestore.joinMission(this.mission.id, this.user.uid, this.user.displayName || this.user.email || 'Volunteer').subscribe({
        next: () => {
          this.applicationStatus = 'approved';
          this.showAlert('Welcome to the Mission!', 'You\'re now a volunteer! Stay tuned on your designated mission channel for updates and coordination.', ['OK']);
        },
        error: (error) => {
          console.error('Error joining mission:', error);
          this.showAlert('Error', 'Failed to join mission. Please try again.', ['OK']);
        }
      });
    }
  }

  private async showAlert(header: string, message: string, buttons: string[]) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons
    });
    await alert.present();
  }

  getStatusText(): string {
    switch (this.applicationStatus) {
      case 'pending':
        return 'Application Pending';
      case 'approved':
        return 'Approved - You\'re a Volunteer!';
      case 'rejected':
        return 'Application Rejected';
      default:
        return 'Not Applied';
    }
  }

  getStatusColor(): string {
    switch (this.applicationStatus) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'primary';
    }
  }

  canJoin(): boolean {
    return this.applicationStatus === 'not_applied' && 
           this.mission?.status?.toLowerCase() === 'open';
  }

  private async geocodeIfNeeded() {
    if (!this.map || !this.mission || (!this.mission.lng || !this.mission.lat) && !this.mission.location) return;
    
    if (this.mission.lng && this.mission.lat) {
      this.addMissionMarker(this.mission.lng, this.mission.lat);
      this.map?.setCenter([this.mission.lng, this.mission.lat]);
      return;
    }

    if (this.mission.location) {
      try {
        const token = environment.mapbox.accessToken;
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(this.mission.location)}.json?access_token=${token}`);
        const data = await resp.json();
        const center = data?.features?.[0]?.center;
        if (Array.isArray(center) && center.length >= 2) {
          this.addMissionMarker(center[0], center[1]);
          this.map?.setCenter([center[0], center[1]]);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }
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

  // New methods for redesigned UI
  getMissionStatusClass(mission: any): string {
    const status = mission.status?.toLowerCase();
    if (status !== 'open') return 'status-closed';
    return 'status-open';
  }

  getMissionStatusIcon(mission: any): string {
    const status = mission.status?.toLowerCase();
    if (status !== 'open') return 'lock-closed-outline';
    return 'radio-button-on-outline';
  }

  getMissionStatusText(mission: any): string {
    const status = mission.status?.toLowerCase();
    if (status !== 'open') return 'Closed';
    return 'Open';
  }

  getApplicationStatusClass(): string {
    switch (this.applicationStatus) {
      case 'pending':
        return 'status-pending';
      case 'approved':
        return 'status-approved';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-not-applied';
    }
  }

  getApplicationStatusIcon(): string {
    switch (this.applicationStatus) {
      case 'pending':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle-outline';
      case 'rejected':
        return 'close-circle-outline';
      default:
        return 'person-outline';
    }
  }

  getStatusDescription(): string {
    switch (this.applicationStatus) {
      case 'pending':
        return 'Your application is being reviewed by the organization.';
      case 'approved':
        return 'Congratulations! You\'re officially part of this mission.';
      case 'rejected':
        return 'Unfortunately, your application was not accepted this time.';
      default:
        return 'You haven\'t applied to this mission yet.';
    }
  }

  getActionButtonColor(): string {
    if (!this.canJoin()) {
      if (this.applicationStatus === 'pending') return 'warning';
      if (this.applicationStatus === 'approved') return 'success';
      if (this.applicationStatus === 'rejected') return 'danger';
      return 'medium';
    }
    return 'success';
  }

  getActionButtonIcon(): string {
    if (!this.canJoin()) {
      if (this.applicationStatus === 'pending') return 'time-outline';
      if (this.applicationStatus === 'approved') return 'checkmark-outline';
      if (this.applicationStatus === 'rejected') return 'close-outline';
      return 'lock-closed-outline';
    }
    return 'add-outline';
  }

  getActionButtonText(): string {
    if (!this.canJoin()) {
      if (this.applicationStatus === 'pending') return 'Application Pending';
      if (this.applicationStatus === 'approved') return 'You\'re a Volunteer!';
      if (this.applicationStatus === 'rejected') return 'Application Rejected';
      return 'Mission Closed';
    }
    return 'Join Mission';
  }

  getServiceIcon(service: string): string {
    const iconMap: { [key: string]: string } = {
      'Medical': 'medical-outline',
      'Dental': 'medical-outline',
      'Surgical': 'medical-outline',
      'Blood Donation': 'heart-outline',
      'Education': 'school-outline',
      'Community': 'people-outline',
      'Environmental': 'leaf-outline',
      'Emergency': 'warning-outline'
    };
    return iconMap[service] || 'help-outline';
  }

  shareMission() {
    if (navigator.share && this.mission) {
      navigator.share({
        title: this.mission.missionName,
        text: this.mission.tagline || 'Join this meaningful mission!',
        url: window.location.href
      }).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        this.showAlert('Link Copied', 'Mission link has been copied to your clipboard.', ['OK']);
      }).catch(() => {
        this.showAlert('Share Mission', 'Share this mission with others!', ['OK']);
      });
    }
  }
}