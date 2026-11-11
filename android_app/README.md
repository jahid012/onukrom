# Onukrom — staff app (Android)

The app for **sales reps (SR)** and **delivery men (DM)**. Bangla by default, English
switchable. It works fully offline and syncs when the phone gets internet.

## Setup

1. Open `android_app/` in Android Studio (JDK 21, Android SDK 36.1).
2. Add to `android_app/local.properties` (not committed):

    ```properties
    # Public Mapbox token (starts with pk.) — https://account.mapbox.com/access-tokens/
    MAPBOX_ACCESS_TOKEN=pk.xxxxxxxx
    # Server the app asks "which company is this code?". Must end with /api/v1/
    API_BASE_URL=http://10.0.2.2:8000/api/v1/
    ```

    `10.0.2.2` is your PC as seen from the Android emulator — run `php artisan serve`
    in the Laravel folder. For a real phone on the same Wi-Fi use your PC's LAN IP
    (`php artisan serve --host=0.0.0.0`). Release builds only allow `https://`.
    Without a Mapbox token everything works except the map screens.

3. Run the `app` configuration, or `./gradlew :app:assembleDebug`.

## Demo login (after `php artisan migrate:fresh --seed`)

| Who               | Company code   | Phone         | Password   |
| ----------------- | -------------- | ------------- | ---------- |
| Sales rep SR07    | `rahimtraders` | `01712111222` | `onukrom1` |
| Delivery man DM01 | `rahimtraders` | `01718343434` | `onukrom1` |
| SR + DM (DM03)    | `rahimtraders` | `01720787878` | `onukrom1` |

## How offline works

- **Room database** keeps the phone's copy: routes, shops, products, price lists,
  stock, my orders (30 days), and my trips.
- Everything the user does (order, new shop, no-order visit, delivery, payment,
  trip status, GPS trail) is written to the local tables **and** an `outbox` row in
  one transaction, so nothing is lost if the app is killed.
- **SyncWorker** (WorkManager) runs when there is internet: right after each save,
  when the network comes back, when the app opens, and every 15 minutes.
  It **pushes** the outbox first, then **pulls** changes.
- Record ids are ULIDs made on the phone, so a retry after a dropped connection
  is answered with `duplicate` instead of creating a second order.
- If the server refuses something (credit limit, order already approved, …)
  it shows under **More → Sync status** with _Retry_ / _Discard_, and the order
  is marked "Not accepted" with the reason.

## Live location on orders (spec §10.5)

GPS starts when the order screen opens. The review step shows accuracy and distance
from the shop. The company's settings (`locationMode`, `maxAccuracy`, `maxAge`, `wait`,
`geofence`, `blockMock`) decide whether Save is allowed. The best fix and a GPS trail
are sent with the order; the server flags `far_from_shop`, `low_accuracy`, `mock`.

## Code map

```
core/          ULID, Bangla number/money formatting, haversine
i18n/          all text, Bangla + English
data/api/      OkHttp client + DTOs for /api/v1
data/db/       Room entities + DAO
data/          Session (DataStore), Repository (local writes + outbox)
sync/          SyncEngine (push/pull), SyncWorker, Connectivity
location/      Fused location, FixPicker
ui/            theme, components, navigation, screens
```
