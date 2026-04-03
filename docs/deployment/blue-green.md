# Blue-Green Deployment

How Librecord achieves zero-downtime updates using blue-green deployment.

Two backend containers (blue and green) alternate. One serves traffic while the other gets updated. If the new version fails its health check, the deploy rolls back automatically.

## How it works

1. CI builds the .NET backend and frontend.
2. `deploy.sh` determines which slot is currently active (blue or green).
3. The new backend starts on the inactive slot.
4. The script waits for the health check to pass.
5. Nginx upstream switches to the new slot.
6. The old slot stops.

If the health check fails, the old slot keeps running and no traffic is disrupted.

## Running a deploy

The deploy script runs automatically through CI, but you can also run it manually:

```bash
# Deploy to production
.github/scripts/deploy.sh prod

# Deploy to test
.github/scripts/deploy.sh test
```

## Port layout

| Environment | Blue Port | Green Port |
|------------|-----------|------------|
| Production | 5111 | 5112 |
| Test | 5121 | 5122 |

## State tracking

The active slot is tracked in `~/.librecord/active-slot` (or `~/.librecord-test/active-slot` for the test environment). The nginx upstream config is written to `/etc/nginx/conf.d/librecord-upstream.conf`.

## CI pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on push to `master` (production) or `test` (test environment). It:

1. Builds the .NET backend and runs tests.
2. Installs frontend dependencies with pnpm, then runs TypeScript checks, Vite build, and ESLint in parallel.
3. Builds the Docker image.
4. Copies the frontend build to `/var/www/librecord/dist`.
5. Runs `deploy.sh` for the blue-green backend swap.

> [!TIP]
> For initial setup of the CI runner and required GitHub secrets, see the [deployment guide](README.md#step-10-set-up-ci-optional).
