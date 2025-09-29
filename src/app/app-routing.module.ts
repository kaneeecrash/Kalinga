import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'notifications',
    loadChildren: () => import('./notifications/notifications.module').then( m => m.NotificationsPageModule)
  },
  {
    path: 'profile-info',
    loadChildren: () => import('./profile-info/profile-info.module').then( m => m.ProfileInfoPageModule)
  },
  {
    path: 'missions',
    loadChildren: () => import('./missions/missions.module').then( m => m.MissionsPageModule)
  },
  {
    path: 'donations',
    loadChildren: () => import('./donations/donations.module').then( m => m.DonationsPageModule)
  },
  {
    path: 'leaderboards',
    loadChildren: () => import('./leaderboards/leaderboards.module').then( m => m.LeaderboardsPageModule)
  },
  {
    path: 'mission/:id',
    loadChildren: () => import('./mission-detail/mission-detail.module').then( m => m.MissionDetailPageModule)
  },
  {
    path: 'emergency',
    loadChildren: () => import('./emergency/emergency.module').then(m => m.EmergencyPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
