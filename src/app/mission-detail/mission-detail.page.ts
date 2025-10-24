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
  mapRetryCount = 0;
  maxMapRetries = 3;
  userLat = 10.317347; // Default Cebu City
  userLng = 123.885437;
  organization: any = null; // Store organization data
  
  // Navigation properties
  routeInfo: { duration: string; distance: string } | null = null;
  showDirections = false;
  directionsLoading = false;
  directionsError = false;
  
  // Map error handling properties
  mapError = false;
  mapLoading = true;
  
  // Image error handling
  imageError = false;

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
        console.log('Mission detail data:', m);
        this.isLoading = false;
        
        // Fetch organization data if orgId exists
        if (m?.orgId) {
          this.firestore.getOrganizationById(m.orgId).subscribe((org) => {
            this.organization = org;
            console.log('Organization data:', org);
          });
        }
        
        // Check application status if user is logged in
        if (this.user) {
          this.checkApplicationStatus();
        }
      });
    }
  }

  ngAfterViewInit() {
    // Wait for mission data to load, then initialize map
    if (this.mission) {
      this.initializeMapWithRetry();
    } else {
      // If mission not loaded yet, wait a bit and try again
      setTimeout(() => {
        if (this.mission) {
          this.initializeMapWithRetry();
        }
      }, 500);
    }
  }

  private async requestLocationPermissions() {
    try {
      const permissions = await Geolocation.checkPermissions();
      console.log('Current location permissions:', permissions);
      
      if (permissions.location !== 'granted') {
        console.log('Requesting location permissions...');
        const requestResult = await Geolocation.requestPermissions();
        console.log('Location permission request result:', requestResult);
        
        if (requestResult.location !== 'granted') {
          console.warn('Location permission denied, using default coordinates');
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  private async initializeMapWithRetry() {
    try {
      // Request location permissions first
      await this.requestLocationPermissions();
      
      // Get user location
      await this.getUserLocation();
      
      // Initialize map immediately since DOM element is always available
      this.initializeMap();
    } catch (error) {
      console.error('Error initializing map:', error);
      this.showMapError();
    }
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
      
      // Ensure DOM element exists
      const mapElement = document.getElementById('mission-map');
      if (!mapElement) {
        if (this.mapRetryCount < this.maxMapRetries) {
          this.mapRetryCount++;
          console.warn(`Mission map element not found, retrying in 100ms... (attempt ${this.mapRetryCount}/${this.maxMapRetries})`);
          setTimeout(() => this.initializeMap(), 100);
        } else {
          console.error('Failed to find mission map element after maximum retries');
        }
        return;
      }
      
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
      this.map.on('load', async () => {
        console.log('Mission detail map loaded successfully');
        this.mapLoading = false;
        this.mapError = false;
        
        // Try to add directions (will geocode if needed)
        if (this.canLoadDirections()) {
          console.log('Mission has coordinates or location, adding directions');
          await this.addDirectionsToMap();
        } else {
          console.log('Mission coordinates not available, skipping directions');
        }
      });

      this.map.on('error', (e) => {
        console.error('Mission detail map error:', e);
        this.showMapError();
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
      this.showMapError();
    }
  }

  private showMapError() {
    this.mapError = true;
    this.mapLoading = false;
    console.error('Map failed to load');
  }

  retryMapLoad() {
    this.mapError = false;
    this.mapLoading = true;
    this.mapRetryCount = 0;
    this.mapInitialized = false;
    
    // Clear existing map
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
    
    // Retry initialization
    this.initializeMapWithRetry();
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
      this.firestore.applyToMission(this.mission.id, this.user.uid).subscribe({
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
      this.firestore.joinMission(this.mission.id, this.user.uid).subscribe({
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

  /**
   * Handle image loading errors
   */
  onImageError() {
    console.warn('Mission image failed to load, using fallback');
    this.imageError = true;
  }

  /**
   * Get the image source with fallback handling
   */
  getMissionImageSrc(): string {
    if (this.imageError || !this.mission?.missionImage) {
      return 'assets/mission-posters.png';
    }
    return this.mission.missionImage;
  }

  // ===== NAVIGATION METHODS =====

  /**
   * Add directions from user location to mission location
   */
  private async addDirectionsToMap() {
    // Check if map is ready
    if (!this.map) {
      console.warn('Cannot add directions: map not initialized');
      return;
    }

    // Check if user location is available
    if (!this.userLng || !this.userLat) {
      console.warn('Cannot add directions: user location not available');
      this.directionsError = true;
      return;
    }

    // Get mission coordinates (either direct or via geocoding)
    const missionCoords = await this.ensureMissionCoordinates();
    if (!missionCoords) {
      console.warn('Cannot add directions: mission coordinates not available');
      this.directionsError = true;
      return;
    }

    console.log('Adding directions from user to mission:', {
      userLocation: [this.userLng, this.userLat],
      missionLocation: [missionCoords.lng, missionCoords.lat],
      missionName: this.mission.missionName
    });

    this.directionsLoading = true;
    this.directionsError = false;

    // Create directions request
    const directionsRequest = {
      profile: 'driving', // Options: 'driving', 'walking', 'cycling'
      waypoints: [
        { coordinates: [this.userLng, this.userLat] }, // User location
        { coordinates: [missionCoords.lng, missionCoords.lat] } // Mission location
      ],
      geometries: 'geojson'
    };

    // Make request to Mapbox Directions API
    const url = `https://api.mapbox.com/directions/v5/mapbox/${directionsRequest.profile}/${directionsRequest.waypoints[0].coordinates[0]},${directionsRequest.waypoints[0].coordinates[1]};${directionsRequest.waypoints[1].coordinates[0]},${directionsRequest.waypoints[1].coordinates[1]}?geometries=geojson&access_token=${environment.mapbox.accessToken}`;

    console.log('Fetching directions from:', directionsRequest.waypoints[0].coordinates, 'to:', directionsRequest.waypoints[1].coordinates);

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        this.directionsLoading = false;
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          this.addRouteToMap(route);
          this.fitMapToRoute(route);
          this.setRouteInfo(route);
          console.log('Directions loaded successfully');
        } else {
          this.directionsError = true;
          console.warn('No routes found in directions response');
        }
      })
      .catch(error => {
        this.directionsLoading = false;
        this.directionsError = true;
        console.error('Error fetching directions:', error);
      });
  }

  /**
   * Add route line to the map
   */
  private addRouteToMap(route: any) {
    if (!this.map) return;

    // Remove existing route if any
    this.removeRouteFromMap();

    // Add route source
    this.map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    // Add route layer
    this.map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6', // Blue color
        'line-width': 4,
        'line-opacity': 0.8
      }
    });
  }

  /**
   * Fit map to show the entire route
   */
  private fitMapToRoute(route: any) {
    if (!this.map) return;

    try {
      // Calculate bounds of the route
      const coordinates = route.geometry.coordinates;
      const bounds = coordinates.reduce((bounds: any, coord: any) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      // Fit map to route bounds with padding
      this.map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 }
      });
    } catch (error) {
      console.error('Error fitting map to route:', error);
    }
  }

  /**
   * Set route information (duration and distance)
   */
  private setRouteInfo(route: any) {
    try {
      const duration = Math.round(route.duration / 60); // Convert to minutes
      const distance = (route.distance / 1000).toFixed(1); // Convert to km
      
      this.routeInfo = {
        duration: duration < 60 ? `${duration} min` : `${Math.round(duration / 60)}h ${duration % 60}m`,
        distance: `${distance} km`
      };
    } catch (error) {
      console.error('Error setting route info:', error);
      this.routeInfo = null;
    }
  }

  /**
   * Ensure mission has coordinates (either direct or via geocoding)
   */
  private async ensureMissionCoordinates(): Promise<{ lng: number; lat: number } | null> {
    // If mission has exact coordinates, use them
    if (typeof this.mission?.lng === 'number' && typeof this.mission?.lat === 'number') {
      return { lng: this.mission.lng, lat: this.mission.lat };
    }

    // If mission has location string, geocode it
    if (this.mission?.location) {
      try {
        console.log('Geocoding mission location:', this.mission.location);
        const token = environment.mapbox.accessToken;
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(this.mission.location)}.json?access_token=${token}&country=PH`);
        const data = await resp.json();
        const center = data?.features?.[0]?.center;
        if (Array.isArray(center) && center.length >= 2) {
          console.log('Geocoding successful:', { lng: center[0], lat: center[1] });
          return { lng: center[0], lat: center[1] };
        }
      } catch (error) {
        console.error('Geocoding error for mission:', this.mission.missionName, error);
      }
    }

    return null;
  }

  /**
   * Check if directions can be loaded
   */
  canLoadDirections(): boolean {
    return !!(this.map && this.userLng && this.userLat && (this.mission?.lng || this.mission?.location));
  }

  /**
   * Toggle directions display
   */
  async toggleDirections() {
    if (!this.canLoadDirections()) {
      console.warn('Cannot toggle directions: prerequisites not met');
      return;
    }
    
    this.showDirections = !this.showDirections;
    if (this.showDirections) {
      await this.addDirectionsToMap();
    } else {
      this.removeRouteFromMap();
      this.routeInfo = null;
    }
  }

  /**
   * Remove route from map
   */
  private removeRouteFromMap() {
    if (!this.map) return;
    
    try {
      if (this.map.getLayer('route')) {
        this.map.removeLayer('route');
      }
      if (this.map.getSource('route')) {
        this.map.removeSource('route');
      }
    } catch (error) {
      console.error('Error removing route from map:', error);
    }
  }

  /**
   * Open mission location in Google Maps
   */
  async openInGoogleMaps() {
    if (!this.mission?.lng || !this.mission?.lat) {
      await this.showAlert('Error', 'Mission location coordinates are not available.', ['OK']);
      return;
    }
    
    try {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${this.mission.lat},${this.mission.lng}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening Google Maps:', error);
      await this.showAlert('Error', 'Unable to open Google Maps. Please try again.', ['OK']);
    }
  }

  /**
   * Open mission location in Apple Maps
   */
  async openInAppleMaps() {
    if (!this.mission?.lng || !this.mission?.lat) {
      await this.showAlert('Error', 'Mission location coordinates are not available.', ['OK']);
      return;
    }
    
    try {
      const url = `http://maps.apple.com/?daddr=${this.mission.lat},${this.mission.lng}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening Apple Maps:', error);
      await this.showAlert('Error', 'Unable to open Apple Maps. Please try again.', ['OK']);
    }
  }

  /**
   * Open mission location in Waze
   */
  async openInWaze() {
    if (!this.mission?.lng || !this.mission?.lat) {
      await this.showAlert('Error', 'Mission location coordinates are not available.', ['OK']);
      return;
    }
    
    try {
      const url = `https://waze.com/ul?ll=${this.mission.lat},${this.mission.lng}&navigate=yes`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening Waze:', error);
      await this.showAlert('Error', 'Unable to open Waze. Please try again.', ['OK']);
    }
  }

  /**
   * Open in device's default maps app
   */
  async openInDeviceMaps() {
    if (!this.mission?.lng || !this.mission?.lat) {
      await this.showAlert('Error', 'Mission location coordinates are not available.', ['OK']);
      return;
    }
    
    try {
      // Check if device is iOS or Android
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      if (isIOS) {
        // Open in Apple Maps
        const url = `http://maps.apple.com/?daddr=${this.mission.lat},${this.mission.lng}`;
        window.open(url, '_blank');
      } else if (isAndroid) {
        // Open in Google Maps
        const url = `https://www.google.com/maps/dir/?api=1&destination=${this.mission.lat},${this.mission.lng}`;
        window.open(url, '_blank');
      } else {
        // Fallback to Google Maps web
        const url = `https://www.google.com/maps/dir/?api=1&destination=${this.mission.lat},${this.mission.lng}`;
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Error opening device maps:', error);
      await this.showAlert('Error', 'Unable to open maps app. Please try again.', ['OK']);
    }
  }

  /**
   * Retry loading directions
   */
  async retryDirections() {
    if (!this.canLoadDirections()) {
      console.warn('Cannot retry directions: prerequisites not met');
      return;
    }
    
    this.directionsError = false;
    await this.addDirectionsToMap();
  }

  /**
   * Get directions button text based on current state
   */
  getDirectionsButtonText(): string {
    if (!this.canLoadDirections()) return 'Directions Unavailable';
    if (this.directionsLoading) return 'Loading...';
    if (this.directionsError) return 'Retry Directions';
    if (this.showDirections) return 'Hide Directions';
    return 'Show Directions';
  }

  /**
   * Get directions button icon based on current state
   */
  getDirectionsButtonIcon(): string {
    if (!this.canLoadDirections()) return 'location-outline';
    if (this.directionsLoading) return 'hourglass-outline';
    if (this.directionsError) return 'refresh-outline';
    if (this.showDirections) return 'eye-off-outline';
    return 'navigate-outline';
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
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(this.mission.location)}.json?access_token=${token}&country=PH`);
        const data = await resp.json();
        const center = data?.features?.[0]?.center;
        if (Array.isArray(center) && center.length >= 2) {
          this.addMissionMarker(center[0], center[1]);
          this.map?.setCenter([center[0], center[1]]);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        // Fallback to user location if geocoding fails
        console.log('Falling back to user location due to geocoding failure');
        this.map?.setCenter([this.userLng, this.userLat]);
        this.map?.setZoom(12);
      }
    }
  }

  // Force refresh organization data
  refreshOrganizationData() {
    if (this.mission?.orgId) {
      console.log('Refreshing organization data...');
      this.firestore.getOrganizationByIdForceRefresh(this.mission.orgId).subscribe((org) => {
        this.organization = org;
        console.log('Refreshed organization data:', org);
        console.log('Organization profilePictureURL:', org?.profilePictureURL); // 🔎 Debug correct field
      });
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

  formatLocation(location: string): string {
    if (!location) return '';
    
    // Remove "Philippines" from the location string
    return location.replace(/,?\s*Philippines\s*$/i, '').trim();
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