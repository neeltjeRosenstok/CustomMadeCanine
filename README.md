# The Custom Made Canine — Version 20

A lightweight, accessible booking and training-management web app for Amy in Nairobi.

## Version 20 highlights

- General recurring class/course builder: any weekday, weekly, every 2 weeks, or custom dates
- Course length is configurable (1–20 sessions); five is only the default
- Native calendar date/time pickers for blocking and rescheduling
- Conflict protection between private bookings, classes and blocked time
- Private-training double-booking protection includes class sessions
- Trainer booking panel has a clear Done / Close action and stronger close button
- Refund decision controls for cancelled paid private bookings: full, partial or none
- Proper Training Resources library with actual file upload form for video, PDF, image, audio and links
- Resource assignment and unassignment remains separate from the master library
- Account & Security page with change-password support
- Existing client booking, dog profile, vaccination, M-Pesa trial and calendar features retained

## Run

1. Install Node.js 20+ (Node 24 is supported by the included `better-sqlite3` version).
2. Extract this folder to a new location.
3. Run `start.bat`.
4. Open `http://localhost:3000`.

The first run installs dependencies and creates the local SQLite database.

## Default trainer login

The defaults come from `.env.example`:

- Email: `amy@example.com`
- Password: `change-me`

Change the password from **☰ → Account & security** after signing in.

## Class/course planning

Amy can create a course with:

- 1–20 classes
- Any weekday
- Every week
- Every 2 weeks
- Custom dates
- A chosen start/end time
- Capacity and price

The system checks every generated session against existing bookings, classes and blocked time before publication.

## Training Resources

The library supports file resources such as video, PDF, images and audio, plus external links. Resources can be assigned to a client, dog or class and later unassigned without deleting the master resource.

## M-Pesa

The app includes the M-Pesa/Daraja integration scaffold and a demo payment mode for local testing. For real payments, configure the Daraja credentials and a publicly reachable callback URL in `.env`.

## Important

This is still a development/trial build. Before live client use, production payment callbacks, authentication recovery, secure deployment, backups, file storage and privacy/security hardening should be completed and tested.
