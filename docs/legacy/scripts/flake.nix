# DEPRECATED: ValueOS Nix Development Environment
#
# This Nix flake is DEPRECATED as of 2026-01-31.
# The recommended development environment is now the unified dev container.
#
# Migration Guide:
# 1. Install VS Code with Dev Containers extension
# 2. Use "Dev Containers: Reopen in Container" command
# 3. See docs/getting-started/DEVELOPER_GUIDE.md for details
#
# This file is kept for historical reference only.
# Do not use for new development setups.

{
  description = "ValueOS Reproducible Development Environment (DEPRECATED)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    # Development tools
    nix-vscode-extensions.url = "github:nix-community/nix-vscode-extensions";
    nix-vscode-extensions.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    nix-vscode-extensions
  }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            permittedInsecurePackages = [];
          };
        };

        # Development shell packages
        developmentPackages = with pkgs; [
          # Core runtime
          nodejs_22
          nodePackages.npm
          nodePackages.typescript
          nodePackages.tsx

          # Container orchestration
          docker
          docker-compose

          # Secret management
          doppler-cli

          # Database tools
          postgresql_15
          redis

          # Build tools and utilities
          git
          curl
          wget
          jq
          openssl
          bash

          # Development tools
          python311
          go_1_21

          # VS Code server (optional)
          vscode-server

          # Additional tools
          watchexec
          ripgrep
          fd
          tree
        ];

        # Shell configuration
        shellConfiguration = ''
          # ValueOS Development Shell
          echo "🛡️  ValueOS Nix Shell Activated"
          echo "================================"
          echo "Node.js: $(node -v)"
          echo "NPM: $(npm -v)"
          echo "Docker: $(docker --version 2>/dev/null || echo 'Not running')"
          echo "================================"

          # Environment setup
          export NODE_ENV=development
          export PATH="$PWD/node_modules/.bin:$PATH"

          # Ensure local bin is in path
          mkdir -p .local/bin
          export PATH="$PWD/.local/bin:$PATH"

          # Docker environment
          if [ -z "$CONTAINER" ]; then
            export DOCKER_HOST="unix://$HOME/.docker/desktop/docker.sock"
          fi

          # Development helpers
          alias dev-up="pnpm run dx:up"
          alias dev-down="pnpm run dx:down"
          alias dev-logs="pnpm run dx:logs"
          alias dev-ps="pnpm run dx:ps"

          # Database helpers
          alias db-connect="docker exec -it valueos-postgres psql -U postgres -d valuecanvas_dev"
          alias redis-connect="docker exec -it valueos-redis redis-cli"

          # Git helpers
          alias gs="git status"
          alias gp="git pull"
          alias gps="git push"

          echo "💡 Quick commands:"
          echo "   dev-up     - Start the full development stack (DX)"
          echo "   dev-down   - Stop all services (DX)"
          echo "   dev-logs   - View service logs (DX)"
          echo "   db-connect - Connect to PostgreSQL"
          echo ""
          echo "🚀 Ready for ValueOS development!"
        '';

        # Development shell
        developmentShell = pkgs.mkShell {
          buildInputs = developmentPackages;

          shellHook = shellConfiguration;

          # Environment variables
          DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/valuecanvas_dev";
          REDIS_URL = "redis://localhost:6379";
          NODE_ENV = "development";

          # Shell configuration
          shellAliases = {
            dev-up = "pnpm run dx:up";
            dev-down = "pnpm run dx:down";
            dev-logs = "pnpm run dx:logs";
            dev-ps = "pnpm run dx:ps";
          };
        };

        # VS Code development environment
        vscodeEnvironment = {
          extensions = with nix-vscode-extensions.extensions.${system}.vscode-marketplace; [
            # Core development
            dbaeumer.vscode-eslint
            esbenp.prettier-vscode
            bradlc.vscode-tailwindcss

            # TypeScript/React
            ms-vscode.vscode-typescript-next
            ms-vscode.vscode-json

            # Docker
            ms-azuretools.vscode-docker

            # Database
            ms-mssql.mssql
            cweijan.vscode-redis-client

            # Git
            eamodio.gitlens

            # Utilities
            ms-vscode.hexeditor
            redhat.vscode-yaml
          ];

          settings = {
            "terminal.integrated.shell.linux" = "/run/current-system/sw/bin/bash";
            "editor.formatOnSave" = true;
            "editor.defaultFormatter" = "esbenp.prettier-vscode";
            "files.exclude" = {
              "**/node_modules" = true;
              "**/dist" = true;
              "**/.git" = true;
            };
            "search.exclude" = {
              "**/node_modules" = true;
              "**/dist" = true;
            };
          };
        };

      in
      {
        # Development packages
        packages = developmentPackages;

        # Development shell
        devShells.default = developmentShell;

        # VS Code environment
        vscode = vscodeEnvironment;

        # App formatter for nixpkgs-fmt
        formatter = pkgs.nixpkgs-fmt;

        # Checks for CI
        checks = {
          shell-check = developmentShell;
          format-check = pkgs.runCommand "format-check" {} ''
            ${pkgs.nixpkgs-fmt}/bin/nixpkgs-fmt --check ${self}
            touch $out
          '';
        };
      });
}
