import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false
})
export class NotificationsPage  {
    
  selectedTab: 'chats' | 'notifications' = 'notifications';

  selectTab(tab: 'chats' | 'notifications') {
    this.selectedTab = tab;
  }
}

