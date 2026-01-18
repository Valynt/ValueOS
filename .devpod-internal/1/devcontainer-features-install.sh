#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Docker (docker-outside-of-docker)" (ghcr.io/devcontainers/features/docker-outside-of-docker) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Docker (docker-outside-of-docker)'
echo 'Description   : Re-use the host docker socket, adding the Docker CLI to a container. Feature invokes a script to enable using a forwarded Docker socket within a container to run Docker commands.'
echo 'Id            : ghcr.io/devcontainers/features/docker-outside-of-docker'
echo 'Version       : 1.6.5'
echo 'Documentation : https://github.com/devcontainers/features/tree/main/src/docker-outside-of-docker'
echo 'Options       :'
echo '    DOCKERDASHCOMPOSEVERSION="v2"
    ENABLENONROOTDOCKER="true"
    INSTALLDOCKERBUILDX="true"
    INSTALLDOCKERCOMPOSESWITCH="true"
    MOBY="true"
    MOBYBUILDXVERSION="latest"
    VERSION="latest"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
