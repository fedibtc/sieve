{
  description = "Sieve CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        src = pkgs.lib.cleanSourceWith {
          src = ./.;
          filter = path: type:
            pkgs.lib.hasInfix "/cli/" path
            || pkgs.lib.hasInfix "/schemas/" path
            || pkgs.lib.hasInfix "/fixtures/" path
            || pkgs.lib.hasInfix "/skills/" path
            || baseNameOf path == "cli"
            || baseNameOf path == "schemas"
            || baseNameOf path == "fixtures"
            || baseNameOf path == "skills";
        };
        sieve = pkgs.rustPlatform.buildRustPackage {
          pname = "sieve";
          version = (builtins.fromTOML (builtins.readFile ./cli/Cargo.toml)).package.version;
          inherit src;
          buildAndTestSubdir = "cli";
          cargoLock.lockFile = ./cli/Cargo.lock;
          nativeCheckInputs = [ pkgs.git ];
          postPatch = ''
            cp cli/Cargo.lock Cargo.lock
          '';
        };
      in
      {
        packages.default = sieve;
        packages.sieve = sieve;
        apps.default = {
          type = "app";
          program = "${sieve}/bin/sieve";
        };
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
            pkgs.corepack
            pkgs.cargo
            pkgs.rustc
            pkgs.rustfmt
            pkgs.clippy
            pkgs.pkg-config
            pkgs.git
          ];
        };
      });
}
