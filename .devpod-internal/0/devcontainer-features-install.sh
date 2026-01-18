#!/bin/sh
set -e

on_exit () {
	[ $? -eq 0 ] && exit
	echo 'ERROR: Feature "Common Utilities" (ghcr.io/devcontainers/features/common-utils) failed to install! Look at the documentation at ${documentation} for help troubleshooting this error.'
}

trap on_exit EXIT

set -a
. ../devcontainer-features.builtin.env
. ./devcontainer-features.env
set +a

echo ===========================================================================

echo 'Feature       : Common Utilities'
echo 'Description   : Installs a set of common command line utilities, Oh My Zsh!, and sets up a non-root user.'
echo 'Id            : ghcr.io/devcontainers/features/common-utils'
echo 'Version       : 2.5.5'
echo 'Documentation : https://github.com/devcontainers/features/tree/main/src/common-utils'
echo 'Options       :'
echo '    CONFIGUREZSHASDEFAULTSHELL="true"
    INSTALLOHMYZSH="true"
    INSTALLOHMYZSHCONFIG="true"
    INSTALLZSH="true"
    NONFREEPACKAGES="false"
    UPGRADEPACKAGES="true"
    USERGID="1000"
    USERNAME="vscode"
    USERUID="1000"'
echo 'Environment   :'
printenv
echo ===========================================================================

chmod +x ./install.sh
./install.sh
