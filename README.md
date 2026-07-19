# Strava Trip Report

An interactive, dynamic trip report dashboard that maps GPS tracks, automatically plots photos/videos along the route, and displays elevation profiles and topographical maps. 

## Local Development

To run this project locally, simply start a Python server in this directory:
```bash
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your web browser.

## Deploying to Vercel

Since this project has been fully optimized with compressed web assets (`images_web/`), it is perfectly primed for a fast Vercel deployment! 

To deploy this site live:
1. Push this repository to your GitHub account (or if it's already there, proceed to step 2).
2. Create an account at [Vercel](https://vercel.com).
3. Click **Add New... > Project** and connect your GitHub account.
4. Select this repository from your list of projects.
5. Vercel will auto-detect everything and deploy the site instantly. You don't need to specify any special build commands!

## Managing Photos

If you add new photos or videos to the `images/` directory in the future, simply re-run the processing script:
```bash
python3 process_photos.py
```
And then run the compression script to optimize them for the web:
```bash
./compress_media.sh
```
