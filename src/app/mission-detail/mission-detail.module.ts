import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MissionDetailPageRoutingModule } from './mission-detail-routing.module';

import { MissionDetailPage } from './mission-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MissionDetailPageRoutingModule
  ],
  declarations: [MissionDetailPage]
})
export class MissionDetailPageModule {}
