import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { PushTestPageRoutingModule } from './push-test-routing.module';
import { PushTestPage } from './push-test.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PushTestPageRoutingModule,
    PushTestPage
  ],
  declarations: []
})
export class PushTestPageModule {}