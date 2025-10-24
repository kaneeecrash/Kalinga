import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PushNotificationService } from '../services/push-notification.service';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Clipboard } from '@capacitor/clipboard';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-push-test',
  templateUrl: './push-test.page.html',
  styleUrls: ['./push-test.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class PushTestPage implements OnInit, OnDestroy {
  currentToken: string | null = null;
  platform: string = '';
  permissionStatus: string = 'unknown';
  deliveredNotifications: any[] = [];
  private tokenSubscription?: Subscription;

  constructor(
    private pushNotificationService: PushNotificationService,
    private toastController: ToastController
  ) {
    this.platform = Capacitor.getPlatform();
  }

  ngOnInit() {
    // Subscribe to token updates
    this.tokenSubscription = this.pushNotificationService.token$.subscribe(token => {
      this.currentToken = token;
    });

    // Check initial permission status
    this.checkPermissionStatus();
    
    // Load delivered notifications
    this.loadDeliveredNotifications();
  }

  ngOnDestroy() {
    if (this.tokenSubscription) {
      this.tokenSubscription.unsubscribe();
    }
  }

  async checkPermissionStatus() {
    try {
      const permStatus = await PushNotifications.checkPermissions();
      this.permissionStatus = permStatus.receive;
    } catch (error) {
      console.error('Error checking permissions:', error);
      this.permissionStatus = 'error';
    }
  }

  async requestPermissions() {
    try {
      const permStatus = await PushNotifications.requestPermissions();
      this.permissionStatus = permStatus.receive;
      
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
        this.showToast('Push notification permission granted!');
      } else {
        this.showToast('Push notification permission denied');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      this.showToast('Error requesting permissions');
    }
  }

  async sendTestLocalNotification() {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Test Notification',
            body: 'This is a test notification from Kalinga!',
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) },
            extra: {
              missionId: 'test-mission-123',
              route: '/missions'
            }
          }
        ]
      });
      this.showToast('Test notification scheduled!');
    } catch (error) {
      console.error('Error showing test notification:', error);
      this.showToast('Error showing test notification');
    }
  }

  async copyTokenToClipboard() {
    if (this.currentToken) {
      try {
        await Clipboard.write({
          string: this.currentToken
        });
        this.showToast('Token copied to clipboard!');
      } catch (error) {
        console.error('Error copying token:', error);
        this.showToast('Error copying token');
      }
    } else {
      this.showToast('No token available to copy');
    }
  }

  async loadDeliveredNotifications() {
    try {
      const notifications = await PushNotifications.getDeliveredNotifications();
      this.deliveredNotifications = notifications.notifications || [];
    } catch (error) {
      console.error('Error loading delivered notifications:', error);
    }
  }

  async clearDeliveredNotifications() {
    try {
      await PushNotifications.removeAllDeliveredNotifications();
      this.deliveredNotifications = [];
      this.showToast('All delivered notifications cleared!');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      this.showToast('Error clearing notifications');
    }
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  getStatusColor(): string {
    switch (this.permissionStatus) {
      case 'granted': return 'success';
      case 'denied': return 'danger';
      case 'prompt': return 'warning';
      default: return 'medium';
    }
  }

  getStatusText(): string {
    switch (this.permissionStatus) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      case 'prompt': return 'Prompt';
      default: return 'Unknown';
    }
  }
}