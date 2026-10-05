# Signals

_Generated from `src/core/signals/catalog.ts` by `npm run docs:signals`. Don't edit by hand._

The cluster knows **146 vehicle signals**. IDs follow the dot-path style of the
[COVESA Vehicle Signal Specification](https://covesa.github.io/vehicle_signal_specification/) (VSS);
where VSS has no matching signal, the ID extends it in the same style. Every value is a number
(booleans 0/1, enums as documented). "Hz" is the rate a healthy source refreshes the signal; the store
marks it stale when updates stop. "OBD" is the standard OBD-II Mode 01 PID that carries the value on a
real car, where one exists; everything else would come from the car's own CAN bus. "Key" is the name
used in code (`S.Speed`).

See [ADR 2](adr/0002-signal-store-vss-ids.md) for why the IDs look like this, and
[ARCHITECTURE](ARCHITECTURE.md) for how a signal travels from the simulator to the display.

## Vehicle (1)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Speed` | Speed | km/h | 0 … 300 | 10 | 0D |  |

## Powertrain (33)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Powertrain.CombustionEngine.Speed` | EngineSpeed | rpm | 0 … 9000 | 10 | 0C |  |
| `Vehicle.Powertrain.CombustionEngine.ECT` | CoolantTemp | celsius | -40 … 150 | 1 | 05 |  |
| `Vehicle.Powertrain.CombustionEngine.EOT` | OilTemp | celsius | -40 … 160 | 1 | 5C |  |
| `Vehicle.Powertrain.CombustionEngine.IsRunning` | EngineRunning | bool | 0/1 | 1 |  |  |
| `Vehicle.Powertrain.CombustionEngine.Boost` | Boost | kPa | -100 … 250 | 4 |  | MAP − barometric, kPa (derived when both exist). |
| `Vehicle.Powertrain.FuelSystem.Level` | FuelLevel | percent | 0 … 100 | 0.5 | 2F |  |
| `Vehicle.Powertrain.FuelSystem.InstantConsumption` | InstantConsumption | L/100km | 0 … 30 | 4 |  | L/100 km (derived). |
| `Vehicle.Powertrain.FuelSystem.AverageConsumption` | AverageConsumption | L/100km | 0 … 30 | 1 |  | L/100 km since trip reset (derived). |
| `Vehicle.Powertrain.Range` | Range | km | 0 … 2000 | 0.5 |  | Remaining range, km. |
| `Vehicle.Powertrain.Transmission.CurrentGear` | Gear | gear | -1 … 10 | 5 |  |  |
| `Vehicle.Powertrain.Transmission.SelectedGear` | SelectedGear | enum | -1 … 127 | 5 |  | VSS semantics: 127 = Drive (automatic mode), 126 = Park, 1..n = manual gear selection. |
| `Vehicle.Powertrain.Transmission.IsShiftRecommended` | ShiftRequest | bool | 0/1 | 5 |  |  |
| `Vehicle.Powertrain.Transmission.DriveProgram` | GearboxMode | enum | 0 … 4 | 2 |  | Gearbox program: 0 D, 1 S, 2 M (manual/paddles), 3 E (eco), 4 B (EV strong regen). |
| `Vehicle.Powertrain.DriveMode` | DriveMode | enum | 0 … 6 | 2 |  | Driving mode: index into DRIVE_MODE_ORDER (eco, comfort, normal, sport, individual, snow, offroad). |
| `Vehicle.Powertrain.Transmission.IsCoasting` | Coasting | bool | 0/1 | 10 |  | Freewheeling with the clutch open (Eco coasting). |
| `Vehicle.Powertrain.CombustionEngine.IsCylinderDeactivated` | CylinderDeactivation | bool | 0/1 | 2 |  |  |
| `Vehicle.Powertrain.Regeneration.Level` | RegenLevel | enum | 0 … 3 | 2 |  | EV lift-off regeneration level 0–3. |
| `Vehicle.Powertrain.PowerRequest` | PowerDemand | percent | -100 … 100 | 20 |  | Power request, % of maximum (negative = % of maximum regeneration). |
| `Vehicle.Powertrain.StartStop.State` | StartStopState | enum | 0 … 4 | 5 |  | Start-stop: 0 off, 1 ready, 2 engine stopped, 3 not available at this stop, 4 restart with the button. |
| `Vehicle.Powertrain.StartStop.BlockReason` | StartStopReason | enum | 0 … 7 | 2 |  | Why start-stop isn't stopping the engine (index into STOP_BLOCKS). |
| `Vehicle.Powertrain.Transmission.GearRecommendation` | GearAdvice | enum | 0 … 2 | 5 |  | Gear advice: 0 none, 1 shift up, 2 shift down. |
| `Vehicle.Powertrain.Transmission.RecommendedGear` | RecommendedGear | gear | 0 … 10 | 5 |  |  |
| `Vehicle.Powertrain.Transmission.ShiftLight` | ShiftLight | enum | -1 … 2 | 30 |  | Shift lights: −1 hidden, 0–1 fill, 2 flashing (shift now). |
| `Vehicle.Powertrain.CombustionEngine.Diesel.IsGlowing` | GlowPlug | bool | 0/1 | 5 |  |  |
| `Vehicle.Powertrain.CombustionEngine.DieselParticulateFilter.Load` | DpfLoad | percent | 0 … 100 | 0.5 |  | Particulate filter soot load, %. |
| `Vehicle.Powertrain.CombustionEngine.DieselParticulateFilter.IsRegenerating` | DpfRegenerating | bool | 0/1 | 1 |  |  |
| `Vehicle.Powertrain.CombustionEngine.DieselExhaustFluid.Range` | DefRange | km | 0 … 20000 | 0.5 |  | Diesel exhaust fluid range, km. |
| `Vehicle.Powertrain.CombustionEngine.EOP.IsLow` | OilPressureLow | bool | 0/1 | 2 |  |  |
| `Vehicle.Powertrain.CombustionEngine.EngineCoolant.IsLevelLow` | CoolantLevelLow | bool | 0/1 | 1 |  |  |
| `Vehicle.Powertrain.Transmission.IsOverheated` | TransmissionHot | bool | 0/1 | 1 |  |  |
| `Vehicle.Powertrain.TractionBattery.StateOfCharge.Current` | SoC | percent | 0 … 100 | 0.5 | 5B | Hybrid/EV traction battery state of charge, %. |
| `Vehicle.Powertrain.TractionBattery.CurrentPower` | TractionPower | kW | -150 … 400 | 10 |  | Traction power, kW; negative while regenerating. |
| `Vehicle.Powertrain.TractionBattery.Temperature.Average` | BatteryTemp | celsius | -40 … 80 | 0.2 |  |  |

## OBD (11)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.OBD.EngineLoad` | EngineLoad | percent | 0 … 100 | 4 | 04 |  |
| `Vehicle.OBD.RunTime` | RunTime | s | 0 … 65535 | 0.5 | 1F |  |
| `Vehicle.OBD.ThrottlePosition` | Throttle | percent | 0 … 100 | 10 | 11 |  |
| `Vehicle.OBD.MAF` | MAF | g/s | 0 … 655 | 4 | 10 |  |
| `Vehicle.OBD.MAP` | MAP | kPa | 0 … 255 | 4 | 0B |  |
| `Vehicle.OBD.BarometricPressure` | BarometricPressure | kPa | 0 … 255 | 0.2 | 33 |  |
| `Vehicle.OBD.IntakeAirTemp` | IntakeTemp | celsius | -40 … 215 | 1 | 0F |  |
| `Vehicle.OBD.FuelRate` | FuelRate | L/h | 0 … 120 | 4 | 5E | Engine fuel rate, L/h (OBD PID 5E). |
| `Vehicle.OBD.Status.IsMILOn` | MIL | bool | 0/1 | 0.5 | 01 |  |
| `Vehicle.OBD.Status.DTCCount` | DTCCount | enum | 0 … 127 | 0.5 | 01 |  |
| `Vehicle.OBD.FuelType` | FuelType | enum | 0 … 23 | 0.1 | 51 |  |

## Chassis (16)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Chassis.SteeringWheel.Angle` | SteeringAngle | deg | -540 … 540 | 20 |  |  |
| `Vehicle.Chassis.Brake.PedalPosition` | BrakePedal | percent | 0 … 100 | 10 |  |  |
| `Vehicle.Chassis.ParkingBrake.IsEngaged` | ParkingBrake | bool | 0/1 | 2 |  |  |
| `Vehicle.Chassis.Axle.Row1.Wheel.Left.Tire.Pressure` | TireFL | kPa | 0 … 400 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row1.Wheel.Right.Tire.Pressure` | TireFR | kPa | 0 … 400 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row2.Wheel.Left.Tire.Pressure` | TireRL | kPa | 0 … 400 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row2.Wheel.Right.Tire.Pressure` | TireRR | kPa | 0 … 400 | 0.2 |  |  |
| `Vehicle.Chassis.Brake.AutoHold.State` | AutoHoldState | enum | 0 … 2 | 5 |  | Auto Hold: 0 off, 1 armed, 2 holding. |
| `Vehicle.Chassis.Brake.IsFluidLevelLow` | BrakeFluidLow | bool | 0/1 | 1 |  |  |
| `Vehicle.Chassis.SteeringWheel.IsAssistFaulty` | PowerSteeringFault | bool | 0/1 | 1 |  |  |
| `Vehicle.Chassis.Brake.IsPadWorn` | BrakePadsWorn | bool | 0/1 | 1 |  |  |
| `Vehicle.Chassis.Axle.Row1.Wheel.Left.Tire.Temperature` | TireTempFL | celsius | -40 … 120 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row1.Wheel.Right.Tire.Temperature` | TireTempFR | celsius | -40 … 120 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row2.Wheel.Left.Tire.Temperature` | TireTempRL | celsius | -40 … 120 | 0.2 |  |  |
| `Vehicle.Chassis.Axle.Row2.Wheel.Right.Tire.Temperature` | TireTempRR | celsius | -40 … 120 | 0.2 |  |  |
| `Vehicle.Chassis.Tire.IsPressureWarning` | TpmsWarning | bool | 0/1 | 1 |  | Indirect tyre monitoring (wheel speeds): a tyre is losing pressure. |

## Body (15)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling` | IndicatorLeft | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling` | IndicatorRight | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Hazard.IsSignaling` | Hazard | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Beam.Low.IsOn` | LowBeam | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Beam.High.IsOn` | HighBeam | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Fog.Front.IsOn` | FogLight | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Fog.Rear.IsOn` | FogRear | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Lights.Parking.IsOn` | ParkingLights | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Windshield.Front.Wiping.Mode` | Wipers | enum | 0 … 4 | 2 |  | 0 off, 1 auto, 2 interval, 3 slow, 4 fast. |
| `Vehicle.Body.Trunk.Rear.IsOpen` | Trunk | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Hood.IsOpen` | Hood | bool | 0/1 | 2 |  |  |
| `Vehicle.Body.Windshield.Front.WasherFluid.IsLevelLow` | WasherFluidLow | bool | 0/1 | 1 |  |  |
| `Vehicle.Body.Lights.IsDefect` | BulbFailure | bool | 0/1 | 1 |  |  |
| `Vehicle.Body.Key.IsBatteryLow` | KeyBatteryLow | bool | 0/1 | 1 |  |  |
| `Vehicle.Body.Lights.Beam.High.IsAutoArmed` | AutoHighBeamArmed | bool | 0/1 | 2 |  |  |

## Cabin (12)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Cabin.Door.Row1.DriverSide.IsOpen` | DoorFrontLeft | bool | 0/1 | 2 |  |  |
| `Vehicle.Cabin.Door.Row1.PassengerSide.IsOpen` | DoorFrontRight | bool | 0/1 | 2 |  |  |
| `Vehicle.Cabin.Door.Row2.DriverSide.IsOpen` | DoorRearLeft | bool | 0/1 | 2 |  |  |
| `Vehicle.Cabin.Door.Row2.PassengerSide.IsOpen` | DoorRearRight | bool | 0/1 | 2 |  |  |
| `Vehicle.Cabin.Seat.Row1.DriverSide.IsBelted` | Seatbelt | bool | 0/1 | 2 |  |  |
| `Vehicle.Cabin.Airbag.IsFaulty` | AirbagFault | bool | 0/1 | 1 |  |  |
| `Vehicle.Cabin.Seat.BeltReminder.Stage` | SeatbeltReminder | enum | 0 … 3 | 5 |  | Seatbelt reminder: 0 none, 1 lamp, 2 flashing + chime, 3 lamp after the chime period. |
| `Vehicle.Cabin.Seat.BeltStatus.IsShown` | BeltStatusVisible | bool | 0/1 | 2 |  | Show the seat-belt status card (after start or when a belt changes). |
| `Vehicle.Cabin.Seat.Row1.PassengerSide.BeltState` | BeltPassenger | enum | 0 … 2 | 2 |  | Seat states: 0 empty, 1 belted, 2 unbelted. |
| `Vehicle.Cabin.Seat.Row2.DriverSide.BeltState` | BeltRearLeft | enum | 0 … 2 | 2 |  |  |
| `Vehicle.Cabin.Seat.Row2.Middle.BeltState` | BeltRearMiddle | enum | 0 … 2 | 2 |  |  |
| `Vehicle.Cabin.Seat.Row2.PassengerSide.BeltState` | BeltRearRight | enum | 0 … 2 | 2 |  |  |

## ADAS (43)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.ADAS.HillDescentControl.State` | HillDescent | enum | 0 … 2 | 2 |  | 0 off, 1 standby, 2 braking. |
| `Vehicle.ADAS.CruiseControl.IsActive` | CruiseActive | bool | 0/1 | 2 |  |  |
| `Vehicle.ADAS.CruiseControl.SpeedSet` | CruiseSpeed | km/h | 0 … 250 | 2 |  |  |
| `Vehicle.ADAS.CruiseControl.State` | SpeedAssistState | enum | 0 … 5 | 10 |  | 0 off, 1 standby, 2 active, 3 overridden, 4 interrupted, 5 hold (stop & go). |
| `Vehicle.ADAS.CruiseControl.Function` | SpeedAssistFunction | enum | 0 … 2 | 2 |  | 0 cruise control, 1 adaptive cruise, 2 speed limiter. |
| `Vehicle.ADAS.CruiseControl.TimeGapLevel` | AccDistance | enum | 1 … 5 | 2 |  | ACC distance setting 1–5. |
| `Vehicle.ADAS.CruiseControl.TargetDistance` | AccTargetDistance | m | -1 … 250 | 20 |  | Distance to the ACC target vehicle, m (−1 = no target). |
| `Vehicle.ADAS.CruiseControl.IsTakeoverRequested` | AccTakeover | bool | 0/1 | 10 |  |  |
| `Vehicle.ADAS.CruiseControl.IsTargetDrivingOff` | AccLeadDrivingOff | bool | 0/1 | 10 |  |  |
| `Vehicle.ADAS.SpeedLimiter.IsExceeded` | LimiterExceeded | bool | 0/1 | 10 |  |  |
| `Vehicle.ADAS.SpeedLimitInfo.Limit` | SpeedLimit | km/h | -1 … 200 | 2 |  | Recognised speed limit, km/h; 0 = no limit (derestricted); −1 = unknown. |
| `Vehicle.ADAS.SpeedLimitInfo.Advisory` | SpeedAdvisory | km/h | 0 … 200 | 2 |  | Advisory speed where there is no limit (German Autobahn 130), km/h; 0 = none. |
| `Vehicle.ADAS.SpeedLimitInfo.IsNoOvertaking` | NoOvertaking | bool | 0/1 | 2 |  |  |
| `Vehicle.ADAS.SpeedLimitInfo.Plate` | SpeedLimitPlate | enum | 0 … 2 | 2 |  | Supplementary plate on the shown sign: 0 none, 1 when wet, 2 time range. |
| `Vehicle.ADAS.SpeedLimitInfo.Source` | SpeedLimitSource | enum | 0 … 1 | 2 |  | Where the limit comes from: 0 camera, 1 map. |
| `Vehicle.ADAS.ISA.State` | IsaState | enum | 0 … 3 | 10 |  | Speed warning (ISA): 0 off, 1 on, 2 over the limit (visual), 3 over the limit (acoustic). |
| `Vehicle.ADAS.ISA.Offset` | IsaOffset | km/h | 0 … 10 | 1 |  |  |
| `Vehicle.ADAS.ABS.IsError` | AbsFault | bool | 0/1 | 1 |  |  |
| `Vehicle.ADAS.ParkAssist.State` | ParkAssistState | enum | 0 … 2 | 5 |  | Park distance control: 0 off, 1 on, 2 on but a sensor is faulty. |
| `Vehicle.ADAS.ParkAssist.Front.Left` | ParkFrontLeft | m | -1 … 5 | 10 |  | Ultrasonic distances, m (−1 = nothing in range). |
| `Vehicle.ADAS.ParkAssist.Front.Centre` | ParkFrontCentre | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Front.Right` | ParkFrontRight | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Rear.Left` | ParkRearLeft | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Rear.Centre` | ParkRearCentre | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Rear.Right` | ParkRearRight | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Side.Left` | ParkLeft | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.Side.Right` | ParkRight | m | -1 … 5 | 10 |  |  |
| `Vehicle.ADAS.ParkAssist.BeepInterval` | ParkBeep | s | -1 … 1 | 10 |  | Beep interval, s (0 silent, −1 continuous); front = higher pitch. |
| `Vehicle.ADAS.ParkAssist.IsFrontBeep` | ParkBeepFront | bool | 0/1 | 10 |  |  |
| `Vehicle.ADAS.TCS.IsEngaged` | TCSActive | bool | 0/1 | 10 |  |  |
| `Vehicle.ADAS.ESC.Mode` | ESCMode | enum | 0 … 2 | 1 |  | 0 on, 1 traction control off, 2 ESC sport. |
| `Vehicle.ADAS.LaneDepartureDetection.IsEnabled` | LaneAssistEnabled | bool | 0/1 | 1 |  |  |
| `Vehicle.ADAS.LaneKeeping.State` | LaneAssistState | enum | 0 … 4 | 10 |  | 0 off, 1 standby, 2 ready (lane keeping), 3 centering, 4 emergency stop. |
| `Vehicle.ADAS.LaneKeeping.LeftLine` | LaneLeft | enum | 0 … 3 | 10 |  | Left/right line: 0 not detected, 1 detected, 2 assisting, 3 departure. |
| `Vehicle.ADAS.LaneKeeping.RightLine` | LaneRight | enum | 0 … 3 | 10 |  |  |
| `Vehicle.ADAS.LaneKeeping.LateralOffset` | LaneOffset | m | -2 … 2 | 20 |  | Offset from the lane centre, m (+ = left). |
| `Vehicle.ADAS.LaneKeeping.HandsOffStage` | HandsOffStage | enum | 0 … 4 | 5 |  | Hands-off escalation: 0 none, 1 message, 2 urgent, 3 brake jolt, 4 emergency stop. |
| `Vehicle.ADAS.IsAssistedDriving` | AssistedDriving | bool | 0/1 | 2 |  | ACC and lane centering working together. |
| `Vehicle.ADAS.ForwardCollision.State` | FcwState | enum | 0 … 7 | 10 |  | 0 off, 1 ready, 2 distance warning, 3 pre-warning, 4 acute warning, 5 braking, 6 hold, 7 unavailable. |
| `Vehicle.ADAS.BlindSpot.Left` | BlindSpotLeft | enum | 0 … 2 | 10 |  | 0 clear, 1 occupied, 2 warning (indicating towards it). |
| `Vehicle.ADAS.BlindSpot.Right` | BlindSpotRight | enum | 0 … 2 | 10 |  |  |
| `Vehicle.ADAS.RearCrossTraffic.State` | CrossTraffic | enum | 0 … 2 | 10 |  | Rear cross traffic: 0 none, 1 warning, 2 braking. |
| `Vehicle.ADAS.ABS.IsEngaged` | ABSActive | bool | 0/1 | 10 |  |  |

## Exterior (2)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.Exterior.AirTemperature` | AmbientTemp | celsius | -40 … 60 | 0.5 | 46 |  |
| `Vehicle.Exterior.LightIntensity` | LightIntensity | percent | 0 … 100 | 1 |  |  |

## Other (13)

| ID | Key | Unit | Range | Hz | OBD | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Vehicle.TripMeterReading` | TripDistance | km | 0 … 100000 | 1 |  | km since trip reset (derived). |
| `Vehicle.AverageSpeed` | AverageSpeed | km/h | 0 … 300 | 1 |  | km/h since trip reset (derived). |
| `Vehicle.TripDuration` | TripDuration | s | 0 … 1000000 | 1 |  | s since trip reset (derived). |
| `Vehicle.LowVoltageBattery.CurrentVoltage` | BatteryVoltage | V | 0 … 16 | 1 | 42 |  |
| `Vehicle.LowVoltageSystemState` | Ignition | enum | 0 … 3 | 2 |  | 0 OFF, 1 ACC, 2 ON, 3 START (cranking). |
| `Vehicle.TraveledDistance` | Odometer | km | 0 … 10000000 | 1 | A6 |  |
| `Vehicle.Acceleration.Longitudinal` | AccelLongitudinal | g | -2 … 2 | 20 |  |  |
| `Vehicle.Acceleration.Lateral` | AccelLateral | g | -2 … 2 | 20 |  |  |
| `Vehicle.CurrentLocation.Altitude` | Altitude | m | -500 … 9000 | 1 |  |  |
| `Vehicle.CurrentLocation.Heading` | Heading | deg | 0 … 360 | 10 |  | Compass heading, degrees (0 = north). |
| `Vehicle.Service.DistanceToService` | ServiceKm | km | -50000 … 50000 | 0.2 |  | Service due in km / days (negative = overdue). |
| `Vehicle.Service.TimeToService` | ServiceDays | enum | -1000 … 1000 | 0.2 |  |  |
| `Vehicle.Driver.FatigueLevel` | FatigueWarning | enum | 0 … 2 | 2 |  | Fatigue: 0 none, 1 "take a break", 2 "consider a break" (long drive). |
