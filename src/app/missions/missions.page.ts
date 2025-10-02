import { Component, OnInit } from '@angular/core';
import { FirestoreService } from '../services/firestore.service';
import { Auth } from '@angular/fire/auth';

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

  constructor(
    private firestoreService: FirestoreService,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.firestoreService.getMissions().subscribe((res: any[]) => {
      console.log('Fetched missions:', res); // 🔎 Debug

      // Sort by date first, then by duration if dates are the same
      this.missions = res.sort((a, b) => {
        const dateA = new Date(a.date); // Convert to Date objects
        const dateB = new Date(b.date);

        // Compare dates
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;

        // If dates are the same, compare by time duration
        const durationA = this.getDuration(a.startTime, a.endTime);
        const durationB = this.getDuration(b.startTime, b.endTime);

        return durationB - durationA; // Sort longest duration first
      });
      this.applyFilters();
    });
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

  async joinMission(missionId: string) {
    const user = this.auth.currentUser;
    if (user) {
      await this.firestoreService.joinMission(
        missionId,
        user.uid,
        user.displayName || user.email || 'Volunteer'
      );
      alert('You joined this mission!');
    } else {
      alert('Please login first');
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
}
