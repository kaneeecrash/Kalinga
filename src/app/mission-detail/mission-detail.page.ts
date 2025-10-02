import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-mission-detail',
  templateUrl: './mission-detail.page.html',
  styleUrls: ['./mission-detail.page.scss'],
  standalone: false
})
export class MissionDetailPage implements OnInit, AfterViewInit {
  mission: any;
  map?: mapboxgl.Map;

  constructor(private route: ActivatedRoute, private firestore: FirestoreService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.firestore.getMissionById(id).subscribe((m) => {
        this.mission = m;
        if (this.map && m?.lng && m?.lat) {
          this.renderMarker(m.lng, m.lat);
        }
        if (this.map) {
          this.geocodeIfNeeded();
        }
      });
    }
  }

  ngAfterViewInit() {
    (mapboxgl as any).accessToken = environment.mapbox.accessToken;
    this.map = new mapboxgl.Map({
      container: 'mission-map',
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [123.885437, 10.317347],
      zoom: 12,
    });
    if (this.mission?.lng && this.mission?.lat) {
      this.renderMarker(this.mission.lng, this.mission.lat);
      this.map?.setCenter([this.mission.lng, this.mission.lat]);
    }
  }

  private renderMarker(lng: number, lat: number) {
    new mapboxgl.Marker({ color: '#e91e63' })
      .setLngLat([lng, lat])
      .addTo(this.map as mapboxgl.Map);
  }

  private async geocodeIfNeeded() {
    if (this.mission && (!this.mission.lng || !this.mission.lat) && this.mission.location) {
      try {
        const token = environment.mapbox.accessToken;
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(this.mission.location)}.json?access_token=${token}`);
        const data = await resp.json();
        const center = data?.features?.[0]?.center;
        if (Array.isArray(center) && center.length >= 2) {
          this.renderMarker(center[0], center[1]);
          this.map?.setCenter([center[0], center[1]]);
        }
      } catch {}
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