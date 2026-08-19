# The Custom Made Canine — Version 21.2

## Fix

This build fixes the trainer calendar date parsing issue that could show `invalid date`, `NaN`, or incorrect `Free` labels after selecting a day other than Today.

### Calendar changes
- Uses explicit YYYY-MM-DD parsing rather than relying on browser date-string parsing.
- Validates calendar date keys before displaying them.
- Keeps the selected weekday when moving to the previous/next week.
- Falls back gracefully to a real date instead of rendering NaN/invalid date text.
- Today continues to work as before.

This is a patch to Version 21.1; the clean database and existing functionality are preserved.
