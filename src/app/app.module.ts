import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';
import { environment } from '../environments/environment';
import { provideFirestore, getFirestore  } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { PushNotificationService } from './services/push-notification.service';
import { Capacitor } from '@capacitor/core';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
  ],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideAnalytics(() => getAnalytics()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    PushNotificationService
  ],
  bootstrap: [AppComponent],
})
export class AppModule { 
  constructor(private pushNotificationService: PushNotificationService) {
    // Only initialize push notifications on mobile platforms (not web)
    if (Capacitor.getPlatform() !== 'web') {
      // Initialize push notifications when app starts
      this.pushNotificationService.initializePushNotifications();
    } else {
      console.log('Push notifications disabled on web platform');
    }
  }
}