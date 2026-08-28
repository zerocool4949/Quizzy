param(
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

if (-not $env:DOCKER_CONTEXT) { $env:DOCKER_CONTEXT = "nuc" }

$Image = "ghcr.io/zerocool4949/quizzy"
$Sha = (git rev-parse HEAD).Trim()
if (-not $Sha) { throw "Could not resolve git HEAD" }

Write-Host "Building $Image (tags: latest, $Sha) on docker context '$($env:DOCKER_CONTEXT)'..."
docker build -t "${Image}:latest" -t "${Image}:$Sha" .
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

if (-not $NoPush) {
  Write-Host "Pushing $Image..."
  docker push "${Image}:latest"
  if ($LASTEXITCODE -ne 0) { throw "docker push latest failed" }
  docker push "${Image}:$Sha"
  if ($LASTEXITCODE -ne 0) { throw "docker push $Sha failed" }

  # Drop the local per-commit tag now that it's pushed; keep only :latest locally
  # so tags don't pile up on every commit.
  docker rmi "${Image}:$Sha" | Out-Null
}

# Remove dangling images left behind when :latest gets reassigned to the new build.
docker image prune -f | Out-Null

Write-Host "Done."
