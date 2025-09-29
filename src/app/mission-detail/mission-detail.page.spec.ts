import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MissionDetailPage } from './mission-detail.page';

describe('MissionDetailPage', () => {
  let component: MissionDetailPage;
  let fixture: ComponentFixture<MissionDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MissionDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
