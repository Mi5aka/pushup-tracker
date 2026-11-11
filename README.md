# PushUp Tracker

PushUp Tracker is a static workout log for three push-up variations. Track repetition goals and personal records, view progress charts, and transfer workout history as JSON. The interface is available in English, Russian, Japanese, and Czech.

The app uses HTML, CSS, and vanilla JavaScript. It has no dependencies, account, or backend.

## Run locally

Install Git and Python 3 on macOS or Linux. In a terminal, replace `YOUR-GITHUB-USER` with the repository owner's username and run:

```sh
git clone https://github.com/YOUR-GITHUB-USER/pushup-tracker.git
cd pushup-tracker
python3 -m http.server 8000 --bind localhost
```

Open [http://localhost:8000/](http://localhost:8000/). Stop the server with Ctrl+C. Use localhost for local PWA testing. Opening the HTML file directly does not register the service worker.

## Deploy to Cloudflare Pages

1. Review the clean repository and its commit metadata. Create an empty GitHub repository and push the clean `main` branch.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Import an existing Git repository**. Connect GitHub and select the clean repository.
3. Set the production branch to `main`, the framework preset to **None**, and the build output directory to `.`. Leave the build command and root directory blank. The static files are already in the repository root.
4. Deploy and open the production HTTPS URL shown by Cloudflare, such as `https://YOUR-PROJECT.pages.dev/`. Use the production URL consistently because preview URLs have separate storage.

The app, manifest, and service worker all resolve relative to the site root. See the [Cloudflare Pages Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/).

## Install on iPhone

Open the production URL in Safari. Tap **Share → Add to Home Screen**, enable **Open as Web App** if shown, and tap **Add**. Launch the Home Screen app online once to download the offline files. See [Apple's installation guide](https://support.apple.com/guide/iphone/iphea86e5236/ios).

## Offline use and updates

The service worker downloads and verifies the static app files as a single release. A failed download or a file that differs from the release fingerprint leaves the current version active. Once installed, the app can open offline as long as the browser retains the cache.

Before pushing changes to the app, refresh and check the fingerprints. Commit the updated worker with the changed files. Cloudflare serves the files as they are.

```sh
python3 prepare-release.py
python3 prepare-release.py --check
```

After a deployment, open the app online to download the new release. Close all tabs and Home Screen windows for the app, then reopen it to activate the update. The worker only removes older caches for this app scope.

## Data and backups

Workouts, goals, and language preferences stay in the browser's localStorage. There is no automatic cross-device sync. Each browser profile and origin has separate storage, and the iOS Home Screen app may have storage separate from Safari. Use a dedicated Pages origin for the tracker. Other scripts on the same origin can access its localStorage.

Use **History → Download JSON** before changing origins, clearing browser data, or reinstalling. Use **Import JSON** at the new address. New dates are added, and replacement of matching dates requires confirmation. The backup includes workout history. Goals and language preferences are stored separately. Keep personal backups out of the public repository.

## Manual testing

- Save a workout and a goal, switch the chart type, and reload. Check history, chart, and saved values. Switch between all four languages and confirm the selected language survives reload.
- Export the history and import it into a fresh browser profile. Reimport it and verify that no duplicate records appear.
- Check the manifest and service worker in browser developer tools. After the worker has installed, reload once to confirm it controls the page. Switch offline and reload again.
- For an update test, change an app asset and run the fingerprint command. Reload online to install the new worker, close all app windows, and reopen. Check that the change appears, the old app cache is removed, and workout data remains.
- On iPhone, install from the production URL, launch online, then test reopening in Airplane Mode.
