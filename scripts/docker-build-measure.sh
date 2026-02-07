#!/usr/bin/env bash
set -euo pipefail

APP=${1:-ValyntApp}
IMAGE_TAG=measure:${APP,,}

echo "Using APP=${APP}, image tag=${IMAGE_TAG}"

export DOCKER_BUILDKIT=1

echo "Ensuring a buildx builder is available (creates 'measure-builder' if missing)"
docker buildx inspect measure-builder >/dev/null 2>&1 || docker buildx create --use --name measure-builder

echo
echo "=== Cold build: build 'build' stage (no cache) ==="
start=$(date +%s)
DOCKER_BUILDKIT=1 docker buildx build --progress=plain --no-cache --load --target build -t ${IMAGE_TAG}-build:latest --build-arg APP=${APP} .
end=$(date +%s)
cold_build=$((end-start))
echo "Cold build (build stage) time: ${cold_build}s"

echo
echo "Extracting native deps report from build image"
rm -f native-deps.txt || true
container=$(docker create --name tmp_extract ${IMAGE_TAG}-build:latest /bin/true || true)
if [ -n "${container}" ]; then
	docker cp ${container}:/artifacts/native-deps.txt ./native-deps.txt || true
	docker rm -v ${container} >/dev/null || true
fi

if [ -f native-deps.txt ]; then
	echo "Found native-deps.txt:"; echo '---'; sed -n '1,200p' native-deps.txt; echo '---'
else
	echo "native-deps.txt not found in build image; proceeding with caution"
fi

echo
echo "Deciding runtime target based on native deps report"
if [ -f native-deps.txt ] && grep -qi "not found" native-deps.txt; then
	echo "Missing shared libs detected; selecting fallback runtime: production (slim)"
	RUNTIME_TARGET=production
else
	echo "No missing shared libs detected; selecting distroless runtime: production-distroless"
	RUNTIME_TARGET=production-distroless
fi

echo
echo "=== Cold final image build (target=${RUNTIME_TARGET}) ==="
start=$(date +%s)
DOCKER_BUILDKIT=1 docker buildx build --progress=plain --load -t ${IMAGE_TAG} --target ${RUNTIME_TARGET} --build-arg APP=${APP} .
end=$(date +%s)
cold_final=$((end-start))
echo "Cold final image build time: ${cold_final}s"

echo
echo "Image size after cold final build:"
docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "^${IMAGE_TAG}" || true

echo
echo "=== Warm rebuild: build 'build' stage (using cache) ==="
start=$(date +%s)
DOCKER_BUILDKIT=1 docker buildx build --progress=plain --load --target build -t ${IMAGE_TAG}-build:latest --build-arg APP=${APP} .
end=$(date +%s)
warm_build=$((end-start))
echo "Warm build (build stage) time: ${warm_build}s"

echo
echo "=== Warm final image build (target=${RUNTIME_TARGET}) ==="
start=$(date +%s)
DOCKER_BUILDKIT=1 docker buildx build --progress=plain --load -t ${IMAGE_TAG} --target ${RUNTIME_TARGET} --build-arg APP=${APP} .
end=$(date +%s)
warm_final=$((end-start))
echo "Warm final image build time: ${warm_final}s"

echo
echo "Image size after warm final build:"
docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "^${IMAGE_TAG}" || true

echo
echo "Summary (seconds):"
echo "  Cold build (build stage): ${cold_build}s"
echo "  Cold final image build: ${cold_final}s"
echo "  Warm build (build stage): ${warm_build}s"
echo "  Warm final image build: ${warm_final}s"
echo "  Image: ${IMAGE_TAG} (target=${RUNTIME_TARGET})"

echo
echo "Note: This script builds the intermediate 'build' stage image and inspects /artifacts/native-deps.txt
to decide whether to use the distroless runtime. If the report contains 'not found', the script falls back
to the Debian-slim runtime to avoid musl/glibc incompatibilities."
