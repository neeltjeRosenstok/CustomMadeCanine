# The Custom Made Canine — Online Test Deployment

This package is based on v21.7.10 and is prepared for Render.

## What this online-test build does

- Keeps the current Node.js + SQLite app.
- Stores SQLite and uploaded files under `/var/data`.
- `render.yaml` attaches a 1 GB Render persistent disk at `/var/data`.
- Uses Render's `PORT` and binds the server to `0.0.0.0`.
- Uses secure session cookies in production.
- Forces demo M-Pesa while `ONLINE_TEST=true`.
- Does not seed the David demo client.
- Contains no copy of your local database or uploads.
- Displays a TEST VERSION warning asking testers not to upload real sensitive documents.

## 1. Create a private GitHub repository

1. Sign in to GitHub.
2. Create a new **private** repository, for example `the-custom-made-canine-test`.
3. Unzip this package.
4. Upload the **contents of the unzipped folder** to that repository.
5. Confirm that the repository contains `render.yaml`, `server.js`, `package.json`, `public/`, and `.gitignore`.

Do not add a local `data` folder or `.env` file.

## 2. Deploy with Render

1. Sign in to Render.
2. Choose **New → Blueprint**.
3. Connect GitHub if Render asks you to.
4. Select the private repository.
5. Render detects the `render.yaml` file.
6. Enter the two secret values Render requests:
   - `ADMIN_EMAIL`: the email Amy will use for the trainer login.
   - `ADMIN_PASSWORD`: a strong password used only for this test deployment.
7. Review the resources. The web service should use the **Starter** plan and show a **1 GB persistent disk** mounted at `/var/data`.
8. Apply/deploy the Blueprint.

When deployment finishes, Render gives the service an HTTPS `onrender.com` URL.

## 3. Test it

Open that URL and sign in as Amy with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you entered in Render.

Send the same HTTPS URL to testers. They can create separate client accounts from phones, tablets, or computers.

Payment is simulated in this online-test build.

## Privacy while testing

Please use invented/test data where possible. Do not ask testers to upload genuine vaccination passports, medical records, or other sensitive documents to this shared test environment.

## Updating later

When a newer build is ready, update the same GitHub repository. Render can redeploy it. The database and uploads remain under `/var/data`, so they survive ordinary code redeploys.

## Why this Blueprint is not Free

Render Free web services use an ephemeral filesystem. A local SQLite database and uploaded images can be lost on redeploy, restart, or spin-down. Render persistent disks require a paid web-service instance. The supplied Blueprint therefore uses the smallest paid web-service tier (`starter`) plus a 1 GB disk so multi-person testing is not constantly reset.

If you only want a disposable demonstration and do not mind losing every tester account, booking, and upload, you can manually create a separate Free web service without the disk.
