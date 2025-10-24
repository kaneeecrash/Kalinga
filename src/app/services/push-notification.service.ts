import { Injectable } from '@angular/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { FirestoreService } from './firestore.service';
import { NotificationData, DeviceTokenData } from '../models/notification-data.interface';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private tokenSubject = new BehaviorSubject<string | null>(null);
  public token$ = this.tokenSubject.asObservable();

  // Subject to emit new notifications
  private newNotificationSubject = new BehaviorSubject<any>(null);
  public newNotification$ = this.newNotificationSubject.asObservable();

  constructor(
    private router: Router,
    private firestoreService: FirestoreService
  ) {}

  async initializePushNotifications(): Promise<void> {
    // Only initialize on mobile platforms
    if (Capacitor.getPlatform() === 'web') {
      console.log('❌ Push notifications not supported on web');
      return;
    }

    console.log('🚀 Initializing push notifications on:', Capacitor.getPlatform());

    // Check permissions first
    let permStatus = await PushNotifications.checkPermissions();
    console.log('📋 Current permission status:', permStatus);

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      console.log('🔐 Requesting permissions...');
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.error('❌ User denied permissions!');
      throw new Error('User denied permissions!');
    }

    console.log('✅ Permissions granted, registering...');
    await PushNotifications.register();

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('🎉 Push registration success!');
      console.log('🔑 FCM Token:', token.value);
      this.tokenSubject.next(token.value);
      // Send this token to your server to store it
      this.sendTokenToServer(token.value);
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (err: any) => {
      console.error('❌ Registration error:', JSON.stringify(err));
      console.error('🔍 Error details:', err.error);
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received: ', notification);
      
      // Add to notification history
      this.addNotificationToHistory({
        title: notification.title,
        body: notification.body,
        data: notification.data,
        type: 'push'
      });
      
      // Handle foreground notification
      this.handleForegroundNotification(notification);
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('Push notification action performed', notification.actionId, notification.inputValue);
      // Handle notification tap
      this.handleNotificationTap(notification);
    });
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      console.log('💾 Saving FCM token to Firestore...');
      const currentUser = this.firestoreService.getCurrentUser();
      if (currentUser) {
        const deviceInfo = {
          platform: Capacitor.getPlatform(),
          model: await this.getDeviceModel(),
          version: await this.getAppVersion()
        };

        await this.firestoreService.saveDeviceToken(currentUser.uid, token, deviceInfo).toPromise();
        console.log('✅ Device token saved to Firestore successfully!');
        console.log('👤 User ID:', currentUser.uid);
        console.log('📱 Device Info:', deviceInfo);
      } else {
        console.log('⚠️ No authenticated user, cannot save token');
      }
    } catch (error) {
      console.error('❌ Error saving device token:', error);
    }
  }

  private async getDeviceModel(): Promise<string> {
    try {
      const { Device } = await import('@capacitor/device');
      const info = await Device.getInfo();
      return info.model || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  private async getAppVersion(): Promise<string> {
    try {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      return info.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private async handleForegroundNotification(notification: PushNotificationSchema): Promise<void> {
    console.log('Handling foreground notification:', notification);
    
    // Show local notification when app is in foreground
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'Kalinga',
            body: notification.body || 'You have a new notification',
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) },
            sound: undefined,
            attachments: undefined,
            actionTypeId: "",
            extra: notification.data
          }
        ]
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  private handleNotificationTap(notification: ActionPerformed): void {
    console.log('Handling notification tap:', notification);
    
    const data = notification.notification.data;
    
    if (data) {
      // Navigate based on notification data
      if (data.missionId) {
        this.router.navigate(['/mission-detail', data.missionId]);
      } else if (data.route) {
        this.router.navigate([data.route]);
      } else {
        this.router.navigate(['/notifications']);
      }
    } else {
      // Default navigation
      this.router.navigate(['/notifications']);
    }
  }

  async getDeliveredNotifications() {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    console.log('delivered notifications', notificationList);
  }

  // Method to add notification to the list
  addNotificationToHistory(notification: any): void {
    const notificationItem = {
      id: Date.now().toString(),
      title: notification.title || 'Kalinga',
      body: notification.body || 'You have a new notification',
      timestamp: new Date(),
      read: false,
      data: notification.data,
      type: notification.type || 'general'
    };

    // Emit the new notification
    this.newNotificationSubject.next(notificationItem);
    console.log('New notification added:', notificationItem);
  }

  // Method to simulate receiving a push notification
  simulatePushNotification(title: string, body: string, data?: any) {
    this.addNotificationToHistory({
      title,
      body,
      data,
      type: 'general'
    });
  }
}