# The Custom Made Canine — Version 21

Version 21 is based on the last working baseline and hardens startup and scheduling.

## Important fixes
- The interface renders even when an API request fails during startup.
- A visible retry/error message replaces the previous blank-page failure.
- `/api/health` is available for a quick server check.
- Course recurrence is driven by the selected first date; Saturday is not hard-coded.
- Weekly and fortnightly courses use the weekday of the first date automatically.
- Custom course dates are retained while editing.
- Course conflicts are never force-created over bookings, classes, or blocked time.
- Time/date inputs use native date/time pickers.
- Server errors, including large media uploads, return readable JSON errors.

## Run
1. Extract the ZIP to a new folder.
2. Run `start.bat`.
3. If the browser opens a blank page, visit `http://localhost:3000/api/health`; it should show `{ "ok": true, "version": "21.0.0" }`.
4. Refresh the main app.

Keep Version 18 as the fallback until Version 21 has been fully tested.
