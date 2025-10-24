import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: 'splash',
    loadChildren: () => import('./splash/splash.module').then( m => m.SplashPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then( m => m.LoginPageModule),
    canActivate: [GuestGuard]
  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then( m => m.RegisterPageModule),
    canActivate: [GuestGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then( m => m.ProfilePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'notifications',
    loadChildren: () => import('./notifications/notifications.module').then( m => m.NotificationsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile-info',
    loadChildren: () => import('./profile-info/profile-info.module').then( m => m.ProfileInfoPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'missions',
    loadChildren: () => import('./missions/missions.module').then( m => m.MissionsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'donations',
    loadChildren: () => import('./donations/donations.module').then( m => m.DonationsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'leaderboards',
    loadChildren: () => import('./leaderboards/leaderboards.module').then( m => m.LeaderboardsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'mission/:id',
    loadChildren: () => import('./mission-detail/mission-detail.module').then( m => m.MissionDetailPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'emergency',
    loadChildren: () => import('./emergency/emergency.module').then(m => m.EmergencyPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'push-test',
    loadChildren: () => import('./push-test/push-test.module').then(m => m.PushTestPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
