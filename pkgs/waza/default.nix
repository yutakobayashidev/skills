{
  lib,
  stdenvNoCC,
  fetchurl,
}:
let
  inherit (stdenvNoCC.hostPlatform) system;
  version = "0.31.0";
  assets = {
    "aarch64-darwin" = {
      name = "waza-darwin-arm64";
      hash = "sha256-gMMK9rUdePY5UMhGhFvFJeeHixzfaJV7r91Jh0/6FfE=";
    };
    "x86_64-darwin" = {
      name = "waza-darwin-amd64";
      hash = "sha256-1bixv2g1gULHOBeXgbRKhecJ5KHOzPNKt8E+ykQn3S4=";
    };
    "aarch64-linux" = {
      name = "waza-linux-arm64";
      hash = "sha256-oooOfWSh1IK9PMdAX42phZv83o279skUT/BRpcSFlfE=";
    };
    "x86_64-linux" = {
      name = "waza-linux-amd64";
      hash = "sha256-vD2wYJcE0WPpDPexF/MbIUgsATciAGaiCHFNwxKV594=";
    };
  };
  asset = assets.${system} or (throw "unsupported platform for waza: ${system}");
in
stdenvNoCC.mkDerivation {
  pname = "waza";
  inherit version;

  src = fetchurl {
    url = "https://github.com/microsoft/waza/releases/download/v${version}/${asset.name}";
    inherit (asset) hash;
  };

  dontUnpack = true;

  installPhase = ''
    runHook preInstall
    install -Dm755 "$src" "$out/bin/waza"
    runHook postInstall
  '';

  meta = with lib; {
    description = "CLI and framework for evaluating AI agent skills";
    homepage = "https://github.com/microsoft/waza";
    license = licenses.mit;
    mainProgram = "waza";
    platforms = [
      "aarch64-darwin"
      "x86_64-darwin"
      "aarch64-linux"
      "x86_64-linux"
    ];
  };
}
