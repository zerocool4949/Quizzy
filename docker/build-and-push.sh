#!/usr/bin/env bash
set -euo pipefail

export DOCKER_CONTEXT="${DOCKER_CONTEXT:-nuc}"

IMAGE="ghcr.io/zerocool4949/quizzy"
SHA="$(git rev-parse HEAD)"
NO_PUSH="${1:-}"

echo "Building ${IMAGE} (tags: latest, ${SHA}) on docker context '${DOCKER_CONTEXT}'..."
docker build -t "${IMAGE}:latest" -t "${IMAGE}:${SHA}" .

if [ "$NO_PUSH" != "--no-push" ]; then
  echo "Pushing ${IMAGE}..."
  docker push "${IMAGE}:latest"
  docker push "${IMAGE}:${SHA}"

  # Drop the local per-commit tag now that it's pushed; keep only :latest locally
  # so tags don't pile up on every commit.
  docker rmi "${IMAGE}:${SHA}" >/dev/null
fi

# Remove dangling images left behind when :latest gets reassigned to the new build.
docker image prune -f >/dev/null

echo "Done."
