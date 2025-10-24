import { Component, OnInit, OnDestroy } from '@angular/core';
import { PushNotificationService } from '../services/push-notification.service';
import { FirestoreService } from '../services/firestore.service';
import { Subscription } from 'rxjs';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  data?: any;
  type?: 'mission' | 'donation' | 'general';
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false
})
export class NotificationsPage implements OnInit, OnDestroy {
    
  selectedTab: 'chats' | 'notifications' = 'notifications';
  notifications: NotificationItem[] = [];
  private notificationSubscription?: Subscription;
  
  // Modal properties
  isModalOpen = false;
  selectedNotification: NotificationItem | null = null;

  constructor(
    private pushNotificationService: PushNotificationService,
    private firestoreService: FirestoreService
  ) {}

  ngOnInit() {
    this.loadNotifications();
    this.setupNotificationListener();
  }

  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  selectTab(tab: 'chats' | 'notifications') {
    this.selectedTab = tab;
  }

  private loadNotifications() {
    // Load from local storage first, then add mock data if empty
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      this.notifications = JSON.parse(savedNotifications).map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      }));
    } else {
      // Load mock data for demonstration
      this.notifications = [
        {
          id: '1',
          title: 'New Mission Available',
          body: 'A new volunteer mission has been posted in your area.',
          timestamp: new Date(),
          read: false,
          type: 'mission',
          data: { missionId: 'mission-123' }
        },
        {
          id: '2',
          title: 'Mission Update',
          body: 'Your application for "Community Cleanup" has been approved.',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          read: true,
          type: 'mission',
          data: { missionId: 'mission-456' }
        },
        {
          id: '3',
          title: 'Donation Received',
          body: 'Thank you for your donation of $50 to the relief fund.',
          timestamp: new Date(Date.now() - 7200000), // 2 hours ago
          read: false,
          type: 'donation',
          data: { donationId: 'donation-789' }
        }
      ];
      this.saveNotifications();
    }
  }

  private setupNotificationListener() {
    // Listen for new notifications from the service
    this.notificationSubscription = this.pushNotificationService.newNotification$.subscribe(notification => {
      if (notification) {
        this.addNewNotification(notification);
      }
    });
  }

  private addNewNotification(notification: any) {
    const newNotification: NotificationItem = {
      id: Date.now().toString(),
      title: notification.title,
      body: notification.body,
      timestamp: new Date(),
      read: false,
      data: notification.data,
      type: notification.type || 'general'
    };

    this.notifications.unshift(newNotification);
    this.saveNotifications();
  }

  // MARK AS READ WHEN TAPPED
  markAsRead(notification: NotificationItem) {
    notification.read = true;
    this.saveNotifications();
  }

  // VIEW NOTIFICATION DETAILS
  viewNotificationDetails(notification: NotificationItem) {
    this.selectedNotification = notification;
    this.setOpen(true);
  }

  // MODAL METHODS
  setOpen(isOpen: boolean) {
    this.isModalOpen = isOpen;
    if (!isOpen) {
      this.selectedNotification = null;
    }
  }

  // DELETE NOTIFICATION
  deleteNotification(notification: NotificationItem) {
    this.notifications = this.notifications.filter(n => n.id !== notification.id);
    this.saveNotifications();
  }

  // CLEAR ALL NOTIFICATIONS
  clearAllNotifications() {
    this.notifications = [];
    this.saveNotifications();
  }

  private saveNotifications() {
    localStorage.setItem('notifications', JSON.stringify(this.notifications));
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'mission': return 'rocket-outline';
      case 'donation': return 'heart-outline';
      default: return 'notifications-outline';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'mission': return 'primary';
      case 'donation': return 'danger';
      default: return 'medium';
    }
  }

}

