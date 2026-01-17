#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Go" (ghcr.io/devcontainers/features/go) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Go'
echo 'Description   : Installs Go and common Go utilities. Auto-detects latest version and installs needed dependencies.'
echo 'Id            : ghcr.io/devcontainers/features/go'
echo 'Version       : 1.3.2'
echo 'Documentation : https://github.com/devcontainers/features/tree/main/src/go'
echo 'Options       :'
echo '    GOLANGCILINTVERSION="latest"
    VERSION="1.21"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
