# The Custom Made Canine — Version 21.1

This build is a clean testing baseline following Version 21.

## Important
- Starts with Amy's trainer account only.
- No example client, dog, booking, or class data is seeded.
- Amy can create courses from the Trainer Dashboard.
- The previous sample Saturday classes have been removed.
- Client email is remembered locally in the browser (password is never stored).
- Client login includes a local-trial password reset flow.
- For this local trial, the reset code is displayed on screen. A production deployment should deliver reset tokens through a verified channel.

## Default trainer
Email: amy@example.com
Password: change-me

Change this password immediately in Account & security.

## Start
Run `start.bat` on Windows. Node.js 18+ is recommended.

The application uses SQLite locally in `data/canine.sqlite`. A fresh database is created on first start.
