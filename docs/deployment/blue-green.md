# Blue-Green Deployment

Librecord uses blue-green deployment for zero-downtime updates. Two backend containers (blue and green) alternate — one serves traffic while the other gets updated.

## How It Works

1. CI builds the .NET backend and frontend
2. `deploy.sh` determines which slot is active (blue or green)
3. Starts the new backend on the inactive slot
4. Waits for the health check to pass
5. Switches nginx upstream to the new slot
6. Stops the old slot

If the health check fails, the script rolls back automatically — the old slot keeps running.

## Running a Deploy

The deploy script is called by CI automatically, but you can run it manually:

```bash
# Deploy to production
.github/scripts/deploy.sh prod

# Deploy to test
.github/scripts/deploy.sh test
```

## Port Layout

| Environment | Blue Port | Green Port |
|------------|-----------|------------|
| Production | 5111 | 5112 |
| Test | 5121 | 5122 |

## State

The active slot is tracked in `~/.librecord/active-slot` (or `~/.librecord-test/active-slot` for test). The nginx upstream config is written to `/etc/nginx/conf.d/librecord-upstream.conf`.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on push to `master` (production) or `test` (test environment). It:

1. Builds .NET backend and runs tests
2. Installs frontend deps with pnpm, runs TypeScript check, Vite build, and ESLint — all in parallel
3. Builds the Docker image
4. Copies frontend dist to `/var/www/librecord/dist`
5. Runs `deploy.sh` for the blue-green backend swap
