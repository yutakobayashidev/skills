{
  description = "Agent skills collection for AI coding agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    nur-packages = {
      url = "github:yutakobayashidev/nur-packages";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    agent-skills = {
      url = "github:Kyure-A/agent-skills-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    waza-skill = {
      url = "github:microsoft/waza";
      flake = false;
    };
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { system, ... }:
        let
          pkgs = inputs.nixpkgs.legacyPackages.${system};
          agentLib = inputs.agent-skills.lib.agent-skills;

          sources = {
            waza = {
              path = inputs.waza-skill;
              subdir = "skills";
            };
          };

          catalog = agentLib.discoverCatalog sources;
          allowlist = agentLib.allowlistFor {
            inherit catalog sources;
            enable = [ "waza" ];
          };
          selection = agentLib.selectSkills {
            inherit catalog allowlist sources;
            skills = { };
          };
          bundle = agentLib.mkBundle { inherit pkgs selection; };
          localTargets = {
            claude = agentLib.defaultLocalTargets.claude // { enable = true; };
          };
        in
        {
          packages = {
            waza = inputs.nur-packages.packages.${system}.waza;
          };

          apps.skills-install-local = {
            type = "app";
            program = "${agentLib.mkLocalInstallScript { inherit pkgs bundle; targets = localTargets; }}/bin/skills-install-local";
          };
        };
    };
}
