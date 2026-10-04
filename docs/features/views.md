# Views

The View button (V, or the wheel's View key) cycles through: Classic → Navigation → Reduced →
Driver assistance → Sport → Auto view. The view's name shows briefly. `?view=<id>` picks one at
start.

- **Classic:** two dials with the centre carousel (map, assist, car, trip, efficiency, off-road,
  messages).
- **Navigation:** the map across the full width; digital speed (with the set speed) on the left,
  gear and an rpm/power bar on the right.
- **Reduced:** a large digital speed, the next-turn arrow when guiding, and the gear.
- **Driver assistance:** a wide lane view (lines, traffic, ACC target, blind spots); digital speed
  and gear.
- **Sport:** one central tachometer with speed and gear in the hub, shift lights, power/torque/
  boost/oil bars, and a G-meter with peak ring and lap timer.
- **Auto view:** follows the driving mode (Sport → Sport view, otherwise Classic).

Every view keeps the top strip, bottom strip, telltale row and the overlays (alerts, mode list,
park view, belt status). Layouts are data (`cluster/layouts/views.ts`); switching lives in
`ClusterRenderer.selectView`.
