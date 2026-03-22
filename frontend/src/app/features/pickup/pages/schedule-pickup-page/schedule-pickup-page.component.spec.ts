import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchedulePickupPageComponent } from './schedule-pickup-page.component';

describe('SchedulePickupPageComponent', () => {
  let component: SchedulePickupPageComponent;
  let fixture: ComponentFixture<SchedulePickupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SchedulePickupPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchedulePickupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
