import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { Auth, authState, User } from '@angular/fire/auth';
import { switchMap, of, from, map, Observable, forkJoin } from 'rxjs';

@Component({
  selector: 'app-missions',
  templateUrl: './missions.page.html',
  styleUrls: ['./missions.page.scss'],
  standalone: false,
})
export class MissionsPage implements OnInit {
  missions: any[] = [];
  filtered: any[] = [];
  searchText = '';
  filterLocation = '';
  filterDate: string | string[] | null | undefined = null;
  // Services filtering (multi-select)
  servicesOptions: string[] = ['Medical', 'Dental', 'Surgical', 'Blood Donation'];
  selectedServices: string[] = [];
  // Sort: newest to oldest (desc) or oldest to newest (asc)
  sortOrder: 'desc' | 'asc' = 'desc';
  // Overlay state
  filtersOpen = false;
  // User tracking
  user: { userName?: string; displayName?: string; photoURL?: string; uid?: string } | null = null;
  userMissionStatus: Map<string, string> = new Map(); // Track user's status for each mission
  organizations: Map<string, any> = new Map(); // Store organization data by orgId

  constructor(
    private firestoreService: FirestoreService,
    private auth: Auth,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUserData();
    
    // First update mission statuses for missions that have passed
    this.firestoreService.updateMissionStatuses().subscribe(() => {
      // Then fetch and display missions
      this.firestoreService.getMissions().subscribe((res: any[]) => {
        console.log('Fetched missions:', res); // 🔎 Debug
        console.log('Sample mission data structure:', res[0]); // 🔎 Debug organization fields

        // Filter out past missions (missions that have already passed)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        const upcomingMissions = res.filter(mission => {
          const missionDate = new Date(mission.date);
          missionDate.setHours(23, 59, 59, 999); // End of mission date
          return missionDate >= today; // Only include missions from today onwards
        });

        // Sort by mission date first (earliest first), then by creation date if same mission date
        this.missions = upcomingMissions.sort((a, b) => {
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
        
        // Load user's status for each mission
        this.loadUserMissionStatuses();
        this.loadOrganizations(); // Load organization data
        this.applyFilters();
      });
    });
  }

  // Load organization data for all missions
  private loadOrganizations() {
    const uniqueOrgIds = [...new Set(this.missions.map(m => m.orgId).filter(id => id))];
    
    uniqueOrgIds.forEach(orgId => {
      this.firestoreService.getOrganizationByIdForceRefresh(orgId).subscribe((org) => {
        if (org) {
          this.organizations.set(orgId, org);
          console.log('Loaded organization:', orgId, org); // 🔎 Debug
          console.log('Organization profilePictureURL:', org?.profilePictureURL); // 🔎 Debug correct field
        }
      });
    });
  }

  // Get organization data by ID
  getOrganization(orgId: string): any {
    return this.organizations.get(orgId);
  }

  // Helper function to calculate the duration between start and end time in minutes
  getDuration(startTime: string, endTime: string): number {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    return (end.getTime() - start.getTime()) / (1000 * 60); // Duration in minutes
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

  joinMission(missionId: string): Observable<void> {
    const user = this.auth.currentUser;
    if (user) {
      return this.firestoreService.applyToMission(
        missionId,
        user.uid,
        user.displayName || user.email || 'Volunteer'
      );
    } else {
      return of(null).pipe(
        switchMap(() => {
          throw new Error('User not authenticated');
        })
      );
    }
  }

  trackById(_idx: number, item: any) {
    return item.id;
  }

  onSearchChange(text: string | null | undefined) {
    this.searchText = text || '';
    this.applyFilters();
  }

  applyFilters() {
    const text = this.searchText.toLowerCase();
    const loc = this.filterLocation.toLowerCase();
    const selected = this.selectedServices.map(s => s.toLowerCase());
    const dateFilter = this.filterDate ? new Date(this.filterDate as string) : null;

    this.filtered = this.missions.filter(m => {
      const matchText = !text || `${m.missioName} ${m.orgName} ${m.location}`.toLowerCase().includes(text);
      const matchLoc = !loc || (m.location || '').toLowerCase().includes(loc);
      // services may be under m.services or m.specializations
      const missionServices: string[] = Array.isArray(m.services)
        ? m.services
        : (Array.isArray(m.specializations) ? m.specializations : (m.specialization ? [m.specialization] : []));
      const missionServicesLower = missionServices.map((s: any) => String(s).toLowerCase());
      const matchServices = selected.length === 0 || selected.some(s => missionServicesLower.includes(s));
      const matchDate = !dateFilter || (m.date && (new Date(m.date)).toDateString() === dateFilter.toDateString());
      return matchText && matchLoc && matchServices && matchDate;
    });

    // Sort by date based on sortOrder
    this.filtered = this.filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortOrder === 'desc' ? (dateB - dateA) : (dateA - dateB);
    });
  }

  openFilters() { this.filtersOpen = true; }
  closeFilters() { this.filtersOpen = false; }
  clearFilters() {
    this.filterLocation = '';
    this.selectedServices = [];
    this.sortOrder = 'desc';
    this.applyFilters();
  }

  onToggleService(service: string, checked: boolean) {
    if (checked) {
      if (!this.selectedServices.includes(service)) this.selectedServices = [...this.selectedServices, service];
    } else {
      this.selectedServices = this.selectedServices.filter(s => s !== service);
    }
  }

  onDateChange(ev: any) {
    const value = ev.detail.value;
    // If multiple values come in (string[]), take the first one
    this.filterDate = Array.isArray(value) ? value[0] : value;
    this.applyFilters();
  }

  // Load user data
  private loadUserData() {
    authState(this.auth).pipe(
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
                console.log('Mission page user data loaded:', this.user);
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
          alert('You have applied to this mission! Your application is pending approval.');
          // Refresh status after joining
          this.loadUserMissionStatuses();
        },
        error: (error) => {
          console.error('Error applying to mission:', error);
          alert('Failed to apply to mission. Please try again.');
        }
      });
    }
    // If user has a status, clicking the button doesn't do anything
  }

  // Load user's mission statuses
  private loadUserMissionStatuses() {
    if (!this.user || !this.user.uid) return;
    
    // Use forkJoin to combine all observables
    const missionStatusObservables = this.missions
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

  // New methods for redesigned UI
  getTotalVolunteers(): number {
    return this.missions.reduce((total, mission) => total + (mission.volunteers || 0), 0);
  }

  toggleServiceFilter(service: string) {
    if (this.selectedServices.includes(service)) {
      this.selectedServices = this.selectedServices.filter(s => s !== service);
    } else {
      this.selectedServices = [...this.selectedServices, service];
    }
    this.applyFilters();
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

  getStatusClass(mission: any): string {
    const status = mission.status?.toLowerCase();
    const userStatus = this.userMissionStatus.get(mission.id);
    
    if (status !== 'open') return 'status-closed';
    if (userStatus === 'approved' || userStatus === 'accepted') return 'status-approved';
    if (userStatus === 'pending') return 'status-pending';
    if (userStatus === 'rejected') return 'status-rejected';
    return 'status-open';
  }

  getStatusIcon(mission: any): string {
    const status = mission.status?.toLowerCase();
    const userStatus = this.userMissionStatus.get(mission.id);
    
    if (status !== 'open') return 'lock-closed-outline';
    if (userStatus === 'approved' || userStatus === 'accepted') return 'checkmark-circle-outline';
    if (userStatus === 'pending') return 'time-outline';
    if (userStatus === 'rejected') return 'close-circle-outline';
    return 'radio-button-on-outline';
  }

  getStatusText(mission: any): string {
    const status = mission.status?.toLowerCase();
    const userStatus = this.userMissionStatus.get(mission.id);
    
    if (status !== 'open') return 'Closed';
    if (userStatus === 'approved' || userStatus === 'accepted') return 'Joined';
    if (userStatus === 'pending') return 'Pending';
    if (userStatus === 'rejected') return 'Rejected';
    return 'Open';
  }

  getActionIcon(mission: any): string {
    const status = this.userMissionStatus.get(mission.id);
    const missionStatus = mission.status?.toLowerCase();
    
    if (missionStatus !== 'open') return 'lock-closed-outline';
    if (status === 'approved' || status === 'accepted') return 'checkmark-outline';
    if (status === 'pending') return 'time-outline';
    if (status === 'rejected') return 'close-outline';
    return 'add-outline';
  }
}
