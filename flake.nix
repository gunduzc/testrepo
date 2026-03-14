{
  description = "Programmable Spaced Repetition Learning Platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        prismaEngines = pkgs.prisma-engines;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_20
            pkgs.openssl
            prismaEngines
          ];

          PRISMA_SCHEMA_ENGINE_BINARY = "${prismaEngines}/bin/schema-engine";
          PRISMA_QUERY_ENGINE_BINARY = "${prismaEngines}/bin/query-engine";
          PRISMA_QUERY_ENGINE_LIBRARY = "${prismaEngines}/lib/libquery_engine.node";
          PRISMA_FMT_BINARY = "${prismaEngines}/bin/prisma-fmt";

          shellHook = ''
            echo "Development environment ready!"
            echo "Run: npm install && npx prisma db push && npm run dev"
          '';
        };
      }
    );
}
