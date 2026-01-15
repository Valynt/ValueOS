# flake.nix
# Optional: For developers who prefer native Nix development
# Synced with .tool-versions by scripts/sync-tool-versions.sh
#
# Usage:
#   nix develop          # Enter development shell
#   direnv allow         # Auto-activate with direnv

{
  description = "ValueOS development environment (Nix path)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

        # Tool versions - ideally synced from .tool-versions via nix/overlays/versions.nix
        # For now, hardcoded to match .tool-versions defaults
        versions = {
          nodejs = "22.11.0";
          python = "3.11.9";
          go = "1.21.13";
        };

        # Use closest available Nix packages
        nodejs = pkgs.nodejs_22;
        python = pkgs.python311;
        go = pkgs.go_1_21;

      in {
        devShells.default = pkgs.mkShell {
          name = "valueos-dev";

          buildInputs = with pkgs; [
            # Core runtime
            nodejs
            nodePackages.pnpm
            python
            go

            # Database tools
            postgresql_15
            redis

            # CLI tools
            supabase-cli
            terraform
            gh

            # Development utilities
            jq
            yq
            direnv
            watchman
            ripgrep
            fd
          ];

          shellHook = ''
            echo "❄️  ValueOS Nix Development Shell"
            echo "   Node.js: $(node --version)"
            echo "   Python:  $(python --version)"
            echo "   Go:      $(go version | cut -d' ' -f3)"
            echo ""
            echo "   Note: This environment mirrors the DevContainer setup"
            echo "   for developers who prefer native Nix development."
            echo ""

            # Source local environment if present
            [[ -f .env.local ]] && source .env.local
            [[ -f .env ]] && source .env

            # Add project binaries to PATH
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';

          # Environment variables matching DevContainer
          NODE_ENV = "development";
          ENVIRONMENT = "development";
          VALUEOS_DEV_MODE = "nix";
        };

        # Formatter
        formatter = pkgs.nixpkgs-fmt;
      }
    );
}
