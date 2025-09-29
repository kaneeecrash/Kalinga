import { Component } from '@angular/core';

@Component({
  selector: 'app-emergency',
  templateUrl: './emergency.page.html',
  styleUrls: ['./emergency.page.scss'],
  standalone: false
})
export class EmergencyPage {
  contacts = [
    { name: 'Cebu City Disaster Risk Reduction (CDRRMO)', phone: '0932 537 7777' },
    { name: 'Cebu City Fire District', phone: '032 256 0541' },
    { name: 'Cebu City Police Office', phone: '032 231 0500' },
    { name: 'Vicente Sotto Memorial Medical Center ER', phone: '032 253 9891' },
    { name: 'Cebu Doctors University Hospital ER', phone: '032 255 5555' },
  ];

  call(num: string) {
    window.location.href = `tel:${num.replace(/\s+/g,'')}`;
  }
}


