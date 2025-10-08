import { Component, OnInit, AfterViewInit, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { Auth, authState, User } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';

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
    // Get user location first, then initialize map
    this.getUserLocation().then(() => {
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    });
  }

  private async getUserLocation() {
    try {
      const coords = await Geolocation.getCurrentPosition();
      this.userLat = coords.coords.latitude;
      this.userLng = coords.coords.longitude;
      console.log('User location for mission detail:', this.userLat, this.userLng);
    } catch (err) {
      console.warn('Could not get location, using default Cebu City:', err);
      // Keep default coordinates for Cebu City
    }
  }

  private initializeMap() {
    if (this.mapInitialized || !this.mission) return;

    try {
      (mapboxgl as any).accessToken = environment.mapbox.accessToken;
      
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
      console.error('Error initializing map:', error);
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

  async checkApplicationStatus() {
    if (!this.user || !this.mission) return;

    try {
      const status = await this.firestore.getUserApplicationStatus(this.mission.id, this.user.uid);
      this.applicationStatus = (status as ApplicationStatus) || 'not_applied';
    } catch (error) {
      console.error('Error checking application status:', error);
      this.applicationStatus = 'not_applied';
    }
  }

  async joinMission() {
    if (!this.user) {
      const alert = await this.alertController.create({
        header: 'Login Required',
        message: 'Please login to join this mission.',
        buttons: ['OK']
      });
      await alert.present();
      this.router.navigate(['/login']);
      return;
    }

    if (!this.mission) return;

    try {
      // Check if organization requires manual approval
      const requiresApproval = this.mission.requiresApproval !== false; // Default to true if not specified
      
      if (requiresApproval) {
        // Manual approval required
        await this.firestore.applyToMission(this.mission.id, this.user.uid, this.user.displayName || this.user.email || 'Volunteer');
        this.applicationStatus = 'pending';
        
        const alert = await this.alertController.create({
          header: 'Application Submitted',
          message: 'Your application is now pending. The organization will review your application and notify you of their decision.',
          buttons: ['OK']
        });
        await alert.present();
      } else {
        // Auto-approval
        await this.firestore.joinMission(this.mission.id, this.user.uid, this.user.displayName || this.user.email || 'Volunteer');
        this.applicationStatus = 'approved';
        
        const alert = await this.alertController.create({
          header: 'Welcome to the Mission!',
          message: 'You\'re now a volunteer! Stay tuned on your designated mission channel for updates and coordination.',
          buttons: ['OK']
        });
        await alert.present();
      }
    } catch (error) {
      console.error('Error joining mission:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to join mission. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
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
}