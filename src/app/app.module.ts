import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import {D3ForceChartComponent} from "./d3ForceChart/d3ForceChart.component"; // make sure path is correct

@NgModule({
    declarations: [
        AppComponent,
        D3ForceChartComponent
    ],
    imports: [
        BrowserModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }
