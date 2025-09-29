import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MissionDetailPage } from './mission-detail.page';

const routes: Routes = [
  {
    path: '',
    component: MissionDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MissionDetailPageRoutingModule {}
