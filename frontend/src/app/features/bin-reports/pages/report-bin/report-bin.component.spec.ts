import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportBinComponent } from './report-bin.component';

describe('ReportBinComponent', () => {
  let component: ReportBinComponent;
  let fixture: ComponentFixture<ReportBinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportBinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportBinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
