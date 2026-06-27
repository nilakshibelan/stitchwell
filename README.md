# LJ Boutique Lucky Draw Manager

A simple responsive web prototype to manage members, monthly payments, lucky draws, and voucher tracking for a women's boutique club.

## Features
- mobile-friendly dashboard
- add and manage members
- mark monthly payment status
- run monthly lucky draws
- issue vouchers with 2-month expiry
- mark vouchers as used
- local browser storage persistence

## How to use
1. Open `index.html` in a browser.
2. Add members under the Members tab.
3. Mark paid status for the current month.
4. Select the draw month and run the draw.
5. Track vouchers in the Vouchers tab.

## Notes
- This is a frugal prototype built for quick testing and mobile use.
- Data is stored locally in the browser; clearing browser storage will reset data.

## Google Sheets Sync (Optional)
- To enable remote persistence, deploy the included Google Apps Script backend and set `SHEETS_ENDPOINT` inside `app.js`.
- When configured, the app keeps a local copy and also syncs to Google Sheets.
- If the endpoint is not configured, the app continues to work in offline local mode.
